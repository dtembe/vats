"""
Transcript cleaning — multi-level recovery for corrupted or noisy transcripts.

Three escalating levels:
  1. clean_transcript()   — tag removal, consecutive-line dedup, phrase dedup
  2. aggressive_clean()   — sentence-level dedup, word-pattern repeat removal
  3. final_clean()        — full speaker-block reconstruction with dedup

The pipeline helper `auto_clean()` runs all three in sequence and returns
the cleaned text directly (no file I/O required).
"""

import re
import logging
from typing import Optional

logger = logging.getLogger("vats.clean")


# ---------------------------------------------------------------------------
# Level 1 — basic clean
# ---------------------------------------------------------------------------

def clean_transcript(text: str) -> str:
    """Remove HTML/XML tags, deduplicate consecutive lines, and deduplicate phrases."""
    # Strip markup tags  (<00:01:23.456>, <c>, </c>, etc.)
    text = re.sub(r"<[^>]+>", "", text)

    # Deduplicate consecutive identical lines
    lines = text.split("\n")
    deduped: list[str] = []
    prev = ""
    for line in lines:
        stripped = line.strip()
        if stripped and stripped != prev:
            deduped.append(stripped)
        elif not stripped:
            deduped.append("")
        prev = stripped if stripped else prev

    # Group by speaker blocks and deduplicate phrases within each
    result_lines: list[str] = []
    current_speaker = ""
    current_content = ""

    for line in deduped:
        if line.startswith("**Speaker") and ":" in line:
            if current_speaker and current_content.strip():
                cleaned = _dedup_phrases(current_content.strip())
                result_lines.append(f"**{current_speaker}**: {cleaned}")
            parts = line.split(":", 1)
            current_speaker = parts[0].replace("**", "").strip()
            current_content = parts[1].strip() if len(parts) > 1 else ""
        elif line and not line.startswith("#") and not line.startswith("-"):
            current_content += " " + line.strip()
        else:
            if current_speaker and current_content.strip():
                cleaned = _dedup_phrases(current_content.strip())
                result_lines.append(f"**{current_speaker}**: {cleaned}")
                current_speaker = ""
                current_content = ""
            result_lines.append(line)

    if current_speaker and current_content.strip():
        result_lines.append(f"**{current_speaker}**: {_dedup_phrases(current_content.strip())}")

    return "\n".join(result_lines)


def _dedup_phrases(text: str) -> str:
    """Remove duplicate sentences in text."""
    sentences = re.split(r"[.!?]+", text)
    seen: list[str] = []
    for s in sentences:
        s = s.strip()
        if s and s not in seen:
            seen.append(s)
    result = ". ".join(seen)
    if result and not result.endswith((".", "!", "?")):
        result += "."
    return result


# ---------------------------------------------------------------------------
# Level 2 — aggressive sentence + word-pattern clean
# ---------------------------------------------------------------------------

def aggressive_clean(text: str) -> str:
    """Sentence-level dedup and repeated word-pattern removal."""
    # Strip any remaining tags
    text = re.sub(r"<[^>]*>", "", text)

    # Split around speaker labels
    speaker_pat = r"(\*\*Speaker \d+\*\*: )"
    parts = re.split(speaker_pat, text)

    cleaned_parts = [parts[0]]
    for i in range(1, len(parts), 2):
        if i + 1 < len(parts):
            label = parts[i]
            body = _clean_speaker_block(parts[i + 1])
            cleaned_parts.append(label + body)

    result = "\n".join(cleaned_parts)
    result = re.sub(r"\n\s*\n\s*\n", "\n\n", result)
    result = re.sub(r" +", " ", result)
    return result


def _clean_speaker_block(text: str) -> str:
    sentences = re.split(r"(?<=[.!?])\s+", text.strip())
    unique: list[str] = []
    for s in sentences:
        s = s.strip()
        if s and s not in unique:
            unique.append(_remove_word_repeats(s))
    return " ".join(unique)


