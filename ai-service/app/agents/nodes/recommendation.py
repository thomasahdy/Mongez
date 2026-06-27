"""Recommendation Node — proposes a concrete action based on project state.

The AI NEVER executes actions. It produces a structured JSON proposal
passed to human_gate. The user approves/rejects via the NestJS frontend.
"""
import json
import logging
from app.agents.state import MongezAgentState

logger = logging.getLogger(__name__)

_SYSTEM = """You are a project management AI for Mongez.
Based on the project data, suggest ONE concrete action to improve the project.

Output valid JSON with this exact schema:
{
  "command_type": "AssignTask" | "EscalateTask" | "CreateReminder" | "UpdateTask",
  "payload": {"taskId": "<id>"},
  "reason": "<one sentence why>"
}

If no action is needed: {"command_type": null, "payload": {}, "reason": "No action needed."}
Output ONLY the JSON. No other text."""


async def recommendation_node(state: MongezAgentState) -> dict:
    """Generate a proposed action recommendation.

    Returns:
        {"proposed_action": dict | None, "final_response"?: str}
    """
    from app.dependencies import llm_client, nestjs_client
    from app.dependencies import get_retriever

    retriever = get_retriever()

    space_id = state["space_id"]
    query = state.get("rewritten_query") or state.get("raw_input", "")

    context_results = await retriever.retrieve(query, space_id, top_k=3)
    xml_context = retriever.format_as_xml_context(context_results)

    try:
        tasks = await nestjs_client.get_tasks(space_id)
    except Exception as exc:
        logger.error("Recommendation: failed to fetch tasks: %s", exc)
        tasks = []

    task_snippet = json.dumps(
        [
            {
                "id": t.get("identifier") or t.get("id"),
                "title": t.get("title"),
                "status": t.get("status"),
                "priority": t.get("priority"),
                "dueDate": str(t.get("dueDate") or ""),
                "assignees": [a["user"]["name"] for a in t.get("assignments", []) if a.get("user")],
            }
            for t in tasks[:15]
        ],
        indent=2,
        ensure_ascii=False,
    )

    user_message = (
        f"{xml_context}\n\n"
        f"<tasks>\n{task_snippet}\n</tasks>\n\n"
        f"User request: {query}"
    )

    result = await llm_client.invoke("primary", _SYSTEM, user_message)

    try:
        action = json.loads(result["content"], strict=False)
    except (json.JSONDecodeError, ValueError) as exc:
        logger.warning("Recommendation JSON parse failed: %s", exc)
        return {
            "final_response": "I couldn't formulate a specific action. Could you be more specific?",
            "proposed_action": None,
        }

    meta = {
        **state.get("response_metadata", {}),
        "agent": "recommendation",
        "model": result["model"],
        "latency_ms": result["latency_ms"],
    }

    if not action.get("command_type"):
        return {
            "final_response": action.get("reason", "No specific action needed at this time."),
            "proposed_action": None,
            "response_metadata": meta,
        }

    logger.info("Recommendation: proposed %s", action.get("command_type"))
    return {
        "proposed_action": action,
        "response_metadata": meta,
    }
