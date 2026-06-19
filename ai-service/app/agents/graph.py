"""LangGraph agent pipeline — wires all nodes into a compiled StateGraph.

Graph topology:
  query_rewriter → intent_router
  intent_router  →[conditional]→ risk_detector | chat_responder | report_generator | recommendation
  risk_detector  → END
  chat_responder → END
  report_generator → END
  recommendation → human_gate → END
"""
import logging
from langgraph.graph import StateGraph, END
from app.agents.state import MongezAgentState
from app.agents.nodes.query_rewriter import query_rewriter_node
from app.agents.nodes.intent_router import intent_router_node
from app.agents.nodes.risk_detector import risk_detector_node
from app.agents.nodes.chat_responder import chat_responder_node
from app.agents.nodes.report_generator import report_generator_node
from app.agents.nodes.recommendation import recommendation_node
from app.agents.nodes.human_gate import human_gate_node

logger = logging.getLogger(__name__)


def _route_by_intent(state: MongezAgentState) -> str:
    """Conditional edge function — routes to the correct agent node."""
    intent = state.get("intent", "chat")
    if intent in ("risk", "chat", "report", "action"):
        return intent
    logger.warning("Unexpected intent %r, routing to chat", intent)
    return "chat"


def build_graph() -> StateGraph:
    """Build and compile the Mongez LangGraph agent pipeline."""
    graph = StateGraph(MongezAgentState)

    # ── Register nodes ────────────────────────────────────────────────────────
    graph.add_node("query_rewriter", query_rewriter_node)
    graph.add_node("intent_router", intent_router_node)
    graph.add_node("risk_detector", risk_detector_node)
    graph.add_node("chat_responder", chat_responder_node)
    graph.add_node("report_generator", report_generator_node)
    graph.add_node("recommendation", recommendation_node)
    graph.add_node("human_gate", human_gate_node)

    # ── Define edges ──────────────────────────────────────────────────────────
    graph.set_entry_point("query_rewriter")
    graph.add_edge("query_rewriter", "intent_router")

    # Conditional routing from intent_router
    graph.add_conditional_edges(
        "intent_router",
        _route_by_intent,
        {
            "risk": "risk_detector",
            "chat": "chat_responder",
            "report": "report_generator",
            "action": "recommendation",
        },
    )

    # Terminal edges for content agents
    graph.add_edge("risk_detector", END)
    graph.add_edge("chat_responder", END)
    graph.add_edge("report_generator", END)

    # Action path: recommendation → human review → END
    graph.add_edge("recommendation", "human_gate")
    graph.add_edge("human_gate", END)

    compiled = graph.compile()
    logger.info("LangGraph agent pipeline compiled successfully")
    return compiled


# Module-level compiled graph — imported by API route handlers
agent_graph = build_graph()
