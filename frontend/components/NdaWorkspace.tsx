"use client";

import { useMemo, useState } from "react";
import type { NdaFormData } from "@/lib/types";
import { buildDefaultNdaFormData } from "@/lib/defaultValues";
import { fillFullNda } from "@/lib/fillTemplate";
import { NdaForm } from "./NdaForm";
import { NdaPreview } from "./NdaPreview";
import { DownloadPdfButton } from "./DownloadPdfButton";

interface NdaWorkspaceProps {
  /** Raw cover-page markdown, read from disk by the server component. */
  coverPageRaw: string;
  /** Raw standard-terms markdown. */
  standardTermsRaw: string;
}

/**
 * Top-level client component for the Mutual NDA prototype. Owns form
 * state, recomputes the filled markdown on every change, and renders
 * the two-column layout (form + preview) with a download-PDF action.
 */
export function NdaWorkspace({ coverPageRaw, standardTermsRaw }: NdaWorkspaceProps) {
  const [data, setData] = useState<NdaFormData>(() => buildDefaultNdaFormData());

  const filledMarkdown = useMemo(
    () => fillFullNda(coverPageRaw, standardTermsRaw, data),
    [coverPageRaw, standardTermsRaw, data],
  );

  const update = (patch: Partial<NdaFormData>) => {
    setData((prev) => ({ ...prev, ...patch }));
  };

  return (
    <div className="mx-auto grid min-h-screen max-w-7xl grid-cols-1 gap-6 p-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <div className="space-y-4">
        <header className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">
              Mutual NDA
            </h1>
            <p className="text-sm text-zinc-500">
              Fill in the parties and terms. The preview updates live. Download
              the completed document when ready.
            </p>
          </div>
        </header>
        <NdaForm data={data} onChange={update} />
      </div>

      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
            Preview
          </h2>
          <DownloadPdfButton data={data} />
        </div>
        <NdaPreview markdown={filledMarkdown} />
      </div>
    </div>
  );
}