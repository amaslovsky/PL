"use client";

import { useState } from "react";
import { pdf } from "@react-pdf/renderer";
import { NdaPdfDocument } from "@/pdf/NdaPdfDocument";
import type { NdaFormData } from "@/lib/types";

interface DownloadPdfButtonProps {
  data: NdaFormData;
}

/**
 * Generates a PDF on click and triggers a browser download. The PDF is
 * built client-side via `@react-pdf/renderer`'s `pdf().toBlob()` — no
 * server round-trip.
 */
export function DownloadPdfButton({ data }: DownloadPdfButtonProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleClick = async () => {
    setBusy(true);
    setError(null);
    try {
      const blob = await pdf(<NdaPdfDocument data={data} />).toBlob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename(data);
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      // Revoke on the next tick so the browser has a chance to start the
      // download. Revoking synchronously can race the blob read on some
      // browsers.
      setTimeout(() => URL.revokeObjectURL(url), 0);
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "Failed to generate PDF");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        onClick={handleClick}
        disabled={busy}
        className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300"
      >
        {busy ? "Generating…" : "Download PDF"}
      </button>
      {error && (
        <span className="text-xs text-red-600" role="alert">
          {error}
        </span>
      )}
    </div>
  );
}

/**
 * Build a download filename that distinguishes counterparties and dates
 * so successive drafts don't overwrite each other. Falls back to
 * "draft-<date>.pdf" when both party names are empty.
 */
function filename(data: NdaFormData): string {
  const slugify = (s: string) =>
    s
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "draft";
  const p1 = slugify(data.party1.name);
  const p2 = slugify(data.party2.name);
  const date = data.effectiveDate || "undated";
  return `mutual-nda-${p1}-and-${p2}-${date}.pdf`;
}