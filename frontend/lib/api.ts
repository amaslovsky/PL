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
  /** Best-guess fields. `null` when the BE returned the static fallback
   *  for an unsupported document type (no LLM call). */
  fields: NdaFormData | null;
  assistant_message: string;
}

/**
 * Send the conversation to `/api/chat` and return the assistant reply.
 * `documentType` defaults to "mnda" for back-compat; pass a registry id
 * (e.g. "csa") to address a different document. Throws on network or
 * non-2xx responses with the server's error body when available.
 */
export async function postChat(
  messages: ChatMessage[],
  documentType: string = "mnda",
): Promise<ChatResponse> {
  const res = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ messages, document_type: documentType }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.detail ?? `HTTP ${res.status}`);
  }
  return (await res.json()) as ChatResponse;
}