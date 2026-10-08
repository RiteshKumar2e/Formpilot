"""Application templates: reuse a completed application for similar forms.

A form's "signature" is the set of concepts its labels ask for (full_name, skills, ...), plus the
normalized text of labels that aren't profile details ("why do you want to join us"). Two forms are
similar when their signatures overlap (Jaccard similarity), however the labels are worded.
"""

from __future__ import annotations

from dataclasses import dataclass

from sqlalchemy import select
from sqlalchemy.orm import Session

from ..models import ApplicationTemplate
from .mapping import classify_hybrid
from .profile import normalize

MATCH_THRESHOLD = 0.5


def signature(labels: list[str]) -> set[str]:
    out = set()
    for label in labels:
        key = classify_hybrid(label)[0]
        out.add(f"concept:{key}" if key else f"label:{normalize(label)}")
    return out


def jaccard(a: set[str], b: set[str]) -> float:
    return len(a & b) / len(a | b) if a and b else 0.0


@dataclass
class TemplateMatch:
    template: ApplicationTemplate
    score: float
    reusable: int  # answers in the template for fields that aren't profile details


def reusable_answers(template: ApplicationTemplate) -> list[dict]:
    """Template fields worth carrying over: values that the Master Profile doesn't already supply."""
    return [f for f in (template.data or {}).get("fields", []) if f.get("value") and not f.get("profileKey")]


def best_match(db: Session, user_id: str, labels: list[str]) -> TemplateMatch | None:
    sig = signature(labels)
    best: TemplateMatch | None = None
    for template in db.scalars(select(ApplicationTemplate).where(ApplicationTemplate.user_id == user_id)):
        template_labels = [f.get("label", "") for f in (template.data or {}).get("fields", [])]
        score = jaccard(sig, signature(template_labels))
        if score >= MATCH_THRESHOLD and (best is None or score > best.score):
            best = TemplateMatch(template, round(score, 2), len(reusable_answers(template)))
    return best
