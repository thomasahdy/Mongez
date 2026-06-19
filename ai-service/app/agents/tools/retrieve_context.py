"""RAG retrieval tool — wraps DenseRetriever for use in LangGraph nodes."""
import logging
from app.agents.state import MongezAgentState

logger = logging.getLogger(__name__)


async def retrieve_context(
    query: str,
    space_id: str,
    top_k: int = 5,
    task_ids: list[str] | None = None,
    source_types: list[str] | None = None,
) -> list[dict]:
    """Fetch semantically relevant chunks from Qdrant for a given query.

    This is a convenience wrapper used in nodes that need more control
    over retrieval parameters than the default node implementations.

    Returns:
        List of result dicts: [{"text", "score", "metadata"}, ...]
    """
    from app.dependencies import retriever
    return await retriever.retrieve(
        query=query,
        space_id=space_id,
        top_k=top_k,
        task_ids=task_ids,
        source_types=source_types,
    )
