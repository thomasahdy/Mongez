"""
Phase 3 live test script -- tests the full RAG pipeline end-to-end.

Run from ai-service/ directory:
    .venv\\Scripts\\python scripts\\test_phase3.py

Requires:
  - Qdrant running at http://localhost:6333 (docker compose up -d qdrant)
  - sentence-transformers installed (BGE-M3 model downloaded)
"""
import sys
import time
import io
from pathlib import Path

if sys.platform == "win32":
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

sys.path.insert(0, str(Path(__file__).parent.parent))

from app.config import get_settings
from app.rag.chunker import DocumentChunker
from app.rag.embedder import Embedder
from app.rag.indexer import QdrantIndexer
from app.rag.retriever import DenseRetriever

SEP = "-" * 60
TEST_SPACE_ID = "test-space-phase3"

# Sample data to index
SAMPLE_COMMENTS = [
    {
        "id": "c1", "taskId": "task-001", "content":
        "The payment gateway integration is blocked by a missing API key from the client. "
        "We've been waiting for 3 days and the deadline is next Friday.",
        "createdAt": "2024-03-15T10:00:00Z",
        "user": {"name": "Omar"},
    },
    {
        "id": "c2", "taskId": "task-001", "content":
        "Update: client sent the API key. Unblocking the task now. Should finish today.",
        "createdAt": "2024-03-18T09:00:00Z",
        "user": {"name": "Sara"},
    },
    {
        "id": "c3", "taskId": "task-002", "content":
        "The database migration script is ready. Tested in staging. No issues found. "
        "Ready to deploy to production this weekend.",
        "createdAt": "2024-03-14T14:00:00Z",
        "user": {"name": "Ali"},
    },
    {
        "id": "c4", "taskId": "task-003", "content":
        "Design review completed. The new UI mockups have been approved by the product team. "
        "Frontend development can start Monday.",
        "createdAt": "2024-03-13T16:00:00Z",
        "user": {"name": "Nour"},
    },
    {
        "id": "c5", "taskId": "task-004", "content":
        "Security audit flagged an SQL injection vulnerability in the search endpoint. "
        "This is a HIGH priority fix. Assigning to the backend team immediately.",
        "createdAt": "2024-03-12T11:00:00Z",
        "user": {"name": "Omar"},
    },
    {
        "id": "c6", "taskId": "task-005", "content":
        "The report generation feature is taking too long. We need to add pagination "
        "or move it to a background job. Current response time is 45 seconds.",
        "createdAt": "2024-03-11T13:00:00Z",
        "user": {"name": "Sara"},
    },
    {
        "id": "c7", "taskId": "task-006", "content":
        "Team is overloaded this sprint. Three tasks have been in-progress for 2 weeks "
        "without updates. We need a quick sync to unblock.",
        "createdAt": "2024-03-10T15:00:00Z",
        "user": {"name": "Ali"},
    },
]

SAMPLE_AUDIT_LOGS = [
    {
        "id": "a1", "action": "UPDATE_STATUS", "entityType": "Task", "entityId": "task-001",
        "userId": "user-1", "timestamp": "2024-03-18T09:30:00Z",
        "diff": {"status": {"from": "BLOCKED", "to": "IN_PROGRESS"}},
    },
    {
        "id": "a2", "action": "ASSIGN_USER", "entityType": "Task", "entityId": "task-002",
        "userId": "user-2", "timestamp": "2024-03-14T10:00:00Z",
        "diff": {"assignee": {"added": "Ali"}},
    },
]


def test_chunker():
    print(f"\n{SEP}")
    print("TEST 1: DocumentChunker")
    print(SEP)
    chunker = DocumentChunker()

    chunks = chunker.chunk_comment(SAMPLE_COMMENTS[0])
    assert len(chunks) > 0, "Should produce at least one chunk"
    assert "task-001" in chunks[0]["text"] or "Omar" in chunks[0]["text"]
    assert chunks[0]["metadata"]["source_type"] == "comment"
    assert chunks[0]["metadata"]["task_id"] == "task-001"
    print(f"  comment -> {len(chunks)} chunks")
    print(f"  sample : {chunks[0]['text'][:120]}...")

    log_chunks = chunker.chunk_audit_log(SAMPLE_AUDIT_LOGS[0])
    assert len(log_chunks) > 0
    assert log_chunks[0]["metadata"]["source_type"] == "audit_log"
    print(f"  audit_log -> {len(log_chunks)} chunks")

    # Empty content should produce 0 chunks
    empty_chunks = chunker.chunk_comment({"id": "x", "taskId": "t", "content": "", "createdAt": "", "user": {}})
    assert empty_chunks == []
    print("  empty comment -> 0 chunks (correct)")
    print("  PASS")


def test_embedder(embedder: Embedder):
    print(f"\n{SEP}")
    print("TEST 2: Embedder (BGE-M3)")
    print(SEP)
    print(f"  Model     : {embedder.model_name}")
    print(f"  Dimension : {embedder.dimension}")

    start = time.monotonic()
    vectors = embedder.embed(["The payment gateway is blocked.", "Database migration is ready."])
    elapsed = int((time.monotonic() - start) * 1000)

    assert len(vectors) == 2
    assert len(vectors[0]) == embedder.dimension
    # Verify L2 normalisation (dot product ≈ 1 for identical texts)
    v = vectors[0]
    norm = sum(x * x for x in v) ** 0.5
    assert abs(norm - 1.0) < 0.01, f"Vector should be unit-norm, got {norm:.4f}"

    print(f"  Embedded 2 texts -> dim={len(vectors[0])}, time={elapsed}ms")
    print(f"  Vector norm: {norm:.4f} (should be ~1.0)")
    print(f"  PASS (target <500ms, got {elapsed}ms)")


