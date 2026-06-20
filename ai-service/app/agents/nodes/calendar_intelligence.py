import json
import logging
from datetime import datetime, timedelta
from app.agents.state import MongezAgentState

logger = logging.getLogger(__name__)


def _build_calendar_summary(events: list[dict]) -> str:
    """Format calendar events, holidays, and approvals into a structured JSON string for the prompt context."""
    rows = []
    for e in events:
        rows.append({
            "id": e.get("id", ""),
            "title": e.get("title", ""),
            "startDate": str(e.get("startDate", "")),
            "endDate": str(e.get("endDate", "")),
            "allDay": e.get("allDay", False),
            "source": e.get("source", ""),
            "hijriDate": e.get("hijriDate", ""),
            "entityType": e.get("entityType", ""),
            "participants": [
                p.get("displayName") or p.get("email") or ""
                for p in e.get("participants", [])
            ],
            "location": e.get("location", ""),
        })
    return json.dumps(rows, indent=2, ensure_ascii=False)


def _build_workload_summary(tasks: list[dict]) -> str:
    """Group open tasks by assignee and due-date week to calculate weekly workload capacities."""
    workload = {}
    for t in tasks:
        # Ignore completed tasks
        if t.get("status") in ("DONE", "CANCELLED"):
            continue

        due_date_str = t.get("dueDate")
        if not due_date_str:
            continue

        try:
            # Parse due date and find the Monday of that week
            dt = datetime.fromisoformat(due_date_str.replace("Z", "+00:00"))
            monday = dt - timedelta(days=dt.weekday())
            week_key = monday.strftime("%Y-W%W")
        except Exception:
            continue

        assignees = [
            a["user"]["name"]
            for a in t.get("assignments", [])
            if a.get("user") and a["user"].get("name")
        ]

        if not assignees:
            assignees = ["Unassigned"]

        for name in assignees:
            if name not in workload:
                workload[name] = {}
            if week_key not in workload[name]:
                workload[name][week_key] = []
            
            workload[name][week_key].append({
                "id": t.get("identifier") or t.get("id"),
                "title": t.get("title"),
                "priority": t.get("priority"),
                "estimatedHours": t.get("estimatedHours"),
            })

    # Convert to structured presentation
    summary_list = []
    for name, weeks in workload.items():
        for week, item_list in weeks.items():
            summary_list.append({
                "assignee": name,
                "week": week,
                "taskCount": len(item_list),
                "tasks": item_list
            })

    return json.dumps(summary_list, indent=2, ensure_ascii=False)


async def calendar_intelligence_node(state: MongezAgentState) -> dict:
    """LangGraph node to analyze calendar queries, check overlaps, regional holidays, and team overload."""
    from app.dependencies import llm_client, prompt_loader, nestjs_client

    space_id = state["space_id"]
    query = state.get("rewritten_query") or state.get("raw_input", "")

    # Fetch calendar events (unified feed: -30 days to +60 days)
    try:
        events = await nestjs_client.get_calendar(space_id)
    except Exception as exc:
        logger.error("Calendar intelligence: failed to fetch calendar: %s", exc)
        events = []

    # Fetch all tasks in space to compute assignee workload
    try:
        tasks = await nestjs_client.get_tasks(space_id)
    except Exception as exc:
        logger.error("Calendar intelligence: failed to fetch tasks: %s", exc)
        tasks = []

    calendar_summary = _build_calendar_summary(events)
    workload_summary = _build_workload_summary(tasks)

    # Render system prompt
    system_prompt = prompt_loader.load(
        "calendar_intelligence",
        version="v1.0"
    )

    user_message = (
        f"<calendar_events>\n{calendar_summary}\n</calendar_events>\n\n"
        f"<assignee_workload>\n{workload_summary}\n</assignee_workload>\n\n"
        f"Query: {query}"
    )

    # Call LLM with JSON mode constraint
    result = await llm_client.invoke("primary", system_prompt, user_message)
    content = result["content"].strip()

    final_response = content
    parsed_json = {}
    try:
        # Attempt to parse json from the response
        # Clean potential markdown wrapping if present
        clean_content = content
        if clean_content.startswith("```json"):
            clean_content = clean_content.split("```json", 1)[1]
        if clean_content.endswith("```"):
            clean_content = clean_content.rsplit("```", 1)[0]
        
        parsed_json = json.loads(clean_content.strip())
        if "explanation" in parsed_json:
            final_response = parsed_json["explanation"]
    except Exception as exc:
        logger.warning("Failed to parse calendar intelligence LLM output as JSON: %s. Returning raw.", exc)

    return {
        "final_response": final_response,
        "response_metadata": {
            **state.get("response_metadata", {}),
            "agent": "calendar_intelligence",
            "model": result["model"],
            "tokens_in": result["tokens_in"],
            "tokens_out": result["tokens_out"],
            "latency_ms": result["latency_ms"],
            "diagnostics": parsed_json,
        },
    }
