"""
Configuration management for VATS.

Loads settings from .env files and provides typed access with sensible defaults.
Supports performance profiles (speed / balanced / quality) that adjust
processing parameters automatically.
"""

import os
import logging
import re
import tempfile
import shutil
import time
from pathlib import Path
from typing import Any, Dict, Optional, Union
from datetime import datetime
from dataclasses import dataclass, field

from dotenv import load_dotenv

logger = logging.getLogger("vats.config")

# ---------------------------------------------------------------------------
# Performance profiles
# ---------------------------------------------------------------------------

PROFILES: Dict[str, Dict[str, Any]] = {
    "speed": {
        "whisper_model": "tiny",
        "audio_segment_length": 120,
        "max_transcription_workers": 6,
        "max_audio_splitting_workers": 8,
        "gpu_memory_fraction": 0.95,
    },
    "balanced": {
        "whisper_model": "small",
        "audio_segment_length": 180,
        "max_transcription_workers": 3,
        "max_audio_splitting_workers": 6,
        "gpu_memory_fraction": 0.90,
    },
    "quality": {
        "whisper_model": "medium",
        "audio_segment_length": 300,
        "max_transcription_workers": 1,
        "max_audio_splitting_workers": 4,
        "gpu_memory_fraction": 0.80,
    },
}

# ---------------------------------------------------------------------------
# Helper converters
# ---------------------------------------------------------------------------

def _bool(val: str) -> bool:
    return val.strip().lower() in ("true", "1", "yes")


def _int(val: str, default: int = 0) -> int:
    try:
        return int(val)
    except (ValueError, TypeError):
        return default


def _float(val: str, default: float = 0.0) -> float:
    try:
        return float(val)
    except (ValueError, TypeError):
        return default

# ---------------------------------------------------------------------------
# Config loader
# ---------------------------------------------------------------------------

