"""
Speaker diarization for VATS using pyannote.audio.

Provides speaker identification (who spoke when) and merges results
with transcription segments.
"""

import logging
import os
import threading
from pathlib import Path
from typing import Any, Dict, List, Optional, Union

logger = logging.getLogger("vats.diarize")

try:
    import torch
    _TORCH = True
except ImportError:
    _TORCH = False

try:
    from pyannote.audio import Pipeline as _Pipeline
    _PYANNOTE = True
except ImportError:
    _PYANNOTE = False


# ---------------------------------------------------------------------------
# Pipeline cache
# ---------------------------------------------------------------------------

class _PipelineCache:
    _pipelines: Dict[str, Any] = {}
    _lock = threading.Lock()

    @classmethod
    def get(cls, token: str, device: str, max_speakers: int):
        key = f"{device}_{max_speakers}"
        with cls._lock:
            if key not in cls._pipelines:
                cls._pipelines[key] = cls._build(token, device)
            return cls._pipelines[key]

    @classmethod
    def _build(cls, token: str, device: str):
        if not _PYANNOTE:
            raise ImportError("pyannote.audio not installed. pip install pyannote.audio")
        logger.info("Loading pyannote diarization pipeline on %s", device)
        kw = {"use_auth_token": token} if token else {}
        pipe = _Pipeline.from_pretrained("pyannote/speaker-diarization-3.1", **kw)
        pipe.to(torch.device(device) if _TORCH else "cpu")
        return pipe

    @classmethod
    def clear(cls):
        with cls._lock:
            cls._pipelines.clear()


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

class SpeakerDiarizer:
    """Identify speakers in an audio file."""

    def __init__(
        self,
        auth_token: Optional[str] = None,
        max_speakers: int = 10,
        device: Optional[str] = None,
    ):
        self.auth_token = auth_token or os.getenv("HF_AUTH_TOKEN", "")
        self.max_speakers = max_speakers
        if _TORCH and torch.cuda.is_available():
            self.device = device or "cuda:0"
        else:
            self.device = "cpu"

    def diarize(self, audio_path: Union[str, Path]) -> List[Dict[str, Any]]:
        """Run diarization and return a list of {start, end, speaker} dicts."""
        pipe = _PipelineCache.get(self.auth_token, self.device, self.max_speakers)
        logger.info("Diarizing %s (max_speakers=%d)", audio_path, self.max_speakers)

        result = pipe(str(audio_path), max_speakers=self.max_speakers)

        segments: List[Dict[str, Any]] = []
        for turn, _, speaker in result.itertracks(yield_label=True):
            segments.append({
                "start": turn.start,
                "end": turn.end,
                "speaker": speaker,
            })
        logger.info("Diarization found %d speaker turns", len(segments))
        return segments


def merge_transcript_speakers(
    transcript_segments: List[Dict[str, Any]],
    diarization_segments: List[Dict[str, Any]],
) -> List[Dict[str, Any]]:
    """Assign speaker labels to transcript segments by timestamp overlap."""
    if not diarization_segments:
        return transcript_segments

    merged = []
    for tseg in transcript_segments:
        t_start = tseg.get("start", 0)
        t_end = tseg.get("end", t_start)

        best_speaker = "SPEAKER"
        best_overlap = 0.0

        for dseg in diarization_segments:
            overlap_start = max(t_start, dseg["start"])
            overlap_end = min(t_end, dseg["end"])
            overlap = max(0, overlap_end - overlap_start)
            if overlap > best_overlap:
                best_overlap = overlap
                best_speaker = dseg["speaker"]

        merged.append({**tseg, "speaker": best_speaker})

    return merged
