"""
Prometheus metrics for Mongez AI service.

Provides metrics for:
- Request latency by pipeline stage
- Intent classification latency
- Context building latency
- LLM call latency and token usage
- Action execution latency
- Projection freshness
- Cache hit/miss rates
- Error rates
- Circuit breaker states
"""

from prometheus_client import Histogram, Counter, Gauge, Summary
from typing import Optional

# =============================================================================
# Request Latency Metrics
# =============================================================================

request_latency = Histogram(
    'mongez_request_latency_seconds',
    'Request latency by pipeline stage',
    ['stage', 'intent'],
    buckets=(0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1.0, 2.5, 5.0, 10.0, 30.0, 60.0)
)

# =============================================================================
# Intent Classification Metrics
# =============================================================================

intent_latency = Histogram(
    'mongez_intent_latency_seconds',
    'Intent classification latency',
    ['method'],  # regex, keyword, llm
    buckets=(0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1.0)
)

intent_classification_total = Counter(
    'mongez_intent_classification_total',
    'Total intent classifications',
    ['intent', 'method']
)

intent_confidence = Histogram(
    'mongez_intent_confidence',
    'Intent classification confidence score',
    buckets=(0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0)
)

# =============================================================================
# Context Building Metrics
# =============================================================================

context_latency = Histogram(
    'mongez_context_latency_seconds',
    'Context building latency',
    ['source'],  # projection, database, rag, hybrid
    buckets=(0.01, 0.05, 0.1, 0.25, 0.5, 1.0, 2.0, 5.0)
)

context_size_tokens = Histogram(
    'mongez_context_size_tokens',
    'Context size in tokens',
    ['context_type'],
    buckets=(100, 500, 1000, 2000, 5000, 10000, 20000, 50000)
)

# =============================================================================
# LLM Metrics
# =============================================================================

llm_latency = Histogram(
    'mongez_llm_latency_seconds',
    'LLM call latency',
    ['model', 'tier', 'status'],
    buckets=(0.1, 0.5, 1.0, 2.0, 5.0, 10.0, 30.0, 60.0)
)

llm_tokens = Summary(
    'mongez_llm_tokens',
    'LLM token usage',
    ['model', 'direction']  # in, out
)

llm_calls_total = Counter(
    'mongez_llm_calls_total',
    'Total LLM calls',
    ['model', 'tier', 'status']
)

llm_retry_total = Counter(
    'mongez_llm_retry_total',
    'Total LLM retries',
    ['model', 'tier']
)

llm_rate_limited_total = Counter(
    'mongez_llm_rate_limited_total',
    'Total LLM rate limit events',
    ['model', 'tier']
)

# =============================================================================
# Action Metrics
# =============================================================================

action_latency = Histogram(
    'mongez_action_latency_seconds',
    'Action execution latency',
    ['action_type', 'status'],
    buckets=(0.1, 0.5, 1.0, 2.0, 5.0, 10.0)
)

action_confidence = Histogram(
    'mongez_action_confidence',
    'Action confidence score from LLM',
    ['action_type'],
    buckets=(0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0)
)

action_total = Counter(
    'mongez_action_total',
    'Total actions executed',
    ['action_type', 'status']
)

action_approval_required_total = Counter(
    'mongez_action_approval_required_total',
    'Total actions requiring approval',
    ['action_type']
)

# =============================================================================
# Projection Metrics
# =============================================================================

projection_age = Gauge(
    'mongez_projection_age_seconds',
    'Age of projection data in seconds',
    ['projection_type']
)

projection_update_total = Counter(
    'mongez_projection_update_total',
    'Total projection updates',
    ['projection_type', 'status']
)

projection_freshness = Histogram(
    'mongez_projection_freshness_seconds',
    'Projection freshness (time since last update)',
    ['projection_type'],
    buckets=(1, 5, 10, 30, 60, 300, 600, 1800, 3600)
)

# =============================================================================
# Cache Metrics
# =============================================================================

