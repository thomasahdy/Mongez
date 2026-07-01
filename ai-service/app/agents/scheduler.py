import asyncio
import logging
import json
import time
import hashlib
from typing import Any
import redis.asyncio as aioredis

from app.config import get_settings
from app.agents.registry import TOOL_REGISTRY, get_allowed_tools, normalize_role
from app.agents.tools import read_tools, mutation_tools
from app.agents.tools.schemas import SCHEMAS_MAP, ToolResult, Citation

logger = logging.getLogger(__name__)

# Map tool names to actual python async functions
TOOL_FUNCTION_MAP = {
    # Read Tools
    "search_tasks": read_tools.search_tasks,
    "search_users": read_tools.search_users,
    "search_approvals": read_tools.search_approvals,
    "search_workflows": read_tools.search_workflows,
    "search_meetings": read_tools.search_meetings,
    "search_calendar": read_tools.search_calendar,
    "search_decisions": read_tools.search_decisions,
    "search_analytics": read_tools.search_analytics,
    "get_task_dependencies": read_tools.get_task_dependencies,
    "get_blocker_chain": read_tools.get_blocker_chain,
    "get_workflow_graph": read_tools.get_workflow_graph,
    "get_org_graph": read_tools.get_org_graph,
    
    # Mutation Tools
    "create_task": mutation_tools.create_task,
    "assign_task": mutation_tools.assign_task,
    "update_task": mutation_tools.update_task,
    "send_notification": mutation_tools.send_notification,
    "create_reminder": mutation_tools.create_reminder,
    "start_approval": mutation_tools.start_approval,
}

# Pricing estimation helper (tokens to USD cost)
MODEL_PRICING = {
    "llama-3.3-70b-versatile": {"input": 0.59 / 1000000, "output": 0.79 / 1000000},
    "llama-3.1-8b-instant": {"input": 0.05 / 1000000, "output": 0.08 / 1000000},
    "gpt-oss-120b": {"input": 0.15 / 1000000, "output": 0.60 / 1000000},
    "gpt-oss-20b": {"input": 0.075 / 1000000, "output": 0.30 / 1000000},
}

# Friendly user-facing error mappings to hide internal details
FRIENDLY_TOOL_FAILURES = {
    "search_tasks": "Unable to search workspace tasks.",
    "search_users": "Unable to retrieve team member details.",
    "search_approvals": "Unable to check pending task approvals.",
    "search_workflows": "Unable to retrieve active workflows.",
    "search_meetings": "Unable to search meeting transcripts.",
    "search_calendar": "Unable to load calendar schedules.",
    "search_decisions": "Unable to access decision register.",
    "search_analytics": "Unable to compile project metrics.",
    "get_task_dependencies": "Unable to retrieve task dependencies.",
    "get_blocker_chain": "Unable to traverse blocker chains.",
    "get_workflow_graph": "Unable to map workflow connections.",
    "get_org_graph": "Unable to analyze team structures.",
    "create_task": "Unable to propose new task creation.",
    "assign_task": "Unable to propose task assignment.",
    "update_task": "Unable to propose task update.",
    "send_notification": "Unable to send workspace notification.",
    "create_reminder": "Unable to create task reminder.",
    "start_approval": "Unable to initiate approval cycle.",
}

# In-memory Circuit Breaker State (Scoped to app lifecycle)
CIRCUIT_THRESHOLD = 3
CIRCUIT_COOLDOWN = 30  # seconds
_circuit_failures: dict[str, int] = {}       # tool_name -> consecutive_failures
_circuit_open_until: dict[str, float] = {}   # tool_name -> epoch_timestamp

def calculate_model_cost(model_name: str, tokens_in: int, tokens_out: int) -> float:
    """Calculate USD pricing cost of a model invocation based on tokens."""
    clean_name = model_name.lower()
    pricing_key = None
    for key in MODEL_PRICING:
        if key in clean_name:
            pricing_key = key
            break
            
    if not pricing_key:
        pricing_key = "llama-3.1-8b-instant"  # fallback pricing
        
    pricing = MODEL_PRICING[pricing_key]
    return (tokens_in * pricing["input"]) + (tokens_out * pricing["output"])

