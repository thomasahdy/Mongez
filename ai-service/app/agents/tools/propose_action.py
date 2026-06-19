"""Propose action tool — submits a proposed action to NestJS for human approval."""
import logging

logger = logging.getLogger(__name__)


async def propose_action(
    trace_id: str,
    space_id: str,
    command_type: str,
    payload: dict,
    reason: str,
) -> dict:
    """Submit a structured action proposal to NestJS.

    NestJS creates an AIProposedAction record with status=PENDING.
    A manager approves or rejects via the frontend.

    Args:
        trace_id: Links this action to the originating AI request
        space_id: Tenant scope
        command_type: One of AssignTask, EscalateTask, CreateReminder, UpdateTask
        payload: Command-specific data (taskId, userId, etc.)
        reason: Human-readable explanation of why this action is recommended

    Returns:
        The created AIProposedAction record from NestJS.
    """
    from app.dependencies import nestjs_client
    action = {
        "command_type": command_type,
        "payload": payload,
        "reason": reason,
    }
    return await nestjs_client.propose_action(
        trace_id=trace_id,
        space_id=space_id,
        action=action,
    )
