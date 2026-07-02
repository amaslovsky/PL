"use client";

import type { DocId } from "@/utils/documentConfig";
import { getDocument } from "@/utils/documentConfig";
import type { NdaFormData } from "@/types/nda";
import { NDAPreview } from "./NdaPreview";
import { StandardTermsPreview } from "./StandardTermsPreview";

interface DocumentPreviewProps {
  documentType: DocId;
  /** Filled MNDA form data. Ignored for non-MNDA documents. */
  data: NdaFormData;
  /** Pre-rendered MNDA markdown (cover + standard terms). */
  filledNdaMarkdown: string;
  /** Standard-terms markdown for the chosen template (empty string if not loaded). */
  standardTermsMarkdown: string;
}

/**
 * Right column of the Workspace. Dispatches between:
 *
 * - **MNDA**: live fill rendered via `<NDAPreview>` (cover + standard
 *   terms, fields substituted in).
 * - **Other templates**: their standard-terms markdown rendered via
 *   `<StandardTermsPreview>` — no live fields today.
 *
 * The dispatcher lives here so Workspace stays a thin composer.
 */
export function DocumentPreview({
  documentType,
  filledNdaMarkdown,
  standardTermsMarkdown,
}: DocumentPreviewProps) {
  const isMnda = documentType === "mnda";
  const doc = getDocument(documentType);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <div className="min-h-0 flex-1 overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-sm">
        {isMnda ? (
          <NDAPreview markdown={filledNdaMarkdown} />
        ) : standardTermsMarkdown ? (
          <StandardTermsPreview markdown={standardTermsMarkdown} />
        ) : (
          <div className="flex h-full items-center justify-center p-8 text-sm text-zinc-500">
            {doc?.displayName ?? "This document"} doesn&apos;t have standard
            terms loaded yet.
          </div>
        )}
      </div>
    </div>
  );
}