/**
 * @jest-environment jsdom
 */
import "@testing-library/jest-dom";

import { render, screen, waitFor } from "@testing-library/react";
import { AuthProvider } from "@/contexts/AuthContext";
import { Header } from "@/components/Header";

interface UserPayload {
  id: number;
  email: string;
}

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

function queueMe(fetchMock: jest.Mock, payload: UserPayload | null) {
  if (payload === null) {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 401,
      json: async () => ({}),
    });
  } else {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => payload,
    });
  }
}

function renderHeader(fetchMock: jest.Mock, payload: UserPayload | null) {
  queueMe(fetchMock, payload);
  return render(
    <AuthProvider>
      <Header />
    </AuthProvider>,
  );
}

describe("Header", () => {
  let fetchMock: jest.Mock;
  let restore: () => void;

  beforeEach(() => {
    ({ fetchMock, restore } = installFetch());
  });

  afterEach(() => {
    restore();
    fetchMock.mockReset();
  });

  it("renders 'Sign in' link when signed out", async () => {
    renderHeader(fetchMock, null);

    await waitFor(() => {
      expect(screen.getByText("Sign in")).toBeInTheDocument();
    });
    expect(screen.queryByText("alice@example.com")).not.toBeInTheDocument();
  });

  it("renders email button when signed in", async () => {
    renderHeader(fetchMock, { id: 1, email: "alice@example.com" });

    await waitFor(() => {
      expect(screen.getByText("alice@example.com")).toBeInTheDocument();
    });
    expect(screen.queryByText("Sign in")).not.toBeInTheDocument();
  });

  it("hides both Sign in and email while auth is still loading", () => {
    // Hold the fetch open so the provider stays in 'loading' state.
    fetchMock.mockImplementation(
      () => new Promise(() => {}) as unknown as Promise<Response>,
    );

    render(
      <AuthProvider>
        <Header />
      </AuthProvider>,
    );

    expect(screen.queryByText("Sign in")).not.toBeInTheDocument();
    expect(screen.queryByText("alice@example.com")).not.toBeInTheDocument();
  });
});
