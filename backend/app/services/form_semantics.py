"""Understanding fields on any website's form: what a field is, which option to pick, how sensitive it is.

Nothing here knows about specific websites. Decisions come from the field's own metadata: its label,
name/id, placeholder, HTML autocomplete hint, section heading and options.
"""

from __future__ import annotations

import re
from datetime import datetime

from .embeddings import HashEmbedder, get_embedder
from .mapping import similarity
from .profile import normalize

# HTML autocomplete tokens (https://html.spec.whatwg.org/#autofill) that name a profile concept.
# A site that sets them has told us exactly what the field is.
AUTOCOMPLETE_KEYS = {
    "name": "full_name",
    "given-name": "first_name",
    "family-name": "last_name",
    "email": "email",
    "tel": "phone",
    "tel-national": "phone",
    "mobile": "phone",
    "bday": "date_of_birth",
    "sex": "gender",
    "street-address": "address",
    "address-line1": "address",
}

# Labels for consent and declarations: always ticked by the person, never by FormPilot.
CONSENT_RE = re.compile(r"\b(agree|consent|accept|terms|privacy|declare|declaration|certify|confirm that|authori[sz]e|i have read)\b", re.I)

# Identity and financial numbers: never filled without the person confirming that field.
SENSITIVE_LABEL_RE = re.compile(
    r"\b(aadhaa?r|passport|pan\b|ssn|social security|national id|voter id|driving licen[cs]e|licen[cs]e number|"
    r"bank|account number|ifsc|iban|swift|routing|tax id|tin\b|card number|cvv)\b",
    re.I,
)
SENSITIVE_KEYS = {"date_of_birth", "address"}

# Options that are prompts rather than answers.
PLACEHOLDER_OPTION_RE = re.compile(r"^\s*(-+|select.*|choose.*|please select.*|pick one|--.*--|none selected)?\s*$", re.I)

# Equivalent answers that are spelled differently from site to site.
OPTION_SYNONYMS = [
    {"male", "man", "m", "boy", "mr"},
    {"female", "woman", "f", "girl", "ms", "mrs", "miss"},
    {"other", "non binary", "nonbinary", "non-binary", "third gender", "transgender", "prefer to self describe", "genderqueer"},
    {"prefer not to say", "prefer not to answer", "decline to state", "rather not say", "not specified"},
    {"yes", "y", "true"},
    {"no", "n", "false"},
    {"india", "in", "ind", "bharat"},
]


def humanize(name: str | None) -> str:
    if not name:
        return ""
    text = re.sub(r"([a-z])([A-Z])", r"\1 \2", name)
    text = re.sub(r"[_\-.\[\]]+", " ", text)
    return re.sub(r"\s+", " ", text).strip()


def is_consent(label: str) -> bool:
    return bool(CONSENT_RE.search(label))


def is_sensitive(label: str, key: str | None) -> bool:
    return (key in SENSITIVE_KEYS) or bool(SENSITIVE_LABEL_RE.search(label))


def real_options(options: list[str]) -> list[str]:
    return [o for o in options if o and not PLACEHOLDER_OPTION_RE.match(o)]


def _synonym_group(value: str) -> set[str] | None:
    v = normalize(value)
    return next((g for g in OPTION_SYNONYMS if v in {normalize(x) for x in g}), None)


def choose_option(value: str, options: list[str]) -> tuple[str, float] | None:
    """The option that means the same as `value` ("Male" -> "Man"), with a confidence, or None."""
    choices = real_options(options)
    if not choices:
        return None
    v = normalize(value)
    for option in choices:
        if normalize(option) == v:
            return option, 1.0
    group = _synonym_group(value)
    if group:
        normalized_group = {normalize(x) for x in group}
        for option in choices:
            if normalize(option) in normalized_group:
                return option, 0.95
    # One contains the other: "B.Tech" vs "B.Tech / B.E.", "Computer Science" vs "Computer Science and Engineering".
    for option in choices:
        o = normalize(option)
        if len(o) >= 3 and len(v) >= 3 and (v in o or o in v):
            return option, 0.85
    best, score = max(((o, similarity(value, o)) for o in choices), key=lambda x: x[1])
    embedder = get_embedder()
    if not isinstance(embedder, HashEmbedder):
        vectors = embedder.embed([value] + choices)
        cosines = vectors[1:] @ vectors[0]
        i = int(cosines.argmax())
        if float(cosines[i]) >= 0.85 and float(cosines[i]) > score:
            best, score = choices[i], float(cosines[i])
    return (best, round(min(score, 0.9), 2)) if score >= 0.6 else None


def iso_date(value: str) -> str | None:
    """'12 May 2002' or '22/03/2005' -> 'YYYY-MM-DD', so the page can format it for its own date field.

    Numeric dates are read day first (22/03/2005), as written on Indian documents and forms.
    """
    text = re.sub(r"\s+", " ", value.strip().replace(",", " ")).replace("-", "/").replace(".", "/")
    text = re.sub(r"(\d)(st|nd|rd|th)\b", r"\1", text, flags=re.I)
    for fmt in ("%d %B %Y", "%d %b %Y", "%B %d %Y", "%b %d %Y", "%d/%b/%Y", "%d/%B/%Y", "%Y/%m/%d", "%d/%m/%Y"):
        try:
            return datetime.strptime(text, fmt).date().isoformat()
        except ValueError:
            continue
    return None


_DOC_KINDS = [
    (re.compile(r"resume|cv\b|curriculum", re.I), re.compile(r"resume|cv|curriculum", re.I)),
    (re.compile(r"degree|certificate|diploma|marksheet|mark sheet|transcript|grade", re.I), re.compile(r"degree|certificate|diploma|mark|transcript|grade", re.I)),
    (re.compile(r"\bid\b|identity|aadhaa?r|passport|pan\b|licen[cs]e|proof", re.I), re.compile(r"\bid\b|_id|identity|aadhaa?r|passport|pan|licen[cs]e", re.I)),
    (re.compile(r"photo|picture|headshot", re.I), re.compile(r"photo|picture|headshot|\.jpe?g$|\.png$", re.I)),
]


def suggest_document(label: str, filenames: list[str]) -> str | None:
    """The vault file most likely wanted by an upload field ("Upload CV" -> Resume.pdf)."""
    for wants, looks_like in _DOC_KINDS:
        if wants.search(label):
            return next((f for f in filenames if looks_like.search(f)), None)
    return None
