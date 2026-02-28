"""
Core VATS application — orchestrates the full pipeline:

  media file → audio extraction → segmentation → transcription
  → diarization → formatting → summarization → output files
"""

import logging
import os
import sys
import time
from pathlib import Path
from typing import Any, Dict, List, Optional, Union

from vats.audio import AudioProcessor
from vats.bulk import BulkProcessor, GPUManager
from vats.cache import cleanup_all_caches, get_model_cache, get_result_cache
from vats.clean import auto_clean
from vats.config import (
    PerfMonitor,
    ensure_dir,
    load_config,
    make_temp_dir,
    remove_temp_dir,
    timestamp_str,
)
from vats.diarize import SpeakerDiarizer, merge_transcript_speakers
from vats.format import TranscriptFormatter
from vats.summarize import create_summarizer
from vats.transcribe import create_transcriber

logger = logging.getLogger("vats.app")


class VATSApp:
    """Main application — single or bulk file processing."""

    def __init__(self, config: Optional[Dict[str, Any]] = None):
        self.config = config or load_config()
        self.perf = PerfMonitor()
        self.gpu = GPUManager(
            memory_fraction=self.config.get("gpu_memory_fraction", 0.9),
            enable_cleanup=self.config.get("gpu_memory_cleanup", True),
        )
        self._transcriber = None
        self._diarizer = None
        self._summarizer = None
        self._formatter = TranscriptFormatter(include_timestamps=True)
        self._bulk: Optional[BulkProcessor] = None
        self._temp_dir: Optional[str] = None
        logger.info("VATSApp initialised (profile=%s)", self.config.get("performance_profile"))

    # ------------------------------------------------------------------
    # Lazy component init
    # ------------------------------------------------------------------

    def _ensure_components(self):
        """Initialise heavy components on first use."""
        if self._transcriber is not None:
            return

        cfg = self.config

        # Transcriber
        self._transcriber = create_transcriber(cfg)
        logger.info("Transcriber ready")

        # Diarizer (optional)
        if cfg.get("enable_diarization", True):
            try:
                self._diarizer = SpeakerDiarizer(
                    auth_token=cfg.get("hf_auth_token") or os.getenv("HF_AUTH_TOKEN", ""),
                    max_speakers=cfg.get("max_speakers", 10),
                )
                logger.info("Speaker diarizer ready")
            except Exception as exc:
                logger.warning("Diarizer unavailable — continuing without speaker labels: %s", exc)
                self._diarizer = None
        else:
            self._diarizer = None

        # Summarizer
        if cfg.get("enable_summarization", True):
            try:
                self._summarizer = create_summarizer(cfg)
                logger.info("Summarizer ready (provider=%s)", cfg.get("ai_model"))
            except Exception as exc:
                logger.error("Summarizer init failed: %s", exc)
                raise
        else:
            self._summarizer = None

    # ------------------------------------------------------------------
    # Single-file pipeline
    # ------------------------------------------------------------------

    def process_recording(
        self,
        input_file: Union[str, Path],
        output_file: Optional[Union[str, Path]] = None,
        summary_prompt: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Full pipeline: media → transcript + summary files. Returns metadata dict."""
        self._ensure_components()
        self.perf.start("total")
        input_path = Path(input_file)
        ts = timestamp_str()
        logger.info("Processing: %s", input_path)

        # Output paths
        out_dir = input_path.parent
        stem = input_path.stem.replace(" ", "_")
        transcript_path = out_dir / f"{stem}_transcript_{ts}.txt"
        summary_path = Path(output_file) if output_file else out_dir / f"{stem}_summary_{ts}.md"
        ensure_dir(out_dir)

        self._temp_dir = make_temp_dir()

        try:
            # 1. Audio extraction
            self.perf.start("audio_extract")
            audio_proc = AudioProcessor(
                temp_dir=self._temp_dir,
                segment_length=self.config.get("audio_segment_length", 180),
                max_split_workers=self.config.get("max_audio_splitting_workers", 4),
                adaptive=True,
                min_segment_length=self.config.get("min_segment_length", 30.0),
                max_segment_length=self.config.get("max_segment_length", 300.0),
            )
            wav_path = audio_proc.extract_audio(input_path)
            self.perf.stop("audio_extract")

            # 2. Split into segments
            self.perf.start("split")
            use_parallel = self.config.get("enable_audio_parallel_splitting", True)
            segments_paths = audio_proc.split_audio(wav_path, parallel=use_parallel)
            self.perf.stop("split")
            logger.info("Audio split into %d segments", len(segments_paths))

            # 3. Transcription
            self.perf.start("transcription")
            all_segments: List[Dict[str, Any]] = []
            full_text_parts: List[str] = []
            offset = 0.0

            for seg_path in segments_paths:
                result = self._transcriber.transcribe_file(seg_path)
                for s in result.get("segments", []):
                    s["start"] += offset
                    s["end"] += offset
                    all_segments.append(s)
                full_text_parts.append(result.get("text", ""))
                # Advance offset by segment duration (approx segment_length)
                if result.get("segments"):
                    offset = result["segments"][-1]["end"]
                else:
                    offset += self.config.get("audio_segment_length", 180)

            transcript = {"text": " ".join(full_text_parts), "segments": all_segments}
            self.perf.stop("transcription")

            # 3b. Transcript cleaning (remove artefacts, dedup)
            if transcript["text"]:
                transcript["text"] = auto_clean(transcript["text"])

            # 4. Diarization
            if self._diarizer:
                self.perf.start("diarization")
                try:
                    diar_segs = self._diarizer.diarize(wav_path)
                    transcript["segments"] = merge_transcript_speakers(all_segments, diar_segs)
                except Exception as exc:
                    logger.warning("Diarization failed, skipping: %s", exc)
                self.perf.stop("diarization")

            # 5. Write transcript
            self.perf.start("format")
            transcript_text = self._formatter.format_transcript(transcript)
            transcript_path.write_text(transcript_text, encoding="utf-8")
            logger.info("Transcript saved → %s", transcript_path)
            self.perf.stop("format")

            # 6. Summarization
            summary_text = ""
            if self._summarizer and self.config.get("enable_summarization", True):
                self.perf.start("summarization")
                # Prefer media-type-specific prompt if configured
                prompt_file = (
                    self.config.get("av_summary_prompt_file")
                    or self.config.get("summary_prompt_file")
                )
                summary_text = self._summarizer.generate_summary(
                    transcript, prompt=summary_prompt, prompt_file=prompt_file
                )
                if summary_text.startswith("Error:"):
                    print(f"\n[WARNING] Summarization failed: {summary_text}")
                    print("  The transcript was saved successfully. You can re-summarize later.")
                # Collect speaker set
                speakers = sorted({s.get("speaker", "SPEAKER") for s in transcript.get("segments", [])})
                from vats.config import get_media_info
                info = get_media_info(input_path)
                meta = {
                    "file_name": input_path.name,
                    "duration": info.get("duration", 0),
                    "date": time.strftime("%Y-%m-%d"),
                    "speakers": speakers,
                }
                formatted_summary = self._formatter.format_summary(summary_text, meta)
                summary_path.write_text(formatted_summary, encoding="utf-8")
                logger.info("Summary saved → %s", summary_path)
                self.perf.stop("summarization")

            self.perf.stop("total")
            return {
                "success": True,
                "transcript_file": str(transcript_path),
                "summary_file": str(summary_path) if summary_text else None,
                "performance": self.perf.report(),
            }

        except Exception as exc:
            logger.error("Processing failed: %s", exc, exc_info=True)
            return {"success": False, "error": str(exc)}

        finally:
            if self._temp_dir and self.config.get("cleanup_temp_files", True):
                remove_temp_dir(self._temp_dir)
                self._temp_dir = None

    # ------------------------------------------------------------------
    # Bulk processing
    # ------------------------------------------------------------------

    def process_files_bulk(self, file_paths: List[Union[str, Path]]) -> Dict[str, Any]:
        """Process multiple files concurrently."""
        self._ensure_components()
        valid = [Path(p) for p in file_paths if Path(p).exists()]
        if not valid:
            return {"success": False, "error": "No valid files found"}

        if self._bulk is None:
            self._bulk = BulkProcessor(self.config)

        self._bulk.add_files(valid)
        start = time.time()

        try:
            results = self._bulk.process_all(self)
            elapsed = time.time() - start

            # Performance improvement estimate vs sequential
            seq_est = results.get("avg_time_per_file", elapsed) * len(valid)
            improvement = seq_est / elapsed if elapsed > 0 else 1

            return {
                "success": True,
                "processing_summary": results,
                "completed_files": [
                    {"file": str(j.file_path), "time": (j.end_time or 0) - (j.start_time or 0)}
                    for j in self._bulk.completed_jobs
                ],
                "failed_files": [
                    {"file": str(j.file_path), "error": j.error}
                    for j in self._bulk.failed_jobs
                ],
                "performance_improvement": {"factor": round(improvement, 1)},
            }
        except Exception as exc:
            return {"success": False, "error": str(exc)}
        finally:
            if self._bulk:
                self._bulk.cleanup()

    # ------------------------------------------------------------------
    # System status
    # ------------------------------------------------------------------

    def get_system_status(self) -> Dict[str, Any]:
        """Return a snapshot of system capabilities and config."""
        gpu_available = False
        gpu_devices: List[str] = []
        gpu_memory: Dict[str, Any] = {}

        try:
            import torch
            gpu_available = torch.cuda.is_available()
            if gpu_available:
                for i in range(torch.cuda.device_count()):
                    name = torch.cuda.get_device_properties(i).name
                    gpu_devices.append(name)
                    info = self.gpu.memory_info(i)
                    gpu_memory[name] = {
                        "total_gb": round(info["total"] / 1e9, 1),
                        "used_gb": round(info["used"] / 1e9, 1),
                        "utilization_percent": round(info["used"] / max(info["total"], 1) * 100, 1),
                    }
        except ImportError:
            pass

        return {
            "vats_version": "1.0.0",
            "gpu_available": gpu_available,
            "gpu_devices": gpu_devices,
            "gpu_memory": gpu_memory,
            "configuration": {
                "performance_profile": self.config.get("performance_profile"),
                "max_concurrent_files": self.config.get("max_concurrent_files"),
                "whisper_model": self.config.get("whisper_model"),
                "ai_model": self.config.get("ai_model"),
            },
            "optimization_features": {
                "bulk_processing": True,
                "gpu_optimization": gpu_available,
                "model_caching": self.config.get("use_model_caching", True),
                "parallel_splitting": self.config.get("enable_audio_parallel_splitting", True),
            },
        }

    # ------------------------------------------------------------------
    # Cleanup
    # ------------------------------------------------------------------

    def cleanup(self):
        try:
            from vats.transcribe import _ModelCache
            _ModelCache.clear()
        except Exception:
            pass
        try:
            from vats.diarize import _PipelineCache
            _PipelineCache.clear()
        except Exception:
            pass
        self.gpu.cleanup()
        if self._temp_dir:
            remove_temp_dir(self._temp_dir)
