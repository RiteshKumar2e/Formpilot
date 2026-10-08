"""Suggestions for a form on any website: the API behind the FormPilot browser extension.

The extension sends metadata for each field it found (label, name/id, placeholder, autocomplete hint,
section heading, type and options), never the page itself. Each field gets a kind:
  value     a profile detail, mapped with RAG (see rag.py)
  choice    a dropdown or radio group: the option that means the same as the profile value
  answer    a Smart Answer for an open question; always needs the user's approval
  document  a vault file for an upload field; attached only when the user chooses it
  consent   a declaration checkbox; always ticked by the user
and a status: "ready" (confident, filled when the user clicks Autofill), "needs_review" (uncertain,
conflicting, sensitive or AI-written: filled only when the user chooses it) or "missing".
Nothing here submits anything; filling and submitting stay with the user.
"""

from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session

from ..models import Document, User
from ..schemas import (
    AutofillAlternativeOut,
    AutofillDocumentOut,
    AutofillFieldIn,
    AutofillProfileValueOut,
    AutofillSuggestionOut,
    AutofillSummaryOut,
    FieldMatchOut,
    ProfileFieldOut,
    SmartAnswerSourceOut,
    TemplateMatchOut,
)
from .answers import is_open_question, similar_saved_answer, suggest_answer
from .form_semantics import AUTOCOMPLETE_KEYS, choose_option, humanize, is_consent, is_sensitive, iso_date, suggest_document
from .mapping import OTHER_ENTITY_RE, classify_hybrid
from .profile import build_profile, normalize
from .rag import map_fields
from .templates import best_match, reusable_answers
from .workflow import WorkflowRunner

READY_CONFIDENCE = 0.8  # filled by Autofill
REVIEW_CONFIDENCE = 0.5  # shown as a possible match; below this nothing is suggested


def tier(confidence: float) -> str:
    """99% safe match · 85% review recommended · 60% needs review · below 50% not filled."""
    if confidence >= 0.9:
        return "safe"
    if confidence >= 0.75:
        return "review"
    if confidence >= REVIEW_CONFIDENCE:
        return "uncertain"
    return "none"


def display_label(f: AutofillFieldIn) -> str:
    for text in (f.label, f.aria_label, f.placeholder, humanize(f.name), humanize(f.html_id)):
        if text and text.strip():
            return text.strip()[:300]
    return "Field"


def classification_text(f: AutofillFieldIn) -> str:
    """The wording that best says what a field asks for.

    A bare "Name" under the heading "Emergency contact" is someone else's name, so the heading is
    prepended when it names another person. Otherwise the most recognisable of the label, aria-label,
    placeholder and name/id is used.
    """
    label = display_label(f)
    if f.section and OTHER_ENTITY_RE.search(f.section) and not OTHER_ENTITY_RE.search(label):
        return f"{f.section.strip()} {label}"[:300]
    best, best_score = label, -1.0
    for text in dict.fromkeys(t for t in (f.label, f.aria_label, f.placeholder, humanize(f.name), humanize(f.html_id)) if t and t.strip()):
        key, score, _ = classify_hybrid(text)
        if key and score > best_score:
            best, best_score = text.strip(), score
    return best


def _autocomplete_key(f: AutofillFieldIn) -> str | None:
    # "section-x shipping email" -> "email"
    tokens = (f.autocomplete or "").lower().split()
    return AUTOCOMPLETE_KEYS.get(tokens[-1]) if tokens else None


def _profile_value(key: str | None, profile: dict[str, ProfileFieldOut]) -> tuple[str, float, str] | None:
    """(value, confidence, source) for a profile key, including names derived from the full name."""
    if not key:
        return None
    if key in profile:
        f = profile[key]
        return f.value, f.confidence, f.source_filename
    full = profile.get("full_name")
    if key in ("first_name", "last_name") and full and len(full.value.split()) >= 2:
        parts = full.value.split()
        value = parts[0] if key == "first_name" else " ".join(parts[1:])
        return value, round(full.confidence * 0.97, 2), full.source_filename
    return None


