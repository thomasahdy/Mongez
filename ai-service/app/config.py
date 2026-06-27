from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    """All configuration for the Mongez AI service.

    Values come from environment variables or the .env file.
    """

    # ── LLM Provider Selection ────────────────────────────────────────────────
    llm_provider: str = "groq"  # Options: "groq", "nvidia", or "openai"

    # ── Groq LLM ──────────────────────────────────────────────────────────────
    groq_api_key: str | None = None                           # Optional — required only for Groq provider
    groq_model_primary: str = "llama-3.3-70b-versatile"      # Complex tasks: risk, reports, chat
    groq_model_fast: str = "llama-3.1-8b-instant"               # Fast tasks: intent routing, rewriting

    # ── NVIDIA NIM (DeepSeek, etc.) ────────────────────────────────────────────
    nvidia_api_key: str | None = None                           # NVIDIA NIM API key (nvapi-...)
    nvidia_base_url: str = "https://integrate.api.nvidia.com/v1"
    nvidia_model_primary: str = "deepseek-ai/deepseek-v4-pro"  # High-quality reasoning
    nvidia_model_fast: str = "deepseek-ai/deepseek-v4-pro"     # Same model for now

    # ── OpenAI ────────────────────────────────────────────────────────────────────
    openai_api_key: str | None = None                           # OpenAI API key
    openai_model_primary: str = "gpt-4o"                        # High-quality reasoning
    openai_model_fast: str = "gpt-4o-mini"                     # Fast tasks

    # ── NestJS Backend ────────────────────────────────────────────────────────
    nestjs_base_url: str = "http://localhost:3000/api/v1"    # NestJS API URL (includes /api/v1 prefix)
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
