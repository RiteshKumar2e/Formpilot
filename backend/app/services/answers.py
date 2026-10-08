"""Smart Answers: suggested responses to open questions ("Why do you want to join us?").

Context is retrieved from the Master Profile, passages of the user's documents (vector search) and
their saved Common Answers. With an LLM the answer is drafted from that context; without one, a saved
answer to a similar question is offered, or a short draft is assembled from profile facts. Every
suggestion lists its sources and is only used once the user accepts it.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field

from sqlalchemy import select
from sqlalchemy.orm import Session

from ..config import get_settings
from ..models import SavedAnswer, User
from .embeddings import HashEmbedder, get_embedder
from .llm import answer_with_llm, llm_available
from .mapping import classify_hybrid, similarity
from .profile import build_profile
from .vectorstore import search

OPEN_QUESTION_RE = re.compile(
    r"^(why|what|how|describe|tell|explain|share|briefly|in\s+\d+\s+words|give\s+an\s+example)\b|\?\s*$|"
    r"\b(statement of purpose|cover letter|motivation|about yourself|why (?:do|are|should)|interest(?:ed)? in)\b",
    re.I,
)
PROFILE_CONTEXT_KEYS = ("experience", "projects", "skills", "achievements", "highest_qualification", "institution", "certifications")
SIMILAR_LEXICAL = 0.6
SIMILAR_SEMANTIC = 0.82


def is_open_question(label: str, field_type: str | None = None) -> bool:
    """True for questions that need a written answer rather than a profile detail."""
    if field_type == "textarea" and classify_hybrid(label)[0] is None:
        return True
    return bool(OPEN_QUESTION_RE.search(label.strip())) and classify_hybrid(label)[0] is None


@dataclass
class SourceRef:
    type: str  # "profile" | "document" | "saved_answer"
    label: str
    detail: str | None = None


@dataclass
class Suggestion:
    answer: str
    method: str  # "llm_rag" | "saved_answer" | "profile_draft" | "none"
    sources: list[SourceRef] = field(default_factory=list)


def similar_saved_answer(db: Session, user_id: str, question: str) -> tuple[SavedAnswer, float] | None:
    saved = list(db.scalars(select(SavedAnswer).where(SavedAnswer.user_id == user_id)))
    if not saved:
        return None
    embedder = get_embedder()
    scores = [similarity(question, s.question) for s in saved]
    threshold = SIMILAR_LEXICAL
    if not isinstance(embedder, HashEmbedder):
        vectors = embedder.embed([question] + [s.question for s in saved])
        semantic = vectors[1:] @ vectors[0]
        # Each question passes on either measure; semantic scores sit on a higher scale.
        scores = [max(lex / SIMILAR_LEXICAL, float(sem) / SIMILAR_SEMANTIC) for lex, sem in zip(scores, semantic)]
        threshold = 1.0
    best = max(range(len(saved)), key=lambda i: scores[i])
    return (saved[best], scores[best]) if scores[best] >= threshold else None


def _profile_draft(question: str, facts: dict[str, str], organization: str | None, role: str | None) -> str | None:
    experience, skills, projects = facts.get("experience"), facts.get("skills"), facts.get("projects")
    degree, school = facts.get("highest_qualification"), facts.get("institution")
    if not (experience or skills or projects or degree):
        return None
    target = " ".join(x for x in (f"the {role} role" if role else "this role", f"at {organization}" if organization else "") if x)
    parts = []
    if re.search(r"\bwhy\b|interest|join|motivat", question, re.I):
        parts.append(f"I am interested in {target} because it builds directly on what I have been doing.")
    if experience:
        parts.append(f"Most recently I worked as {experience}.")
    if degree:
        parts.append(f"I hold a {degree}{f' from {school}' if school else ''}.")
    if projects:
        parts.append(f"One project I am proud of is {projects.split(';')[0].strip()}.")
    if skills:
        top = ", ".join(s.strip() for s in skills.split(",")[:4])
        parts.append(f"I work mainly with {top}, and I would like to apply these skills{f' at {organization}' if organization else ''}.")
    return " ".join(parts)


def suggest_answer(
    db: Session, user: User, question: str, organization: str | None = None, role: str | None = None, max_words: int = 150
) -> Suggestion:
    profile = build_profile(db, user)
    facts = {f.key: f.value for f in profile.fields}
    by_key = {f.key: f for f in profile.fields}
    saved = similar_saved_answer(db, user.id, question)

    if llm_available():
        context: list[dict] = []
        refs: dict[str, SourceRef] = {}
        for key in PROFILE_CONTEXT_KEYS:
            if key in by_key:
                cid = f"profile:{key}"
                context.append({"id": cid, "type": "profile", "label": by_key[key].label, "text": by_key[key].value})
                refs[cid] = SourceRef("profile", by_key[key].label, by_key[key].value[:120])
        for i, passage in enumerate(search(db, user.id, [question], get_settings().rag_top_k)[0]):
            cid = f"document:{i}"
            context.append({"id": cid, "type": "document", "label": passage.source_filename, "text": passage.text})
            refs[cid] = SourceRef("document", passage.source_filename, passage.text[:120])
        if saved:
            cid = "saved_answer"
            context.append({"id": cid, "type": "saved_answer", "label": saved[0].question, "text": saved[0].answer})
            refs[cid] = SourceRef("saved_answer", saved[0].question)
        result = answer_with_llm(question, context, organization, role, max_words)
        if result:
            answer, used = result
            return Suggestion(answer, "llm_rag", [refs[u] for u in used] or list(refs.values())[:3])

    if saved:
        saved[0].use_count += 1
        db.commit()
        return Suggestion(saved[0].answer, "saved_answer", [SourceRef("saved_answer", saved[0].question)])

    draft = _profile_draft(question, facts, organization, role)
    if draft:
        used = [k for k in ("experience", "highest_qualification", "projects", "skills") if k in by_key]
        return Suggestion(draft, "profile_draft", [SourceRef("profile", by_key[k].label, by_key[k].value[:120]) for k in used])
    return Suggestion("", "none", [])
