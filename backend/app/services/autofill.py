"""Suggestions for a form on an external website: the API behind the FormPilot browser extension.

The extension detects the page's fields and sends their labels and input types. Each field gets one of:
  value     a profile detail, mapped with RAG (see rag.py)
  answer    a Smart Answer for an open question; always needs the user's approval
  document  a file from the vault for upload fields (e.g. the resume)
and a status: "ready" (confident, safe to fill when the user clicks Fill), "needs_review" (uncertain,
conflicting or AI-written: never filled without the user choosing it) or "missing". Nothing here
submits anything; filling and submitting stay with the user.
"""

from __future__ import annotations

import re

from sqlalchemy import select
from sqlalchemy.orm import Session

from ..models import Document, User
from ..schemas import AutofillFieldIn, AutofillSuggestionOut, AutofillSummaryOut, SmartAnswerSourceOut, TemplateMatchOut
from .answers import is_open_question, suggest_answer
from .profile import build_profile, normalize
from .rag import map_fields
from .templates import best_match, reusable_answers
from .workflow import WorkflowRunner

READY_CONFIDENCE = 0.8
_RESUME_RE = re.compile(r"resume|cv|curriculum", re.I)


def _resume(db: Session, user: User) -> Document | None:
    docs = list(db.scalars(select(Document).where(Document.user_id == user.id, Document.status != "failed").order_by(Document.created_at.desc())))
    return next((d for d in docs if _RESUME_RE.search(d.filename)), None)


def suggest(
    db: Session, user: User, fields: list[AutofillFieldIn], page_title: str | None = None, organization: str | None = None, role: str | None = None
) -> tuple[list[AutofillSuggestionOut], AutofillSummaryOut, TemplateMatchOut | None, str]:
    run = WorkflowRunner(db, user.id, "external_autofill", subject_id=None)
    out: dict[str, AutofillSuggestionOut] = {}

    with run.step("detect") as step:
        uploads = [f for f in fields if f.type == "file"]
        questions = [f for f in fields if f.type != "file" and is_open_question(f.label, f.type)]
        details = [f for f in fields if f not in uploads and f not in questions]
        step.detail = f"{len(fields)} field(s) on {page_title or 'the page'}: {len(details)} details, {len(questions)} questions, {len(uploads)} uploads"

    with run.step("map_details") as step:
        profile = {f.key: f for f in build_profile(db, user).fields}
        matches, _ = map_fields(db, user, [f.label for f in details]) if details else ([], None)
        for f, m in zip(details, matches):
            verified = bool(m.key and m.key in profile and profile[m.key].verified)
            if m.needs_review:
                status, reasoning = "needs_review", "Your documents disagree on this value. Choose one in FormPilot first."
            elif m.value is None:
                status, reasoning = "missing", m.reasoning or "Nothing in your profile answers this field."
            else:
                status = "ready" if m.confidence >= READY_CONFIDENCE else "needs_review"
                reasoning = m.reasoning or f"Matched to your {(m.key or 'details').replace('_', ' ')}."
            out[f.id] = AutofillSuggestionOut(
                id=f.id, label=f.label, kind="value", status=status, value=m.value, source=m.source_filename,
                confidence=m.confidence, verified=verified and status == "ready", reasoning=reasoning, method=m.method,
            )
        step.detail = f"{sum(1 for f in details if out[f.id].status == 'ready')} of {len(details)} ready"

    with run.step("smart_answers") as step:
        for f in questions:
            s = suggest_answer(db, user, f.label, organization=organization, role=role)
            out[f.id] = AutofillSuggestionOut(
                id=f.id, label=f.label, kind="answer", status="needs_review" if s.answer else "missing",
                value=s.answer or None, source="Smart Answer" if s.answer else None, confidence=0.0, verified=False,
                reasoning="A suggested answer. Read and edit it before using it." if s.answer else "Write this answer yourself.",
                method=s.method, sources=[SmartAnswerSourceOut(type=r.type, label=r.label, detail=r.detail) for r in s.sources],
            )
        step.detail = f"{len(questions)} answer(s) suggested" if questions else "No open questions"

    with run.step("documents") as step:
        resume = _resume(db, user) if uploads else None
        for f in uploads:
            wants_resume = bool(_RESUME_RE.search(f.label)) or len(uploads) == 1
            if resume and wants_resume:
                out[f.id] = AutofillSuggestionOut(
                    id=f.id, label=f.label, kind="document", status="ready", value=resume.filename, source="Your vault",
                    confidence=1.0, verified=resume.status == "processed", reasoning="Your resume from the vault.", document_id=resume.id,
                )
            else:
                out[f.id] = AutofillSuggestionOut(
                    id=f.id, label=f.label, kind="document", status="missing", value=None, source=None, confidence=0.0,
                    verified=False, reasoning="Choose the file to attach.",
                )
        step.detail = f"Attached {resume.filename}" if uploads and resume else ("No upload fields" if not uploads else "No resume in the vault")

    template_out = None
    with run.step("template") as step:
        match = best_match(db, user.id, [f.label for f in fields])
        if match:
            template_out = TemplateMatchOut(id=match.template.id, name=match.template.name, score=match.score, reusable=match.reusable)
            answers = {normalize(a.get("label", "")): a for a in reusable_answers(match.template)}
            filled = 0
            for f in fields:
                saved = answers.get(normalize(f.label))
                if saved and out[f.id].status == "missing":
                    out[f.id] = out[f.id].model_copy(
                        update={
                            "status": "needs_review", "value": saved["value"], "source": f"Template: {match.template.name}",
                            "reasoning": "Reused from your template. Check it fits this application.", "method": "template",
                        }
                    )
                    filled += 1
            step.detail = f"Matched “{match.template.name}” ({match.score:.0%}); {filled} field(s) filled from it"
        else:
            step.detail = "No similar template"

    run.finish()
    db.commit()
    suggestions = [out[f.id] for f in fields]
    ready = [s for s in suggestions if s.status == "ready"]
    summary = AutofillSummaryOut(
        detected=len(suggestions),
        ready=len(ready),
        needs_review=sum(1 for s in suggestions if s.status == "needs_review"),
        missing=sum(1 for s in suggestions if s.status == "missing"),
        verified=sum(1 for s in ready if s.verified),
        confidence=round(sum(s.confidence for s in ready) / len(ready), 2) if ready else 0.0,
    )
    return suggestions, summary, template_out, run.run.id
