"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface NdaPreviewProps {
  /** The filled NDA markdown (cover page + horizontal rule + standard terms). */
  markdown: string;
}

/**
 * Renders the filled NDA as Markdown. `remark-gfm` enables the GFM table
 * used in the cover-page signature block.
 */
export function NdaPreview({ markdown }: NdaPreviewProps) {
  return (
    <div className="prose prose-sm max-w-none overflow-y-auto rounded border border-zinc-200 bg-white p-6">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{markdown}</ReactMarkdown>
    </div>
  );
}