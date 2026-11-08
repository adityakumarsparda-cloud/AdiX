"""Thin Ollama client. Local, free. Degrades gracefully when Ollama is absent.

The runtime AI dependency is Ollama (spec §4). If it is not running, callers fall
back to deterministic templates — the system never *requires* an LLM to function,
and never calls a paid API.
"""
from __future__ import annotations

import httpx

from app.config import settings


def is_available() -> bool:
    """True if an Ollama server answers on the configured host."""
    try:
        with httpx.Client(timeout=2.0) as c:
            r = c.get(f"{settings().ollama_host}/api/tags")
            return r.status_code == 200
    except (httpx.HTTPError, OSError):
        return False


def generate(prompt: str, *, system: str | None = None, model: str | None = None) -> str | None:
    """Single-shot generation. Returns text, or None if Ollama is unavailable/errors.

    Model output is always treated by callers as a *draft for human review*, never as
    a command to take an action (see SECURITY.md §8).
    """
    body: dict = {
        "model": model or settings().ollama_model,
        "prompt": prompt,
        "stream": False,
        "options": {"temperature": 0.2},
    }
    if system:
        body["system"] = system
    try:
        with httpx.Client(timeout=60.0) as c:
            r = c.post(f"{settings().ollama_host}/api/generate", json=body)
            r.raise_for_status()
            return (r.json().get("response") or "").strip()
    except (httpx.HTTPError, OSError, ValueError):
        return None
