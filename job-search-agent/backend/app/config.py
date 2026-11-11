"""Central configuration: loads config/*.yaml and environment variables.

No candidate data is hardcoded in business logic — it all flows from here.
"""
from __future__ import annotations

import os
from functools import lru_cache
from pathlib import Path
from typing import Any

import yaml

# project root = .../job-search-agent
ROOT = Path(__file__).resolve().parents[2]
CONFIG_DIR = ROOT / "config"
DATA_DIR = ROOT / "data"
DB_PATH = DATA_DIR / "app.db"


def _load_yaml(name: str) -> dict[str, Any]:
    path = CONFIG_DIR / name
    if not path.exists():
        return {}
    with path.open("r", encoding="utf-8") as fh:
        return yaml.safe_load(fh) or {}


@lru_cache(maxsize=1)
def candidate_config() -> dict[str, Any]:
    return _load_yaml("candidate.yaml")


@lru_cache(maxsize=1)
def job_preferences() -> dict[str, Any]:
    return _load_yaml("job_preferences.yaml")


@lru_cache(maxsize=1)
def sources_config() -> dict[str, Any]:
    return _load_yaml("sources.yaml")


@lru_cache(maxsize=1)
def outreach_rules() -> dict[str, Any]:
    return _load_yaml("outreach_rules.yaml")


class Settings:
    """Environment-driven runtime settings."""

    def __init__(self) -> None:
        self.db_url: str = os.getenv("DATABASE_URL", f"sqlite:///{DB_PATH}")
        self.ollama_host: str = os.getenv("OLLAMA_HOST", "http://localhost:11434")
        self.ollama_model: str = os.getenv("OLLAMA_MODEL", "qwen2.5")
        self.timezone: str = os.getenv("APP_TIMEZONE", "Asia/Kolkata")
        self.frontend_origin: str = os.getenv("FRONTEND_ORIGIN", "http://localhost:3000")
        self.max_daily_outreach: int = int(os.getenv("MAX_DAILY_OUTREACH", "20"))
        self.gmail_credentials_path: str = os.getenv("GMAIL_CREDENTIALS_PATH", "./credentials.json")
        self.gmail_token_path: str = os.getenv("GMAIL_TOKEN_PATH", "./gmail.token.json")


@lru_cache(maxsize=1)
def settings() -> Settings:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    return Settings()
