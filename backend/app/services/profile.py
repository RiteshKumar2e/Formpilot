"""Builds a user's Master Profile from extracted fields, detecting conflicts across documents."""

import re
from collections import defaultdict
from dataclasses import dataclass
from datetime import datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from ..models import Document, ExtractedField, ProfileChoice, User
from ..schemas import ConflictOut, ConflictValueOut, ProfileFieldOut, ProfileOut
from .fields import CORE_FIELDS, FIELD_LABELS, MULTI_VALUE_FIELDS

HIGH_CONFIDENCE = 0.9


@dataclass(frozen=True)
class Entry:
    """One extracted value and the document it came from."""

    key: str
    value: str
    confidence: float
    source_filename: str
    updated_at: datetime | None = None


@dataclass(frozen=True)
class Choice:
    """A value the user set or confirmed."""

    value: str
    updated_at: datetime | None = None


def normalize(value: str) -> str:
    return re.sub(r"[^a-z0-9@+]+", " ", value.lower()).strip()


def _latest(entries: list[Entry]) -> datetime | None:
    dates = [e.updated_at for e in entries if e.updated_at]
    return max(dates) if dates else None


def _field(key: str, value: str, confidence: float, sources: list[str], updated_at: datetime | None) -> ProfileFieldOut:
    if len(sources) >= 2:
        verification = "multiple_documents"
    elif confidence >= HIGH_CONFIDENCE:
        verification = "high_confidence"
    else:
        verification = "unverified"
    return ProfileFieldOut(
        key=key,
        label=FIELD_LABELS[key],
        value=value,
        confidence=confidence,
        source_filename=", ".join(sources),
        sources=sources,
        verification=verification,
        verified=verification != "unverified",
        updated_at=updated_at,
    )


def _chosen(key: str, choice: Choice, sources: list[str], updated_at: datetime | None) -> ProfileFieldOut:
    when = max((d for d in (choice.updated_at, updated_at) if d), default=None)
    return ProfileFieldOut(
        key=key,
        label=FIELD_LABELS[key],
        value=choice.value,
        confidence=1.0,
        source_filename=f"{', '.join(sources)} (confirmed by you)" if sources else "Confirmed by you",
        sources=sources,
        verification="confirmed_by_you",
        verified=True,
        updated_at=when,
    )


def assemble_profile(entries: list[Entry], choices: dict[str, "str | Choice"] | None = None) -> ProfileOut:
    """Merges extracted values into one profile. Pure function: no database access."""
    chosen = {k: c if isinstance(c, Choice) else Choice(c) for k, c in (choices or {}).items()}
    by_key: dict[str, list[Entry]] = defaultdict(list)
    for entry in entries:
        by_key[entry.key].append(entry)

    fields: list[ProfileFieldOut] = []
    conflicts: list[ConflictOut] = []

    for key, label in FIELD_LABELS.items():
        group = by_key.get(key, [])
        if not group:
            if key in chosen:  # entered by the user, not found in any document
                fields.append(_chosen(key, chosen[key], [], None))
            continue

        if key in MULTI_VALUE_FIELDS:
            sources = list(dict.fromkeys(e.source_filename for e in group))
            if key in chosen:
                fields.append(_chosen(key, chosen[key], sources, _latest(group)))
                continue
            separator = MULTI_VALUE_FIELDS[key]
            items = dict.fromkeys(item.strip() for e in group for item in e.value.split(separator.strip()) if item.strip())
            fields.append(_field(key, separator.join(items), max(e.confidence for e in group), sources, _latest(group)))
            continue

        # Best entry per distinct (normalized) value.
        distinct: dict[str, Entry] = {}
        for e in group:
            norm = normalize(e.value)
            if norm not in distinct or e.confidence > distinct[norm].confidence:
                distinct[norm] = e

        if key in chosen:
            agreeing = [e.source_filename for e in group if normalize(e.value) == normalize(chosen[key].value)]
            fields.append(_chosen(key, chosen[key], list(dict.fromkeys(agreeing)), _latest(group)))
        elif len(distinct) == 1:
            # Every document agrees: list all of them as sources.
            e = next(iter(distinct.values()))
            sources = list(dict.fromkeys(g.source_filename for g in group))
            fields.append(_field(key, e.value, e.confidence, sources, _latest(group)))
        else:
            conflicts.append(
                ConflictOut(
                    key=key,
                    label=label,
                    values=[ConflictValueOut(value=e.value, source_filename=e.source_filename) for e in distinct.values()],
                )
            )

    present = {f.key for f in fields}
    completeness = round(len(present & set(CORE_FIELDS)) / len(CORE_FIELDS), 2)
    return ProfileOut(fields=fields, conflicts=conflicts, completeness=completeness)


def build_profile(db: Session, user: User) -> ProfileOut:
    rows = db.execute(
        select(ExtractedField, Document.filename, Document.created_at)
        .join(Document, ExtractedField.document_id == Document.id)
        .where(ExtractedField.user_id == user.id)
        .order_by(Document.created_at)
    ).all()
    choices = {
        c.key: Choice(c.value, c.updated_at) for c in db.scalars(select(ProfileChoice).where(ProfileChoice.user_id == user.id))
    }
    entries = [Entry(f.key, f.value, f.confidence, filename, created) for f, filename, created in rows]
    return assemble_profile(entries, choices)
