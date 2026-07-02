// Thin fetch helpers for the FastAPI backend.
//
// `credentials: "include"` is required so the session cookie is sent
// with every request to `/api/*`. Same-origin requests would include
// it by default, but being explicit documents the dependency.
//
// Matches prelegal's API surface:
//   /api/auth/{signup,signin,signout,me}
//   /api/documents
//   /api/chat/{greeting,message}

import type { NdaFormData } from "@/types/nda";

export interface User {
  id: number;
  email: string;
}

export interface AuthResponse {
  user: User;
  message: string;
}

export interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

/** Response from /api/chat/{greeting,message}. Open-ended: the LLM may
 *  return whichever per-doc fields it has collected so far. The chat UI
 *  mostly reads `response` and `documentType`. */
export interface ChatResponse {
  response: string;
  documentType?: string | null;
  suggestedDocument?: string | null;
  // MNDA-specific
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
  // Free-form bag for anything else.
  formData?: Record<string, unknown>;
}

export interface SavedDocument {
  id: number;
  document_type: string;
  title: string;
  form_data: NdaFormData | Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface DocumentListResponse {
  documents: SavedDocument[];
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

/** Get the static greeting without invoking the LLM. */
export async function getGreeting(): Promise<ChatResponse> {
  return getJson<ChatResponse>("/api/chat/greeting");
}

/** Send a message to the LLM. Returns the chosen document type and the
 *  current best-guess field snapshot alongside the freeform response. */
export async function sendMessage(messages: ChatMessage[]): Promise<ChatResponse> {
  return postJson<ChatResponse>("/api/chat/message", { messages });
}

/** Sign up. Throws on duplicate email (400) or short password (400). */
export async function signUp(email: string, password: string): Promise<AuthResponse> {
  return postJson<AuthResponse>("/api/auth/signup", { email, password });
}

/** Sign in. Throws on 401. */
export async function signIn(email: string, password: string): Promise<AuthResponse> {
  return postJson<AuthResponse>("/api/auth/signin", { email, password });
}

/** Sign out (clears the auth cookie). */
export async function signOut(): Promise<{ message: string }> {
  return postJson<{ message: string }>("/api/auth/signout", {});
}

/** Get the current user, or throws 401. */
export async function getMe(): Promise<User> {
  return getJson<User>("/api/auth/me");
}

/** List the signed-in user's saved drafts (newest first). */
export async function listSavedDocuments(): Promise<DocumentListResponse> {
  return getJson<DocumentListResponse>("/api/documents");
}

/** Save a new draft. Returns the new document id. */
export async function saveDocument(
  documentType: string,
  title: string,
  data: NdaFormData,
): Promise<{ id: number; document_type: string; title: string }> {
  return postJson<{ id: number; document_type: string; title: string }>(
    "/api/documents",
    { document_type: documentType, title, data },
  );
}

/** Delete a saved draft by id. */
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