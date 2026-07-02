"""Pydantic schemas for /api/documents and the document catalog.

The catalog is loaded from project-root `catalog.json` at import time so
the backend has a single source of truth for the templates. The frontend
mirror in `frontend/lib/documents/registry.ts` is hand-authored; tests on
both sides assert id-set parity so drift is caught early.

Per-template validators live here too. Today only MNDA has a typed
validator; other types store the LLM-returned shape verbatim.
"""

import json
from enum import Enum
from pathlib import Path
from typing import Literal

from fastapi import HTTPException
from pydantic import BaseModel, Field, ValidationError


# Locate catalog.json at the project root: backend/models/ -> backend/ -> project root.
CATALOG_PATH = Path(__file__).resolve().parent.parent.parent / "catalog.json"


def _load_catalog() -> dict[str, dict]:
    """Read catalog.json and produce the canonical id -> entry map.

    The 12 catalog entries collapse to 11 by folding
    `mutual-nda-coverpage.md` under the MNDA standard terms. Slugs map
    to stable ids via SLUG_OVERRIDES so "mutual-nda.md" yields "mnda"
    (matching the existing FE/BE registries).
    """
    with open(CATALOG_PATH) as f:
        raw = json.load(f)

    # Filename -> stable id overrides. Keep this list small; only covers
    # templates where the catalog filename doesn't match the legacy id.
    SLUG_OVERRIDES: dict[str, str] = {
        "mutual-nda": "mnda",
    }

    result: dict[str, dict] = {}
    for entry in raw["templates"]:
        filename = entry["filename"]
        if filename == "mutual-nda-coverpage.md":
            # Fold into MNDA: the chat workspace treats both files as
            # one document.
            continue
        raw_slug = filename.removesuffix(".md")
        slug = SLUG_OVERRIDES.get(raw_slug, raw_slug)
        result[slug] = {
            "id": slug,
            "displayName": entry["name"],
            "description": entry["description"],
            "filename": filename,
        }
    return result


DOCUMENT_CATALOG: dict[str, dict] = _load_catalog()


class DocumentType(str, Enum):
    """Enum of every supported document slug.

    Members are derived from DOCUMENT_CATALOG so adding a row to
    catalog.json automatically widens this enum.
    """

    @classmethod
    def _missing_(cls, value):
        # Accept any value; routes call is_known() to return 400 on
        # unknown slugs rather than raising ValueError here.
        return None

    @classmethod
    def members(cls) -> list[str]:
        return list(DOCUMENT_CATALOG.keys())


# Build the enum members from the canonical catalog so the set of legal
# values exactly matches DOCUMENT_CATALOG.
DocumentType = Enum(  # type: ignore[misc,assignment]
    "DocumentType",
    {slug: slug for slug in DOCUMENT_CATALOG.keys()},
    type=str,
)


class DocumentSaveRequest(BaseModel):
    document_type: str
    data: dict


class DocumentResponse(BaseModel):
    id: int
    document_type: str
    data: dict
    created_at: str
    updated_at: str


def validate_document_data(document_type: str, data: dict) -> dict:
    """Validate `data` against the per-type Pydantic schema.

    Today only MNDA has a typed validator. Other documents store the
    LLM-returned shape verbatim (matches prelegal). Raises HTTPException
    422 on schema failure.
    """
    if document_type == "mnda":
        try:
            NdaFields.model_validate(data)
        except ValidationError as e:
            raise HTTPException(status_code=422, detail=json.loads(e.json()))
    return data


# --- MNDA per-type schema ---------------------------------------------------

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


def is_known(document_type: str) -> bool:
    return document_type in DOCUMENT_CATALOG