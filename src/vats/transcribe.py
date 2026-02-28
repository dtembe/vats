"""
Transcription engines for VATS.

Provides three backends:
  1. WhisperTranscriber     — standard openai-whisper (PyTorch)
  2. FastTranscriber        — faster-whisper + optional Silero VAD
  3. WhisperCppTranscriber  — native whisper.cpp binary (fastest CPU)

A factory function `create_transcriber()` picks the best available backend.
"""

import json
import logging
import os
import subprocess
import threading
from pathlib import Path
from typing import Any, Dict, List, Optional, Union

logger = logging.getLogger("vats.transcribe")

# ---------------------------------------------------------------------------
# Lazy imports — let users install only the backend they need
# ---------------------------------------------------------------------------
try:
    import torch
    _TORCH = True
except ImportError:
    _TORCH = False

try:
    import whisper
    _WHISPER = True
except ImportError:
    _WHISPER = False

try:
    from faster_whisper import WhisperModel as _FWModel
    _FASTER_WHISPER = True
except ImportError:
    _FASTER_WHISPER = False

try:
    from silero_vad import load_silero_vad, read_audio, get_speech_timestamps
    _SILERO = True
except ImportError:
    _SILERO = False


WHISPER_MODELS = ("tiny", "base", "small", "medium", "large")


# ---------------------------------------------------------------------------
# Model cache (shared across transcriber instances)
# ---------------------------------------------------------------------------

class _ModelCache:
    """Thread-safe singleton cache for loaded Whisper models."""

    _models: Dict[str, Any] = {}
    _lock = threading.Lock()

    @classmethod
    def get(cls, name: str, device: str, backend: str = "whisper"):
        key = f"{backend}:{name}@{device}"
        with cls._lock:
            if key not in cls._models:
                cls._models[key] = cls._load(name, device, backend)
            return cls._models[key]

    @classmethod
    def _load(cls, name: str, device: str, backend: str):
        if backend == "faster_whisper":
            compute = "float16" if device.startswith("cuda") else "float32"
            logger.info("Loading faster-whisper %s on %s (%s)", name, device, compute)
            return _FWModel(name, device=device, compute_type=compute)
        else:
            logger.info("Loading whisper %s on %s", name, device)
            model = whisper.load_model(name)
            if device != "cpu":
                model = model.to(device)
            return model

    @classmethod
    def clear(cls, device: Optional[str] = None):
        with cls._lock:
            if device:
                cls._models = {k: v for k, v in cls._models.items() if not k.endswith(f"@{device}")}
            else:
                cls._models.clear()


def best_device() -> str:
    """Return the best available compute device: CUDA > MPS > CPU."""
    if not _TORCH:
        return "cpu"

    # CUDA — pick GPU with most free memory
    if torch.cuda.is_available():
        best, best_free = "cpu", 0
        for i in range(torch.cuda.device_count()):
            props = torch.cuda.get_device_properties(i)
            free = props.total_mem if hasattr(props, "total_mem") else props.total_memory
            free -= torch.cuda.memory_allocated(i)
            if free > best_free:
                best, best_free = f"cuda:{i}", free
        if best != "cpu":
            return best

    # MPS — Apple Silicon
    if hasattr(torch.backends, "mps") and torch.backends.mps.is_available():
        return "mps"

    return "cpu"


# ---------------------------------------------------------------------------
# Backend: standard openai-whisper
# ---------------------------------------------------------------------------

class WhisperTranscriber:
    """Transcriber backed by the openai-whisper library."""

    def __init__(self, model_name: str = "base", language: Optional[str] = None, device: Optional[str] = None):
        if not _WHISPER:
            raise ImportError("openai-whisper is not installed.  pip install openai-whisper")
        self.model_name = model_name if model_name in WHISPER_MODELS else "base"
        self.language = language
        self.device = device or best_device()
        self.model = _ModelCache.get(self.model_name, self.device, "whisper")

    def transcribe_file(self, audio_path: Union[str, Path], **kw) -> Dict[str, Any]:
        opts: Dict[str, Any] = {"language": self.language, "verbose": False}
        opts.update(kw)
        result = self.model.transcribe(str(audio_path), **opts)
        return {
            "text": result.get("text", ""),
            "segments": [
                {"start": s["start"], "end": s["end"], "text": s["text"]}
                for s in result.get("segments", [])
            ],
            "language": result.get("language"),
        }

    def transcribe_batch(self, paths: List[Union[str, Path]], **kw) -> List[Dict[str, Any]]:
        return [self.transcribe_file(p, **kw) for p in paths]


