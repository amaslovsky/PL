import Link from "next/link";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 p-8">
      <div className="max-w-xl text-center">
        <h1 className="text-3xl font-semibold tracking-tight text-zinc-900">
          Prelegal — Mutual NDA prototype
        </h1>
        <p className="mt-3 text-zinc-600">
          A web app that fills in the Common Paper Mutual NDA from a short
          form. Built for Jira ticket PL-3.
        </p>
        <Link
          href="/mutual-nda"
          className="mt-6 inline-block rounded bg-blue-600 px-5 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-blue-700"
        >
          Open MNDA builder →
        </Link>
      </div>
    </main>
  );
}