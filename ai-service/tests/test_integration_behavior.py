"""
Integration Behavioral Tests for Mongez AI Service

These tests verify the END-TO-END behavior of the AI agent, not just individual components.

Priority 5: Add Integration Tests

Test Cases:
1. "hi" → tools_called = [] (no tools should be called for greetings)
2. "who is overloaded?" → tools_called = [search_users, search_analytics]
3. Backend failure → "Could not access workspace data" (NOT "Unexpected error")

Run with: pytest tests/test_integration_behavior.py -v
"""
import pytest
import asyncio
import sys
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch

# Add project root to path
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))

from app.agents.graph import agent_graph
from app.agents.tools.read_tools import (
    search_users,
    search_analytics,
)


class TestGreetingBehavior:
    """Test 1: Greetings should NOT call any tools."""

    @pytest.mark.asyncio
    async def test_greeting_english_calls_no_tools(self):
        """Test that 'hi' does not trigger any tool calls."""
        initial_state = {
            "raw_input": "hi",
            "space_id": "test-space-001",
            "user_id": "test-user",
            "user_name": "Test User",
            "user_role": "Member",
            "space_name": "Test Space",
            "board_name": "All Boards",
            "trace_id": "test-trace-001",
            "rewritten_query": "",
            "intent": "",
            "retrieved_context": [],
            "task_data": [],
            "final_response": "",
            "proposed_action": None,
            "approval_status": None,
            "response_metadata": {},
            # Track tool calls
            "executed_tools": [],
            "tool_results": [],
        }

        # Mock the LLM client to prevent actual API calls
        with patch('app.dependencies.llm_client') as mock_llm:
            mock_llm.invoke = AsyncMock(return_value={
                "content": '{"need_more_data": false, "steps": [], "reasoning": "Greeting detected"}',
                "model": "test-model",
                "tokens_in": 10,
                "tokens_out": 5,
                "latency_ms": 50,
            })

            result = await agent_graph.ainvoke(initial_state)

            # Verify no tools were called
            tools_called = result.get("executed_tools", [])
            assert tools_called == [], f"Expected no tools to be called, but got: {tools_called}"

            # Verify response is a greeting
            response = result.get("final_response", "")
            assert any(greeting in response.lower() for greeting in ["hello", "hi", "help", "assist"])

    @pytest.mark.asyncio
    async def test_greeting_arabic_calls_no_tools(self):
        """Test that Arabic greetings do not trigger any tool calls."""
        initial_state = {
            "raw_input": "مرحبا",
            "space_id": "test-space-001",
            "user_id": "test-user",
            "user_name": "Test User",
            "user_role": "Member",
            "space_name": "Test Space",
            "board_name": "All Boards",
            "trace_id": "test-trace-002",
            "rewritten_query": "",
            "intent": "",
            "retrieved_context": [],
            "task_data": [],
            "final_response": "",
            "proposed_action": None,
            "approval_status": None,
            "response_metadata": {},
            "executed_tools": [],
            "tool_results": [],
        }

        with patch('app.dependencies.llm_client') as mock_llm:
            mock_llm.invoke = AsyncMock(return_value={
                "content": '{"need_more_data": false, "steps": [], "reasoning": "Greeting detected"}',
                "model": "test-model",
                "tokens_in": 10,
                "tokens_out": 5,
                "latency_ms": 50,
            })

            result = await agent_graph.ainvoke(initial_state)

            # Verify no tools were called
            tools_called = result.get("executed_tools", [])
            assert tools_called == [], f"Expected no tools to be called, but got: {tools_called}"

    @pytest.mark.asyncio
    async def test_thanks_calls_no_tools(self):
        """Test that gratitude messages do not trigger any tool calls."""
        initial_state = {
            "raw_input": "thanks for your help",
            "space_id": "test-space-001",
            "user_id": "test-user",
            "user_name": "Test User",
            "user_role": "Member",
            "space_name": "Test Space",
            "board_name": "All Boards",
            "trace_id": "test-trace-003",
            "rewritten_query": "",
            "intent": "",
            "retrieved_context": [],
            "task_data": [],
            "final_response": "",
            "proposed_action": None,
            "approval_status": None,
            "response_metadata": {},
            "executed_tools": [],
            "tool_results": [],
        }

        with patch('app.dependencies.llm_client') as mock_llm:
            mock_llm.invoke = AsyncMock(return_value={
                "content": '{"need_more_data": false, "steps": [], "reasoning": "Thanks detected"}',
                "model": "test-model",
                "tokens_in": 10,
                "tokens_out": 5,
                "latency_ms": 50,
            })

            result = await agent_graph.ainvoke(initial_state)

            # Verify no tools were called
            tools_called = result.get("executed_tools", [])
            assert tools_called == [], f"Expected no tools to be called, but got: {tools_called}"


