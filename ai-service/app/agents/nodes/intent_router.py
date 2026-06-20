"""Intent Router Node — classifies the user's intent using the fast Groq model.

Routes to one of four agent paths:
  risk   → Risk Detector (blocked tasks, overdue, team overload)
  chat   → Chat Responder (general questions about project state)
  report → Report Generator (structured markdown reports)
  action → Recommendation + Human Gate (proposed CQRS commands)
"""
import logging
from app.agents.state import MongezAgentState

logger = logging.getLogger(__name__)

VALID_INTENTS = {"risk", "chat", "report", "action", "calendar"}

# Inline prompt — kept here rather than a .txt file because it's routing logic,
# not a user-facing generation. The system prompt is very short and deterministic.
_SYSTEM = """Classify this user query into exactly ONE category.

Categories:
- risk: Questions about project risks, delays, blocked tasks, overdue items, team overload
- chat: General questions about project status, task details, assignments, team info
- report: Requests to generate reports, summaries, weekly updates, or analytics
- action: Requests to DO something (assign task, escalate, create reminder, update status)
- calendar: Questions about calendars, scheduling, meetings, conflicts, public holidays, or workload warnings

Reply with ONLY the category word (risk/chat/report/action/calendar). No explanation."""


async def intent_router_node(state: MongezAgentState) -> dict:
    """Classify user intent and route to the correct agent node.

    Uses the fast model (llama-3.1-8b-instant) for low latency (<200ms target).

    Returns:
        {
            "intent": "risk" | "chat" | "report" | "action",
            "response_metadata": {"intent_model": ..., "intent_latency_ms": ...}
        }
    """
    from app.dependencies import llm_client

    query = (state.get("rewritten_query") or state.get("raw_input") or "").strip()
    if not query:
        return {"intent": "chat", "response_metadata": {}}

    try:
        result = await llm_client.invoke("fast", _SYSTEM, query)
        intent = result["content"].strip().lower()

        # Strip punctuation that might appear (e.g. "risk." or "chat\n")
        intent = intent.rstrip(".\n ,")

        if intent not in VALID_INTENTS:
            logger.warning("Intent router got unexpected value %r, defaulting to chat", intent)
            intent = "chat"

        logger.info("Intent classified: %r → %s (%dms)", query[:60], intent, result["latency_ms"])

        return {
            "intent": intent,
            "response_metadata": {
                "intent_model": result["model"],
                "intent_latency_ms": result["latency_ms"],
            },
        }
    except Exception as exc:
        logger.error("Intent router failed: %s — defaulting to chat", exc)
        return {"intent": "chat", "response_metadata": {"intent_error": str(exc)}}
