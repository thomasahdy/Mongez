"""Executor Node — runs required tools in parallel for the detected intent."""
import asyncio
import logging
from app.agents.state import MongezAgentState
from app.agents.scheduler import run_single_tool

logger = logging.getLogger(__name__)


async def executor_node(state: MongezAgentState) -> dict:
    """Parallel Executor Node — executes relevant tools concurrently based on detected intent."""
    intent = state.get("intent", "chat")
    space_id = state.get("space_id", "")
    query = state.get("rewritten_query") or state.get("raw_input", "")

    if intent == "greeting":
        logger.info("Executor node: greeting intent, skipping tools.")
        return {"tool_results": [], "executed_tools": []}

    # Map intent and query keywords to tool definitions (tool_name, arguments)
    tool_calls = []
    query_lower = query.lower()

    if intent == "planner":
        # First phase of project planner: get available users
        tool_calls.append(("search_users", {}))
    elif intent == "risk":
        # Determine specific risk query subtype to run minimum required tools
        if "overload" in query_lower or "workload" in query_lower or "capacity" in query_lower:
            tool_calls.append(("search_users", {}))
            tool_calls.append(("search_analytics", {}))
        else:
            tool_calls.append(("search_tasks", {"query": query}))
            tool_calls.append(("get_blocker_chain", {}))
            tool_calls.append(("search_users", {}))
    elif intent == "report":
        tool_calls.append(("search_tasks", {"query": query}))
        tool_calls.append(("search_analytics", {}))
    elif intent == "calendar":
        tool_calls.append(("search_calendar", {}))
        tool_calls.append(("search_meetings", {"query": query}))
    elif intent == "action":
        tool_calls.append(("search_tasks", {"query": query}))
        tool_calls.append(("search_users", {}))
    elif intent == "chat":
        # Check if the chat query is about workload or overloaded users
        if "overload" in query_lower or "workload" in query_lower or "capacity" in query_lower:
            tool_calls.append(("search_users", {}))
            tool_calls.append(("search_analytics", {}))
        else:
            tool_calls.append(("search_tasks", {"query": query}))

    if not tool_calls:
        logger.info("No tool calls defined for intent %s", intent)
        return {"tool_results": [], "executed_tools": []}

    logger.info("Executor node running tools in parallel for intent '%s': %s", intent, [t[0] for t in tool_calls])

    # Run in parallel using asyncio.gather
    tasks = [run_single_tool(name, args, state) for name, args in tool_calls]
    results = await asyncio.gather(*tasks, return_exceptions=True)

    tool_results = []
    executed_tools = []

    for (name, args), res in zip(tool_calls, results):
        if isinstance(res, Exception):
            logger.error("Tool %s failed during parallel execution: %s", name, res)
            tool_results.append({
                "tool": name,
                "status": "failed",
                "content": f"Execution error: {str(res)}",
                "error_type": "EXCEPTION"
            })
        else:
            tool_results.append(res)
        executed_tools.append(name)

    # If chat intent, also fetch retrieved_context in parallel
    retrieved_context = []
    if intent == "chat":
        try:
            from app.dependencies import get_retriever
            retriever = get_retriever()
            logger.info("Running dense RAG retrieval for chat query: %r", query[:60])
            context_results = await retriever.retrieve(query, space_id, top_k=5)
            retrieved_context = context_results
        except Exception as exc:
            logger.error("RAG retrieval failed in executor: %s", exc)

    return {
        "tool_results": tool_results,
        "executed_tools": executed_tools,
        "retrieved_context": retrieved_context,
    }
