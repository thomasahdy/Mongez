import logging
import json
# Helper to dynamically retrieve dependencies at runtime to avoid stale None imports during test setup
class DependencyProxy:
    def __init__(self, name: str, getter_name: str = None):
        self._name = name
        self._getter_name = getter_name
    def __getattr__(self, attr):
        import app.dependencies
        if self._getter_name:
            getter = getattr(app.dependencies, self._getter_name)
            dep = getter()
        else:
            dep = getattr(app.dependencies, self._name)
        return getattr(dep, attr)

nestjs_client = DependencyProxy("nestjs_client")
retriever = DependencyProxy(None, "get_retriever")

logger = logging.getLogger(__name__)

async def search_tasks(query: str, space_id: str, status: str = None, priority: str = None) -> str:
    """Search tasks by query, optionally filtering by status and priority."""
    logger.info("Executing tool 'search_tasks' | query=%s | space=%s", query, space_id)
    # RAG search for semantically matching tasks
    try:
        results = await retriever.retrieve(query, space_id, source_types=["task"], top_k=10)
    except Exception as exc:
        logger.exception(
            "search_tasks RAG retrieval failed",
            extra={"space_id": space_id, "query": query, "status": status, "priority": priority, "tool": "search_tasks"}
        )
        results = []

    # Also pull live tasks to verify and filter
    try:
        tasks = await nestjs_client.get_tasks(space_id)
    except Exception as exc:
        logger.exception(
            "search_tasks failed to pull live tasks",
            extra={"space_id": space_id, "query": query, "tool": "search_tasks"}
        )
        return json.dumps({"error": "Unable to retrieve tasks", "details": str(exc)}, indent=2)

    filtered = []
    # If we have RAG results, match them against live task ids
    rag_ids = {r["metadata"]["task_id"] for r in results if r.get("metadata", {}).get("task_id")}

    # Simple keyword filtering helper
    keywords = [w.lower() for w in (query or "").split() if len(w) > 2]

    for t in tasks:
        t_id = t.get("id")
        t_status = t.get("status")
        t_priority = t.get("priority")

        # Apply filters
        if status and t_status != status:
            continue
        if priority and t_priority != priority:
            continue

        # If RAG found it, prioritize it
        is_rag_match = t_id in rag_ids
        rag_score = next((r["score"] for r in results if r.get("metadata", {}).get("task_id") == t_id), 0.0) if is_rag_match else 0.0

        # Calculate simple keyword match score
        t_title_lower = (t.get("title") or "").lower()
        t_desc_lower = (t.get("description") or "").lower()
        kw_match_count = sum(1 for kw in keywords if kw in t_title_lower or kw in t_desc_lower)
        kw_score = (kw_match_count / len(keywords)) if keywords else 0.0

        # Combined score: RAG score (max 1.0) + 0.5 * keyword score
        final_score = rag_score + 0.5 * kw_score

        # Also fallback: if no query words match and Qdrant had no result, but query was empty, let them pass
        if keywords and not is_rag_match and kw_score == 0.0:
            continue

        filtered.append({
            "id": t.get("identifier") or t_id,
            "title": t.get("title"),
            "status": t_status,
            "priority": t_priority,
            "dueDate": t.get("dueDate"),
            "assignees": [a["user"]["name"] for a in t.get("assignments", []) if a.get("user")],
            "score": final_score,
            "is_rag_match": is_rag_match
        })

    # Sort matches: combined score first, then by priority
    filtered.sort(key=lambda x: (x["score"], x["priority"] == "URGENT", x["priority"] == "HIGH"), reverse=True)
    return json.dumps(filtered[:15], indent=2, ensure_ascii=False)

