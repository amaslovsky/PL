"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { getMe, logout } from "@/lib/api";

/**
 * App header shown on every page. Calls `/api/auth/me` on mount to learn
 * the current user; renders the email + a sign-out button when signed
 * in, and a "Sign in" link otherwise. Keeping this client-only avoids
 * `headers()` in the root layout, which would force dynamic rendering
 * and break `output: "export"`.
 */
export function Header() {
  const router = useRouter();
  const [email, setEmail] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const me = await getMe();
        if (!cancelled) setEmail(me.email ?? null);
      } catch {
        if (!cancelled) setEmail(null);
      } finally {
        if (!cancelled) setLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const onLogout = useCallback(async () => {
    try {
      await logout();
    } catch {
      // Even if the network call fails, route to /login — the BE will
      // re-validate the cookie.
    }
    setEmail(null);
    router.push("/login");
    router.refresh();
  }, [router]);

  return (
    <header className="border-b border-zinc-200 bg-white">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-3">
        <div className="flex items-center gap-6">
          <Link
            href="/"
            className="text-lg font-semibold tracking-tight text-[#032147]"
          >
            Prelegal
          </Link>
          <nav className="flex items-center gap-4 text-sm">
            <Link href="/" className="text-zinc-700 hover:text-[#032147]">
              Documents
            </Link>
            <Link
              href="/my-documents"
              className="text-zinc-700 hover:text-[#032147]"
            >
              My drafts
            </Link>
          </nav>
        </div>
        <div className="flex items-center gap-3 text-sm">
          {loaded && email && (
            <>
              <span className="text-zinc-600">{email}</span>
              <button
                type="button"
                onClick={onLogout}
                className="rounded border border-zinc-300 bg-white px-3 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-50"
              >
                Sign out
              </button>
            </>
          )}
          {loaded && !email && (
            <Link
              href="/login"
              className="rounded bg-[#209dd7] px-3 py-1 text-xs font-medium text-white hover:bg-[#1b8bc0]"
            >
              Sign in
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}