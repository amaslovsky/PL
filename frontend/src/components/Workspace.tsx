"use client";

import { useMemo, useRef, useState } from "react";
import { saveDocument } from "@/services/api";
import type { DocId } from "@/utils/documentConfig";
import { getDocument } from "@/utils/documentConfig";
import type { NdaFormData } from "@/types/nda";
import { fillFullNda } from "@/utils/fillTemplate";
import { ChatInterface } from "./ChatInterface";
import { DocumentDownload } from "./DocumentDownload";
import { DocumentPreview } from "./DocumentPreview";
import { SaveDocumentButton } from "./SaveDocumentButton";

interface WorkspaceProps {
  /** Markdown body for every entry that has a standard-terms file. The
   *  home page reads all 11 at build time and ships this dictionary so
   *  the client can render the chosen template's standard terms in the
   *  preview pane (today: only MNDA). */
  standardTermsByDocId: Record<DocId, string>;
  /** Cover-page markdown for documents that have one (only MNDA today). */
  coverPageByDocId: Partial<Record<DocId, string>>;
}

const EMPTY_FORM_DATA: NdaFormData = {
  party1: { name: "", address: "" },
  party2: { name: "", address: "" },
  purpose: "",
  effectiveDate: "",
  effectiveDateDisplay: "",
  ndaTerm: { mode: "expires", years: 1 },
  confidentialityTerm: { mode: "years", years: 1 },
  governingLaw: "",
  jurisdiction: "",
};

/**
 * Top-level chat | preview workspace for `/` (and the redirects from
 * `/documents/<id>` and `/mutual-nda`). Two columns:
 *
 * - **Left**: `<ChatInterface>` — chat thread, input, send logic.
 * - **Right**: `<DocumentPreview>` — live MNDA fill, or any other
 *   template's standard-terms markdown, depending on what the LLM picks.
 *
 * The Workspace owns the documentType, the form data, the save logic,
 * and the reset button. Children report state changes via callbacks.
 * "Start over" bumps `chatKey` so the ChatInterface remounts with a
 * fresh thread.
 */
export function Workspace({ standardTermsByDocId, coverPageByDocId }: WorkspaceProps) {
  const [documentType, setDocumentType] = useState<DocId>("mnda");
  const [data, setData] = useState<NdaFormData>(EMPTY_FORM_DATA);
  const [chatKey, setChatKey] = useState(0);
  const [saveStatus, setSaveStatus] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [chatBusy, setChatBusy] = useState(false);
  const [hasMessages, setHasMessages] = useState(false);

  const savingRef = useRef(false);

  const doc = getDocument(documentType);
  const isMnda = documentType === "mnda";

  const filledNdaMarkdown = useMemo(() => {
    const cover = coverPageByDocId.mnda ?? "";
    const terms = standardTermsByDocId.mnda ?? "";
    return fillFullNda(cover, terms, data);
  }, [coverPageByDocId.mnda, standardTermsByDocId.mnda, data]);

  const standardTermsMarkdown = standardTermsByDocId[documentType] ?? "";

  function handleFields(fields: object): void {
    if (Object.keys(fields).length > 0) {
      setData(fields as unknown as NdaFormData);
    }
  }

  async function saveDraft(): Promise<void> {
    if (savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    setSaveStatus("Saving…");
    try {
      // Today only MNDA stores a typed payload. For other templates the
      // payload is the chat thread (saved as `{}`); saving is skipped
      // because the form data isn't meaningful yet.
      if (isMnda) {
        const party1Name = data.party1.name || "Untitled";
        await saveDocument("mnda", party1Name, data);
      }
      setSaveStatus(isMnda ? "Saved" : "Saved chat");
    } catch (e) {
      setSaveStatus(e instanceof Error ? e.message : "Save failed");
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }

  function startOver(): void {
    setData(EMPTY_FORM_DATA);
    setDocumentType("mnda");
    setSaveStatus(null);
    setChatKey((k) => k + 1);
  }

  return (
    <div className="mx-auto grid h-[calc(100vh-4rem)] max-w-7xl grid-cols-1 gap-6 overflow-hidden p-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <div className="flex min-h-0 flex-col gap-4">
        <header className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">
              {doc?.displayName ?? "Drafting assistant"}
            </h1>
            <p className="mt-1 text-sm leading-relaxed text-zinc-500">
              {doc?.description ??
                "I draft legal agreements from a chat. Tell me what you need."}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {saveStatus && (
              <span className="text-xs text-zinc-500">{saveStatus}</span>
            )}
            <SaveDocumentButton
              busy={chatBusy || saving}
              hasContent={hasMessages}
              onSave={saveDraft}
            />
            <button
              type="button"
              onClick={startOver}
              disabled={chatBusy || !hasMessages}
              className="rounded border border-zinc-300 bg-white px-3 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
            >
              Start over
            </button>
          </div>
        </header>

        <ChatInterface
          key={chatKey}
          documentType={documentType}
          onDocumentTypeChange={setDocumentType}
          onFields={handleFields}
          onBusyChange={setChatBusy}
          onHasMessagesChange={setHasMessages}
        />
      </div>

      <div className="flex min-h-0 flex-col gap-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
            {isMnda ? "Preview" : "Standard terms"}
          </h2>
          {isMnda && <DocumentDownload data={data} onBeforeDownload={saveDraft} />}
        </div>
        <p className="rounded border border-[#ecad0a]/40 bg-[#ecad0a]/10 px-3 py-2 text-xs text-[#032147]">
          Draft template only — not legal advice. Subject to legal review
          before use.
        </p>
        <DocumentPreview
          documentType={documentType}
          data={data}
          filledNdaMarkdown={filledNdaMarkdown}
          standardTermsMarkdown={standardTermsMarkdown}
        />
      </div>
    </div>
  );
}