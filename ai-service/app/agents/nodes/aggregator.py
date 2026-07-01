"""Aggregator Node — formulated conversational response using the single LLM tier."""
import logging
import json
import time
import asyncio
from app.agents.state import MongezAgentState
from app.rag.compressor import compress_context

logger = logging.getLogger(__name__)

# Greeting responses for fast routing bypass fallback
GREETING_RESPONSES_EN = [
    "Hello! How can I help you with your workspace today?",
    "Hi there! What would you like to know about your projects?",
    "Hey! I'm here to help with task management, approvals, and project insights.",
]

# Planner System Prompt
_PLANNER_SYSTEM = """You are the Project Planner for the Mongez AI Operating System.
Your job is to break down the user's project request (e.g. "Build an LMS") into a set of phases, milestones, and tasks, and distribute them to the available team members.

Available Space Members:
{members_json}

Rules:
1. Break down the user's request into a set of logical milestones/tasks (usually 4 to 8 tasks).
2. Distribute tasks across space members reasonably based on their current active tasks/workload. Do not overload anyone.
3. For each task, define:
   - title: concise title
   - description: detailed description of requirements
   - priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT"
   - estimated_hours: estimated effort in hours
   - assignees: list of names of space members assigned to this task
4. Output valid JSON in this exact schema:
{{
  "answer": "A detailed Markdown explanation of the project plan, milestones, and task distribution. Use clean bullet points and milestones.",
  "tasks": [
     {{
       "title": "Task title",
       "description": "Task description",
       "priority": "MEDIUM",
       "estimated_hours": 8,
       "assignees": ["Member Name 1"]
     }}
  ]
}}
Output ONLY the JSON object. Do not wrap in markdown or add filler."""

# General Aggregator Prompt
_SYSTEM = """You are the Mongez Workspace Copilot (Lead Aggregator).
Your job is to formulate a premium, structured response to the user's query based on the collected tool execution results and semantic comments/logs.

User Query: {query}
User Role: {role}
User Name: {name}
Space Name: {space}

Collected Tool Results:
{tool_results_json}

Semantic RAG Context (Task comments / logs):
{rag_context}

Rules:
1. Ground your answer strictly in the provided tool results and semantic RAG context. Citing task identifiers (e.g. EDU-42) is critical for trust.
2. Provide a premium presentation. Format tables for list analytics, and use clear markdown titles.
3. Keep responses concise (3-5 sentences) unless a report is explicitly requested.
4. Output valid JSON in this exact schema:
{{
  "answer": "Primary detailed Markdown answer response. Use clean tables, bullet points, and charts if needed.",
  "summary": "1-2 sentence executive summary of the response.",
  "insights": [
     "Key metrics highlight 1",
     "Key metrics highlight 2"
  ],
  "risks": [
     "Risk or blocker description 1",
     "Risk or blocker description 2"
  ],
  "suggested_actions": [
     {{
       "command_type": "AssignTask" | "EscalateTask" | "CreateReminder" | "UpdateTask" | "CreateTask" | "StartApproval",
       "payload": {{ "taskId": "xxx", "status": "xxx" }},
       "reason": "Why this action is recommended"
     }}
  ],
  "citations": [
     {{
       "entity_type": "task" | "meeting" | "decision" | "workflow" | "approval",
       "entity_id": "UUID-or-Identifier",
       "title": "Title/Name of entity",
       "confidence": 1.0
     }}
  ],
  "warnings": ["Warning texts if any"]
}}
Output ONLY the JSON. No other text. Do not wrap in markdown tags."""


