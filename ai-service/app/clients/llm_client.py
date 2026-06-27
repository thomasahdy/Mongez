import time
import logging
import asyncio
from typing import AsyncGenerator, Any
from enum import Enum

from langchain_groq import ChatGroq
from langchain_core.messages import SystemMessage, HumanMessage
from openai import AsyncOpenAI

from app.config import Settings

logger = logging.getLogger(__name__)


class LLMProvider(Enum):
    """Available LLM providers."""
    GROQ = "groq"
    NVIDIA = "nvidia"
    OPENAI = "openai"


def detect_arabic(text: str) -> bool:
    """Detect if the text contains any Arabic characters."""
    if not text:
        return False
    for char in text:
        if '\u0600' <= char <= '\u06ff' or '\u0750' <= char <= '\u077f' or '\ufb50' <= char <= '\ufdff' or '\ufe70' <= char <= '\ufeff':
            return True
    return False


class LLMClient:
    """Unified LLM client supporting multiple providers (Groq, NVIDIA, OpenAI).

    Provider Selection:
        Controlled by settings.llm_provider environment variable.
        - "groq": Uses ChatGroq with llama models
        - "nvidia": Uses NVIDIA NIM API (DeepSeek, etc.)
        - "openai": Uses OpenAI API

    Model Tiers:
        Two tiers optimised for different latency vs quality trade-offs:
        - "primary" → High-quality reasoning model for risk/report/chat
        - "fast"    → Low-latency model for intent routing + query rewriting

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
        self.provider = settings.llm_provider.lower()
        self.settings = settings

        if self.provider == LLMProvider.NVIDIA.value:
            self._init_nvidia()
        elif self.provider == LLMProvider.OPENAI.value:
            self._init_openai()
        else:
            # Default to Groq
            self._init_groq()

    def _init_groq(self) -> None:
        """Initialize Groq LangChain clients."""
        if not self.settings.groq_api_key:
            raise ValueError("groq_api_key is required when using Groq provider")
        self.primary = ChatGroq(
            model=self.settings.groq_model_primary,
            api_key=self.settings.groq_api_key,
            temperature=0,        # Deterministic — critical for evaluations
            max_tokens=2048,      # Enough for reports and risk analysis
            timeout=30,
        )
        self.fast = ChatGroq(
            model=self.settings.groq_model_fast,
            api_key=self.settings.groq_api_key,
            temperature=0,
            max_tokens=256,       # Short outputs only — intent routing, rewrites
            timeout=10,
        )
        self._models: dict[str, ChatGroq] = {
            "primary": self.primary,
            "fast": self.fast,
        }
        logger.info(
            "LLMClient initialised [GROQ] | primary=%s | fast=%s",
            self.settings.groq_model_primary,
            self.settings.groq_model_fast,
        )

    def _init_nvidia(self) -> None:
        """Initialize NVIDIA NIM clients using OpenAI-compatible API."""
        if not self.settings.nvidia_api_key:
            raise ValueError("nvidia_api_key is required when using NVIDIA provider")

        self.primary = AsyncOpenAI(
            base_url=self.settings.nvidia_base_url,
            api_key=self.settings.nvidia_api_key,
        )
        self.fast = self.primary  # Same client for both tiers
        self._model_names: dict[str, str] = {
            "primary": self.settings.nvidia_model_primary,
            "fast": self.settings.nvidia_model_fast,
        }
        logger.info(
            "LLMClient initialised [NVIDIA] | primary=%s | fast=%s",
            self.settings.nvidia_model_primary,
            self.settings.nvidia_model_fast,
        )

    def _init_openai(self) -> None:
        """Initialize OpenAI clients."""
        self.primary = AsyncOpenAI(api_key=self.settings.openai_api_key)
        self.fast = self.primary  # Same client for both tiers
        self._model_names: dict[str, str] = {
            "primary": self.settings.openai_model_primary,
            "fast": self.settings.openai_model_fast,
        }
        logger.info(
            "LLMClient initialised [OPENAI] | primary=%s | fast=%s",
            self.settings.openai_model_primary,
            self.settings.openai_model_fast,
        )

    def _get_model_name(self, tier: str = "primary") -> str:
        """Get the model name for the given tier (for NVIDIA/OpenAI providers)."""
        if self.provider == LLMProvider.GROQ.value:
            return self.get_model(tier).model_name
        return self._model_names.get(tier, self._model_names["primary"])

    def get_model(self, tier: str = "primary") -> ChatGroq:
        """Return the ChatGroq instance for the given tier (Groq only)."""
        return self._models.get(tier, self.primary)

    async def invoke(
        self,
        tier: str,
        system_prompt: str,
        user_message: str,
        token_queue: Any = None,
    ) -> dict:
        """Send a prompt to the configured LLM provider with retry logic and failover support.

        Returns:
            {
                "content": "The AI response text",
                "model": "model-name",
                "tokens_in": 150,
                "tokens_out": 200,
                "latency_ms": 450,
            }
        """
        # 1. Arabic Detection & Routing Suffix
        if tier != "fast" and (detect_arabic(user_message) or detect_arabic(system_prompt)):
            arabic_instruction = (
                "\n\nIMPORTANT: The user message is in Arabic. You must respond in clear, grammatically correct Arabic. "
                "Ensure all markdown tables, lists, and structure are readable in Right-to-Left (RTL) mode."
            )
            if arabic_instruction not in system_prompt:
                system_prompt += arabic_instruction

        current_tier = tier
        retries = 1  # Reduced from 3 (Week 1, Day 5 - Emergency fix)
        backoff = 0.5  # Faster backoff for faster failures

        for attempt in range(retries):
            try:
                if self.provider == LLMProvider.GROQ.value:
                    return await self._invoke_groq(current_tier, system_prompt, user_message, token_queue)
                else:
                    return await self._invoke_openai_compatible(current_tier, system_prompt, user_message, token_queue)

            except Exception as exc:
                logger.warning(
                    "LLM invocation failed on tier %s (attempt %d/%d): %s",
                    current_tier,
                    attempt + 1,
                    retries,
                    exc
                )
                if attempt == retries - 1:
                    # Failover logic
                    if current_tier == "primary":
                        logger.info("Attempting model failover from primary to fast tier.")
                        current_tier = "fast"
                        try:
                            if self.provider == LLMProvider.GROQ.value:
                                return await self._invoke_groq(current_tier, system_prompt, user_message, token_queue)
                            else:
                                return await self._invoke_openai_compatible(current_tier, system_prompt, user_message, token_queue)
                        except Exception as failover_exc:
                            logger.error("Failover model also failed: %s", failover_exc)
                            failover_exc_str = str(failover_exc).lower()
                            if "429" in failover_exc_str or "rate" in failover_exc_str or "too many" in failover_exc_str:
                                raise RuntimeError("AI service is temporarily busy. Please wait a moment and try again.") from failover_exc
                            raise failover_exc
                    else:
                        exc_str = str(exc).lower()
                        if "429" in exc_str or "rate" in exc_str or "too many" in exc_str:
                            raise RuntimeError("AI service is temporarily busy. Please wait a moment and try again.") from exc
                        raise exc

                await asyncio.sleep(backoff)
                backoff *= 2.0

    async def _invoke_groq(
        self,
        tier: str,
        system_prompt: str,
        user_message: str,
        token_queue: Any = None,
    ) -> dict:
        """Invoke Groq LangChain model."""
        model = self.get_model(tier)
        messages = [
            SystemMessage(content=system_prompt),
            HumanMessage(content=user_message),
        ]

        start = time.monotonic()
        if token_queue is not None:
            chunks = []
            usage_metadata = {}
            async for chunk in model.astream(messages):
                if chunk.content:
                    chunks.append(chunk.content)
                    await token_queue.put(chunk.content)
                if hasattr(chunk, "usage_metadata") and chunk.usage_metadata:
                    usage_metadata = chunk.usage_metadata
            latency_ms = int((time.monotonic() - start) * 1000)
            content = "".join(chunks)
            tokens_in = usage_metadata.get("input_tokens", len(system_prompt + user_message) // 4)
            tokens_out = usage_metadata.get("output_tokens", len(content) // 4)
        else:
            response = await model.ainvoke(messages)
            latency_ms = int((time.monotonic() - start) * 1000)
            usage = response.usage_metadata or {}
            content = response.content
            tokens_in = usage.get("input_tokens", 0)
            tokens_out = usage.get("output_tokens", 0)

        result = {
            "content": content,
            "model": model.model_name,
            "tokens_in": tokens_in,
            "tokens_out": tokens_out,
            "latency_ms": latency_ms,
        }

        logger.debug(
            "LLM [GROQ] %s | %d→%d tokens | %dms",
            result["model"],
            result["tokens_in"],
            result["tokens_out"],
            latency_ms,
        )
        return result

    async def _invoke_openai_compatible(
        self,
        tier: str,
        system_prompt: str,
        user_message: str,
        token_queue: Any = None,
    ) -> dict:
        """Invoke NVIDIA or OpenAI using OpenAI-compatible API."""
        client = self.primary  # Same client for both tiers
        model_name = self._get_model_name(tier)

        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_message},
        ]

        extra_body = None
        if self.provider == LLMProvider.NVIDIA.value:
            extra_body = {"chat_template_kwargs": {"thinking": False}}

        start = time.monotonic()
        if token_queue is not None:
            # Streaming with queue
            chunks = []
            stream = await client.chat.completions.create(
                model=model_name,
                messages=messages,
                temperature=0,
                max_tokens=2048,
                stream=True,
                extra_body=extra_body,
            )
            async for chunk in stream:
                if chunk.choices and chunk.choices[0].delta.content:
                    content_chunk = chunk.choices[0].delta.content
                    chunks.append(content_chunk)
                    await token_queue.put(content_chunk)

            latency_ms = int((time.monotonic() - start) * 1000)
            content = "".join(chunks)
            # Estimate tokens for streaming responses (usage not available in stream chunks)
            tokens_in = len(system_prompt + user_message) // 4
            tokens_out = len(content) // 4
        else:
            # Non-streaming
            response = await client.chat.completions.create(
                model=model_name,
                messages=messages,
                temperature=0,
                max_tokens=2048,
                stream=False,
                extra_body=extra_body,
            )
            latency_ms = int((time.monotonic() - start) * 1000)
            content = response.choices[0].message.content
            usage = response.usage
            tokens_in = usage.prompt_tokens if usage else len(system_prompt + user_message) // 4
            tokens_out = usage.completion_tokens if usage else len(content) // 4

        result = {
            "content": content,
            "model": model_name,
            "tokens_in": tokens_in,
            "tokens_out": tokens_out,
            "latency_ms": latency_ms,
        }

        logger.debug(
            "LLM [%s] %s | %d→%d tokens | %dms",
            self.provider.upper(),
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
        """Stream tokens from the configured LLM provider. Yields individual non-empty token strings.

        Used for SSE streaming in Phase 5.
        """
        # Apply Arabic detection if needed
        if detect_arabic(user_message) or detect_arabic(system_prompt):
            arabic_instruction = (
                "\n\nIMPORTANT: The user message is in Arabic. You must respond in clear, grammatically correct Arabic. "
                "Ensure all markdown tables, lists, and structure are readable in Right-to-Left (RTL) mode."
            )
            if arabic_instruction not in system_prompt:
                system_prompt += arabic_instruction

        if self.provider == LLMProvider.GROQ.value:
            async for token in self._stream_groq(tier, system_prompt, user_message):
                yield token
        else:
            async for token in self._stream_openai_compatible(tier, system_prompt, user_message):
                yield token

    async def _stream_groq(
        self,
        tier: str,
        system_prompt: str,
        user_message: str,
    ) -> AsyncGenerator[str, None]:
        """Stream tokens from Groq."""
        model = self.get_model(tier)
        messages = [
            SystemMessage(content=system_prompt),
            HumanMessage(content=user_message),
        ]

        async for chunk in model.astream(messages):
            if chunk.content:
                yield chunk.content

    async def _stream_openai_compatible(
        self,
        tier: str,
        system_prompt: str,
        user_message: str,
    ) -> AsyncGenerator[str, None]:
        """Stream tokens from NVIDIA or OpenAI using OpenAI-compatible API."""
        client = self.primary
        model_name = self._get_model_name(tier)

        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_message},
        ]

        stream = await client.chat.completions.create(
            model=model_name,
            messages=messages,
            temperature=0,
            max_tokens=2048,
            stream=True,
            extra_body={"chat_template_kwargs": {"thinking": False}} if self.provider == LLMProvider.NVIDIA.value else None,
        )

        async for chunk in stream:
            if chunk.choices and chunk.choices[0].delta.content:
                yield chunk.choices[0].delta.content
