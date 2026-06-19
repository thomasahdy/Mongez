import pytest
from app.agents.graph import agent_graph


@pytest.mark.asyncio
async def test_graph_routing_risk():
    """LangGraph should route queries containing 'risk' or 'delay' to the risk_detector."""
    initial_state = {
        "raw_input": "Is there any risk of delay?",
        "space_id": "space-1",
        "user_id": "user-1",
        "user_name": "Test User",
        "user_role": "Member",
        "space_name": "Workspace",
        "board_name": "Sprint 1",
        "trace_id": "t1",
    }
    
    result = await agent_graph.ainvoke(initial_state)
    assert result["intent"] == "risk"
    assert "Risk Level" in result["final_response"]


@pytest.mark.asyncio
async def test_graph_routing_report():
    """LangGraph should route queries requesting reports to the report_generator."""
    initial_state = {
        "raw_input": "Can you generate a project status report?",
        "space_id": "space-1",
        "user_id": "user-1",
        "user_name": "Test User",
        "user_role": "Member",
        "space_name": "Workspace",
        "board_name": "Sprint 1",
        "trace_id": "t2",
    }

    result = await agent_graph.ainvoke(initial_state)
    assert result["intent"] == "report"
    assert "# Project Status Report" in result["final_response"]


@pytest.mark.asyncio
async def test_graph_routing_action():
    """LangGraph should route command requests to the recommendation agent."""
    initial_state = {
        "raw_input": "Please reassign this task to Omar.",
        "space_id": "space-1",
        "user_id": "user-1",
        "user_name": "Test User",
        "user_role": "Member",
        "space_name": "Workspace",
        "board_name": "Sprint 1",
        "trace_id": "t3",
    }

    result = await agent_graph.ainvoke(initial_state)
    assert result["intent"] == "action"
    # Action node routes to recommendation and then human_gate
    # Since we mock LLM, recommendation returns proposed action and human_gate returns it
    assert result["approval_status"] is None or result["approval_status"] == "PENDING"


@pytest.mark.asyncio
async def test_graph_routing_chat():
    """LangGraph should route generic chat to the chat_responder."""
    initial_state = {
        "raw_input": "Hello! How does the project look?",
        "space_id": "space-1",
        "user_id": "user-1",
        "user_name": "Test User",
        "user_role": "Member",
        "space_name": "Workspace",
        "board_name": "Sprint 1",
        "trace_id": "t4",
    }

    result = await agent_graph.ainvoke(initial_state)
    assert result["intent"] == "chat"
    assert "Mocked assistant response" in result["final_response"]
