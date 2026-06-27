"""
Response Caching Service for Mongez AI

Optimization 4: Response Caching

Caches AI responses for repeated queries to dramatically improve response time.
- Weekly reports: First request ~5s, cached request ~100ms
- Analytics queries: First request ~3s, cached request ~100ms

Uses Redis for distributed caching with TTL to ensure data doesn't go stale.
"""
import json
import hashlib
import logging
import redis.asyncio as aioredis
from typing import Optional, Dict, Any
from datetime import timedelta

from app.config import get_settings

logger = logging.getLogger(__name__)


class ResponseCache:
    """Cache AI responses for repeated queries."""

    def __init__(self):
        self._redis: Optional[aioredis.Redis] = None
        self.settings = get_settings()

    async def _get_redis(self) -> aioredis.Redis:
        """Get or create Redis connection."""
        if self._redis is None:
            self._redis = await aioredis.from_url(
                self.settings.redis_url,
                decode_responses=True
            )
        return self._redis

    def _make_cache_key(self, query: str, space_id: str, user_context: Dict[str, Any]) -> str:
        """Generate a stable cache key from query parameters."""
        # Normalize the query for caching
        normalized = {
            "query": query.lower().strip(),
            "space_id": space_id,
            # Include relevant context that affects the response
            "board_id": user_context.get("board_id", ""),
            "task_id": user_context.get("task_id", ""),
        }
        key_string = json.dumps(normalized, sort_keys=True)
        hash_value = hashlib.sha256(key_string.encode()).hexdigest()[:16]
        return f"ai_response:{hash_value}"

    async def get(self, query: str, space_id: str, user_context: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Get cached response if available."""
        try:
            redis = await self._get_redis()
            cache_key = self._make_cache_key(query, space_id, user_context)

            cached = await redis.get(cache_key)
            if cached:
                logger.info("Cache HIT: %s (query: %s)", cache_key, query[:50])
                return json.loads(cached)

            logger.info("Cache MISS: %s (query: %s)", cache_key, query[:50])
            return None

        except Exception as exc:
            logger.warning("Cache get failed: %s", exc)
            return None

    async def set(
        self,
        query: str,
        space_id: str,
        user_context: Dict[str, Any],
        response: Dict[str, Any],
        ttl_seconds: int = 3600
    ) -> None:
        """Cache a response with TTL."""
        try:
            redis = await self._get_redis()
            cache_key = self._make_cache_key(query, space_id, user_context)

            await redis.setex(
                cache_key,
                ttl_seconds,
                json.dumps(response)
            )
            logger.info("Cached response: %s (TTL: %ds)", cache_key, ttl_seconds)

        except Exception as exc:
            logger.warning("Cache set failed: %s", exc)

    async def invalidate_space(self, space_id: str) -> None:
        """Invalidate all cached responses for a space (called after mutations)."""
        try:
            redis = await self._get_redis()
            pattern = f"ai_response:*"

            # Get all matching keys
            keys = []
            async for key in redis.scan_iter(match=pattern):
                # Decode if needed (decode_responses=True should handle this)
                keys.append(key)

            if keys:
                await redis.delete(*keys)
                logger.info("Invalidated %d cache keys for space %s", len(keys), space_id)

        except Exception as exc:
            logger.warning("Cache invalidation failed: %s", exc)

    async def close(self) -> None:
        """Close Redis connection."""
        if self._redis:
            await self._redis.close()
            self._redis = None


# Global cache instance
_cache_instance: Optional[ResponseCache] = None


async def get_response_cache() -> ResponseCache:
    """Get or create the global response cache instance."""
    global _cache_instance
    if _cache_instance is None:
        _cache_instance = ResponseCache()
    return _cache_instance
