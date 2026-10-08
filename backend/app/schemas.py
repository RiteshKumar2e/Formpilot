from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    full_name: str
    email: str
    created_at: datetime


class SessionOut(BaseModel):
    user: UserOut | None


class SignUpIn(BaseModel):
    full_name: str = Field(min_length=1, max_length=200)
    email: EmailStr
    password: str = Field(min_length=6, max_length=256)
    website: str = Field(default="", max_length=200)  # honeypot

    @field_validator("full_name")
    @classmethod
    def _strip_name(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Enter your full name.")
        return v

    @field_validator("password")
    @classmethod
    def _password_strength(cls, v: str) -> str:
        return check_password(v)


def check_password(v: str) -> str:
    if not any(c.isalpha() for c in v) or not any(c.isdigit() for c in v):
        raise ValueError("Include at least one letter and one number.")
    return v


class SignInIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=256)
    # Keep the session for REMEMBER_DAYS instead of ending it when the browser closes.
    remember: bool = False


class ForgotPasswordIn(BaseModel):
    email: EmailStr


class ForgotPasswordOut(BaseModel):
    ok: bool = True
    expires_minutes: int
    # False when this server has no email (SMTP) configured, so no link can be delivered to anyone.
    email_enabled: bool = True


class ResetTokenOut(BaseModel):
    valid: bool
    email: str | None = None


class ResetPasswordIn(BaseModel):
    token: str = Field(min_length=10, max_length=200)
    password: str = Field(min_length=6, max_length=256)

    @field_validator("password")
    @classmethod
    def _password_strength(cls, v: str) -> str:
        return check_password(v)


class ChangePasswordIn(BaseModel):
    current_password: str = Field(default="", max_length=256)
    new_password: str = Field(min_length=6, max_length=256)

    @field_validator("new_password")
    @classmethod
    def _password_strength(cls, v: str) -> str:
        return check_password(v)


DocumentStatus = Literal["processing", "processed", "needs_review", "failed"]


class ExtractedFieldOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    key: str
    label: str
    value: str
    confidence: float


class DocumentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    filename: str
    content_type: str
    size_bytes: int
    page_count: int | None
    status: DocumentStatus
    message: str | None
    extracted: list[ExtractedFieldOut] = Field(validation_alias="fields")
    created_at: datetime


Verification = Literal["confirmed_by_you", "multiple_documents", "high_confidence", "unverified"]


class ProfileFieldOut(BaseModel):
    key: str
    label: str
    value: str
    confidence: float
    source_filename: str
    sources: list[str] = []
    # Why the value can be trusted: chosen by the user, found in several documents, or read with high confidence.
    verification: Verification = "unverified"
    verified: bool = False
    updated_at: datetime | None = None


class ConflictValueOut(BaseModel):
    value: str
    source_filename: str


class ConflictOut(BaseModel):
    key: str
    label: str
    values: list[ConflictValueOut]


class ProfileOut(BaseModel):
    fields: list[ProfileFieldOut]
    conflicts: list[ConflictOut]
    completeness: float


class ResolveConflictIn(BaseModel):
    key: str = Field(min_length=1, max_length=64)
    value: str = Field(min_length=1, max_length=2000)


class MappingIn(BaseModel):
    fields: list[str] = Field(min_length=1, max_length=100)
    application_id: str | None = Field(default=None, max_length=64)

    @field_validator("fields")
    @classmethod
    def _clean(cls, v: list[str]) -> list[str]:
        cleaned = [f.strip()[:200] for f in v if f.strip()]
        if not cleaned:
            raise ValueError("Add at least one form field label.")
        return cleaned


class FieldMatchOut(BaseModel):
    form_label: str
    key: str | None
    value: str | None
    confidence: float
    source_filename: str | None
    needs_review: bool = False  # True when the profile has conflicting values for this field
    method: Literal["llm_rag", "semantic", "lexical", "none"] = "lexical"
    reasoning: str | None = None
    evidence: str | None = None  # the retrieved passage that best supports the value


class MappingOut(BaseModel):
    matches: list[FieldMatchOut]
    workflow_id: str | None = None


class WorkflowStepOut(BaseModel):
    name: str
    status: Literal["running", "completed", "failed", "skipped"]
    detail: str | None
    duration_ms: int


class WorkflowRunOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    workflow: str
    subject_id: str | None
    status: str
    steps: list[WorkflowStepOut]
    started_at: datetime
    finished_at: datetime | None


ApplicationStatus = Literal["draft", "processing", "needs_review", "ready", "prepared"]


class ApplicationIn(BaseModel):
    """The web app's application record. Stored encrypted; only these fields are read by the server."""

    model_config = ConfigDict(extra="allow")

    id: str = Field(min_length=1, max_length=64)
    title: str = Field(min_length=1, max_length=300)
    status: ApplicationStatus
    fields: list[dict] = Field(default_factory=list, max_length=200)


