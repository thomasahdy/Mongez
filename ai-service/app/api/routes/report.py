"""Report generation API route — forces intent=report."""
import uuid
import logging
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field

from app.api.middleware.auth import verify_service_key

logger = logging.getLogger(__name__)
router = APIRouter()


class ReportRequest(BaseModel):
    space_id: str
    user_id: str
    user_name: str = "User"
    user_role: str = "Member"
    space_name: str = "My Space"
    board_name: str = "All Boards"
    query: str = Field(default="Generate a project status report", max_length=1000)
    trace_id: str | None = None


class ReportResponse(BaseModel):
    trace_id: str
    report: str
    metadata: dict = {}


@router.post("", response_model=ReportResponse)
async def generate_report(
    req: ReportRequest,
    request: Request,
    _: str = Depends(verify_service_key),
):
    """Generate a project report directly via the report_generator node."""
    trace_id = req.trace_id or getattr(request.state, "trace_id", None) or str(uuid.uuid4())

    initial_state = {
        "raw_input": req.query,
        "rewritten_query": req.query,
        "intent": "report",
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
        from app.agents.nodes.report_generator import report_generator_node
        result_delta = await report_generator_node(initial_state)
        result = {**initial_state, **result_delta}
    except Exception as exc:
        logger.error("[%s] Report generation error: %s", trace_id, exc, exc_info=True)
        raise HTTPException(status_code=500, detail="Report generation failed.")

    return ReportResponse(
        trace_id=trace_id,
        report=result.get("final_response", ""),
        metadata=result.get("response_metadata", {}),
    )
