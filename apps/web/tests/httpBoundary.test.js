import assert from "node:assert/strict";
import test from "node:test";

import {
  ApiError,
  buildApiUrl,
  requestJson,
} from "../src/shared/api/http.ts";

test("ordinary REST URL construction stays centralized in the shared HTTP boundary", () => {
  assert.equal(buildApiUrl(), "/api/v1");
  assert.equal(buildApiUrl("/presentations"), "/api/v1/presentations");
  assert.equal(buildApiUrl("auth/me"), "/api/v1/auth/me");
  assert.throws(
    () => buildApiUrl("https://api.example.test/v2/resource"),
    /must be relative/,
  );
});

test("JSON mutations apply credentials, content type, and CSRF in one transport boundary", async () => {
  const originalFetch = globalThis.fetch;
  const originalDocument = globalThis.document;
  let capturedUrl = "";
  let capturedInit;

  globalThis.document = { cookie: "other=value; proslides_csrf=csrf-token" };
  globalThis.fetch = async (url, init) => {
    capturedUrl = String(url);
    capturedInit = init;
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  };

  try {
    const result = await requestJson("/presentations", {
      method: "POST",
      json: { title: "نمونه" },
    });

    assert.deepEqual(result, { ok: true });
    assert.equal(capturedUrl, "/api/v1/presentations");
    assert.equal(capturedInit.credentials, "include");
    assert.equal(capturedInit.body, JSON.stringify({ title: "نمونه" }));

    const headers = new Headers(capturedInit.headers);
    assert.equal(headers.get("content-type"), "application/json");
    assert.equal(headers.get("x-csrf-token"), "csrf-token");
  } finally {
    globalThis.fetch = originalFetch;
    if (originalDocument === undefined) {
      delete globalThis.document;
    } else {
      globalThis.document = originalDocument;
    }
  }
});

test("safe reads do not attach CSRF and API failures keep the typed error contract", async () => {
  const originalFetch = globalThis.fetch;
  const originalDocument = globalThis.document;
  let capturedInit;

  globalThis.document = { cookie: "proslides_csrf=csrf-token" };
  globalThis.fetch = async (_url, init) => {
    capturedInit = init;
    return new Response(
      JSON.stringify({
        error: "edit_conflict",
        message: "conflict",
        field_errors: { title: ["changed elsewhere"] },
        retry_after_seconds: 3,
        request_id: "req-1",
      }),
      {
        status: 409,
        headers: { "Content-Type": "application/json" },
      },
    );
  };

  try {
    await assert.rejects(
      requestJson("/presentations/p-1"),
      (error) => {
        assert.ok(error instanceof ApiError);
        assert.equal(error.status, 409);
        assert.equal(error.code, "edit_conflict");
        assert.equal(error.isConflict, true);
        assert.deepEqual(error.fieldErrors, { title: ["changed elsewhere"] });
        assert.equal(error.retryAfterSeconds, 3);
        assert.equal(error.requestId, "req-1");
        return true;
      },
    );

    const headers = new Headers(capturedInit.headers);
    assert.equal(headers.has("x-csrf-token"), false);
    assert.equal(capturedInit.credentials, "include");
  } finally {
    globalThis.fetch = originalFetch;
    if (originalDocument === undefined) {
      delete globalThis.document;
    } else {
      globalThis.document = originalDocument;
    }
  }
});

test("204 responses resolve without inventing a JSON payload", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(null, { status: 204 });

  try {
    assert.equal(await requestJson("/auth/logout", { method: "POST" }), undefined);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
