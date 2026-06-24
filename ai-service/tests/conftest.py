import os
import pytest
from unittest.mock import AsyncMock, MagicMock
from fastapi.testclient import TestClient

# Ensure GROQ_API_KEY is present before config is imported
os.environ["GROQ_API_KEY"] = "mock-key-for-testing"
os.environ["SERVICE_API_KEY"] = "test-key"

# Apply Class-Level mocks BEFORE importing app to intercept lifespan creation
from app.clients.llm_client import LLMClient
from app.clients.nestjs_client import NestJSClient
from app.rag.embedder import Embedder
from app.rag.retriever import DenseRetriever
from app.rag.indexer import QdrantIndexer

# 1. Mock LLMClient methods
class MockLLMClient:
    async def invoke(self, tier: str, system_prompt: str, user_message: str):
        system_prompt_lower = system_prompt.lower()
        user_message_lower = user_message.lower()

        # Routing node mock
        if "classify this user query" in system_prompt_lower:
            if "risk" in user_message_lower or "delay" in user_message_lower or "block" in user_message_lower:
                content = "risk"
            elif "report" in user_message_lower or "summary" in user_message_lower:
                content = "report"
            elif "assign" in user_message_lower or "reassign" in user_message_lower or "update" in user_message_lower:
                content = "action"
            else:
                content = "chat"
            return {"content": content, "model": "mock-fast-model", "latency_ms": 10, "tokens_in": 10, "tokens_out": 2}

        # Query rewriter mock
        if "rewriter" in system_prompt_lower or "rewrite" in system_prompt_lower:
            if "ignore" in user_message_lower:
                content = "Cleaned Query"
            else:
                content = user_message
            return {"content": content, "model": "mock-fast-model", "latency_ms": 10, "tokens_in": 15, "tokens_out": 15}

        # Content generation nodes mock
        if "risk analyst" in system_prompt_lower:
            content = '{"risk": "HIGH", "reason": "delay detected", "confidence": 0.9, "issues": [{"type": "overdue", "description": "delayed", "severity": "HIGH"}], "suggested_actions": ["reassign"]}'
        elif "report writer" in system_prompt_lower:
            content = "# Project Status Report\n- All tasks on track."
        else:
            content = "Mocked assistant response for general chat."

        return {
            "content": content,
            "model": "mock-primary-model",
            "latency_ms": 50,
            "tokens_in": 100,
            "tokens_out": 50,
        }

    async def stream(self, tier: str, system_prompt: str, user_message: str):
        tokens = ["Mocked", " assistant", " response", " stream."]
        for token in tokens:
            yield token

LLMClient.invoke = MockLLMClient.invoke
LLMClient.stream = MockLLMClient.stream

# 2. Mock NestJSClient methods
async def mock_get_tasks(self, space_id, board_id=None):
    return [{"id": "task-1", "title": "Test Task", "status": "TODO"}]

async def mock_get_comments(self, task_id):
    return []

async def mock_get_comments_by_space(self, space_id):
    return []

async def mock_get_audit_log(self, space_id):
    return []

async def mock_get_schema(self):
    return {}

async def mock_propose_action(self, trace_id, space_id, action):
    return {"id": "action-123", "status": "PENDING"}

async def mock_update_ai_request(self, trace_id, updates):
    return None

async def mock_close(self):
    return None

NestJSClient.get_tasks = mock_get_tasks
NestJSClient.get_comments = mock_get_comments
NestJSClient.get_comments_by_space = mock_get_comments_by_space
NestJSClient.get_audit_log = mock_get_audit_log
NestJSClient.get_schema = mock_get_schema
NestJSClient.propose_action = mock_propose_action
NestJSClient.update_ai_request = mock_update_ai_request
NestJSClient.close = mock_close

# 3. Mock Embedder constructor and methods
def mock_embedder_init(self, model_name="BAAI/bge-m3"):
    self.dimension = 1024
    self.model_name = model_name

def mock_embed(self, texts):
    return [[0.0] * 1024 for _ in texts]

def mock_embed_single(self, text):
    return [0.0] * 1024

Embedder.__init__ = mock_embedder_init
Embedder.embed = mock_embed
Embedder.embed_single = mock_embed_single
Embedder.embed_query = mock_embed_single

# 4. Mock Retriever and Indexer
async def mock_retrieve(query, space_id, top_k=5, task_ids=None, source_types=None):
    return [{"text": "Mocked context", "score": 0.9, "metadata": {"space_id": space_id}}]

def mock_format_as_xml_context(self, results):
    return "<context>Mocked XML context</context>"

async def mock_index(*args, **kwargs):
    return None

DenseRetriever.retrieve = AsyncMock(side_effect=mock_retrieve)
DenseRetriever.format_as_xml_context = mock_format_as_xml_context
QdrantIndexer.index = AsyncMock(side_effect=mock_index)


from app.agents.graph import agent_graph
import types

class MockChunk:
    def __init__(self, content):
        self.content = content

async def mock_astream_events(self, input, *args, **kwargs):
    message = input.get("raw_input", "").lower() if isinstance(input, dict) else ""
    if "risk" in message or "delay" in message:
        intent = "risk"
    elif "report" in message or "summary" in message:
        intent = "report"
    elif "assign" in message or "reassign" in message:
        intent = "action"
    else:
        intent = "chat"
        
    yield {
        "event": "on_chain_end",
        "name": "intent_router",
        "data": {
            "output": {
                "intent": intent
            }
        }
    }
    
    tokens = ["Mocked", " assistant", " response", " stream."]
    for t in tokens:
        yield {
            "event": "on_chat_model_stream",
            "name": "chat_responder",
            "metadata": {
                "langgraph_node": "chat_responder"
            },
            "data": {
                "chunk": MockChunk(t)
            }
        }

agent_graph.astream_events = types.MethodType(mock_astream_events, agent_graph)


from app.main import app
import app.dependencies as deps
from app.prompts.loader import PromptLoader
from app.config import get_settings


@pytest.fixture(autouse=True)
def setup_dependencies():
    """Setup dependencies mock objects to prevent calling external APIs."""
    # Ensure they are correctly set in dependencies module
    settings = get_settings()
    deps.llm_client = LLMClient(settings)
    deps.nestjs_client = NestJSClient(settings)
    deps.embedder = Embedder()
    
    # Reset class-level mocks so their call history is cleared
    if hasattr(DenseRetriever.retrieve, "reset_mock"):
        DenseRetriever.retrieve.reset_mock()
    if hasattr(QdrantIndexer.index, "reset_mock"):
        QdrantIndexer.index.reset_mock()

    deps.retriever = DenseRetriever(settings.qdrant_url, deps.embedder)
    deps.indexer = QdrantIndexer(settings.qdrant_url, deps.embedder)
    
    # Real prompt loader is offline and fast
    deps.prompt_loader = PromptLoader()
    yield deps


@pytest.fixture
def client():
    with TestClient(app) as c:
        yield c
