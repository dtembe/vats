#!/usr/bin/env python3
"""
VATS CLI — Versatile Audio Transcription & Summarization.

Commands:
    process   — Process a single audio/video file
    bulk      — Process multiple files concurrently
    summarize — Summarize a TXT/MD/PDF/DOCX document
    status    — Show system status & GPU info
    cache     — Cache management (stats / cleanup)
"""

import argparse
import json
import logging
import sys
import time
from pathlib import Path
from typing import List

from vats.app import VATSApp
from vats.cache import cleanup_all_caches, get_model_cache, get_result_cache
from vats.config import load_config, setup_logging

logger = logging.getLogger("vats.cli")


def _strip_quotes(p: str) -> str:
    return p.strip().strip('"').strip("'")


# -----------------------------------------------------------------------
# CLI class
# -----------------------------------------------------------------------

class CLI:
    def __init__(self):
        self.app: VATSApp | None = None
        self.config = None

    def setup(self, verbose: bool = False):
        setup_logging(verbose)
        self.config = load_config()
        self.app = VATSApp(self.config)
        if self.config.get("use_model_caching"):
            get_model_cache()
            get_result_cache()

    # -- commands --

    def cmd_process(self, file: str, no_summary: bool = False):
        path = Path(_strip_quotes(file))
        if not path.exists():
            print(f"[ERROR] File not found: {path}")
            return 1
        if no_summary:
            self.app.config["enable_summarization"] = False
        result = self.app.process_recording(str(path))
        if result.get("success"):
            print(f"[OK] Processed: {path}")
            perf = result.get("performance", {})
            total = perf.get("timers", {}).get("total", {}).get("elapsed", 0)
            print(f"[TIME] {total:.1f}s")
            print(f"[TRANSCRIPT] {result.get('transcript_file')}")
            if result.get("summary_file"):
                print(f"[SUMMARY] {result.get('summary_file')}")
        else:
            print(f"[ERROR] {result.get('error')}")
            return 1
        return 0

    def cmd_bulk(self, files: List[str]):
        paths = [_strip_quotes(f) for f in files]
        t0 = time.time()
        result = self.app.process_files_bulk(paths)
        elapsed = time.time() - t0
        if result.get("success"):
            summary = result.get("processing_summary", {})
            print(f"[OK] Bulk done — {summary.get('completed', 0)}/{summary.get('total_files', 0)} files")
            print(f"[TIME] {elapsed:.1f}s total")
            for f in result.get("failed_files", []):
                print(f"  [FAIL] {f['file']}: {f.get('error')}")
        else:
            print(f"[ERROR] {result.get('error')}")
            return 1
        return 0

    def cmd_summarize(self, file: str):
        from vats.docsummarize import main as doc_main
        sys.argv = ["vats-docsummarize", _strip_quotes(file)]
        doc_main()
        return 0

    def cmd_status(self, as_json: bool = False):
        status = self.app.get_system_status()
        mc = get_model_cache().get_stats()
        rc = get_result_cache().get_stats()
        status["cache"] = {"model": mc, "result": rc}
        if as_json:
            print(json.dumps(status, indent=2, default=str))
        else:
            print("[SYSTEM] VATS System Status")
            print("=" * 40)
            gpu = status.get("gpu_available", False)
            print(f"  GPU: {'Yes' if gpu else 'No'}")
            for d in status.get("gpu_devices", []):
                mem = status.get("gpu_memory", {}).get(d, {})
                print(f"    {d}: {mem.get('total_gb', '?')}GB, {mem.get('utilization_percent', 0):.0f}% used")
            cfg = status.get("configuration", {})
            print(f"  Profile: {cfg.get('performance_profile')}")
            print(f"  Whisper: {cfg.get('whisper_model')}")
            print(f"  AI: {cfg.get('ai_model')}")
            print(f"  Max concurrent: {cfg.get('max_concurrent_files')}")
            print(f"  Model cache: {mc.get('disk_entries', 0)} entries, {mc.get('size_mb', 0)}MB")
            print(f"  Result cache: {rc.get('disk_entries', 0)} entries, {rc.get('size_mb', 0)}MB")
        return 0

    def cmd_cache(self, sub: str, force: bool = False):
        if sub == "stats":
            mc = get_model_cache().get_stats()
            rc = get_result_cache().get_stats()
            print(f"Model cache:  {json.dumps(mc)}")
            print(f"Result cache: {json.dumps(rc)}")
        elif sub == "cleanup":
            if force:
                cleanup_all_caches()
                print("[OK] All caches cleared")
            else:
                get_model_cache().cleanup()
                get_result_cache().cleanup()
                print("[OK] Expired entries cleaned")
        return 0


# -----------------------------------------------------------------------
# Argument parser
# -----------------------------------------------------------------------

def build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(
        prog="vats",
        description="VATS — Versatile Audio Transcription & Summarization",
    )
    p.add_argument("-v", "--verbose", action="store_true", help="Verbose logging")

    sp = p.add_subparsers(dest="command")

    # process
    proc = sp.add_parser("process", help="Process a single audio/video file")
    proc.add_argument("file", help="Path to media file")
    proc.add_argument("--no-summary", action="store_true", help="Skip AI summarization")
    proc.add_argument("--profile", choices=["speed", "balanced", "quality"], default=None)

    # bulk
    blk = sp.add_parser("bulk", help="Process multiple files concurrently")
    blk.add_argument("files", nargs="+", help="Media files to process")
    blk.add_argument("--max-concurrent", type=int)

    # summarize
    summ = sp.add_parser("summarize", help="Summarize a TXT/MD/PDF/DOCX file")
    summ.add_argument("file", help="Document to summarize")

    # status
    st = sp.add_parser("status", help="System status & GPU info")
    st.add_argument("--json", action="store_true")

    # cache
    ca = sp.add_parser("cache", help="Cache management")
    ca_sp = ca.add_subparsers(dest="cache_command")
    ca_sp.add_parser("stats", help="Show statistics")
    cu = ca_sp.add_parser("cleanup", help="Cleanup caches")
    cu.add_argument("--force", action="store_true", help="Remove all cached data")

    return p


# -----------------------------------------------------------------------
# Entry point
# -----------------------------------------------------------------------

def main():
    parser = build_parser()
    args = parser.parse_args()

    if not args.command:
        parser.print_help()
        return 0

    cli = CLI()
    cli.setup(verbose=args.verbose)

    try:
        if args.command == "process":
            if args.profile:
                cli.config["performance_profile"] = args.profile
            return cli.cmd_process(args.file, no_summary=getattr(args, "no_summary", False))

        if args.command == "bulk":
            if getattr(args, "max_concurrent", None):
                cli.config["max_concurrent_files"] = args.max_concurrent
            return cli.cmd_bulk(args.files)

        if args.command == "summarize":
            return cli.cmd_summarize(args.file)

        if args.command == "status":
            return cli.cmd_status(as_json=getattr(args, "json", False))

        if args.command == "cache":
            return cli.cmd_cache(getattr(args, "cache_command", "stats"), force=getattr(args, "force", False))

    except KeyboardInterrupt:
        print("\n[CANCELLED]")
        return 1
    except Exception as exc:
        logger.error("Fatal: %s", exc, exc_info=args.verbose)
        print(f"[ERROR] {exc}")
        return 1
    finally:
        if cli.app:
            cli.app.cleanup()

    return 0


if __name__ == "__main__":
    sys.exit(main())
