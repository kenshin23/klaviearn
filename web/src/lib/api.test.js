import { api, getToken, setToken } from "./api.js";

const ok = body => Promise.resolve({
  ok: true, status: 200, json: () => Promise.resolve(body),
});
const fail = (status, detail) => Promise.resolve({
  ok: false, status, json: () => Promise.resolve({ detail }),
});

const lastCall = () => globalThis.fetch.mock.calls.at(-1);

beforeEach(() => {
  localStorage.clear();
  globalThis.fetch = vi.fn(() => ok({}));
});

describe("the token", () => {
  it("starts absent", () => {
    expect(getToken()).toBeNull();
  });

  it("is stored and cleared", () => {
    setToken("abc123");
    expect(getToken()).toBe("abc123");
    setToken(null);
    expect(getToken()).toBeNull();
  });

  it("is sent as a bearer header once set", async () => {
    setToken("abc123");
    await api.me();
    expect(lastCall()[1].headers.Authorization).toBe("Bearer abc123");
  });

  it("is omitted when signed out", async () => {
    await api.me();
    expect(lastCall()[1].headers.Authorization).toBeUndefined();
  });
});

describe("requests", () => {
  it("prefixes every path with /api", async () => {
    await api.tree();
    expect(lastCall()[0]).toBe("/api/tree");
  });

  it("sends JSON bodies", async () => {
    globalThis.fetch = vi.fn(() => ok({ exercises: [] }));
    await api.startSession("chords", "chord");
    const [url, opts] = lastCall();
    expect(url).toBe("/api/sessions");
    expect(opts.method).toBe("POST");
    expect(JSON.parse(opts.body)).toEqual({ node_id: "chords", drill: "chord" });
  });

  it("normalises the server's snake_case pos_label for the renderer", async () => {
    globalThis.fetch = vi.fn(() => ok({
      exercises: [{ item: "treble:60", pos_label: "ledger line" }],
    }));
    const [exercise] = await api.startSession("guide", "note");
    expect(exercise.posLabel).toBe("ledger line");
  });

  it("leaves an already-camelCase label alone", async () => {
    globalThis.fetch = vi.fn(() => ok({
      exercises: [{ item: "treble:60", posLabel: "first space" }],
    }));
    const [exercise] = await api.startSession("guide", "note");
    expect(exercise.posLabel).toBe("first space");
  });

  it("sends no body on a GET", async () => {
    await api.stats();
    expect(lastCall()[1].body).toBeUndefined();
  });

  it("posts session results", async () => {
    const results = [{ item: "chord:C:maj", hit: true, played: null }];
    await api.completeSession("chords", "chord", results);
    expect(JSON.parse(lastCall()[1].body)).toEqual({
      node_id: "chords", drill: "chord", results,
    });
  });

  it("puts a password change with the server's field names", async () => {
    await api.changePassword("old-secret", "new-secret");
    const [url, opts] = lastCall();
    expect(url).toBe("/api/me/password");
    expect(opts.method).toBe("PUT");
    expect(JSON.parse(opts.body)).toEqual({ current: "old-secret", new: "new-secret" });
  });

  it("returns the parsed body", async () => {
    globalThis.fetch = vi.fn(() => ok({ nodes: [{ id: "guide" }] }));
    await expect(api.tree()).resolves.toEqual({ nodes: [{ id: "guide" }] });
  });
});

describe("errors", () => {
  it("rejects with the server's message", async () => {
    globalThis.fetch = vi.fn(() => fail(401, "Wrong email or password"));
    await expect(api.login("a@b.com", "nope")).rejects.toThrow("Wrong email or password");
  });

  it("rejects even when the server sends no detail", async () => {
    globalThis.fetch = vi.fn(() => Promise.resolve({
      ok: false, status: 500, json: () => Promise.reject(new Error("not json")),
    }));
    await expect(api.stats()).rejects.toThrow();
  });
});
