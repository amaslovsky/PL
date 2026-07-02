"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface NDAPreviewProps {
  /** The filled NDA markdown (cover page + horizontal rule + standard terms). */
  markdown: string;
}

/**
 * Renders the filled MNDA live preview as Markdown. `remark-gfm` enables
 * the GFM table used in the cover-page signature block.
 */
export function NDAPreview({ markdown }: NDAPreviewProps) {
  return (
    <div className="prose prose-sm prose-zinc h-full max-w-none overflow-y-auto px-8 py-6 leading-relaxed">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{markdown}</ReactMarkdown>
    </div>
  );
}