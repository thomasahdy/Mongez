from fastapi import APIRouter
from app.config import get_settings

router = APIRouter()


@router.get("")
async def health_check():
    """Basic health check — confirms the service is alive."""
    settings = get_settings()
    return {
        "status": "ok",
        "service": "mongez-ai",
        "version": "0.1.0",
        "groq_primary_model": settings.groq_model_primary,
        "groq_fast_model": settings.groq_model_fast,
    }


@router.get("/ready")
async def readiness_check():
    """Readiness check — confirms config is loaded and Groq key is set."""
    settings = get_settings()
    groq_configured = bool(settings.groq_api_key and settings.groq_api_key != "gsk_your_groq_api_key_here")
    return {
        "status": "ready" if groq_configured else "not_ready",
        "groq_configured": groq_configured,
        "langsmith_enabled": bool(settings.langsmith_api_key),
    }
