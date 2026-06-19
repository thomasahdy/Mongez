import uuid
import logging

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request

logger = logging.getLogger(__name__)


class TraceMiddleware(BaseHTTPMiddleware):
    """Attaches a trace_id to every request for end-to-end observability.

    Priority:
    1. X-Trace-ID header (propagated from NestJS)
    2. Generate a new UUID4

    The trace_id is:
    - Stored in request.state.trace_id (accessible in route handlers)
    - Added to the response as X-Trace-ID header
    - Logged at the start of every request
    """

    async def dispatch(self, request: Request, call_next):
        trace_id = request.headers.get("X-Trace-ID") or str(uuid.uuid4())
        request.state.trace_id = trace_id

        logger.debug("[%s] %s %s", trace_id, request.method, request.url.path)

        response = await call_next(request)
        response.headers["X-Trace-ID"] = trace_id
        return response