async def aggregator_node(state: MongezAgentState) -> dict:
    """Aggregator Node — synthesizes the final response in a single LLM invocation."""
    from app.dependencies import llm_client, nestjs_client, get_prompt_loader

    query = state.get("rewritten_query") or state.get("raw_input") or ""
    intent = state.get("intent", "chat")
    tool_results = state.get("tool_results") or []
    space_id = state.get("space_id", "")
    trace_id = state.get("trace_id", "")

    # 1. GREETING INTENT
    if intent == "greeting":
        import random
        from app.clients.llm_client import detect_arabic
        
        GREETING_RESPONSES_AR = [
            "مرحبا! كيف يمكنني مساعدتك في مساحة العمل اليوم؟",
            "أهلا بك! ما الذي تود معرفته عن مشاريعك؟",
            "هلا! أنا هنا للمساعدة في إدارة المهام والموافقات ورؤى المشروع.",
            "تحية! كيف يمكنني مساعدتك في منجز اليوم؟",
        ]
        
        if detect_arabic(query):
            ans = random.choice(GREETING_RESPONSES_AR)
        else:
            ans = random.choice(GREETING_RESPONSES_EN)
            
        return {
            "final_response": ans,
            "response_metadata": {
                "agent": "aggregator",
                "summary": "Greeting",
                "insights": [],
                "risks": [],
                "citations": [],
                "warnings": [],
                "actions": [],
            }
        }

    # 2. PLANNER INTENT
    if intent == "planner":
        # Extract members from search_users result
        users_result = {}
        for res in tool_results:
            if res.get("tool") == "search_users" and res.get("status") == "success":
                try:
                    users_result = json.loads(res.get("content", "{}"))
                except Exception:
                    pass

        # If we failed to get users, fall back to empty users list
        members_json = json.dumps(users_result, indent=2)

        system_prompt = _PLANNER_SYSTEM.format(members_json=members_json)
        try:
            # Generate the plan with LLM
            llm_res = await llm_client.invoke(
                "primary",
                system_prompt,
                f"Plan project: {query}",
                token_queue=state.get("token_queue")
            )
            content = llm_res["content"].strip()
            
            # Clean potential markdown JSON wrapping
            if content.startswith("```json"):
                content = content.split("```json", 1)[1]
            if content.endswith("```"):
                content = content.rsplit("```", 1)[0]
            
            from app.utils.json_parser import safe_json_parse
            parsed = safe_json_parse(content.strip())
            answer = parsed.get("answer", "")
            tasks = parsed.get("tasks", [])

            # Create proposed tasks in parallel in the backend database
            actions_to_propose = []
            
            # Build name to ID map
            name_to_id = {}
            for name, u in users_result.items():
                name_to_id[name] = u.get("id") or ""

            # Resolve default board id or name
            board_id = state.get("board_id") or "board_alpha_sprint1"

            for t in tasks:
                assignee_ids = [name_to_id[name] for name in t.get("assignees", []) if name in name_to_id]
                payload = {
                    "taskDto": {
                        "title": t["title"],
                        "description": t.get("description", ""),
                        "boardId": board_id,
                        "priority": t.get("priority", "MEDIUM"),
                        "estimatedHours": t.get("estimated_hours", 8),
                        "assigneeIds": assignee_ids,
                    },
                    "spaceId": space_id
                }
                action = {
                    "command_type": "CreateTask",
                    "payload": payload,
                    "reason": f"AI proposed task creation for project: {query}"
                }
                actions_to_propose.append(action)

            # Parallel propose actions
            propose_tasks = [nestjs_client.propose_action(trace_id, space_id, act) for act in actions_to_propose]
            proposed_results = await asyncio.gather(*propose_tasks, return_exceptions=True)

            client_actions = []
            for act, res in zip(actions_to_propose, proposed_results):
                if isinstance(res, Exception):
                    logger.error("Failed to propose task action: %s", res)
                else:
                    client_actions.append({
                        "id": res.get("id"),
                        "commandType": act["command_type"],
                        "payload": act["payload"],
                        "reason": act["reason"]
                    })

            return {
                "final_response": answer,
                "response_metadata": {
                    "agent": "planner",
                    "summary": f"Plan: {query}",
                    "insights": [f"Proposed {len(client_actions)} tasks distributed across your team."],
                    "risks": [],
                    "citations": [],
                    "warnings": [],
                    "actions": client_actions,
                }
            }

        except Exception as exc:
            logger.error("Planner node failed: %s", exc)
            return {
                "final_response": "I encountered an error generating the project plan. Please try again.",
                "response_metadata": {
                    "error": str(exc),
                    "actions": []
                }
            }

    # 3. OTHER COPILET INTENTS (chat, risk, report, calendar, action)
    # Check if all tools failed (either status is not success, or the tool returned an error dictionary)
    failed_tools = []
    for r in tool_results:
        if r.get("status") != "success":
            failed_tools.append(r)
            continue
        content = r.get("content", "")
        if isinstance(content, str) and content.strip().startswith("{"):
            try:
                parsed_content = json.loads(content)
                if isinstance(parsed_content, dict) and "error" in parsed_content:
                    failed_tools.append(r)
            except Exception:
                pass
    all_failed = len(failed_tools) == len(tool_results) if tool_results else False

    if all_failed:
        logger.warning("All data retrieval tools failed for query: %s", query)
        error_response = "I couldn't access live workspace data right now. Please retry in a few moments."
        return {
            "final_response": error_response,
            "response_metadata": {
                "agent": "aggregator",
                "summary": "Data unavailable",
                "error": error_response,
                "insights": [],
                "risks": [],
                "citations": [],
                "warnings": ["All data retrieval tools failed"],
                "actions": [],
            }
        }

    # Clean tool results to strip execution metadata (like duration, cache hit) and parse JSON contents
    cleaned_results = []
    for r in tool_results:
        tool_name = r.get("tool")
        content_raw = r.get("content", "")
        # Safely parse stringified JSON content for cleaner representation
        parsed_content = content_raw
        if isinstance(content_raw, str) and content_raw.strip().startswith(("[", "{")):
            try:
                parsed_content = json.loads(content_raw)
            except Exception:
                pass
        cleaned_results.append({
            "tool": tool_name,
            "data": parsed_content,
            "warnings": r.get("warnings", [])
        })

    # Context budgeting and compression
    try:
        tool_results_str = json.dumps(cleaned_results, indent=2, ensure_ascii=False)
        compressed_results = await compress_context(tool_results_str, query)
    except Exception:
        compressed_results = json.dumps(cleaned_results, ensure_ascii=False)

    # Format RAG retrieved context if present
    retrieved_context = state.get("retrieved_context") or []
    rag_context_str = ""
    if retrieved_context:
        rag_context_str = "\n".join([
            f"- [Score: {r.get('score', 0.0):.2f}] {r.get('text', '')}"
            for r in retrieved_context
        ])
    else:
        rag_context_str = "No semantic comments or logs retrieved for this query."

    # Load specialized aggregator system prompt based on intent
    try:
        prompt_loader = get_prompt_loader()
        prompt_name = "aggregator_chat"
        if intent == "risk":
            prompt_name = "aggregator_risk"
        elif intent == "report":
            prompt_name = "aggregator_report"
        elif intent == "calendar":
            prompt_name = "aggregator_calendar"
            
        system_prompt = prompt_loader.load(
            prompt_name,
            query=query,
            role=state.get("user_role", "Member"),
            name=state.get("user_name", "User"),
            space=state.get("space_name", "Workspace"),
            tool_results_json=compressed_results,
            rag_context=rag_context_str
        )
    except Exception as prompt_exc:
        logger.warning("Failed to load specialized prompt %s, falling back to static prompt: %s", intent, prompt_exc)
        system_prompt = _SYSTEM.format(
            query=query,
            role=state.get("user_role", "Member"),
            name=state.get("user_name", "User"),
            space=state.get("space_name", "Workspace"),
            tool_results_json=compressed_results,
            rag_context=rag_context_str
        )

    try:
        # Call primary LLM
        result = await llm_client.invoke(
            "primary",
            system_prompt,
            "Synthesize final response.",
            token_queue=state.get("token_queue")
        )

        content = result["content"].strip()
        
        # Remove DeepSeek <think>...</think> block if present
        import re
        content = re.sub(r'<think>.*?</think>', '', content, flags=re.DOTALL).strip()
        
        # Clean potential markdown JSON wrapping
        if "```json" in content:
            content = content.split("```json", 1)[1]
        elif "```" in content:
            content = content.split("```", 1)[1]
            
        if "```" in content:
            content = content.rsplit("```", 1)[0]
            
        content = content.strip()

        from app.utils.json_parser import safe_json_parse_with_answer
        parsed = safe_json_parse_with_answer(content)
        
        # Map actions key correctly to actions metadata, only if explicitly requested by action keywords
        actions = []
        query_lower = query.lower()
        explicit_action_keywords = [
            "create", "plan", "build", "generate", "organize", "automate",
            "assign", "reassign", "update", "reminder", "notify", "escalate",
            "إنشاء", "انشاء", "خطط", "ابن", "توليد", "تنظيم", "أتمتة", "اتمتة",
            "تعملي", "سوي", "اضف", "أضف", "ضيف", "سجل", "حدث", "تحديث", "عين", "اسند", "أسند",
            "تذكير", "تاسك جديدة", "مهمة جديدة"
        ]
        if any(keyword in query_lower for keyword in explicit_action_keywords):
            for act in parsed.get("suggested_actions", []):
                actions.append({
                    "commandType": act.get("command_type") or act.get("commandType"),
                    "payload": act.get("payload", {}),
                    "reason": act.get("reason", "")
                })

        return {
            "final_response": parsed.get("answer", ""),
            "response_metadata": {
                "agent": "aggregator",
                "summary": parsed.get("summary", ""),
                "insights": parsed.get("insights", []),
                "risks": parsed.get("risks", []),
                "citations": parsed.get("citations", []),
                "warnings": parsed.get("warnings", []),
                "actions": actions,
            }
        }

    except Exception as exc:
        logger.error("Aggregator node failed: %s", exc)
        # Check if the LLM output was plain markdown text instead of JSON
        if 'content' in locals() and content and not content.startswith("{"):
            return {
                "final_response": content,
                "response_metadata": {
                    "agent": "aggregator",
                    "summary": "Workspace insights",
                    "insights": [],
                    "risks": [],
                    "citations": [],
                    "warnings": [],
                    "actions": [],
                }
            }
        return {
            "final_response": "I encountered an error synthesizing the results. Please try again.",
            "response_metadata": {
                "error": str(exc),
                "actions": []
            }
        }