cache_hits = Counter(
    'mongez_cache_hits_total',
    'Cache hits',
    ['cache_type']  # projection, response, llm, rag
)

cache_misses = Counter(
    'mongez_cache_misses_total',
    'Cache misses',
    ['cache_type']
)

cache_stale_total = Counter(
    'mongez_cache_stale_total',
    'Cache entries that were stale and required refresh',
    ['cache_type']
)

# =============================================================================
# Error Metrics
# =============================================================================

errors_total = Counter(
    'mongez_errors_total',
    'Total errors',
    ['stage', 'error_type']
)

json_parse_failures = Counter(
    'mongez_json_parse_failures_total',
    'JSON parsing failures',
    ['location']
)

# =============================================================================
# Circuit Breaker Metrics
# =============================================================================

circuit_state = Gauge(
    'mongez_circuit_state',
    'Circuit breaker state (0=closed, 1=open, 2=half_open)',
    ['service']
)

circuit_failures = Counter(
    'mongez_circuit_failures_total',
    'Circuit breaker failure count',
    ['service']
)

circuit_successes = Counter(
    'mongez_circuit_successes_total',
    'Circuit breaker success count',
    ['service']
)

circuit_rejections = Counter(
    'mongez_circuit_rejections_total',
    'Circuit breaker rejected calls (circuit open)',
    ['service']
)

# =============================================================================
# Tool Execution Metrics
# =============================================================================

tool_latency = Histogram(
    'mongez_tool_latency_seconds',
    'Tool execution latency',
    ['tool_name', 'status'],
    buckets=(0.1, 0.5, 1.0, 2.0, 5.0, 10.0, 30.0)
)

tool_total = Counter(
    'mongez_tool_total',
    'Total tool executions',
    ['tool_name', 'status']
)

# =============================================================================
# RAG Metrics
# =============================================================================

rag_latency = Histogram(
    'mongez_rag_latency_seconds',
    'RAG retrieval latency',
    ['stage'],  # embed, retrieve, rank
    buckets=(0.01, 0.05, 0.1, 0.5, 1.0, 2.0, 5.0)
)

rag_results = Histogram(
    'mongez_rag_results_count',
    'Number of results returned from RAG',
    ['collection'],
    buckets=(1, 3, 5, 10, 20, 50, 100)
)

rag_score = Histogram(
    'mongez_rag_score',
    'RAG similarity scores',
    buckets=(0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0)
)

# =============================================================================
# Helper Functions
# =============================================================================

def track_llm_call(
    model: str,
    tier: str,
    latency_seconds: float,
    tokens_in: int,
    tokens_out: int,
    status: str = "success"
):
    """Track an LLM call with all relevant metrics."""
    llm_latency.labels(model=model, tier=tier, status=status).observe(latency_seconds)
    llm_tokens.labels(model=model, direction='in').observe(tokens_in)
    llm_tokens.labels(model=model, direction='out').observe(tokens_out)
    llm_calls_total.labels(model=model, tier=tier, status=status).inc()


def track_cache_hit(cache_type: str, hit: bool):
    """Track a cache hit or miss."""
    if hit:
        cache_hits.labels(cache_type=cache_type).inc()
    else:
        cache_misses.labels(cache_type=cache_type).inc()


def track_error(stage: str, error_type: str):
    """Track an error."""
    errors_total.labels(stage=stage, error_type=error_type).inc()


def update_projection_age(projection_type: str, age_seconds: float):
    """Update the current age of a projection."""
    projection_age.labels(projection_type=projection_type).set(age_seconds)


def set_circuit_state(service: str, state: str):
    """
    Set circuit breaker state.

    Args:
        service: Service name (e.g., 'groq', 'qdrant', 'nestjs')
        state: Circuit state ('closed', 'open', 'half_open')
    """
    state_map = {'closed': 0, 'open': 1, 'half_open': 2}
    circuit_state.labels(service=service).set(state_map.get(state, 0))
