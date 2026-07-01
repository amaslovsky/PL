// Document registry for the multi-doc chat surface (PL-6).
//
// This file is the data layer that every server + client component in the
// multi-doc surface reads. It is pure data so unit tests don't pull in
// the React tree, and it avoids importing project-root `catalog.json`
// (which Next.js cannot resolve from inside `frontend/`).
//
// The catalog values are typed in here directly; `catalog.json` at the
// project root remains the source of truth for licensing/provenance and
// is the file that PL-7+ should continue to use as the Common Paper
// canonical catalog.

import type { ComponentType } from "react";

export type DocId = string;

export interface NdaWorkspaceProps {
  coverPageRaw: string;
  standardTermsRaw: string;
}

export interface UnsupportedDocWorkspaceProps {
  doc: DocumentEntry;
}

export interface DocumentEntry {
  id: DocId;
  displayName: string;
  description: string;
  coverPageFilename?: string;
  standardTermsFilename?: string;
  wired: boolean;
  closestMatch: DocId;
  Workspace?: ComponentType<NdaWorkspaceProps>;
  Unsupported?: ComponentType<UnsupportedDocWorkspaceProps>;
}

// Order mirrors catalog.json at the project root. The MNDA Cover Page is
// folded under MNDA — the MNDA workspace reads both files together, so
// the user never addresses it independently.
const ENTRIES: DocumentEntry[] = [
  {
    id: "mnda",
    displayName: "Mutual Non-Disclosure Agreement",
    description:
      "Common Paper standard Mutual Non-Disclosure Agreement (MNDA) — version 1.0. " +
      "Standard terms for bidirectional confidential information exchange, intended to " +
      "be used together with the Mutual NDA Cover Page.",
    coverPageFilename: "mutual-nda-coverpage.md",
    standardTermsFilename: "mutual-nda.md",
    wired: true,
    closestMatch: "mnda",
  },
  {
    id: "cloud-service-agreement",
    displayName: "Cloud Service Agreement",
    description:
      "Common Paper standard Cloud Service Agreement (CSA) — an easy-to-use agreement " +
      "for buying and selling cloud software and SaaS products. Standard terms " +
      "incorporated by reference into a signed CSA Cover Page and Order Forms.",
    wired: false,
    closestMatch: "mnda",
  },
  {
    id: "service-level-agreement",
    displayName: "Service Level Agreement",
    description:
      "Common Paper standard Service Level Agreement (SLA) — version 2.0. Designed to " +
      "be used together with the Cloud Service Agreement to define uptime, support and " +
      "service credits.",
    wired: false,
    closestMatch: "cloud-service-agreement",
  },
  {
    id: "professional-services-agreement",
    displayName: "Professional Services Agreement",
    description:
      "Common Paper standard Professional Services Agreement (PSA) — version 1.0. " +
      "Standard terms for engaging a vendor to deliver services, incorporated by " +
      "reference into a signed PSA Cover Page and Statements of Work.",
    wired: false,
    closestMatch: "mnda",
  },
  {
    id: "data-processing-agreement",
    displayName: "Data Processing Agreement",
    description:
      "Common Paper standard Data Processing Agreement (DPA) — version 1.0. Standard " +
      "terms governing the processing of personal data by a service provider on behalf " +
      "of a customer, incorporated by reference into a signed DPA Cover Page.",
    wired: false,
    closestMatch: "mnda",
  },
  {
    id: "design-partner-agreement",
    displayName: "Design Partner Agreement",
    description:
      "Common Paper standard Design Partner Agreement — version 1.0. Standard terms " +
      "for engaging an early-design-partner customer to provide product feedback in " +
      "exchange for pricing concessions or other benefits.",
    wired: false,
    closestMatch: "data-processing-agreement",
  },
  {
    id: "software-license-agreement",
    displayName: "Software License Agreement",
    description:
      "Common Paper standard Software License Agreement — version 1.0. Standard terms " +
      "for licensing on-premise or downloadable software, incorporated by reference " +
      "into a signed Software License Agreement Cover Page and Order Forms.",
    wired: false,
    closestMatch: "service-level-agreement",
  },
  {
    id: "partnership-agreement",
    displayName: "Partnership Agreement",
    description:
      "Common Paper standard Partnership Agreement — version 1.0. Standard terms for " +
      "non-equity business partnerships, incorporated by reference into a signed " +
      "Partnership Agreement Cover Page and Statements of Work.",
    wired: false,
    closestMatch: "mnda",
  },
  {
    id: "pilot-agreement",
    displayName: "Pilot Agreement",
    description:
      "Common Paper standard Pilot Agreement. Short-term contract that allows a " +
      "prospective customer to test a product or service before committing to a " +
      "longer-term deal (such as a CSA or Software License Agreement).",
    wired: false,
    closestMatch: "mnda",
  },
  {
    id: "business-associate-agreement",
    displayName: "Business Associate Agreement",
    description:
      "Common Paper standard Business Associate Agreement (BAA) — version 1.0. " +
      "Standard terms required under HIPAA for engagements involving protected health " +
      "information, incorporated by reference into a signed BAA Cover Page.",
    wired: false,
    closestMatch: "mnda",
  },
  {
    id: "ai-addendum",
    displayName: "AI Addendum",
    description:
      "Common Paper standard AI Addendum — version 1.0. Supplemental terms governing " +
      "the use of AI services and AI-generated outputs, designed to be incorporated " +
      "into a Cloud Service Agreement or Software License Agreement.",
    wired: false,
    closestMatch: "mnda",
  },
];

export const REGISTRY: DocumentEntry[] = ENTRIES;

export function getDocument(id: DocId): DocumentEntry | undefined {
  return REGISTRY.find((d) => d.id === id);
}

export function listDocuments(): DocumentEntry[] {
  return REGISTRY;
}

/**
 * Colloquial aliases for the chat's freeform text fallback. Lower-cased
 * keys; values are DocIds that must exist in REGISTRY.
 */
export const ALIASES: Record<string, DocId> = {
  nda: "mnda",
  mnda: "mnda",
  confidentiality: "mnda",
  mou: "mnda",
  cloud: "cloud-service-agreement",
  csa: "cloud-service-agreement",
  saas: "cloud-service-agreement",
  sla: "service-level-agreement",
  services: "professional-services-agreement",
  sow: "professional-services-agreement",
  psa: "professional-services-agreement",
  consulting: "professional-services-agreement",
  gdpr: "data-processing-agreement",
  dpa: "data-processing-agreement",
  privacy: "data-processing-agreement",
  design: "design-partner-agreement",
  partner: "design-partner-agreement",
  license: "software-license-agreement",
  partnership: "partnership-agreement",
  pa: "partnership-agreement",
  pilot: "pilot-agreement",
  beta: "pilot-agreement",
  trial: "pilot-agreement",
  hipaa: "business-associate-agreement",
  baa: "business-associate-agreement",
  phi: "business-associate-agreement",
  ai: "ai-addendum",
};