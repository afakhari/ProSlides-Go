import { cleanup } from "@testing-library/react";
import { afterAll, afterEach, beforeAll, beforeEach, vi } from "vitest";

import { server } from "./server.ts";

beforeAll(() => {
  vi.stubEnv("VITE_API_BASE_URL", "http://localhost/api/v1");
  server.listen({ onUnhandledRequest: "error" });
});

beforeEach(() => {
  window.localStorage.clear();
  window.sessionStorage.clear();
});

afterEach(() => {
  cleanup();
  server.resetHandlers();
});

afterAll(() => {
  server.close();
  vi.unstubAllEnvs();
});
