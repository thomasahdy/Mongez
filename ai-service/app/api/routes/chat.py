"""Chat API route — processes user messages through the LangGraph pipeline."""
import uuid
import json
import logging
import time
import random
import re
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from app.api.middleware.auth import verify_service_key
from app.agents.graph import agent_graph
from app.utils.correlation import RequestContext

logger = logging.getLogger(__name__)
router = APIRouter()


# Pre-compiled regex patterns for whole-word matching to avoid substring hijacking
# Expanded greeting patterns (Week 1, Day 5 - Emergency fix)
_EN_GREETING_RE = re.compile(r'''
    \b(
        hi|hello|hey|greetings|
        good\s+(morning|afternoon|evening|day|night)|
        what'?s\s+up|howdy|
        hi\s+there|hello\s+again|hey\s+everyone|hey\s+there|
        greetings|g'?day
    )\b
''', re.IGNORECASE | re.VERBOSE)

_AR_GREETING_RE = re.compile(r'''
    (?<!\w)(
        سلام|مرحبا|أهلا|اهلا|مرحباً|أهلاً|
        مرحبا_بك|السلام_عليكم|وعليكم_السلام|
        صباح_الخير|مساء_الخير
    )(?!\w)
''', re.UNICODE | re.VERBOSE)

_EN_THANKS_RE = re.compile(r'''
    \b(
        thanks|thank\s+you|thx|appreciate|
        appreciate\s+it|thanks\s+a\s+lot|
        cheers|much\s+obliged
    )\b
''', re.IGNORECASE | re.VERBOSE)

_AR_THANKS_RE = re.compile(r'(?<!\w)(شكرا|شكرا لك|شكران|مع الشكر)(?!\w)', re.UNICODE)
_EN_SMALLTALK_RE = re.compile(r'\b(what can you do|what do you do|how can you help|who are you)\b', re.IGNORECASE)


# Greeting response patterns (EN/AR)
GREETING_RESPONSES_EN = [
    "Hello! How can I help you with your workspace today?",
    "Hi there! What would you like to know about your projects?",
    "Hey! I'm here to help with task management, approvals, and project insights.",
    "Greetings! How can I assist you with Mongez today?",
]

GREETING_RESPONSES_AR = [
    "مرحبا! كيف يمكنني مساعدتك في مساحة العمل اليوم؟",
    "أهلا بك! ما الذي تود معرفته عن مشاريعك؟",
    "هلا! أنا هنا للمساعدة في إدارة المهام والموافقات والرؤى المشروع.",
    "تحية! كيف يمكنني مساعدتك في منجز اليوم؟",
]

THANKS_RESPONSES_EN = [
    "You're welcome! Let me know if you need anything else.",
    "Happy to help! Is there anything else you'd like to know?",
    "Anytime! Feel free to ask if you have more questions.",
]

THANKS_RESPONSES_AR = [
    "على الرحب والسعة! أخبرني إذا احتجت لأي شيء آخر.",
    "سررت بالمساندة! هل هناك شيء آخر تود معرفته؟",
    "في أي وقت! لا تتردد في السؤال إذا كان لديك المزيد من الأسئلة.",
]

SMALL_TALK_RESPONSES_EN = [
    "I'm the Mongez AI assistant. I can help you with:\n• Task analysis and workload management\n• Risk detection and blocker identification\n• Report generation and project insights\n• Approval workflows and team analytics\n\nWhat would you like to explore?",
]

SMALL_TALK_RESPONSES_AR = [
    "أنا مساعد منجز الذكاء الاصطناعي. يمكنني مساعدتك في:\n• تحليل المهام وإدارة عبء العمل\n• كشف المخاطر وتحديد العوائق\n• إنشاء التقارير والرؤى المشروع\n• سير عمل الموافقات والتحليلات الفريقية\n\nما الذي تود استكشافه؟",
]


def is_greeting(query: str) -> tuple[bool, str | None]:
    """Pre-flight greeting detection.

    Returns (is_greeting, response_type) where response_type is:
    - "greeting_en", "greeting_ar", "thanks_en", "thanks_ar", "smalltalk_en", "smalltalk_ar", or None
    """
    if not query:
        return False, None

    # English greetings
    if _EN_GREETING_RE.search(query):
        return True, "greeting_en"

    # Arabic greetings
    if _AR_GREETING_RE.search(query):
        return True, "greeting_ar"

    # English thanks
    if _EN_THANKS_RE.search(query):
        return True, "thanks_en"

    # Arabic thanks
    if _AR_THANKS_RE.search(query):
        return True, "thanks_ar"

    # Small talk about capabilities
    if _EN_SMALLTALK_RE.search(query):
        # Detect language
        if any(c in query for c in "ابتثجحخدذرزسشصضطظعغفقكلمنهوي"):
            return True, "smalltalk_ar"
        return True, "smalltalk_en"

    return False, None


