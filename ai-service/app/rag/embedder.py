"""Embedder — converts text into dense vector representations using all-MiniLM-L6-v2.

all-MiniLM-L6-v2 is an extremely lightweight English embedding model.
It produces 384-dimensional L2-normalized vectors optimised for cosine similarity.

First load downloads ~120 MB from HuggingFace (cached to ~/.cache/huggingface/).
Subsequent loads take <1 second to initialise from the local cache.
"""
import logging
from functools import lru_cache

from sentence_transformers import SentenceTransformer

logger = logging.getLogger(__name__)

# Default embedding model — produces 384-dim vectors
DEFAULT_MODEL = "all-MiniLM-L6-v2"


class Embedder:
    """Generates vector embeddings using a sentence-transformers model.

    Designed as a singleton — instantiate once at app startup and reuse.
    Thread-safe for concurrent inference.

    Usage:
        embedder = Embedder()                       # loads model (~5s from cache)
        vectors = embedder.embed(["text 1", "text 2"])  # list of float lists
        vector = embedder.embed_single("text")          # single float list
    """

    def __init__(self, model_name: str = DEFAULT_MODEL) -> None:
        logger.info(
            "Loading embedding model: %s (first run may take ~30s to download)...",
            model_name,
        )
        self.model = SentenceTransformer(model_name, backend="torch")
        self.dimension: int = (
            self.model.get_embedding_dimension()
            if hasattr(self.model, "get_embedding_dimension")
            else self.model.get_sentence_embedding_dimension()
        )
        self.model_name = model_name
        logger.info("Embedding model ready. Dimension: %d", self.dimension)

    def embed(self, texts: list[str]) -> list[list[float]]:
        """Embed a batch of texts.

        Args:
            texts: List of text strings to embed.

        Returns:
            List of float vectors, one per input text.
            Returns empty list for empty input.
        """
        if not texts:
            return []

        vectors = self.model.encode(
            texts,
            normalize_embeddings=True,   # L2 normalise → cosine sim = dot product
            show_progress_bar=len(texts) > 50,
            batch_size=32,
            convert_to_numpy=True,
        )
        return vectors.tolist()  # type: ignore[return-value]

    def embed_single(self, text: str) -> list[float]:
        """Embed a single text string. Convenience wrapper around embed()."""
        return self.embed([text])[0]

    def embed_query(self, query: str) -> list[float]:
        """Embed a search query. BGE-M3 can optionally use instruction prefixes.

        For now, uses the same encode path as documents.
        Phase 7 can add instruction prefix: "Represent this query for searching..."
        """
        return self.embed_single(query)


@lru_cache(maxsize=1)
def get_embedder() -> Embedder:
    """Return the cached singleton Embedder.

    Uses lru_cache so the model is loaded exactly once per process.
    Call get_embedder.cache_clear() in tests to reset.
    """
    return Embedder()
