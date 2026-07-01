"""Document registry mirroring frontend/lib/documents/registry.ts.

The FE registry is the source of truth for display data; this module is the
BE's narrow slice (id + display name + wired flag + closest-match slug).
It deliberately does not duplicate descriptions or filenames — those are
FE-only. Keep the id set identical to the FE registry; `test_documents.py`
asserts that.
"""

from dataclasses import dataclass


@dataclass(frozen=True)
class DocEntry:
    id: str
    display_name: str
    wired: bool
    closest_match: str


# Slugs must match frontend/lib/documents/registry.ts exactly.
REGISTRY: dict[str, DocEntry] = {
    "mnda": DocEntry(
        "mnda",
        "Mutual Non-Disclosure Agreement",
        True,
        "mnda",
    ),
    "cloud-service-agreement": DocEntry(
        "cloud-service-agreement",
        "Cloud Service Agreement",
        False,
        "mnda",
    ),
    "service-level-agreement": DocEntry(
        "service-level-agreement",
        "Service Level Agreement",
        False,
        "cloud-service-agreement",
    ),
    "professional-services-agreement": DocEntry(
        "professional-services-agreement",
        "Professional Services Agreement",
        False,
        "mnda",
    ),
    "data-processing-agreement": DocEntry(
        "data-processing-agreement",
        "Data Processing Agreement",
        False,
        "mnda",
    ),
    "design-partner-agreement": DocEntry(
        "design-partner-agreement",
        "Design Partner Agreement",
        False,
        "data-processing-agreement",
    ),
    "software-license-agreement": DocEntry(
        "software-license-agreement",
        "Software License Agreement",
        False,
        "service-level-agreement",
    ),
    "partnership-agreement": DocEntry(
        "partnership-agreement",
        "Partnership Agreement",
        False,
        "mnda",
    ),
    "pilot-agreement": DocEntry(
        "pilot-agreement",
        "Pilot Agreement",
        False,
        "mnda",
    ),
    "business-associate-agreement": DocEntry(
        "business-associate-agreement",
        "Business Associate Agreement",
        False,
        "mnda",
    ),
    "ai-addendum": DocEntry(
        "ai-addendum",
        "AI Addendum",
        False,
        "mnda",
    ),
}


def get_doc(doc_id: str) -> DocEntry | None:
    return REGISTRY.get(doc_id)


def is_supported(doc_id: str) -> bool:
    entry = REGISTRY.get(doc_id)
    return entry is not None and entry.wired


def fallback_message(doc_id: str) -> str:
    """User-facing explanation returned when `document_type` is not wired."""
    entry = REGISTRY.get(doc_id)
    if entry is None:
        return (
            "We don't recognize that document. From the home page you can "
            "pick the Mutual NDA, which we draft today."
        )
    target = REGISTRY.get(entry.closest_match)
    target_name = target.display_name if target else entry.closest_match
    return (
        f"We can't yet field-fill {entry.display_name}. "
        f"The closest document we support is the {target_name} — "
        "open it from the home page to start drafting."
    )