def get_greeting_response(response_type: str) -> str:
    """Get a random greeting response based on type."""
    if response_type == "greeting_en":
        return random.choice(GREETING_RESPONSES_EN)
    elif response_type == "greeting_ar":
        return random.choice(GREETING_RESPONSES_AR)
    elif response_type == "thanks_en":
        return random.choice(THANKS_RESPONSES_EN)
    elif response_type == "thanks_ar":
        return random.choice(THANKS_RESPONSES_AR)
    elif response_type == "smalltalk_en":
        return random.choice(SMALL_TALK_RESPONSES_EN)
    elif response_type == "smalltalk_ar":
        return random.choice(SMALL_TALK_RESPONSES_AR)
    return "Hello! How can I help you?"


class ChatRequest(BaseModel):
    message: str = Field(min_length=1, max_length=4000)
    space_id: str
    user_id: str
    user_name: str = "User"
    user_role: str = "Member"
    space_name: str = "My Space"
    board_name: str = "All Boards"
    trace_id: str | None = None


class ChatResponse(BaseModel):
    trace_id: str
    intent: str
    response: str
    approval_status: str | None = None
    metadata: dict = {}


@router.post("", response_model=ChatResponse)
async def chat(
    req: ChatRequest,
    request: Request,
    _: str = Depends(verify_service_key),
):
    """Process a user message through the full LangGraph agent pipeline.

    The graph automatically routes to the correct agent based on intent:
    - risk questions   → risk_detector
    - general chat     → chat_responder
    - report requests  → report_generator
    - action requests  → recommendation + human_gate

    PRE-FLIGHT CHECK: Greetings and small talk bypass the entire pipeline.
    """
    # Initialize correlation context
    trace_id = req.trace_id or getattr(request.state, "trace_id", None) or str(uuid.uuid4())
    RequestContext.initialize(
        request_id=trace_id,
        user_id=req.user_id,
        space_id=req.space_id,
        space_name=req.space_name
    )

    logger.info("[%s] Request received | ctx=%s", trace_id, RequestContext.get())

    # PRE-FLIGHT: Check for greetings and small talk (bypasses entire agent pipeline)
    is_greeting_msg, greeting_type = is_greeting(req.message)
    if is_greeting_msg:
        logger.info("[%s] Pre-flight greeting detected: %s", trace_id, greeting_type)
        response_text = get_greeting_response(greeting_type)
        return ChatResponse(
            trace_id=trace_id,
            intent="greeting",
            response=response_text,
            approval_status=None,
            metadata={
                "bypassed": True,
                "reason": "pre_flight_greeting",
                "greeting_type": greeting_type,
            },
        )

    # Validate required fields for tool execution
    if not req.space_id or req.space_id.strip() == "":
        logger.warning("[%s] Request with missing/empty space_id: %r", trace_id, req.space_id)

    initial_state = {
        "raw_input": req.message,
        "space_id": req.space_id,
        "user_id": req.user_id,
        "user_name": req.user_name,
        "user_role": req.user_role,
        "space_name": req.space_name,
        "board_name": req.board_name,
        "trace_id": trace_id,
        "rewritten_query": "",
        "intent": "",
        "retrieved_context": [],
        "task_data": [],
        "final_response": "",
        "proposed_action": None,
        "approval_status": None,
        "response_metadata": {},
    }

    try:
        result = await agent_graph.ainvoke(initial_state)
    except Exception as exc:
        logger.error("[%s] Agent pipeline error: %s", trace_id, exc)
        raise HTTPException(status_code=500, detail="AI pipeline error. Please try again.")

    return ChatResponse(
        trace_id=result.get("trace_id", trace_id),
        intent=result.get("intent", "unknown"),
        response=result.get("final_response", ""),
        approval_status=result.get("approval_status"),
        metadata=result.get("response_metadata", {}),
    )


