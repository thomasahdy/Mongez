"""Risk Detector Node — fetches project data, retrieves relevant context, and analyses risk.

Flow:
  1. Fetch task data from NestJS /internal/ai/tasks/{spaceId}
  2. Retrieve semantically relevant comments/logs from Qdrant
  3. Build combined XML context + JSON task summary
  4. Call primary Groq model with risk_detector prompt
  5. Parse and validate the JSON risk assessment output
  6. Format into user-readable markdown response
"""
import json
import logging
from typing import Literal

from pydantic import BaseModel, Field

from app.agents.state import MongezAgentState

logger = logging.getLogger(__name__)


class RiskIssue(BaseModel):
    type: Literal["overdue", "blocked", "unassigned", "overload"]
    description: str
    severity: Literal["HIGH", "MEDIUM", "LOW"]


class RiskAssessment(BaseModel):
    """Strict schema for the LLM's JSON risk output."""
    risk: Literal["HIGH", "MEDIUM", "LOW"]
    reason: str = Field(max_length=400)
    confidence: float = Field(ge=0.0, le=1.0)
    issues: list[RiskIssue] = Field(default_factory=list)
    suggested_actions: list[str] = Field(default_factory=list, max_length=3)


def _build_task_summary(tasks: list[dict], limit: int = 30) -> str:
    """Serialise tasks into a compact JSON string for the prompt."""
    rows = []
    for t in tasks[:limit]:
        rows.append({
            "id": t.get("identifier") or t.get("id", ""),
            "title": t.get("title", ""),
            "status": t.get("status", ""),
            "priority": t.get("priority", ""),
            "dueDate": str(t.get("dueDate", "") or ""),
            "percentDone": t.get("percentDone", 0),
            "assignees": [
                a["user"]["name"]
                for a in t.get("assignments", [])
                if a.get("user")
            ],
        })
    return json.dumps(rows, indent=2, ensure_ascii=False)


async def risk_detector_node(state: MongezAgentState) -> dict:
    """Analyse project risk using task data + RAG context.

    Returns:
        {
            "final_response": str,          # User-readable markdown risk report
            "retrieved_context": list[dict],
            "task_data": list[dict],
            "response_metadata": dict,
        }
    """
    from app.dependencies import llm_client, prompt_loader, nestjs_client, retriever

    space_id = state["space_id"]
    query = state.get("rewritten_query") or state.get("raw_input", "")

    # 1. Fetch structured task data
    try:
        tasks = await nestjs_client.get_tasks(space_id)
    except Exception as exc:
        logger.error("Risk detector: failed to fetch tasks: %s", exc)
        tasks = []

    # 2. Retrieve relevant context from Qdrant
    context_results = await retriever.retrieve(query, space_id, top_k=5)
    xml_context = retriever.format_as_xml_context(context_results)

    # 3. Build prompt message
    task_summary = _build_task_summary(tasks)
    system_prompt = prompt_loader.load("risk_detector")
    user_message = (
        f"{xml_context}\n\n"
        f"<tasks>\n{task_summary}\n</tasks>\n\n"
        f"Analyse project risks. User query: {query}"
    )

    # 4. Call primary LLM
    result = await llm_client.invoke("primary", system_prompt, user_message)

    # 5. Parse and validate JSON output
    response_text: str
    try:
        assessment = RiskAssessment.model_validate_json(result["content"])
        risk_emoji = {"HIGH": "🔴", "MEDIUM": "🟡", "LOW": "🟢"}.get(assessment.risk, "⚪")
        lines = [
            f"## {risk_emoji} Risk Level: {assessment.risk} "
            f"(confidence: {assessment.confidence:.0%})\n",
            f"{assessment.reason}\n",
        ]
        if assessment.issues:
            lines.append("### Issues Found")
            for issue in assessment.issues:
                sev_emoji = {"HIGH": "🔴", "MEDIUM": "🟡", "LOW": "🟢"}.get(issue.severity, "")
                lines.append(f"- {sev_emoji} **{issue.type.replace('_', ' ').title()}**: {issue.description}")
        if assessment.suggested_actions:
            lines.append("\n### Suggested Actions")
            for action in assessment.suggested_actions:
                lines.append(f"- {action}")
        response_text = "\n".join(lines)
    except Exception as exc:
        logger.warning("Risk assessment JSON parse failed (%s), using raw response", exc)
        response_text = result["content"]

    return {
        "final_response": response_text,
        "retrieved_context": context_results,
        "task_data": tasks[:30],
        "response_metadata": {
            **state.get("response_metadata", {}),
            "agent": "risk_detector",
            "model": result["model"],
            "tokens_in": result["tokens_in"],
            "tokens_out": result["tokens_out"],
            "latency_ms": result["latency_ms"],
        },
    }
