import logging
from functools import lru_cache

from fastapi import HTTPException, Security
from fastapi.security import APIKeyHeader

from app.config import get_settings

logger = logging.getLogger(__name__)

api_key_header = APIKeyHeader(name="X-Service-API-Key", auto_error=False)


async def verify_service_key(api_key: str = Security(api_key_header)) -> str:
    """FastAPI dependency that validates the service-to-service API key.

    Used on internal routes called by NestJS (/chat, /risk/analyze, etc.).
    Raises HTTP 403 if the key is missing or incorrect.

    Usage:
        @router.post("/chat")
        async def chat(
            body: ChatRequest,
            _: str = Depends(verify_service_key),
        ): ...
    """
    settings = get_settings()
    if not api_key or api_key != settings.service_api_key:
        logger.warning("Rejected request with invalid service API key")
        raise HTTPException(status_code=403, detail="Invalid or missing service API key")
    return api_key
