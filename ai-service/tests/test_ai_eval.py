import pytest
from unittest.mock import AsyncMock
from app.agents.nodes.risk_detector import risk_detector_node

# Golden dataset of task conditions
GOLDEN_DATASET = [
    {"task_id": "T1", "is_overdue": True, "is_blocked": False, "has_risk": True},
    {"task_id": "T2", "is_overdue": False, "is_blocked": False, "has_risk": False},
    {"task_id": "T3", "is_overdue": False, "is_blocked": True, "has_risk": True},
    {"task_id": "T4", "is_overdue": False, "is_blocked": False, "has_risk": False},
    {"task_id": "T5", "is_overdue": True, "is_blocked": True, "has_risk": True},
]


@pytest.mark.asyncio
async def test_risk_detector_evaluation(setup_dependencies):
    """Evaluate precision and recall of the risk detector on a golden evaluation dataset."""
    deps = setup_dependencies
    
    # Custom LLM mock that returns Risk Level based on text properties
    class EvalLLMClient:
        async def invoke(self, tier, system_prompt, user_message):
            if "overdue" in user_message.lower() or "blocked" in user_message.lower():
                return {
                    "content": '{"risk": "HIGH", "reason": "overdue or blocked", "confidence": 0.9, "issues": [{"type": "overdue", "description": "delayed", "severity": "HIGH"}], "suggested_actions": ["reassign"]}',
                    "model": "eval-model",
                    "latency_ms": 5,
                    "tokens_in": 10,
                    "tokens_out": 5,
                }
            return {
                "content": '{"risk": "LOW", "reason": "on track", "confidence": 0.9, "issues": [], "suggested_actions": []}',
                "model": "eval-model",
                "latency_ms": 5,
                "tokens_in": 10,
                "tokens_out": 5,
            }

    deps.llm_client = EvalLLMClient()
    
    true_positives = 0
    false_positives = 0
    false_negatives = 0
    true_negatives = 0

    for sample in GOLDEN_DATASET:
        task_desc = f"Task {sample['task_id']} details."
        if sample['is_overdue']:
            task_desc += " It is past its due date (overdue)."
        if sample['is_blocked']:
            task_desc += " It is blocked by another item."
            
        async def local_get_tasks(space_id):
            title = f"Task {sample['task_id']}"
            if sample['is_overdue']:
                title += " overdue"
            status = "TODO"
            if sample['is_blocked']:
                status = "BLOCKED"
            return [{"id": sample["task_id"], "title": title, "status": status}]
            
        async def local_retrieve(query, space_id, top_k=5, task_ids=None, source_types=None):
            return [{"text": task_desc, "score": 0.9, "metadata": {"space_id": space_id}}]
            
        def local_format_context(results):
            text_parts = [r["text"] for r in results]
            return f"<context>{' '.join(text_parts)}</context>"
            
        deps.nestjs_client.get_tasks = local_get_tasks
        deps.retriever.retrieve = AsyncMock(side_effect=local_retrieve)
        deps.retriever.format_as_xml_context = local_format_context

        state = {
            "raw_input": "Analyse task risk",
            "rewritten_query": "Analyse task risk",
            "intent": "risk",
            "space_id": "space-1",
            "user_id": "user-1",
            "task_data": [],
            "retrieved_context": [],
        }
        
        result_delta = await risk_detector_node(state)
        response_text = result_delta.get("final_response", "")
        detected_risk = "Risk Level: HIGH" in response_text
        
        actual_risk = sample["has_risk"]

        
        if detected_risk and actual_risk:
            true_positives += 1
        elif detected_risk and not actual_risk:
            false_positives += 1
        elif not detected_risk and actual_risk:
            false_negatives += 1
        else:
            true_negatives += 1
            
    # Calculate Precision & Recall
    precision = true_positives / (true_positives + false_positives) if (true_positives + false_positives) > 0 else 0
    recall = true_positives / (true_positives + false_negatives) if (true_positives + false_negatives) > 0 else 0
    
    # Target assertions
    assert recall >= 0.80, f"Recall was {recall:.2f}, expected >= 0.80"
    assert precision >= 0.80, f"Precision was {precision:.2f}, expected >= 0.80"
