import { redirect } from "next/navigation";
import { listDocuments } from "@/utils/documentConfig";

/**
 * Back-compat redirect for every registered slug. The chat surface
 * lives at `/`; the LLM picks the template from the user's message,
 * so per-doc URLs are no longer needed. Old links from saved drafts
 * or bookmarks land here and redirect to the home chat workspace.
 * We enumerate the registry at build time so static export ships
 * one HTML file per slug (unknown slugs 404 via the catch-all).
 */
export default function DocumentRedirect(): never {
  redirect("/");
}

export function generateStaticParams() {
  return listDocuments().map((d) => ({ type: d.id }));
}
