"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { signIn } from "@/lib/api";

/**
 * Sign-in screen. Posts email + password to `/api/auth/login`; the BE
 * sets the `pl_session` cookie on success and the SPA navigates home.
 */
export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await signIn(email, password);
      router.push("/");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign in failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="flex min-h-screen flex-1 items-center justify-center bg-zinc-50 p-6">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-sm rounded-lg border border-zinc-200 bg-white p-8 shadow-sm"
      >
        <h1 className="text-2xl font-semibold tracking-tight text-[#032147]">
          Sign in to <span className="text-[#ecad0a]">Prelegal</span>
        </h1>
        <p className="mt-1 text-sm text-zinc-600">
          Enter your email and password to continue.
        </p>

        <label className="mt-6 block text-sm font-medium text-[#032147]">
          Email
          <input
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 w-full rounded border border-zinc-300 px-3 py-2 text-sm focus:border-[#209dd7] focus:outline-none"
          />
        </label>

        <label className="mt-4 block text-sm font-medium text-[#032147]">
          Password
          <input
            type="password"
            required
            minLength={8}
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1 w-full rounded border border-zinc-300 px-3 py-2 text-sm focus:border-[#209dd7] focus:outline-none"
          />
        </label>

        {error && (
          <p className="mt-3 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={busy}
          className="mt-6 w-full rounded bg-[#209dd7] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#1b8bc0] disabled:opacity-50"
        >
          {busy ? "Signing in…" : "Sign in"}
        </button>

        <p className="mt-4 text-center text-sm text-zinc-600">
          New to Prelegal?{" "}
          <Link href="/signup" className="font-medium text-[#209dd7] underline">
            Create an account
          </Link>
        </p>
      </form>
    </main>
  );
}
