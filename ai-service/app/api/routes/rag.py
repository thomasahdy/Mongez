"""RAG API routes — handles document/task indexing and context retrieval."""
import logging
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app import dependencies
from app.api.middleware.auth import verify_service_key

logger = logging.getLogger(__name__)
router = APIRouter()


class IndexRequest(BaseModel):
    space_id: str
    task_id: str


class IndexResponse(BaseModel):
    success: bool
    points_indexed: int


class RetrieveRequest(BaseModel):
    space_id: str
    query: str


class RetrieveResponse(BaseModel):
    context: str


@router.post("/index", response_model=IndexResponse)
async def index_document(
    req: IndexRequest,
    _: str = Depends(verify_service_key),
):
    """
    Fetch task data and comments from NestJS, chunk and embed them,
    and upsert them into the space's Qdrant collection.
    """
    if not dependencies.indexer:
        raise HTTPException(status_code=500, detail="Qdrant indexer is not configured.")
    if not dependencies.nestjs_client:
        raise HTTPException(status_code=500, detail="NestJS client is not configured.")

    try:
        # Fetch tasks from NestJS
        tasks = await dependencies.nestjs_client.get_tasks(req.space_id)
        # Find the specific task
        task = next((t for t in tasks if t.get("id") == req.task_id), None)
        
        if not task:
            logger.warning("Task %s not found in space %s for indexing", req.task_id, req.space_id)
            return IndexResponse(success=True, points_indexed=0)

        # Index the task description/fields
        points_indexed = dependencies.indexer.index_tasks(req.space_id, [task])
        
        # Fetch and index task comments
        comments = await dependencies.nestjs_client.get_comments(req.task_id)
        if comments:
            points_indexed += dependencies.indexer.index_comments(req.space_id, comments)
            
        return IndexResponse(success=True, points_indexed=points_indexed)
    except Exception as exc:
        logger.error("Failed to index task %s in space %s: %s", req.task_id, req.space_id, exc, exc_info=True)
        raise HTTPException(status_code=500, detail=f"Indexing failed: {str(exc)}")


@router.post("/retrieve", response_model=RetrieveResponse)
async def retrieve_context(
    req: RetrieveRequest,
    _: str = Depends(verify_service_key),
):
    """
    Search Qdrant for semantic context matching the query in the space's collection.
    """
    if not dependencies.retriever:
        raise HTTPException(status_code=500, detail="Retriever is not configured.")
        
    try:
        results = await dependencies.retriever.retrieve(query=req.query, space_id=req.space_id)
        xml_context = dependencies.retriever.format_as_xml_context(results)
        return RetrieveResponse(context=xml_context)
    except Exception as exc:
        logger.error("Failed to retrieve context for query '%s' in space %s: %s", req.query, req.space_id, exc, exc_info=True)
        raise HTTPException(status_code=500, detail=f"Retrieval failed: {str(exc)}")
