import logging
from pathlib import Path
from functools import lru_cache

logger = logging.getLogger(__name__)


class PromptLoader:
    """Loads versioned prompt templates from .txt files with variable substitution.

    Prompts are stored as plain text files with {variable} placeholders.
    File naming convention: {name}_v{version}.txt (e.g., risk_detector_v1.0.txt)

    The loader caches templates in memory after the first read — file I/O
    happens at most once per prompt per process lifetime.

    Usage:
        loader = PromptLoader()

        # Load with defaults
        system_prompt = loader.load("risk_detector")

        # Load with variable substitution
        system_prompt = loader.load(
            "chat_assistant",
            user_name="Omar",
            user_role="Project Manager",
            space_name="Alpha Project",
            board_name="Sprint 4",
        )

        # Load a specific version
        system_prompt = loader.load("risk_detector", version="v2.0")

        # Find latest version
        latest = loader.get_latest_version("risk_detector")  # → "v1.0"
    """

    def __init__(self, prompts_dir: Path | None = None) -> None:
        self.prompts_dir = prompts_dir or Path(__file__).parent
        self._cache: dict[str, str] = {}

    def load(self, name: str, version: str = "v1.0", **kwargs: str) -> str:
        """Load a prompt template, fill in variables, and return the result.

        Unknown {variable} placeholders are left as-is (no error raised).
        This is intentional — some placeholders are filled at different
        call sites (e.g., {context} is filled just before the LLM call).

        Args:
            name: Prompt name without version suffix (e.g., "risk_detector")
            version: Version string (default: "v1.0")
            **kwargs: Variable name → value pairs to substitute

        Returns:
            The rendered prompt string.

        Raises:
            FileNotFoundError: If the prompt file does not exist.
        """
        key = f"{name}_{version}"

        if key not in self._cache:
            path = self.prompts_dir / f"{key}.txt"
            if not path.exists():
                raise FileNotFoundError(
                    f"Prompt template not found: {path}\n"
                    f"Available: {[f.name for f in self.prompts_dir.glob('*.txt')]}"
                )
            self._cache[key] = path.read_text(encoding="utf-8")
            logger.info("Loaded prompt template: %s", key)

        template = self._cache[key]

        # Substitute variables — leave unknown placeholders untouched
        for var_name, var_value in kwargs.items():
            template = template.replace(f"{{{var_name}}}", str(var_value))

        return template

    def get_latest_version(self, name: str) -> str:
        """Find the highest version string for a named prompt.

        Scans the prompts directory for files matching {name}_v*.txt and
        returns the version portion of the alphabetically last file.

        Returns "v1.0" if no files are found (safe default).
        """
        files = sorted(self.prompts_dir.glob(f"{name}_v*.txt"))
        if not files:
            return "v1.0"
        # File stem: "risk_detector_v1.2" → split on "_" → last part = "v1.2"
        return files[-1].stem.split("_")[-1]

    def clear_cache(self) -> None:
        """Clear the in-memory template cache.

        Call this after updating prompt files during development.
        """
        self._cache.clear()
        logger.info("Prompt cache cleared")

    def list_prompts(self) -> list[str]:
        """Return a list of all available prompt names (without version suffix)."""
        stems = {f.stem.rsplit("_v", 1)[0] for f in self.prompts_dir.glob("*_v*.txt")}
        return sorted(stems)


@lru_cache
def get_prompt_loader() -> PromptLoader:
    """Return a cached singleton PromptLoader for use as a FastAPI dependency."""
    return PromptLoader()
