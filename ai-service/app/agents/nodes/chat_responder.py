"""Chat Responder Node — answers general project questions using RAG + task data.

Flow:
  1. Retrieve semantically relevant context from Qdrant
  2. Fetch recent task data from NestJS
  3. Build personalised prompt using session context (user_name, role, space)
  4. Call primary Groq model for conversational response
"""
import json
import logging
from app.agents.state import MongezAgentState

logger = logging.getLogger(__name__)


def _build_task_summary(tasks: list[dict], limit: int = 20) -> str:
    rows = []
    for t in tasks[:limit]:
        rows.append({
            "id": t.get("identifier") or t.get("id", ""),
            "title": t.get("title", ""),
            "status": t.get("status", ""),
            "priority": t.get("priority", ""),
            "dueDate": str(t.get("dueDate", "") or ""),
            "board": (t.get("board") or {}).get("name", ""),
            "assignees": [
                a["user"]["name"]
                for a in t.get("assignments", [])
                if a.get("user")
            ],
        })
    return json.dumps(rows, indent=2, ensure_ascii=False)


async def chat_responder_node(state: MongezAgentState) -> dict:
    """Generate a conversational response grounded in project data.

    Returns:
        {
            "final_response": str,
            "retrieved_context": list[dict],
            "task_data": list[dict],
            "response_metadata": dict,
        }
    """
    from app.dependencies import llm_client, prompt_loader, nestjs_client, retriever

    space_id = state["space_id"]
    query = state.get("rewritten_query") or state.get("raw_input", "")

    # 1. RAG retrieval
    context_results = await retriever.retrieve(query, space_id, top_k=5)
    xml_context = retriever.format_as_xml_context(context_results)

    # 2. Structured task data
    try:
        tasks = await nestjs_client.get_tasks(space_id)
    except Exception as exc:
        logger.error("Chat responder: failed to fetch tasks: %s", exc)
        tasks = []

    task_summary = _build_task_summary(tasks)

    # 3. Build personalised system prompt
    system_prompt = prompt_loader.load(
        "chat_assistant",
        user_name=state.get("user_name", "User"),
        user_role=state.get("user_role", "Member"),
        space_name=state.get("space_name", "your space"),
        board_name=state.get("board_name", "All Boards"),
    )

    user_message = (
        f"{xml_context}\n\n"
        f"<tasks>\n{task_summary}\n</tasks>\n\n"
        f"Question: {query}"
    )

    # 4. Call primary LLM
    result = await llm_client.invoke("primary", system_prompt, user_message)

    return {
        "final_response": result["content"],
        "retrieved_context": context_results,
        "task_data": tasks[:20],
        "response_metadata": {
            **state.get("response_metadata", {}),
            "agent": "chat_responder",
            "model": result["model"],
            "tokens_in": result["tokens_in"],
            "tokens_out": result["tokens_out"],
            "latency_ms": result["latency_ms"],
        },
    }
