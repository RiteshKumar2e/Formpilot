"""Text embeddings for semantic search.

The default provider runs BAAI/bge-small-en-v1.5 locally through fastembed (ONNX, no GPU or API key).
If that model can't be loaded, a deterministic feature-hashing embedder takes over so retrieval keeps
working; it captures spelling overlap rather than meaning.
"""

from __future__ import annotations

import hashlib
import logging
import re
import threading
from functools import lru_cache
from typing import Protocol

import numpy as np

from ..config import get_settings
from ..db_types import EMBEDDING_DIM

log = logging.getLogger(__name__)


class Embedder(Protocol):
    name: str

    def embed(self, texts: list[str]) -> np.ndarray:
        """Returns one L2-normalized row per text, shape (len(texts), EMBEDDING_DIM)."""
        ...


def _normalize(matrix: np.ndarray) -> np.ndarray:
    norms = np.linalg.norm(matrix, axis=1, keepdims=True)
    norms[norms == 0] = 1.0
    return (matrix / norms).astype(np.float32)


class HashEmbedder:
    """Feature hashing over word unigrams and character trigrams."""

    name = "hash-v1"

    def embed(self, texts: list[str]) -> np.ndarray:
        out = np.zeros((len(texts), EMBEDDING_DIM), dtype=np.float32)
        for row, text in enumerate(texts):
            clean = re.sub(r"[^a-z0-9]+", " ", text.lower()).strip()
            padded = f"  {clean} "
            features = clean.split() + [padded[i : i + 3] for i in range(len(padded) - 2)]
            for feature in features:
                digest = hashlib.blake2b(feature.encode(), digest_size=8).digest()
                index = int.from_bytes(digest[:4], "little") % EMBEDDING_DIM
                sign = 1.0 if digest[4] & 1 else -1.0
                out[row, index] += sign * (2.0 if " " not in feature and len(feature) > 3 else 1.0)
        return _normalize(out)


class FastEmbedder:
    def __init__(self, model_name: str):
        from fastembed import TextEmbedding

        self._model = TextEmbedding(model_name)
        self._lock = threading.Lock()  # ONNX sessions are shared; keep calls serialized
        self.name = f"fastembed:{model_name}"

    def embed(self, texts: list[str]) -> np.ndarray:
        if not texts:
            return np.zeros((0, EMBEDDING_DIM), dtype=np.float32)
        with self._lock:
            vectors = np.array(list(self._model.embed(texts)), dtype=np.float32)
        if vectors.shape[1] != EMBEDDING_DIM:
            raise ValueError(f"Embedding model returns {vectors.shape[1]} dimensions; FormPilot expects {EMBEDDING_DIM}.")
        return _normalize(vectors)


@lru_cache
def get_embedder() -> Embedder:
    settings = get_settings()
    if settings.embedding_provider == "fastembed":
        try:
            return FastEmbedder(settings.embedding_model)
        except Exception as exc:  # missing package, offline first run, incompatible model
            log.warning("Falling back to hash embeddings: %s", exc)
    return HashEmbedder()
