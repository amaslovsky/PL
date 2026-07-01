"use client";

import type { ChatMessage } from "@/lib/api";

/** Renders one chat bubble. Used by every workspace's chat column. */
export function MessageBubble({ m }: { m: ChatMessage }) {
  const isUser = m.role === "user";
  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[85%] whitespace-pre-wrap rounded-lg px-3 py-2 text-sm leading-relaxed ${
          isUser
            ? "bg-[#209dd7] text-white"
            : "border border-zinc-200 bg-zinc-50 text-zinc-800"
        }`}
      >
        {m.content}
      </div>
    </div>
  );
}

/** Placeholder bubble shown while a request is in flight. */
export function ThinkingBubble() {
  return (
    <div className="flex justify-start">
      <div className="max-w-[80%] rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-500">
        Thinking…
      </div>
    </div>
  );
}