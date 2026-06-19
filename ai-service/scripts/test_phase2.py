"""
Phase 2 live test script -- tests the LLMClient against the real Groq API.

Run from ai-service/ directory:
    .venv\\Scripts\\python scripts\\test_phase2.py
"""
import asyncio
import sys
import time
import io
from pathlib import Path

# Force UTF-8 output on Windows
if sys.platform == "win32":
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

# Add the ai-service root to sys.path so we can import app.*
sys.path.insert(0, str(Path(__file__).parent.parent))

from app.config import get_settings
from app.clients.llm_client import LLMClient
from app.prompts.loader import PromptLoader


async def test_fast_model(client: LLMClient):
    print("\n" + "─" * 60)
    print("TEST 1: Fast model (gemma2-9b-it) — intent classification")
    print("─" * 60)
    result = await client.invoke(
        tier="fast",
        system_prompt="You are a request classifier. Reply with ONLY one word: 'risk', 'chat', 'report', or 'data'.",
        user_message="Is my project at risk of missing the deadline?",
    )
    print(f"  Response : {result['content']!r}")
    print(f"  Model    : {result['model']}")
    print(f"  Latency  : {result['latency_ms']}ms")
    print(f"  Tokens   : {result['tokens_in']} in → {result['tokens_out']} out")
    assert result["content"].strip().lower() in {"risk", "chat", "report", "data"}, \
        f"Unexpected response: {result['content']!r}"
    print("  ✅ PASS — response is a valid intent class")
    return result


async def test_primary_model(client: LLMClient):
    print("\n" + "─" * 60)
    print("TEST 2: Primary model (llama-3.3-70b) — risk analysis with real prompt")
    print("-" * 60)
    loader = PromptLoader()
    system_prompt = loader.load("risk_detector")

    context = """
<context>
Tasks:
- EDU-001: "Backend API refactor" — status: BLOCKED, assignee: Omar, dueDate: 2026-05-10 (OVERDUE 5 days)
- EDU-002: "Design review" — status: IN_PROGRESS, assignee: Sara, dueDate: 2026-05-20
- EDU-003: "Database migration" — status: TODO, assignee: None (no assignee), priority: URGENT
</context>

Analyze the risk for this project.
"""

    result = await client.invoke(
        tier="primary",
        system_prompt=system_prompt,
        user_message=context,
    )
    print(f"  Model    : {result['model']}")
    print(f"  Latency  : {result['latency_ms']}ms")
    print(f"  Tokens   : {result['tokens_in']} in → {result['tokens_out']} out")
    print(f"  Response :\n{result['content']}")

    import json
    parsed = json.loads(result["content"])
    assert parsed["risk"] in {"HIGH", "MEDIUM", "LOW"}, "risk field missing"
    assert "reason" in parsed
    assert "confidence" in parsed
    print("  ✅ PASS — response is valid JSON with correct schema")
    return result


async def test_streaming(client: LLMClient):
    print("\n" + "─" * 60)
    print("TEST 3: Streaming tokens (primary model)")
    print("-" * 60)
    loader = PromptLoader()
    system_prompt = loader.load(
        "chat_assistant",
        user_name="Test User",
        user_role="Project Manager",
        space_name="Alpha",
        board_name="Sprint 1",
    )

    tokens = []
    start = time.monotonic()
    first_token_ms = None

    print("  Streaming: ", end="", flush=True)
    async for token in client.stream(
        tier="primary",
        system_prompt=system_prompt,
        user_message="<context>No tasks available.</context>\nHow many tasks are in progress?",
    ):
        tokens.append(token)
        if first_token_ms is None:
            first_token_ms = int((time.monotonic() - start) * 1000)
        print(token, end="", flush=True)

    total_ms = int((time.monotonic() - start) * 1000)
    print()
    print(f"  First token : {first_token_ms}ms  (target <500ms)")
    print(f"  Total tokens: {len(tokens)}")
    print(f"  Total time  : {total_ms}ms")
    assert len(tokens) > 0, "No tokens streamed"
    print("  ✅ PASS — streaming works, received tokens")


async def test_prompt_loader():
    print("\n" + "─" * 60)
    print("TEST 4: PromptLoader — variable substitution")
    print("-" * 60)
    loader = PromptLoader()

    prompt = loader.load(
        "chat_assistant",
        user_name="Thomas",
        user_role="PM",
        space_name="Mongez",
        board_name="Sprint 2",
    )
    assert "Thomas" in prompt
    assert "{user_name}" not in prompt
    print(f"  Loaded chat_assistant: {len(prompt)} chars")

    v = loader.get_latest_version("risk_detector")
    assert v == "v1.0"
    print(f"  Latest risk_detector version: {v}")

    prompts = loader.list_prompts()
    assert len(prompts) == 4
    print(f"  Available prompts: {prompts}")
    print("  ✅ PASS")


async def main():
    print("=" * 60)
    print("  Mongez AI Service -- Phase 2 Live Tests")
    print("=" * 60)

    settings = get_settings()
    print(f"\nGroq primary  : {settings.groq_model_primary}")
    print(f"Groq fast     : {settings.groq_model_fast}")

    if settings.groq_api_key.startswith("gsk_your"):
        print("\n❌ ERROR: GROQ_API_KEY is still the placeholder. Add your real key to .env")
        sys.exit(1)

    client = LLMClient(settings)

    await test_prompt_loader()
    await test_fast_model(client)
    await test_primary_model(client)
    await test_streaming(client)

    print("-" * 60)
    print("  All Phase 2 tests passed!")
    print("-" * 60)


if __name__ == "__main__":
    asyncio.run(main())
