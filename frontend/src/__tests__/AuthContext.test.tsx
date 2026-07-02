/**
 * @jest-environment jsdom
 */
import "@testing-library/jest-dom";

import { act, render, waitFor } from "@testing-library/react";
import type { User } from "@/services/api";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";

interface Consumer {
  user: User | null;
  loading: boolean;
  signout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

function TestConsumer({ onAuth }: { onAuth: (auth: Consumer) => void }) {
  const auth = useAuth();
  onAuth({
    user: auth.user,
    loading: auth.loading,
    signout: auth.signout,
    refreshUser: auth.refreshUser,
  });
  return <div data-testid="consumer">consumer</div>;
}

function renderWithProvider(onAuth: (auth: Consumer) => void) {
  return render(
    <AuthProvider>
      <TestConsumer onAuth={onAuth} />
    </AuthProvider>,
  );
}

/** Install a stub `fetch` on `globalThis` so `useAuth` can call it. The
 *  returned spy lets each test queue its own responses. Restores the
 *  original at the end of the test. */
function installFetch(): { fetchMock: jest.Mock; restore: () => void } {
  const original = (globalThis as { fetch?: unknown }).fetch;
  const fetchMock = jest.fn();
  (globalThis as unknown as { fetch: jest.Mock }).fetch = fetchMock;
  return {
    fetchMock,
    restore: () => {
      if (original === undefined) {
        delete (globalThis as unknown as { fetch?: unknown }).fetch;
      } else {
        (globalThis as unknown as { fetch: unknown }).fetch = original;
      }
    },
  };
}

describe("AuthProvider", () => {
  let fetchMock: jest.Mock;
  let restore: () => void;

  beforeEach(() => {
    ({ fetchMock, restore } = installFetch());
  });

  afterEach(() => {
    restore();
    fetchMock.mockReset();
  });

  it("starts in 'loading' state and transitions to user=null when /api/auth/me returns 401", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 401,
      json: async () => ({}),
    });

    let captured: Consumer | null = null;
    renderWithProvider((auth) => {
      captured = auth;
    });

    expect(captured!.loading).toBe(true);
    expect(captured!.user).toBeNull();

    await waitFor(() => {
      expect(captured!.loading).toBe(false);
    });
    expect(captured!.user).toBeNull();
  });

  it("transitions to user={id, email} when /api/auth/me returns a session", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ id: 7, email: "alice@example.com" }),
    });

    let captured: Consumer | null = null;
    renderWithProvider((auth) => {
      captured = auth;
    });

    await waitFor(() => {
      expect(captured!.loading).toBe(false);
    });
    expect(captured!.user).toEqual({ id: 7, email: "alice@example.com" });
  });

  it("signout posts to /api/auth/signout and clears local user", async () => {
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ id: 7, email: "alice@example.com" }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ message: "Signed out successfully" }),
      });

    let captured: Consumer | null = null;
    renderWithProvider((auth) => {
      captured = auth;
    });

    await waitFor(() => {
      expect(captured!.user).not.toBeNull();
    });

    await act(async () => {
      await captured!.signout();
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/auth/signout",
      expect.objectContaining({ method: "POST" }),
    );
    expect(captured!.user).toBeNull();
  });

  it("signout clears local user even if /api/auth/signout throws", async () => {
    // Silence the unhandled rejection: the implementation logs the error
    // from the failing fetch but does not rethrow, so the promise
    // produced by `signout()` resolves cleanly.
    const unhandled = jest.spyOn(console, "error").mockImplementation(() => {});
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ id: 7, email: "alice@example.com" }),
      })
      .mockImplementationOnce(() => Promise.reject(new Error("network down")));

    let captured: Consumer | null = null;
    renderWithProvider((auth) => {
      captured = auth;
    });

    await waitFor(() => {
      expect(captured!.user).not.toBeNull();
    });

    // The underlying signOut() rejects; the AuthContext signout() also
    // rejects because the catch is in finally. Swallow the rejection so
    // we can assert on the local state that was cleared regardless.
    await act(async () => {
      try {
        await captured!.signout();
      } catch {
        // expected
      }
    });

    expect(captured!.user).toBeNull();
    unhandled.mockRestore();
  });

  it("useAuth throws when used outside an AuthProvider", () => {
    const errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    expect(() => render(<TestConsumer onAuth={() => {}} />)).toThrow(
      "useAuth must be used inside <AuthProvider>",
    );
    errorSpy.mockRestore();
  });
});
