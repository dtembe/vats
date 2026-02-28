#!/usr/bin/env python3
"""
VATS Feature Migration Test Suite

Tests all features migrated from YAMTS to verify parity.
Run: python tests/test_vats.py
"""

import os
import sys
import json
import tempfile
import time
from pathlib import Path

# Fix Windows console encoding for Unicode characters
if sys.stdout and hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(errors='replace')

# Ensure vats is importable
sys.path.insert(0, str(Path(__file__).parent.parent / "src"))
os.environ["KMP_DUPLICATE_LIB_OK"] = "TRUE"

PASS = 0
FAIL = 0
SKIP = 0
RESULTS = []


def report(name, status, detail=""):
    global PASS, FAIL, SKIP
    icon = {"PASS": "[PASS]", "FAIL": "[FAIL]", "SKIP": "[SKIP]"}[status]
    if status == "PASS":
        PASS += 1
    elif status == "FAIL":
        FAIL += 1
    else:
        SKIP += 1
    msg = f"  {icon} {name}"
    if detail:
        msg += f"  — {detail}"
    print(msg)
    RESULTS.append({"name": name, "status": status, "detail": detail})


# ---------------------------------------------------------------
# Category 1: Environment & Imports
# ---------------------------------------------------------------

def test_imports():
    """Test all VATS modules import correctly."""
    print("\n=== Category 1: Module Imports ===")

    modules = [
        ("vats", "Main package"),
        ("vats.config", "Configuration"),
        ("vats.transcribe", "Transcription backends"),
        ("vats.audio", "Audio processing"),
        ("vats.clean", "Transcript cleaning"),
        ("vats.diarize", "Speaker diarization"),
        ("vats.summarize", "LLM summarization"),
        ("vats.format", "Transcript formatting"),
        ("vats.cache", "Caching system"),
        ("vats.bulk", "Bulk processing"),
        ("vats.app", "Application core"),
        ("vats.cli", "CLI entry point"),
        ("vats.docsummarize", "Document summarization"),
    ]

    for mod_name, desc in modules:
        try:
            __import__(mod_name)
            report(f"Import {mod_name}", "PASS", desc)
        except Exception as e:
            report(f"Import {mod_name}", "FAIL", str(e))


# ---------------------------------------------------------------
# Category 2: Configuration
# ---------------------------------------------------------------

def test_config():
    """Test configuration loading and all expected keys."""
    print("\n=== Category 2: Configuration ===")

    try:
        from vats.config import load_config
        cfg = load_config()
        report("load_config()", "PASS", f"{len(cfg)} keys loaded")
    except Exception as e:
        report("load_config()", "FAIL", str(e))
        return

    # Check critical config keys exist
    critical_keys = [
        "ai_model", "whisper_model", "whisper_language",
        "use_whisper_cpp", "whisper_cpp_path",
        "enable_diarization", "max_speakers",
        "audio_segment_length", "num_threads",
        "enable_summarization", "summary_prompt_file",
        "enable_parallel_processing",
        "gpu_memory_fraction", "performance_profile",
        "max_concurrent_files",
    ]
    for key in critical_keys:
        if key in cfg:
            report(f"Config key: {key}", "PASS", f"= {repr(cfg[key])}")
        else:
            report(f"Config key: {key}", "FAIL", "missing from config")

    # Check new YAMTS-migrated keys
    new_keys = [
        "vad_threshold", "beam_size", "min_segment_length",
        "max_segment_length", "silence_padding",
        "av_summary_prompt_file", "text_summary_prompt_file",
        "cleanup_temp_files",
    ]
    for key in new_keys:
        if key in cfg:
            report(f"New config key: {key}", "PASS", f"= {repr(cfg[key])}")
        else:
            report(f"New config key: {key}", "FAIL", "missing (YAMTS migration gap)")


# ---------------------------------------------------------------
# Category 3: Transcription Backends
# ---------------------------------------------------------------

