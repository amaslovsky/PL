"""Document registry mirroring frontend/lib/documents/registry.ts.

Both FE and BE share the same id set and one-line descriptions — the BE
prompt uses the description to let the LLM pick which document the user
is asking for. Keep the id set identical to the FE registry; tests assert
that.
"""

from dataclasses import dataclass


@dataclass(frozen=True)
class DocEntry:
    id: str
    display_name: str
    description: str


# Slugs must match frontend/lib/documents/registry.ts exactly.
REGISTRY: dict[str, DocEntry] = {
    "mnda": DocEntry(
        "mnda",
        "Mutual Non-Disclosure Agreement",
        "Bidirectional confidential information exchange between two parties.",
    ),
    "cloud-service-agreement": DocEntry(
        "cloud-service-agreement",
        "Cloud Service Agreement",
        "Buying and selling cloud software or SaaS products, with standard terms referenced from a signed Cover Page.",
    ),
    "service-level-agreement": DocEntry(
        "service-level-agreement",
        "Service Level Agreement",
        "Uptime, support, and service credits layered onto a Cloud Service Agreement.",
    ),
    "professional-services-agreement": DocEntry(
        "professional-services-agreement",
        "Professional Services Agreement",
        "Engaging a vendor to deliver services, with standard terms referenced from a signed Cover Page and SOW.",
    ),
    "data-processing-agreement": DocEntry(
        "data-processing-agreement",
        "Data Processing Agreement",
        "Processing of personal data by a service provider on behalf of a customer.",
    ),
    "design-partner-agreement": DocEntry(
        "design-partner-agreement",
        "Design Partner Agreement",
        "Engaging an early-design-partner customer for feedback in exchange for concessions.",
    ),
    "software-license-agreement": DocEntry(
        "software-license-agreement",
        "Software License Agreement",
        "Licensing on-premise or downloadable software, with standard terms referenced from a signed Cover Page.",
    ),
    "partnership-agreement": DocEntry(
        "partnership-agreement",
        "Partnership Agreement",
        "Non-equity business partnerships, with standard terms referenced from a signed Cover Page.",
    ),
    "pilot-agreement": DocEntry(
        "pilot-agreement",
        "Pilot Agreement",
        "Short-term test of a product or service before a longer-term deal.",
    ),
    "business-associate-agreement": DocEntry(
        "business-associate-agreement",
        "Business Associate Agreement",
        "HIPAA-required terms for engagements involving protected health information.",
    ),
    "ai-addendum": DocEntry(
        "ai-addendum",
        "AI Addendum",
        "Supplemental terms for AI services and AI-generated outputs, designed to sit alongside a CSA or SLA.",
    ),
}


def get_doc(doc_id: str) -> DocEntry | None:
    return REGISTRY.get(doc_id)


def is_known(doc_id: str) -> bool:
    return doc_id in REGISTRY