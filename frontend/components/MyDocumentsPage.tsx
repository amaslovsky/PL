"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { SavedDocument } from "@/lib/api";
import { listSavedDocuments } from "@/lib/api";
import { listDocuments } from "@/lib/documents/registry";
import { MyDocumentsList } from "./MyDocumentsList";

/**
 * Client component for `/my-documents`. Fetches the user's saved
 * drafts on mount; renders an empty state if there are none.
 */
export function MyDocumentsPage() {
  const [docs, setDocs] = useState<SavedDocument[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const labelByType = useMemo(() => {
    const map = new Map<string, string>();
    for (const d of listDocuments()) map.set(d.id, d.displayName);
    return map;
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const out = await listSavedDocuments();
        if (!cancelled) setDocs(out);
      } catch (e) {
        if (!cancelled)
          setError(e instanceof Error ? e.message : "Failed to load drafts");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main className="mx-auto max-w-4xl p-8">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight text-[#032147]">
          My drafts
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-zinc-600">
          Saved drafts persist for the lifetime of the server. The
          database resets on restart, so use these to pick up where you
          left off — not for long-term storage.
        </p>
      </header>

      {error && (
        <p className="mt-6 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      {docs === null && !error && (
        <p className="mt-8 text-sm text-zinc-500">Loading…</p>
      )}

      {docs !== null && docs.length === 0 && (
        <div className="mt-8 rounded-lg border border-dashed border-zinc-300 bg-white p-8 text-center text-sm text-zinc-600">
          <p>You haven&apos;t saved any drafts yet.</p>
          <p className="mt-2">
            Open a{" "}
            <Link
              href="/documents/mnda"
              className="font-medium text-[#209dd7] underline"
            >
              Mutual NDA
            </Link>{" "}
            and use the &ldquo;Save draft&rdquo; or &ldquo;Download PDF&rdquo;
            button.
          </p>
        </div>
      )}

      {docs !== null && docs.length > 0 && (
        <MyDocumentsList
          docs={docs}
          labelByType={labelByType}
          onDeleted={(id) => setDocs((cur) => (cur ?? []).filter((d) => d.id !== id))}
        />
      )}
    </main>
  );
}