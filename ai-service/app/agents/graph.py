import logging
from langgraph.graph import StateGraph, END
from app.agents.state import MongezAgentState
from app.agents.nodes.intent_router import intent_router_node
from app.agents.nodes.executor import executor_node
from app.agents.nodes.aggregator import aggregator_node

logger = logging.getLogger(__name__)


def build_graph() -> StateGraph:
    """Build and compile the simplified Mongez AI pipeline."""
    graph = StateGraph(MongezAgentState)

    # ── Register nodes ────────────────────────────────────────────────────────
    graph.add_node("intent_router", intent_router_node)
    graph.add_node("executor", executor_node)
    graph.add_node("aggregator", aggregator_node)

    # ── Define edges ──────────────────────────────────────────────────────────
    graph.set_entry_point("intent_router")
    graph.add_edge("intent_router", "executor")
    graph.add_edge("executor", "aggregator")
    graph.add_edge("aggregator", END)

    compiled = graph.compile()
    logger.info("Simplified LangGraph agent pipeline compiled successfully")
    return compiled


# Compiled graph singleton — imported by FastAPI routes
agent_graph = build_graph()
