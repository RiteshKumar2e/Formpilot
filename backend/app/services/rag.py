"""Form field mapping with retrieval-augmented generation (RAG).

Workflow for a set of form labels:
  1. classify   Each label is matched to a profile concept (lexical, then semantic embeddings).
  2. retrieve   Each label is embedded and the closest passages are fetched from the user's
                documents in the vector index.
  3. generate   The LLM sees the profile plus the retrieved passages and picks a value per field.
  4. validate   Every generated value must equal a profile value or appear in a retrieved passage;
                otherwise the deterministic answer from step 1 is kept. Conflicts always go to the user.
Without an LLM, steps 1-2 alone produce the answers, and retrieval still supplies the evidence shown
to the user.
"""

from __future__ import annotations

from sqlalchemy.orm import Session

from ..config import get_settings
from ..models import User
from ..schemas import FieldMatchOut, ProfileOut
from .extraction import grounded
from .fields import FIELD_LABELS
from .llm import llm_available, map_with_llm
from .mapping import classify_hybrid
from .profile import build_profile, normalize
from .vectorstore import Passage, search
from .workflow import WorkflowRunner

EVIDENCE_CHARS = 280


def _evidence(passages: list[Passage]) -> str | None:
    return passages[0].text[:EVIDENCE_CHARS] if passages else None


def baseline_match(label: str, profile: ProfileOut, passages: list[Passage]) -> FieldMatchOut:
    """The deterministic answer: classify the label and look the concept up in the profile."""
    by_key = {f.key: f for f in profile.fields}
    conflicted = {c.key for c in profile.conflicts}
    key, score, matcher = classify_hybrid(label)
    field = by_key.get(key) if key else None
    if field is None:
        return FieldMatchOut(
            form_label=label,
            key=key,
            value=None,
            confidence=0.0,
            source_filename=None,
            needs_review=key in conflicted,
            method=matcher if key else "none",
            evidence=_evidence(passages),
        )
    return FieldMatchOut(
        form_label=label,
        key=key,
        value=field.value,
        confidence=round(min(1.0, score) * field.confidence, 2),
        source_filename=field.source_filename,
        method=matcher,
        evidence=_evidence(passages),
    )


def map_fields(db: Session, user: User, labels: list[str], application_id: str | None = None) -> tuple[list[FieldMatchOut], str]:
    run = WorkflowRunner(db, user.id, "form_mapping", subject_id=application_id)
    profile = build_profile(db, user)
    conflicted = {c.key for c in profile.conflicts}
    by_key = {f.key: f for f in profile.fields}

    with run.step("retrieve") as step:
        passages = search(db, user.id, labels, get_settings().rag_top_k)
        step.detail = f"{sum(len(p) for p in passages)} passage(s) retrieved for {len(labels)} field(s)"

    with run.step("classify") as step:
        matches = [baseline_match(label, profile, found) for label, found in zip(labels, passages)]
        semantic = sum(1 for m in matches if m.method == "semantic")
        step.detail = f"{sum(1 for m in matches if m.key)} of {len(labels)} labels recognised ({semantic} by embeddings)"

    if not llm_available():
        run.skip("generate", "No LLM configured (set GROQ_API_KEY).")
        run.skip("validate", "Nothing generated.")
        run.finish()
        db.commit()
        return matches, run.run.id

    with run.step("generate") as step:
        profile_payload = [
            {"key": f.key, "label": f.label, "value": f.value, "source_filename": f.source_filename, "conflicted": False}
            for f in profile.fields
        ] + [{"key": c.key, "label": c.label, "value": None, "source_filename": None, "conflicted": True} for c in profile.conflicts]
        passage_payload = [[{"filename": p.source_filename, "text": p.text} for p in found] for found in passages]
        generated = map_with_llm(labels, profile_payload, passage_payload)
        if generated is None:
            step.status = "failed"
            step.detail = "The LLM was unavailable; kept the deterministic matches."
        else:
            step.detail = f"LLM answered {sum(1 for g in generated if g.value)} of {len(labels)} field(s)"

    if generated is None:
        run.skip("validate", "Nothing generated.")
        run.finish()
        db.commit()
        return matches, run.run.id

    with run.step("validate") as step:
        accepted = rejected = 0
        for i, (gen, found) in enumerate(zip(generated, passages)):
            base = matches[i]
            if gen.key in conflicted:
                matches[i] = base.model_copy(update={"key": gen.key, "value": None, "confidence": 0.0, "needs_review": True})
                continue
            if gen.value is None:
                # The model judged that nothing answers this field. Trust that unless it agrees with the
                # deterministic matcher on the concept, in which case the profile value stands.
                if base.value is not None and gen.key != base.key:
                    matches[i] = FieldMatchOut(
                        form_label=gen.form_label, key=gen.key, value=None, confidence=0.0, source_filename=None,
                        method="llm_rag", reasoning=gen.reasoning or None, evidence=_evidence(found),
                    )
                continue

            profile_field = by_key.get(gen.key) if gen.key else None
            if profile_field and normalize(profile_field.value) == normalize(gen.value):
                value, source, confidence = profile_field.value, profile_field.source_filename, gen.confidence * profile_field.confidence
            else:
                support = next((p for p in found if grounded(gen.value, p.text)), None)
                if support is None or (gen.key in FIELD_LABELS and profile_field is not None):
                    # Not traceable to the documents, or contradicts the verified profile value.
                    rejected += 1
                    continue
                value, source, confidence = gen.value, support.source_filename, min(gen.confidence, 0.79)
            accepted += 1
            matches[i] = FieldMatchOut(
                form_label=gen.form_label,
                key=gen.key,
                value=value,
                confidence=round(confidence, 2),
                source_filename=source,
                method="llm_rag",
                reasoning=gen.reasoning or None,
                evidence=_evidence(found),
            )
        step.detail = f"{accepted} generated value(s) verified against the documents; {rejected} rejected"

    run.finish()
    db.commit()
    return matches, run.run.id
