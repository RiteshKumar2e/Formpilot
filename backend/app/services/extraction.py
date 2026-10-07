"""Document reading and structured field extraction.

Pipeline: read text (PDF text layer, or OCR when available) -> extract fields with pattern rules ->
extract fields with Claude (when configured) -> merge the two, checking every model value against the
document text -> decide a status. The rules are the deterministic baseline that runs without any model.
"""

from __future__ import annotations

import io
import re
from dataclasses import dataclass, field
from datetime import date

from pypdf import PdfReader
from pypdf.errors import PdfReadError

from .fields import FIELD_LABELS

LOW_CONFIDENCE = 0.7

MONTHS = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"]
_MONTH_RE = r"(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\.?"


class UnreadableDocument(Exception):
    pass


@dataclass
class Extracted:
    key: str
    value: str
    confidence: float

    @property
    def label(self) -> str:
        return FIELD_LABELS[self.key]


@dataclass
class ExtractionResult:
    status: str
    message: str | None
    page_count: int | None
    fields: list[Extracted] = field(default_factory=list)


# --- Text reading -------------------------------------------------------------------------


def ocr_available() -> bool:
    try:
        import pytesseract  # type: ignore[import-not-found]

        pytesseract.get_tesseract_version()
        return True
    except Exception:
        return False


def _ocr(image_bytes: bytes) -> str:
    import pytesseract  # type: ignore[import-not-found]
    from PIL import Image  # type: ignore[import-not-found]

    return pytesseract.image_to_string(Image.open(io.BytesIO(image_bytes)))


def read_pdf(data: bytes) -> tuple[str, int]:
    try:
        reader = PdfReader(io.BytesIO(data))
        if reader.is_encrypted and not reader.decrypt(""):
            raise UnreadableDocument("This PDF is password-protected. Remove the password and upload it again.")
        pages = reader.pages
        text = "\n".join(page.extract_text() or "" for page in pages)
        if not text.strip() and ocr_available():
            # Scanned PDF: run OCR over the page images.
            text = "\n".join(_ocr(img.data) for page in pages for img in page.images)
        return text, len(pages)
    except UnreadableDocument:
        raise
    except (PdfReadError, ValueError, KeyError, OSError) as exc:
        raise UnreadableDocument("The file appears to be damaged. Try uploading a clearer file.") from exc


def read_image(data: bytes) -> str | None:
    """Returns OCR text, or None when OCR isn't installed on this server."""
    if not ocr_available():
        return None
    try:
        return _ocr(data)
    except Exception as exc:  # Pillow raises a variety of errors for corrupt images
        raise UnreadableDocument("We couldn't read this image. Try uploading a clearer file.") from exc


# --- Field rules --------------------------------------------------------------------------


def _clean(value: str) -> str:
    return re.sub(r"\s+", " ", value).strip(" .,:;-–—|")


def _title(value: str) -> str:
    return " ".join(w.capitalize() if w.isupper() or w.islower() else w for w in value.split())


def parse_date(text: str) -> tuple[str, float] | None:
    """Parses a date and returns it as '12 May 2002' with a confidence score."""
    text = text.lower()

    m = re.search(rf"(\d{{1,2}})(?:st|nd|rd|th)?\s+{_MONTH_RE},?\s+(\d{{4}})", text)
    if m:
        day, month, year = int(m.group(1)), _month_index(m.group(2)), int(m.group(3))
        return _format(day, month, year, 0.95)

    m = re.search(rf"{_MONTH_RE}\s+(\d{{1,2}})(?:st|nd|rd|th)?,?\s+(\d{{4}})", text)
    if m:
        month, day, year = _month_index(m.group(1)), int(m.group(2)), int(m.group(3))
        return _format(day, month, year, 0.95)

    m = re.search(r"(\d{4})-(\d{1,2})-(\d{1,2})", text)
    if m:
        return _format(int(m.group(3)), int(m.group(2)), int(m.group(1)), 0.95)

    m = re.search(r"(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{4})", text)
    if m:
        first, second, year = int(m.group(1)), int(m.group(2)), int(m.group(3))
        if first > 12:  # unambiguous day-first
            return _format(first, second, year, 0.9)
        if second > 12:  # unambiguous month-first
            return _format(second, first, year, 0.9)
        # Ambiguous: assume day-first and flag for review.
        return _format(first, second, year, 0.65)
    return None


