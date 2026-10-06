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


class MappingOut(BaseModel):
    matches: list[FieldMatchOut]


class ContactIn(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    email: EmailStr
    message: str = Field(min_length=10, max_length=5000)
    website: str = Field(default="", max_length=200)  # honeypot

