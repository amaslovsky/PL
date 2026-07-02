import { readFileSync } from "node:fs";
import path from "node:path";
import { listDocuments } from "@/utils/documentConfig";
import { AuthGate } from "@/components/AuthGate";
import { Workspace } from "@/components/Workspace";

/**
 * Home page. The chat workspace is the landing experience for signed-in
 * users — the LLM picks which template to draft based on the user's
 * message. Today only MNDA has a live fill pipeline + PDF; other
 * templates render their standard-terms markdown in the preview pane.
 *
 * For signed-out users `<AuthGate>` redirects to `/login`, so the
 * sign-in screen is the default landing page. Auth state lives in the
 * browser (the root layout avoids `headers()` to keep `output: "export"`
 * working), so the redirect fires client-side after hydration.
 *
 * Template markdown is read here at build time so the static export
 * ships the markdown inline; the client only sees the strings.
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
    <AuthGate>
      <Workspace
        standardTermsByDocId={standardTermsByDocId}
        coverPageByDocId={coverPageByDocId}
      />
    </AuthGate>
  );
}