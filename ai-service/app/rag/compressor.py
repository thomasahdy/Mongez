import logging
from app.dependencies import llm_client

logger = logging.getLogger(__name__)

# Heuristic: 1 token ~= 4 characters in English
CHAR_TO_TOKEN_RATIO = 4.0
MAX_CONTEXT_TOKENS = 12000
MAX_CHAR_BUDGET = int(MAX_CONTEXT_TOKENS * CHAR_TO_TOKEN_RATIO)

async def compress_context(context_text: str, query: str = "") -> str:
    """Estimates context length and compresses it if it exceeds limits by truncating."""
    char_len = len(context_text)
    if char_len <= MAX_CHAR_BUDGET:
        return context_text

    logger.info("Context budget exceeded (%d chars > %d budget). Truncating.", char_len, MAX_CHAR_BUDGET)
    return context_text[:MAX_CHAR_BUDGET]