async def search_users(space_id: str, query: str = None, workload: str = None) -> str:
    """Get list of users in space and optional capacity workloads."""
    logger.info("Executing tool 'search_users' | space_id=%s | query=%s | workload=%s", space_id, query, workload)
    try:
        org = await nestjs_client.get_org_graph(space_id)
        logger.debug("get_org_graph returned keys: %s", org.keys() if isinstance(org, dict) else type(org))
        members = org.get("members", []) if isinstance(org, dict) else []
    except Exception as exc:
        logger.exception(
            "search_users failed",
            extra={"space_id": space_id, "query": query, "workload": workload, "tool": "search_users"}
        )
        return json.dumps({"error": "Unable to retrieve team member details", "details": str(exc)}, indent=2)

    try:
        tasks = await nestjs_client.get_tasks(space_id)
    except Exception as exc:
        logger.exception(
            "search_users failed to pull tasks",
            extra={"space_id": space_id, "tool": "search_users"}
        )
        return json.dumps({"error": "Unable to retrieve tasks", "details": str(exc)}, indent=2)

    # Calculate active tasks count per user
    user_workloads = {}
    for m in members:
        user_workloads[m["name"]] = {"id": m.get("id") or m.get("userId") or "", "email": m["email"], "role": m["role"], "active_tasks": 0, "estimated_hours": 0.0}

    for t in tasks:
        if t.get("status") in ["DONE", "CANCELLED"]:
            continue
        est = float(t.get("estimatedHours") or 0.0)
        assignees = [a["user"]["name"] for a in t.get("assignments", []) if a.get("user")]
        for name in assignees:
            if name in user_workloads:
                user_workloads[name]["active_tasks"] += 1
                user_workloads[name]["estimated_hours"] += est

    # Filter by workload if requested
    output_users = {}
    for name, stats in user_workloads.items():
        is_overloaded = stats["active_tasks"] > 5 or stats["estimated_hours"] > 40.0
        stats["workload_status"] = "HIGH" if is_overloaded else "NORMAL"
        
        if workload == "high" and stats["workload_status"] != "HIGH":
            continue
        if workload == "normal" and stats["workload_status"] != "NORMAL":
            continue
            
        if query and query.lower() not in name.lower() and query.lower() not in stats["email"].lower():
            continue

        output_users[name] = stats

    return json.dumps(output_users, indent=2, ensure_ascii=False)

async def search_approvals(space_id: str, status: str = None) -> str:
    """Get active or historical task approvals and workflow sequences."""
    logger.info("Executing tool 'search_approvals' | space=%s", space_id)
    try:
        graphs = await nestjs_client.get_workflow_graph(space_id)
        instances = graphs.get("workflowInstances", [])
        approvals = graphs.get("taskApprovals", [])
    except Exception as exc:
        logger.exception(
            "search_approvals failed",
            extra={"space_id": space_id, "status": status, "tool": "search_approvals"}
        )
        return json.dumps({"error": "Unable to retrieve approval data", "details": str(exc)}, indent=2)

    if status:
        instances = [i for i in instances if i.get("status") == status]
        approvals = [a for a in approvals if a.get("status") == status]

    return json.dumps({
        "workflow_instances": instances[:15],
        "task_approvals": approvals[:15],
    }, indent=2, ensure_ascii=False)

async def search_workflows(space_id: str) -> str:
    """Get structural workflows and definitions."""
    logger.info("Executing tool 'search_workflows' | space=%s", space_id)
    try:
        graphs = await nestjs_client.get_workflow_graph(space_id)
        return json.dumps(graphs.get("workflowInstances", [])[:20], indent=2, ensure_ascii=False)
    except Exception as exc:
        logger.error("search_workflows failed: %s", exc)
        return json.dumps({"error": "Unable to retrieve workflow data", "details": str(exc)}, indent=2)

async def search_meetings(query: str, space_id: str) -> str:
    """Search meeting summaries and transcript context chunks."""
    logger.info("Executing tool 'search_meetings' | query=%s | space=%s", query, space_id)
    results = await retriever.retrieve(query, space_id, source_types=["comment"], top_k=8)
    # Filter context to comments/transcripts mentioning meeting context
    meeting_chunks = [
        r for r in results 
        if "meeting" in r["text"].lower() or "transcript" in r["text"].lower() or r["metadata"].get("source_type") == "meeting"
    ]
    if not meeting_chunks:
        meeting_chunks = results[:4] # Fallback to top general chunks
    return json.dumps(meeting_chunks, indent=2, ensure_ascii=False)

async def search_calendar(space_id: str, start_date: str = None, end_date: str = None) -> str:
    """Check calendar events and schedules."""
    logger.info("Executing tool 'search_calendar' | space=%s", space_id)
    try:
        events = await nestjs_client.get_calendar(space_id, start_date, end_date)
        return json.dumps(events[:30], indent=2, ensure_ascii=False)
    except Exception as exc:
        logger.error("search_calendar failed: %s", exc)
        return json.dumps({"error": "Unable to retrieve calendar data", "details": str(exc)}, indent=2)

