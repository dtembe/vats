"""
Persistent cache for VATS — disk + memory hybrid with SQLite metadata.

Features:
  - In-memory LRU with configurable max size
  - Disk cache with SQLite metadata tracking
  - TTL-based expiry
  - Thread-safe operations
  - Analytics (hit rate, evictions, etc.)
"""

import hashlib
import logging
import os
import pickle
import sqlite3
import threading
import time
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any, Dict, Optional, Tuple

logger = logging.getLogger("vats.cache")


class CacheAnalytics:
    """Track hit/miss/eviction counts."""

    def __init__(self):
        self.hits = self.misses = self.evictions = self.saves = 0
        self._start = time.time()

    def hit(self):
        self.hits += 1

    def miss(self):
        self.misses += 1

    def evict(self):
        self.evictions += 1

    def save(self):
        self.saves += 1

    @property
    def hit_rate(self) -> float:
        total = self.hits + self.misses
        return self.hits / total if total else 0.0

    def stats(self) -> Dict[str, Any]:
        uptime_h = (time.time() - self._start) / 3600
        return {
            "hits": self.hits,
            "misses": self.misses,
            "hit_rate": round(self.hit_rate, 3),
            "evictions": self.evictions,
            "saves": self.saves,
            "uptime_hours": round(uptime_h, 2),
        }


class PersistentCache:
    """Hybrid memory + disk cache with SQLite metadata."""

    def __init__(
        self,
        cache_dir: str | Path,
        max_memory_mb: int = 512,
        max_disk_gb: float = 5.0,
        ttl_hours: int = 24,
    ):
        self.cache_dir = Path(cache_dir)
        self.cache_dir.mkdir(parents=True, exist_ok=True)
        self._data_dir = self.cache_dir / "data"
        self._data_dir.mkdir(exist_ok=True)

        self._max_mem = max_memory_mb * 1024 * 1024
        self._max_disk = max_disk_gb * 1024 * 1024 * 1024
        self._ttl = timedelta(hours=ttl_hours)

        self._mem: Dict[str, Any] = {}
        self._mem_order: list = []
        self._lock = threading.RLock()
        self.analytics = CacheAnalytics()

        self._db_path = self.cache_dir / "metadata.db"
        self._init_db()

    def _init_db(self):
        with sqlite3.connect(self._db_path) as conn:
            conn.execute("""
                CREATE TABLE IF NOT EXISTS entries (
                    key TEXT PRIMARY KEY,
                    created TEXT,
                    accessed TEXT,
                    hits INTEGER DEFAULT 0,
                    size_bytes INTEGER DEFAULT 0,
                    expires TEXT,
                    file_path TEXT
                )
            """)

    # -- helpers ---

    @staticmethod
    def _hash(key: str) -> str:
        return hashlib.sha256(key.encode()).hexdigest()[:16]

    def _file_for(self, key: str) -> Path:
        h = hashlib.md5(key.encode()).hexdigest()
        sub = self._data_dir / h[:2]
        sub.mkdir(exist_ok=True)
        return sub / f"{h}.pkl"

    # -- public API ---

    def get(self, key: str, namespace: str = "default") -> Optional[Any]:
        full_key = f"{namespace}:{key}"
        with self._lock:
            if full_key in self._mem:
                self.analytics.hit()
                self._mem_order.remove(full_key)
                self._mem_order.append(full_key)
                return self._mem[full_key]

        # Try disk
        fpath = self._file_for(full_key)
        if fpath.exists():
            try:
                # SECURITY: pickle.loads is used here on locally-generated cache files only.
                # Do NOT use this cache with untrusted/external data sources.
                val = pickle.loads(fpath.read_bytes())
                with self._lock:
                    self._mem[full_key] = val
                    self._mem_order.append(full_key)
                self.analytics.hit()
                return val
            except Exception:
                pass

        self.analytics.miss()
        return None

    def set(self, key: str, value: Any, namespace: str = "default") -> None:
        full_key = f"{namespace}:{key}"
        with self._lock:
            self._mem[full_key] = value
            if full_key in self._mem_order:
                self._mem_order.remove(full_key)
            self._mem_order.append(full_key)
            self._evict_memory()

        # Persist to disk
        fpath = self._file_for(full_key)
        try:
            fpath.write_bytes(pickle.dumps(value))
            now = datetime.utcnow().isoformat()
            expires = (datetime.utcnow() + self._ttl).isoformat()
            with sqlite3.connect(self._db_path) as conn:
                conn.execute(
                    "INSERT OR REPLACE INTO entries (key, created, accessed, hits, size_bytes, expires, file_path) "
                    "VALUES (?, ?, ?, 1, ?, ?, ?)",
                    (full_key, now, now, fpath.stat().st_size, expires, str(fpath)),
                )
            self.analytics.save()
        except Exception as exc:
            logger.warning("Cache write failed for %s: %s", full_key, exc)

    def _evict_memory(self):
        """Drop oldest entries when memory budget exceeded (LRU)."""
        est_size = sum(len(str(v)) for v in self._mem.values())
        while est_size > self._max_mem and self._mem_order:
            old_key = self._mem_order.pop(0)
            self._mem.pop(old_key, None)
            self.analytics.evict()
            est_size = sum(len(str(v)) for v in self._mem.values())

    def cleanup(self, force: bool = False):
        """Remove expired entries (or all if force=True)."""
        now = datetime.utcnow().isoformat()
        with sqlite3.connect(self._db_path) as conn:
            if force:
                rows = conn.execute("SELECT key, file_path FROM entries").fetchall()
            else:
                rows = conn.execute("SELECT key, file_path FROM entries WHERE expires < ?", (now,)).fetchall()
            for key, fpath in rows:
                try:
                    if fpath and os.path.exists(fpath):
                        os.remove(fpath)
                except OSError:
                    pass
                conn.execute("DELETE FROM entries WHERE key = ?", (key,))
            conn.commit()
        with self._lock:
            if force:
                self._mem.clear()
                self._mem_order.clear()
        logger.info("Cache cleanup: removed %d entries (force=%s)", len(rows), force)

    def get_stats(self) -> Dict[str, Any]:
        with self._lock:
            mem_entries = len(self._mem)
        with sqlite3.connect(self._db_path) as conn:
            disk_entries = conn.execute("SELECT COUNT(*) FROM entries").fetchone()[0]
            total_bytes = conn.execute("SELECT COALESCE(SUM(size_bytes),0) FROM entries").fetchone()[0]
        return {
            **self.analytics.stats(),
            "memory_entries": mem_entries,
            "disk_entries": disk_entries,
            "size_mb": round(total_bytes / 1e6, 2),
        }


# ---------------------------------------------------------------------------
# Module-level singletons
# ---------------------------------------------------------------------------

_model_cache: Optional[PersistentCache] = None
_result_cache: Optional[PersistentCache] = None


def get_model_cache(cache_dir: str = "./cache/models") -> PersistentCache:
    global _model_cache
    if _model_cache is None:
        _model_cache = PersistentCache(cache_dir, max_memory_mb=2048, max_disk_gb=10)
    return _model_cache


def get_result_cache(cache_dir: str = "./cache/results") -> PersistentCache:
    global _result_cache
    if _result_cache is None:
        _result_cache = PersistentCache(cache_dir, max_memory_mb=512, max_disk_gb=5)
    return _result_cache


def cleanup_all_caches():
    if _model_cache:
        _model_cache.cleanup(force=True)
    if _result_cache:
        _result_cache.cleanup(force=True)
    logger.info("All caches force-cleaned")
