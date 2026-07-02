"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface StandardTermsPreviewProps {
  /** The standard-terms markdown for the chosen template. */
  markdown: string;
}

/**
 * Renders a non-MNDA template's standard-terms markdown. Same shape as
 * NDAPreview but no live fields — the markdown is shown verbatim because
 * only MNDA has a typed fill pipeline today.
 */
export function StandardTermsPreview({ markdown }: StandardTermsPreviewProps) {
  return (
    <div className="prose prose-sm prose-zinc h-full max-w-none overflow-y-auto px-8 py-6 leading-relaxed">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{markdown}</ReactMarkdown>
    </div>
  );
}