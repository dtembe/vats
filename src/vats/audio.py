"""
Audio processing — extraction from video and segmentation into chunks.

Uses ffmpeg for all heavy lifting. Supports parallel segment extraction
for faster processing on multi-core machines, and adaptive segmentation
that analyses audio characteristics to pick optimal segment lengths.
"""

import logging
import os
import subprocess
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple, Union

import ffmpeg

logger = logging.getLogger("vats.audio")

# Formats that are already pure audio — skip extraction step
_AUDIO_EXTS = {".wav", ".mp3", ".aac", ".flac", ".ogg", ".m4a", ".wma", ".opus"}


class AudioProcessor:
    """Extract audio from media files and split into segments."""

    def __init__(
        self,
        temp_dir: Optional[str] = None,
        segment_length: int = 180,
        max_split_workers: int = 4,
        adaptive: bool = False,
        min_segment_length: float = 30.0,
        max_segment_length: float = 300.0,
    ):
        self.temp_dir = temp_dir or os.path.join(os.environ.get("TEMP", "/tmp"), "vats_audio")
        self.segment_length = segment_length
        self.max_split_workers = max_split_workers
        self.adaptive = adaptive
        self.min_segment_length = min_segment_length
        self.max_segment_length = max_segment_length
        os.makedirs(self.temp_dir, exist_ok=True)

    # ------------------------------------------------------------------
    # Audio extraction
    # ------------------------------------------------------------------

    def extract_audio(self, media_path: Union[str, Path]) -> str:
        """Extract mono 16 kHz WAV from a media file. Returns path to WAV."""
        media_path = Path(media_path)

        if not media_path.exists():
            raise FileNotFoundError(f"File not found: {media_path}")
        if not os.access(str(media_path), os.R_OK):
            raise PermissionError(f"File not readable: {media_path}")

        # Already a WAV at 16 kHz?  We still normalize to ensure mono 16 kHz.
        if media_path.suffix.lower() in _AUDIO_EXTS and media_path.suffix.lower() == ".wav":
            logger.info("Input is WAV — will still normalize to mono 16 kHz")

        # Probe for audio stream
        try:
            probe = ffmpeg.probe(str(media_path))
            if not any(s["codec_type"] == "audio" for s in probe["streams"]):
                raise ValueError(f"No audio stream in {media_path}")
        except ffmpeg.Error as exc:
            raise ValueError(f"Cannot probe {media_path}: {exc.stderr.decode() if exc.stderr else exc}")

        wav_path = Path(self.temp_dir) / f"{media_path.stem}.wav"
        logger.info("Extracting audio → %s", wav_path)

        try:
            (
                ffmpeg
                .input(str(media_path))
                .output(str(wav_path), acodec="pcm_s16le", ac=1, ar="16k")
                .run(quiet=True, overwrite_output=True)
            )
        except ffmpeg.Error as exc:
            raise RuntimeError(f"FFmpeg extraction failed: {exc.stderr.decode() if exc.stderr else exc}")

        if not wav_path.exists() or wav_path.stat().st_size == 0:
            raise RuntimeError("Audio extraction produced an empty file")

        logger.debug("Audio extracted: %s (%.1f MB)", wav_path, wav_path.stat().st_size / 1e6)
        return str(wav_path)

    # ------------------------------------------------------------------
    # Segmentation
    # ------------------------------------------------------------------

    def split_audio(self, audio_path: Union[str, Path], parallel: bool = True) -> List[str]:
        """Split audio into segments. Uses adaptive sizing when enabled."""
        audio_path = Path(audio_path)
        duration = self._get_duration(audio_path)

        seg_len = self.segment_length
        if self.adaptive:
            seg_len = self._adaptive_segment_length(audio_path, duration)
            logger.info("Adaptive segment length: %ds (base=%ds)", seg_len, self.segment_length)

        tasks = self._build_segment_tasks(audio_path, duration, seg_len)

        if len(tasks) <= 1:
            # Single segment — no split needed
            return [str(audio_path)]

        if parallel and self.max_split_workers > 1:
            return self._split_parallel(tasks)
        return self._split_sequential(tasks)

    def _get_duration(self, audio_path: Path) -> float:
        probe = ffmpeg.probe(str(audio_path))
        stream = next(s for s in probe["streams"] if s["codec_type"] == "audio")
        return float(stream["duration"])

    def _build_segment_tasks(self, audio_path: Path, duration: float, seg_len: Optional[int] = None):
        seg_len = seg_len or self.segment_length
        tasks = []
        for i, start in enumerate(range(0, int(duration), seg_len)):
            length = min(seg_len, duration - start)
            seg_path = Path(self.temp_dir) / f"{audio_path.stem}_seg{i:04d}.wav"
            tasks.append((str(audio_path), start, length, str(seg_path)))
        return tasks

    @staticmethod
    def _extract_one_segment(src: str, start: float, length: float, dest: str) -> str:
        (
            ffmpeg
            .input(src, ss=start, t=length)
            .output(dest, acodec="pcm_s16le", ac=1, ar="16k")
            .run(quiet=True, overwrite_output=True)
        )
        return dest

    def _split_parallel(self, tasks) -> List[str]:
        logger.info("Splitting audio into %d segments (parallel, workers=%d)", len(tasks), self.max_split_workers)
        results: List[str] = [None] * len(tasks)  # type: ignore[list-item]
        with ThreadPoolExecutor(max_workers=self.max_split_workers) as pool:
            futures = {
                pool.submit(self._extract_one_segment, *t): idx
                for idx, t in enumerate(tasks)
            }
            for fut in as_completed(futures):
                idx = futures[fut]
                results[idx] = fut.result()
        return results

    def _split_sequential(self, tasks) -> List[str]:
        logger.info("Splitting audio into %d segments (sequential)", len(tasks))
        return [self._extract_one_segment(*t) for t in tasks]

    # ------------------------------------------------------------------
    # Adaptive segmentation
    # ------------------------------------------------------------------

    def _adaptive_segment_length(self, audio_path: Path, duration: float) -> int:
        """Analyse audio to pick optimal segment length."""
        try:
            probe = ffmpeg.probe(str(audio_path))
            streams = [s for s in probe["streams"] if s["codec_type"] == "audio"]
            if not streams:
                return self.segment_length

            stream = streams[0]
            sample_rate = int(stream.get("sample_rate", 44100))
            bitrate = int(stream.get("bit_rate", 128000))

            complexity = self._classify_complexity(duration, bitrate, sample_rate)
            base = float(self.segment_length)

            if complexity == "high":
                base *= 0.75
            elif complexity == "low":
                base *= 1.5

            # Short files: no need for segments larger than the file
            if duration < 300:
                base = min(duration, base)
            elif duration > 3600:
                base = min(base * 1.2, self.max_segment_length)

            optimal = max(min(base, self.max_segment_length), self.min_segment_length)
            return int(optimal)

        except Exception as exc:
            logger.warning("Adaptive analysis failed, using default: %s", exc)
            return self.segment_length

    @staticmethod
    def _classify_complexity(duration: float, bitrate: int, sample_rate: int) -> str:
        if duration > 3600 or bitrate > 320_000 or sample_rate > 48_000:
            return "high"
        if duration < 600 and bitrate < 128_000 and sample_rate <= 44_100:
            return "low"
        return "medium"