def _month_index(token: str) -> int:
    return next(i + 1 for i, name in enumerate(MONTHS) if name.startswith(token.rstrip(".")[:3]))


def _format(day: int, month: int, year: int, confidence: float) -> tuple[str, float] | None:
    try:
        d = date(year, month, day)
    except ValueError:
        return None
    return f"{d.day} {MONTHS[d.month - 1].capitalize()} {d.year}", confidence


EMAIL_RE = re.compile(r"[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}")
PHONE_RE = re.compile(r"(\+?\d[\d\s\-()]{8,16}\d)")
LINKEDIN_RE = re.compile(r"(?:https?://)?(?:www\.)?linkedin\.com/in/[\w\-]+", re.I)
GITHUB_RE = re.compile(r"(?:https?://)?(?:www\.)?github\.com/[\w\-]+", re.I)

DEGREE_RE = re.compile(
    r"\b(ph\.?\s?d\.?|doctor of philosophy|m\.?\s?tech|m\.?\s?sc|m\.?\s?e\.|mba|mca|master of [a-z]+(?: (?!in\b)[a-z]+)?"
    r"|b\.?\s?tech|b\.?\s?sc|b\.?\s?e\.|bca|bba|b\.?\s?com|bachelor of [a-z]+(?: (?!in\b)[a-z]+)?)",
    re.I,
)
DEGREE_LEVEL = [(re.compile(r"ph\.?\s?d|doctor", re.I), 3), (re.compile(r"^m|master", re.I), 2), (re.compile(r".", re.I), 1)]
STUDY_RE = re.compile(r"^\s*(?:in|\(|,|-|–)\s*([A-Z][A-Za-z&]*(?:\s+(?:&|and|of|[A-Z][A-Za-z&]*)){0,4})")

ROLE_RE = re.compile(r"\b(intern|engineer|developer|analyst|research(?:er)?|manager|assistant|consultant|designer|scientist|lead|associate|fellow)\b", re.I)
DATE_RANGE_TAIL = re.compile(
    rf"[\s(|,]*((?:{_MONTH_RE}\s+)?\d{{4}}|\d{{1,2}}/\d{{4}})\s*(?:-|–|—|to)\s*(present|current|now|(?:{_MONTH_RE}\s+)?\d{{4}}|\d{{1,2}}/\d{{4}})\)?\s*$",
    re.I,
)
NAME_STOPWORDS = {
    "resume", "curriculum", "vitae", "certificate", "university", "institute", "profile", "transcript", "college",
    # Common words in document titles, which would otherwise look like a name in title case.
    "system", "systems", "information", "retrieval", "answers", "answer", "assignment", "question", "questions",
    "notes", "chapter", "unit", "introduction", "report", "project", "lab", "practical", "exam", "examination",
    "syllabus", "course", "semester", "department", "school", "data", "computer", "science", "engineering",
    "management", "analysis", "design", "theory", "and", "of", "the", "for", "to", "in",
}

RESUME_SECTION_RE = re.compile(
    r"^(education|experience|work experience|skills|technical skills|objective|summary|projects|internships?)\s*:?$",
    re.I | re.M,
)


def _looks_like_resume(text: str) -> bool:
    """A document's first line is only trusted as a name when the document has resume signals."""
    has_contact = bool(EMAIL_RE.search(text)) or any(
        10 <= len(re.sub(r"\D", "", m.group(1))) <= 13 for m in PHONE_RE.finditer(text)
    )
    return has_contact or len(RESUME_SECTION_RE.findall(text)) >= 2