async def extract_answer_tokens(token_generator):
    """Processes a stream of JSON tokens and yields only the tokens inside the "answer" field.

    If the stream doesn't start with a JSON object structure (skipping any markdown code block or preamble),
    falls back to yielding all tokens directly.
    """
    state = "CHECK_START"  # CHECK_START -> FIND_KEY -> FIND_COLON -> FIND_QUOTE -> STREAM_VALUE -> DONE
    buffer = ""
    escaped = False
    is_json = True

    async for chunk in token_generator:
        buffer += chunk

        if state == "CHECK_START":
            # Strip preamble like ```json or whitespace until we find '{'
            stripped_buffer = buffer.lstrip()
            brace_idx = buffer.find('{')
            if brace_idx != -1:
                # We found the opening brace of JSON!
                # Discard the preamble (everything before and including '{')
                buffer = buffer[brace_idx + 1:]
                state = "FIND_KEY"
                is_json = True
            elif len(stripped_buffer) >= 200 and '{' not in stripped_buffer:
                # If we've seen 200+ non-whitespace characters and no '{', it's probably raw text
                is_json = False
                state = "FALLBACK"
                yield buffer
                buffer = ""
                continue
            else:
                # Wait for more tokens
                continue

        if not is_json:
            yield chunk
            continue

        # Process the buffer in JSON extraction mode
        while buffer:
            if state == "FIND_KEY":
                idx = buffer.find('"answer"')
                if idx != -1:
                    # Found "answer", move past it
                    buffer = buffer[idx + 8:]
                    state = "FIND_COLON"
                else:
                    # Keep a safe buffer of up to 4096 characters to avoid memory exhaustion,
                    # but do not truncate if it might split "answer" (length 8)
                    if len(buffer) > 4096:
                        # Truncate keeping the last 20 characters so we don't cut "answer" in half
                        buffer = buffer[-20:]
                    break

            elif state == "FIND_COLON":
                idx = buffer.find(':')
                if idx != -1:
                    buffer = buffer[idx + 1:]
                    state = "FIND_QUOTE"
                else:
                    break

            elif state == "FIND_QUOTE":
                # Find the opening quote of the answer string value (ignoring whitespace)
                lstrip_len = len(buffer) - len(buffer.lstrip())
                if lstrip_len > 0:
                    buffer = buffer[lstrip_len:]
                
                if buffer:
                    if buffer[0] == '"':
                        buffer = buffer[1:]
                        state = "STREAM_VALUE"
                    else:
                        # If it's not a quote, it might be invalid JSON or still loading.
                        # Wait for quote.
                        break
                else:
                    break

            elif state == "STREAM_VALUE":
                out_chars = []
                bytes_to_consume = 0
                for char in buffer:
                    if escaped:
                        if char == 'n':
                            out_chars.append('\n')
                        elif char == 't':
                            out_chars.append('\t')
                        elif char == 'r':
                            out_chars.append('\r')
                        else:
                            out_chars.append(char)
                        escaped = False
                        bytes_to_consume += 1
                    elif char == '\\':
                        escaped = True
                        bytes_to_consume += 1
                    elif char == '"':
                        state = "DONE"
                        bytes_to_consume += 1
                        break
                    else:
                        out_chars.append(char)
                        bytes_to_consume += 1

                if out_chars:
                    yield "".join(out_chars)

                buffer = buffer[bytes_to_consume:]
                if state == "DONE":
                    break

            elif state == "DONE":
                buffer = ""
                break


