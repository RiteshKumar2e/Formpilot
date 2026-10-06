"""Builds a user's profile from extracted fields, detecting conflicts across documents."""

import re
from collections import defaultdict
from dataclasses import dataclass

from sqlalchemy import select
from sqlalchemy.orm import Session

from ..models import Document, ExtractedField, ProfileChoice, User
from ..schemas import ConflictOut, ConflictValueOut, ProfileFieldOut, ProfileOut
from .fields import CORE_FIELDS, FIELD_LABELS, MULTI_VALUE_FIELDS


@dataclass(frozen=True)
class Entry:
    """One extracted value and the document it came from."""

    key: str
    value: str
    confidence: float
    source_filename: str


def normalize(value: str) -> str:
    return re.sub(r"[^a-z0-9@+]+", " ", value.lower()).strip()


def assemble_profile(entries: list[Entry], choices: dict[str, str] | None = None) -> ProfileOut:
    """Merges extracted values into one profile. Pure function: no database access."""
    choices = choices or {}
    by_key: dict[str, list[Entry]] = defaultdict(list)
    for entry in entries:
        by_key[entry.key].append(entry)

    fields: list[ProfileFieldOut] = []
    conflicts: list[ConflictOut] = []

    for key, label in FIELD_LABELS.items():
        group = by_key.get(key)
        if not group:
            continue

        if key in MULTI_VALUE_FIELDS:
            items = dict.fromkeys(item.strip() for e in group for item in e.value.split(",") if item.strip())
            sources = dict.fromkeys(e.source_filename for e in group)
            fields.append(
                ProfileFieldOut(
                    key=key,
                    label=label,
                    value=", ".join(items),
                    confidence=max(e.confidence for e in group),
                    source_filename=", ".join(sources),
                )
            )
            continue

        # Best entry per distinct (normalized) value.
        distinct: dict[str, Entry] = {}
        for e in group:
            norm = normalize(e.value)
            if norm not in distinct or e.confidence > distinct[norm].confidence:
                distinct[norm] = e

        if key in choices:
            chosen = distinct.get(normalize(choices[key]))
            fields.append(
                ProfileFieldOut(
                    key=key,
                    label=label,
                    value=choices[key],
                    confidence=1.0,
                    source_filename=f"{chosen.source_filename} (confirmed by you)" if chosen else "Confirmed by you",
                )
            )
        elif len(distinct) == 1:
            # Every document agrees: list all of them as sources.
            e = next(iter(distinct.values()))
            sources = ", ".join(dict.fromkeys(g.source_filename for g in group))
            fields.append(ProfileFieldOut(key=key, label=label, value=e.value, confidence=e.confidence, source_filename=sources))
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
        select(ExtractedField, Document.filename)
        .join(Document, ExtractedField.document_id == Document.id)
        .where(ExtractedField.user_id == user.id)
        .order_by(Document.created_at)
    ).all()
    choices = {c.key: c.value for c in db.scalars(select(ProfileChoice).where(ProfileChoice.user_id == user.id))}
    entries = [Entry(f.key, f.value, f.confidence, filename) for f, filename in rows]
    return assemble_profile(entries, choices)
