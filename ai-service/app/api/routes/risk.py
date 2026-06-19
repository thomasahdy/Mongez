"""Risk analysis API route — forces intent=risk regardless of query content."""
import uuid
import logging
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field

from app.api.middleware.auth import verify_service_key
from app.agents.graph import agent_graph

logger = logging.getLogger(__name__)
router = APIRouter()


class RiskRequest(BaseModel):
    space_id: str
    user_id: str
    user_name: str = "User"
    user_role: str = "Member"
    space_name: str = "My Space"
    board_name: str = "All Boards"
    query: str = Field(default="Analyse all risks in this project", max_length=1000)
    trace_id: str | None = None


class RiskResponse(BaseModel):
    trace_id: str
    risk_level: str | None = None
    response: str
    metadata: dict = {}


@router.post("", response_model=RiskResponse)
async def analyze_risk(
    req: RiskRequest,
    request: Request,
    _: str = Depends(verify_service_key),
):
    """Run the risk detector agent directly for a space.

    Bypasses intent routing — always invokes the risk_detector node.
    Used by the NestJS scheduled risk scan job.
    """
    trace_id = req.trace_id or getattr(request.state, "trace_id", None) or str(uuid.uuid4())

    # Pre-set intent to "risk" to bypass the router
    initial_state = {
        "raw_input": req.query,
        "rewritten_query": req.query,  # Skip rewriting for direct risk calls
        "intent": "risk",              # Force direct routing
        "space_id": req.space_id,
        "user_id": req.user_id,
        "user_name": req.user_name,
        "user_role": req.user_role,
        "space_name": req.space_name,
        "board_name": req.board_name,
        "trace_id": trace_id,
        "retrieved_context": [],
        "task_data": [],
        "final_response": "",
        "proposed_action": None,
        "approval_status": None,
        "response_metadata": {},
    }

    try:
        # Jump directly to risk_detector node
        from app.agents.nodes.risk_detector import risk_detector_node
        result_delta = await risk_detector_node(initial_state)
        result = {**initial_state, **result_delta}
    except Exception as exc:
        logger.error("[%s] Risk analysis error: %s", trace_id, exc, exc_info=True)
        raise HTTPException(status_code=500, detail="Risk analysis failed.")

    # Extract risk level from the formatted markdown if present
    response_text = result.get("final_response", "")
    risk_level = None
    for level in ("HIGH", "MEDIUM", "LOW"):
        if f"Risk Level: {level}" in response_text:
            risk_level = level
            break

    return RiskResponse(
        trace_id=trace_id,
        risk_level=risk_level,
        response=response_text,
        metadata=result.get("response_metadata", {}),
    )