@router.post("/stream")
async def chat_stream(
    req: ChatRequest,
    request: Request,
    _: str = Depends(verify_service_key),
):
    """Stream AI response tokens via Server-Sent Events.

    Emits SSE data lines with JSON payloads:
    - {"token": "..."} — individual LLM output tokens
    - {"event": "answer_token", "token": "..."} — streaming answer tokens
    - {"intent": "..."} — detected intent (emitted once after routing)
    - {"metadata": {...}} — response metadata (model, tokens, latency)
    - {"done": true} — stream complete
    - {"error": "..."} — on failure

    OPTIMIZATION 4: Response caching - Checks cache before invoking agent pipeline.

    PRE-FLIGHT CHECK: Greetings and small talk bypass the entire pipeline.
    """
    # Initialize correlation context
    trace_id = req.trace_id or getattr(request.state, "trace_id", None) or str(uuid.uuid4())
    RequestContext.initialize(
        request_id=trace_id,
        user_id=req.user_id,
        space_id=req.space_id,
        space_name=req.space_name
    )

    logger.info("[%s] Stream request received | ctx=%s", trace_id, RequestContext.get())

    # ──────────────────────────────────────────────────────────────────────
    # RESPONSE CACHE CHECK (Optimization 4)
    # ──────────────────────────────────────────────────────────────────────
    from app.cache.response_cache import get_response_cache

    user_context = {
        "board_id": getattr(req, "board_id", None),
        "task_id": getattr(req, "task_id", None),
    }

    # Check cache (skip for greetings - they're already fast)
    is_greeting_msg, greeting_type = is_greeting(req.message)
    if not is_greeting_msg:
        cache = await get_response_cache()
        cached_response = await cache.get(
            query=req.message,
            space_id=req.space_id,
            user_context=user_context
        )
        if cached_response:
            logger.info("[%s] Cache HIT - returning cached response", trace_id)

            async def generate_cached():
                """Stream cached response token by token."""
                import asyncio
                response_text = cached_response.get("final_response", "")
                metadata = cached_response.get("response_metadata", {})

                # Stream tokens for natural effect
                for char in response_text:
                    yield f"data: {json.dumps({'event': 'answer_token', 'token': char})}\n\n"
                    await asyncio.sleep(0.005)

                # Send metadata
                metadata["trace_id"] = trace_id
                metadata["cached"] = True
                yield f"data: {json.dumps({'metadata': metadata})}\n\n"
                yield f"data: {json.dumps({'done': True})}\n\n"

            return StreamingResponse(
                generate_cached(),
                media_type="text/event-stream",
                headers={
                    "Cache-Control": "no-cache",
                    "Connection": "keep-alive",
                    "X-Accel-Buffering": "no",
                    "X-Trace-Id": trace_id,
                    "X-Cache-Hit": "true",
                },
            )

    # PRE-FLIGHT: Check for greetings and small talk (bypasses entire agent pipeline)
    if is_greeting_msg:
        logger.info("[%s] Pre-flight greeting detected (stream): %s", trace_id, greeting_type)
        response_text = get_greeting_response(greeting_type)

        async def generate_greeting():
            # Stream the greeting response token by token
            import asyncio
            for char in response_text:
                yield f"data: {json.dumps({'event': 'answer_token', 'token': char})}\n\n"
                await asyncio.sleep(0.01)  # Small delay for natural streaming effect
            yield f"data: {json.dumps({'metadata': {'trace_id': trace_id, 'intent': 'greeting', 'bypassed': True}})}\n\n"
            yield f"data: {json.dumps({'done': True})}\n\n"

        return StreamingResponse(
            generate_greeting(),
            media_type="text/event-stream",
            headers={
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
                "X-Accel-Buffering": "no",
                "X-Trace-Id": trace_id,
            },
        )

    # Validate required fields for tool execution
    if not req.space_id or req.space_id.strip() == "":
        logger.warning("[%s] STREAM request with missing/empty space_id: %r", trace_id, req.space_id)

    initial_state = {
        "raw_input": req.message,
        "space_id": req.space_id,
        "user_id": req.user_id,
        "user_name": req.user_name,
        "user_role": req.user_role,
        "space_name": req.space_name,
        "board_name": req.board_name,
        "trace_id": trace_id,
        "rewritten_query": "",
        "intent": "",
        "retrieved_context": [],
        "task_data": [],
        "final_response": "",
        "proposed_action": None,
        "approval_status": None,
        "response_metadata": {},
    }

    async def generate():
        """Yield SSE events as the LangGraph processes."""
        import asyncio
        start_time = time.time()
        token_queue = asyncio.Queue()
        initial_state["token_queue"] = token_queue

        # ──────────────────────────────────────────────────────────────────────
        # PROGRESSIVE STATUS UPDATES
        # ──────────────────────────────────────────────────────────────────────
        # Send initial status
        yield f"data: {json.dumps({'event': 'thinking', 'status': '🤔 Understanding your request...'})}\n\n"

        # Run the graph to completion in a background task
        graph_task = asyncio.create_task(agent_graph.ainvoke(initial_state))

        # Splitter and client event queues
        string_token_queue = asyncio.Queue()
        client_sse_queue = asyncio.Queue()

        # Splitter task: reads token_queue and separates statuses and tokens
        async def split_queue():
            try:
                while True:
                    if graph_task.done() and token_queue.empty():
                        break
                    try:
                        item = await asyncio.wait_for(token_queue.get(), timeout=0.05)
                        if isinstance(item, dict):
                            # Put status dict directly
                            await client_sse_queue.put(item)
                        else:
                            await string_token_queue.put(item)
                        token_queue.task_done()
                    except asyncio.TimeoutError:
                        if graph_task.done() and token_queue.empty():
                            break
                        continue
            finally:
                # Signal end of string tokens
                await string_token_queue.put(None)

        # Extractor task: reads string_token_queue and extracts actual answer tokens
        async def extract_and_forward():
            async def string_token_generator():
                while True:
                    token = await string_token_queue.get()
                    if token is None:
                        break
                    yield token
                    string_token_queue.task_done()
            try:
                async for answer_token in extract_answer_tokens(string_token_generator()):
                    await client_sse_queue.put({"type": "token", "content": answer_token})
            finally:
                # Signal end of SSE events
                await client_sse_queue.put(None)

        splitter_task = asyncio.create_task(split_queue())
        extractor_task = asyncio.create_task(extract_and_forward())

        tokens_streamed = False
        try:
            # Stream SSE events to client
            while True:
                item = await client_sse_queue.get()
                if item is None:
                    break

                if isinstance(item, dict):
                    if "event" in item:
                        if item.get("event") == "answer_token":
                            tokens_streamed = True
                        # Forward structured event directly (it has status or token keys for compatibility)
                        yield f"data: {json.dumps(item)}\n\n"
                    elif item.get("type") == "status":
                        yield f"data: {json.dumps({'event': 'thinking', 'status': item.get('message')})}\n\n"
                    elif item.get("type") == "token":
                        tokens_streamed = True
                        yield f"data: {json.dumps({'event': 'answer_token', 'token': item.get('content')})}\n\n"

                client_sse_queue.task_done()

            # Wait for background tasks to complete
            await splitter_task
            await extractor_task
            result = await graph_task

            response_metadata = result.get("response_metadata", {})
            response_metadata["trace_id"] = trace_id
            response_metadata["intent"] = result.get("intent", "chat")

            # Stream error directly if present in response_metadata (e.g. on all tools failure)
            if response_metadata.get("error"):
                logger.warning("[%s] Streaming aggregator error: %s", trace_id, response_metadata["error"])
                yield f"data: {json.dumps({'error': response_metadata['error']})}\n\n"
                return

            # If no tokens were streamed and we have a final response, stream it now
            final_response = result.get("final_response", "")
            if not tokens_streamed and final_response:
                for char in final_response:
                    yield f"data: {json.dumps({'event': 'answer_token', 'token': char})}\n\n"
                    await asyncio.sleep(0.005)

            # ──────────────────────────────────────────────────────────────────────
            # STORE IN CACHE (Optimization 4)
            # ──────────────────────────────────────────────────────────────────────
            # Only cache successful responses without errors
            if not response_metadata.get("error") and result.get("final_response"):
                try:
                    cache = await get_response_cache()
                    await cache.set(
                        query=req.message,
                        space_id=req.space_id,
                        user_context=user_context,
                        response={
                            "final_response": result.get("final_response"),
                            "response_metadata": response_metadata,
                            "proposed_action": result.get("proposed_action"),
                        },
                        ttl_seconds=3600  # 1 hour cache
                    )
                    logger.info("[%s] Response cached successfully", trace_id)
                except Exception as cache_exc:
                    logger.warning("[%s] Failed to cache response: %s", trace_id, cache_exc)

            # Send final structured metadata
            elapsed_ms = int((time.time() - start_time) * 1000)
            response_metadata["latency_ms"] = elapsed_ms
            yield f"data: {json.dumps({'metadata': response_metadata})}\n\n"
            yield f"data: {json.dumps({'done': True})}\n\n"

        except Exception as e:
            logger.error("[%s] Stream error: %s", trace_id, e)
            raw_err = str(e).lower()
            if "connection" in raw_err or "timeout" in raw_err or "unreachable" in raw_err:
                friendly_error = "Connection timeout or service is currently unreachable."
            elif "429" in raw_err or "rate" in raw_err or "too many" in raw_err or "busy" in raw_err:
                friendly_error = "AI service is temporarily busy. Please wait a moment and try again."
            elif "unauthorized" in raw_err or "forbidden" in raw_err or "denied" in raw_err:
                friendly_error = "Insufficient permission to access requested data."
            else:
                friendly_error = "An unexpected error occurred while processing the stream."
            yield f"data: {json.dumps({'error': friendly_error})}\n\n"
            if not graph_task.done():
                graph_task.cancel()

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",  # Disable nginx buffering
        },
    )

