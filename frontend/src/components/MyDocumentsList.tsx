"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { SavedDocument } from "@/services/api";
import { deleteSavedDocument } from "@/services/api";

interface Props {
  docs: SavedDocument[];
  labelByType: Map<string, string>;
  /** Notified when a row is removed so the parent can drop it from state. */
  onDeleted: (id: number) => void;
}

/**
 * Client list of the signed-in user's saved drafts. Each row exposes a
 * delete control. Delete removes the row server-side, calls `onDeleted`
 * so the parent updates state, and refreshes the route so the BE list
 * re-renders. Re-opening a draft in its workspace is out of scope for
 * PL-7 — the My drafts page is a list-and-clean-up surface.
 */
export function MyDocumentsList({ docs, labelByType, onDeleted }: Props) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onDelete(id: number) {
    setBusyId(id);
    setError(null);
    try {
      await deleteSavedDocument(id);
      onDeleted(id);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Delete failed");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div>
      {error && (
        <p className="mt-2 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}
      <ul className="mt-8 space-y-3">
      {docs.map((d) => {
        const name = labelByType.get(d.document_type) ?? d.document_type;
        const formData = d.form_data as {
          party1?: { name?: string };
          party2?: { name?: string };
        };
        const p1 = formData?.party1?.name?.trim() || d.title || "Untitled draft";
        const p2 = formData?.party2?.name?.trim();
        const title = p2 ? `${p1} & ${p2}` : p1;
        return (
          <li
            key={d.id}
            className="flex items-start justify-between gap-4 rounded-lg border border-zinc-200 bg-white p-4 shadow-sm"
          >
            <div>
              <h2 className="text-base font-semibold text-zinc-900">{title}</h2>
              <p className="mt-1 text-sm text-zinc-600">
                {name} · saved {new Date(d.created_at + "Z").toLocaleString()}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <button
                type="button"
                onClick={() => onDelete(d.id)}
                disabled={busyId === d.id}
                className="rounded border border-zinc-300 bg-white px-3 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
              >
                {busyId === d.id ? "Deleting…" : "Delete"}
              </button>
            </div>
          </li>
        );
      })}
    </ul>
    </div>
  );
}