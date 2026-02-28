"""
GPU memory management and bulk-processing orchestration for VATS.

Handles:
  - Multi-GPU device selection and memory budgeting
  - Concurrent file processing with a thread pool
  - Resource pooling for transcribers / diarizers
  - Job tracking through pipeline stages
"""

import gc
import logging
import threading
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import dataclass, field
from enum import Enum
from pathlib import Path
from queue import Empty, Queue
from typing import Any, Callable, Dict, List, Optional, Union

logger = logging.getLogger("vats.bulk")

try:
    import torch
    _TORCH = True
except ImportError:
    _TORCH = False


# ---------------------------------------------------------------------------
# Enums / data classes
# ---------------------------------------------------------------------------

class Stage(Enum):
    QUEUED = "queued"
    AUDIO = "audio_extraction"
    TRANSCRIPTION = "transcription"
    DIARIZATION = "diarization"
    FORMATTING = "formatting"
    SUMMARIZATION = "summarization"
    COMPLETED = "completed"
    FAILED = "failed"


@dataclass
class FileJob:
    file_path: Path
    job_id: str
    stage: Stage = Stage.QUEUED
    progress: float = 0.0
    start_time: Optional[float] = None
    end_time: Optional[float] = None
    error: Optional[str] = None
    result: Optional[Dict[str, Any]] = None


# ---------------------------------------------------------------------------
# GPU memory manager
# ---------------------------------------------------------------------------

class GPUManager:
    """Configure and query GPU memory across devices."""

    def __init__(self, memory_fraction: float = 0.9, enable_cleanup: bool = True):
        self.memory_fraction = memory_fraction
        self.enable_cleanup = enable_cleanup
        self.devices: List[str] = []

        if _TORCH and torch.cuda.is_available():
            for i in range(torch.cuda.device_count()):
                self.devices.append(f"cuda:{i}")
                try:
                    torch.cuda.set_per_process_memory_fraction(memory_fraction, i)
                except Exception:
                    pass
                props = torch.cuda.get_device_properties(i)
                logger.info("GPU %d: %s — %.1f GB", i, props.name, props.total_memory / 1e9)

    def best_device(self) -> str:
        if not _TORCH or not torch.cuda.is_available() or not self.devices:
            return "cpu"
        best, best_free = "cpu", 0
        for i, dev in enumerate(self.devices):
            total = torch.cuda.get_device_properties(i).total_memory
            used = torch.cuda.memory_allocated(i)
            free = total - used
            if free > best_free:
                best, best_free = dev, free
        return best

    def memory_info(self, device_idx: int = 0) -> Dict[str, int]:
        if not _TORCH or not torch.cuda.is_available():
            return {"total": 0, "used": 0, "free": 0}
        total = torch.cuda.get_device_properties(device_idx).total_memory
        used = torch.cuda.memory_allocated(device_idx)
        return {"total": total, "used": used, "free": total - used}

    def cleanup(self, device: Optional[str] = None):
        if not _TORCH or not self.enable_cleanup:
            return
        if torch.cuda.is_available():
            if device and device.startswith("cuda:"):
                idx = int(device.split(":")[1])
                with torch.cuda.device(idx):
                    torch.cuda.empty_cache()
            else:
                for i in range(len(self.devices)):
                    with torch.cuda.device(i):
                        torch.cuda.empty_cache()
            gc.collect()


# ---------------------------------------------------------------------------
# Resource pool
# ---------------------------------------------------------------------------

class ResourcePool:
    """Semaphore-gated pool of reusable transcriber / diarizer instances."""

    def __init__(self, max_transcribers: int = 3, max_diarizers: int = 2):
        self._t_sem = threading.Semaphore(max_transcribers)
        self._d_sem = threading.Semaphore(max_diarizers)
        self._t_q: Queue = Queue(maxsize=max_transcribers)
        self._d_q: Queue = Queue(maxsize=max_diarizers)
        for _ in range(max_transcribers):
            self._t_q.put(None)
        for _ in range(max_diarizers):
            self._d_q.put(None)

    def acquire_transcriber(self, factory: Callable):
        self._t_sem.acquire()
        try:
            obj = self._t_q.get_nowait()
        except Empty:
            obj = None
        return obj if obj is not None else factory()

    def release_transcriber(self, obj):
        try:
            self._t_q.put_nowait(obj)
        except Exception:
            pass
        self._t_sem.release()

    def acquire_diarizer(self, factory: Callable):
        self._d_sem.acquire()
        try:
            obj = self._d_q.get_nowait()
        except Empty:
            obj = None
        return obj if obj is not None else factory()

    def release_diarizer(self, obj):
        try:
            self._d_q.put_nowait(obj)
        except Exception:
            pass
        self._d_sem.release()


# ---------------------------------------------------------------------------
# Bulk processor
# ---------------------------------------------------------------------------

class BulkProcessor:
    """Process multiple files concurrently."""

    def __init__(self, config: Dict[str, Any]):
        self.config = config
        self.max_concurrent = config.get("max_concurrent_files", 3)
        self.jobs: List[FileJob] = []
        self.completed_jobs: List[FileJob] = []
        self.failed_jobs: List[FileJob] = []
        self._counter = 0

    def add_files(self, paths: List[Path]) -> List[str]:
        ids = []
        for p in paths:
            self._counter += 1
            jid = f"job_{self._counter:04d}"
            self.jobs.append(FileJob(file_path=p, job_id=jid))
            ids.append(jid)
        return ids

    def process_all(self, app) -> Dict[str, Any]:
        """Run all queued jobs through the app pipeline."""
        start = time.time()
        results: Dict[str, Any] = {"total_files": len(self.jobs), "completed": 0, "failed": 0}

        with ThreadPoolExecutor(max_workers=self.max_concurrent) as pool:
            futures = {}
            for job in self.jobs:
                job.start_time = time.time()
                job.stage = Stage.AUDIO
                fut = pool.submit(self._run_single, app, job)
                futures[fut] = job

            for fut in as_completed(futures):
                job = futures[fut]
                try:
                    fut.result()
                    job.stage = Stage.COMPLETED
                    job.end_time = time.time()
                    self.completed_jobs.append(job)
                    results["completed"] += 1
                except Exception as exc:
                    job.stage = Stage.FAILED
                    job.error = str(exc)
                    job.end_time = time.time()
                    self.failed_jobs.append(job)
                    results["failed"] += 1
                    logger.error("Job %s failed: %s", job.job_id, exc)

        elapsed = time.time() - start
        results["total_time"] = round(elapsed, 2)
        results["avg_time_per_file"] = round(elapsed / max(len(self.jobs), 1), 2)
        return results

    @staticmethod
    def _run_single(app, job: FileJob):
        """Delegate to the app's recording processor."""
        result = app.process_recording(str(job.file_path))
        job.result = result

    def cleanup(self):
        self.jobs.clear()
        self.completed_jobs.clear()
        self.failed_jobs.clear()