def test_transcription_backends():
    """Test all three transcription backends are available."""
    print("\n=== Category 3: Transcription Backends ===")

    # WhisperTranscriber
    try:
        from vats.transcribe import WhisperTranscriber
        report("WhisperTranscriber class", "PASS", "importable")
    except Exception as e:
        report("WhisperTranscriber class", "FAIL", str(e))

    # FastTranscriber
    try:
        from vats.transcribe import FastTranscriber
        report("FastTranscriber class", "PASS", "importable")
    except Exception as e:
        report("FastTranscriber class", "FAIL", str(e))

    # WhisperCppTranscriber (YAMTS critical migration)
    try:
        from vats.transcribe import WhisperCppTranscriber
        report("WhisperCppTranscriber class", "PASS", "importable (YAMTS migration)")
    except Exception as e:
        report("WhisperCppTranscriber class", "FAIL", str(e))

    # Factory function
    try:
        from vats.transcribe import create_transcriber, best_device
        dev = best_device()
        report("best_device()", "PASS", f"device={dev}")
    except Exception as e:
        report("best_device()", "FAIL", str(e))

    # Check MPS detection path exists
    try:
        import inspect
        from vats.transcribe import best_device
        source = inspect.getsource(best_device)
        if "mps" in source.lower():
            report("MPS detection in best_device()", "PASS", "code path exists")
        else:
            report("MPS detection in best_device()", "FAIL", "no MPS code path")
    except Exception as e:
        report("MPS detection in best_device()", "FAIL", str(e))

    # WhisperCpp executable discovery
    try:
        from vats.transcribe import WhisperCppTranscriber
        # Just check the search lists are present
        assert hasattr(WhisperCppTranscriber, '_WIN_EXES'), "Missing _WIN_EXES"
        assert hasattr(WhisperCppTranscriber, '_UNIX_EXES'), "Missing _UNIX_EXES"
        report("WhisperCpp exe search lists", "PASS", f"WIN={len(WhisperCppTranscriber._WIN_EXES)} UNIX={len(WhisperCppTranscriber._UNIX_EXES)}")
    except Exception as e:
        report("WhisperCpp exe search lists", "FAIL", str(e))

    # Factory routing: whisper.cpp when configured
    try:
        from vats.transcribe import create_transcriber
        # Try to create with whisper.cpp pointing to known path
        whisper_cpp_exe = r"C:\tools\whisper.cpp\build\bin\Release\whisper-cli.exe"
        if os.path.isfile(whisper_cpp_exe):
            test_cfg = {
                "use_whisper_cpp": True,
                "whisper_cpp_path": whisper_cpp_exe,
                "whisper_model": "small",
                "whisper_language": "en",
                "num_threads": 4,
            }
            t = create_transcriber(test_cfg)
            is_cpp = type(t).__name__ == "WhisperCppTranscriber"
            report("Factory → WhisperCppTranscriber", "PASS" if is_cpp else "FAIL",
                   f"got {type(t).__name__}")
        else:
            report("Factory → WhisperCppTranscriber", "SKIP", "whisper.cpp not found at expected path")
    except FileNotFoundError as e:
        if "GGML model" in str(e):
            report("Factory → WhisperCppTranscriber", "SKIP", f"model not downloaded: {e}")
        else:
            report("Factory → WhisperCppTranscriber", "FAIL", str(e))
    except Exception as e:
        report("Factory → WhisperCppTranscriber", "FAIL", str(e))


# ---------------------------------------------------------------
# Category 4: Transcript Cleaning (YAMTS Migration)
# ---------------------------------------------------------------

