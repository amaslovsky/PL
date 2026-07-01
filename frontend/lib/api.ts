// Thin fetch helper for the FastAPI backend.
//
// `credentials: "include"` is required so the session cookie is sent with
// every request to `/api/*`. Same-origin requests would include it by
// default, but being explicit documents the dependency.

import type { NdaFormData } from "./types";

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface ChatResponse {
  fields: NdaFormData;
  assistant_message: string;
}

/**
 * Send the conversation to `/api/chat` and return the latest best-guess
 * fields plus the assistant's reply. Throws on network or non-2xx responses
 * with the server's error body when available.
 */
export async function postChat(messages: ChatMessage[]): Promise<ChatResponse> {
  const res = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ messages }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.detail ?? `HTTP ${res.status}`);
  }
  return (await res.json()) as ChatResponse;
}
