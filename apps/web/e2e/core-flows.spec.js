import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

async function expectAccessible(page, context) {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
    .analyze();
  expect(
    results.violations,
    `${context}: ${results.violations.map(({ id }) => id).join(", ")}`,
  ).toEqual([]);
}

async function expectNoOverflow(page) {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
    ),
  ).toBe(true);
}

function watchRuntime(page) {
  const failures = [];

  page.on("pageerror", (error) => failures.push(`pageerror: ${error.message}`));
  page.on("console", (message) => {
    if (
      message.type() === "error" &&
      !message.text().startsWith("Failed to load resource:")
    ) {
      failures.push(`console: ${message.text()}`);
    }
  });
  page.on("requestfailed", (request) => {
    if (
      request.url().includes("/api/v1/") &&
      request.failure()?.errorText !== "net::ERR_ABORTED"
    ) {
      failures.push(
        `request: ${request.method()} ${request.url()} (${request.failure()?.errorText})`,
      );
    }
  });
  page.on("response", (response) => {
    if (response.url().includes("/api/v1/") && response.status() >= 500) {
      failures.push(`response: ${response.status()} ${response.url()}`);
    }
  });

  return failures;
}

test("landing, protected navigation, and responsive auth layout", async ({ page }) => {
  const failures = watchRuntime(page);

  await page.addInitScript(() => {
    window.__f5Vitals = { cls: 0, lcp: 0 };
    new PerformanceObserver((list) => {
      const entries = list.getEntries();
      window.__f5Vitals.lcp = entries.at(-1)?.startTime || 0;
    }).observe({ type: "largest-contentful-paint", buffered: true });
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (!entry.hadRecentInput) window.__f5Vitals.cls += entry.value;
      }
    }).observe({ type: "layout-shift", buffered: true });
  });

  await page.goto("/");
  await expect(page).toHaveTitle(/ProSlides|پرو اسلایدز/i);
  await expect(page.locator("body")).toBeVisible();
  await expectAccessible(page, "landing");
  await page.waitForTimeout(500);
  const vitals = await page.evaluate(() => ({
    fcp: performance.getEntriesByName("first-contentful-paint")[0]?.startTime || 0,
    lcp: window.__f5Vitals.lcp,
    cls: window.__f5Vitals.cls,
  }));
  expect(vitals.fcp).toBeLessThanOrEqual(2000);
  expect(vitals.lcp).toBeLessThanOrEqual(2500);
  expect(vitals.cls).toBeLessThanOrEqual(0.1);

  await page.emulateMedia({ reducedMotion: "reduce" });
  expect(
    await page.evaluate(
      () => document.getAnimations().filter(({ playState }) => playState === "running").length,
    ),
  ).toBe(0);

  await page.goto("/manager/panel");
  await expect(page).toHaveURL(/\/auth$/);
  await expect(page.locator('input[name="email"]')).toBeVisible();
  await expectAccessible(page, "authentication");
  await page.keyboard.press("Tab");
  await expect(page.locator(":focus")).toBeVisible();

  await page.setViewportSize({ width: 375, height: 812 });
  await expectNoOverflow(page);
  expect(failures).toEqual([]);
});

test("register, create a presentation, and open its report", async ({ page }) => {
  const failures = watchRuntime(page);
  const unique = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const email = `browser-${unique}@example.com`;

  await page.goto("/signup");
  await page.locator('input[name="email"]').fill(email);
  await page.locator('input[name="password"]').fill("BrowserPass!42");
  await page.locator('input[name="full-name"]').fill("Browser Test User");

  const registration = page.waitForResponse(
    (response) =>
      response.url().includes("/api/v1/auth/register") &&
      response.request().method() === "POST",
  );
  await page.locator('button[type="submit"]').click();
  expect((await registration).status()).toBe(201);
  await expect(page).toHaveURL(/\/manager\/panel$/);
  await expectAccessible(page, "dashboard");
  await expect(page.getByRole("heading", { name: "ارائه‌های من" })).toBeVisible();

  let createRequestCount = 0;
  page.on("request", (request) => {
    if (
      request.url().endsWith("/api/v1/presentations") &&
      request.method() === "POST"
    ) {
      createRequestCount += 1;
    }
  });
  const createRequest = page.waitForResponse((response) =>
    response.url().endsWith("/api/v1/presentations") &&
    response.request().method() === "POST",
  );
  await page.getByRole("button", { name: "ارائه جدید" }).click();
  expect((await createRequest).status()).toBe(201);
  await expect(page).toHaveURL(/\/manager\/panel\/[^/]+$/);
  await expectAccessible(page, "empty editor");
  await expectNoOverflow(page);
  expect(createRequestCount).toBe(1);
  await expect(page.getByRole("heading", { name: "اولین اسلاید را بسازید" })).toBeVisible();
  await expect(page.getByRole("button", { name: "اجرا", exact: true })).toBeVisible();

  let createSlideRequestCount = 0;
  page.on("request", (request) => {
    if (
      /\/api\/v1\/presentations\/[^/]+\/slides$/.test(new URL(request.url()).pathname) &&
      request.method() === "POST"
    ) {
      createSlideRequestCount += 1;
    }
  });
  await page.getByRole("button", { name: "ساخت اولین اسلاید" }).click();
  await expect(page.getByRole("dialog", { name: "نوع اسلاید را انتخاب کنید" })).toBeVisible();
  expect(createSlideRequestCount).toBe(0);

  const createSlideRequest = page.waitForResponse(
    (response) =>
      /\/api\/v1\/presentations\/[^/]+\/slides$/.test(new URL(response.url()).pathname) &&
      response.request().method() === "POST",
  );
  await page.getByRole("button", { name: /تک‌گزینه‌ای/ }).click();
  expect((await createSlideRequest).status()).toBe(201);
  expect(createSlideRequestCount).toBe(1);
  await expect(page.getByRole("dialog", { name: "نوع اسلاید را انتخاب کنید" })).toBeHidden();

  const presentationId = new URL(page.url()).pathname.split("/").at(-1);
  await page.goto(`/manager/panel/${presentationId}/report`);
  await expect(page.getByLabel("Back to manager panel")).toBeVisible();
  await expectAccessible(page, "report");

  await page.goBack();
  await expect(page).toHaveURL(/\/manager\/panel\/[^/]+$/);
  await page.goForward();
  await expect(page.getByLabel("Back to manager panel")).toBeVisible();

  await page.goto("/manager/panel");
  await page.locator('button[aria-label="باز کردن منوی حساب"]:visible').click();
  await page.getByRole("menuitem", { name: "خروج از حساب" }).click();
  await expect(page).toHaveURL(/\/auth$/);

  await page.locator('input[name="email"]').fill(email);
  await page.locator('input[name="password"]').fill("BrowserPass!42");
  await page.locator('button[type="submit"]').click();
  await expect(page).toHaveURL(/\/manager\/panel$/);
  await expect(page.getByRole("heading", { name: "ارائه‌های من" })).toBeVisible();
  expect(failures).toEqual([]);
});

test("an unknown join code shows the access-denied state", async ({ page }) => {
  const failures = watchRuntime(page);
  const resolution = page.waitForResponse((response) =>
    response.url().includes("/api/v1/live/sessions/resolve"),
  );

  const validButUnknownCode = `MISS${Date.now().toString().slice(-8)}`;
  await page.goto(`/${validButUnknownCode}`);
  expect((await resolution).status()).toBe(404);
  await expect(page.getByText("Invalid access code")).toBeVisible();
  await expectAccessible(page, "unknown access code");
  expect(failures).toEqual([]);
});
