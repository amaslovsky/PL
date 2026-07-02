import { MyDocumentsPage } from "@/components/MyDocumentsPage";

/**
 * "My drafts" landing. The actual data fetch + render is a client
 * component so the static export keeps working (`headers()` would
 * force dynamic rendering and break `output: "export"`).
 */
export default function Page() {
  return <MyDocumentsPage />;
}