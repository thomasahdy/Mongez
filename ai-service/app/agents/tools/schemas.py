"""Pydantic schemas for Mongez tool inputs and execution results.

Provides strict input validation and unified tool response contracts.
"""
from typing import Any, Literal, Optional, Dict
from pydantic import BaseModel, Field

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# UNIFIED TOOL RESULT CONTRACT
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

class Citation(BaseModel):
    entity_type: Literal["task", "meeting", "decision", "workflow", "approval"]
    entity_id: str
    title: str
    confidence: Optional[float] = None

class ToolResult(BaseModel):
    status: Literal["success", "partial", "failed"]
    content: Any = None
    citations: list[Citation] = []
    warnings: list[str] = []
    confidence: float = 1.0
    duration_ms: int
    cache_hit: bool = False
    error_type: Optional[str] = None

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# READ TOOL SCHEMAS
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

class SearchTasksInput(BaseModel):
    query: str = Field("", description="The query keyword or description to search for tasks")
    space_id: str = Field(..., description="Tenant isolation key")
    status: Optional[str] = Field(None, description="Filter tasks by status (e.g. TODO, IN_PROGRESS)")
    priority: Optional[str] = Field(None, description="Filter tasks by priority (e.g. HIGH, URGENT)")

class SearchUsersInput(BaseModel):
    space_id: str = Field(..., description="Tenant isolation key")
    query: Optional[str] = Field(None, description="Filter users by name or email")
    workload: Optional[str] = Field(None, description="Filter users by workload status (high or normal)")

class SearchApprovalsInput(BaseModel):
    space_id: str = Field(..., description="Tenant isolation key")
    status: Optional[str] = Field(None, description="Filter approvals by status (PENDING, APPROVED, REJECTED)")

class SearchWorkflowsInput(BaseModel):
    space_id: str = Field(..., description="Tenant isolation key")

class SearchMeetingsInput(BaseModel):
    query: str = Field("", description="Search query keyword for meeting records")
    space_id: str = Field(..., description="Tenant isolation key")

class SearchCalendarInput(BaseModel):
    space_id: str = Field(..., description="Tenant isolation key")
    start_date: Optional[str] = Field(None, description="Format YYYY-MM-DD")
    end_date: Optional[str] = Field(None, description="Format YYYY-MM-DD")

class SearchDecisionsInput(BaseModel):
    space_id: str = Field(..., description="Tenant isolation key")
    query: Optional[str] = Field(None, description="Search keyword for decisions")

class SearchAnalyticsInput(BaseModel):
    space_id: str = Field(..., description="Tenant isolation key")

class GetTaskDependenciesInput(BaseModel):
    space_id: str = Field(..., description="Tenant isolation key")

class GetBlockerChainInput(BaseModel):
    space_id: str = Field(..., description="Tenant isolation key")

class GetWorkflowGraphInput(BaseModel):
    space_id: str = Field(..., description="Tenant isolation key")

class GetOrgGraphInput(BaseModel):
    space_id: str = Field(..., description="Tenant isolation key")

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# MUTATION TOOL SCHEMAS
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

class CreateTaskInput(BaseModel):
    space_id: str = Field(..., description="Tenant isolation key")
    trace_id: str = Field(..., description="Trace identifier")
    title: str = Field(..., description="Title of the task")
    description: Optional[str] = Field(None, description="Detailed description")
    board_id: Optional[str] = Field(None, description="Associated Board ID")
    priority: Optional[str] = Field("MEDIUM", description="Task priority")
    reason: Optional[str] = Field("AI Proposed Task Creation", description="Reason for creation")

class AssignTaskInput(BaseModel):
    space_id: str = Field(..., description="Tenant isolation key")
    trace_id: str = Field(..., description="Trace identifier")
    task_id: str = Field(..., description="Task ID to assign")
    assignee_id: str = Field(..., description="User ID of assignee")
    reason: Optional[str] = Field("AI Proposed Task Assignment", description="Reason for assignment")

class UpdateTaskInput(BaseModel):
    space_id: str = Field(..., description="Tenant isolation key")
    trace_id: str = Field(..., description="Trace identifier")
    task_id: str = Field(..., description="Task ID to update")
    status: Optional[str] = Field(None, description="New status")
    priority: Optional[str] = Field(None, description="New priority")
    reason: Optional[str] = Field("AI Proposed Task Update", description="Reason for update")

class SendNotificationInput(BaseModel):
    space_id: str = Field(..., description="Tenant isolation key")
    trace_id: str = Field(..., description="Trace identifier")
    recipient_id: str = Field(..., description="User ID of recipient")
    message: str = Field(..., description="High priority message text")
    priority: Optional[str] = Field("HIGH", description="Escalation priority")
    reason: Optional[str] = Field("AI Proposed Escalation Notification", description="Reason for notification")

class CreateReminderInput(BaseModel):
    space_id: str = Field(..., description="Tenant isolation key")
    trace_id: str = Field(..., description="Trace identifier")
    recipient_id: str = Field(..., description="User ID of recipient")
    task_id: str = Field(..., description="Task ID associated")
    title: str = Field(..., description="Title of the reminder")
    body: str = Field(..., description="Body of the reminder")
    reason: Optional[str] = Field("AI Proposed Reminder", description="Reason for reminder")

class StartApprovalInput(BaseModel):
    space_id: str = Field(..., description="Tenant isolation key")
    trace_id: str = Field(..., description="Trace identifier")
    entity_type: str = Field(..., description="Type of entity (task, budget, etc.)")
    entity_id: str = Field(..., description="ID of entity")
    approvers: list[str] = Field(..., description="List of user IDs of approvers")
    reason: Optional[str] = Field("AI Proposed Approval Cycle", description="Reason for approval cycle")


# Mapping technical tool names to Pydantic validation schemas
SCHEMAS_MAP: Dict[str, type[BaseModel]] = {
    "search_tasks": SearchTasksInput,
    "search_users": SearchUsersInput,
    "search_approvals": SearchApprovalsInput,
    "search_workflows": SearchWorkflowsInput,
    "search_meetings": SearchMeetingsInput,
    "search_calendar": SearchCalendarInput,
    "search_decisions": SearchDecisionsInput,
    "search_analytics": SearchAnalyticsInput,
    "get_task_dependencies": GetTaskDependenciesInput,
    "get_blocker_chain": GetBlockerChainInput,
    "get_workflow_graph": GetWorkflowGraphInput,
    "get_org_graph": GetOrgGraphInput,
    "create_task": CreateTaskInput,
    "assign_task": AssignTaskInput,
    "update_task": UpdateTaskInput,
    "send_notification": SendNotificationInput,
    "create_reminder": CreateReminderInput,
    "start_approval": StartApprovalInput,
}
