import { readFileSync } from "node:fs";
import path from "node:path";
import { NdaWorkspace } from "@/components/NdaWorkspace";

// The MNDA prototype only needs the cover page + standard terms. The
// filesystem is the sole place these files are read; everything downstream
// receives them as raw strings.
function readTemplate(filename: string): string {
  const filePath = path.join(process.cwd(), "templates", filename);
  return readFileSync(filePath, "utf8");
}

export default function MutualNdaPage() {
  const coverPageRaw = readTemplate("mutual-nda-coverpage.md");
  const standardTermsRaw = readTemplate("mutual-nda.md");

  return <NdaWorkspace coverPageRaw={coverPageRaw} standardTermsRaw={standardTermsRaw} />;
}