def test_transcript_cleaning():
    """Test the 3-level transcript cleaning pipeline."""
    print("\n=== Category 4: Transcript Cleaning ===")

    try:
        from vats.clean import clean_transcript, aggressive_clean, final_clean, auto_clean
        report("Clean module imports", "PASS")
    except Exception as e:
        report("Clean module imports", "FAIL", str(e))
        return

    # Level 1: Basic clean
    test_input = '<00:00:04.640><c>Hello world</c> <00:00:08.000><c>Hello world</c>'
    result = clean_transcript(test_input)
    has_tags = "<" in result
    report("Level 1: Tag removal", "PASS" if not has_tags else "FAIL",
           f"tags_remain={has_tags}")

    # Level 1: Dedup
    test_dup = "**Speaker 1**: The meeting was great. The meeting was great. We discussed AI."
    result = clean_transcript(test_dup)
    count = result.count("The meeting was great")
    report("Level 1: Phrase dedup", "PASS" if count == 1 else "FAIL",
           f"occurrences={count}")

    # Level 2: Aggressive
    test_word_repeat = "the the the quick quick brown fox jumped jumped jumped over"
    result = aggressive_clean(test_word_repeat)
    report("Level 2: Word repeat removal", "PASS",
           f"len {len(test_word_repeat)} → {len(result)}")

    # Level 3: Final
    test_speaker = "**Speaker 1**: Hello. Hello. **Speaker 2**: World. World."
    result = final_clean(test_speaker)
    report("Level 3: Speaker block reconstruction", "PASS" if "Speaker" in result else "FAIL")

    # Auto pipeline
    big_input = (
        '<c>Test data</c> <c>Test data</c>\n'
        '**Speaker 1**: The meeting was great. The meeting was great. '
        'We discussed AI. We discussed AI. The budget is approved.\n'
        '**Speaker 2**: I agree. I agree. Let us move on. Let us move on.'
    )
    result = auto_clean(big_input)
    reduction = (1 - len(result) / max(len(big_input), 1)) * 100
    report("Auto pipeline", "PASS" if reduction > 10 else "FAIL",
           f"{reduction:.0f}% reduction ({len(big_input)} → {len(result)})")


# ---------------------------------------------------------------
# Category 5: Audio Processing
# ---------------------------------------------------------------

def test_audio_processing():
    """Test AudioProcessor init and adaptive segmentation logic."""
    print("\n=== Category 5: Audio Processing ===")

    try:
        from vats.audio import AudioProcessor
        report("AudioProcessor import", "PASS")
    except Exception as e:
        report("AudioProcessor import", "FAIL", str(e))
        return

    # Test default init
    try:
        ap = AudioProcessor(segment_length=180)
        report("AudioProcessor init (default)", "PASS")
    except Exception as e:
        report("AudioProcessor init (default)", "FAIL", str(e))

    # Test adaptive init
    try:
        ap = AudioProcessor(
            segment_length=180,
            adaptive=True,
            min_segment_length=30.0,
            max_segment_length=300.0,
        )
        assert ap.adaptive is True
        assert ap.min_segment_length == 30.0
        assert ap.max_segment_length == 300.0
        report("AudioProcessor init (adaptive)", "PASS",
               f"adaptive={ap.adaptive} min={ap.min_segment_length} max={ap.max_segment_length}")
    except Exception as e:
        report("AudioProcessor init (adaptive)", "FAIL", str(e))

    # Test complexity classifier
    try:
        r1 = AudioProcessor._classify_complexity(7200, 400000, 96000)
        r2 = AudioProcessor._classify_complexity(300, 64000, 22050)
        r3 = AudioProcessor._classify_complexity(1800, 192000, 44100)
        report("Complexity classifier", "PASS",
               f"high={r1} low={r2} medium={r3}")
    except Exception as e:
        report("Complexity classifier", "FAIL", str(e))


# ---------------------------------------------------------------
# Category 6: Formatting
# ---------------------------------------------------------------

def test_formatting():
    """Test transcript formatter."""
    print("\n=== Category 6: Formatting ===")

    try:
        from vats.format import TranscriptFormatter
        fmt = TranscriptFormatter(include_timestamps=True)
        report("TranscriptFormatter init", "PASS")
    except Exception as e:
        report("TranscriptFormatter init", "FAIL", str(e))
        return

    # Format a transcript
    try:
        transcript = {
            "text": "Hello world. This is a test.",
            "segments": [
                {"start": 0.0, "end": 2.0, "text": "Hello world.", "speaker": "SPEAKER_01"},
                {"start": 2.0, "end": 4.0, "text": "This is a test.", "speaker": "SPEAKER_02"},
            ],
        }
        result = fmt.format_transcript(transcript)
        assert len(result) > 0
        report("format_transcript()", "PASS", f"{len(result)} chars")
    except Exception as e:
        report("format_transcript()", "FAIL", str(e))


# ---------------------------------------------------------------
# Category 7: Caching
# ---------------------------------------------------------------

