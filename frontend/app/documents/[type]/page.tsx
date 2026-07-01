import { listDocuments } from "@/lib/documents/wiring";
import { DocPage, docFor } from "../../_docRender";

/**
 * Build every static page at `next build` so static export can ship a
 * file for every registered slug. Unknown slugs 404 at runtime.
 */
export function generateStaticParams() {
  return listDocuments().map((d) => ({ type: d.id }));
}

export default async function DocumentPage({
  params,
}: {
  params: Promise<{ type: string }>;
}) {
  const { type } = await params;
  const doc = docFor(type);
  return <DocPage doc={doc} />;
}