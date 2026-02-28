"""
Multi-provider LLM summarization for VATS.

Supports:
  - Ollama   (local, no API key)
  - Gemini   (Google)
  - DeepSeek
  - OpenRouter (access to Claude, GPT-4, Mixtral, …)
  - Z.ai     (GLM-4)

All cloud providers use an OpenAI-compatible chat/completions endpoint
wherever possible. A factory function `create_summarizer()` instantiates
the correct backend from the config dict.
"""

import json
import logging
import os
from abc import ABC, abstractmethod
from pathlib import Path
from typing import Any, Dict, List, Optional, Union

import requests

logger = logging.getLogger("vats.summarize")

try:
    from openai import OpenAI
    _OPENAI_SDK = True
except ImportError:
    _OPENAI_SDK = False


# ---------------------------------------------------------------------------
# Prompt loading
# ---------------------------------------------------------------------------

def load_prompt(prompt: Optional[str] = None, prompt_file: Optional[str] = None) -> str:
    """Return an explicit prompt string, or load from file / env var."""
    if prompt:
        return prompt
    pf = prompt_file or os.getenv("AV_SUMMARY_PROMPT_FILE") or os.getenv("TEXT_SUMMARY_PROMPT_FILE") or os.getenv("SUMMARY_PROMPT_FILE")
    if pf and os.path.isfile(pf):
        return Path(pf).read_text(encoding="utf-8").strip()
    raise RuntimeError(
        "No summarization prompt provided. Set SUMMARY_PROMPT_FILE in .env "
        "or pass --prompt-file on the CLI."
    )


def _extract_text(transcript: Any) -> str:
    """Normalise various transcript shapes into a plain string."""
    if isinstance(transcript, str):
        return transcript
    if isinstance(transcript, dict):
        if "text" in transcript:
            return transcript["text"]
        if "segments" in transcript:
            return " ".join(s.get("text", "") for s in transcript["segments"])
    return str(transcript)


def _extract_speakers(transcript: Any) -> str:
    segs = []
    if isinstance(transcript, list):
        segs = transcript
    elif isinstance(transcript, dict):
        segs = transcript.get("segments", [])
    speakers = {s["speaker"] for s in segs if isinstance(s, dict) and "speaker" in s}
    if speakers:
        return f"Speakers identified: {', '.join(sorted(speakers))}.\n\n"
    return ""


# ---------------------------------------------------------------------------
# Base class
# ---------------------------------------------------------------------------

class SummarizerBase(ABC):
    @abstractmethod
    def generate_summary(self, transcript: Any, prompt: Optional[str] = None, prompt_file: Optional[str] = None) -> str:
        ...


# ---------------------------------------------------------------------------
# Ollama  (local)
# ---------------------------------------------------------------------------

class OllamaSummarizer(SummarizerBase):
    def __init__(self, api_url: str = "http://localhost:11434/v1", model: str = "llama3", max_tokens: int = 32768):
        self.api_url = (api_url or "http://localhost:11434/v1").rstrip("/")
        self.model = model or "llama3"
        self.max_tokens = max_tokens
        logger.info("OllamaSummarizer  model=%s  url=%s", self.model, self.api_url)

    def _check_reachable(self) -> bool:
        """Quick connectivity check before sending the full transcript."""
        base_url = self.api_url.replace("/v1", "")
        try:
            resp = requests.get(f"{base_url}/api/tags", timeout=5)
            return resp.status_code == 200
        except Exception:
            return False

    def generate_summary(self, transcript, prompt=None, prompt_file=None) -> str:
        # Fail fast if Ollama isn't running
        if not self._check_reachable():
            msg = (f"Ollama is not reachable at {self.api_url}. "
                   f"Start it with: ollama serve")
            logger.error(msg)
            return f"Error: {msg}"

        system_prompt = load_prompt(prompt, prompt_file)
        text = _extract_text(transcript)
        speakers = _extract_speakers(transcript)
        user_msg = f"{system_prompt}\n\n{speakers}TRANSCRIPT:\n{text}"

        try:
            resp = requests.post(
                f"{self.api_url}/chat/completions",
                json={
                    "model": self.model,
                    "messages": [
                        {"role": "system", "content": "You are a professional meeting summarizer."},
                        {"role": "user", "content": user_msg},
                    ],
                    "temperature": 0.7,
                    "max_tokens": self.max_tokens,
                },
                timeout=600,
            )
            resp.raise_for_status()
            return resp.json()["choices"][0]["message"]["content"]
        except Exception as exc:
            logger.error("Ollama summarization failed: %s", exc)
            return f"Error: {exc}"


