"""
Safe JSON parser for LLM outputs.

Provides multiple fallback strategies for parsing potentially malformed JSON
from LLM responses, preventing crashes from malformed output.
"""

import re
import json
import logging
from typing import Any, Dict

logger = logging.getLogger(__name__)


def safe_json_parse(content: str, default: Dict[str, Any] | None = None) -> Dict[str, Any]:
    """
    Parse LLM output safely with multiple fallback strategies.

    This function attempts to parse JSON content using four different strategies:
    1. Direct JSON parse (strict=False for leniency)
    2. Extract JSON from markdown code blocks
    3. Extract JSON from curly braces
    4. Fix common JSON errors and retry

    Args:
        content: Raw LLM response content
        default: Default return value if all parsing fails

    Returns:
        Parsed JSON dict or default value

    Examples:
        >>> safe_json_parse('{"answer": "hello"}')
        {'answer': 'hello'}

        >>> safe_json_parse('Some text ```json {"key": "value"} ``` more text')
        {'key': 'value'}

        >>> safe_json_parse('malformed content', default={'fallback': True})
        {'fallback': True}
    """
    if not content:
        return default or {}

    content = content.strip()

    # Strategy 1: Direct JSON parse
    try:
        return json.loads(content, strict=False)
    except json.JSONDecodeError:
        pass

    # Strategy 2: Extract JSON from markdown code blocks
    json_match = re.search(r'```json\s*(.*?)\s*```', content, re.DOTALL)
    if json_match:
        try:
            return json.loads(json_match.group(1), strict=False)
        except json.JSONDecodeError:
            pass

    # Also try without 'json' identifier
    json_match = re.search(r'```\s*(.*?)\s*```', content, re.DOTALL)
    if json_match:
        try:
            extracted = json_match.group(1).strip()
            if extracted.startswith(('{', '[')):
                return json.loads(extracted, strict=False)
        except json.JSONDecodeError:
            pass

    # Strategy 3: Extract JSON from curly braces (object) or square brackets (array)
    # Look for the outermost JSON structure
    brace_match = re.search(r'\{.*\}', content, re.DOTALL)
    if brace_match:
        try:
            return json.loads(brace_match.group(0), strict=False)
        except json.JSONDecodeError:
            pass

    bracket_match = re.search(r'\[.*\]', content, re.DOTALL)
    if bracket_match:
        try:
            return json.loads(bracket_match.group(0), strict=False)
        except json.JSONDecodeError:
            pass

    # Strategy 4: Fix common JSON errors
    cleaned = content

    # Remove trailing commas (common in LLM output)
    cleaned = re.sub(r',\s*([}\]])', r'\1', cleaned)

    # Fix unquoted keys (common mistake)
    cleaned = re.sub(r'([{,]\s*)([a-zA-Z_][a-zA-Z0-9_]*)(\s*:)', r'\1"\2"\3', cleaned)

    # Fix single quotes (should be double quotes)
    cleaned = re.sub(r"'([^']*)'", r'"\1"', cleaned)

    try:
        return json.loads(cleaned, strict=False)
    except json.JSONDecodeError:
        pass

    # All strategies failed
    logger.warning(
        "Failed to parse JSON from LLM output after all strategies",
        extra={
            "content_length": len(content),
            "content_preview": content[:200]
        }
    )
    return default or {}


def safe_json_parse_with_answer(content: str, fallback_answer: str = "") -> Dict[str, Any]:
    """
    Parse JSON with fallback to wrap plain text answers.

    This is useful when the LLM returns plain text instead of JSON.
    The plain text will be wrapped in an "answer" field.

    Args:
        content: Raw LLM response content
        fallback_answer: Fallback answer if parsing fails

    Returns:
        Parsed dict with at least an "answer" field

    Examples:
        >>> safe_json_parse_with_answer('Just a plain text response')
        {'answer': 'Just a plain text response'}

        >>> safe_json_parse_with_answer('{"answer": "hello", "tasks": []}')
        {'answer': 'hello', 'tasks': []}
    """
    result = safe_json_parse(content)
    if not result or "answer" not in result:
        # Content looks like JSON but failed to parse, or is plain text
        if fallback_answer:
            return {"answer": fallback_answer}
        return {"answer": content}
    return result


def extract_json_from_markdown(content: str) -> str | None:
    """
    Extract JSON content from markdown code blocks.

    Args:
        content: Content that may contain markdown-enclosed JSON

    Returns:
        Extracted JSON string or None if not found

    Examples:
        >>> extract_json_from_markdown('Some text ```json {"key": "value"}```')
        '{"key": "value"}'
    """
    # Try with json identifier
    match = re.search(r'```json\s*(.*?)\s*```', content, re.DOTALL)
    if match:
        return match.group(1).strip()

    # Try without identifier
    match = re.search(r'```\s*(.*?)\s*```', content, re.DOTALL)
    if match:
        extracted = match.group(1).strip()
        # Verify it looks like JSON
        if extracted.startswith(('{', '[')):
            return extracted

    return None


def is_likely_json(content: str) -> bool:
    """
    Check if content looks like it might be JSON.

    Args:
        content: Content to check

    Returns:
        True if content appears to be JSON-like
    """
    content = content.strip()
    return bool(content) and content[0] in ('{', '[')