def calculate_hash(args: dict) -> str:
    """Stable hash of a dictionary."""
    sorted_str = json.dumps(args, sort_keys=True)
    return hashlib.md5(sorted_str.encode()).hexdigest()

async def get_redis_client() -> aioredis.Redis:
    """Instantiate a Redis connection client on-the-fly from config settings."""
    settings = get_settings()
    return aioredis.from_url(settings.redis_url, decode_responses=True)

def _log_tool_telemetry(trace_id: str, tool_name: str, args: dict, duration_ms: int, success: bool, error: str | None, cache_hit: bool):
    """Log structured execution telemetry and save to a JSONL file."""
    metric = {
        "trace_id": trace_id,
        "tool_name": tool_name,
        "args": args,
        "duration_ms": duration_ms,
        "success": success,
        "error": error,
        "cache_hit": cache_hit
    }
    logger.info("ToolExecutionMetric: %s", json.dumps(metric))
    try:
        import os
        os.makedirs("../logs", exist_ok=True)
        with open("../logs/tool_telemetry.jsonl", "a", encoding="utf-8") as f:
            f.write(json.dumps(metric, ensure_ascii=False) + "\n")
    except Exception as log_exc:
        logger.warning("Failed to write tool telemetry to file: %s", log_exc)

def _map_exception_to_error(exc: Exception) -> tuple[str, str]:
    """Map raw python exception to user friendly error type and message."""
    err_str = str(exc).lower()
    if "connection" in err_str or "unreachable" in err_str or "socket" in err_str:
        return "CONNECTION_ERROR", "The database or internal service is currently unreachable."
    elif "timeout" in err_str:
        return "TIMEOUT", "The service request timed out."
    elif "unauthorized" in err_str or "forbidden" in err_str or "permission" in err_str:
        return "RBAC_BLOCK", "You do not have the required permissions to perform this operation."
    elif "validation" in err_str or "valueerror" in err_str:
        return "VALIDATION_ERROR", "The tool parameters were invalid."
    else:
        return "UNEXPECTED_ERROR", "An unexpected error occurred while processing the request."