async def search_decisions(space_id: str, query: str = None) -> str:
    """Retrieve items from the Decision Register."""
    logger.info("Executing tool 'search_decisions' | space=%s", space_id)
    try:
        decisions = await nestjs_client.get_decisions(space_id)
        if query:
            decisions = [
                d for d in decisions
                if query.lower() in d.get("title", "").lower() or query.lower() in d.get("summary", "").lower()
            ]
        return json.dumps(decisions[:15], indent=2, ensure_ascii=False)
    except Exception as exc:
        logger.error("search_decisions failed: %s", exc)
        return json.dumps({"error": "Unable to retrieve decisions", "details": str(exc)}, indent=2)

async def search_analytics(space_id: str) -> str:
    """Generate high-level analytics about task distributions."""
    logger.info("Executing tool 'search_analytics' | space=%s", space_id)
    try:
        tasks = await nestjs_client.get_tasks(space_id)
    except Exception as exc:
        logger.exception(
            "search_analytics failed",
            extra={"space_id": space_id, "tool": "search_analytics"}
        )
        return json.dumps({"error": "Unable to retrieve analytics data", "details": str(exc)}, indent=2)

    # Process tasks into analytics
    total = len(tasks)
    status_counts = {}
    priority_counts = {}
    overdue_count = 0

    import datetime
    today_str = datetime.date.today().isoformat()

    for t in tasks:
        stat = t.get("status", "UNKNOWN")
        pri = t.get("priority", "NONE")
        status_counts[stat] = status_counts.get(stat, 0) + 1
        priority_counts[pri] = priority_counts.get(pri, 0) + 1

        due = t.get("dueDate")
        if due and due < today_str and stat not in ["DONE", "CANCELLED"]:
            overdue_count += 1

    return json.dumps({
        "total_tasks": total,
        "status_distribution": status_counts,
        "priority_distribution": priority_counts,
        "overdue_tasks_count": overdue_count,
    }, indent=2, ensure_ascii=False)

async def get_task_dependencies(space_id: str) -> str:
    """Get the task dependencies graph list."""
    logger.info("Executing tool 'get_task_dependencies' | space=%s", space_id)
    try:
        deps = await nestjs_client.get_task_dependencies(space_id)
        return json.dumps(deps, indent=2, ensure_ascii=False)
    except Exception as exc:
        logger.error("get_task_dependencies failed: %s", exc)
        return json.dumps({"error": "Unable to retrieve dependencies", "details": str(exc)}, indent=2)

async def get_blocker_chain(space_id: str) -> str:
    """Get calculated recursive chains of blocked tasks."""
    logger.info("Executing tool 'get_blocker_chain' | space=%s", space_id)
    try:
        chain = await nestjs_client.get_blocker_chain(space_id)
        return json.dumps(chain, indent=2, ensure_ascii=False)
    except Exception as exc:
        logger.error("get_blocker_chain failed: %s", exc)
        return json.dumps({"error": "Unable to retrieve blocker chain", "details": str(exc)}, indent=2)

async def get_workflow_graph(space_id: str) -> str:
    """Get active workflows and approvals graph connections."""
    logger.info("Executing tool 'get_workflow_graph' | space=%s", space_id)
    try:
        graph = await nestjs_client.get_workflow_graph(space_id)
        return json.dumps(graph, indent=2, ensure_ascii=False)
    except Exception as exc:
        logger.error("get_workflow_graph failed: %s", exc)
        return json.dumps({"error": "Unable to retrieve workflow graph", "details": str(exc)}, indent=2)

async def get_org_graph(space_id: str) -> str:
    """Get department structures and space membership hierarchy."""
    logger.info("Executing tool 'get_org_graph' | space=%s", space_id)
    try:
        graph = await nestjs_client.get_org_graph(space_id)
        return json.dumps(graph, indent=2, ensure_ascii=False)
    except Exception as exc:
        logger.error("get_org_graph failed: %s", exc)
        return json.dumps({"error": "Unable to retrieve org structure", "details": str(exc)}, indent=2)