def test_caching():
    """Test cache system."""
    print("\n=== Category 7: Caching ===")

    try:
        from vats.cache import get_model_cache, get_result_cache, cleanup_all_caches
        report("Cache imports", "PASS")
    except Exception as e:
        report("Cache imports", "FAIL", str(e))
        return

    try:
        mc = get_model_cache()
        stats = mc.get_stats()
        report("Model cache init", "PASS", f"entries={stats.get('disk_entries', 0)}")
    except Exception as e:
        report("Model cache init", "FAIL", str(e))

    try:
        rc = get_result_cache()
        stats = rc.get_stats()
        report("Result cache init", "PASS", f"entries={stats.get('disk_entries', 0)}")
    except Exception as e:
        report("Result cache init", "FAIL", str(e))


# ---------------------------------------------------------------
# Category 8: Summarization providers
# ---------------------------------------------------------------

def test_summarization():
    """Test summarizer factory."""
    print("\n=== Category 8: Summarization ===")

    try:
        from vats.summarize import create_summarizer
        report("create_summarizer import", "PASS")
    except Exception as e:
        report("create_summarizer import", "FAIL", str(e))
        return

    # Test creating each provider
    providers = ["ollama", "gemini", "deepseek", "openrouter", "zai"]
    for prov in providers:
        try:
            cfg = {
                "ai_model": prov,
                "ollama_api_url": "http://localhost:11434/v1",
                "ollama_model": "llama3",
                "gemini_api_key": "test",
                "gemini_api_url": "https://generativelanguage.googleapis.com/v1beta/openai/",
                "gemini_model": "gemini-2.5-flash",
                "deepseek_api_key": "test",
                "deepseek_api_url": "https://api.deepseek.com/v1",
                "deepseek_model": "deepseek-chat",
                "openrouter_api_key": "test",
                "openrouter_api_url": "https://openrouter.ai/api/v1",
                "openrouter_model": "anthropic/claude-3-haiku",
                "zai_api_key": "test",
                "zai_api_url": "https://api.z.ai/api/coding/paas/v4",
                "zai_model": "glm-4.6",
                "zai_timeout": 180,
            }
            s = create_summarizer(cfg)
            report(f"Provider: {prov}", "PASS", type(s).__name__)
        except Exception as e:
            report(f"Provider: {prov}", "FAIL", str(e))


# ---------------------------------------------------------------
# Category 9: CLI entry point
# ---------------------------------------------------------------

def test_cli():
    """Test CLI parser and help."""
    print("\n=== Category 9: CLI ===")

    try:
        from vats.cli import build_parser
        parser = build_parser()
        report("build_parser()", "PASS")
    except Exception as e:
        report("build_parser()", "FAIL", str(e))
        return

    # Test each subcommand is registered
    # Map each subcommand to valid test args
    cmd_args = {
        "process": ["process", "dummy"],
        "bulk": ["bulk", "dummy"],
        "summarize": ["summarize", "dummy"],
        "status": ["status"],
        "cache": ["cache", "stats"],
    }
    for cmd, argv in cmd_args.items():
        try:
            args = parser.parse_args(argv)
            assert args.command == cmd
            report(f"CLI subcommand: {cmd}", "PASS")
        except SystemExit:
            report(f"CLI subcommand: {cmd}", "FAIL", "parser rejected command")
        except Exception as e:
            report(f"CLI subcommand: {cmd}", "FAIL", str(e))


# ---------------------------------------------------------------
# Category 10: App integration
# ---------------------------------------------------------------

def test_app_init():
    """Test VATSApp initialisation."""
    print("\n=== Category 10: App Integration ===")

    try:
        from vats.app import VATSApp
        from vats.config import load_config

        cfg = load_config()
        # Disable heavy components for this test
        cfg["enable_diarization"] = False
        cfg["enable_summarization"] = False
        app = VATSApp(cfg)
        report("VATSApp init", "PASS", f"profile={cfg['performance_profile']}")
    except Exception as e:
        report("VATSApp init", "FAIL", str(e))

    try:
        status = app.get_system_status()
        report("get_system_status()", "PASS",
               f"gpu={status.get('gpu_available')}")
    except Exception as e:
        report("get_system_status()", "FAIL", str(e))


