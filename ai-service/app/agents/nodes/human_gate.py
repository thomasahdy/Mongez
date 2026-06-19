"""Human Gate Node — submits the proposed action to NestJS for human approval.

This node is the safety boundary of the entire AI system.
The action is NEVER auto-executed — it creates an AIProposedAction record
in the NestJS DB with status=PENDING. The user approves or rejects
via the frontend before anything changes in the project.
"""
import logging
from app.agents.state import MongezAgentState

logger = logging.getLogger(__name__)


async def human_gate_node(state: MongezAgentState) -> dict:
    """Submit proposed action for human review.

    Returns:
        {
            "approval_status": "pending",
            "final_response": str,  # Message telling user what was proposed
        }
    """
    from app.dependencies import nestjs_client

    action = state.get("proposed_action")
    if not action:
        return {
            "final_response": "No action to propose.",
            "approval_status": None,
        }

    try:
        await nestjs_client.propose_action(
            trace_id=state.get("trace_id", ""),
            space_id=state["space_id"],
            action=action,
        )
        logger.info(
            "Proposed action submitted | type=%s | space=%s | trace=%s",
            action.get("command_type"),
            state["space_id"],
            state.get("trace_id"),
        )
    except Exception as exc:
        logger.error("Failed to submit proposed action to NestJS: %s", exc)
        return {
            "final_response": (
                "I formulated an action but couldn't submit it for approval right now. "
                f"Please try again.\n\n"
                f"**Proposed:** {action.get('command_type', 'Unknown action')}\n"
                f"**Reason:** {action.get('reason', '')}"
            ),
            "approval_status": None,
        }

    cmd = action.get("command_type", "Action")
    reason = action.get("reason", "No reason provided.")
    payload = action.get("payload", {})
    task_id = payload.get("taskId", "")

    response = (
        f"## Action Proposed for Review\n\n"
        f"**Type:** {cmd}\n"
        + (f"**Task:** `{task_id}`\n" if task_id else "")
        + f"**Reason:** {reason}\n\n"
        f"This action requires your approval. "
        f"Check **Pending Actions** in the workspace to approve or reject it."
    )

    return {
        "approval_status": "pending",
        "final_response": response,
    }