# ---------------------------------------------------------------------------
# Gemini  (via OpenAI SDK pointed at Google endpoint)
# ---------------------------------------------------------------------------

class GeminiSummarizer(SummarizerBase):
    def __init__(self, api_url: str, api_key: str, model: str):
        if not _OPENAI_SDK:
            raise ImportError("openai package required for Gemini. pip install openai")
        if not api_key:
            raise ValueError("GEMINI_API_KEY is required.")
        self.client = OpenAI(api_key=api_key, base_url=api_url)
        self.model = model or "gemini-2.5-flash"
        logger.info("GeminiSummarizer  model=%s", self.model)

    def generate_summary(self, transcript, prompt=None, prompt_file=None) -> str:
        system_prompt = load_prompt(prompt, prompt_file)
        text = _extract_text(transcript)
        resp = self.client.chat.completions.create(
            model=self.model,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": text},
            ],
        )
        return resp.choices[0].message.content


# ---------------------------------------------------------------------------
# OpenAI-compatible  (DeepSeek, OpenRouter, and generic endpoints)
# ---------------------------------------------------------------------------

class OpenAICompatSummarizer(SummarizerBase):
    """Works with any OpenAI-compatible chat/completions API."""

    def __init__(self, api_url: str, api_key: str, model: str, max_tokens: int = 32768):
        if not api_url or not api_key:
            raise ValueError("api_url and api_key are required for OpenAI-compatible provider.")
        self.api_url = api_url.rstrip("/")
        self.api_key = api_key
        self.model = model
        self.max_tokens = max_tokens
        logger.info("OpenAICompatSummarizer  model=%s  url=%s", self.model, self.api_url)

    def _completions_url(self) -> str:
        base = self.api_url.rstrip("/")
        if base.endswith("/v1"):
            base = base[:-3]
        return f"{base}/v1/chat/completions"

    def generate_summary(self, transcript, prompt=None, prompt_file=None) -> str:
        system_prompt = load_prompt(prompt, prompt_file)
        text = _extract_text(transcript)
        speakers = _extract_speakers(transcript)
        user_msg = f"{system_prompt}\n\n{speakers}TRANSCRIPT:\n{text}"

        headers = {"Authorization": f"Bearer {self.api_key}", "Content-Type": "application/json"}
        payload = {
            "model": self.model,
            "messages": [
                {"role": "system", "content": "You are a professional meeting summarizer."},
                {"role": "user", "content": user_msg},
            ],
            "temperature": 0.7,
            "max_tokens": self.max_tokens,
        }
        try:
            resp = requests.post(self._completions_url(), headers=headers, json=payload, timeout=300)
            resp.raise_for_status()
            return resp.json()["choices"][0]["message"]["content"]
        except Exception as exc:
            logger.error("OpenAI-compat summarization failed: %s", exc)
            return f"Error: {exc}"


# ---------------------------------------------------------------------------
# Z.ai
# ---------------------------------------------------------------------------

