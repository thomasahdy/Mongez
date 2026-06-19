"""Tests for the prompt loader (no network calls needed)."""
import pytest
from pathlib import Path
from app.prompts.loader import PromptLoader


PROMPTS_DIR = Path(__file__).parent.parent / "app" / "prompts"


@pytest.fixture
def loader():
    return PromptLoader(prompts_dir=PROMPTS_DIR)


def test_load_risk_detector(loader: PromptLoader):
    """PromptLoader should load risk_detector_v1.0 without errors."""
    prompt = loader.load("risk_detector")
    assert len(prompt) > 50
    assert "risk" in prompt.lower()


def test_load_chat_assistant_with_substitution(loader: PromptLoader):
    """PromptLoader should substitute {user_name} and {user_role}."""
    prompt = loader.load(
        "chat_assistant",
        user_name="Omar",
        user_role="Project Manager",
        space_name="Alpha Project",
        board_name="Sprint 4",
    )
    assert "Omar" in prompt
    assert "Project Manager" in prompt
    assert "Alpha Project" in prompt
    assert "Sprint 4" in prompt
    # Placeholders should be replaced
    assert "{user_name}" not in prompt
    assert "{user_role}" not in prompt


def test_load_report_generator(loader: PromptLoader):
    """PromptLoader should load report_generator_v1.0."""
    prompt = loader.load("report_generator")
    assert "Executive Summary" in prompt


def test_load_query_rewriter_leaves_unfilled_placeholders(loader: PromptLoader):
    """Unfilled placeholders (like {last_3_messages}) should remain as-is."""
    prompt = loader.load("query_rewriter", user_input="What is its status?")
    assert "{last_3_messages}" in prompt  # not filled
    assert "{user_input}" not in prompt    # was filled


def test_get_latest_version(loader: PromptLoader):
    """get_latest_version should return v1.0 for existing prompts."""
    assert loader.get_latest_version("risk_detector") == "v1.0"
    assert loader.get_latest_version("chat_assistant") == "v1.0"


def test_missing_prompt_raises(loader: PromptLoader):
    """Loading a non-existent prompt should raise FileNotFoundError."""
    with pytest.raises(FileNotFoundError):
        loader.load("nonexistent_prompt")


def test_list_prompts(loader: PromptLoader):
    """list_prompts should return all 4 prompt names."""
    prompts = loader.list_prompts()
    assert "risk_detector" in prompts
    assert "chat_assistant" in prompts
    assert "report_generator" in prompts
    assert "query_rewriter" in prompts


def test_cache_works(loader: PromptLoader):
    """Loading the same prompt twice should use the cache (no file re-read)."""
    loader.load("risk_detector")
    cached_keys_before = set(loader._cache.keys())
    loader.load("risk_detector")
    assert loader._cache.keys() == cached_keys_before  # same set, no new reads


def test_clear_cache(loader: PromptLoader):
    """clear_cache should empty the cache dict."""
    loader.load("risk_detector")
    assert len(loader._cache) > 0
    loader.clear_cache()
    assert len(loader._cache) == 0
