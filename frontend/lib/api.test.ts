import { describe, it, expect, vi, afterEach } from "vitest";
import { postChat } from "./api";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("postChat", () => {
  it("defaults document_type to mnda", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ fields: {}, assistant_message: "ok" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await postChat([{ role: "user", content: "hi" }]);

    const init = fetchMock.mock.calls[0][1] as RequestInit;
    expect(JSON.parse(init.body as string)).toEqual({
      messages: [{ role: "user", content: "hi" }],
      document_type: "mnda",
    });
  });

  it("sends the supplied document_type", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ fields: null, assistant_message: "fallback" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await postChat([{ role: "user", content: "hi" }], "csa");

    const init = fetchMock.mock.calls[0][1] as RequestInit;
    const body = JSON.parse(init.body as string);
    expect(body.document_type).toBe("csa");
  });

  it("tolerates fields=null from a fallback response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ fields: null, assistant_message: "nope" }),
      }),
    );
    const out = await postChat([], "csa");
    expect(out.fields).toBeNull();
    expect(out.assistant_message).toBe("nope");
  });

  it("throws with server detail on non-2xx", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        json: async () => ({ detail: "not authenticated" }),
      }),
    );
    await expect(postChat([], "mnda")).rejects.toThrow("not authenticated");
  });
});