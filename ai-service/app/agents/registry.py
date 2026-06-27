from typing import Literal, Optional
from pydantic import BaseModel, Field

class ToolDefinition(BaseModel):
    name: str = Field(..., description="Unique technical identifier for the tool")
    description: str = Field(..., description="Explanation of what the tool does for the Planner LLM")
    category: Literal["read", "write"] = Field(..., description="Action category of the tool")
    parallel_safe: bool = Field(True, description="Whether this tool can run concurrently with others")
    requires_approval: bool = Field(False, description="Whether this tool requires human validation")
    allowed_roles: list[str] = Field(default_factory=lambda: ["MEMBER", "HEAD", "ADMIN", "OWNER"], description="Roles authorized to run this tool")
    dependencies: list[str] = Field(default_factory=list, description="Other tools that must run and resolve before this tool can run")

def normalize_role(role_str: str) -> str:
    """Normalize user roles to standard uppercase DB representation.
    
    Handles Title Case, lowercase, and common role variants.
    """
    if not role_str:
        return "MEMBER"
    role_upper = role_str.strip().upper()
    if role_upper in ("OWNER", "ADMIN", "HEAD", "MEMBER", "VIEWER"):
        return role_upper
    
    # Map common variations
    if role_upper in ("MANAGER", "LEAD", "PROJECT_MANAGER"):
        return "ADMIN"
    if role_upper in ("TEAM_MEMBER", "USER"):
        return "MEMBER"
    if role_upper == "GUEST":
        return "VIEWER"
    
    return "MEMBER"

# The unified Phase 1 Tool Registry
TOOL_REGISTRY: dict[str, ToolDefinition] = {
    "search_tasks": ToolDefinition(
        name="search_tasks",
        description="Search active project tasks by keyword, status, priority, or tags.",
        category="read",
        parallel_safe=True,
        requires_approval=False,
        allowed_roles=["MEMBER", "HEAD", "ADMIN", "OWNER"],
    ),
    "search_users": ToolDefinition(
        name="search_users",
        description="Query workspace users and analyze active workloads or capacity status.",
        category="read",
        parallel_safe=True,
        requires_approval=False,
        allowed_roles=["MEMBER", "HEAD", "ADMIN", "OWNER"],
    ),
    "search_approvals": ToolDefinition(
        name="search_approvals",
        description="List and check the status of pending or resolved task approval requests.",
        category="read",
        parallel_safe=True,
        requires_approval=False,
        allowed_roles=["MEMBER", "HEAD", "ADMIN", "OWNER"],
    ),
    "search_workflows": ToolDefinition(
        name="search_workflows",
        description="Inspect workflow instances, definition rules, and active steps in the space.",
        category="read",
        parallel_safe=True,
        requires_approval=False,
        allowed_roles=["MEMBER", "HEAD", "ADMIN", "OWNER"],
    ),
    "search_meetings": ToolDefinition(
        name="search_meetings",
        description="Search transcript records and summaries of past meeting events.",
        category="read",
        parallel_safe=True,
        requires_approval=False,
        allowed_roles=["MEMBER", "HEAD", "ADMIN", "OWNER"],
    ),
    "search_calendar": ToolDefinition(
        name="search_calendar",
        description="Check user calendars for availability, meeting events, and public holidays.",
        category="read",
        parallel_safe=True,
        requires_approval=False,
        allowed_roles=["MEMBER", "HEAD", "ADMIN", "OWNER"],
        dependencies=["search_users"],  # Requires resolving assignee IDs first if query is about a person
    ),
    "search_decisions": ToolDefinition(
        name="search_decisions",
        description="Query the decision register for past logs, resolutions, and outcomes.",
        category="read",
        parallel_safe=True,
        requires_approval=False,
        allowed_roles=["MEMBER", "HEAD", "ADMIN", "OWNER"],
    ),
    "search_analytics": ToolDefinition(
        name="search_analytics",
        description="Fetch project analytics including velocities, capacity loads, and burndown rates.",
        category="read",
        parallel_safe=True,
        requires_approval=False,
        allowed_roles=["MEMBER", "HEAD", "ADMIN", "OWNER"],
    ),
    "get_task_dependencies": ToolDefinition(
        name="get_task_dependencies",
        description="Retrieve blocking and dependent task links within the space graph.",
        category="read",
        parallel_safe=True,
        requires_approval=False,
        allowed_roles=["MEMBER", "HEAD", "ADMIN", "OWNER"],
    ),
    "get_blocker_chain": ToolDefinition(
        name="get_blocker_chain",
        description="Traverse task dependencies recursively to build the chain of blocker nodes.",
        category="read",
        parallel_safe=True,
        requires_approval=False,
        allowed_roles=["MEMBER", "HEAD", "ADMIN", "OWNER"],
        dependencies=["get_task_dependencies"],
    ),
    "get_workflow_graph": ToolDefinition(
        name="get_workflow_graph",
        description="Query active approval flows and workflow transitions to analyze delays.",
        category="read",
        parallel_safe=True,
        requires_approval=False,
        allowed_roles=["MEMBER", "HEAD", "ADMIN", "OWNER"],
    ),
    "get_org_graph": ToolDefinition(
        name="get_org_graph",
        description="Expose space department mappings, user hierarchies, and roles.",
        category="read",
        parallel_safe=True,
        requires_approval=False,
        allowed_roles=["MEMBER", "HEAD", "ADMIN", "OWNER"],
    ),
    "create_task": ToolDefinition(
        name="create_task",
        description="Propose creating a new task ticket with specified details.",
        category="write",
        parallel_safe=True,
        requires_approval=True,
        allowed_roles=["HEAD", "ADMIN", "OWNER"],
    ),
    "assign_task": ToolDefinition(
        name="assign_task",
        description="Propose assigning or reassigning a task to a user.",
        category="write",
        parallel_safe=True,
        requires_approval=True,
        allowed_roles=["HEAD", "ADMIN", "OWNER"],
    ),
    "update_task": ToolDefinition(
        name="update_task",
        description="Propose updating a task's status, priority, or other field variables.",
        category="write",
        parallel_safe=True,
        requires_approval=True,
        allowed_roles=["HEAD", "ADMIN", "OWNER"],
    ),
    "send_notification": ToolDefinition(
        name="send_notification",
        description="Propose sending high-priority alerts to specific workspace users.",
        category="write",
        parallel_safe=True,
        requires_approval=True,
        allowed_roles=["HEAD", "ADMIN", "OWNER"],
    ),
    "create_reminder": ToolDefinition(
        name="create_reminder",
        description="Propose scheduling a standard reminder for a task.",
        category="write",
        parallel_safe=True,
        requires_approval=True,
        allowed_roles=["MEMBER", "HEAD", "ADMIN", "OWNER"],
    ),
    "start_approval": ToolDefinition(
        name="start_approval",
        description="Propose kicking off a document or task approval sequence.",
        category="write",
        parallel_safe=True,
        requires_approval=True,
        allowed_roles=["HEAD", "ADMIN", "OWNER"],
    ),
}

def get_allowed_tools(user_role: str) -> list[ToolDefinition]:
    """Filter the unified registry based on the user's role (RBAC Enforcement)."""
    normalized = normalize_role(user_role)
    return [
        tool for tool in TOOL_REGISTRY.values()
        if normalized in tool.allowed_roles
    ]
