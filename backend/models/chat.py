"""Pydantic schemas for /api/chat."""

from typing import Literal

from pydantic import BaseModel, Field


class Message(BaseModel):
    role: Literal["user", "assistant", "system"]
    content: str


class ChatRequest(BaseModel):
    messages: list[Message]


class ChatResponse(BaseModel):
    """One assistant turn: freeform response + the document the LLM picked.

    The shape is open-ended so a single response can carry any per-doc
    field the LLM wants to surface. MNDA fields live alongside the
    generic `response` text.
    """

    response: str = ""

    # Document type detection
    documentType: str | None = None
    suggestedDocument: str | None = None

    # Common fields
    purpose: str | None = None
    effectiveDate: str | None = None
    governingLaw: str | None = None
    jurisdiction: str | None = None

    # Mutual NDA specific
    mndaTermType: Literal["expires", "continues"] | None = None
    mndaTermYears: int | None = Field(default=None, ge=1, le=99)
    confidentialityTermType: Literal["years", "perpetuity"] | None = None
    confidentialityTermYears: int | None = Field(default=None, ge=1, le=99)
    modifications: str | None = None

    # Cloud Service Agreement
    providerName: str | None = None
    customerName: str | None = None
    subscriptionPeriod: str | None = None
    technicalSupport: str | None = None

    # Party info (used by most templates)
    party1Name: str | None = None
    party1Address: str | None = None
    party2Name: str | None = None
    party2Address: str | None = None

    # Free-form bag for anything else
    formData: dict = Field(default_factory=dict)