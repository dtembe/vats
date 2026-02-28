"""
VATS - Versatile Audio Transcription & Summarization

A high-performance, scalable Python application for transcribing media files
and generating AI-powered summaries. Supports multiple Whisper backends,
speaker diarization, and multi-provider LLM summarization.
"""

import os as _os
import warnings as _warnings

# Suppress harmless third-party warnings (torchcodec FFmpeg probe,
# pyannote audio io, OMP duplicate lib, etc.) that clutter the console.
_warnings.filterwarnings("ignore", message=".*torchcodec.*")
_warnings.filterwarnings("ignore", message=".*libtorchcodec.*")
_warnings.filterwarnings("ignore", category=UserWarning, module="pyannote")
_os.environ.setdefault("KMP_DUPLICATE_LIB_OK", "TRUE")

__version__ = "1.0.0"
__author__ = "Dan Tembe"
__email__ = "dtembe@yahoo.com"