def _detail(
    f: AutofillFieldIn, m: FieldMatchOut, profile: dict[str, ProfileFieldOut], conflicts: dict
) -> AutofillSuggestionOut:
    label = display_label(f)
    key, value, confidence, source, method = m.key, m.value, m.confidence, m.source_filename, m.method
    reasoning = m.reasoning or ""

    hinted = _autocomplete_key(f)
    if hinted and (hit := _profile_value(hinted, profile)):
        # The site declared what the field is, so the wording doesn't need to be interpreted.
        key, (value, base, source), method = hinted, hit, "autocomplete"
        confidence = round(base * 0.99, 2)
        reasoning = "The website marks this field as your " + hinted.replace("_", " ") + "."
    elif key and value is None and (hit := _profile_value(key, profile)):
        value, base, source = hit
        confidence = round(base * 0.97, 2)

    kind = "choice" if f.type in ("select", "radio") else "value"
    option = None
    alternatives: list[AutofillAlternativeOut] = []

    if key in conflicts:
        alternatives = [AutofillAlternativeOut(value=v.value, source=v.source_filename) for v in conflicts[key].values]
        return AutofillSuggestionOut(
            id=f.id, label=label, key=key, kind=kind, status="needs_review", value=None, source=None, confidence=0.0,
            tier="uncertain", verified=False, sensitive=is_sensitive(label, key), method=method,
            reasoning="Your documents disagree on this value. Choose one.", alternatives=alternatives,
        )

    if value is not None and kind == "choice":
        chosen = choose_option(value, f.options)
        if chosen:
            option, option_score = chosen
            if normalize(option) != normalize(value):
                reasoning = f"“{option}” is the option that means {value}."
            confidence = round(confidence * option_score, 2)
            value = option
        else:
            return AutofillSuggestionOut(
                id=f.id, label=label, key=key, kind=kind, status="needs_review", value=None, source=source,
                confidence=0.0, tier="uncertain", verified=False, sensitive=is_sensitive(label, key), method=method,
                reasoning=f"None of the options matches your {(key or 'answer').replace('_', ' ')} ({value}). Pick one yourself.",
            )

    if value is None:
        status = "missing"
        reasoning = "This information isn’t in your profile."
    elif confidence >= READY_CONFIDENCE:
        status = "ready"
    elif confidence >= REVIEW_CONFIDENCE:
        status = "needs_review"
        reasoning = reasoning or "Possible match. Check it before using it."
    else:
        status, value, option = "missing", None, None
        reasoning = "No confident match in your profile."
    if status != "missing" and not reasoning:
        reasoning = f"Matched to your {(key or 'details').replace('_', ' ')}."

    verified = bool(status == "ready" and key in profile and profile[key].verified)
    return AutofillSuggestionOut(
        id=f.id, label=label, key=key, kind=kind, status=status, value=value, source=source if value else None,
        confidence=confidence if value else 0.0, tier=tier(confidence) if value else "none", verified=verified,
        sensitive=is_sensitive(label, key), method=method, reasoning=reasoning, option=option,
        value_iso=iso_date(value) if key == "date_of_birth" and value else None,
    )


