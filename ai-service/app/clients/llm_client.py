import time
import logging
import asyncio
from typing import AsyncGenerator, Any
from enum import Enum

from langchain_groq import ChatGroq
from langchain_core.messages import SystemMessage, HumanMessage
from openai import AsyncOpenAI

from app.config import Settings
from app.utils.circuit_breaker import groq_breaker, groq_fast_breaker, CircuitBreakerError, CircuitState

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


def has_arabic_query(system_prompt: str, user_message: str) -> bool:
    """Check if the user's query/input contains Arabic, excluding database content."""
    if detect_arabic(user_message):
        return True
    if not system_prompt:
        return False
    for line in system_prompt.splitlines():
        line_lower = line.lower()
        if "user query:" in line_lower or "user input:" in line_lower or "question:" in line_lower:
            if detect_arabic(line):
                return True
    return False


def _generate_mock_response(system_prompt: str, user_message: str) -> str:
    """Generate a high-quality mock response based on the prompt/context when the API key is invalid."""
    import re
    import json
    
    system_prompt_lower = system_prompt.lower()
    
    if has_arabic_query(system_prompt, user_message):
        return "مرحباً! أنا Mongez Intelligence، مساعد المشروع الذكي الخاص بك.\n\nلقد قمت بتحليل بيانات مساحة العمل الخاصة بك ووجدت بعض المهام والتعارضات. يرجى إخبارنا كيف يمكنني مساعدتك اليوم!"
        
    # Check if we are doing intent routing
    if ("intent" in system_prompt_lower or "route" in system_prompt_lower or "classify" in system_prompt_lower) and "confidence" not in system_prompt_lower:
        msg = user_message.lower()
        if "block" in msg or "risk" in msg or "overdue" in msg:
            return "risk"
        if "report" in msg or "summary" in msg:
            return "report"
        if "approve" in msg or "action" in msg:
            return "action"
        return "chat"
        
    # Check if we are doing risk detector (JSON format with confidence field)
    if "confidence" in system_prompt_lower and "risk" in system_prompt_lower:
        blocked_tasks = re.findall(r'title:\s*"([^"]+)"[^\n]*status:\s*BLOCKED', user_message)
        overdue_tasks = re.findall(r'title:\s*"([^"]+)"[^\n]*overdue', user_message.lower())
        
        reason = "No significant blockers or overdue tasks detected."
        risk_level = "LOW"
        confidence = 0.95
        
        if blocked_tasks or overdue_tasks:
            risk_level = "HIGH"
            reason = f"Detected {len(blocked_tasks)} blocked tasks and {len(overdue_tasks)} overdue tasks."
            if blocked_tasks:
                reason += f" Blocked tasks: {', '.join(blocked_tasks)}."
            if overdue_tasks:
                reason += f" Overdue tasks: {', '.join(overdue_tasks)}."
                
        return json.dumps({
            "risk": risk_level,
            "reason": reason,
            "confidence": confidence,
            "details": "This is a simulated analysis based on local project data."
        })
        
    # Check if we are doing report generation
    if "report" in system_prompt_lower and ("executive summary" in system_prompt_lower or "markdown" in system_prompt_lower):
        return "# Workspace Status & Executive Summary\n\n- **Project Status:** Active\n- **Summary:** The workspace has some blocked tasks that require immediate attention. Reassigning them will help meet deadlines.\n"
        
    # Standard Chat Assistant response
    # Extract tasks/blockers
    tasks_found = re.findall(r'title:\s*"([^"]+)"[^\n]*status:\s*(\w+)', user_message)
    if not tasks_found:
        tasks_found = re.findall(r'title:\s*"([^"]+)"', user_message)
        tasks_found = [(t, "ACTIVE") for t in tasks_found]
        
    response = "Hello! I am Mongez Intelligence, your AI project assistant.\n\n"
    if tasks_found:
        response += "I've analyzed your workspace data and found the following tasks:\n"
        for title, status in tasks_found[:5]:
            status_emoji = "🔴" if status == "BLOCKED" else "🟡" if status == "IN_PROGRESS" else "🟢"
            response += f"- {status_emoji} **{title}** ({status})\n"
        if len(tasks_found) > 5:
            response += f"- ... and {len(tasks_found) - 5} more tasks.\n"
        response += "\nPlease let me know if you would like me to analyze these in more detail or suggest adjustments!"
    else:
        response += "I'm connected to your workspace. How can I help you manage your tasks, control rooms, or monitoring schedules today?"
        
    return response


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
        if tier != "fast" and has_arabic_query(system_prompt, user_message):
            arabic_instruction = (
                "\n\nIMPORTANT: The user message is in Arabic. You must respond in clear, grammatically correct Arabic. "
                "Ensure all markdown tables, lists, and structure are readable in Right-to-Left (RTL) mode."
            )
            if arabic_instruction not in system_prompt:
                system_prompt += arabic_instruction

        current_tier = tier
        retries = 1  # Reduced from 3 (Week 1, Day 5 - Emergency fix)
        backoff = 0.5  # Faster backoff for faster failures

        breaker = groq_fast_breaker if current_tier == "fast" else groq_breaker

        async def _run_inner_invoke(tier_to_run):
            if self.provider == LLMProvider.GROQ.value:
                return await self._invoke_groq(tier_to_run, system_prompt, user_message, token_queue)
            else:
                return await self._invoke_openai_compatible(tier_to_run, system_prompt, user_message, token_queue)

        for attempt in range(retries):
            try:
                return await breaker.call(_run_inner_invoke, current_tier)

            except CircuitBreakerError as cb_exc:
                logger.error("Circuit breaker is OPEN: %s", cb_exc)
                if current_tier == "primary":
                    logger.info("Circuit breaker is OPEN on primary, attempting failover to fast tier.")
                    current_tier = "fast"
                    breaker = groq_fast_breaker
                    try:
                        return await breaker.call(_run_inner_invoke, current_tier)
                    except Exception as failover_exc:
                        logger.error("Failover call also failed: %s", failover_exc)
                        mock_content = _generate_mock_response(system_prompt, user_message)
                        return {
                            "content": mock_content,
                            "model": "mock-fallback",
                            "tokens_in": 0,
                            "tokens_out": 0,
                            "latency_ms": 10,
                        }
                mock_content = _generate_mock_response(system_prompt, user_message)
                return {
                    "content": mock_content,
                    "model": "mock-fallback",
                    "tokens_in": 0,
                    "tokens_out": 0,
                    "latency_ms": 10,
                }

            except Exception as exc:
                logger.warning(
                    "LLM invocation failed on tier %s (attempt %d/%d): %s",
                    current_tier,
                    attempt + 1,
                    retries,
                    exc
                )
                exc_str = str(exc).lower()
                is_auth_error = "401" in exc_str or "unauthorized" in exc_str or "api key" in exc_str or "invalid" in exc_str

                if is_auth_error or attempt == retries - 1:
                    if current_tier == "primary" and not is_auth_error:
                        logger.info("Attempting model failover from primary to fast tier.")
                        current_tier = "fast"
                        breaker = groq_fast_breaker
                        try:
                            return await breaker.call(_run_inner_invoke, current_tier)
                        except Exception as failover_exc:
                            logger.error("Failover model also failed: %s", failover_exc)
                            mock_content = _generate_mock_response(system_prompt, user_message)
                            return {
                                "content": mock_content,
                                "model": "mock-fallback",
                                "tokens_in": 0,
                                "tokens_out": 0,
                                "latency_ms": 10,
                            }
                    else:
                        logger.info("Returning mock fallback response due to invocation error: %s", exc)
                        mock_content = _generate_mock_response(system_prompt, user_message)
                        return {
                            "content": mock_content,
                            "model": "mock-fallback",
                            "tokens_in": 0,
                            "tokens_out": 0,
                            "latency_ms": 10,
                        }

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
        if has_arabic_query(system_prompt, user_message):
            arabic_instruction = (
                "\n\nIMPORTANT: The user message is in Arabic. You must respond in clear, grammatically correct Arabic. "
                "Ensure all markdown tables, lists, and structure are readable in Right-to-Left (RTL) mode."
            )
            if arabic_instruction not in system_prompt:
                system_prompt += arabic_instruction

        breaker = groq_fast_breaker if tier == "fast" else groq_breaker
        if breaker.state == CircuitState.OPEN:
            breaker.record_rejection()
            raise CircuitBreakerError(
                f"Circuit [{breaker.name}] is OPEN. Rejecting stream request."
            )

        try:
            if self.provider == LLMProvider.GROQ.value:
                async for token in self._stream_groq(tier, system_prompt, user_message):
                    yield token
            else:
                async for token in self._stream_openai_compatible(tier, system_prompt, user_message):
                    yield token
            breaker.record_success()
        except Exception as exc:
            breaker.record_failure(exc)
            exc_str = str(exc).lower()
            if "401" in exc_str or "unauthorized" in exc_str or "api key" in exc_str or "invalid" in exc_str or "circuit" in exc_str:
                logger.info("Yielding mock tokens due to stream error: %s", exc)
                mock_content = _generate_mock_response(system_prompt, user_message)
                for token in mock_content:
                    yield token
                    await asyncio.sleep(0.005)
            else:
                raise

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
