"""
Standalone document summarizer (TXT, MD, PDF, DOCX).

Usage:
    python -m vats.docsummarize <file>
"""

import logging
import os
import sys
import time
from pathlib import Path

from dotenv import load_dotenv

from vats.summarize import create_summarizer

logger = logging.getLogger("vats.docsummarize")

# Suppress noisy libs
logging.getLogger("pdfminer").setLevel(logging.ERROR)
logging.getLogger("pdfplumber").setLevel(logging.ERROR)

# Optional doc parsers
try:
    import pdfplumber
except ImportError:
    pdfplumber = None

try:
    from docx import Document
except ImportError:
    Document = None


def extract_text(filepath: str) -> str:
    ext = os.path.splitext(filepath)[1].lower()
    if ext in (".txt", ".md"):
        return Path(filepath).read_text(encoding="utf-8")
    if ext == ".pdf":
        if pdfplumber is None:
            raise ImportError("pdfplumber required for PDF support: pip install pdfplumber")
        with pdfplumber.open(filepath) as pdf:
            return "\n".join(page.extract_text() or "" for page in pdf.pages)
    if ext == ".docx":
        if Document is None:
            raise ImportError("python-docx required for DOCX support: pip install python-docx")
        doc = Document(filepath)
        return "\n".join(p.text for p in doc.paragraphs)
    raise ValueError(f"Unsupported file type: {ext}")


def _model_label(provider: str) -> str:
    mapping = {
        "ollama": "OLLAMA_MODEL",
        "gemini": "GEMINI_MODEL",
        "deepseek": "DEEPSEEK_MODEL",
        "openrouter": "OPENROUTER_MODEL",
        "zai": "ZAI_MODEL",
    }
    return os.getenv(mapping.get(provider, ""), provider)


def main():
    load_dotenv()
    if len(sys.argv) < 2:
        print("Usage: python -m vats.docsummarize <file-to-summarise>")
        sys.exit(1)

    filepath = sys.argv[1].strip().strip('"').strip("'")
    if not os.path.isfile(filepath):
        print(f"File not found: {filepath}")
        sys.exit(1)

    print(f"[1/4] Extracting text from: {Path(filepath).name}")
    text = extract_text(filepath)
    transcript = {"text": text}
    print(f"       {len(text):,} characters extracted")

    from vats.config import load_config
    cfg = load_config()
    provider = cfg["ai_model"]

    prompt_file = cfg.get("text_summary_prompt_file") or cfg.get("summary_prompt_file")
    prompt = None
    if prompt_file and os.path.isfile(prompt_file):
        prompt = Path(prompt_file).read_text(encoding="utf-8").strip()

    print(f"[2/4] Connecting to {provider} ({_model_label(provider)})")
    summarizer = create_summarizer(cfg)

    print(f"[3/4] Generating summary... (this may take a minute)")
    t0 = time.time()
    summary = summarizer.generate_summary(transcript, prompt=prompt)
    elapsed = time.time() - t0
    print(f"       Done in {elapsed:.1f}s")

    base = Path(filepath).stem
    ts = int(time.time())
    out_path = Path(filepath).parent / f"{base}_summary_{ts}.md"

    header = (
        f"PROMPT_FILE: {prompt_file}\n"
        f"AI_MODEL: {provider}\n"
        f"LLM_MODEL: {_model_label(provider)}\n\n"
    )
    out_path.write_text(header + summary, encoding="utf-8")
    print(f"[4/4] Summary saved to: {out_path}\n")
    print("===== PREVIEW =====\n")
    print((header + summary)[:1000])


if __name__ == "__main__":
    main()
