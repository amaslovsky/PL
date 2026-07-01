import Link from "next/link";
import { listDocuments } from "@/lib/documents/wiring";

export default function Home() {
  const docs = listDocuments();
  return (
    <main className="mx-auto flex min-h-screen max-w-4xl flex-col gap-8 p-8">
      <header className="text-center">
        <h1 className="text-3xl font-semibold tracking-tight text-[#032147]">
          Prelegal
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-zinc-600">
          Pick a document and chat to fill it in. Today the Mutual NDA
          drafts end-to-end; the other agreements show the closest match we
          can produce.
        </p>
      </header>
      <ul className="grid gap-3">
        {docs.map((d) => {
          const href = `/documents/${d.id}`;
          return (
            <li
              key={d.id}
              className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm transition hover:border-zinc-300 hover:bg-zinc-50"
            >
              <Link href={href} className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-base font-semibold text-zinc-900">
                    {d.displayName}
                  </h2>
                  <p className="mt-1 text-sm leading-relaxed text-zinc-600">
                    {d.description}
                  </p>
                </div>
                {!d.wired && (
                  <span className="shrink-0 rounded-full border border-[#ecad0a] bg-[#ecad0a]/10 px-2 py-0.5 text-xs font-medium text-[#032147]">
                    coming soon
                  </span>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </main>
  );
}