def load_config(env_path: Optional[Union[str, Path]] = None) -> Dict[str, Any]:
    """Load configuration from environment/.env and return a typed dict."""
    if env_path:
        load_dotenv(env_path)
    else:
        load_dotenv()

    cfg: Dict[str, Any] = {
        # AI provider
        "ai_model": os.getenv("AI_MODEL", "ollama").lower(),
        # Ollama
        "ollama_api_url": os.getenv("OLLAMA_API_URL", "http://localhost:11434/v1"),
        "ollama_model": os.getenv("OLLAMA_MODEL", "llama3"),
        # Gemini
        "gemini_api_key": os.getenv("GEMINI_API_KEY", ""),
        "gemini_api_url": os.getenv("GEMINI_API_URL", "https://generativelanguage.googleapis.com/v1beta/openai/"),
        "gemini_model": os.getenv("GEMINI_MODEL", "gemini-2.5-flash"),
        # DeepSeek
        "deepseek_api_key": os.getenv("DEEPSEEK_API_KEY", ""),
        "deepseek_api_url": os.getenv("DEEPSEEK_API_URL", "https://api.deepseek.com/v1"),
        "deepseek_model": os.getenv("DEEPSEEK_MODEL", "deepseek-chat"),
        # OpenRouter
        "openrouter_api_key": os.getenv("OPENROUTER_API_KEY", ""),
        "openrouter_api_url": os.getenv("OPENROUTER_API_URL", "https://openrouter.ai/api/v1"),
        "openrouter_model": os.getenv("OPENROUTER_MODEL", "anthropic/claude-3-haiku"),
        # Z.ai
        "zai_api_key": os.getenv("ZAI_API_KEY", ""),
        "zai_api_url": os.getenv("ZAI_API_URL", "https://api.z.ai/api/coding/paas/v4"),
        "zai_model": os.getenv("ZAI_MODEL", "glm-4.6"),
        "zai_timeout": _int(os.getenv("ZAI_TIMEOUT", "180"), 180),
        # Whisper
        "whisper_model": os.getenv("WHISPER_MODEL", "small"),
        "whisper_language": os.getenv("WHISPER_LANGUAGE") or None,
        "use_whisper_cpp": _bool(os.getenv("USE_WHISPER_CPP", "false")),
        "whisper_cpp_path": os.getenv("WHISPER_CPP_PATH", ""),
        # VAD / transcription tuning
        "vad_threshold": _float(os.getenv("VAD_THRESHOLD", "0.5"), 0.5),
        "beam_size": _int(os.getenv("BEAM_SIZE", "1"), 1),
        "min_segment_length": _float(os.getenv("MIN_SEGMENT_LENGTH", "1.0"), 1.0),
        "max_segment_length": _float(os.getenv("MAX_SEGMENT_LENGTH", "30.0"), 30.0),
        "silence_padding": _float(os.getenv("SILENCE_PADDING", "0.5"), 0.5),
        # Diarization
        "enable_diarization": _bool(os.getenv("ENABLE_DIARIZATION", "true")),
        "max_speakers": _int(os.getenv("MAX_SPEAKERS", "10"), 10),
        "hf_auth_token": os.getenv("HF_AUTH_TOKEN", ""),
        "use_local_diarization": _bool(os.getenv("USE_LOCAL_DIARIZATION", "true")),
        "diarization_models_path": os.getenv("DIARIZATION_MODELS_PATH", "./models"),
        # Processing
        "audio_segment_length": _int(os.getenv("AUDIO_SEGMENT_LENGTH", "180"), 180),
        "num_threads": _int(os.getenv("NUM_THREADS", "8"), 8),
        "enable_summarization": _bool(os.getenv("ENABLE_SUMMARIZATION", "true")),
        "summary_prompt_file": os.getenv("SUMMARY_PROMPT_FILE", "prompts/vats_summary_extract_wisdom.txt"),
        "av_summary_prompt_file": os.getenv("AV_SUMMARY_PROMPT_FILE", ""),
        "text_summary_prompt_file": os.getenv("TEXT_SUMMARY_PROMPT_FILE", ""),
        # Parallel / GPU
        "enable_parallel_processing": _bool(os.getenv("ENABLE_PARALLEL_PROCESSING", "true")),
        "max_transcription_workers": _int(os.getenv("MAX_TRANSCRIPTION_WORKERS", "3"), 3),
        "enable_audio_parallel_splitting": _bool(os.getenv("ENABLE_AUDIO_PARALLEL_SPLITTING", "true")),
        "max_audio_splitting_workers": _int(os.getenv("MAX_AUDIO_SPLITTING_WORKERS", "6"), 6),
        "use_model_caching": _bool(os.getenv("USE_MODEL_CACHING", "true")),
        "performance_profile": os.getenv("PERFORMANCE_PROFILE", "balanced"),
        "gpu_memory_fraction": _float(os.getenv("GPU_MEMORY_FRACTION", "0.9"), 0.9),
        "gpu_memory_cleanup": _bool(os.getenv("GPU_MEMORY_CLEANUP", "true")),
        "enable_multi_gpu": _bool(os.getenv("ENABLE_MULTI_GPU", "true")),
        # Bulk
        "max_concurrent_files": _int(os.getenv("MAX_CONCURRENT_FILES", "3"), 3),
        "batch_summarization": _bool(os.getenv("BATCH_SUMMARIZATION", "true")),
        "pipeline_overlap": _bool(os.getenv("PIPELINE_OVERLAP", "true")),
        # Output
        "default_output_dir": os.getenv("DEFAULT_OUTPUT_DIR", "./output"),
        "cleanup_temp_files": _bool(os.getenv("CLEANUP_TEMP_FILES", "true")),
        "summary_max_tokens": _int(os.getenv("SUMMARY_MAX_TOKENS", "32768"), 32768),
        # Debug
        "debug": _bool(os.getenv("DEBUG", "false")),
    }

    # Set PYTORCH_CUDA_ALLOC_CONF if configured (helps prevent OOM fragmentation)
    cuda_alloc = os.getenv("PYTORCH_CUDA_ALLOC_CONF")
    if cuda_alloc:
        os.environ["PYTORCH_CUDA_ALLOC_CONF"] = cuda_alloc

    # Apply performance profile overrides
    profile_name = cfg["performance_profile"]
    if profile_name in PROFILES:
        profile = PROFILES[profile_name]
        for key, val in profile.items():
            # Only override if user hasn't explicitly set it differently via env
            env_key = key.upper()
            if os.getenv(env_key) is None:
                cfg[key] = val

    logger.debug("Configuration loaded (profile=%s)", profile_name)
    return cfg

