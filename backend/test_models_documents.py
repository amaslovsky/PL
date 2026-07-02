"""Tests for models.documents: catalog loading, slug overrides, validators."""

import pytest
from fastapi import HTTPException

from models.documents import DOCUMENT_CATALOG, is_known, validate_document_data


def test_catalog_has_11_entries():
    """catalog.json has 12 rows; cover page folds under MNDA to yield 11."""
    assert len(DOCUMENT_CATALOG) == 11


def test_catalog_ids_are_unique():
    assert len(DOCUMENT_CATALOG) == len(set(DOCUMENT_CATALOG.keys()))


def test_catalog_contains_mnda_with_mnda_slug():
    """The MNDA filename is 'mutual-nda.md' but the canonical id must be 'mnda'."""
    assert "mnda" in DOCUMENT_CATALOG
    assert DOCUMENT_CATALOG["mnda"]["displayName"] == "Mutual Non-Disclosure Agreement"


def test_catalog_ids_match_expected_set():
    expected = {
        "mnda",
        "cloud-service-agreement",
        "service-level-agreement",
        "professional-services-agreement",
        "data-processing-agreement",
        "design-partner-agreement",
        "software-license-agreement",
        "partnership-agreement",
        "pilot-agreement",
        "business-associate-agreement",
        "ai-addendum",
    }
    assert set(DOCUMENT_CATALOG.keys()) == expected


def test_is_known_accepts_real_slug():
    assert is_known("mnda") is True
    assert is_known("cloud-service-agreement") is True


def test_is_known_rejects_unknown():
    assert is_known("bogus") is False
    assert is_known("") is False


def test_validate_mnda_accepts_full_payload():
    payload = {
        "party1": {"name": "Acme", "address": ""},
        "party2": {"name": "BetaCo", "address": ""},
        "purpose": "discussions",
        "effectiveDate": "2026-06-30",
        "effectiveDateDisplay": "June 30, 2026",
        "ndaTerm": {"mode": "expires", "years": 1},
        "confidentialityTerm": {"mode": "years", "years": 1},
        "governingLaw": "Delaware",
        "jurisdiction": "New Castle",
    }
    assert validate_document_data("mnda", payload) is payload


def test_validate_mnda_rejects_bad_data():
    # `ndaTerm.years` has ge=1, le=99 — out of range triggers 422.
    with pytest.raises(HTTPException) as exc:
        validate_document_data(
            "mnda",
            {
                "party1": {"name": "A", "address": ""},
                "party2": {"name": "B", "address": ""},
                "purpose": "x",
                "effectiveDate": "2026-06-30",
                "effectiveDateDisplay": "June 30, 2026",
                "ndaTerm": {"mode": "expires", "years": 999},
                "confidentialityTerm": {"mode": "years", "years": 1},
                "governingLaw": "Delaware",
                "jurisdiction": "New Castle",
            },
        )
    assert exc.value.status_code == 422


def test_validate_passes_through_other_types():
    """Non-MNDA types don't yet have typed validators — they store as-is."""
    assert validate_document_data("cloud-service-agreement", {"anything": 1}) == {"anything": 1}