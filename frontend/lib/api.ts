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
  /** The template the LLM picked for this turn. */
  document_type: string;
  /** Best-guess fields. Empty `{}` for templates that don't yet have a
   *  live fill pipeline (today: every non-MNDA template). */
  fields: NdaFormData | Record<string, never>;
  assistant_message: string;
}

export interface MeResponse {
  authenticated: boolean;
  user_id?: number;
  email?: string;
}

export interface SavedDocument {
  id: number;
  document_type: string;
  data: NdaFormData;
  created_at: string;
  updated_at: string;
}

async function postJson<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const errBody = await res.json().catch(() => null);
    throw new Error(errBody?.detail ?? `HTTP ${res.status}`);
  }
  return (await res.json()) as T;
}

async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(path, { credentials: "include" });
  if (!res.ok) {
    const errBody = await res.json().catch(() => null);
    throw new Error(errBody?.detail ?? `HTTP ${res.status}`);
  }
  return (await res.json()) as T;
}

/**
 * Send the conversation to `/api/chat` and return the assistant reply.
 * The LLM picks the document type from the user's message; pass an
 * optional `documentType` hint to bias the choice (e.g. after the user
 * has explicitly switched). Throws on network or non-2xx responses with
 * the server's error body when available.
 */
export async function postChat(
  messages: ChatMessage[],
  documentType?: string,
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

/** Sign up + log in. Throws on duplicate email (409) or short password (422). */
export async function signUp(email: string, password: string): Promise<MeResponse> {
  return postJson<MeResponse>("/api/auth/signup", { email, password });
}

/** Log in with existing credentials. Throws on 401. */
export async function signIn(email: string, password: string): Promise<MeResponse> {
  return postJson<MeResponse>("/api/auth/login", { email, password });
}

/** Clear the session cookie. */
export async function logout(): Promise<void> {
  await postJson<{ ok: true }>("/api/auth/logout", {});
}

/** Get the current session, or `{authenticated: false}` (401 → throws). */
export async function getMe(): Promise<MeResponse> {
  return getJson<MeResponse>("/api/auth/me");
}

/** List the signed-in user's saved documents, newest first. */
export async function listSavedDocuments(): Promise<SavedDocument[]> {
  return getJson<SavedDocument[]>("/api/documents");
}

/** Save a new draft. Returns the new document id. */
export async function saveDocument(
  documentType: string,
  data: NdaFormData,
): Promise<{ id: number; document_type: string }> {
  return postJson<{ id: number; document_type: string }>("/api/documents", {
    document_type: documentType,
    data,
  });
}

/** Delete a saved draft by id. Throws on 404. */
export async function deleteSavedDocument(id: number): Promise<void> {
  const res = await fetch(`/api/documents/${id}`, {
    method: "DELETE",
    credentials: "include",
  });
  if (!res.ok) {
    const errBody = await res.json().catch(() => null);
    throw new Error(errBody?.detail ?? `HTTP ${res.status}`);
  }
}