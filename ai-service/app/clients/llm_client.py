import time
import logging
from typing import AsyncGenerator

from langchain_groq import ChatGroq
from langchain_core.messages import SystemMessage, HumanMessage

from app.config import Settings

logger = logging.getLogger(__name__)


class LLMClient:
    """Unified LLM client managing two Groq model tiers.

    Two tiers are optimised for different latency vs quality trade-offs:
    - "primary" → llama-3.3-70b-versatile: best reasoning, used for risk/report/chat
    - "fast"    → gemma2-9b-it: ultra-low latency, used for intent routing + query rewriting

    Usage:
        settings = get_settings()
        client = LLMClient(settings)

        # Non-streaming
        result = await client.invoke("primary", system_prompt, user_message)
        # result = {"content": "...", "model": "...", "tokens_in": 120, "tokens_out": 80, "latency_ms": 450}

        # Streaming (for SSE)
        async for token in client.stream("primary", system_prompt, user_message):
            print(token, end="", flush=True)
    """

    def __init__(self, settings: Settings) -> None:
        self.primary = ChatGroq(
            model=settings.groq_model_primary,
            api_key=settings.groq_api_key,
            temperature=0,        # Deterministic — critical for evaluations
            max_tokens=2048,      # Enough for reports and risk analysis
            timeout=30,
        )
        self.fast = ChatGroq(
            model=settings.groq_model_fast,
            api_key=settings.groq_api_key,
            temperature=0,
            max_tokens=256,       # Short outputs only — intent routing, rewrites
            timeout=10,
        )
        self._models: dict[str, ChatGroq] = {
            "primary": self.primary,
            "fast": self.fast,
        }
        logger.info(
            "LLMClient initialised | primary=%s | fast=%s",
            settings.groq_model_primary,
            settings.groq_model_fast,
        )

    def get_model(self, tier: str = "primary") -> ChatGroq:
        """Return the ChatGroq instance for the given tier."""
        return self._models.get(tier, self.primary)

    async def invoke(
        self,
        tier: str,
        system_prompt: str,
        user_message: str,
    ) -> dict:
        """Send a prompt to Groq and return the response with latency/token metadata.

        Returns:
            {
                "content": "The AI response text",
                "model": "llama-3.3-70b-versatile",
                "tokens_in": 150,
                "tokens_out": 200,
                "latency_ms": 450,
            }
        """
        model = self.get_model(tier)
        messages = [
            SystemMessage(content=system_prompt),
            HumanMessage(content=user_message),
        ]

        start = time.monotonic()
        response = await model.ainvoke(messages)
        latency_ms = int((time.monotonic() - start) * 1000)

        usage = response.usage_metadata or {}
        result = {
            "content": response.content,
            "model": model.model_name,
            "tokens_in": usage.get("input_tokens", 0),
            "tokens_out": usage.get("output_tokens", 0),
            "latency_ms": latency_ms,
        }

        logger.debug(
            "LLM [%s] %s | %d→%d tokens | %dms",
            tier,
            result["model"],
            result["tokens_in"],
            result["tokens_out"],
            latency_ms,
        )
        return result

    async def stream(
        self,
        tier: str,
        system_prompt: str,
        user_message: str,
    ) -> AsyncGenerator[str, None]:
        """Stream tokens from Groq. Yields individual non-empty token strings.

        Used for SSE streaming in Phase 5.
        """
        model = self.get_model(tier)
        messages = [
            SystemMessage(content=system_prompt),
            HumanMessage(content=user_message),
        ]

        async for chunk in model.astream(messages):
            if chunk.content:
                yield chunk.content