class TestWorkspaceQueryBehavior:
    """Test 2: Workspace queries should call specific tools."""

    @pytest.mark.asyncio
    async def test_overloaded_query_calls_correct_tools(self):
        """Test that 'who is overloaded?' calls search_users and search_analytics."""
        initial_state = {
            "raw_input": "who is overloaded?",
            "space_id": "test-space-001",
            "user_id": "test-user",
            "user_name": "Test User",
            "user_role": "Member",
            "space_name": "Test Space",
            "board_name": "All Boards",
            "trace_id": "test-trace-overload",
            "rewritten_query": "",
            "intent": "",
            "retrieved_context": [],
            "task_data": [],
            "final_response": "",
            "proposed_action": None,
            "approval_status": None,
            "response_metadata": {},
            "executed_tools": [],
            "tool_results": [],
        }

        # Mock tools to return data
        mock_users_data = {
            "john.doe": {
                "email": "john@example.com",
                "role": "Member",
                "active_tasks": 8,
                "estimated_hours": 45.0,
                "workload_status": "HIGH"
            }
        }

        mock_analytics_data = {
            "total_tasks": 100,
            "status_distribution": {"TODO": 10, "IN_PROGRESS": 50, "DONE": 40},
            "priority_distribution": {"HIGH": 20, "MEDIUM": 50, "LOW": 30},
            "overdue_tasks_count": 5
        }

        mock_search_users = AsyncMock(return_value='{"john.doe": {"email": "john@example.com", "role": "Member", "active_tasks": 8}}')
        mock_search_analytics = AsyncMock(return_value='{"total_tasks": 100, "overdue_tasks_count": 5}')

        with patch('app.dependencies.llm_client') as mock_llm, \
             patch.dict('app.agents.scheduler.TOOL_FUNCTION_MAP', {
                 'search_users': mock_search_users,
                 'search_analytics': mock_search_analytics
             }):

            mock_llm.invoke = AsyncMock(return_value={
                "content": '{"answer": "Based on the data, John Doe is overloaded with 8 active tasks.", "summary": "One team member is overloaded", "insights": [], "risks": [], "suggested_actions": [], "citations": [], "warnings": []}',
                "model": "test-model",
                "tokens_in": 200,
                "tokens_out": 100,
                "latency_ms": 300,
            })

            result = await agent_graph.ainvoke(initial_state)

            # Verify the correct tools were called
            tools_called = result.get("executed_tools", [])
            assert "search_users" in tools_called, f"Expected 'search_users' to be called, but got: {tools_called}"
            assert "search_analytics" in tools_called, f"Expected 'search_analytics' to be called, but got: {tools_called}"

            # Verify we got a meaningful response
            response = result.get("final_response", "")
            assert len(response) > 0, "Expected a non-empty response"
            assert "overload" in response.lower() or "workload" in response.lower(), \
                f"Expected response to mention overload/workload, got: {response[:100]}"


class TestErrorHandlingBehavior:
    """Test 3: Backend failures should show user-friendly errors."""

    @pytest.mark.asyncio
    async def test_backend_failure_shows_user_friendly_error(self):
        """Test that when NestJS is down, we get 'Could not access workspace data' not 'Unexpected error'."""
        initial_state = {
            "raw_input": "who is overloaded?",
            "space_id": "test-space-001",
            "user_id": "test-user",
            "user_name": "Test User",
            "user_role": "Member",
            "space_name": "Test Space",
            "board_name": "All Boards",
            "trace_id": "test-trace-error",
            "rewritten_query": "",
            "intent": "",
            "retrieved_context": [],
            "task_data": [],
            "final_response": "",
            "proposed_action": None,
            "approval_status": None,
            "response_metadata": {},
            "executed_tools": [],
            "tool_results": [],
        }

        mock_search_users = AsyncMock(return_value='{"error": "Unable to retrieve team member details", "details": "Connection refused"}')
        mock_search_analytics = AsyncMock(return_value='{"error": "Unable to retrieve analytics data", "details": "Connection refused"}')

        with patch('app.dependencies.llm_client') as mock_llm, \
             patch.dict('app.agents.scheduler.TOOL_FUNCTION_MAP', {
                 'search_users': mock_search_users,
                 'search_analytics': mock_search_analytics
             }):

            mock_llm.invoke = AsyncMock()

            result = await agent_graph.ainvoke(initial_state)

            # Verify user-friendly error message
            response = result.get("final_response", "")

            # Should NOT contain generic "Unexpected error"
            assert "unexpected error" not in response.lower(), \
                f"Got generic 'Unexpected error' message. Response: {response[:200]}"

            # Should NOT contain technical details
            assert "connection refused" not in response.lower(), \
                f"Leaked technical details. Response: {response[:200]}"

            # Should contain user-friendly messaging
            assert any(phrase in response.lower() for phrase in [
                "couldn't access",
                "unable to access",
                "workspace data",
                "retry",
            ]), f"Expected user-friendly error message, got: {response[:300]}"

            # Verify no fake data was generated
            metadata = result.get("response_metadata", {})
            assert metadata.get("citations") == [], "Should not generate fake citations on error"
            assert metadata.get("actions") == [], "Should not generate fake actions on error"
            assert metadata.get("risks") == [], "Should not generate fake risks on error"


