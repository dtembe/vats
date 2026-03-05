# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

VATS (Versatile Audio Transcription & Summarization) is a Python-based tool for local-first audio/video transcription with AI-powered summarization. It supports multiple Whisper backends, speaker diarization, and 5 LLM providers.

## Commands

```bash
# Install (editable mode recommended)
pip install -e .

# Run CLI
vats process recording.mp4              # Single file
vats process recording.mp4 --no-summary # Transcribe only
vats bulk file1.mp4 file2.mp3           # Concurrent bulk processing
vats summarize report.pdf               # Document summarization
vats status                             # System status & GPU info
vats cache stats                        # Cache statistics
vats cache cleanup --force              # Clear all caches

# Run as Python module
python -m vats process recording.mp4

# Windows interactive launcher
vats_start.bat

# Testing
pytest tests/
python tests/test_vats.py               # Custom test suite (13 categories)

# Linting
ruff check src/vats/
ruff format src/vats/
```

## Architecture

### Source Layout
```
src/vats/
├── cli.py           # Argument parsing, command routing
├── app.py           # VATSApp orchestrator — single/bulk processing
├── config.py        # .env loading, performance profiles, utilities
├── audio.py         # Audio extraction, adaptive segmentation
├── transcribe.py    # 3 backends: Whisper, faster-whisper, whisper.cpp
├── diarize.py       # Speaker diarization via pyannote.audio
├── summarize.py     # 5 providers: Ollama, Gemini, DeepSeek, OpenRouter, Z.ai
├── format.py        # Transcript/summary formatting
├── cache.py         # SQLite + pickle hybrid cache with LRU
├── bulk.py          # GPUManager, ResourcePool, BulkProcessor
├── clean.py         # 3-level transcript cleaning pipeline
└── docsummarize.py  # Document text extraction (TXT/MD/PDF/DOCX)
```

### Pipeline Flow (VATSApp.process_recording)
1. **Audio extraction** → WAV via ffmpeg
2. **Segmentation** → Split into chunks (adaptive length based on complexity)
3. **Transcription** → Whisper backends process each segment
4. **Diarization** → Speaker labels merged with transcript segments
5. **Cleaning** → 3-level deduplication and artifact removal
6. **Formatting** → Timestamped transcript output
7. **Summarization** → LLM generates summary from transcript

### Transcription Backends (create_transcriber factory)
Priority order when multiple are available:
1. **WhisperCppTranscriber** — Used when `USE_WHISPER_CPP=true` and path configured (fastest CPU)
2. **FastTranscriber** — faster-whisper with optional Silero VAD (default if installed)
3. **WhisperTranscriber** — Standard openai-whisper (fallback)

### Summarization Providers (create_summarizer factory)
Configured via `AI_MODEL` in `.env`:
- `ollama` — Local LLM via Ollama (no API key required)
- `gemini` — Google Gemini via OpenAI-compatible endpoint
- `deepseek` — DeepSeek API
- `openrouter` — Access to Claude, GPT-4, etc.
- `zai` — Z.ai GLM-4.6

### Performance Profiles (config.py: PROFILES)
Set `PERFORMANCE_PROFILE` to auto-tune parameters:
| Profile | Whisper | Segment | Workers | GPU Memory |
|---------|---------|---------|---------|------------|
| speed | tiny | 120s | 6 trans / 8 split | 95% |
| balanced | small | 180s | 3 trans / 6 split | 90% |
| quality | medium | 300s | 1 trans / 4 split | 80% |

### Caching (cache.py)
- **Model cache** — `./cache/models/` — Loaded Whisper/diarization models
- **Result cache** — `./cache/results/` — Transcription results by file hash
- In-memory LRU layer + SQLite metadata + pickle disk storage
- TTL-based expiry (default 24h)

## Key Patterns

- **Factory functions**: `create_transcriber()`, `create_summarizer()` pick best available backend
- **Lazy initialization**: `_ensure_components()` loads heavy models on first use
- **Lazy imports**: Optional dependencies (torch, faster-whisper, pyannote) imported only when needed
- **Thread-safe model caching**: `_ModelCache` class with lock-based singleton pattern
- **Config via .env**: python-dotenv loads typed defaults; profiles override unset values
- **Parallel processing**: ThreadPoolExecutor for audio splitting and bulk file processing
