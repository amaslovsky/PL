"""AI chat: pick a template from the user's message and draft it.

The LLM is given the full catalog of templates and asked to:
1. Pick the best-matching `document_type` for the user's request.
2. Return a `fields` snapshot (today only MNDA has live fields; for
   every other template the model returns `{}` and the chat surfaces
   the standard terms on the right pane).
3. Continue the drafting conversation with focused questions.
"""

from typing import Literal

from litellm import completion
from pydantic import BaseModel, Field

from .documents import REGISTRY

MODEL = "openrouter/openai/gpt-oss-120b"
EXTRA_BODY = {"provider": {"order": ["cerebras"]}}

# Literal so empty strings can't slip into `mode`.
NdaTermMode = Literal["expires", "continues"]
ConfidentialityTermMode = Literal["years", "perpetuity"]


class Party(BaseModel):
    name: str = ""
    address: str = ""


class NdaTerm(BaseModel):
    mode: NdaTermMode = "expires"
    # ge=1 prevents "0 year(s)" rendering.
    years: int = Field(default=1, ge=1, le=99)


class ConfidentialityTerm(BaseModel):
    mode: ConfidentialityTermMode = "years"
    years: int = Field(default=1, ge=1, le=99)


class NdaFields(BaseModel):
    party1: Party = Field(default_factory=Party)
    party2: Party = Field(default_factory=Party)
    purpose: str = ""
    effectiveDate: str = ""
    effectiveDateDisplay: str = ""
    ndaTerm: NdaTerm = Field(default_factory=NdaTerm)
    confidentialityTerm: ConfidentialityTerm = Field(
        default_factory=ConfidentialityTerm
    )
    governingLaw: str = ""
    jurisdiction: str = ""


class ChatTurn(BaseModel):
    """Single assistant turn: chosen template, current best-guess fields,
    plus a chat reply."""

    document_type: str
    fields: dict = Field(default_factory=dict)
    assistant_message: str = ""


def _catalog_block() -> str:
    lines = ["Available templates (use the id exactly as written):"]
    for entry in REGISTRY.values():
        lines.append(f"- {entry.id} — {entry.display_name}: {entry.description}")
    return "\n".join(lines)


def _system_prompt(hint: str | None) -> str:
    catalog = _catalog_block()
    hint_line = (
        f"\nThe user has already committed to template: {hint}. Stay on that "
        "template unless they explicitly switch."
        if hint
        else "\nPick the template that best matches what the user is asking for."
    )
    return f"""\
You are a legal-document drafting assistant for Prelegal.

{catalog}

{hint_line}

Every turn you return a JSON object with three fields:
- `document_type` — the slug of the template you picked (e.g. "mnda").
- `fields` — a best-guess snapshot of the cover-page fields for that
  template. For template `mnda` return the full NdaFields shape (party1,
  party2, purpose, effectiveDate, effectiveDateDisplay, ndaTerm,
  confidentialityTerm, governingLaw, jurisdiction). For every other
  template return an empty object {{}} — the chat will continue but the
  live preview is not yet built for those.
- `assistant_message` — your reply to the user (one or two short
  sentences, no markdown, no lists).

MNDA field guide (only when document_type is "mnda"):
- party1.name, party1.address — first party's legal name and notice address
- party2.name, party2.address — second party's legal name and notice address
- purpose — one sentence describing why the parties are sharing
  confidential information
- effectiveDate — agreement's effective date in ISO format YYYY-MM-DD
- effectiveDateDisplay — same date as a human-readable string like
  "June 30, 2026"
- ndaTerm.mode — "expires" if the MNDA ends after a fixed term,
  "continues" if it runs until terminated
- ndaTerm.years — integer years, used only when mode is "expires"
- confidentialityTerm.mode — "years" for a fixed protection period,
  "perpetuity" for forever
- confidentialityTerm.years — integer years, used only when mode is "years"
- governingLaw — U.S. state whose laws govern
- jurisdiction — venue (city/county and state)

Behavior:
- Be a helpful drafting assistant. Ask one or two focused questions per
  turn to fill gaps.
- Never invent party names, addresses, dates, or jurisdictions — if the
  user has not given them, leave the field empty and ask for it.
- For effectiveDate, once the user names a date, set both effectiveDate
  (ISO) and effectiveDateDisplay (long form) consistently.
- If the user changes topic mid-conversation (e.g. "actually, I need a
  CSA instead"), switch `document_type` and start fresh on `fields`.
"""


def chat(messages: list[dict], hint: str | None = None) -> ChatTurn:
    """Send the conversation to the LLM and parse the structured response.

    `messages` is a list of {"role": ..., "content": ...} dicts. `hint`,
    when provided, biases the LLM toward the named template (used by
    the FE when the user has explicitly picked one). The system prompt
    is generated from the BE registry on every call so the catalog is
    always in sync.
    """
    system_prompt = _system_prompt(hint)
    full_messages = [{"role": "system", "content": system_prompt}] + list(messages)

    response = completion(
        model=MODEL,
        messages=full_messages,
        response_format=ChatTurn,
        reasoning_effort="low",
        extra_body=EXTRA_BODY,
    )
    raw = response.choices[0].message.content or ""
    return ChatTurn.model_validate_json(raw)