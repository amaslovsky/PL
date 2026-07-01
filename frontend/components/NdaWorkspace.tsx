"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { ChatMessage } from "@/lib/api";
import { postChat, saveDocument } from "@/lib/api";
import type { NdaFormData } from "@/lib/types";
import { fillFullNda } from "@/lib/fillTemplate";
import { MessageBubble, ThinkingBubble } from "./Chat";
import { NdaPreview } from "./NdaPreview";
import { DownloadPdfButton } from "./DownloadPdfButton";

interface NdaWorkspaceProps {
  /** Raw cover-page markdown, read from disk by the server component. */
  coverPageRaw: string;
  /** Raw standard-terms markdown. */
  standardTermsRaw: string;
}

/**
 * Top-level client component for the Mutual NDA prototype.
 *
 * Two-column layout: a chat assistant on the left (user + assistant bubbles,
 * input + send) and the live preview + download-PDF button on the right.
 *
 * The chat is the only way to populate fields. Each user turn hits
 * `POST /api/chat`, which returns the current best-guess values for every
 * MNDA field. The returned `fields` flow into `fillFullNda` so the preview
 * updates immediately.
 *
 * A `Save draft` button captures the current `data` to the user's
 * document list. `DownloadPdfButton` also calls save internally so the
 * PDF the user downloads is the same one they can revisit later.
 */
export function NdaWorkspace({ coverPageRaw, standardTermsRaw }: NdaWorkspaceProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [data, setData] = useState<NdaFormData>(EMPTY_FORM_DATA);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Synchronous in-flight flag. The Send button is also disabled by
  // `loading`, but `loading` flips only after React re-renders — using a
  // ref prevents a double-click from racing two requests.
  const inFlight = useRef(false);
  // Same pattern for the save path: a Save draft / Download PDF click
  // mid-save would otherwise produce duplicate rows.
  const savingRef = useRef(false);

  const filledMarkdown = useMemo(
    () => fillFullNda(coverPageRaw, standardTermsRaw, data),
    [coverPageRaw, standardTermsRaw, data],
  );

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
      const reply = await postChat(nextThread, "mnda");
      if (reply.fields) setData(reply.fields);
      setMessages([...nextThread, { role: "assistant", content: reply.assistant_message }]);
    } catch (e) {
      // Roll the user message back out so the failed turn doesn't sit in
      // the chat without ever being seen by the LLM.
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
      await saveDocument("mnda", data);
      setSaveStatus("Saved");
    } catch (e) {
      setSaveStatus(e instanceof Error ? e.message : "Save failed");
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto grid h-screen max-w-7xl grid-cols-1 gap-6 overflow-hidden p-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <div className="flex min-h-0 flex-col gap-4">
        <header className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">
              Mutual NDA
            </h1>
            <p className="mt-1 text-sm leading-relaxed text-zinc-500">
              Tell the assistant about the two parties and the deal. The
              preview updates as fields are filled in.
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
              Try starting with: <span className="italic">&ldquo;Acme Inc.
              and BetaCo are evaluating a partnership, effective June 30,
              2026, governed by Delaware law.&rdquo;</span>
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
            placeholder="Describe the parties and the deal…"
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
            Preview
          </h2>
          <DownloadPdfButton data={data} onBeforeDownload={saveDraft} />
        </div>
        <p className="rounded border border-[#ecad0a]/40 bg-[#ecad0a]/10 px-3 py-2 text-xs text-[#032147]">
          Draft template only — not legal advice. Subject to legal review
          before use.
        </p>
        <div className="min-h-0 flex-1 overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-sm">
          <NdaPreview markdown={filledMarkdown} />
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