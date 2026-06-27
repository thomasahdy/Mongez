"""
Circuit breaker implementation for external service dependencies.

Prevents cascading failures by failing fast when a service is experiencing issues.
Tracks circuit state: CLOSED (normal), OPEN (failing), HALF_OPEN (testing recovery).

Example:
    @groq_breaker
    async def call_llm(prompt: str):
        return await llm_client.invoke(prompt)

    # When circuit is OPEN after 5 failures:
    # - Returns cached response or friendly message immediately
    # - No retries for 30 seconds (recovery timeout)
"""

import time
import asyncio
import logging
from enum import Enum
from typing import Callable, TypeVar, Any, Optional
from functools import wraps

logger = logging.getLogger(__name__)

T = TypeVar('T')


class CircuitState(Enum):
    """Circuit breaker states."""
    CLOSED = "closed"      # Normal operation
    OPEN = "open"          # Circuit is tripped, rejecting requests
    HALF_OPEN = "half_open"  # Testing if service has recovered


class CircuitBreakerError(Exception):
    """Raised when circuit breaker is open and request is rejected."""
    pass


class CircuitBreaker:
    """
    Circuit breaker for protecting external service calls.

    Tracks failures and opens circuit when threshold is reached.
    Allows one request through in HALF_OPEN state to test recovery.
    """

    def __init__(
        self,
        failure_threshold: int = 5,
        recovery_timeout: float = 30.0,
        expected_exception: type[Exception] = Exception,
        name: str = "default"
    ):
        """
        Initialize circuit breaker.

        Args:
            failure_threshold: Number of failures before opening circuit
            recovery_timeout: Seconds to wait before trying recovery
            expected_exception: Exception type that counts as failure
            name: Circuit breaker name for logging/metrics
        """
        self.failure_threshold = failure_threshold
        self.recovery_timeout = recovery_timeout
        self.expected_exception = expected_exception
        self.name = name

        self._failure_count = 0
        self._last_failure_time: Optional[float] = None
        self._state = CircuitState.CLOSED
        self._success_count = 0
        self._rejection_count = 0

    @property
    def state(self) -> CircuitState:
        """Get current circuit state, transitioning to HALF_OPEN if timeout expired."""
        if self._state == CircuitState.OPEN:
            if time.monotonic() - self._last_failure_time >= self.recovery_timeout:
                logger.info(
                    "Circuit [%s] transition: OPEN → HALF_OPEN (after %s sec timeout)",
                    self.name,
                    self.recovery_timeout
                )
                self._state = CircuitState.HALF_OPEN
                self._success_count = 0
        return self._state

    @property
    def is_closed(self) -> bool:
        """Check if circuit is closed (normal operation)."""
        return self.state == CircuitState.CLOSED

    def record_success(self):
        """Record a successful call, potentially closing the circuit."""
        self._failure_count = 0

        if self._state == CircuitState.HALF_OPEN:
            self._success_count += 1
            if self._success_count >= 2:  # Need 2 consecutive successes to close
                logger.info("Circuit [%s] transition: HALF_OPEN → CLOSED", self.name)
                self._state = CircuitState.CLOSED
                self._success_count = 0

    def record_failure(self, exc: Exception):
        """Record a failed call, potentially opening the circuit."""
        self._failure_count += 1
        self._last_failure_time = time.monotonic()

        logger.warning(
            "Circuit [%s] failure recorded: %d/%d threshold",
            self.name,
            self._failure_count,
            self.failure_threshold
        )

        if self._failure_count >= self.failure_threshold:
            if self._state != CircuitState.OPEN:
                logger.error(
                    "Circuit [%s] transition: %s → OPEN (too many failures)",
                    self.name,
                    self._state.value.upper()
                )
            self._state = CircuitState.OPEN
            self._rejection_count = 0

    def record_rejection(self):
        """Record a rejected call (circuit was open)."""
        self._rejection_count += 1

    async def call(self, func: Callable[..., T], *args, **kwargs) -> T:
        """
        Execute function with circuit breaker protection.

        Args:
            func: Function to call
            *args: Function arguments
            **kwargs: Function keyword arguments

        Returns:
            Function result

        Raises:
            CircuitBreakerError: If circuit is open
            Exception: If function fails with unexpected exception
        """
        if self.state == CircuitState.OPEN:
            self.record_rejection()
            raise CircuitBreakerError(
                f"Circuit [{self.name}] is OPEN after {self._failure_count} failures. "
                f"Rejecting request. Recovery timeout: {self.recovery_timeout}s"
            )

        try:
            result = await func(*args, **kwargs)
            self.record_success()
            return result
        except self.expected_exception as exc:
            self.record_failure(exc)
            raise
        except Exception as exc:
            # Unexpected exception - don't count toward failure threshold
            # but still raise it
            logger.error("Circuit [%s] unexpected exception: %s", self.name, exc)
            raise


def circuit_breaker(
    failure_threshold: int = 5,
    recovery_timeout: float = 30.0,
    expected_exception: type[Exception] = Exception,
    name: str = "default"
):
    """
    Decorator for circuit breaker protection.

    Usage:
        @circuit_breaker(failure_threshold=5, recovery_timeout=30, name="groq")
        async def call_llm(prompt: str):
            return await llm_client.invoke(prompt)

        # Use with fallback:
        try:
            result = await call_llm(prompt)
        except CircuitBreakerError:
            # Use cached response or friendly message
            return get_cached_response(prompt)
    """
    breaker = CircuitBreaker(failure_threshold, recovery_timeout, expected_exception, name)

    def decorator(func: Callable[..., T]) -> Callable[..., T]:
        @wraps(func)
        async def wrapper(*args, **kwargs):
            return await breaker.call(func, *args, **kwargs)
        return wrapper
    return decorator


# =============================================================================
# Pre-configured circuit breakers for external services
# =============================================================================

# Groq LLM (primary tier)
groq_breaker = CircuitBreaker(
    failure_threshold=5,
    recovery_timeout=30,
    expected_exception=Exception,  # Catch all for LLM API
    name="groq"
)

# Groq Fast (intent classification, etc.)
groq_fast_breaker = CircuitBreaker(
    failure_threshold=10,  # More lenient for fast tier
    recovery_timeout=20,
    expected_exception=Exception,
    name="groq_fast"
)

# Qdrant (RAG vector search)
qdrant_breaker = CircuitBreaker(
    failure_threshold=3,
    recovery_timeout=20,
    expected_exception=(ConnectionError, TimeoutError),
    name="qdrant"
)

# NestJS API (backend calls)
nestjs_breaker = CircuitBreaker(
    failure_threshold=5,
    recovery_timeout=15,
    expected_exception=(ConnectionError, TimeoutError),
    name="nestjs"
)

# Redis (cache)
redis_breaker = CircuitBreaker(
    failure_threshold=3,
    recovery_timeout=10,
    expected_exception=(ConnectionError, TimeoutError),
    name="redis"
)


# =============================================================================
# Fallback helpers
# =============================================================================

async def with_fallback(
    func: Callable,
    fallback_value: Any,
    circuit: CircuitBreaker,
    *args,
    **kwargs
) -> Any:
    """
    Execute function with fallback when circuit is open.

    Args:
        func: Function to execute
        fallback_value: Value to return when circuit is open
        circuit: Circuit breaker instance
        *args: Function arguments
        **kwargs: Function keyword arguments

    Returns:
        Function result or fallback_value
    """
    try:
        return await circuit.call(func, *args, **kwargs)
    except CircuitBreakerError:
        logger.info("Circuit [%s] is open, returning fallback value", circuit.name)
        return fallback_value