# Long-form degree names mapped to the short form, so the same degree written two ways isn't a conflict.
DEGREE_ALIASES = {
    "bachelor of technology": "B.Tech",
    "bachelor of engineering": "B.E.",
    "bachelor of science": "B.Sc",
    "bachelor of commerce": "B.Com",
    "bachelor of computer applications": "BCA",
    "bachelor of business administration": "BBA",
    "master of technology": "M.Tech",
    "master of science": "M.Sc",
    "master of engineering": "M.E.",
    "master of business administration": "MBA",
    "master of computer applications": "MCA",
    "doctor of philosophy": "Ph.D",
}
_SHORT_DEGREES = {"btech": "B.Tech", "mtech": "M.Tech", "bsc": "B.Sc", "msc": "M.Sc", "bcom": "B.Com", "phd": "Ph.D"}


def _canonical_degree(degree: str) -> str:
    compact = re.sub(r"\s+", " ", degree.lower()).strip()
    if compact in DEGREE_ALIASES:
        return DEGREE_ALIASES[compact]
    return _SHORT_DEGREES.get(re.sub(r"[\s.]", "", compact), degree)


def _degree_level(degree: str) -> int:
    return next(level for pattern, level in DEGREE_LEVEL if pattern.search(degree))


def _extract_name(lines: list[str], text: str) -> Extracted | None:
    for line in lines:
        m = re.match(r"^(?:full\s+|candidate\s+|student\s+|applicant\s+)?name\s*[:\-]\s*(.+)$", line, re.I)
        if m and 1 < len(m.group(1)) < 80:
            return Extracted("full_name", _title(_clean(m.group(1))), 0.95)

    m = re.search(
        r"certify that\s+(?:mr\.?|ms\.?|mrs\.?|miss)?\s*([A-Za-z][A-Za-z .]{2,60}?)\s+(?:has|son|daughter|s/o|d/o|was|bearing|is)\b",
        text,
        re.I,
    )
    if m:
        return Extracted("full_name", _title(_clean(m.group(1))), 0.9)

    # Resumes usually start with the candidate's name. Other documents start with a title, so skip them.
    if not _looks_like_resume(text):
        return None
    for line in lines[:3]:
        words = line.split()
        if 2 <= len(words) <= 4 and all(re.fullmatch(r"[A-Za-z][A-Za-z.'\-]*", w) for w in words):
            if not NAME_STOPWORDS & {w.lower() for w in words}:
                return Extracted("full_name", _title(line), 0.75)
    return None


def _extract_phone(lines: list[str]) -> Extracted | None:
    labelled = [l for l in lines if re.search(r"\b(phone|mobile|tel|contact|cell)\b", l, re.I)]
    for confidence, candidates in ((0.95, labelled), (0.8, lines)):
        for line in candidates:
            for m in PHONE_RE.finditer(line):
                digits = re.sub(r"\D", "", m.group(1))
                if 10 <= len(digits) <= 13 and not re.search(r"\d{1,2}[/.\-]\d{1,2}[/.\-]\d{4}", m.group(1)):
                    return Extracted("phone", _clean(m.group(1)), confidence)
    return None


def _extract_dob(lines: list[str]) -> Extracted | None:
    for i, line in enumerate(lines):
        m = re.search(r"(?:date\s+of\s+birth|d\.?\s?o\.?\s?b\.?|born(?:\s+on)?)\s*[:\-]?\s*(.*)", line, re.I)
        if not m:
            continue
        candidate = m.group(1) or (lines[i + 1] if i + 1 < len(lines) else "")
        parsed = parse_date(candidate)
        if parsed:
            return Extracted("date_of_birth", parsed[0], parsed[1])
    return None


