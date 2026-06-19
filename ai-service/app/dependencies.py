"""Singleton dependency container for the Python AI service.

All heavy singletons (LLM client, embedder, retriever, prompt loader, NestJS client)
are initialised ONCE in app.main's lifespan and stored in app.state.
This module provides simple module-level accessors that the agent nodes import.

Why module-level globals instead of FastAPI Depends():
  LangGraph node functions are plain async functions, not FastAPI route handlers,
  so they cannot use FastAPI's dependency injection system. Module-level
  references that are set at startup are the idiomatic solution.

Usage in nodes:
    from app.dependencies import llm_client, prompt_loader, retriever, nestjs_client

Setup (called once in app.main lifespan):
    from app import dependencies
    dependencies.llm_client = LLMClient(settings)
    ...
"""
from __future__ import annotations
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from app.clients.llm_client import LLMClient
    from app.clients.nestjs_client import NestJSClient
    from app.rag.embedder import Embedder
    from app.rag.indexer import QdrantIndexer
    from app.rag.retriever import DenseRetriever
    from app.prompts.loader import PromptLoader

# These are set by app.main during lifespan startup.
# They are None until the app has started — nodes must not be called before startup.
llm_client: "LLMClient | None" = None
nestjs_client: "NestJSClient | None" = None
embedder: "Embedder | None" = None
indexer: "QdrantIndexer | None" = None
retriever: "DenseRetriever | None" = None
prompt_loader: "PromptLoader | None" = None
