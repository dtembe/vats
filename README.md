# VATS — Versatile Audio Transcription & Summarization

Local-first audio/video transcription, speaker diarization, and AI-powered summarization with multi-provider support and GPU acceleration.

## Features

- **Whisper Transcription** — OpenAI Whisper and faster-whisper backends with automatic model caching
- **Speaker Diarization** — pyannote.audio-based speaker identification
- **5 AI Providers** — Ollama (local), Google Gemini, DeepSeek, OpenRouter, Z.ai
- **Bulk Processing** — Concurrent multi-file pipeline with multi-GPU support
- **Document Summarization** — Summarize TXT, MD, PDF, and DOCX files
- **Performance Profiles** — speed / balanced / quality presets
- **Persistent Cache** — SQLite-backed cache with LRU memory layer
- **Prompt Templates** — Configurable prompt library for different content types

## Quick Start

### 1. Install

```bash
# Clone the repo
git clone https://github.com/dtembe/vats.git
cd vats

# Install (editable mode recommended)
pip install -e .

# Or use requirements.txt
pip install -r requirements.txt
```

### 2. Configure

```bash
cp .env.example .env
# Edit .env — set AI_MODEL, API keys, Whisper model, etc.
```

### 3. Run

**Windows launcher (interactive menu):**
```
vats_start.bat
```

**CLI:**
```bash
# Process a single file
vats process recording.mp4

# Transcribe only (no AI summary)
vats process recording.mp4 --no-summary

# Bulk process
vats bulk file1.mp4 file2.mp3 file3.wav

# Summarize a document
vats summarize report.pdf

# System status
vats status

# Cache management
vats cache stats
vats cache cleanup --force
```

**As a Python module:**
```bash
python -m vats process recording.mp4
```

## AI Providers

Set `AI_MODEL` in `.env` to one of:

| Provider | Value | API Key Required | Notes |
|----------|-------|-----------------|-------|
| Ollama | `ollama` | No | Local LLM, install [Ollama](https://ollama.com) |
| Google Gemini | `gemini` | Yes | `GEMINI_API_KEY` |
| DeepSeek | `deepseek` | Yes | `DEEPSEEK_API_KEY` |
| OpenRouter | `openrouter` | Yes | `OPENROUTER_API_KEY` — access Claude, GPT-4, etc. |
| Z.ai | `zai` | Yes | `ZAI_API_KEY` |

## Prompt Templates

Prompts live in `prompts/` and are selected via `SUMMARY_PROMPT_FILE` in `.env`:

| Template | Use Case |
|----------|----------|
| `vats_summary_prompt_extract_wisdom.txt` | General wisdom extraction (default) |
| `vats_summary_prompt_meeting.txt` | Meeting summaries with action items |
| `vats_summary_prompt.txt` | Quick executive summary |
| `vats_summary_prompt_document.txt` | Document analysis |
| `vats_summary_prompt_video.txt` | Video content analysis |
| `vats_summary_prompt_technical_document.txt` | Technical document analysis |
| `vats_summary_prompt_generic_content.txt` | Generic content summarization |
| `vats_concall_summary_fabric.txt` | Earnings / conference call analysis |
| `vats_summarize_meeting_fabric.txt` | Structured meeting fabric format |

## Performance Profiles

Set `PERFORMANCE_PROFILE` in `.env`:

| Profile | Whisper Model | Segment Length | Workers | GPU Memory |
|---------|--------------|----------------|---------|------------|
| `speed` | tiny | 60s | 4 | 95% |
| `balanced` | small | 120s | 3 | 90% |
| `quality` | medium | 180s | 2 | 85% |

## Project Structure

```
vats/
├── vats_start.bat          # Windows interactive launcher
├── pyproject.toml           # Python packaging
├── requirements.txt         # pip dependencies
├── .env.example             # Configuration template
├── prompts/                 # AI prompt templates
│   ├── vats_summary_prompt_extract_wisdom.txt
│   ├── vats_summary_prompt_meeting.txt
│   └── ...
└── src/vats/
    ├── __init__.py
    ├── __main__.py          # python -m vats support
    ├── cli.py               # CLI entry point
    ├── app.py               # Main orchestrator
    ├── config.py            # Configuration & utilities
    ├── audio.py             # Audio extraction & segmentation
    ├── transcribe.py        # Whisper transcription backends
    ├── diarize.py           # Speaker diarization
    ├── summarize.py         # AI summarization (5 providers)
    ├── format.py            # Transcript & summary formatting
    ├── cache.py             # Persistent cache (SQLite + LRU)
    ├── bulk.py              # Bulk processing & GPU management
    └── docsummarize.py      # Document summarizer
```

## Requirements

- Python 3.10+
- FFmpeg (in PATH)
- CUDA-capable GPU (optional, for acceleration)
- Ollama (optional, for local AI summarization)

## Security

- **Never commit `.env`** — it contains API keys. The `.gitignore` already excludes it.
- Copy `.env.example` to `.env` and add your own keys.
- All AI API calls use HTTPS with certificate verification enabled.
- Credentials are loaded from environment variables only — no hardcoded secrets.

## License

MIT — see [LICENSE](LICENSE).