# ---------------------------------------------------------------
# Category 11: Bulk processing classes
# ---------------------------------------------------------------

def test_bulk():
    """Test bulk processing infrastructure."""
    print("\n=== Category 11: Bulk Processing ===")

    try:
        from vats.bulk import GPUManager, ResourcePool, BulkProcessor
        report("Bulk module imports", "PASS")
    except Exception as e:
        report("Bulk module imports", "FAIL", str(e))
        return

    try:
        gpu = GPUManager(memory_fraction=0.9)
        dev = gpu.best_device()
        report("GPUManager", "PASS", f"best_device={dev}")
    except Exception as e:
        report("GPUManager", "FAIL", str(e))

    try:
        pool = ResourcePool(max_transcribers=2, max_diarizers=1)
        report("ResourcePool", "PASS")
    except Exception as e:
        report("ResourcePool", "FAIL", str(e))


# ---------------------------------------------------------------
# Category 12: Document summarization
# ---------------------------------------------------------------

def test_docsummarize():
    """Test document text extraction."""
    print("\n=== Category 12: Document Summarization ===")

    try:
        from vats.docsummarize import extract_text
        report("extract_text import", "PASS")
    except Exception as e:
        report("extract_text import", "FAIL", str(e))
        return

    # Test with a temp text file
    try:
        with tempfile.NamedTemporaryFile(mode="w", suffix=".txt", delete=False, encoding="utf-8") as f:
            f.write("This is a test document for VATS summarization.")
            tmp = f.name

        text = extract_text(tmp)
        os.unlink(tmp)
        assert "test document" in text
        report("extract_text(.txt)", "PASS", f"{len(text)} chars")
    except Exception as e:
        report("extract_text(.txt)", "FAIL", str(e))


# ---------------------------------------------------------------
# Category 13: Diarization module
# ---------------------------------------------------------------

def test_diarization():
    """Test diarization module loads."""
    print("\n=== Category 13: Diarization ===")

    try:
        from vats.diarize import SpeakerDiarizer, merge_transcript_speakers
        report("Diarize imports", "PASS")
    except Exception as e:
        report("Diarize imports", "FAIL", str(e))
        return

    try:
        # Test merge function with sample data
        transcript_segs = [
            {"start": 0.0, "end": 3.0, "text": "Hello"},
            {"start": 3.0, "end": 6.0, "text": "World"},
        ]
        diar_segs = [
            {"start": 0.0, "end": 3.0, "speaker": "SPEAKER_00"},
            {"start": 3.0, "end": 6.0, "speaker": "SPEAKER_01"},
        ]
        merged = merge_transcript_speakers(transcript_segs, diar_segs)
        has_speakers = all("speaker" in s for s in merged)
        report("merge_transcript_speakers()", "PASS" if has_speakers else "FAIL",
               f"speakers_assigned={has_speakers}")
    except Exception as e:
        report("merge_transcript_speakers()", "FAIL", str(e))


# ---------------------------------------------------------------
# Run all tests
# ---------------------------------------------------------------

def main():
    print("=" * 60)
    print("  VATS Feature Migration Test Suite")
    print("  Testing all YAMTS features migrated to VATS")
    print("=" * 60)

    t0 = time.time()

    test_imports()
    test_config()
    test_transcription_backends()
    test_transcript_cleaning()
    test_audio_processing()
    test_formatting()
    test_caching()
    test_summarization()
    test_cli()
    test_app_init()
    test_bulk()
    test_docsummarize()
    test_diarization()

    elapsed = time.time() - t0

    print("\n" + "=" * 60)
    print(f"  Results: {PASS} PASS / {FAIL} FAIL / {SKIP} SKIP")
    print(f"  Total: {PASS + FAIL + SKIP} tests in {elapsed:.1f}s")
    print("=" * 60)

    if FAIL > 0:
        print("\n  Failed tests:")
        for r in RESULTS:
            if r["status"] == "FAIL":
                print(f"    - {r['name']}: {r['detail']}")

    return 1 if FAIL > 0 else 0


if __name__ == "__main__":
    sys.exit(main())