def suggest(
    db: Session,
    user: User,
    fields: list[AutofillFieldIn],
    page_title: str | None = None,
    organization: str | None = None,
    role: str | None = None,
) -> tuple[list[AutofillSuggestionOut], AutofillSummaryOut, TemplateMatchOut | None, str, list[AutofillDocumentOut], list[AutofillProfileValueOut]]:
    run = WorkflowRunner(db, user.id, "external_autofill", subject_id=None)
    out: dict[str, AutofillSuggestionOut] = {}
    built = build_profile(db, user)
    profile = {f.key: f for f in built.fields}
    conflicts = {c.key: c for c in built.conflicts}
    documents = [
        AutofillDocumentOut(id=d.id, filename=d.filename)
        for d in db.scalars(select(Document).where(Document.user_id == user.id, Document.status != "failed").order_by(Document.created_at.desc()))
    ]

    with run.step("detect") as step:
        uploads = [f for f in fields if f.type == "file"]
        checkboxes = [f for f in fields if f.type == "checkbox"]
        rest = [f for f in fields if f.type not in ("file", "checkbox")]
        questions = [f for f in rest if f.type != "select" and is_open_question(display_label(f), f.type)]
        details = [f for f in rest if f not in questions]
        step.detail = (
            f"{len(fields)} field(s) on {page_title or 'the page'}: {len(details)} details, {len(questions)} questions, "
            f"{len(uploads)} uploads, {len(checkboxes)} checkboxes"
        )

    with run.step("map_details") as step:
        matches, _ = map_fields(db, user, [classification_text(f) for f in details]) if details else ([], None)
        for f, m in zip(details, matches):
            out[f.id] = _detail(f, m, profile, conflicts)
        step.detail = f"{sum(1 for f in details if out[f.id].status == 'ready')} of {len(details)} ready"

    with run.step("smart_answers") as step:
        for f in questions:
            label = display_label(f)
            s = suggest_answer(db, user, label, organization=organization, role=role)
            out[f.id] = AutofillSuggestionOut(
                id=f.id, label=label, kind="answer", status="needs_review" if s.answer else "missing",
                value=s.answer or None, source="Smart Answer" if s.answer else None, confidence=0.0,
                tier="review" if s.answer else "none", verified=False, sensitive=False,
                reasoning="A suggested answer. Read and edit it before using it." if s.answer else "Write this answer yourself.",
                method=s.method, sources=[SmartAnswerSourceOut(type=r.type, label=r.label, detail=r.detail) for r in s.sources],
            )
        step.detail = f"{len(questions)} answer(s) suggested" if questions else "No open questions"

    with run.step("documents") as step:
        names = [d.filename for d in documents]
        for f in uploads:
            label = display_label(f)
            wanted = suggest_document(label, names)
            doc = next((d for d in documents if d.filename == wanted), None)
            # Uploading a file is always the user's explicit choice, so even a good match needs review.
            out[f.id] = AutofillSuggestionOut(
                id=f.id, label=label, kind="document", status="needs_review" if doc else "missing",
                value=doc.filename if doc else None, source="Your vault" if doc else None, confidence=0.9 if doc else 0.0,
                tier="review" if doc else "none", verified=False, sensitive=True,
                reasoning="Choose the file to attach. FormPilot never uploads without your click."
                if doc else "Choose a file from your vault, or upload one on the page.",
                document_id=doc.id if doc else None,
            )
        for f in checkboxes:
            label = display_label(f)
            out[f.id] = AutofillSuggestionOut(
                id=f.id, label=label, kind="consent" if is_consent(label) else "value", status="missing", value=None,
                source=None, confidence=0.0, tier="none", verified=False, sensitive=False,
                reasoning="Tick this yourself if it applies." if is_consent(label) else "FormPilot doesn’t tick checkboxes for you.",
            )
        step.detail = f"{len(uploads)} upload(s), {len(checkboxes)} checkbox(es) left to you"

    with run.step("saved_answers") as step:
        reused = 0
        for f in details:
            s = out[f.id]
            if s.status != "missing" or s.key in conflicts:
                continue
            hit = similar_saved_answer(db, user.id, s.label)
            if not hit:
                continue
            answer = hit[0].answer
            if s.kind == "choice":
                chosen = choose_option(answer, f.options)
                if not chosen:
                    continue
                answer = chosen[0]
            out[f.id] = s.model_copy(
                update={
                    "status": "needs_review", "value": answer, "source": "Saved answer", "confidence": 0.7, "tier": "uncertain",
                    "method": "saved_answer", "sensitive": is_sensitive(s.label, None),
                    "reasoning": f"From your saved answer to “{hit[0].question}”.",
                }
            )
            reused += 1
        step.detail = f"{reused} field(s) answered from your saved answers"

    template_out = None
    with run.step("template") as step:
        match = best_match(db, user.id, [display_label(f) for f in fields])
        if match:
            template_out = TemplateMatchOut(id=match.template.id, name=match.template.name, score=match.score, reusable=match.reusable)
            answers = {normalize(a.get("label", "")): a for a in reusable_answers(match.template)}
            filled = 0
            for f in fields:
                saved = answers.get(normalize(display_label(f)))
                if saved and out[f.id].status == "missing" and out[f.id].kind in ("value", "choice"):
                    out[f.id] = out[f.id].model_copy(
                        update={
                            "status": "needs_review", "value": saved["value"], "source": f"Template: {match.template.name}",
                            "confidence": 0.7, "tier": "uncertain", "method": "template",
                            "reasoning": "Reused from your template. Check it fits this application.",
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
    profile_values = [AutofillProfileValueOut(key=f.key, label=f.label, value=f.value) for f in built.fields]
    return suggestions, summary, template_out, run.run.id, documents, profile_values
