import { readFileSync } from "node:fs";
import path from "node:path";
import { Workspace } from "@/components/Workspace";
import { listDocuments } from "@/lib/documents/registry";

/**
 * Home page. The chat workspace is the landing experience — the LLM
 * picks which template to draft based on the user's message. Today only
 * MNDA has a live fill pipeline + PDF; other templates render their
 * standard-terms markdown in the preview pane. The page is a server
 * component that reads every registered template file from disk at
 * build time so the static export ships them inline.
 */
export default function Home() {
  const cwd = process.cwd();
  const standardTermsByDocId: Record<string, string> = {};
  const coverPageByDocId: Record<string, string> = {};
  for (const doc of listDocuments()) {
    if (doc.standardTermsFilename) {
      try {
        standardTermsByDocId[doc.id] = readFileSync(
          path.join(cwd, "templates", doc.standardTermsFilename),
          "utf8",
        );
      } catch {
        // File missing on disk — Workspace falls back to the
        // "no standard terms loaded" placeholder for this id.
      }
    }
    if (doc.coverPageFilename) {
      try {
        coverPageByDocId[doc.id] = readFileSync(
          path.join(cwd, "templates", doc.coverPageFilename),
          "utf8",
        );
      } catch {
        // Same as above; only MNDA has a cover page today.
      }
    }
  }

  return (
    <Workspace
      standardTermsByDocId={standardTermsByDocId}
      coverPageByDocId={coverPageByDocId}
    />
  );
}