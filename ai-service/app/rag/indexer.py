"""Qdrant Indexer — stores embedded document chunks in Qdrant.

Each Space gets its own Qdrant collection for strict tenant isolation.
Collection name format: mongez_{space_id}

The indexer handles:
- Collection creation (idempotent — safe to call multiple times)
- Chunking documents via DocumentChunker
- Embedding chunks via Embedder
- Upserting points into Qdrant (deduplication via UUIDs derived from source IDs)
"""
import logging
import uuid
from hashlib import md5

from qdrant_client import QdrantClient
from qdrant_client.models import (
    Distance,
    PointStruct,
    VectorParams,
)

from app.rag.chunker import DocumentChunker
from app.rag.embedder import Embedder

logger = logging.getLogger(__name__)


def _stable_uuid(source_id: str, chunk_index: int) -> str:
    """Generate a stable UUID from a source document ID + chunk index.

    Using a stable UUID means re-indexing the same content is idempotent —
    Qdrant upserts update existing points rather than creating duplicates.
    """
    raw = f"{source_id}:{chunk_index}"
    return str(uuid.UUID(md5(raw.encode()).hexdigest()))


class QdrantIndexer:
    """Indexes document chunks into Qdrant for semantic search.

    Usage:
        indexer = QdrantIndexer(qdrant_url="http://localhost:6333", embedder=embedder)

        # Index all comments for a space
        n = indexer.index_comments("space-uuid", comments)
        # → n points stored in collection mongez_{space_id}

        # Index audit logs
        n = indexer.index_audit_logs("space-uuid", audit_entries)

        # Index task descriptions
        n = indexer.index_tasks("space-uuid", tasks)
    """

    def __init__(self, qdrant_url: str, embedder: Embedder) -> None:
        self.client = QdrantClient(url=qdrant_url, check_compatibility=False)
        self.embedder = embedder
        self.chunker = DocumentChunker()
        logger.info("QdrantIndexer initialised | url=%s", qdrant_url)

    def collection_name(self, space_id: str) -> str:
        return f"mongez_{space_id}"

    def ensure_collection(self, space_id: str) -> None:
        """Create the Qdrant collection for a space if it does not exist.

        Idempotent — safe to call before every indexing operation.
        Uses COSINE distance to match L2-normalised BGE-M3 vectors.
        """
        name = self.collection_name(space_id)
        if not self.client.collection_exists(name):
            self.client.create_collection(
                collection_name=name,
                vectors_config=VectorParams(
                    size=self.embedder.dimension,
                    distance=Distance.COSINE,
                ),
            )
            logger.info("Created Qdrant collection: %s (dim=%d)", name, self.embedder.dimension)

    def _build_and_upsert(
        self, space_id: str, all_chunks: list[dict], source_key: str = "comment_id"
    ) -> int:
        """Embed all chunks and upsert into Qdrant. Returns number of points stored."""
        if not all_chunks:
            return 0

        texts = [c["text"] for c in all_chunks]
        vectors = self.embedder.embed(texts)

        points = [
            PointStruct(
                id=_stable_uuid(
                    chunk["metadata"].get(source_key, str(i)),
                    i,
                ),
                vector=vector,
                payload={**chunk["metadata"], "text": chunk["text"]},
            )
            for i, (chunk, vector) in enumerate(zip(all_chunks, vectors))
        ]

        col = self.collection_name(space_id)
        self.client.upsert(collection_name=col, points=points)
        logger.info("Upserted %d points into %s", len(points), col)
        return len(points)

    def index_comments(self, space_id: str, comments: list[dict]) -> int:
        """Chunk, embed, and store task comments.

        Args:
            space_id: Tenant identifier — stored in collection mongez_{space_id}
            comments: List of comment dicts from NestJS /internal/ai/comments/space/

        Returns:
            Number of points upserted into Qdrant.
        """
        self.ensure_collection(space_id)

        all_chunks: list[dict] = []
        for comment in comments:
            all_chunks.extend(self.chunker.chunk_comment(comment))

        return self._build_and_upsert(space_id, all_chunks, source_key="comment_id")

    def index_audit_logs(self, space_id: str, entries: list[dict]) -> int:
        """Chunk, embed, and store audit log entries.

        Args:
            space_id: Tenant identifier
            entries: List of audit log dicts from NestJS /internal/ai/audit-log/

        Returns:
            Number of points upserted.
        """
        self.ensure_collection(space_id)

        all_chunks: list[dict] = []
        for entry in entries:
            all_chunks.extend(self.chunker.chunk_audit_log(entry))

        return self._build_and_upsert(space_id, all_chunks, source_key="audit_id")

    def index_tasks(self, space_id: str, tasks: list[dict]) -> int:
        """Chunk, embed, and store task title+description.

        Indexes task content so users can find tasks by natural language description,
        not just by exact title/ID match.

        Args:
            space_id: Tenant identifier
            tasks: List of task dicts from NestJS /internal/ai/tasks/

        Returns:
            Number of points upserted.
        """
        self.ensure_collection(space_id)

        all_chunks: list[dict] = []
        for task in tasks:
            all_chunks.extend(self.chunker.chunk_task_description(task))

        return self._build_and_upsert(space_id, all_chunks, source_key="task_id")

    def delete_collection(self, space_id: str) -> None:
        """Delete a space's Qdrant collection (used in tests / space deletion)."""
        name = self.collection_name(space_id)
        if self.client.collection_exists(name):
            self.client.delete_collection(name)
            logger.info("Deleted Qdrant collection: %s", name)

    def get_collection_info(self, space_id: str) -> dict:
        """Return info about a space's collection (point count, status, etc.)."""
        name = self.collection_name(space_id)
        if not self.client.collection_exists(name):
            return {"exists": False, "points_count": 0}
        info = self.client.get_collection(name)
        return {
            "exists": True,
            "points_count": info.points_count,
            "status": str(info.status),
            "dimension": info.config.params.vectors.size,  # type: ignore[union-attr]
        }
