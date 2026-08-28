import assert from "node:assert/strict";
import test from "node:test";

import { ApiError, requestJson } from "../src/shared/api/http.ts";

test("shared HTTP client preserves CSRF JSON and stable conflict errors", async (t) => {
  const originalFetch = globalThis.fetch;
  const originalDocument = globalThis.document;
  const calls = [];
  globalThis.document = { cookie: "proslides_csrf=csrf-token" };
  globalThis.fetch = async (url, init) => {
    calls.push({ url, init });
    return new Response(JSON.stringify({ error: "edit_conflict" }), {
      status: 409,
      headers: { "Content-Type": "application/json" },
    });
  };
  t.after(() => {
    globalThis.fetch = originalFetch;
    if (originalDocument === undefined) delete globalThis.document;
    else globalThis.document = originalDocument;
  });

  await assert.rejects(
    requestJson("/presentations/p-1", { method: "PATCH", json: { title: "New" } }),
    (error) => error instanceof ApiError && error.status === 409 && error.code === "edit_conflict" && error.isConflict,
  );
  assert.equal(calls.length, 1);
  const headers = new Headers(calls[0].init.headers);
  assert.equal(headers.get("X-CSRF-Token"), "csrf-token");
  assert.equal(headers.get("Content-Type"), "application/json");
});

test("shared HTTP client leaves aborts distinguishable", async (t) => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => { throw new DOMException("aborted", "AbortError"); };
  t.after(() => { globalThis.fetch = originalFetch; });

  await assert.rejects(requestJson("/presentations", { signal: AbortSignal.abort() }), {
    name: "AbortError",
  });
});

test("shared HTTP client announces authentication expiry", async (t) => {
  const originalFetch = globalThis.fetch;
  const originalWindow = globalThis.window;
  const browserWindow = new EventTarget();
  globalThis.window = browserWindow;
  globalThis.fetch = async () => new Response(JSON.stringify({ error: "unauthorized" }), {
    status: 401,
    headers: { "Content-Type": "application/json" },
  });
  t.after(() => {
    globalThis.fetch = originalFetch;
    if (originalWindow === undefined) delete globalThis.window;
    else globalThis.window = originalWindow;
  });

  let code = "";
  browserWindow.addEventListener("app:notice", (event) => { code = event.detail.code; });
  await assert.rejects(requestJson("/presentations"), (error) => error instanceof ApiError && error.status === 401);
  assert.equal(code, "session-expired");
});
