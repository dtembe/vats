"""
Transcript and summary formatting for VATS.

Produces clean Markdown output with timestamps and speaker labels.
"""

import logging
from datetime import datetime
from typing import Any, Dict, List, Union

logger = logging.getLogger("vats.format")


def _mm_ss(seconds: float) -> str:
    m, s = divmod(int(seconds), 60)
    return f"{m:02d}:{s:02d}"


class TranscriptFormatter:
    """Format transcript segments into readable Markdown."""

    def __init__(self, include_timestamps: bool = True):
        self.include_timestamps = include_timestamps

    def format_transcript(self, data: Union[Dict[str, Any], List[Dict[str, Any]]]) -> str:
        """Return a plain-text transcript with optional timestamps and speakers."""
        segments: List[Dict[str, Any]] = []
        full_text = ""

        if isinstance(data, dict):
            full_text = data.get("text", "")
            segments = data.get("segments", [])
        elif isinstance(data, list):
            segments = data
            full_text = " ".join(s.get("text", "") for s in segments)

        lines: List[str] = []
        for seg in segments:
            if not isinstance(seg, dict):
                continue
            text = seg.get("text", "").strip()
            if not text:
                continue
            speaker = seg.get("speaker", "SPEAKER")
            ts = _mm_ss(seg.get("start", 0)) if self.include_timestamps else ""
            lines.append(f"[{ts}] {speaker}: {text}")

        if not lines and full_text:
            lines.append(f"SPEAKER: {full_text}")

        if not lines:
            return "No transcript content"

        last_end = segments[-1].get("end", 0) if segments else 0
        header = [
            "Meeting Transcript",
            f"Date: {datetime.now().strftime('%Y-%m-%d')}",
            f"Duration: {_mm_ss(last_end)}",
            f"Characters: {len(full_text)}",
            "-" * 50,
            "",
        ]
        return "\n".join(header + lines)

    def format_summary(self, summary: str, info: Dict[str, Any]) -> str:
        """Wrap an AI summary in a Markdown document with metadata."""
        parts = [
            "# Meeting Summary\n",
            "## Meeting Information",
            f"- **Source:** {info.get('file_name', 'Unknown')}",
            f"- **Duration:** {_mm_ss(info.get('duration', 0))}",
            f"- **Date:** {info.get('date', datetime.now().strftime('%Y-%m-%d'))}",
            f"- **Participants:** {', '.join(info.get('speakers', ['Unknown']))}\n",
        ]
        if not summary:
            parts.append("*No summary available.*")
        elif summary.startswith("Error:"):
            parts.append("## Summarization Failed\n")
            parts.append(f"> {summary}\n")
            parts.append("**Troubleshooting:**")
            parts.append("- If using Ollama: ensure `ollama serve` is running")
            parts.append("- If using a cloud provider: check API key in `.env`")
            parts.append("- Run `vats --verbose status` for diagnostics")
        else:
            parts.append(summary)
        return "\n".join(parts)