def _remove_word_repeats(sentence: str) -> str:
    """Remove repeated N-gram patterns (3-8 words) inside a single sentence."""
    words = sentence.split()
    if len(words) <= 5:
        return sentence

    cleaned: list[str] = []
    i = 0
    while i < len(words):
        found = False
        max_pat = min(8, len(words) - i)
        for pat_len in range(3, max_pat + 1):
            if i + pat_len * 2 <= len(words):
                a = words[i : i + pat_len]
                b = words[i + pat_len : i + pat_len * 2]
                if a == b:
                    cleaned.extend(a)
                    i += pat_len * 2
                    found = True
                    break
        if not found:
            cleaned.append(words[i])
            i += 1
    return " ".join(cleaned)


# ---------------------------------------------------------------------------
# Level 3 — full reconstruction
# ---------------------------------------------------------------------------

def final_clean(text: str) -> str:
    """Reconstruct transcript from speaker blocks with full dedup."""
    text = re.sub(r"<[^>]*>", "", text)

    blocks = _extract_speaker_blocks(text)
    cleaned_blocks: list[str] = []
    for speaker, body in blocks:
        clean_body = _clean_text_block(body)
        if clean_body:
            cleaned_blocks.append(f"**Speaker {speaker}**: {clean_body}")

    return "\n\n".join(cleaned_blocks)


def _extract_speaker_blocks(text: str) -> list[tuple[str, str]]:
    """Extract (speaker_id, text) pairs from a transcript."""
    matches = re.findall(
        r"\*\*Speaker (\d+)\*\*:([^*]*(?=\*\*Speaker|\Z))", text, re.DOTALL
    )
    if matches:
        return matches

    # Fallback: line-by-line parse
    blocks: dict[str, str] = {}
    current_speaker: Optional[str] = None
    current_parts: list[str] = []

    for line in text.split("\n"):
        m = re.match(r"\*\*Speaker (\d+)\*\*:\s*(.*)", line)
        if m:
            if current_speaker is not None:
                blocks[current_speaker] = " ".join(current_parts)
            current_speaker = m.group(1)
            current_parts = [m.group(2)] if m.group(2) else []
        elif current_speaker and line.strip():
            current_parts.append(line.strip())

    if current_speaker is not None:
        blocks[current_speaker] = " ".join(current_parts)

    return list(blocks.items())


def _clean_text_block(text: str) -> str:
    text = text.strip()
    if not text:
        return ""

    sentences = re.split(r"(?<=[.!?])\s+", text)
    seen: set[str] = set()
    clean: list[str] = []
    for s in sentences:
        s = s.strip()
        if s and s not in seen:
            seen.add(s)
            clean.append(_remove_internal_dups(s))
    return " ".join(clean)


def _remove_internal_dups(sentence: str) -> str:
    words = sentence.split()
    if len(words) <= 3:
        return sentence

    cleaned: list[str] = []
    i = 0
    while i < len(words):
        found = False
        for pat_len in range(3, min(7, len(words) - i + 1)):
            if i + pat_len * 2 <= len(words):
                a = words[i : i + pat_len]
                b = words[i + pat_len : i + pat_len * 2]
                if a == b:
                    cleaned.extend(a)
                    i += pat_len * 2
                    found = True
                    break
        if not found:
            cleaned.append(words[i])
            i += 1

    result = " ".join(cleaned)
    # Remove simple consecutive duplicate words
    result = re.sub(r"\b(\w+)\s+\1\b", r"\1", result, flags=re.IGNORECASE)
    return result


# ---------------------------------------------------------------------------
# Auto pipeline
# ---------------------------------------------------------------------------

def auto_clean(text: str) -> str:
    """Run all three cleaning levels in sequence.

    Returns the cleaned text. Useful as a post-processing step after
    transcription and before summarization.
    """
    result = clean_transcript(text)
    result = aggressive_clean(result)
    result = final_clean(result)
    logger.debug(
        "auto_clean: %d chars → %d chars (%.0f%% reduction)",
        len(text), len(result),
        (1 - len(result) / max(len(text), 1)) * 100,
    )
    return result
