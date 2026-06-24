"""Chat API route — processes user messages through the LangGraph pipeline."""
import uuid
import json
import logging
import time
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from app.api.middleware.auth import verify_service_key
from app.agents.graph import agent_graph

logger = logging.getLogger(__name__)
router = APIRouter()


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
    """
    trace_id = req.trace_id or getattr(request.state, "trace_id", None) or str(uuid.uuid4())

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
        logger.error("[%s] Agent pipeline error: %s", trace_id, exc, exc_info=True)
        raise HTTPException(status_code=500, detail="AI pipeline error. Please try again.")

    return ChatResponse(
        trace_id=result.get("trace_id", trace_id),
        intent=result.get("intent", "unknown"),
        response=result.get("final_response", ""),
        approval_status=result.get("approval_status"),
        metadata=result.get("response_metadata", {}),
    )


@router.post("/stream")
async def chat_stream(
    req: ChatRequest,
    request: Request,
    _: str = Depends(verify_service_key),
):
    """Stream AI response tokens via Server-Sent Events.

    Emits SSE data lines with JSON payloads:
    - {"token": "..."} — individual LLM output tokens
    - {"intent": "..."} — detected intent (emitted once after routing)
    - {"metadata": {...}} — response metadata (model, tokens, latency)
    - {"done": true} — stream complete
    - {"error": "..."} — on failure
    """
    trace_id = req.trace_id or getattr(request.state, "trace_id", None) or str(uuid.uuid4())

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

    # Only stream tokens from these final answering nodes — NOT from
    # query_rewriter or intent_router whose LLM output is internal.
    RESPONSE_NODES = {"chat_responder", "report_generator", "risk_detector", "recommendation"}

    async def generate():
        """Yield SSE events as the LangGraph processes."""
        start_time = time.time()
        first_token_time = None
        token_count = 0
        detected_intent = ""

        try:
            async for event in agent_graph.astream_events(initial_state, version="v2"):
                # Stream LLM tokens only from the final response-generating nodes
                if event["event"] == "on_chat_model_stream":
                    # Check which graph node this event belongs to
                    tags = event.get("tags") or []
                    run_name = event.get("name", "")
                    # astream_events v2 puts the node name in metadata.langgraph_node
                    node_name = (event.get("metadata") or {}).get("langgraph_node", "")

                    # Only yield tokens from the answering nodes
                    if node_name not in RESPONSE_NODES and not any(n in run_name for n in RESPONSE_NODES):
                        continue

                    chunk = event["data"].get("chunk")
                    if chunk and hasattr(chunk, "content") and chunk.content:
                        if first_token_time is None:
                            first_token_time = time.time()
                        token_count += 1
                        yield f"data: {json.dumps({'token': chunk.content})}\n\n"

                # Send metadata when intent_router completes
                elif event["event"] == "on_chain_end" and event.get("name") == "intent_router":
                    output = event.get("data", {}).get("output", {})
                    if isinstance(output, dict):
                        detected_intent = output.get("intent", "")
                        if detected_intent:
                            yield f"data: {json.dumps({'intent': detected_intent})}\n\n"

            # Send final metadata
            elapsed_ms = int((time.time() - start_time) * 1000)
            ttft_ms = int((first_token_time - start_time) * 1000) if first_token_time else None
            metadata = {
                "trace_id": trace_id,
                "intent": detected_intent,
                "tokens_out": token_count,
                "latency_ms": elapsed_ms,
                "ttft_ms": ttft_ms,
            }
            yield f"data: {json.dumps({'metadata': metadata})}\n\n"

            # Signal completion
            yield f"data: {json.dumps({'done': True})}\n\n"

        except Exception as e:
            logger.error("[%s] Stream error: %s", trace_id, e, exc_info=True)
            yield f"data: {json.dumps({'error': 'Something went wrong. Our team has been notified.'})}\n\n"

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",  # Disable nginx buffering
        },
    )

