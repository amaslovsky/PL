/**
 * Persistent footer with the legal disclaimer. Renders on every page
 * (including auth screens) so the disclaimer is always visible.
 */
export function Footer() {
  return (
    <footer className="border-t border-zinc-200 bg-white">
      <p className="mx-auto max-w-7xl px-6 py-3 text-center text-xs text-zinc-600">
        Prelegal drafts are templates only — they are not legal advice and
        are subject to legal review before use.
      </p>
    </footer>
  );
}