async def run_single_tool(
    tool_name: str,
    args: dict,
    state: dict,
    redis_client: aioredis.Redis | None = None
) -> dict:
    """Executes a single tool with schema validation, RBAC guard, circuit breaker, retry, and caching."""
    trace_id = state.get("trace_id", "system-trace")
    user_role = state.get("user_role", "MEMBER")
    space_id = state.get("space_id", "system-space")
    user_id = state.get("user_id", "unknown-user")
    
    start_time = time.monotonic()
    
    # Pre-execution status update in token queue
    token_queue = state.get("token_queue")
    if token_queue:
        friendly_names = {
            "search_tasks": "Searching tasks...",
            "search_users": "Analyzing team workload...",
            "search_approvals": "Checking pending approvals...",
            "search_workflows": "Retrieving active workflows...",
            "search_meetings": "Searching meeting transcripts...",
            "search_calendar": "Checking calendar schedules...",
            "search_decisions": "Reviewing decision register...",
            "search_analytics": "Analyzing project metrics...",
            "get_task_dependencies": "Analyzing task dependencies...",
            "get_blocker_chain": "Scanning blocker chains...",
            "get_workflow_graph": "Mapping workflow connections...",
            "get_org_graph": "Analyzing team structure...",
            "create_task": "Proposing task creation...",
            "assign_task": "Proposing task assignment...",
            "update_task": "Proposing task update...",
            "send_notification": "Sending escalation notification...",
            "create_reminder": "Creating task reminder...",
            "start_approval": "Initiating approval cycle...",
        }
        msg = friendly_names.get(tool_name, f"Running {tool_name}...")
        try:
            await token_queue.put({"event": "tool_start", "status": msg})
        except Exception:
            pass

    # 1. Circuit Breaker Check
    current_time = time.time()
    if _circuit_open_until.get(tool_name, 0) > current_time:
        duration_ms = int((time.monotonic() - start_time) * 1000)
        logger.warning("[%s] Circuit Breaker OPEN for tool: %s", trace_id, tool_name)
        _log_tool_telemetry(trace_id, tool_name, args, duration_ms, False, "Circuit breaker is open.", False)
        
        friendly_error = FRIENDLY_TOOL_FAILURES.get(tool_name, "Service temporarily unavailable.")
        tool_res = ToolResult(
            status="failed",
            content=f"Execution Failure: {friendly_error}",
            citations=[],
            warnings=[f"Service is temporarily offline due to repeated failures."],
            confidence=0.0,
            duration_ms=duration_ms,
            cache_hit=False,
            error_type="CIRCUIT_OPEN"
        )
        res_dict = tool_res.model_dump()
        res_dict["tool"] = tool_name
        return res_dict

    # 2. RBAC Guard validation
    tool_def = TOOL_REGISTRY.get(tool_name)
    if not tool_def:
        duration_ms = int((time.monotonic() - start_time) * 1000)
        _log_tool_telemetry(trace_id, tool_name, args, duration_ms, False, f"Tool '{tool_name}' not found.", False)
        tool_res = ToolResult(
            status="failed",
            content="Execution Failure: Tool configuration not found.",
            citations=[],
            warnings=["Unrecognized tool execution."],
            confidence=0.0,
            duration_ms=duration_ms,
            cache_hit=False,
            error_type="NOT_FOUND"
        )
        res_dict = tool_res.model_dump()
        res_dict["tool"] = tool_name
        return res_dict
        
    normalized_user_role = normalize_role(user_role)
    if normalized_user_role not in tool_def.allowed_roles:
        logger.warning("[%s] RBAC Block: user %s requested tool %s", trace_id, user_id, tool_name)
        duration_ms = int((time.monotonic() - start_time) * 1000)
        _log_tool_telemetry(trace_id, tool_name, args, duration_ms, False, "Access Denied: RBAC restriction", False)
        tool_res = ToolResult(
            status="failed",
            content="Execution Failure: Insufficient permission to run this action.",
            citations=[],
            warnings=["Access denied due to workspace privileges."],
            confidence=0.0,
            duration_ms=duration_ms,
            cache_hit=False,
            error_type="RBAC_BLOCK"
        )
        res_dict = tool_res.model_dump()
        res_dict["tool"] = tool_name
        return res_dict

    # Inject standard contextual parameters & preprocessing alternate keys
    args_copy = args.copy()
    if "query" not in args_copy:
        for alt_key in ("keyword", "search", "query_text", "text", "q"):
            if alt_key in args_copy:
                args_copy["query"] = args_copy.pop(alt_key)
                break

    args_copy["space_id"] = space_id
    if tool_def.category == "write":
        args_copy["trace_id"] = trace_id

    # 3. Schema Input Validation
    schema_class = SCHEMAS_MAP.get(tool_name)
    if schema_class:
        try:
            validated = schema_class.model_validate(args_copy)
            validated_args = validated.model_dump()
        except Exception as val_exc:
            logger.warning("[%s] Schema validation failed for tool %s: %s", trace_id, tool_name, val_exc)
            duration_ms = int((time.monotonic() - start_time) * 1000)
            _log_tool_telemetry(trace_id, tool_name, args, duration_ms, False, f"Schema validation failed: {val_exc}", False)
            tool_res = ToolResult(
                status="failed",
                content="Execution Failure: Invalid query parameters.",
                citations=[],
                warnings=["Query formatting error."],
                confidence=0.0,
                duration_ms=duration_ms,
                cache_hit=False,
                error_type="VALIDATION_ERROR"
            )
            res_dict = tool_res.model_dump()
            res_dict["tool"] = tool_name
            return res_dict
    else:
        validated_args = args_copy

    # 4. Redis Cache Lookup
    args_hash = calculate_hash(validated_args)
    cache_key = f"tool_result:{space_id}:{user_id}:{tool_name}:{args_hash}"
    cache_hit = False
    success = False
    output = ""
    error_type = None
    failure_reason = None
    
    if redis_client:
        try:
            cached_val = await redis_client.get(cache_key)
            if cached_val:
                logger.info("[%s] Cache Hit for tool %s", trace_id, tool_name)
                cache_hit = True
                success = True
                output = cached_val
        except Exception as cache_exc:
            logger.warning("Redis cache read error: %s", cache_exc)

    # 5. Tool Function Invocation with Retries & Timeout
    if not cache_hit:
        func = TOOL_FUNCTION_MAP.get(tool_name)
        if not func:
            duration_ms = int((time.monotonic() - start_time) * 1000)
            _log_tool_telemetry(trace_id, tool_name, args, duration_ms, False, f"Missing binding for {tool_name}", False)
            tool_res = ToolResult(
                status="failed",
                content="Execution Failure: Implementation binding missing.",
                citations=[],
                warnings=["System execution mapping missing."],
                confidence=0.0,
                duration_ms=duration_ms,
                cache_hit=False,
                error_type="BINDING_ERROR"
            )
            res_dict = tool_res.model_dump()
            res_dict["tool"] = tool_name
            return res_dict

        max_retries = 1
        backoff_sec = 0.5
        for attempt in range(max_retries):
            try:
                # Execute tool implementation with a 10s timeout guard
                output = await asyncio.wait_for(func(**validated_args), timeout=10.0)
                success = True
                break
            except asyncio.TimeoutError as exc:
                logger.warning("[%s] Tool %s timed out (attempt %d/%d)", trace_id, tool_name, attempt + 1, max_retries)
                if attempt == max_retries - 1:
                    success = False
                    error_type = "TIMEOUT"
                    failure_reason = "Request timed out."
                    output = f"Execution Failure: {failure_reason}"
                    break
                await asyncio.sleep(backoff_sec)
                backoff_sec *= 2.0
            except Exception as exc:
                logger.warning("[%s] Tool %s failed (attempt %d/%d): %s", trace_id, tool_name, attempt + 1, max_retries, exc)
                if attempt == max_retries - 1:
                    success = False
                    error_type, failure_reason = _map_exception_to_error(exc)
                    output = f"Execution Failure: {failure_reason}"
                    break
                await asyncio.sleep(backoff_sec)
                backoff_sec *= 2.0

        # Update Circuit Breaker metrics
        if success:
            _circuit_failures[tool_name] = 0
            # Cache the successful result for 60 seconds
            if redis_client:
                try:
                    await redis_client.setex(cache_key, 60, output)
                except Exception as cache_exc:
                    logger.warning("Redis cache write error: %s", cache_exc)
        else:
            _circuit_failures[tool_name] = _circuit_failures.get(tool_name, 0) + 1
            if _circuit_failures[tool_name] >= CIRCUIT_THRESHOLD:
                _circuit_open_until[tool_name] = time.time() + CIRCUIT_COOLDOWN
                logger.warning("[%s] Circuit Breaker OPENED for tool %s", trace_id, tool_name)

    duration_ms = int((time.monotonic() - start_time) * 1000)
    
    # 6. Extract citations if success
    citations = []
    if success:
        try:
            parsed_data = json.loads(output, strict=False)
            if tool_name == "search_tasks" and isinstance(parsed_data, list):
                for item in parsed_data:
                    if isinstance(item, dict) and ("id" in item or "identifier" in item):
                        citations.append(Citation(
                            entity_type="task",
                            entity_id=item.get("id") or item.get("identifier"),
                            title=item.get("title") or "Task",
                            confidence=1.0
                        ))
            elif tool_name == "search_meetings" and isinstance(parsed_data, list):
                for item in parsed_data:
                    if isinstance(item, dict) and "metadata" in item:
                        meta = item["metadata"]
                        citations.append(Citation(
                            entity_type="meeting",
                            entity_id=meta.get("comment_id") or "meeting-1",
                            title=meta.get("author", "Meeting Review"),
                            confidence=0.9
                        ))
            elif tool_name == "search_decisions" and isinstance(parsed_data, list):
                for item in parsed_data:
                    if isinstance(item, dict):
                        citations.append(Citation(
                            entity_type="decision",
                            entity_id=item.get("id") or "decision-1",
                            title=item.get("title") or "Decision",
                            confidence=1.0
                        ))
        except Exception:
            pass

    # Create ToolResult warnings (friendly and user-facing)
    warnings_list = []
    if not success:
        friendly_error = FRIENDLY_TOOL_FAILURES.get(tool_name, "Unable to load requested information.")
        warnings_list.append(friendly_error)
        
    tool_res = ToolResult(
        status="success" if success else "failed",
        content=output,
        citations=citations,
        warnings=warnings_list,
        confidence=1.0 if success else 0.0,
        duration_ms=duration_ms,
        cache_hit=cache_hit,
        error_type=error_type
    )
    if token_queue:
        try:
            friendly_names = {
                "search_tasks": "tasks database search",
                "search_users": "team capacity check",
                "search_approvals": "approvals check",
                "search_workflows": "workflows check",
                "search_meetings": "meeting transcripts search",
                "search_calendar": "calendar check",
                "search_decisions": "decision register check",
                "search_analytics": "analytics scan",
                "get_task_dependencies": "dependencies analysis",
                "get_blocker_chain": "blockers scan",
                "get_workflow_graph": "workflow graph mapping",
                "get_org_graph": "org graph mapping",
                "create_task": "task creation proposal",
                "assign_task": "task assignment proposal",
                "update_task": "task update proposal",
                "send_notification": "notification escalation",
                "create_reminder": "reminder creation",
                "start_approval": "approval sequence initiation",
            }
            name = friendly_names.get(tool_name, tool_name)
            status_text = f"✓ Completed: {name}" if success else f"✗ Failed: {name}"
            await token_queue.put({"event": "tool_complete", "status": status_text})
        except Exception:
            pass

    # Log structured metrics
    _log_tool_telemetry(trace_id, tool_name, args, duration_ms, success, failure_reason, cache_hit)

    res_dict = tool_res.model_dump()
    res_dict["tool"] = tool_name
    return res_dict


