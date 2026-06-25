import os
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI

from app.config import get_settings
from app.api.routes import health
from app.api.middleware.trace import TraceMiddleware
from app.clients.llm_client import LLMClient
from app.clients.nestjs_client import NestJSClient
from app.rag.embedder import Embedder
from app.rag.indexer import QdrantIndexer
from app.rag.retriever import DenseRetriever
from app.prompts.loader import PromptLoader
from app import dependencies

# ── Logging ───────────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.DEBUG if os.getenv("DEBUG", "false").lower() == "true" else logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s %(message)s",
)
logger = logging.getLogger(__name__)


# ── Application State ─────────────────────────────────────────────────────────
class AppState:
    """Holds shared singletons accessible via request.app.state."""
    llm: LLMClient
    nestjs: NestJSClient


# ── Application Lifespan ──────────────────────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup and shutdown lifecycle hook.

    Creates long-lived singletons (LLM client, NestJS HTTP client) at startup
    and cleans them up on shutdown.
    """
    settings = get_settings()

    # ── Enable LangSmith tracing if configured ────────────────────────────────
    if settings.langsmith_api_key:
        os.environ["LANGCHAIN_TRACING_V2"] = "true"
        os.environ["LANGCHAIN_API_KEY"] = settings.langsmith_api_key
        os.environ["LANGCHAIN_PROJECT"] = settings.langsmith_project
        logger.info("LangSmith tracing enabled (project: %s)", settings.langsmith_project)

    # ── Initialise singletons ─────────────────────────────────────────────────
    app.state.llm = LLMClient(settings)
    app.state.nestjs = NestJSClient(settings)

    # ── RAG pipeline (loads BGE-M3 embedding model) ───────────────────────────
    # This takes ~5s from cache or ~30s on first run (downloads ~2GB)
    app.state.embedder = Embedder()
    app.state.indexer = QdrantIndexer(
        qdrant_url=settings.qdrant_url,
        embedder=app.state.embedder,
    )
    app.state.retriever = DenseRetriever(
        qdrant_url=settings.qdrant_url,
        embedder=app.state.embedder,
    )
    app.state.prompt_loader = PromptLoader()

    # ── Wire singletons into the dependencies module (for LangGraph nodes) ───
    dependencies.llm_client = app.state.llm
    dependencies.nestjs_client = app.state.nestjs
    dependencies.embedder = app.state.embedder
    dependencies.indexer = app.state.indexer
    dependencies.retriever = app.state.retriever
    dependencies.prompt_loader = app.state.prompt_loader

    # ── Startup banner ────────────────────────────────────────────────────────
    logger.info("Mongez AI Service starting...")
    logger.info("   Groq primary model : %s", settings.groq_model_primary)
    logger.info("   Groq fast model    : %s", settings.groq_model_fast)
    logger.info("   NestJS backend     : %s", settings.nestjs_base_url)
    logger.info("   Qdrant             : %s", settings.qdrant_url)
    logger.info("   Redis              : %s", settings.redis_url)
    logger.info(
        "   LangSmith          : %s",
        "enabled" if settings.langsmith_api_key else "disabled",
    )

    yield  # ── Application runs here ────────────────────────────────────────

    # ── Shutdown cleanup ──────────────────────────────────────────────────────
    await app.state.nestjs.close()
    logger.info("Mongez AI Service shut down.")


# ── FastAPI Application ───────────────────────────────────────────────────────
app = FastAPI(
    title="Mongez AI Service",
    version="0.1.0",
    description="LangGraph-powered AI assistant for Mongez project management",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
)

# ── Middleware ────────────────────────────────────────────────────────────────
app.add_middleware(TraceMiddleware)

# ── Routes ────────────────────────────────────────────────────────────────────
app.include_router(health.router, prefix="/health", tags=["Health"])

# Agent routes — imported after app creation to avoid circular imports
from app.api.routes import chat as chat_route  # noqa: E402
from app.api.routes import risk as risk_route  # noqa: E402
from app.api.routes import report as report_route  # noqa: E402
from app.api.routes import meetings as meetings_route  # noqa: E402
from app.api.routes import rag as rag_route  # noqa: E402

app.include_router(chat_route.router, prefix="/chat", tags=["Chat"])
app.include_router(risk_route.router, prefix="/risk", tags=["Risk"])
app.include_router(report_route.router, prefix="/report", tags=["Report"])
app.include_router(meetings_route.router, prefix="/meetings", tags=["Meetings"])
app.include_router(rag_route.router, prefix="", tags=["RAG"])