class ZAISummarizer(SummarizerBase):
    def __init__(self, api_url: str, api_key: str, model: str, timeout: int = 180, max_tokens: int = 32768):
        if not api_url or not api_key:
            raise ValueError("ZAI_API_URL and ZAI_API_KEY are required.")
        self.api_url = api_url.rstrip("/")
        self.api_key = api_key
        self.model = model or "glm-4.6"
        self.timeout = timeout
        self.max_tokens = max_tokens
        logger.info("ZAISummarizer  model=%s  timeout=%ds", self.model, self.timeout)

    def _completions_url(self) -> str:
        if "/coding/" in self.api_url:
            return f"{self.api_url}/chat/completions"
        return self.api_url

    def generate_summary(self, transcript, prompt=None, prompt_file=None) -> str:
        system_prompt = load_prompt(prompt, prompt_file)
        text = _extract_text(transcript)
        speakers = _extract_speakers(transcript)
        user_msg = f"{system_prompt}\n\n{speakers}TRANSCRIPT:\n{text}"

        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
            "Accept-Language": "en-US,en",
        }
        payload = {
            "model": self.model,
            "messages": [
                {"role": "system", "content": "You are a professional meeting summarizer. Respond directly with the summary — do not include thinking, planning, or reasoning steps."},
                {"role": "user", "content": user_msg},
            ],
            "temperature": 0.6,
            "max_tokens": self.max_tokens,
            "stream": False,
        }
        try:
            resp = requests.post(self._completions_url(), headers=headers, json=payload, timeout=self.timeout)
            resp.raise_for_status()
            msg = resp.json()["choices"][0]["message"]
            # ZAI reasoning models (glm-5) may put the response in content,
            # reasoning_content, or both.  Prefer content; fall back to
            # reasoning_content stripped of planning preamble.
            content = (msg.get("content") or "").strip()
            if not content:
                rc = (msg.get("reasoning_content") or "").strip()
                if rc:
                    # Try to find the actual summary after any thinking preamble
                    for marker in ("# SUMMARY", "# Summary", "## Summary", "**SUMMARY"):
                        idx = rc.find(marker)
                        if idx >= 0:
                            content = rc[idx:]
                            break
                    if not content:
                        content = rc
            if not content:
                logger.warning("ZAI returned empty content and reasoning_content")
            return content
        except Exception as exc:
            logger.error("Z.ai summarization failed: %s", exc)
            return f"Error: {exc}"


# ---------------------------------------------------------------------------
# Factory
# ---------------------------------------------------------------------------

def create_summarizer(config: Dict[str, Any]) -> SummarizerBase:
    """Instantiate the right summarizer from a VATS config dict."""
    provider = config.get("ai_model", "ollama").lower()

    if provider == "ollama":
        return OllamaSummarizer(
            api_url=config.get("ollama_api_url"),
            model=config.get("ollama_model"),
            max_tokens=config.get("summary_max_tokens", 32768),
        )

    if provider == "gemini":
        return GeminiSummarizer(
            api_url=config.get("gemini_api_url", "https://generativelanguage.googleapis.com/v1beta/openai/"),
            api_key=config.get("gemini_api_key"),
            model=config.get("gemini_model"),
        )

    if provider == "deepseek":
        return OpenAICompatSummarizer(
            api_url=config.get("deepseek_api_url", "https://api.deepseek.com/v1"),
            api_key=config.get("deepseek_api_key"),
            model=config.get("deepseek_model"),
            max_tokens=config.get("summary_max_tokens", 32768),
        )

    if provider == "openrouter":
        return OpenAICompatSummarizer(
            api_url=config.get("openrouter_api_url", "https://openrouter.ai/api/v1"),
            api_key=config.get("openrouter_api_key"),
            model=config.get("openrouter_model"),
            max_tokens=config.get("summary_max_tokens", 32768),
        )

    if provider == "zai":
        return ZAISummarizer(
            api_url=config.get("zai_api_url"),
            api_key=config.get("zai_api_key"),
            model=config.get("zai_model"),
            timeout=config.get("zai_timeout", 180),
            max_tokens=config.get("summary_max_tokens", 32768),
        )

    raise ValueError(f"Unknown AI provider: {provider}. Use one of: ollama, gemini, deepseek, openrouter, zai")
