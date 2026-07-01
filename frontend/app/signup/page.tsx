"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { signUp } from "@/lib/api";

/**
 * Sign-up screen. Posts email + password to `/api/auth/signup`; on
 * success the BE sets the session cookie and the SPA navigates home.
 * Passwords must be at least 8 chars; the BE re-validates.
 */
export default function SignupPage() {
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
      await signUp(email, password);
      router.push("/");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign up failed");
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
          Create your <span className="text-[#ecad0a]">Prelegal</span> account
        </h1>
        <p className="mt-1 text-sm text-zinc-600">
          Save drafts and pick up where you left off.
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
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1 w-full rounded border border-zinc-300 px-3 py-2 text-sm focus:border-[#209dd7] focus:outline-none"
          />
        </label>
        <p className="mt-1 text-xs text-zinc-500">
          At least 8 characters. The database resets when the server
          restarts, so use a password you don&apos;t mind losing.
        </p>

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
          {busy ? "Creating account…" : "Create account"}
        </button>

        <p className="mt-4 text-center text-sm text-zinc-600">
          Already have an account?{" "}
          <Link href="/login" className="font-medium text-[#209dd7] underline">
            Sign in
          </Link>
        </p>
      </form>
    </main>
  );
}