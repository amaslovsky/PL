import { getDocument } from "@/lib/documents/wiring";
import { DocPage } from "../_docRender";

export default function MutualNdaPage() {
  const doc = getDocument("mnda");
  if (!doc) throw new Error("mnda missing from registry");
  return <DocPage doc={doc} />;
}