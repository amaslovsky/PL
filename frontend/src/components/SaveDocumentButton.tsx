"use client";

interface SaveDocumentButtonProps {
  /** Disabled while the chat is busy or a save is already in flight. */
  busy: boolean;
  /** Disabled when there's nothing to save (no chat yet). */
  hasContent: boolean;
  /** Async save handler — Workspace owns the actual `saveDocument` call. */
  onSave: () => void | Promise<void>;
}

/**
 * Save-draft button used in the Workspace header. Disabled when the chat
 * is busy or when there's no chat thread yet. Status text (Saved / Save
 * failed / etc.) is rendered by the parent because it's workspace-level
 * state, not button-local.
 */
export function SaveDocumentButton({ busy, hasContent, onSave }: SaveDocumentButtonProps) {
  return (
    <button
      type="button"
      onClick={() => void onSave()}
      disabled={busy || !hasContent}
      className="rounded border border-zinc-300 bg-white px-3 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
    >
      Save draft
    </button>
  );
}