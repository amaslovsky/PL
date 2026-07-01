"""AI chat: turn a user message into structured MNDA fields.

The model is asked to act as a Mutual NDA drafting assistant. Every turn
returns a full snapshot of the cover-page fields it has learned so far plus
a short user-facing reply. The frontend uses the field snapshot to drive the
live preview; the reply becomes the next chat bubble.
"""

from typing import Literal

from litellm import completion
from pydantic import BaseModel, Field

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
    """Single assistant turn: current best-guess fields plus a chat reply."""

    fields: NdaFields = Field(default_factory=NdaFields)
    assistant_message: str = ""


SYSTEM_PROMPT = """\
You are drafting a Mutual Non-Disclosure Agreement (MNDA) between two parties.

Field guide (all values live in a single structured object you return):
- party1.name, party1.address — first party's legal name and notice address
- party2.name, party2.address — second party's legal name and notice address
- purpose — one sentence describing why the parties are sharing confidential
  information, e.g. "Evaluating whether to enter into a business relationship
  with the other party."
- effectiveDate — the agreement's effective date in ISO format YYYY-MM-DD
- effectiveDateDisplay — same date as a human-readable string like
  "June 30, 2026"
- ndaTerm.mode — "expires" if the MNDA ends after a fixed term,
  "continues" if it runs until terminated
- ndaTerm.years — integer years, used only when mode is "expires"
- confidentialityTerm.mode — "years" for a fixed protection period,
  "perpetuity" for forever
- confidentialityTerm.years — integer years, used only when mode is "years"
- governingLaw — U.S. state whose laws govern, e.g. "Delaware"
- jurisdiction — venue (city/county and state), e.g.
  "New Castle County, Delaware"

Behavior:
- Be a helpful drafting assistant. Ask one or two focused questions per turn
  to fill gaps. Keep replies to two or three short sentences — no markdown,
  no lists.
- For every turn, return ALL fields. Use empty strings for string fields
  you have not learned yet. For the enum fields `ndaTerm.mode` and
  `confidentialityTerm.mode`, you must always return one of the valid
  options — use the default ("expires" / "years") until the user indicates
  otherwise.
- Never invent party names, addresses, dates, or jurisdictions — if the
  user has not given them, leave the field empty and ask for it.
- For effectiveDate, once the user names a date, set both effectiveDate
  (ISO YYYY-MM-DD) and effectiveDateDisplay (long form like "June 30,
  2026") consistently.
- If the user supplies a complete NDA, confirm the summary in one sentence
  and do not ask further questions.
"""


def chat(messages: list[dict]) -> ChatTurn:
    """Send the conversation to the LLM and parse the structured response.

    `messages` is a list of {"role": ..., "content": ...} dicts. The system
    prompt is prepended automatically.
    """
    full_messages = [{"role": "system", "content": SYSTEM_PROMPT}] + list(messages)

    response = completion(
        model=MODEL,
        messages=full_messages,
        response_format=ChatTurn,
        reasoning_effort="low",
        extra_body=EXTRA_BODY,
    )
    raw = response.choices[0].message.content or ""
    return ChatTurn.model_validate_json(raw)
