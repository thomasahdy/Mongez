import logging

import httpx

from app.config import Settings

logger = logging.getLogger(__name__)


class NestJSClient:
    """Async HTTP client for calling NestJS internal AI data endpoints.

    All requests include the X-Service-API-Key header for service authentication.
    The client is created once and shared across requests (keep-alive connections).

    Internal routes exposed by NestJS (Phase 1):
        GET  /internal/ai/tasks/{spaceId}        → task list with assignees + status
        GET  /internal/ai/comments/{taskId}      → task comments
        GET  /internal/ai/audit-log/{spaceId}    → audit log entries
        GET  /internal/ai/schema                 → DB schema JSON for Text-to-SQL
        POST /ai/actions/:id/approve             → approve proposed action (human loop)
        POST /ai/actions/:id/reject              → reject proposed action
    """

    def __init__(self, settings: Settings) -> None:
        self.base_url = settings.nestjs_base_url
        self._client = httpx.AsyncClient(
            base_url=settings.nestjs_base_url,
            headers={"X-Service-API-Key": settings.nestjs_service_api_key},
            timeout=httpx.Timeout(10.0),
        )
        logger.info("NestJSClient initialised | base_url=%s", settings.nestjs_base_url)

    def _extract_data(self, resp_json: any) -> any:
        """Helper to extract the actual payload from single or double-wrapped NestJS responses."""
        if not isinstance(resp_json, dict):
            return resp_json
        data = resp_json.get("data")
        if isinstance(data, dict) and "data" in data:
            return data.get("data")
        return data if data is not None else resp_json

    async def get_tasks(self, space_id: str, board_id: str | None = None) -> list[dict]:
        """Fetch tasks for a space. Optionally filter to a single board."""
        params = {"boardId": board_id} if board_id else {}
        resp = await self._client.get(f"/internal/ai/tasks/{space_id}", params=params)
        resp.raise_for_status()
        return self._extract_data(resp.json()) or []

    async def get_comments(self, task_id: str) -> list[dict]:
        """Fetch all comments for a specific task."""
        resp = await self._client.get(f"/internal/ai/comments/{task_id}")
        resp.raise_for_status()
        return self._extract_data(resp.json()) or []

    async def get_comments_by_space(self, space_id: str) -> list[dict]:
        """Fetch all comments for tasks in a space."""
        resp = await self._client.get(f"/internal/ai/comments/space/{space_id}")
        resp.raise_for_status()
        return self._extract_data(resp.json()) or []

    async def get_audit_log(self, space_id: str) -> list[dict]:
        """Fetch recent audit log entries for a space."""
        resp = await self._client.get(f"/internal/ai/audit-log/{space_id}")
        resp.raise_for_status()
        return self._extract_data(resp.json()) or []

    async def get_calendar(self, space_id: str, start_date: str | None = None, end_date: str | None = None) -> list[dict]:
        """Fetch merged calendar events, tasks, approvals, holidays from NestJS."""
        params = {}
        if start_date:
            params["startDate"] = start_date
        if end_date:
            params["endDate"] = end_date
        resp = await self._client.get(f"/internal/ai/calendar/{space_id}", params=params)
        resp.raise_for_status()
        return self._extract_data(resp.json()) or []


    async def get_schema(self) -> dict:
        """Fetch the simplified DB schema description for Text-to-SQL prompts."""
        resp = await self._client.get("/internal/ai/schema")
        resp.raise_for_status()
        return self._extract_data(resp.json()) or {}

    async def propose_action(
        self, trace_id: str, space_id: str, action: dict
    ) -> dict:
        """Submit a proposed action to NestJS for human review.

        NestJS stores it as AIProposedAction with status=PENDING.
        A manager approves/rejects via the frontend.
        """
        resp = await self._client.post(
            "/internal/ai/propose-action",
            json={"traceId": trace_id, "spaceId": space_id, **action},
        )
        resp.raise_for_status()
        return self._extract_data(resp.json()) or {}

    async def update_ai_request(self, trace_id: str, updates: dict) -> None:
        """Write back latency/token metrics to the AIRequest row in NestJS."""
        try:
            await self._client.patch(
                f"/internal/ai/requests/{trace_id}",
                json=updates,
            )
        except httpx.HTTPError as exc:
            # Non-critical — log and continue (don't fail the AI response)
            logger.warning("Failed to update AIRequest [%s]: %s", trace_id, exc)

    async def close(self) -> None:
        """Close the underlying HTTP client connection pool."""
        await self._client.aclose()
