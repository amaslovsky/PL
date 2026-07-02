"""Pydantic schemas for the /api/chat surface."""

from pydantic import BaseModel, Field


class Message(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    messages: list[Message]
    # Optional: the LLM picks the document from the user's message. The
    # client can pass a hint to bias the LLM's choice, but it's never
    # required.
    document_type: str | None = None


class ChatResponse(BaseModel):
    """One assistant turn: chosen template, current best-guess fields, reply.

    `fields` is `dict` (not per-type submodels) so the LLM can return an
    empty object for templates that don't yet have a live fill pipeline.
    Per-doc validation for persistence is handled separately in
    `models.documents.validate_document_data`.
    """

    document_type: str
    fields: dict = Field(default_factory=dict)
    assistant_message: str = ""