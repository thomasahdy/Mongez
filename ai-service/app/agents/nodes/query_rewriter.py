"""Query Rewriter Node — rewrites vague follow-up queries into standalone questions.

Skips rewriting when the query is clearly self-contained (>6 words, no pronouns)
to save the ~150ms Groq fast model round-trip.
"""
import logging
from app.agents.state import MongezAgentState

logger = logging.getLogger(__name__)

# Pronouns that typically indicate a follow-up question needing context
_PRONOUNS = {"it", "that", "this", "they", "them", "those", "its", "he", "she", "their", "again", "tani", "تاني", "الآخر", "السابق"}


async def query_rewriter_node(state: MongezAgentState) -> dict:
    """Rewrite vague follow-up queries into fully self-contained questions.

    Decision logic:
    - Separate the history/preferences prefix from the clean user query.
    - If query has no ambiguous pronouns → skip (pass through as-is)
    - Otherwise → use fast model + query_rewriter prompt to rewrite

    Returns:
        {"rewritten_query": str}  — always set
    """
    from app.dependencies import llm_client, get_prompt_loader

    raw = (state.get("raw_input") or "").strip()
    if not raw:
        return {"rewritten_query": ""}

    # Parse and extract user request from the enriched format
    user_query = raw
    history_block = "[No conversation history available]"
    if "User request:" in raw:
        parts = raw.split("User request:", 1)
        history_block = parts[0].strip()
        user_query = parts[1].strip()

    words = user_query.lower().split()
    has_pronoun = any(w in _PRONOUNS for w in words)

    # Check if the query is a simple greeting
    greetings = {"hi", "hello", "hey", "howdy", "yo", "greetings", "morning", "afternoon", "evening", "سلام", "مرحبا", "اهلا"}
    is_greeting = any(w in greetings for w in words) if words else False

    if not has_pronoun or is_greeting:
        logger.debug("Query rewriter: skipping (greeting or no pronouns to resolve): %r", user_query[:80])
        return {"rewritten_query": user_query}

    # Use fast model to rewrite
    try:
        prompt_loader = get_prompt_loader()
        
        # Format history block for the prompt
        # We only keep the Conversation History part from the history block if it's there
        history_text = history_block
        if "Conversation history:" in history_block:
            history_text = history_block.split("Conversation history:", 1)[1].strip()

        prompt = prompt_loader.load(
            "query_rewriter",
            last_3_messages=history_text,
            user_input=user_query,
        )
        result = await llm_client.invoke("fast", prompt, user_query)
        rewritten = result["content"].strip()

        # Strip any "Rewritten query:" prefix the model might include
        for prefix in ("Rewritten query:", "Rewritten Query:", "rewritten query:"):
            if rewritten.lower().startswith(prefix.lower()):
                rewritten = rewritten[len(prefix):].strip()
                break

        # Guard: if the model returned something clearly wrong or too long, fall back
        if not rewritten or len(rewritten) < 3 or len(rewritten) > len(user_query) * 5:
            rewritten = user_query

        logger.debug("Query rewriter: %r → %r", user_query[:60], rewritten[:60])
        return {"rewritten_query": rewritten}
    except Exception as exc:
        logger.warning("Query rewriter failed (%s), using user_query", exc)
        return {"rewritten_query": user_query}