class AutofillField(BaseModel):
    label: str
    value: str
    section: str | None = None


class AutofillOut(BaseModel):
    application_id: str
    title: str
    organization: str | None
    status: str
    reference: str | None
    fields: list[AutofillField]


WebhookEvent = Literal["document.processed", "application.created", "application.approved", "application.deleted"]


class WebhookIn(BaseModel):
    url: str = Field(min_length=8, max_length=2000)
    events: list[WebhookEvent] = Field(min_length=1)


class WebhookDeliveryOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    event: str
    ok: bool
    status_code: int | None
    error: str | None
    created_at: datetime


class WebhookOut(BaseModel):
    id: str
    url: str
    events: list[str]
    active: bool
    created_at: datetime
    secret: str | None = None  # shown once, when the webhook is created
    recent_deliveries: list[WebhookDeliveryOut] = []


class CapabilitiesOut(BaseModel):
    llm: dict
    embeddings: dict
    vector_store: str
    database: str
    ocr: bool
    oauth: dict


class ContactIn(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    email: EmailStr
    message: str = Field(min_length=10, max_length=5000)
    website: str = Field(default="", max_length=200)  # honeypot



# --- Common answers & Smart Answers ----------------------------------------------------------


class SavedAnswerIn(BaseModel):
    question: str = Field(min_length=3, max_length=500)
    answer: str = Field(min_length=1, max_length=5000)


class SavedAnswerOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    question: str
    answer: str
    use_count: int
    created_at: datetime
    updated_at: datetime


class SmartAnswerIn(BaseModel):
    question: str = Field(min_length=3, max_length=500)
    organization: str | None = Field(default=None, max_length=200)
    role: str | None = Field(default=None, max_length=200)
    max_words: int = Field(default=150, ge=30, le=500)


class SmartAnswerSourceOut(BaseModel):
    type: Literal["profile", "document", "saved_answer"]
    label: str
    detail: str | None = None


class SmartAnswerOut(BaseModel):
    answer: str
    method: Literal["llm_rag", "saved_answer", "profile_draft", "none"]
    sources: list[SmartAnswerSourceOut]
    # Always a suggestion: the user reads, edits and accepts it.
    is_suggestion: bool = True


# --- Templates -------------------------------------------------------------------------------


class TemplateFieldIn(BaseModel):
    model_config = ConfigDict(extra="ignore")

    label: str = Field(max_length=300)
    value: str = Field(default="", max_length=5000)
    section: str | None = Field(default=None, max_length=100)
    profileKey: str | None = Field(default=None, max_length=64)


class TemplateIn(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    application_type: str = Field(default="custom", max_length=20)
    organization: str | None = Field(default=None, max_length=200)
    fields: list[TemplateFieldIn] = Field(min_length=1, max_length=200)
    documents: list[str] = Field(default_factory=list, max_length=50)


class TemplateOut(BaseModel):
    id: str
    name: str
    application_type: str
    organization: str | None
    fields: list[TemplateFieldIn]
    documents: list[str]
    common_answers: list[TemplateFieldIn]
    completed: int
    total: int
    use_count: int
    created_at: datetime


class TemplateMatchIn(BaseModel):
    labels: list[str] = Field(min_length=1, max_length=200)


class TemplateMatchOut(BaseModel):
    id: str
    name: str
    score: float
    reusable: int


# --- Autofill (browser extension API) --------------------------------------------------------


class AutofillFieldIn(BaseModel):
    id: str = Field(min_length=1, max_length=200)
    label: str = Field(min_length=1, max_length=300)
    type: str = Field(default="text", max_length=30)
    required: bool = False


class AutofillIn(BaseModel):
    fields: list[AutofillFieldIn] = Field(min_length=1, max_length=150)
    page_url: str | None = Field(default=None, max_length=2000)
    page_title: str | None = Field(default=None, max_length=300)
    organization: str | None = Field(default=None, max_length=200)
    role: str | None = Field(default=None, max_length=200)


class AutofillSuggestionOut(BaseModel):
    id: str
    label: str
    kind: Literal["value", "answer", "document"]
    status: Literal["ready", "needs_review", "missing"]
    value: str | None
    source: str | None
    confidence: float
    verified: bool
    reasoning: str
    method: str | None = None
    document_id: str | None = None
    sources: list[SmartAnswerSourceOut] = []


class AutofillSummaryOut(BaseModel):
    detected: int
    ready: int
    needs_review: int
    missing: int
    verified: int
    confidence: float


class AutofillSuggestOut(BaseModel):
    fields: list[AutofillSuggestionOut]
    summary: AutofillSummaryOut
    template: TemplateMatchOut | None
    workflow_id: str
