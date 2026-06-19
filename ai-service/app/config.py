from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    """All configuration for the Mongez AI service.

    Values come from environment variables or the .env file.
    Only GROQ_API_KEY is required — all others have safe local defaults.
    """

    # ── Groq LLM ──────────────────────────────────────────────────────────────
    groq_api_key: str                                         # REQUIRED — get from console.groq.com
    groq_model_primary: str = "llama-3.3-70b-versatile"      # Complex tasks: risk, reports, chat
    groq_model_fast: str = "llama-3.1-8b-instant"               # Fast tasks: intent routing, rewriting

    # ── NestJS Backend ────────────────────────────────────────────────────────
    nestjs_base_url: str = "http://localhost:3000"            # NestJS API URL
    nestjs_service_api_key: str = "dev-key"                   # Matches AI_SERVICE_API_KEY in NestJS

    # ── Qdrant Vector DB ──────────────────────────────────────────────────────
    qdrant_url: str = "http://localhost:6333"
    qdrant_collection_prefix: str = "mongez"                  # Collections: mongez_{spaceId}

    # ── Redis ─────────────────────────────────────────────────────────────────
    redis_url: str = "redis://localhost:6379"

    # ── LangSmith Observability (optional) ───────────────────────────────────
    langsmith_api_key: str | None = None
    langsmith_project: str = "mongez-ai"

    # ── Service Auth ──────────────────────────────────────────────────────────
    service_api_key: str = "dev-key"                          # Key NestJS uses to call us

    # ── General ───────────────────────────────────────────────────────────────
    debug: bool = False

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


@lru_cache
def get_settings() -> Settings:
    """Return a cached singleton Settings instance.

    Using lru_cache means the .env file is read once per process lifetime.
    In tests, call get_settings.cache_clear() to reset between test cases.
    """
    return Settings()  # type: ignore[call-arg]