# ---------------------------------------------------------------------------
# Backend: faster-whisper + optional VAD
# ---------------------------------------------------------------------------

class FastTranscriber:
    """Transcriber backed by faster-whisper with optional Silero VAD."""

    def __init__(self, model_name: str = "base", language: Optional[str] = None,
                 device: Optional[str] = None, beam_size: int = 1,
                 vad_threshold: float = 0.5):
        if not _FASTER_WHISPER:
            raise ImportError("faster-whisper is not installed.  pip install faster-whisper")
        self.model_name = model_name if model_name in WHISPER_MODELS else "base"
        self.language = language
        self.device = device or best_device()
        self.beam_size = beam_size
        self.vad_threshold = vad_threshold
        self.model = _ModelCache.get(self.model_name, self.device, "faster_whisper")
        self._vad = None
        if _SILERO:
            try:
                self._vad = load_silero_vad()
            except Exception:
                logger.warning("Silero VAD load failed — proceeding without VAD")

    def transcribe_file(self, audio_path: Union[str, Path], **kw) -> Dict[str, Any]:
        segments_iter, info = self.model.transcribe(
            str(audio_path),
            language=self.language,
            beam_size=self.beam_size,
            vad_filter=self._vad is not None,
            vad_parameters={"threshold": self.vad_threshold} if self._vad else None,
        )
        segments = []
        full_text_parts = []
        for seg in segments_iter:
            segments.append({"start": seg.start, "end": seg.end, "text": seg.text.strip()})
            full_text_parts.append(seg.text.strip())

        return {
            "text": " ".join(full_text_parts),
            "segments": segments,
            "language": info.language if hasattr(info, "language") else None,
        }

    def transcribe_batch(self, paths: List[Union[str, Path]], **kw) -> List[Dict[str, Any]]:
        return [self.transcribe_file(p, **kw) for p in paths]


# ---------------------------------------------------------------------------
# Backend: whisper.cpp native binary
# ---------------------------------------------------------------------------

