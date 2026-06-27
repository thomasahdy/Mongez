"""Report Generator Node — produces a structured markdown project report.

Flow:
  1. Retrieve relevant context from Qdrant
  2. Fetch task data from NestJS
  3. Call primary Groq model with report_generator prompt
  4. Return formatted markdown report
"""
import json
import logging
from app.agents.state import MongezAgentState

logger = logging.getLogger(__name__)


def _build_full_task_summary(tasks: list[dict], limit: int = 50) -> str:
    """Richer task serialisation for reports — includes more fields."""
    rows = []
    for t in tasks[:limit]:
        rows.append({
            "id": t.get("identifier") or t.get("id", ""),
            "title": t.get("title", ""),
            "status": t.get("status", ""),
            "priority": t.get("priority", ""),
            "dueDate": str(t.get("dueDate", "") or ""),
            "startDate": str(t.get("startDate", "") or ""),
            "estimatedHours": t.get("estimatedHours"),
            "percentDone": t.get("percentDone", 0),
            "board": (t.get("board") or {}).get("name", ""),
            "commentCount": (t.get("_count") or {}).get("comments", 0),
            "assignees": [
                a["user"]["name"]
                for a in t.get("assignments", [])
                if a.get("user")
            ],
        })
    return json.dumps(rows, indent=2, ensure_ascii=False)


async def report_generator_node(state: MongezAgentState) -> dict:
    """Generate a structured project health report in markdown.

    Returns:
        {
            "final_response": str,          # Markdown report
            "retrieved_context": list[dict],
            "task_data": list[dict],
            "response_metadata": dict,
        }
    """
    from app.dependencies import llm_client, nestjs_client
    from app.dependencies import get_retriever, get_prompt_loader

    retriever = get_retriever()
    prompt_loader = get_prompt_loader()

    space_id = state["space_id"]
    query = state.get("rewritten_query") or state.get("raw_input", "")

    # 1. RAG context
    context_results = await retriever.retrieve(query, space_id, top_k=5)
    xml_context = retriever.format_as_xml_context(context_results)

    # 2. Full task data (more rows for reports)
    try:
        tasks = await nestjs_client.get_tasks(space_id)
    except Exception as exc:
        logger.error("Report generator: failed to fetch tasks: %s", exc)
        tasks = []

    task_summary = _build_full_task_summary(tasks)

    # 3. Report prompt
    system_prompt = prompt_loader.load("report_generator")
    user_message = (
        f"{xml_context}\n\n"
        f"<tasks>\n{task_summary}\n</tasks>\n\n"
        f"Space: {state.get('space_name', 'Unknown')}\n"
        f"Requested by: {state.get('user_name', 'User')} ({state.get('user_role', '')})\n\n"
        f"Generate the report. Request: {query}"
    )

    # 4. Call primary LLM
    result = await llm_client.invoke("primary", system_prompt, user_message)

    return {
        "final_response": result["content"],
        "retrieved_context": context_results,
        "task_data": tasks[:50],
        "confidence": 0.95,
        "response_metadata": {
            **state.get("response_metadata", {}),
            "agent": "report_generator",
            "model": result["model"],
            "tokens_in": result["tokens_in"],
            "tokens_out": result["tokens_out"],
            "latency_ms": result["latency_ms"],
            "confidence": 0.95,
        },
    }
