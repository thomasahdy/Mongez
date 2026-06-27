"""Dense retriever — finds semantically relevant context from Qdrant.

Uses vector similarity search (cosine distance) to find the most relevant
document chunks for a given query. Results are tenant-isolated by space_id.

This is Phase 3's simplified dense-only retriever.
Hybrid retrieval (BM25 + dense re-ranking) is planned for Phase 7.
"""
import logging
from typing import Optional

from qdrant_client import QdrantClient
from qdrant_client.models import Filter, FieldCondition, MatchAny, MatchValue

from app.rag.embedder import Embedder

logger = logging.getLogger(__name__)

# Minimum cosine similarity score to include a result (0.0–1.0)
DEFAULT_SCORE_THRESHOLD = 0.45


class DenseRetriever:
    """Retrieves relevant context chunks via dense vector similarity search.

    All searches are scoped to a single space's Qdrant collection, ensuring
    strict tenant isolation — a query for space A will never return chunks
    from space B.

    Usage:
        retriever = DenseRetriever(qdrant_url, embedder)

        # Basic retrieval
        results = await retriever.retrieve("overdue tasks in funding board", space_id)

        # Filter to specific tasks
        results = await retriever.retrieve("payment flow issue", space_id,
                                           task_ids=["task-uuid-1", "task-uuid-2"])

        # Format for LLM prompt
        context_xml = retriever.format_as_xml_context(results)
    """

    def __init__(self, qdrant_url: str, embedder: Embedder) -> None:
        self.client = QdrantClient(url=qdrant_url, check_compatibility=False)
        self.embedder = embedder
        logger.info("DenseRetriever initialised | url=%s", qdrant_url)

    def collection_name(self, space_id: str) -> str:
        return f"mongez_{space_id}"

    async def retrieve(
        self,
        query: str,
        space_id: str,
        top_k: int = 5,
        task_ids: Optional[list[str]] = None,
        source_types: Optional[list[str]] = None,
        score_threshold: float = DEFAULT_SCORE_THRESHOLD,
    ) -> list[dict]:
        """Search for relevant context chunks in a space's collection.

        Args:
            query: The user's question or search query
            space_id: Tenant isolation — only searches this space's collection
            top_k: Maximum number of results to return
            task_ids: If provided, filter results to chunks from these tasks only
            source_types: If provided, filter by source type ("comment", "audit_log", "task")
            score_threshold: Minimum cosine similarity (0.0–1.0) to include result

        Returns:
            List of result dicts:
            [{"text": str, "score": float, "metadata": dict}, ...]
            Returns [] if the collection doesn't exist or no results pass the threshold.
        """
        col = self.collection_name(space_id)

        # Check dimension mismatch and delete if incorrect
        if self.client.collection_exists(col):
            try:
                info = self.client.get_collection(col)
                if info.config.params.vectors.size != self.embedder.dimension:
                    logger.warning(
                        "Collection %s exists with incorrect dimension %d (expected %d). Deleting to force recreate...",
                        col, info.config.params.vectors.size, self.embedder.dimension
                    )
                    self.client.delete_collection(col)
            except Exception as exc:
                logger.warning("Failed to check collection dimension for %s: %s", col, exc)

        # Guard: if collection doesn't exist, attempt to index on the fly
        if not self.client.collection_exists(col):
            logger.info("Collection %s not found — space not yet indexed. Attempting on-the-fly indexing...", col)
            try:
                from app import dependencies
                indexer = dependencies.get_indexer()
                if dependencies.nestjs_client and indexer:
                    import asyncio
                    tasks_coro = dependencies.nestjs_client.get_tasks(space_id)
                    audit_coro = dependencies.nestjs_client.get_audit_log(space_id)
                    comments_coro = dependencies.nestjs_client.get_comments_by_space(space_id)
                    
                    tasks, audit_logs, comments = await asyncio.gather(tasks_coro, audit_coro, comments_coro)

                    indexer.index_tasks(space_id, tasks)
                    indexer.index_audit_logs(space_id, audit_logs)
                    indexer.index_comments(space_id, comments)
                    logger.info("On-the-fly indexing successful for space: %s", space_id)
            except Exception as e:
                logger.error("Failed on-the-fly indexing for space %s: %s", space_id, e)

        if not self.client.collection_exists(col):
            logger.warning(
                "Collection %s not found — space not yet indexed. Returning empty context.", col
            )
            return []

        # Embed the query
        query_vector = self.embedder.embed_query(query)

        # Build compound filter
        must_conditions = []
        if task_ids:
            must_conditions.append(
                FieldCondition(key="task_id", match=MatchAny(any=task_ids))
            )
        if source_types:
            # Qdrant doesn't support OR on the same field in a single FieldCondition,
            # so we use MatchAny which handles multiple values naturally
            must_conditions.append(
                FieldCondition(key="source_type", match=MatchAny(any=source_types))
            )

        query_filter = Filter(must=must_conditions) if must_conditions else None

        # Execute the search using query_points (qdrant-client >=1.7)
        response = self.client.query_points(
            collection_name=col,
            query=query_vector,
            limit=top_k,
            query_filter=query_filter,
            score_threshold=score_threshold,
        )
        hits = response.points

        results = [
            {
                "text": hit.payload.get("text", ""),
                "score": round(hit.score, 4),
                "metadata": {
                    "source_type": hit.payload.get("source_type"),
                    "task_id": hit.payload.get("task_id"),
                    "author": hit.payload.get("author"),
                    "date": hit.payload.get("date"),
                    "comment_id": hit.payload.get("comment_id"),
                    "audit_id": hit.payload.get("audit_id"),
                    "entity_type": hit.payload.get("entity_type"),
                },
            }
            for hit in hits
        ]

        logger.debug(
            "Retrieved %d chunks for query=%r space=%s (threshold=%.2f)",
            len(results), query[:60], space_id, score_threshold,
        )
        return results

    def retrieve_sync(
        self,
        query: str,
        space_id: str,
        top_k: int = 5,
        task_ids: Optional[list[str]] = None,
        source_types: Optional[list[str]] = None,
        score_threshold: float = DEFAULT_SCORE_THRESHOLD,
    ) -> list[dict]:
        """Synchronous wrapper around retrieve() for use in sync contexts.

        Qdrant's Python client is sync by default, so this is actually the
        primary implementation — retrieve() just wraps it in an async signature.
        """
        col = self.collection_name(space_id)

        # Check dimension mismatch and delete if incorrect
        if self.client.collection_exists(col):
            try:
                info = self.client.get_collection(col)
                if info.config.params.vectors.size != self.embedder.dimension:
                    logger.warning(
                        "Collection %s exists with incorrect dimension %d (expected %d). Deleting to force recreate...",
                        col, info.config.params.vectors.size, self.embedder.dimension
                    )
                    self.client.delete_collection(col)
            except Exception as exc:
                logger.warning("Failed to check collection dimension for %s: %s", col, exc)

        if not self.client.collection_exists(col):
            return []

        query_vector = self.embedder.embed_query(query)

        must_conditions = []
        if task_ids:
            must_conditions.append(
                FieldCondition(key="task_id", match=MatchAny(any=task_ids))
            )
        if source_types:
            must_conditions.append(
                FieldCondition(key="source_type", match=MatchAny(any=source_types))
            )

        query_filter = Filter(must=must_conditions) if must_conditions else None

        response = self.client.query_points(
            collection_name=col,
            query=query_vector,
            limit=top_k,
            query_filter=query_filter,
            score_threshold=score_threshold,
        )
        hits = response.points

        return [
            {
                "text": hit.payload.get("text", ""),
                "score": round(hit.score, 4),
                "metadata": {
                    "source_type": hit.payload.get("source_type"),
                    "task_id": hit.payload.get("task_id"),
                    "author": hit.payload.get("author"),
                    "date": hit.payload.get("date"),
                    "comment_id": hit.payload.get("comment_id"),
                    "audit_id": hit.payload.get("audit_id"),
                    "entity_type": hit.payload.get("entity_type"),
                },
            }
            for hit in hits
        ]

    def format_as_xml_context(self, results: list[dict]) -> str:
        """Format retrieved chunks as XML for LLM prompt injection.

        The XML structure helps the LLM:
        1. Distinguish retrieved context from its own training knowledge
        2. Cite specific sources (chunk ID, task ID, author)
        3. Know when context is empty and respond accordingly

        Example output:
            <context>
              <chunk id="1" source="comment" task="task-uuid" author="Omar"
                     date="2024-03-15" relevance="0.87">
                Task #EDU-042, Author: Omar, Date: 2024-03-15 — The client
                changed requirements yesterday...
              </chunk>
            </context>
        """
        if not results:
            return "<context>No relevant context found in the knowledge base.</context>"

        chunks = []
        for i, r in enumerate(results, 1):
            meta = r["metadata"]
            source = meta.get("source_type", "unknown")
            task_id = meta.get("task_id", "")
            author = meta.get("author", "")
            date = meta.get("date", "")
            score = r["score"]
            text = r["text"].replace("<", "&lt;").replace(">", "&gt;")  # escape XML

            chunks.append(
                f'  <chunk id="{i}" source="{source}" task="{task_id}" '
                f'author="{author}" date="{date}" relevance="{score}">\n'
                f"    {text}\n"
                f"  </chunk>"
            )

        return f"<context>\n{''.join(chunks)}\n</context>"

    def format_as_plain_context(self, results: list[dict]) -> str:
        """Format retrieved chunks as plain text (simpler alternative to XML).

        Use this when the LLM struggles with XML formatting.
        """
        if not results:
            return "No relevant context found."

        lines = ["Relevant context from the knowledge base:\n"]
        for i, r in enumerate(results, 1):
            meta = r["metadata"]
            lines.append(
                f"[{i}] ({meta.get('source_type', '?')}, score={r['score']:.2f}) "
                f"{r['text']}\n"
            )
        return "\n".join(lines)
