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
    <div className="mx-auto grid h-screen max-w-7xl grid-cols-1 gap-6 overflow-hidden p-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <div className="flex min-h-0 flex-col gap-4">
        <header className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">
              Mutual NDA
            </h1>
            <p className="mt-1 text-sm leading-relaxed text-zinc-500">
              Fill in the parties and terms. The preview updates live. Download
              the completed document when ready.
            </p>
          </div>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
          <NdaForm data={data} onChange={update} />
        </div>
      </div>

      <div className="flex min-h-0 flex-col gap-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
            Preview
          </h2>
          <DownloadPdfButton data={data} />
        </div>
        <div className="min-h-0 flex-1 overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-sm">
          <NdaPreview markdown={filledMarkdown} />
        </div>
      </div>
    </div>
  );
}