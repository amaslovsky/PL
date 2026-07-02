"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

interface UserMenuProps {
  email: string;
  onSignOut: () => void | Promise<void>;
}

/**
 * Email-address dropdown menu in the header. Click to expand, click-outside
 * or Escape to collapse. Menu items close the menu before navigating.
 */
export function UserMenu({ email, onSignOut }: UserMenuProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

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

  return (
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
          <path
            d="M1 3l4 4 4-4"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
          />
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
            onClick={() => {
              closeMenu();
              void onSignOut();
            }}
            className="block w-full px-3 py-2 text-left text-sm text-zinc-700 hover:bg-zinc-50"
          >
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}