async def execute_tool_plan(state: dict, tool_calls: list[dict]) -> dict:
    """Schedules and runs a list of tool execution steps, honoring sequential dependencies."""
    trace_id = state.get("trace_id", "system-trace")
    logger.info("[%s] Execution Plan Scheduler: scheduling %d tool calls", trace_id, len(tool_calls))

    # PROGRESSIVE STATUS: Notify user we're executing tools
    token_queue = state.get("token_queue")
    if token_queue:
        tool_names = [c["tool"] for c in tool_calls]
        # Map tool names to user-friendly descriptions
        tool_descriptions = {
            "search_tasks": "🔍 Searching tasks...",
            "search_users": "👥 Analyzing team workload...",
            "search_approvals": "🛡️ Checking pending approvals...",
            "search_workflows": "⚙️ Reviewing workflows...",
            "search_calendar": "📅 Loading calendar data...",
            "search_analytics": "📊 Computing project metrics...",
            "get_task_dependencies": "🔗 Mapping dependencies...",
            "get_blocker_chain": "🚧 Identifying blockers...",
        }
        # Send first tool status or generic message
        first_tool_desc = tool_descriptions.get(tool_names[0], "🔎 Gathering workspace data...")
        await token_queue.put({
            "type": "status",
            "message": first_tool_desc,
            "event": "tool_execution_start"
        })

    # Initialize redis
    try:
        redis_client = await get_redis_client()
    except Exception as exc:
        logger.warning("Could not establish Redis client in scheduler: %s", exc)
        redis_client = None

    # Step 1: Topological Sort / Dependency Batching
    already_executed = set(state.get("executed_tools") or [])
    plan_tools = {c["tool"] for c in tool_calls}
    resolved: list[list[dict]] = []
    unresolved = list(tool_calls)
    
    # Maximum security iterations to prevent infinite topological loops
    safety_iters = 0
    while unresolved and safety_iters < 15:
        safety_iters += 1
        batch = []
        for call in list(unresolved):
            t_name = call["tool"]
            t_def = TOOL_REGISTRY.get(t_name)
            t_deps = t_def.dependencies if t_def else []
            
            dependencies_satisfied = all(
                dep in already_executed or dep not in plan_tools
                for dep in t_deps
            )
            
            if dependencies_satisfied:
                batch.append(call)
                unresolved.remove(call)
                
        if not batch:
            logger.warning("[%s] Cyclic dependencies detected or missing parent tools. Running remaining sequentially.", trace_id)
            batch = [unresolved.pop(0)]
            
        for b_call in batch:
            already_executed.add(b_call["tool"])
            
        resolved.append(batch)

    # Step 2: Batch Execution
    results = list(state.get("tool_results") or [])
    executed = list(state.get("executed_tools") or [])
    warnings = []
    total_duration_ms = 0
    budget_used = 0.0
    failed_tools = set()

    for batch in resolved:
        # Check dependencies for cascading failures
        runnable_calls = []
        skipped_results = []
        for call in batch:
            t_name = call["tool"]
            t_def = TOOL_REGISTRY.get(t_name)
            t_deps = t_def.dependencies if t_def else []
            
            # Find any dependencies that failed in previous batches
            failed_deps = [dep for dep in t_deps if dep in failed_tools]
            if failed_deps:
                logger.warning("[%s] Cascade Protection Block: tool '%s' skipped because dependency '%s' failed.", 
                               trace_id, t_name, failed_deps)
                skipped_results.append({
                    "status": "failed",
                    "content": "Prerequisite information was unavailable.",
                    "citations": [],
                    "warnings": ["Skipped due to unavailable prerequisite."],
                    "confidence": 0.0,
                    "duration_ms": 0,
                    "cache_hit": False,
                    "error_type": "DEPENDENCY_FAILURE",
                    "tool": t_name
                })
                failed_tools.add(t_name)
            else:
                runnable_calls.append(call)

        # Run independent batch concurrently
        tasks = [
            run_single_tool(call["tool"], call.get("arguments") or {}, state, redis_client)
            for call in runnable_calls
        ]
        batch_results = await asyncio.gather(*tasks) if runnable_calls else []
        all_batch_results = list(batch_results) + skipped_results

        # Merge results
        for res in all_batch_results:
            results.append({
                "tool": res["tool"],
                "status": res["status"],
                "content": res["content"]
            })
            executed.append(res["tool"])
            total_duration_ms += res["duration_ms"]
            
            # Calculate cost based on tool category
            t_def = TOOL_REGISTRY.get(res["tool"])
            tool_cost = 0.0005 if t_def and t_def.category == "write" else 0.0001
            budget_used += tool_cost
            
            if res.get("warnings"):
                warnings.extend(res["warnings"])

            # If tool failed, add to failed_tools set so downstream dependencies are skipped
            if res["status"] == "failed":
                failed_tools.add(res["tool"])
                
            already_executed.add(res["tool"])

    # Clean up redis client
    if redis_client:
        await redis_client.close()

    # PROGRESSIVE STATUS: Notify user tools are complete
    if token_queue:
        await token_queue.put({
            "type": "status",
            "message": "✍️ Preparing your response...",
            "event": "tool_execution_complete"
        })

    # Budget allocation check
    remaining_budget = state.get("remaining_budget", 0.05) - budget_used

    return {
        "tool_results": results,
        "executed_tools": executed,
        "remaining_budget": max(remaining_budget, 0.0),
        "response_metadata": {
            **state.get("response_metadata", {}),
            "total_tool_duration_ms": total_duration_ms,
            "tool_warnings": warnings
        }
    }
