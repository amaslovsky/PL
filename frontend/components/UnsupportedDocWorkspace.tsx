"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { ChatMessage } from "@/lib/api";
import { postChat } from "@/lib/api";
import type { DocumentEntry } from "@/lib/documents/registry";
import { getDocument } from "@/lib/documents/registry";
import { MessageBubble, ThinkingBubble } from "./Chat";

interface Props {
  doc: DocumentEntry;
}

const STATIC_GREETING =
  "Hi — I can talk through this document, but I can't yet fill in fields for it. " +
  "Open the closest match on the right to draft a related agreement.";

/**
 * Workspace shown for documents the chat surface cannot yet fill.
 * Mirrors the MNDA workspace's two-column shell so the user gets the
 * same visual cue about which screen they're on. The right pane is a
 * static notice pointing at the closest wired document; the chat on
 * the left still works — every reply is the BE's static fallback.
 */
export function UnsupportedDocWorkspace({ doc }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: "assistant", content: STATIC_GREETING },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inFlight = useRef(false);

  const closest = getDocument(doc.closestMatch);
  const closestHref = closest ? `/documents/${closest.id}` : "/";

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
      const reply = await postChat(nextThread, doc.id);
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

  return (
    <div className="mx-auto grid h-screen max-w-7xl grid-cols-1 gap-6 overflow-hidden p-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <div className="flex min-h-0 flex-col gap-4">
        <header className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">
              {doc.displayName}
            </h1>
            <p className="mt-1 text-sm leading-relaxed text-zinc-500">
              {doc.description}
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              setMessages([{ role: "assistant", content: STATIC_GREETING }]);
              setError(null);
            }}
            disabled={loading}
            className="rounded border border-zinc-300 bg-white px-3 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
          >
            Reset chat
          </button>
        </header>

        <div
          ref={scrollRef}
          className="min-h-0 flex-1 space-y-3 overflow-y-auto rounded-lg border border-zinc-200 bg-white p-5 shadow-sm"
        >
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
            placeholder="Ask about this document…"
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
        <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
          Closest match
        </h2>
        <div className="flex-1 rounded-lg border border-dashed border-[#ecad0a] bg-[#ecad0a]/5 p-5 text-sm leading-relaxed text-zinc-800">
          <p className="font-semibold text-[#032147]">
            We don&apos;t yet draft {doc.displayName} end-to-end.
          </p>
          <p className="mt-2">
            The nearest document we can fill in today is{" "}
            {closest ? (
              <Link
                href={closestHref}
                className="font-medium text-[#209dd7] underline hover:opacity-80"
              >
                {closest.displayName}
              </Link>
            ) : (
              <span className="font-medium">{doc.closestMatch}</span>
            )}
            . Open it to start drafting.
          </p>
          <p className="mt-4 text-xs text-zinc-600">
            The full list of supported documents lives on the home page.
          </p>
        </div>
      </div>
    </div>
  );
}