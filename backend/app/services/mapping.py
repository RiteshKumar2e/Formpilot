"""Maps free-text form field labels to profile fields.

The baseline matcher compares a label against known phrasings using token overlap and character
trigrams, which handles rewordings like "Name of applicant" -> full name without any model. An
embeddings provider (sentence-transformers, OpenAI, etc.) can be plugged in via `Embedder` to match
labels the phrasing table doesn't cover; the vector index then lives in the vector database.
"""

import re
from typing import Protocol

from ..schemas import FieldMatchOut, ProfileOut
from .fields import CONCEPTS

MIN_SCORE = 0.45
_STOPWORDS = {"the", "a", "an", "your", "you", "please", "enter", "provide", "of", "applicant's", "s", "current", "full"}


class Embedder(Protocol):
    def embed(self, texts: list[str]) -> list[list[float]]: ...


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


def match_fields(labels: list[str], profile: ProfileOut) -> list[FieldMatchOut]:
    by_key = {f.key: f for f in profile.fields}
    conflicted = {c.key for c in profile.conflicts}
    matches = []
    for label in labels:
        key, score = classify(label)
        field = by_key.get(key) if key else None
        if field is None:
            matches.append(
                FieldMatchOut(
                    form_label=label, key=key, value=None, confidence=0.0, source_filename=None, needs_review=key in conflicted
                )
            )
            continue
        matches.append(
            FieldMatchOut(
                form_label=label,
                key=key,
                value=field.value,
                confidence=round(min(1.0, score) * field.confidence, 2),
                source_filename=field.source_filename,
            )
        )
    return matches
