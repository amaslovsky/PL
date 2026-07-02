"use client";

import { useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { useAuth } from "@/contexts/AuthContext";

interface AuthGateProps {
  children: ReactNode;
}

/**
 * Client-side auth gate. Renders `children` only when a user is signed
 * in; otherwise redirects to `/login`. Auth state is resolved through
 * `useAuth()` so the gate also handles the initial loading flicker.
 *
 * Why client-side: the root layout can't read cookies (it would force
 * dynamic rendering and break `output: "export"`). The static export
 * ships the placeholder HTML for `/` and this component swaps in the
 * real content (or fires the redirect) once auth resolves.
 */
export function AuthGate({ children }: AuthGateProps) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/login");
    }
  }, [loading, user, router]);

  if (loading || !user) {
    return (
      <main className="flex min-h-[60vh] flex-1 items-center justify-center p-6">
        <p className="text-sm text-zinc-500">Loading…</p>
      </main>
    );
  }

  return <>{children}</>;
}