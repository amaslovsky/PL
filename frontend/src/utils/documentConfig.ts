// Document registry for the chat surface (PL-8).
//
// This file is the data layer that the chat workspace reads. It is pure
// data so unit tests don't pull in the React tree, and it avoids
// importing project-root `catalog.json` (which Next.js cannot resolve
// from inside `frontend/`).
//
// The catalog values are typed in here directly; `catalog.json` at the
// project root remains the source of truth for licensing/provenance and
// is the file that PL-7+ should continue to use as the Common Paper
// canonical catalog. The BE loads catalog.json at import time
// (backend/models/documents.py) and applies SLUG_OVERRIDES (e.g.
// `mutual-nda` -> `mnda`) so the BE id set mirrors this registry. Drift
// between the two is caught by `registry.test.ts`'s BE_IDS parity
// assertion — keep both in sync.

export type DocId = string;

export interface DocumentEntry {
  id: DocId;
  displayName: string;
  /** One-line description the LLM uses to pick which document the user
   *  is asking for. */
  description: string;
  /** MNDA has a cover page file in addition to the standard terms;
   *  other entries keep them undefined until they're wired. */
  coverPageFilename?: string;
  standardTermsFilename?: string;
}

// Order mirrors catalog.json at the project root. The MNDA Cover Page is
// folded under MNDA — the MNDA workspace reads both files together, so
// the user never addresses it independently.
const ENTRIES: DocumentEntry[] = [
  {
    id: "mnda",
    displayName: "Mutual Non-Disclosure Agreement",
    description: "Bidirectional confidential information exchange between two parties.",
    coverPageFilename: "mutual-nda-coverpage.md",
    standardTermsFilename: "mutual-nda.md",
  },
  {
    id: "cloud-service-agreement",
    displayName: "Cloud Service Agreement",
    description:
      "Buying and selling cloud software or SaaS products, with standard terms referenced from a signed Cover Page.",
  },
  {
    id: "service-level-agreement",
    displayName: "Service Level Agreement",
    description:
      "Uptime, support, and service credits layered onto a Cloud Service Agreement.",
  },
  {
    id: "professional-services-agreement",
    displayName: "Professional Services Agreement",
    description:
      "Engaging a vendor to deliver services, with standard terms referenced from a signed Cover Page and SOW.",
  },
  {
    id: "data-processing-agreement",
    displayName: "Data Processing Agreement",
    description:
      "Processing of personal data by a service provider on behalf of a customer.",
  },
  {
    id: "design-partner-agreement",
    displayName: "Design Partner Agreement",
    description:
      "Engaging an early-design-partner customer for feedback in exchange for concessions.",
  },
  {
    id: "software-license-agreement",
    displayName: "Software License Agreement",
    description:
      "Licensing on-premise or downloadable software, with standard terms referenced from a signed Cover Page.",
  },
  {
    id: "partnership-agreement",
    displayName: "Partnership Agreement",
    description:
      "Non-equity business partnerships, with standard terms referenced from a signed Cover Page.",
  },
  {
    id: "pilot-agreement",
    displayName: "Pilot Agreement",
    description:
      "Short-term test of a product or service before a longer-term deal.",
  },
  {
    id: "business-associate-agreement",
    displayName: "Business Associate Agreement",
    description:
      "HIPAA-required terms for engagements involving protected health information.",
  },
  {
    id: "ai-addendum",
    displayName: "AI Addendum",
    description:
      "Supplemental terms for AI services and AI-generated outputs, designed to sit alongside a CSA or SLA.",
  },
];

export const REGISTRY: DocumentEntry[] = ENTRIES;

export function getDocument(id: DocId): DocumentEntry | undefined {
  return REGISTRY.find((d) => d.id === id);
}

export function listDocuments(): DocumentEntry[] {
  return REGISTRY;
}