"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { getMe, logout } from "@/lib/api";

/**
 * App header shown on every page. Calls `/api/auth/me` on mount to learn
 * the current user; renders a dropdown menu (My drafts + Sign out) when
 * signed in, and a "Sign in" link otherwise. Keeping this client-only
 * avoids `headers()` in the root layout, which would force dynamic
 * rendering and break `output: "export"`.
 */
export function Header() {
  const router = useRouter();
  const [email, setEmail] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

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

  useEffect(() => {
    if (!menuOpen) return;
    function onPointerDown(e: PointerEvent) {
      if (!menuRef.current?.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setMenuOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  const closeMenu = useCallback(() => setMenuOpen(false), []);

  const onLogout = useCallback(async () => {
    try {
      await logout();
    } catch {
      // Even if the network call fails, route to /login — the BE will
      // re-validate the cookie.
    }
    setEmail(null);
    closeMenu();
    router.push("/login");
    router.refresh();
  }, [router, closeMenu]);

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
          {loaded && email && (
            <div ref={menuRef} className="relative">
              <button
                type="button"
                onClick={() => setMenuOpen((v) => !v)}
                aria-expanded={menuOpen}
                aria-haspopup="menu"
                className="flex items-center gap-1 rounded border border-transparent px-2 py-1 text-zinc-600 hover:bg-zinc-50 hover:border-zinc-200"
              >
                <span>{email}</span>
                <svg
                  aria-hidden="true"
                  width="10"
                  height="10"
                  viewBox="0 0 10 10"
                  className={`transition ${menuOpen ? "rotate-180" : ""}`}
                >
                  <path d="M1 3l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.5" />
                </svg>
              </button>
              {menuOpen && (
                <div
                  role="menu"
                  className="absolute right-0 top-full z-10 mt-1 w-48 overflow-hidden rounded-lg border border-zinc-200 bg-white py-1 shadow-lg"
                >
                  <Link
                    href="/my-documents"
                    role="menuitem"
                    onClick={closeMenu}
                    className="block px-3 py-2 text-sm text-zinc-700 hover:bg-zinc-50"
                  >
                    My drafts
                  </Link>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => void onLogout()}
                    className="block w-full px-3 py-2 text-left text-sm text-zinc-700 hover:bg-zinc-50"
                  >
                    Sign out
                  </button>
                </div>
              )}
            </div>
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