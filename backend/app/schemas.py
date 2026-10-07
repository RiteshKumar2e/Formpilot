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
        if not any(c.isalpha() for c in v) or not any(c.isdigit() for c in v):
            raise ValueError("Include at least one letter and one number.")
        return v


class SignInIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=256)


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


class ProfileFieldOut(BaseModel):
    key: str
    label: str
    value: str
    confidence: float
    source_filename: str


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

