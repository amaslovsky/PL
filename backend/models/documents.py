"""Pydantic schemas for /api/documents and the document catalog.

The catalog is loaded from project-root `catalog.json` at import time so
the backend has a single source of truth for the templates. The frontend
mirror in `frontend/src/utils/documentConfig.ts` is hand-authored; tests
on both sides assert id-set parity so drift is caught early.

Per-template validators live here too. Today only MNDA has a typed
validator; other types store the LLM-returned shape verbatim.
"""

import json
from enum import Enum
from pathlib import Path

from fastapi import HTTPException
from pydantic import BaseModel, ValidationError


def _find_catalog() -> Path:
    """Resolve catalog.json relative to the source tree.

    Dev layout: `backend/models/documents.py` lives two levels below the
    repo root, so `parent.parent.parent` lands on the project root.

    Bundled layout: `models/documents.py` lives at `/app/models/` and the
    repo-root catalog is copied to `/app/catalog.json`. So `parent.parent`
    is `/app/` and the catalog sits there.

    Both candidates are checked; first hit wins.
    """
    here = Path(__file__).resolve()
    candidates = [
        here.parents[2] / "catalog.json",
        here.parent.parent / "catalog.json",
    ]
    for c in candidates:
        if c.exists():
            return c
    return candidates[0]


CATALOG_PATH = _find_catalog()


def _load_catalog() -> dict[str, dict]:
    """Read catalog.json and produce the canonical id -> entry map.

    The 12 catalog entries collapse to 11 by folding
    `mutual-nda-coverpage.md` under the MNDA standard terms. Slugs map
    to stable ids via SLUG_OVERRIDES so "mutual-nda.md" yields "mnda".
    """
    with open(CATALOG_PATH) as f:
        raw = json.load(f)

    SLUG_OVERRIDES: dict[str, str] = {
        "mutual-nda": "mnda",
    }

    result: dict[str, dict] = {}
    for entry in raw["templates"]:
        filename = entry["filename"]
        if filename == "mutual-nda-coverpage.md":
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
    """Enum of every supported document slug."""

    @classmethod
    def _missing_(cls, value):
        return None

    @classmethod
    def members(cls) -> list[str]:
        return list(DOCUMENT_CATALOG.keys())


DocumentType = Enum(  # type: ignore[misc,assignment]
    "DocumentType",
    {slug: slug for slug in DOCUMENT_CATALOG.keys()},
    type=str,
)


class DocumentSaveRequest(BaseModel):
    document_type: str
    title: str
    data: dict


class DocumentResponse(BaseModel):
    id: int
    document_type: str
    title: str
    form_data: dict
    created_at: str
    updated_at: str


def validate_document_data(document_type: str, data: dict) -> dict:
    """Validate `data` against the per-type Pydantic schema.

    Today only MNDA has a typed validator. Other documents store the
    LLM-returned shape verbatim. Raises HTTPException 422 on schema failure.
    """
    if document_type == "mnda":
        try:
            NdaFields.model_validate(data)
        except ValidationError as e:
            raise HTTPException(status_code=422, detail=json.loads(e.json()))
    return data


# --- MNDA per-type schema ---------------------------------------------------

from typing import Literal  # noqa: E402

from pydantic import Field  # noqa: E402

NdaTermMode = Literal["expires", "continues"]
ConfidentialityTermMode = Literal["years", "perpetuity"]


class Party(BaseModel):
    name: str = ""
    address: str = ""


class NdaTerm(BaseModel):
    mode: NdaTermMode = "expires"
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