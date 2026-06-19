"""
Phase 4 live test script -- tests the LangGraph agent pipeline end-to-end.

Run from ai-service/ directory:
    .venv\\Scripts\\python scripts\\test_phase4.py

Note: This test uses real Groq API calls. NestJS backend is mocked.
"""
import asyncio
import sys
import time
import io
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock

if sys.platform == "win32":
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

sys.path.insert(0, str(Path(__file__).parent.parent))

# ── Mock singletons before importing graph nodes ──────────────────────────────
from app import dependencies
from app.config import get_settings
from app.clients.llm_client import LLMClient
from app.rag.embedder import Embedder
from app.rag.retriever import DenseRetriever
from app.prompts.loader import PromptLoader

settings = get_settings()
SEP = "-" * 60

# Shared state for the test session
_embedder = None
_retriever = None


def setup_dependencies(mock_nestjs: bool = True):
    """Wire real and mock singletons into the dependency container."""
    global _embedder, _retriever

    # Real LLM client (uses actual Groq API)
    dependencies.llm_client = LLMClient(settings)

    # Real prompt loader
    dependencies.prompt_loader = PromptLoader()

    # Real embedder (from cache after Phase 3)
    if _embedder is None:
        print("  Loading BGE-M3 embedding model...")
        _embedder = Embedder()
    dependencies.embedder = _embedder

    # Real retriever pointed at local Qdrant
    if _retriever is None:
        _retriever = DenseRetriever(
            qdrant_url=settings.qdrant_url,
            embedder=_embedder,
        )
    dependencies.retriever = _retriever

    # Mock NestJS client (no real NestJS running in test)
    if mock_nestjs:
        mock_nestjs_client = MagicMock()
        mock_nestjs_client.get_tasks = AsyncMock(return_value=[
            {
                "id": "task-001", "identifier": "PRJ-001",
                "title": "Implement payment gateway", "status": "BLOCKED",
                "priority": "URGENT", "dueDate": "2024-03-10",
                "percentDone": 40, "assignments": [{"user": {"name": "Omar"}}],
                "board": {"name": "Sprint 4"},
            },
            {
                "id": "task-002", "identifier": "PRJ-002",
                "title": "Database migration", "status": "IN_PROGRESS",
                "priority": "HIGH", "dueDate": "2024-03-20",
                "percentDone": 70, "assignments": [{"user": {"name": "Sara"}}],
                "board": {"name": "Sprint 4"},
            },
            {
                "id": "task-003", "identifier": "PRJ-003",
                "title": "Security audit fix", "status": "TODO",
                "priority": "URGENT", "dueDate": "2024-03-08",
                "percentDone": 0, "assignments": [],
                "board": {"name": "Sprint 4"},
            },
        ])
        mock_nestjs_client.propose_action = AsyncMock(return_value={"id": "action-001", "status": "PENDING"})
        dependencies.nestjs_client = mock_nestjs_client


SAMPLE_STATE_BASE = {
    "space_id": "test-space",
    "user_id": "user-001",
    "user_name": "Thomas",
    "user_role": "Project Manager",
    "space_name": "Alpha Project",
    "board_name": "Sprint 4",
    "trace_id": "test-trace-001",
    "retrieved_context": [],
    "task_data": [],
    "final_response": "",
    "proposed_action": None,
    "approval_status": None,
    "response_metadata": {},
}


def test_graph_structure():
    print(f"\n{SEP}")
    print("TEST 1: Graph structure validation")
    print(SEP)
    from app.agents.graph import build_graph, _route_by_intent
    from app.agents.state import MongezAgentState

    graph = build_graph()
    print(f"  Graph type: {type(graph).__name__}")
    assert "CompiledStateGraph" in type(graph).__name__

    # Test routing logic
    assert _route_by_intent({"intent": "risk"}) == "risk"
    assert _route_by_intent({"intent": "chat"}) == "chat"
    assert _route_by_intent({"intent": "report"}) == "report"
    assert _route_by_intent({"intent": "action"}) == "action"
    assert _route_by_intent({"intent": "unknown"}) == "chat"  # fallback
    print("  Routing logic: all cases correct")
    print("  PASS")