class TestProductBehavioralContracts:
    """Test cases representing exact product behavioral contracts (Problem 5)."""

    @pytest.mark.asyncio
    async def test_greeting_behavioral_contract(self):
        """Input: 'hi' -> Expected: tools_called = [], actions = [], ui = chat_bubble (no metadata cards)."""
        initial_state = {
            "raw_input": "hi",
            "space_id": "space-1",
            "user_id": "user-1",
            "user_name": "Test User",
            "user_role": "Member",
            "space_name": "Workspace",
            "board_name": "Board",
            "trace_id": "trace-hi",
            "executed_tools": [],
            "tool_results": [],
        }

        with patch('app.dependencies.llm_client') as mock_llm:
            mock_llm.invoke = AsyncMock(return_value={
                "content": '{"answer": "Hi Thomas 👋\\n\\nI\'m Mongez AI...", "summary": "Greeting", "insights": [], "risks": [], "suggested_actions": [], "citations": [], "warnings": []}',
                "model": "test-model",
                "tokens_in": 10,
                "tokens_out": 10,
                "latency_ms": 10,
            })

            result = await agent_graph.ainvoke(initial_state)

            assert result.get("executed_tools", []) == []
            
            metadata = result.get("response_metadata", {})
            assert metadata.get("actions") == []
            assert metadata.get("summary") == "Greeting"
            assert not metadata.get("insights")
            assert not metadata.get("risks")

    @pytest.mark.asyncio
    async def test_workspace_summary_behavioral_contract(self):
        """Input: 'tell me my tasks' -> Expected: tools_called = ['search_tasks'], actions = []."""
        initial_state = {
            "raw_input": "tell me my tasks",
            "space_id": "space-1",
            "user_id": "user-1",
            "user_name": "Test User",
            "user_role": "Member",
            "space_name": "Workspace",
            "board_name": "Board",
            "trace_id": "trace-tasks",
            "executed_tools": [],
            "tool_results": [],
        }

        mock_search_tasks = AsyncMock(return_value='[{"id": "t1", "title": "Implement auth", "status": "IN_PROGRESS"}]')
        mock_search_boards = AsyncMock(return_value='[{"id": "b1", "name": "Sprint 1"}]')

        with patch('app.dependencies.llm_client') as mock_llm, \
             patch.dict('app.agents.scheduler.TOOL_FUNCTION_MAP', {
                 'search_tasks': mock_search_tasks,
                 'search_boards': mock_search_boards
             }):

            mock_llm.invoke = AsyncMock(return_value={
                "content": '{"answer": "You currently have 1 task in progress.", "summary": "Workspace task list", "insights": [], "risks": [], "suggested_actions": [{"command_type": "CreateTask", "payload": {}, "reason": "suggested task"}], "citations": [], "warnings": []}',
                "model": "test-model",
                "tokens_in": 200,
                "tokens_out": 100,
                "latency_ms": 100,
            })

            result = await agent_graph.ainvoke(initial_state)

            # Assert correct tools were called
            tools = result.get("executed_tools", [])
            assert "search_tasks" in tools

            # Assert proposed actions is empty because query did NOT contain action keywords (create, plan, build, generate, organize, automate)
            metadata = result.get("response_metadata", {})
            assert metadata.get("actions") == []

    @pytest.mark.asyncio
    async def test_planning_request_behavioral_contract(self):
        """Input: 'build me an LMS' -> Expected: actions = ['CreateTask']."""
        initial_state = {
            "raw_input": "build me an LMS",
            "space_id": "space-1",
            "user_id": "user-1",
            "user_name": "Test User",
            "user_role": "Member",
            "space_name": "Workspace",
            "board_name": "Board",
            "trace_id": "trace-lms",
            "executed_tools": [],
            "tool_results": [],
        }

        mock_search_users = AsyncMock(return_value='{}')

        with patch('app.dependencies.llm_client') as mock_llm, \
             patch.dict('app.agents.scheduler.TOOL_FUNCTION_MAP', {
                 'search_users': mock_search_users
             }):

            mock_llm.invoke = AsyncMock(return_value={
                "content": '{"answer": "LMS project plan generated.", "tasks": [{"title": "Phase 1: Requirements", "description": "LMS Requirements", "priority": "HIGH", "estimated_hours": 8, "assignees": []}]}',
                "model": "test-model",
                "tokens_in": 200,
                "tokens_out": 100,
                "latency_ms": 100,
            })

            result = await agent_graph.ainvoke(initial_state)

            # Assert actions were generated because the query contains "build" and is planner intent
            metadata = result.get("response_metadata", {})
            actions = [a["commandType"] for a in metadata.get("actions", [])]
            assert "CreateTask" in actions


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