def test_indexer(indexer: QdrantIndexer):
    print(f"\n{SEP}")
    print("TEST 3: QdrantIndexer")
    print(SEP)

    # Clean up from previous test runs
    indexer.delete_collection(TEST_SPACE_ID)

    start = time.monotonic()
    n_comments = indexer.index_comments(TEST_SPACE_ID, SAMPLE_COMMENTS)
    elapsed = int((time.monotonic() - start) * 1000)

    assert n_comments >= len(SAMPLE_COMMENTS), f"Expected >={len(SAMPLE_COMMENTS)} chunks"
    print(f"  Indexed {n_comments} comment chunks in {elapsed}ms")

    n_logs = indexer.index_audit_logs(TEST_SPACE_ID, SAMPLE_AUDIT_LOGS)
    print(f"  Indexed {n_logs} audit log chunks")

    # Verify idempotency
    n_comments_again = indexer.index_comments(TEST_SPACE_ID, SAMPLE_COMMENTS)
    info_before = indexer.get_collection_info(TEST_SPACE_ID)
    indexer.index_comments(TEST_SPACE_ID, SAMPLE_COMMENTS)
    info_after = indexer.get_collection_info(TEST_SPACE_ID)
    assert info_before["points_count"] == info_after["points_count"], \
        "Re-indexing same content should be idempotent (stable UUIDs)"
    print(f"  Re-indexed {n_comments_again} chunks -> point count unchanged (idempotent)")

    info = indexer.get_collection_info(TEST_SPACE_ID)
    print(f"  Collection info: {info}")
    print("  PASS")


def test_retriever(retriever: DenseRetriever):
    print(f"\n{SEP}")
    print("TEST 4: DenseRetriever")
    print(SEP)

    # Test 1: Basic retrieval
    start = time.monotonic()
    results = retriever.retrieve_sync(
        query="payment gateway blocked by client",
        space_id=TEST_SPACE_ID,
        top_k=3,
    )
    elapsed = int((time.monotonic() - start) * 1000)

    assert len(results) > 0, "Should find results for 'payment gateway'"
    print(f"  Query: 'payment gateway blocked by client'")
    print(f"  Results: {len(results)}, top score: {results[0]['score']:.4f}, time: {elapsed}ms")
    assert results[0]["score"] >= 0.45, f"Top result too low: {results[0]['score']}"
    print(f"  Top result: {results[0]['text'][:120]}...")

    # Test 2: Task ID filter
    results_filtered = retriever.retrieve_sync(
        query="security issue",
        space_id=TEST_SPACE_ID,
        top_k=5,
        task_ids=["task-004"],  # Only the security comment
    )
    if results_filtered:
        assert all(r["metadata"]["task_id"] == "task-004" for r in results_filtered), \
            "Filtered results should only contain task-004 chunks"
        print(f"  Task filter test: {len(results_filtered)} results (all from task-004)")

    # Test 3: Source type filter
    audit_results = retriever.retrieve_sync(
        query="status changed blocked",
        space_id=TEST_SPACE_ID,
        top_k=5,
        source_types=["audit_log"],
    )
    if audit_results:
        assert all(r["metadata"]["source_type"] == "audit_log" for r in audit_results)
        print(f"  Source filter test: {len(audit_results)} audit_log results")

    # Test 4: Non-existent collection returns empty
    empty = retriever.retrieve_sync("anything", "nonexistent-space-xyz")
    assert empty == [], "Non-existent space should return empty list"
    print("  Non-existent space returns [] (correct)")

    # Test 5: XML context formatting
    xml_ctx = retriever.format_as_xml_context(results)
    assert xml_ctx.startswith("<context>") and xml_ctx.endswith("</context>")
    assert '<chunk id="1"' in xml_ctx
    print(f"  XML context: {len(xml_ctx)} chars, starts with <context>")

    empty_xml = retriever.format_as_xml_context([])
    assert "No relevant context found" in empty_xml
    print("  Empty XML context: correct")

    print("  PASS")


def main():
    print("=" * 60)
    print("  Mongez AI Service -- Phase 3 RAG Live Tests")
    print("=" * 60)

    # Test 1: Chunker (no dependencies)
    test_chunker()

    # Load embedder once (heavy — takes 5-30s)
    print(f"\n{SEP}")
    print("Loading BGE-M3 embedding model...")
    print(SEP)
    start = time.monotonic()
    embedder = Embedder()
    load_time = int((time.monotonic() - start) * 1000)
    print(f"  Model loaded in {load_time}ms")

    # Test 2: Embedder
    test_embedder(embedder)

    # Test 3: Indexer
    settings = get_settings()
    indexer = QdrantIndexer(qdrant_url=settings.qdrant_url, embedder=embedder)
    test_indexer(indexer)

    # Test 4: Retriever
    retriever = DenseRetriever(qdrant_url=settings.qdrant_url, embedder=embedder)
    test_retriever(retriever)

    # Cleanup
    indexer.delete_collection(TEST_SPACE_ID)
    print(f"\n  Test collection cleaned up.")

    print(f"\n{SEP}")
    print("  All Phase 3 tests passed!")
    print(SEP)


if __name__ == "__main__":
    main()
