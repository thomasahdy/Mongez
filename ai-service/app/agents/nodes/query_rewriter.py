"""Query Rewriter Node — rewrites vague follow-up queries into standalone questions.

Skips rewriting when the query is clearly self-contained (>6 words, no pronouns)
to save the ~150ms Groq fast model round-trip.
"""
import logging
from app.agents.state import MongezAgentState

logger = logging.getLogger(__name__)

# Pronouns that typically indicate a follow-up question needing context
_PRONOUNS = {"it", "that", "this", "they", "them", "those", "its", "he", "she", "their"}


async def query_rewriter_node(state: MongezAgentState) -> dict:
    """Rewrite vague follow-up queries into fully self-contained questions.

    Decision logic:
    - If query is >6 words AND has no ambiguous pronouns → skip (pass through as-is)
    - Otherwise → use fast model + query_rewriter prompt to rewrite

    Returns:
        {"rewritten_query": str}  — always set, same as raw_input if no rewrite needed
    """
    from app.dependencies import llm_client, prompt_loader

    raw = (state.get("raw_input") or "").strip()
    if not raw:
        return {"rewritten_query": ""}

    words = raw.lower().split()
    has_pronoun = any(w in _PRONOUNS for w in words)

    # Skip rewriting if the query looks self-contained
    if len(words) > 6 and not has_pronoun:
        logger.debug("Query rewriter: skipping (self-contained): %r", raw[:80])
        return {"rewritten_query": raw}

    # Use fast model to rewrite
    try:
        prompt = prompt_loader.load(
            "query_rewriter",
            last_3_messages="[No conversation history available]",
            user_input=raw,
        )
        result = await llm_client.invoke("fast", prompt, raw)
        rewritten = result["content"].strip()

        # Guard: if the model returned something clearly wrong, fall back
        if not rewritten or len(rewritten) < 3:
            rewritten = raw

        logger.debug("Query rewriter: %r → %r", raw[:60], rewritten[:60])
        return {"rewritten_query": rewritten}
    except Exception as exc:
        logger.warning("Query rewriter failed (%s), using raw input", exc)
        return {"rewritten_query": raw}
