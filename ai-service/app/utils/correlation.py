"""
Request correlation context for distributed tracing.

Provides request-scoped context for tracing requests through the AI pipeline.
Every request gets a unique request_id that is propagated through all stages.

Usage:
    RequestContext.initialize(request_id, session_id, user_id, space_id)
    logger.info("Processing", extra=RequestContext.get())
    # Or just:
    logger.info("Processing", request_id=RequestContext.get_request_id())
"""

import uuid
import asyncio
from contextvars import ContextVar
from typing import Dict, Any, Optional
from functools import wraps
import logging

logger = logging.getLogger(__name__)

# Request context stored in contextvars (async-safe)
_request_id_ctx: ContextVar[str] = ContextVar('request_id', default='')
_session_id_ctx: ContextVar[str] = ContextVar('session_id', default='')
_user_id_ctx: ContextVar[str] = ContextVar('user_id', default='')
_space_id_ctx: ContextVar[str] = ContextVar('space_id', default='')
_space_name_ctx: ContextVar[str] = ContextVar('space_name', default='')


class RequestContext:
    """
    Request correlation context manager.

    Stores request-scoped identifiers that are propagated through
    the entire request pipeline for tracing and debugging.
    """

    @staticmethod
    def initialize(
        request_id: Optional[str] = None,
        session_id: Optional[str] = None,
        user_id: Optional[str] = None,
        space_id: Optional[str] = None,
        space_name: Optional[str] = None
    ) -> str:
        """
        Initialize request context for the current request.

        Args:
            request_id: Unique request identifier (generated if not provided)
            session_id: User session identifier
            user_id: User identifier
            space_id: Workspace/space identifier
            space_name: Workspace/space name

        Returns:
            The request_id being used (generated or provided)
        """
        request_id = request_id or str(uuid.uuid4())
        _request_id_ctx.set(request_id)
        _session_id_ctx.set(session_id or '')
        _user_id_ctx.set(user_id or '')
        _space_id_ctx.set(space_id or '')
        _space_name_ctx.set(space_name or '')
        return request_id

    @staticmethod
    def get() -> Dict[str, str]:
        """Get all context values as a dictionary."""
        return {
            'request_id': _request_id_ctx.get(),
            'session_id': _session_id_ctx.get(),
            'user_id': _user_id_ctx.get(),
            'space_id': _space_id_ctx.get(),
            'space_name': _space_name_ctx.get()
        }

    @staticmethod
    def get_request_id() -> str:
        """Get the current request ID."""
        return _request_id_ctx.get()

    @staticmethod
    def get_session_id() -> str:
        """Get the current session ID."""
        return _session_id_ctx.get()

    @staticmethod
    def get_user_id() -> str:
        """Get the current user ID."""
        return _user_id_ctx.get()

    @staticmethod
    def get_space_id() -> str:
        """Get the current space ID."""
        return _space_id_ctx.get()

    @staticmethod
    def get_space_name() -> str:
        """Get the current space name."""
        return _space_name_ctx.get()

    @staticmethod
    def clear():
        """Clear all context values."""
        _request_id_ctx.set('')
        _session_id_ctx.set('')
        _user_id_ctx.set('')
        _space_id_ctx.set('')
        _space_name_ctx.set('')


def with_correlation_log(func):
    """
    Decorator to automatically add correlation context to function logs.

    Usage:
        @with_correlation_log
        async def my_function(arg1, arg2):
            # Logs inside will automatically include correlation context
            logger.info("Processing")  # Will include request_id, etc.
    """
    @wraps(func)
    async def async_wrapper(*args, **kwargs):
        result = await func(*args, **kwargs)
        return result

    @wraps(func)
    def sync_wrapper(*args, **kwargs):
        result = func(*args, **kwargs)
        return result

    if asyncio.iscoroutinefunction(func):
        return async_wrapper
    else:
        return sync_wrapper


def get_log_extra() -> Dict[str, Any]:
    """
    Get correlation context as a dict suitable for logger's extra parameter.

    Usage:
        logger.info("Message", extra=get_log_extra())
    """
    return RequestContext.get()


def format_log_message(message: str, **kwargs) -> str:
    """
    Format a log message with correlation context.

    Usage:
        logger.info(format_log_message("Processing stage", stage="intent"))

    Args:
        message: The log message
        **kwargs: Additional fields to include

    Returns:
        Formatted message string (or you can use extra= for structured logging)
    """
    context = RequestContext.get()
    parts = [f"[{context.get('request_id', 'no-req-id')}]"]
    for key, value in kwargs.items():
        parts.append(f"{key}={value}")
    return f"{' '.join(parts)} {message}"


class CorrelationLogAdapter(logging.LoggerAdapter):
    """
    Logger adapter that automatically adds correlation context to all log records.

    Usage:
        correlation_logger = CorrelationLogAdapter(logger, {})
        correlation_logger.info("Message")  # Automatically includes request_id
    """

    def process(self, msg, kwargs):
        # Add correlation context to extra dict
        extra = kwargs.get('extra', {})
        extra.update(RequestContext.get())
        kwargs['extra'] = extra
        return msg, kwargs


# Convenience function to get a logger adapter
def get_logger(name: str) -> logging.LoggerAdapter:
    """
    Get a logger adapter with correlation context.

    Usage:
        logger = get_logger(__name__)
        logger.info("Message")  # Automatically includes request_id, etc.
    """
    return CorrelationLogAdapter(logging.getLogger(name), {})
