"use client";

import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import { UserMenu } from "./UserMenu";

/**
 * App header shown on every page. Reads auth state from AuthContext
 * (mounted by RootLayout) so this component doesn't fetch /api/auth/me
 * itself. Renders a `<UserMenu>` (My drafts + Sign out) when signed in,
 * and a "Sign in" link otherwise. Keeping this client-only avoids
 * `headers()` in the root layout, which would force dynamic rendering
 * and break `output: "export"`.
 */
export function Header() {
  const { user, loading, signout } = useAuth();

  if (loading) {
    return (
      <header className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-3">
          <Link
            href="/"
            className="text-lg font-semibold tracking-tight text-[#032147]"
          >
            Prelegal
          </Link>
        </div>
      </header>
    );
  }

  const signedIn = user != null;

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
              New draft
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
          {signedIn && user && (
            <UserMenu email={user.email} onSignOut={signout} />
          )}
          {!signedIn && (
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