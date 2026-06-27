import logging
import json
# Helper to dynamically retrieve dependencies at runtime to avoid stale None imports during test setup
class DependencyProxy:
    def __init__(self, name: str):
        self._name = name
    def __getattr__(self, attr):
        import app.dependencies
        dep = getattr(app.dependencies, self._name)
        return getattr(dep, attr)

nestjs_client = DependencyProxy("nestjs_client")

logger = logging.getLogger(__name__)

async def propose_action_helper(trace_id: str, space_id: str, command_type: str, payload: dict, reason: str) -> str:
    """Helper to dispatch proposed actions to NestJS."""
    action = {
        "command_type": command_type,
        "payload": payload,
        "reason": reason
    }
    result = await nestjs_client.propose_action(trace_id, space_id, action)
    return json.dumps({
        "status": "success",
        "message": f"Action '{command_type}' proposed successfully and is pending approval.",
        "action_id": result.get("id"),
        "proposed_action": action
    }, indent=2, ensure_ascii=False)

async def create_task(space_id: str, trace_id: str, title: str, description: str = None, board_id: str = None, priority: str = "MEDIUM", reason: str = "AI Proposed Task Creation") -> str:
    """Propose task creation."""
    logger.info("Executing tool 'create_task' | space=%s", space_id)
    payload = {
        "taskDto": {
            "title": title,
            "description": description or "",
            "boardId": board_id,
            "priority": priority,
        },
        "spaceId": space_id,
    }
    return await propose_action_helper(trace_id, space_id, "CreateTask", payload, reason)

async def assign_task(space_id: str, trace_id: str, task_id: str, assignee_id: str, reason: str = "AI Proposed Task Assignment") -> str:
    """Propose assigning a task to a user."""
    logger.info("Executing tool 'assign_task' | space=%s | task=%s | user=%s", space_id, task_id, assignee_id)
    payload = {
        "taskId": task_id,
        "assigneeId": assignee_id,
        "newAssigneeId": assignee_id
    }
    return await propose_action_helper(trace_id, space_id, "AssignTask", payload, reason)

async def update_task(space_id: str, trace_id: str, task_id: str, status: str = None, priority: str = None, reason: str = "AI Proposed Task Update") -> str:
    """Propose updating task status or priority."""
    logger.info("Executing tool 'update_task' | space=%s | task=%s", space_id, task_id)
    payload = {
        "taskId": task_id
    }
    if status:
        payload["newStatus"] = status
        payload["status"] = status
    if priority:
        payload["priority"] = priority

    return await propose_action_helper(trace_id, space_id, "UpdateTask", payload, reason)

async def send_notification(space_id: str, trace_id: str, recipient_id: str, message: str, priority: str = "HIGH", reason: str = "AI Proposed Escalation Notification") -> str:
    """Propose sending an escalation notification to a user."""
    logger.info("Executing tool 'send_notification' | space=%s | user=%s", space_id, recipient_id)
    payload = {
        "managerId": recipient_id,
        "spaceId": space_id,
        "taskTitle": "AI Escalation",
        "reason": message
    }
    return await propose_action_helper(trace_id, space_id, "EscalateTask", payload, reason)

async def create_reminder(space_id: str, trace_id: str, recipient_id: str, task_id: str, title: str, body: str, reason: str = "AI Proposed Reminder") -> str:
    """Propose creating a task reminder for a user."""
    logger.info("Executing tool 'create_reminder' | space=%s | user=%s | task=%s", space_id, recipient_id, task_id)
    payload = {
        "recipientId": recipient_id,
        "recipientIds": [recipient_id],
        "taskId": task_id,
        "title": title,
        "body": body,
        "spaceId": space_id
    }
    return await propose_action_helper(trace_id, space_id, "CreateReminder", payload, reason)

async def start_approval(space_id: str, trace_id: str, entity_type: str, entity_id: str, approvers: list[str], reason: str = "AI Proposed Approval Cycle") -> str:
    """Propose starting an approval workflow for a task, budget, or document."""
    logger.info("Executing tool 'start_approval' | space=%s | entity=%s", space_id, entity_id)
    payload = {
        "entityType": entity_type,
        "entityId": entity_id,
        "approvers": approvers,
        "spaceId": space_id
    }
    return await propose_action_helper(trace_id, space_id, "StartApproval", payload, reason)
