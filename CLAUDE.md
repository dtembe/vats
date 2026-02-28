# CLAUDE.md

## Project Overview

VATS (Versatile Audio Transcription & Summarization) is a Python-based tool for local-first audio/video transcription with AI-powered summarization. It supports multiple Whisper backends, speaker diarization, and 5 LLM providers.

## Commands

- **Install**: `pip install -e .` or `pip install -r requirements.txt`
- **Run (Windows)**: `vats_start.bat`
- **Run (CLI)**: `vats process file.mp4` / `python -m vats process file.mp4`
- **Test**: `pytest tests/` (when tests exist)

## Architecture

- `src/vats/` — All source code as a Python package
- `prompts/` — AI prompt templates
- Entry point: `vats.cli:main` (registered in pyproject.toml)
- Windows launcher: `vats_start.bat` calls `python -m vats`

## Key Patterns

- Factory functions: `create_transcriber()`, `create_summarizer()`
- Lazy imports for optional dependencies (torch, faster-whisper, pyannote)
- Config loaded from `.env` via python-dotenv with typed defaults
- Performance profiles (speed/balanced/quality) auto-tune all parameters
- SQLite + pickle hybrid cache with LRU memory layer
- ThreadPoolExecutor for parallel audio segmentation and bulk processing