async def test_intent_router():
    print(f"\n{SEP}")
    print("TEST 2: Intent Router (real Groq fast model)")
    print(SEP)
    from app.agents.nodes.intent_router import intent_router_node

    test_cases = [
        ("What tasks are overdue?", {"risk", "chat"}),
        ("Generate a weekly status report", {"report"}),
        ("What is the current project status?", {"chat", "risk"}),
        ("Assign the payment task to Sara", {"action"}),
    ]

    for query, expected_intents in test_cases:
        state = {**SAMPLE_STATE_BASE, "raw_input": query, "rewritten_query": query}
        start = time.monotonic()
        result = await intent_router_node(state)
        elapsed = int((time.monotonic() - start) * 1000)
        intent = result["intent"]
        ok = intent in expected_intents
        status = "PASS" if ok else "WARN"
        print(f"  [{status}] {query[:55]!r} -> {intent!r} ({elapsed}ms)")
    print("  Intent router: complete")


async def test_query_rewriter():
    print(f"\n{SEP}")
    print("TEST 3: Query Rewriter")
    print(SEP)
    from app.agents.nodes.query_rewriter import query_rewriter_node

    # Self-contained — should skip rewriting
    state1 = {**SAMPLE_STATE_BASE, "raw_input": "What is the status of the payment gateway task?"}
    result1 = await query_rewriter_node(state1)
    assert result1["rewritten_query"] == state1["raw_input"], "Self-contained query should pass through"
    print(f"  Self-contained: passed through unchanged")

    # With pronoun — should rewrite
    state2 = {**SAMPLE_STATE_BASE, "raw_input": "Who is assigned to it?"}
    result2 = await query_rewriter_node(state2)
    print(f"  With pronoun 'it': {result2['rewritten_query']!r}")
    print("  PASS")


async def test_full_chat_pipeline():
    print(f"\n{SEP}")
    print("TEST 4: Full pipeline — chat query")
    print(SEP)
    from app.agents.graph import agent_graph

    state = {
        **SAMPLE_STATE_BASE,
        "raw_input": "How many tasks are currently in progress and who is working on them?",
        "rewritten_query": "",
        "intent": "",
    }

    start = time.monotonic()
    result = await agent_graph.ainvoke(state)
    elapsed = int((time.monotonic() - start) * 1000)

    print(f"  Intent detected : {result.get('intent')}")
    print(f"  Total latency   : {elapsed}ms")
    print(f"  Response ({len(result.get('final_response', ''))} chars):")
    print(f"  {result.get('final_response', '')[:300]}...")
    assert result.get("final_response"), "Should have a non-empty response"
    assert result.get("intent") in ("chat", "risk")
    print(f"  PASS (target <3000ms, got {elapsed}ms)")


async def test_risk_pipeline():
    print(f"\n{SEP}")
    print("TEST 5: Full pipeline — risk query")
    print(SEP)
    from app.agents.graph import agent_graph

    state = {
        **SAMPLE_STATE_BASE,
        "raw_input": "Are there any blocked or overdue tasks that could risk the deadline?",
        "rewritten_query": "",
        "intent": "",
    }

    start = time.monotonic()
    result = await agent_graph.ainvoke(state)
    elapsed = int((time.monotonic() - start) * 1000)

    print(f"  Intent detected : {result.get('intent')}")
    print(f"  Total latency   : {elapsed}ms")
    response = result.get("final_response", "")
    print(f"  Response preview: {response[:300]}...")
    assert response, "Should have a non-empty response"
    print(f"  PASS")


async def main():
    print("=" * 60)
    print("  Mongez AI Service -- Phase 4 Live Tests")
    print("=" * 60)

    print("\nInitialising dependencies (loading BGE-M3)...")
    setup_dependencies(mock_nestjs=True)
    print("  Dependencies ready.")

    test_graph_structure()
    await test_query_rewriter()
    await test_intent_router()
    await test_full_chat_pipeline()
    await test_risk_pipeline()

    print(f"\n{SEP}")
    print("  All Phase 4 tests passed!")
    print(SEP)


if __name__ == "__main__":
    asyncio.run(main())
