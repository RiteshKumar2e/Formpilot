"""Maps free-text form field labels to profile concepts.

Two matchers run in order. The lexical matcher compares a label with known phrasings using token
overlap and character trigrams, which handles rewordings like "Name of applicant" -> full name. Labels
it can't place go to the semantic matcher, which compares sentence embeddings, so "Technical
proficiencies" or "Year in which you passed" still find the right concept. The semantic matcher only answers when one
concept is clearly closer than the rest.
"""

import re
from functools import lru_cache

import numpy as np

from .embeddings import HashEmbedder, get_embedder
from .fields import CONCEPTS

MIN_SCORE = 0.45
_STOPWORDS = {"the", "a", "an", "your", "you", "please", "enter", "provide", "of", "applicant's", "s", "current", "full"}
# Semantic matching: minimum cosine similarity, and how far ahead of the runner-up concept it must be.
# Tuned on eval/form_labels.json for few wrong fills over maximum coverage (see eval/run_eval.py).
SEMANTIC_MIN = 0.76
SEMANTIC_MARGIN = 0.02


def _tokens(text: str) -> set[str]:
    return {t for t in re.findall(r"[a-z0-9]+", text.lower()) if t not in _STOPWORDS}


def _trigrams(text: str) -> set[str]:
    s = f"  {re.sub(r'[^a-z0-9]+', ' ', text.lower()).strip()} "
    return {s[i : i + 3] for i in range(len(s) - 2)}


def similarity(a: str, b: str) -> float:
    if a.strip().lower() == b.strip().lower():
        return 1.0
    ta, tb = _tokens(a), _tokens(b)
    token_score = len(ta & tb) / len(ta | tb) if ta and tb else 0.0
    ga, gb = _trigrams(a), _trigrams(b)
    trigram_score = 2 * len(ga & gb) / (len(ga) + len(gb)) if ga and gb else 0.0
    return 0.6 * token_score + 0.4 * trigram_score


def classify(label: str) -> tuple[str | None, float]:
    best_key, best_score = None, 0.0
    for key, phrasings in CONCEPTS.items():
        for phrase in phrasings:
            score = similarity(label, phrase)
            if score > best_score:
                best_key, best_score = key, score
    return (best_key, best_score) if best_score >= MIN_SCORE else (None, best_score)


@lru_cache(maxsize=4)
def _concept_vectors(embedder_name: str) -> tuple[list[str], np.ndarray]:
    keys = [key for key, phrasings in CONCEPTS.items() for _ in phrasings]
    phrases = [phrase for phrasings in CONCEPTS.values() for phrase in phrasings]
    return keys, get_embedder().embed(phrases)


def semantic_classify(label: str) -> tuple[str | None, float]:
    embedder = get_embedder()
    if isinstance(embedder, HashEmbedder):
        return None, 0.0  # hashing only captures spelling, which the lexical matcher already covers
    keys, vectors = _concept_vectors(embedder.name)
    scores = vectors @ embedder.embed([label])[0]
    best: dict[str, float] = {}
    for key, score in zip(keys, scores):
        best[key] = max(best.get(key, -1.0), float(score))
    ranked = sorted(best.items(), key=lambda kv: kv[1], reverse=True)
    (top_key, top), (_, second) = ranked[0], ranked[1]
    if top >= SEMANTIC_MIN and top - second >= SEMANTIC_MARGIN:
        return top_key, top
    return None, top


def classify_hybrid(label: str) -> tuple[str | None, float, str]:
    """Returns (concept key, score, matcher) where matcher is "lexical" or "semantic"."""
    key, score = classify(label)
    if key:
        return key, score, "lexical"
    key, sem = semantic_classify(label)
    if key:
        return key, sem, "semantic"
    return None, score, "lexical"
