"use client";

import { useEffect, useRef, useState } from "react";
import type { ChatMessage } from "@/services/api";
import { getGreeting, sendMessage } from "@/services/api";
import type { DocId } from "@/utils/documentConfig";
import { getDocument } from "@/utils/documentConfig";
import { MessageBubble, ThinkingBubble } from "./Chat";

const FALLBACK_GREETING =
  "Tell me about the deal — the parties, the effective date, any specifics like governing law or term. I'll pick the right template and start drafting.";

interface ChatInterfaceProps {
  /** Current template slug. Forwarded as context so the LLM stays on the
   *  same template unless the user explicitly switches. */
  documentType: DocId;
  /** Called when the LLM picks a different template than the one we
   *  currently show — lets the parent swap the right pane. */
  onDocumentTypeChange: (next: DocId) => void;
  /** Called with the structured fields when the LLM returns any (MNDA
   *  today; ignored for other templates). The shape matches whatever
   *  the LLM returned — the parent casts to its typed form. */
  onFields: (fields: object) => void;
  /** Reports whether a request is in flight, so the parent can disable
   *  the "Save draft" / "Start over" buttons. */
  onBusyChange?: (busy: boolean) => void;
  /** Reports whether the chat has had at least one user turn, so the
   *  parent can disable the "Start over" button when there's nothing
   *  to reset. */
  onHasMessagesChange?: (hasMessages: boolean) => void;
}

function flattenChatFields(reply: {
  party1Name?: string | null;
  party1Address?: string | null;
  party2Name?: string | null;
  party2Address?: string | null;
  purpose?: string | null;
  effectiveDate?: string | null;
  governingLaw?: string | null;
  jurisdiction?: string | null;
  mndaTermType?: "expires" | "continues" | null;
  mndaTermYears?: number | null;
  confidentialityTermType?: "years" | "perpetuity" | null;
  confidentialityTermYears?: number | null;
  formData?: Record<string, unknown>;
}): Record<string, unknown> {
  if (reply.formData && Object.keys(reply.formData).length > 0) {
    return reply.formData;
  }
  const out: Record<string, unknown> = {};
  if (reply.party1Name || reply.party1Address) {
    out.party1 = { name: reply.party1Name ?? "", address: reply.party1Address ?? "" };
  }
  if (reply.party2Name || reply.party2Address) {
    out.party2 = { name: reply.party2Name ?? "", address: reply.party2Address ?? "" };
  }
  if (reply.purpose) out.purpose = reply.purpose;
  if (reply.effectiveDate) {
    out.effectiveDate = reply.effectiveDate;
    out.effectiveDateDisplay = reply.effectiveDate;
  }
  if (reply.governingLaw) out.governingLaw = reply.governingLaw;
  if (reply.jurisdiction) out.jurisdiction = reply.jurisdiction;
  if (reply.mndaTermType) {
    out.ndaTerm = {
      mode: reply.mndaTermType,
      years: reply.mndaTermYears ?? 1,
    };
  }
  if (reply.confidentialityTermType) {
    out.confidentialityTerm = {
      mode: reply.confidentialityTermType,
      years: reply.confidentialityTermYears ?? 1,
    };
  }
  return out;
}

/**
 * Left column of the Workspace. Owns the chat thread, input, send logic,
 * in-flight ref, and error state. The parent keeps the documentType and
 * form data; this component emits change events back.
 *
 * On first mount, fetches the static greeting from `/api/chat/greeting`
 * so the chat starts with the BE's pick. To reset the chat, the parent
 * bumps a `key` so this component remounts with fresh state.
 */
export function ChatInterface({
  documentType,
  onDocumentTypeChange,
  onFields,
  onBusyChange,
  onHasMessagesChange,
}: ChatInterfaceProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [greeting, setGreeting] = useState<string>(FALLBACK_GREETING);

  const inFlight = useRef(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages]);

  useEffect(() => {
    onBusyChange?.(loading);
  }, [loading, onBusyChange]);

  useEffect(() => {
    onHasMessagesChange?.(messages.length > 0);
  }, [messages.length, onHasMessagesChange]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const g = await getGreeting();
        if (!cancelled && g.response) setGreeting(g.response);
      } catch {
        // Fall back to FALLBACK_GREETING; not fatal.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

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
      const reply = await sendMessage(nextThread);

      // The LLM may pick a different template than the one currently
      // shown. Follow its lead.
      const pickedSlug = reply.documentType ?? reply.suggestedDocument;
      if (pickedSlug && pickedSlug !== documentType) {
        const picked = getDocument(pickedSlug);
        if (picked) onDocumentTypeChange(picked.id);
      }

      const fields = flattenChatFields(reply);
      if (Object.keys(fields).length > 0) {
        onFields(fields);
      }

      setMessages([
        ...nextThread,
        { role: "assistant", content: reply.response },
      ]);
    } catch (e) {
      // Roll back the optimistic user message so a failed turn doesn't
      // sit silently in the thread.
      setMessages(messages);
      setError(e instanceof Error ? e.message : "Chat failed");
    } finally {
      inFlight.current = false;
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <div
        ref={scrollRef}
        className="min-h-0 flex-1 space-y-3 overflow-y-auto rounded-lg border border-zinc-200 bg-white p-5 shadow-sm"
      >
        {messages.length === 0 && (
          <div className="rounded-md border border-dashed border-zinc-200 bg-zinc-50/60 p-4 text-sm leading-relaxed text-zinc-600">
            {greeting}
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
  );
}