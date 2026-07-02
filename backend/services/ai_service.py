"""AI service: send the conversation to the LLM, parse the structured response."""

import os

from litellm import completion

from models.chat import ChatResponse
from models.documents import DOCUMENT_CATALOG

MODEL = "openrouter/openai/gpt-oss-120b"
EXTRA_BODY = {"provider": {"order": ["cerebras"]}}

GREETING = (
    "Hi! Tell me about the deal you're working on — the parties, the "
    "effective date, anything specific. I'll draft a standard agreement "
    "and we can iterate from there."
)


def greeting() -> dict:
    """Return the static greeting without an LLM call."""
    return {
        "response": GREETING,
        "documentType": "mutual_nda",
        "suggestedDocument": "mutual_nda",
    }


def _catalog_block() -> str:
    lines = ["Available templates (use the id exactly as written):"]
    for entry in DOCUMENT_CATALOG.values():
        lines.append(f"- {entry['id']} — {entry['displayName']}: {entry['description']}")
    return "\n".join(lines)


def _system_prompt() -> str:
    """System prompt: instructs the LLM to return a JSON object matching the
    ChatResponse schema with both a freeform `response` and the per-doc
    fields it has collected so far.
    """
    catalog = _catalog_block()
    return f"""\
You are a legal-document drafting assistant.

{catalog}

Every turn you return a JSON object with these fields:
- response — your reply to the user (one or two short sentences, no markdown, no lists)
- documentType — the slug of the template the user is working on (e.g. "mnda")
- suggestedDocument — usually the same as documentType, unless the user
  has implied a different template
- formData — the cover-page field snapshot for the current document
  (party names, dates, governing law, etc.)
- For mutual NDA, populate party1Name, party1Address, party2Name,
  party2Address, purpose, effectiveDate (ISO YYYY-MM-DD), governingLaw,
  jurisdiction, mndaTermType ("expires" | "continues"),
  mndaTermYears (1-99), confidentialityTermType ("years" | "perpetuity"),
  confidentialityTermYears (1-99)

Behavior:
- Be a helpful drafting assistant. Ask one or two focused questions per
  turn to fill gaps.
- Never invent party names, addresses, dates, or jurisdictions — if the
  user has not given them, leave the field null and ask for it.
- If the user changes topic mid-conversation (e.g. "actually, I need a
  CSA instead"), switch documentType and clear formData.
"""


def chat(messages: list[dict]) -> ChatResponse:
    """Send the conversation to the LLM and parse the structured response.

    `messages` is a list of {"role": ..., "content": ...} dicts. Returns
    a `ChatResponse` with the LLM's chosen document type, freeform reply,
    and best-guess field snapshot.
    """
    if not os.getenv("OPENROUTER_API_KEY"):
        raise RuntimeError("OPENROUTER_API_KEY is not set")

    system_prompt = _system_prompt()
    full_messages = [{"role": "system", "content": system_prompt}] + list(messages)

    response = completion(
        model=MODEL,
        messages=full_messages,
        response_format=ChatResponse,
        reasoning_effort="low",
        extra_body=EXTRA_BODY,
    )
    raw = response.choices[0].message.content or ""
    return ChatResponse.model_validate_json(raw)