class WhisperCppTranscriber:
    """Transcriber backed by the whisper.cpp C++ binary — fastest on CPU."""

    # Common executable search locations (relative to whisper_cpp_path dir)
    _WIN_EXES = [
        "build/bin/Release/whisper-cli.exe",
        "build/bin/Release/main.exe",
        "build/bin/Release/whisper.exe",
        "build/Release/main.exe",
        "build/main.exe",
        "build/Release/whisper.exe",
        "build/whisper.exe",
        "main.exe",
        "whisper.exe",
        "whisper-cli.exe",
    ]
    _UNIX_EXES = [
        "build/bin/whisper-cli",
        "build/bin/main",
        "build/bin/whisper",
        "build/main",
        "build/whisper",
        "main",
        "whisper",
        "whisper-cli",
    ]

    def __init__(
        self,
        whisper_cpp_path: str,
        model_name: str = "base",
        language: Optional[str] = None,
        num_threads: int = 4,
    ):
        self.model_name = model_name
        self.language = language
        self.num_threads = num_threads

        cpp_path = Path(whisper_cpp_path)

        # whisper_cpp_path can be a direct executable or a directory
        if cpp_path.is_file():
            self.executable = str(cpp_path)
            # Derive base dir for model lookup
            self._base_dir = cpp_path.parent
            # Walk up from nested build dirs  (e.g. build/bin/Release/)
            for _ in range(4):
                if (self._base_dir / "models").is_dir():
                    break
                self._base_dir = self._base_dir.parent
        else:
            self._base_dir = cpp_path
            self.executable = self._find_executable(cpp_path)

        self.model_path = self._find_model(model_name)
        logger.info("WhisperCppTranscriber ready  exe=%s  model=%s", self.executable, self.model_path)

    # -- executable discovery -----------------------------------------------

    def _find_executable(self, base: Path) -> str:
        candidates = self._WIN_EXES if os.name == "nt" else self._UNIX_EXES
        for rel in candidates:
            p = base / rel
            if p.is_file():
                return str(p)
        raise FileNotFoundError(
            f"whisper.cpp executable not found under {base}. "
            "Build whisper.cpp or set WHISPER_CPP_PATH to the executable directly."
        )

    # -- model discovery ----------------------------------------------------

    def _find_model(self, name: str) -> str:
        search = [
            self._base_dir / "models" / f"ggml-{name}.bin",
            self._base_dir / "models" / f"ggml-{name}-q5_0.bin",
            self._base_dir / "build" / "bin" / "models" / f"ggml-{name}.bin",
            self._base_dir / f"ggml-{name}.bin",
        ]
        for p in search:
            if p.is_file():
                return str(p)
        raise FileNotFoundError(
            f"GGML model '{name}' not found. Download it with:\n"
            f"  curl -L https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-{name}.bin "
            f"-o {self._base_dir / 'models' / f'ggml-{name}.bin'}"
        )

    # -- transcription ------------------------------------------------------

    def transcribe_file(self, audio_path: Union[str, Path], **kw) -> Dict[str, Any]:
        audio_path = str(audio_path)
        logger.info("whisper.cpp transcribing %s", audio_path)

        cmd = [
            self.executable,
            "-m", self.model_path,
            "-t", str(self.num_threads),
            "-f", audio_path,
            "-oj",  # JSON output → writes <audio_path>.json
        ]
        if self.language:
            cmd.extend(["-l", self.language])

        output_json = audio_path + ".json"

        try:
            if os.path.exists(output_json):
                os.unlink(output_json)

            proc = subprocess.run(cmd, check=True, capture_output=True, text=True)
            logger.debug("whisper.cpp rc=%d  stdout=%d  stderr=%d",
                         proc.returncode, len(proc.stdout), len(proc.stderr))

            if not os.path.exists(output_json):
                raise FileNotFoundError(
                    f"whisper.cpp did not produce {output_json}\n"
                    f"stdout: {proc.stdout[:500]}\nstderr: {proc.stderr[:500]}"
                )

            with open(output_json, "r", encoding="utf-8") as fh:
                data = json.loads(fh.read())

            # Parse the whisper.cpp JSON format
            transcription = data.get("transcription", [])
            segments: List[Dict[str, Any]] = []
            text_parts: List[str] = []

            for idx, seg in enumerate(transcription):
                seg_text = seg.get("text", "").strip()
                if not seg_text or seg_text in ("[silence]", " [silence]"):
                    continue
                offsets = seg.get("offsets", {})
                entry = {
                    "id": idx,
                    "start": offsets.get("from", 0) / 1000.0,
                    "end": offsets.get("to", 0) / 1000.0,
                    "text": seg_text,
                }
                segments.append(entry)
                text_parts.append(seg_text)

            return {
                "text": " ".join(text_parts),
                "segments": segments,
                "language": self.language,
            }

        except subprocess.CalledProcessError as exc:
            logger.error("whisper.cpp failed: %s", exc.stderr[:500] if exc.stderr else exc)
            raise
        finally:
            if os.path.exists(output_json):
                os.unlink(output_json)

    def transcribe_batch(self, paths: List[Union[str, Path]], **kw) -> List[Dict[str, Any]]:
        return [self.transcribe_file(p, **kw) for p in paths]


# ---------------------------------------------------------------------------
# Factory
# ---------------------------------------------------------------------------

def create_transcriber(config: Dict[str, Any]):
    """Create the best available transcriber based on config and installed packages."""
    model = config.get("whisper_model", "base")
    lang = config.get("whisper_language")
    device = config.get("device") or best_device()

    # 1. whisper.cpp — requested explicitly via config
    if config.get("use_whisper_cpp"):
        cpp_path = config.get("whisper_cpp_path", "")
        if cpp_path:
            logger.info("Using whisper.cpp backend")
            return WhisperCppTranscriber(
                whisper_cpp_path=cpp_path,
                model_name=model,
                language=lang,
                num_threads=config.get("num_threads", 4),
            )
        logger.warning("use_whisper_cpp=true but WHISPER_CPP_PATH is empty — falling back")

    # 2. faster-whisper + optional VAD
    if _FASTER_WHISPER:
        logger.info("Using faster-whisper backend")
        return FastTranscriber(
            model_name=model,
            language=lang,
            device=device,
            beam_size=config.get("beam_size", 1),
            vad_threshold=config.get("vad_threshold", 0.5),
        )

    # 3. openai-whisper
    if _WHISPER:
        logger.info("Using openai-whisper backend")
        return WhisperTranscriber(model_name=model, language=lang, device=device)

    raise ImportError("No Whisper backend installed. Install openai-whisper or faster-whisper.")
