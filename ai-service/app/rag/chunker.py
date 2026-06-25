"""Document chunker — splits comments and audit log entries into embeddable chunks.

Each chunk is prefixed with structured metadata so the embedding captures WHO said
WHAT about WHICH task and WHEN. This dramatically improves retrieval quality compared
to embedding raw text without context.

Example output chunk:
    "Task #EDU-042, Board: Funding, Author: Omar, Date: 2024-03-15 —
     The client changed requirements yesterday, we need to redesign
     the payment flow before proceeding."
"""
import logging
from langchain_text_splitters import RecursiveCharacterTextSplitter

logger = logging.getLogger(__name__)


class DocumentChunker:
    """Splits documents into 512-character chunks with contextual metadata prefix.

    Chunk overlap of 64 characters ensures context is not lost at boundaries.
    The metadata prefix is included in the embedded text so the vector space
    captures entity relationships, not just semantic content.
    """

    def __init__(self) -> None:
        self.splitter = RecursiveCharacterTextSplitter(
            chunk_size=512,
            chunk_overlap=64,
            separators=["\n\n", "\n", ". ", " ", ""],
            length_function=len,
        )

    def chunk_comment(self, comment: dict) -> list[dict]:
        """Chunk a single task comment into embeddable pieces with metadata.

        Args:
            comment: Dict with keys: id, content, taskId, createdAt,
                     user (nested dict with name)

        Returns:
            List of chunk dicts: {"text": str, "metadata": dict}
            Returns empty list if comment has no content.
        """
        text = (comment.get("content") or "").strip()
        if not text:
            return []

        task_id = comment.get("taskId", "")
        author = (comment.get("user") or {}).get("name", "Unknown")
        date = str(comment.get("createdAt", ""))[:10]  # date part only
        comment_id = comment.get("id", "")

        metadata = {
            "source_type": "comment",
            "task_id": task_id,
            "author": author,
            "date": date,
            "comment_id": comment_id,
        }
        prefix = f"Task #{task_id}, Author: {author}, Date: {date}"

        chunks = self.splitter.split_text(text)
        logger.debug("Chunked comment %s → %d chunks", comment_id, len(chunks))
        return [
            {"text": f"{prefix} — {chunk}", "metadata": {**metadata, "chunk_index": idx}}
            for idx, chunk in enumerate(chunks)
        ]

    def chunk_audit_log(self, entry: dict) -> list[dict]:
        """Chunk a single audit log entry into embeddable pieces.

        Args:
            entry: Dict with keys: id, action, entityType, entityId,
                   diff (JSON/str), timestamp, userId

        Returns:
            List of chunk dicts: {"text": str, "metadata": dict}
        """
        action = entry.get("action", "")
        diff = str(entry.get("diff") or "")
        text = f"Action: {action}. Changes: {diff}".strip()
        if not text or text == "Action: . Changes:":
            return []

        entity_type = entry.get("entityType", "")
        entity_id = entry.get("entityId", "")
        date = str(entry.get("timestamp", ""))[:10]
        audit_id = entry.get("id", "")
        user_id = entry.get("userId", "")

        metadata = {
            "source_type": "audit_log",
            "entity_type": entity_type,
            "entity_id": entity_id,
            "user_id": user_id,
            "date": date,
            "audit_id": audit_id,
        }
        prefix = f"{entity_type} #{entity_id}, Date: {date}"

        chunks = self.splitter.split_text(text)
        logger.debug("Chunked audit log %s → %d chunks", audit_id, len(chunks))
        return [
            {"text": f"{prefix} — {chunk}", "metadata": {**metadata, "chunk_index": idx}}
            for idx, chunk in enumerate(chunks)
        ]

    def chunk_task_description(self, task: dict) -> list[dict]:
        """Chunk a task's title + description for semantic search.

        Args:
            task: Dict with keys: id, identifier, title, description,
                  status, priority, board (nested)

        Returns:
            List of chunk dicts, or empty list if no content.
        """
        title = task.get("title", "").strip()
        description = (task.get("description") or "").strip()
        if not title and not description:
            return []

        identifier = task.get("identifier", task.get("id", ""))
        board_name = (task.get("board") or {}).get("name", "")
        status = task.get("status", "")
        priority = task.get("priority", "")

        metadata = {
            "source_type": "task",
            "task_id": task.get("id", ""),
            "identifier": identifier,
            "status": status,
            "priority": priority,
            "board": board_name,
            "date": str(task.get("createdAt", ""))[:10],
        }
        prefix = f"Task #{identifier}, Board: {board_name}, Status: {status}, Priority: {priority}"
        full_text = f"{title}. {description}" if description else title

        chunks = self.splitter.split_text(full_text)
        return [
            {"text": f"{prefix} — {chunk}", "metadata": {**metadata, "chunk_index": idx}}
            for idx, chunk in enumerate(chunks)
        ]
