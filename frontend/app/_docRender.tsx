import { readFileSync } from "node:fs";
import path from "node:path";
import { notFound } from "next/navigation";
import type { DocumentEntry } from "@/lib/documents/registry";
import { getDocument } from "@/lib/documents/wiring";

/**
 * Server-side renderer for any document route. Reads template markdown
 * from disk for wired docs; renders the closest-match workspace for the
 * rest. Throws `notFound()` if the registry doesn't know the id.
 */
export function DocPage({ doc }: { doc: DocumentEntry }) {
  if (doc.wired) {
    if (!doc.Workspace) {
      throw new Error(`wired doc ${doc.id} has no Workspace component`);
    }
    if (!doc.coverPageFilename || !doc.standardTermsFilename) {
      throw new Error(`wired doc ${doc.id} is missing template filenames`);
    }
    const cwd = process.cwd();
    const coverPageRaw = readFileSync(
      path.join(cwd, "templates", doc.coverPageFilename),
      "utf8",
    );
    const standardTermsRaw = readFileSync(
      path.join(cwd, "templates", doc.standardTermsFilename),
      "utf8",
    );
    const W = doc.Workspace;
    return <W coverPageRaw={coverPageRaw} standardTermsRaw={standardTermsRaw} />;
  }
  if (!doc.Unsupported) {
    throw new Error(`unwired doc ${doc.id} has no Unsupported component`);
  }
  const U = doc.Unsupported;
  return <U doc={doc} />;
}

/**
 * Resolve a slug to a registry entry; throws notFound() for unknown ids.
 * Use this from server components that own the routing.
 */
export function docFor(slug: string): DocumentEntry {
  const doc = getDocument(slug);
  if (!doc) notFound();
  return doc;
}
