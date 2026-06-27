"""Intent Router Node — classifies the user's intent.

Routes to one of seven agent paths:
  greeting → Simple greeting or small talk (bypass tools)
  planner  → Project Planner (batch task creation and distribution)
  risk     → Risk Detector (blocked tasks, overdue, team overload)
  report   → Report Generator (structured markdown reports)
  calendar → Calendar/Meetings (meeting summaries, schedules)
  action   → Mutation Actions (propose task update, reassign, etc.)
  chat     → General Copilot Chat (grounded conversation)
"""
import logging
from app.agents.state import MongezAgentState

logger = logging.getLogger(__name__)

VALID_INTENTS = {"greeting", "planner", "risk", "report", "calendar", "action", "chat"}

# Rules mapping keywords to intents
RULE_KEYWORDS = [
    # Project Planner
    (["build", "plan", "create a project", "create a crm", "break this into tasks", "break down"], "planner"),
    # Risks and blockers
    (["blocked", "delay", "risk", "release", "overload", "workload", "stuck", "over-capacity"], "risk"),
    # Report generation
    (["report", "summary", "summarize", "weekly status"], "report"),
    # Calendar & Meetings
    (["meeting", "transcript", "call", "schedule", "events", "calendar"], "calendar"),
    # Mutation actions
    (["assign", "reassign", "update", "create task", "reminder", "notify", "escalate"], "action"),
]

# Greeting responses that bypass tools entirely
GREETING_PATTERNS = {
    "hi", "hello", "hey", "greetings", "good morning", "good afternoon",
    "good evening", "thanks", "thank you", "thx", "appreciate it",
    "bye", "goodbye", "ok", "okay", "sure", "alright",
    "سلام", "مرحبا", "أهلا", "اهلا", "مرحبا بك", "السلام عليكم", "شكرا", "شكرا لك"
}

_SYSTEM = """Classify this user query into exactly ONE category.

Categories:
- greeting: Simple greetings, thanks, goodbyes (hi, hello, thanks, bye, ok, سلام, شكرا)
- planner: Requests to plan a project, break down ideas, generate milestones and assign tasks
- risk: Questions about project risks, delays, blocked tasks, overdue items, team overload
- chat: General questions about project status, tasks, or conversational questions/small talk (e.g. asking who you are, language preferences, how you are doing)
- report: Requests to generate reports, summaries, weekly updates, or analytics
- action: Requests to DO something (assign task, escalate, create reminder, update status)
- calendar: Questions about calendars, scheduling, meetings, conflicts, or workload warnings

Reply with ONLY the category word (greeting/planner/risk/chat/report/action/calendar). No explanation."""


async def intent_router_node(state: MongezAgentState) -> dict:
    """Classify user intent and route to the correct agent node.

    Uses rule-based heuristics first to minimize latency (<5ms).
    Falls back to the fast LLM tier if keywords are ambiguous.
    """
    from app.dependencies import llm_client

    query = (state.get("rewritten_query") or state.get("raw_input") or "").strip()
    if not query:
        return {"intent": "greeting", "response_metadata": {}}

    query_lower = query.lower()

    # 1. Fast Path: Greetings/Thanks bypass
    for pattern in GREETING_PATTERNS:
        if query_lower == pattern or query_lower.startswith(pattern + " ") or query_lower.endswith(" " + pattern):
            logger.info("Greeting/Thanks detected via rule-based check: %r → greeting", query[:60])
            return {
                "intent": "greeting",
                "response_metadata": {"intent_latency_ms": 0, "routing_mode": "rules"}
            }

    # 2. Fast Path: Keyword-based routing rules
    for keywords, target_intent in RULE_KEYWORDS:
        if any(kw in query_lower for kw in keywords):
            logger.info("Intent classified via keywords rule-based check: %r → %s", query[:60], target_intent)
            return {
                "intent": target_intent,
                "response_metadata": {"intent_latency_ms": 0, "routing_mode": "rules"}
            }

    # 3. Fallback: Fast LLM routing
    token_queue = state.get("token_queue")
    if token_queue:
        try:
            await token_queue.put({"event": "thinking", "status": "Determining best execution path..."})
        except Exception:
            pass

    try:
        result = await llm_client.invoke("fast", _SYSTEM, query)
        intent = result["content"].strip().lower().rstrip(".\n ,")

        if intent not in VALID_INTENTS:
            logger.warning("Intent router got unexpected value %r, defaulting to chat", intent)
            intent = "chat"

        logger.info("Intent classified via LLM: %r → %s (%dms)", query[:60], intent, result["latency_ms"])

        return {
            "intent": intent,
            "response_metadata": {
                "intent_model": result["model"],
                "intent_latency_ms": result["latency_ms"],
                "routing_mode": "llm",
            },
        }
    except Exception as exc:
        logger.error("Intent router failed: %s — defaulting to chat", exc)
        return {"intent": "chat", "response_metadata": {"intent_error": str(exc), "routing_mode": "error"}}
