import { describe, it, expect, vi, afterEach } from "vitest";
import {
  listSavedDocuments,
  postChat,
  saveDocument,
  signIn,
  signUp,
} from "./api";

afterEach(() => {
  vi.unstubAllGlobals();
});

function jsonResponse(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
    ...init,
  });
}

describe("postChat", () => {
  it("omits document_type when no hint is given", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        document_type: "mnda",
        fields: {},
        assistant_message: "ok",
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await postChat([{ role: "user", content: "hi" }]);

    const init = fetchMock.mock.calls[0][1] as RequestInit;
    expect(JSON.parse(init.body as string)).toEqual({
      messages: [{ role: "user", content: "hi" }],
    });
  });

  it("sends the supplied document_type hint", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        document_type: "cloud-service-agreement",
        fields: {},
        assistant_message: "ok",
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await postChat([{ role: "user", content: "hi" }], "csa");

    const init = fetchMock.mock.calls[0][1] as RequestInit;
    const body = JSON.parse(init.body as string);
    expect(body.document_type).toBe("csa");
  });

  it("returns the document_type the LLM chose", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse({
          document_type: "cloud-service-agreement",
          fields: {},
          assistant_message: "ok",
        }),
      ),
    );
    const out = await postChat([{ role: "user", content: "I need a CSA" }]);
    expect(out.document_type).toBe("cloud-service-agreement");
    expect(out.assistant_message).toBe("ok");
  });

  it("throws with server detail on non-2xx", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ detail: "not authenticated" }), {
          status: 401,
          headers: { "content-type": "application/json" },
        }),
      ),
    );
    await expect(postChat([], "mnda")).rejects.toThrow("not authenticated");
  });
});

describe("signUp", () => {
  it("POSTs email + password to /api/auth/signup", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({ authenticated: true, user_id: 1, email: "a@b.c" }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await signUp("a@b.c", "hunter2hunter2");

    const [path, init] = fetchMock.mock.calls[0];
    expect(path).toBe("/api/auth/signup");
    expect((init as RequestInit).method).toBe("POST");
    expect(JSON.parse((init as RequestInit).body as string)).toEqual({
      email: "a@b.c",
      password: "hunter2hunter2",
    });
  });
});

describe("signIn", () => {
  it("POSTs to /api/auth/login", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({ authenticated: true, user_id: 1, email: "a@b.c" }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await signIn("a@b.c", "hunter2hunter2");

    expect(fetchMock.mock.calls[0][0]).toBe("/api/auth/login");
  });

  it("surfaces 401 detail", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ detail: "invalid email or password" }), {
          status: 401,
          headers: { "content-type": "application/json" },
        }),
      ),
    );
    await expect(signIn("a@b.c", "wrongwrong")).rejects.toThrow(
      "invalid email or password",
    );
  });
});

describe("saveDocument", () => {
  it("POSTs document_type + data to /api/documents", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({ id: 42, document_type: "mnda" }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const data = {
      party1: { name: "A", address: "" },
      party2: { name: "B", address: "" },
      purpose: "p",
      effectiveDate: "",
      effectiveDateDisplay: "",
      ndaTerm: { mode: "expires" as const, years: 1 },
      confidentialityTerm: { mode: "years" as const, years: 1 },
      governingLaw: "",
      jurisdiction: "",
    };
    await saveDocument("mnda", data);
    const [path, init] = fetchMock.mock.calls[0];
    expect(path).toBe("/api/documents");
    expect(JSON.parse((init as RequestInit).body as string)).toEqual({
      document_type: "mnda",
      data,
    });
  });
});

describe("listSavedDocuments", () => {
  it("GETs /api/documents and returns the array", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(jsonResponse([{ id: 1, document_type: "mnda" }])),
    );
    const out = await listSavedDocuments();
    expect(out).toEqual([{ id: 1, document_type: "mnda" }]);
  });
});