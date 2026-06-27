"""Singleton dependency container for the Python AI service.

Core singletons (LLM client, NestJS client) are initialised at startup.
RAG components (embedder, retriever, prompt loader) are lazy-loaded on first use.

Why module-level globals instead of FastAPI Depends():
  LangGraph node functions are plain async functions, not FastAPI route handlers,
  so they cannot use FastAPI's dependency injection system. Module-level
  references that are set at startup are the idiomatic solution.

Usage in nodes:
    from app.dependencies import llm_client, prompt_loader, retriever, nestjs_client

Setup (called once in app.main lifespan):
    from app import dependencies
    dependencies.llm_client = LLMClient(settings)
    dependencies._app = app  # For lazy loading
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
    from fastapi import FastAPI
    from app.config import Settings

# Core singletons - set at startup
llm_client: "LLMClient | None" = None
nestjs_client: "NestJSClient | None" = None
settings: "Settings | None" = None

# FastAPI app reference for lazy loading RAG components
_app: "FastAPI | None" = None


def _get_app() -> "FastAPI":
    """Get the FastAPI app instance for lazy loading."""
    global _app
    if _app is None:
        raise RuntimeError("App not initialized. Dependencies must be set after app startup.")
    return _app


def get_embedder() -> "Embedder":
    """Lazy-load embedder on first use."""
    from app.main import get_embedder
    return get_embedder(_get_app())


def get_indexer() -> "QdrantIndexer":
    """Lazy-load indexer on first use."""
    from app.main import get_indexer
    return get_indexer(_get_app())


def get_retriever() -> "DenseRetriever":
    """Lazy-load retriever on first use."""
    from app.main import get_retriever
    return get_retriever(_get_app())


def get_prompt_loader() -> "PromptLoader":
    """Lazy-load prompt loader on first use."""
    from app.main import get_prompt_loader
    return get_prompt_loader(_get_app())


def get_settings() -> "Settings":
    """Get settings instance."""
    global settings
    if settings is None:
        from app.config import get_settings as _get_settings
        settings = _get_settings()
    return settings