def _extract_education(lines: list[str]) -> list[Extracted]:
    best: tuple[int, str] | None = None
    institution: Extracted | None = None
    year: Extracted | None = None
    for line in lines:
        m = DEGREE_RE.search(line)
        if m:
            degree = _canonical_degree(_clean(m.group(1)))
            study = STUDY_RE.match(line[m.end():])
            value = f"{degree} in {_clean(study.group(1))}" if study else degree
            level = _degree_level(degree)
            if best is None or level > best[0]:
                best = (level, value)
        if institution is None:
            for part in re.split(r"[,|•·–—]", line):
                if re.search(r"\b(university|institute|college|iit|nit|iiit|school of)\b", part, re.I) and len(part) < 90:
                    if not re.search(r"\bcertify\b", part, re.I):
                        institution = Extracted("institution", _clean(part), 0.8)
                        break
        if year is None:
            y = re.search(r"(?:year of passing|graduat\w*|class of|batch)\D{0,20}((?:19|20)\d{2})", line, re.I)
            if y:
                year = Extracted("graduation_year", y.group(1), 0.8)

    out = [e for e in (institution, year) if e]
    if best:
        out.insert(0, Extracted("highest_qualification", best[1], 0.9))
    return out


def _extract_skills(lines: list[str]) -> Extracted | None:
    for i, line in enumerate(lines):
        m = re.match(r"^(?:technical\s+|key\s+|core\s+)?skills?\s*[:\-]?\s*(.*)$", line, re.I)
        if not m:
            continue
        raw = m.group(1) or (lines[i + 1] if i + 1 < len(lines) else "")
        items = [_clean(s) for s in re.split(r"[,|•·;/]", raw)]
        items = [s for s in items if 1 <= len(s) <= 40][:20]
        if items:
            return Extracted("skills", ", ".join(dict.fromkeys(items)), 0.85)
    return None


def _extract_experience(lines: list[str]) -> Extracted | None:
    for i, line in enumerate(lines):
        if re.match(r"^(?:work\s+|professional\s+|relevant\s+)?experience\s*:?$", line, re.I):
            for candidate in lines[i + 1 : i + 7]:
                if ROLE_RE.search(candidate):
                    value = _clean(DATE_RANGE_TAIL.sub("", candidate))
                    if value:
                        return Extracted("experience", value, 0.75)
    return None


def extract_fields(text: str) -> list[Extracted]:
    lines = [_clean(l) for l in text.splitlines()]
    lines = [l for l in lines if l]
    found: list[Extracted] = []

    if name := _extract_name(lines, text):
        found.append(name)
    if m := EMAIL_RE.search(text):
        found.append(Extracted("email", m.group(0).lower(), 0.99))
    if phone := _extract_phone(lines):
        found.append(phone)
    if dob := _extract_dob(lines):
        found.append(dob)
    found.extend(_extract_education(lines))
    if exp := _extract_experience(lines):
        found.append(exp)
    if skills := _extract_skills(lines):
        found.append(skills)
    if m := LINKEDIN_RE.search(text):
        found.append(Extracted("linkedin", m.group(0), 0.95))
    if m := GITHUB_RE.search(text):
        found.append(Extracted("github", m.group(0), 0.95))
    return found


# --- Combining rules with the LLM -----------------------------------------------------------

# Fields where a pattern match is near-certain; the model can't override these.
_RULE_AUTHORITATIVE = {"email", "linkedin", "github"}


def _norm(value: str) -> str:
    return re.sub(r"[^a-z0-9@+]+", " ", value.lower()).strip()


def grounded(value: str, text: str) -> bool:
    """True when the value's words appear in the document, so the model didn't invent it."""
    words = [w for w in _norm(value).split() if len(w) > 1]
    if not words:
        return False
    haystack = _norm(text)
    found = sum(1 for w in words if w in haystack)
    return found / len(words) >= 0.8


