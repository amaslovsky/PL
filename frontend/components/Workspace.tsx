"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { ChatMessage } from "@/lib/api";
import { postChat, saveDocument } from "@/lib/api";
import type { DocId, DocumentEntry } from "@/lib/documents/registry";
import { getDocument } from "@/lib/documents/registry";
import type { NdaFormData } from "@/lib/types";
import { fillFullNda } from "@/lib/fillTemplate";
import { MessageBubble, ThinkingBubble } from "./Chat";
import { NdaPreview } from "./NdaPreview";
import { DownloadPdfButton } from "./DownloadPdfButton";

const GREETING =
  "Tell me about the deal — the parties, the effective date, any specifics like governing law or term. I'll pick the right template and start drafting.";

interface StandardTerms {
  byDocId: Record<DocId, string>;
}

interface WorkspaceProps {
  /** Markdown body for every entry that has a standard-terms file. The
   *  home page reads all 11 at build time and ships this dictionary so
   *  the client can render the chosen template's standard terms in the
   *  preview pane (today: only MNDA). */
  standardTermsByDocId: StandardTerms["byDocId"];
  /** Cover-page markdown for documents that have one (only MNDA today). */
  coverPageByDocId: Partial<Record<DocId, string>>;
}

/**
 * Top-level chat | preview workspace for `/` (and the redirects from
 * `/documents/<id>` and `/mutual-nda`). Two columns:
 *
 * - **Left**: chat. The LLM picks the document type from the user's
 *   message and the workspace tracks the current choice. The user can
 *   switch documents mid-conversation by mentioning a different one.
 * - **Right**: preview. For MNDA this is the live fillTemplate +
 *   NdaPreview + Download PDF. For every other template the standard
 *   terms are shown plain as markdown.
 *
 * `send()` passes the current `documentType` to `/api/chat` as a hint
 * so the LLM stays on the same template unless the user explicitly
 * switches.
 */
export function Workspace({ standardTermsByDocId, coverPageByDocId }: WorkspaceProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [documentType, setDocumentType] = useState<DocId>("mnda");
  const [data, setData] = useState<NdaFormData>(EMPTY_FORM_DATA);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const inFlight = useRef(false);
  const savingRef = useRef(false);

  const doc: DocumentEntry | undefined = getDocument(documentType);
  const isMnda = documentType === "mnda";

  const filledMarkdown = useMemo(() => {
    if (!isMnda) return "";
    const cover = coverPageByDocId.mnda ?? "";
    const terms = standardTermsByDocId.mnda ?? "";
    return fillFullNda(cover, terms, data);
  }, [isMnda, coverPageByDocId.mnda, standardTermsByDocId.mnda, data]);

  const standardTerms = standardTermsByDocId[documentType] ?? "";

  const scrollRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages]);

  async function send(): Promise<void> {
    const trimmed = input.trim();
    if (!trimmed || inFlight.current) return;

    const userMessage: ChatMessage = { role: "user", content: trimmed };
    const nextThread = [...messages, userMessage];
    setMessages(nextThread);
    setInput("");
    setError(null);
    inFlight.current = true;
    setLoading(true);

    try {
      const reply = await postChat(nextThread, documentType);
      // The LLM may pick a different template than the one currently
      // shown (e.g. user asked for an NDA then changed their mind and
      // asked about a CSA). Follow its lead.
      if (reply.document_type && reply.document_type !== documentType) {
        const picked = getDocument(reply.document_type);
        if (picked) setDocumentType(picked.id);
      }
      if (isMnda && reply.fields && Object.keys(reply.fields).length > 0) {
        setData(reply.fields as NdaFormData);
      }
      setMessages([...nextThread, { role: "assistant", content: reply.assistant_message }]);
    } catch (e) {
      setMessages(messages);
      const msg = e instanceof Error ? e.message : "Chat failed";
      setError(msg);
    } finally {
      inFlight.current = false;
      setLoading(false);
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
        await saveDocument("mnda", data);
      }
      setSaveStatus(isMnda ? "Saved" : "Saved chat");
    } catch (e) {
      setSaveStatus(e instanceof Error ? e.message : "Save failed");
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
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
            <button
              type="button"
              onClick={saveDraft}
              disabled={loading || saving}
              className="rounded border border-zinc-300 bg-white px-3 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
            >
              Save draft
            </button>
            <button
              type="button"
              onClick={() => {
                setMessages([]);
                setData(EMPTY_FORM_DATA);
                setDocumentType("mnda");
                setError(null);
                setSaveStatus(null);
              }}
              disabled={loading || messages.length === 0}
              className="rounded border border-zinc-300 bg-white px-3 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
            >
              Start over
            </button>
          </div>
        </header>

        <div
          ref={scrollRef}
          className="min-h-0 flex-1 space-y-3 overflow-y-auto rounded-lg border border-zinc-200 bg-white p-5 shadow-sm"
        >
          {messages.length === 0 && (
            <div className="rounded-md border border-dashed border-zinc-200 bg-zinc-50/60 p-4 text-sm leading-relaxed text-zinc-600">
              {GREETING}
            </div>
          )}
          {messages.map((m) => (
            <MessageBubble key={`${m.role}:${m.content}`} m={m} />
          ))}
          {loading && <ThinkingBubble />}
          {error && (
            <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          )}
        </div>

        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            void send();
          }}
        >
          <textarea
            className="min-h-[60px] flex-1 resize-none rounded border border-zinc-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#209dd7]"
            placeholder="Describe the deal, or ask to switch templates…"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void send();
              }
            }}
            disabled={loading}
          />
          <button
            type="submit"
            disabled={loading || input.trim().length === 0}
            className="self-end rounded bg-[#753991] px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
          >
            Send
          </button>
        </form>
      </div>

      <div className="flex min-h-0 flex-col gap-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
            {isMnda ? "Preview" : "Standard terms"}
          </h2>
          {isMnda && <DownloadPdfButton data={data} onBeforeDownload={saveDraft} />}
        </div>
        <p className="rounded border border-[#ecad0a]/40 bg-[#ecad0a]/10 px-3 py-2 text-xs text-[#032147]">
          Draft template only — not legal advice. Subject to legal review
          before use.
        </p>
        <div className="min-h-0 flex-1 overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-sm">
          {isMnda ? (
            <NdaPreview markdown={filledMarkdown} />
          ) : standardTerms ? (
            <NdaPreview markdown={standardTerms} />
          ) : (
            <div className="flex h-full items-center justify-center p-8 text-sm text-zinc-500">
              {doc?.displayName ?? "This document"} doesn&apos;t have
              standard terms loaded yet.
            </div>
          )}
        </div>
      </div>
    </div>
  );
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