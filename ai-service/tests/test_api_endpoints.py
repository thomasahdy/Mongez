import pytest


def test_health_endpoint(client):
    """GET /health should return status and version."""
    res = client.get("/health")
    assert res.status_code == 200
    assert res.json()["status"] == "ok"


def test_chat_unauthorized(client):
    """POST /chat should reject request with missing or invalid service key."""
    res = client.post(
        "/chat",
        headers={"X-Service-API-Key": "wrong-key"},
        json={"message": "hello", "space_id": "s1", "user_id": "u1"},
    )
    assert res.status_code == 403

    res = client.post(
        "/chat",
        json={"message": "hello", "space_id": "s1", "user_id": "u1"},
    )
    assert res.status_code == 403


def test_chat_success(client):
    """POST /chat with valid key should invoke the graph pipeline."""
    res = client.post(
        "/chat",
        headers={"X-Service-API-Key": "test-key"},
        json={
            "message": "What tasks do we have?",
            "space_id": "space-1",
            "user_id": "user-1",
            "user_name": "Omar",
            "user_role": "PM",
            "space_name": "Development",
            "board_name": "Sprint 3",
        },
    )
    assert res.status_code == 200
    data = res.json()
    assert "trace_id" in data
    assert data["intent"] == "chat"
    assert "Mocked assistant response" in data["response"]


def test_chat_stream_success(client):
    """POST /chat/stream should stream SSE tokens."""
    res = client.post(
        "/chat/stream",
        headers={"X-Service-API-Key": "test-key"},
        json={"message": "What tasks do we have?", "space_id": "s1", "user_id": "u1"},
    )
    assert res.status_code == 200
    assert "text/event-stream" in res.headers["content-type"]
    
    # Read tokens from stream
    body = res.text
    tokens = []
    for line in body.splitlines():
        if line.startswith("data:"):
            try:
                import json
                data = json.loads(line[5:])
                if "token" in data:
                    tokens.append(data["token"])
            except Exception:
                pass
    reconstructed = "".join(tokens)
    assert "Mocked" in reconstructed
    assert "stream" in reconstructed
    assert '"done": true' in body


def test_analyze_risk_success(client):
    """POST /risk should analyze risk directly."""
    res = client.post(
        "/risk",
        headers={"X-Service-API-Key": "test-key"},
        json={
            "space_id": "space-1",
            "user_id": "user-1",
            "query": "Analyse risk level for the project",
        },
    )
    assert res.status_code == 200
    data = res.json()
    assert "trace_id" in data
    assert "Risk Level" in data["response"]


def test_generate_report_success(client):
    """POST /report should generate markdown report directly."""
    res = client.post(
        "/report",
        headers={"X-Service-API-Key": "test-key"},
        json={
            "space_id": "space-1",
            "user_id": "user-1",
            "query": "Create summary report",
        },
    )
    assert res.status_code == 200
    data = res.json()
    assert "trace_id" in data
    assert "# Project Status Report" in data["report"]


def test_index_unauthorized(client):
    """POST /index should reject request with missing or invalid service key."""
    res = client.post(
        "/index",
        json={"space_id": "space-1", "task_id": "task-1"},
    )
    assert res.status_code == 403


def test_index_success(client):
    """POST /index with valid key should successfully index task and comments."""
    res = client.post(
        "/index",
        headers={"X-Service-API-Key": "test-key"},
        json={"space_id": "space-1", "task_id": "task-1"},
    )
    assert res.status_code == 200
    data = res.json()
    assert data["success"] is True
    assert "points_indexed" in data


def test_retrieve_unauthorized(client):
    """POST /retrieve should reject request with missing or invalid service key."""
    res = client.post(
        "/retrieve",
        json={"space_id": "space-1", "query": "hello"},
    )
    assert res.status_code == 403


def test_retrieve_success(client):
    """POST /retrieve with valid key should return retrieved XML context."""
    res = client.post(
        "/retrieve",
        headers={"X-Service-API-Key": "test-key"},
        json={"space_id": "space-1", "query": "Find overdue tasks"},
    )
    assert res.status_code == 200
    data = res.json()
    assert "context" in data
    assert "Mocked XML context" in data["context"]