# ---------------------------------------------------------------------------
# Utility helpers (migrated from yamts.utils)
# ---------------------------------------------------------------------------

def setup_logging(verbose: bool = False) -> None:
    """Configure application-wide logging."""
    level = logging.DEBUG if verbose else logging.WARNING
    logging.basicConfig(
        level=level,
        format="%(asctime)s  %(name)-28s  %(levelname)-7s  %(message)s",
        handlers=[logging.StreamHandler()],
    )
    for noisy in ("ffmpeg", "whisper", "pyannote", "urllib3", "httpx"):
        logging.getLogger(noisy).setLevel(logging.WARNING)
    logger.debug("Logging configured — level=%s", "DEBUG" if verbose else "WARNING")


def ensure_dir(path: Union[str, Path]) -> Path:
    """Create directory (and parents) if it doesn't exist."""
    p = Path(path)
    p.mkdir(parents=True, exist_ok=True)
    return p


def sanitize_filename(name: str) -> str:
    """Remove characters invalid on Windows/macOS/Linux."""
    return re.sub(r'[<>:"/\\|?*]', "_", name).strip(". ") or "untitled"


def timestamp_str() -> str:
    return datetime.now().strftime("%Y%m%d_%H%M%S")


def make_temp_dir() -> str:
    d = tempfile.mkdtemp(prefix="vats_")
    logger.debug("Created temp dir: %s", d)
    return d


def remove_temp_dir(path: str) -> None:
    if os.path.isdir(path):
        shutil.rmtree(path, ignore_errors=True)
        logger.debug("Removed temp dir: %s", path)


def get_media_info(media_path: Union[str, Path]) -> Dict[str, Any]:
    """Probe a media file with ffmpeg and return metadata."""
    try:
        import ffmpeg as _ff

        p = Path(media_path)
        probe = _ff.probe(str(p))
        info: Dict[str, Any] = {
            "filename": p.name,
            "size_mb": round(p.stat().st_size / (1024 * 1024), 2),
            "format": probe["format"]["format_name"],
            "duration": float(probe["format"].get("duration", 0)),
        }
        for stream in probe["streams"]:
            kind = stream["codec_type"]
            if kind == "audio" and "audio" not in info:
                info["audio"] = {
                    "codec": stream.get("codec_name"),
                    "channels": stream.get("channels"),
                    "sample_rate": stream.get("sample_rate"),
                }
            elif kind == "video" and "video" not in info:
                info["video"] = {
                    "codec": stream.get("codec_name"),
                    "width": stream.get("width"),
                    "height": stream.get("height"),
                }
        return info
    except Exception as exc:
        logger.error("Media probe failed: %s", exc)
        return {"filename": Path(media_path).name, "error": str(exc)}


# ---------------------------------------------------------------------------
# Performance monitor
# ---------------------------------------------------------------------------

class PerfMonitor:
    """Lightweight wall-clock timer for pipeline stages."""

    def __init__(self) -> None:
        self._timers: Dict[str, Dict[str, float]] = {}
        self._counters: Dict[str, int] = {}

    def start(self, name: str) -> None:
        self._timers[name] = {"start": time.time()}

    def stop(self, name: str) -> None:
        if name in self._timers:
            self._timers[name]["end"] = time.time()
            self._timers[name]["elapsed"] = self._timers[name]["end"] - self._timers[name]["start"]
            logger.info("%s completed in %.2fs", name, self._timers[name]["elapsed"])

    def count(self, name: str, n: int = 1) -> None:
        self._counters[name] = self._counters.get(name, 0) + n

    def report(self) -> Dict[str, Any]:
        return {
            "timers": {k: v for k, v in self._timers.items() if "elapsed" in v},
            "counters": dict(self._counters),
        }
