"""MongezAgentState — the single shared state that flows through the LangGraph pipeline.

Every node reads from and writes to this TypedDict.
LangGraph merges the returned dict into the running state automatically,
so nodes only need to return the keys they change.
"""
from typing import TypedDict, Literal, Any


class MongezAgentState(TypedDict, total=False):
    """State that flows through the Mongez LangGraph pipeline.

    Fields are marked total=False so nodes can return partial updates
    without providing every key. Required fields are documented below.
    """
    token_queue: Any                # asyncio.Queue for streaming tokens in real-time

    # ── Session Context (set once by the API layer) ────────────────────────────
    user_id: str           # Who is asking (for audit logging)
    space_id: str          # Tenant isolation key — every DB/Qdrant query is scoped to this
    user_name: str         # Display name for personalised prompts
    user_role: str         # PM, Member, Admin — affects tone and detail level
    space_name: str        # Space name injected into chat_assistant prompt
    board_name: str        # Current board name (or "All Boards")
    trace_id: str          # UUID for end-to-end tracing across NestJS ↔ Python

    # ── Input Processing ────────────────────────────────────────────────────────
    raw_input: str         # Original user message — never mutated after entry
    rewritten_query: str   # After query_rewriter (or same as raw_input if self-contained)
    intent: str            # 'risk' | 'chat' | 'report' | 'action'

    # ── Retrieved Context ───────────────────────────────────────────────────────
    retrieved_context: list[dict]   # RAG results from Qdrant (scored chunks)
    task_data: list[dict]           # Structured tasks from NestJS internal API

    # ── Agent Output ────────────────────────────────────────────────────────────
    final_response: str             # The response shown to the user

    # ── Human-in-the-Loop ──────────────────────────────────────────────────────
    proposed_action: dict | None    # If intent=action, the proposed command
    approval_status: str | None     # 'pending' | 'approved' | 'rejected' | None

    # ── Planner & Reflection State Machine ──────────────────────────────────────
    plan: list[str]                 # Execution steps remaining in plan
    executed_tools: list[str]       # History of executed tools
    tool_results: list[dict]        # Collected outputs of tool executions
    reflection: str                 # Self-reflection notes / gap analysis
    iterations: int                 # Count of execution steps run
    remaining_budget: float         # Remaining cost budget for this query

    # ── Metadata (for logging and evaluation) ──────────────────────────────────
    response_metadata: dict         # model, tokens_in, tokens_out, latency_ms, agent
    confidence: float               # Evaluated response confidence (0.0 to 1.0)