def merge_extractions(rules: list[Extracted], llm: list[Extracted], text: str) -> list[Extracted]:
    """Combines rule and model results field by field.

    Agreement raises confidence. On disagreement the model's reading wins (it understands context the
    rules don't), but with lower confidence so the user is asked to check. Model values that can't be
    found in the document are discarded.
    """
    by_key = {f.key: f for f in rules}
    merged: dict[str, Extracted] = dict(by_key)
    for f in llm:
        if f.key in _RULE_AUTHORITATIVE and f.key in by_key:
            continue
        # Dates are reformatted by both extractors, so compare them as parsed dates rather than text.
        if f.key == "date_of_birth":
            parsed = parse_date(f.value)
            if not parsed:
                continue
            value_ok = True
            f = Extracted(f.key, parsed[0], min(f.confidence, parsed[1]))
        else:
            value_ok = grounded(f.value, text)
        if not value_ok:
            continue
        rule = by_key.get(f.key)
        if rule is None:
            merged[f.key] = f
        elif _norm(rule.value) == _norm(f.value):
            merged[f.key] = Extracted(f.key, rule.value, round(min(0.99, max(rule.confidence, f.confidence) + 0.05), 2))
        else:
            merged[f.key] = Extracted(f.key, f.value, round(min(f.confidence, 0.69), 2))
    order = list(FIELD_LABELS)
    return sorted(merged.values(), key=lambda f: order.index(f.key))


def llm_fields(text: str) -> list[Extracted] | None:
    from .llm import extract_with_llm

    result = extract_with_llm(text)
    if result is None:
        return None
    return [Extracted(f.key, _clean(f.value), round(max(0.0, min(1.0, f.confidence)), 2)) for f in result if _clean(f.value)]


# --- Entry point --------------------------------------------------------------------------


def read_text(data: bytes, content_type: str) -> tuple[str | None, int | None, ExtractionResult | None]:
    """Reads the document's text. Returns (text, pages, None), or a final result when it can't be read."""
    try:
        if content_type == "application/pdf":
            text, pages = read_pdf(data)
        else:
            pages = 1
            ocr_text = read_image(data)
            if ocr_text is None:
                return None, pages, ExtractionResult(
                    status="needs_review",
                    message="Text recognition for images isn't enabled on this server yet, so no details were extracted. Upload a PDF with selectable text instead.",
                    page_count=pages,
                )
            text = ocr_text
    except UnreadableDocument as exc:
        return None, None, ExtractionResult(status="failed", message=str(exc), page_count=None)

    if not text.strip():
        return None, pages, ExtractionResult(
            status="failed",
            message="We couldn't find any readable text. Try uploading a clearer file.",
            page_count=pages,
        )
    return text, pages, None


def decide(fields: list[Extracted], pages: int | None) -> ExtractionResult:
    if not fields:
        return ExtractionResult(
            status="needs_review",
            message=(
                "We read this document but didn't find profile details such as your name, contact details or education. "
                "FormPilot works with resumes, certificates, mark sheets and ID documents."
            ),
            page_count=pages,
            fields=[],
        )

    low = [f.label.lower() for f in fields if f.confidence < LOW_CONFIDENCE]
    if low:
        return ExtractionResult(
            status="needs_review",
            message=f"Please check: {', '.join(low)}. The format was ambiguous.",
            page_count=pages,
            fields=fields,
        )
    return ExtractionResult(status="processed", message=None, page_count=pages, fields=fields)


def process_document(data: bytes, content_type: str, use_llm: bool = True) -> tuple[ExtractionResult, str | None]:
    """Reads and extracts a document. Returns the result and the document text (for indexing)."""
    text, pages, early = read_text(data, content_type)
    if early is not None:
        return early, None
    assert text is not None
    fields = extract_fields(text)
    if use_llm and (model_fields := llm_fields(text)) is not None:
        fields = merge_extractions(fields, model_fields, text)
    return decide(fields, pages), text
