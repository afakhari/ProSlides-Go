import { Buffer } from "node:buffer";

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
  await expect(page).toHaveURL(/\/auth\?from=%2Fmanager%2Fpanel$/);
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
  await page.locator('input[name="fullName"]').fill("Browser Test User");

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
  await expect(page.getByLabel("بازگشت به پنل مدیریت")).toBeVisible();
  await expectAccessible(page, "report");

  await page.goBack();
  await expect(page).toHaveURL(/\/manager\/panel\/[^/]+$/);
  await page.goForward();
  await expect(page.getByLabel("بازگشت به پنل مدیریت")).toBeVisible();

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
  await expect(page.getByText("کد ورود معتبر نیست")).toBeVisible();
  await expectAccessible(page, "unknown access code");
  expect(failures).toEqual([]);
});

test("mobile participant entry uses the public quiz theme", async ({ page }) => {
  const failures = watchRuntime(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.route("**/api/v1/live/sessions/resolve?join_code=THEME1", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        session_id: "11111111-1111-4111-8111-111111111111",
        presentation_id: "22222222-2222-4222-8222-222222222222",
        presentation: {
          title: "مسابقه رنگ‌ها",
          background_color: "#0f766e",
          background_image_url: "",
          music_url: "",
          text_color: "#ffffff",
        },
      }),
    });
  });

  await page.goto("/THEME1");
  await expect(page.getByRole("heading", { name: "به کوئیز بپیوندید" })).toBeVisible();
  await expect(page.getByText("مسابقه رنگ‌ها")).toBeVisible();
  expect(await page.locator(".participant-live-shell").evaluate((element) => getComputedStyle(element).backgroundColor)).toBe("rgb(15, 118, 110)");
  await expectNoOverflow(page);
  await expectAccessible(page, "themed participant join");
  expect(failures).toEqual([]);
});


test("manager and participant complete a live question lifecycle with reconnect", async ({ browser }) => {
  test.setTimeout(120000);

  const managerContext = await browser.newContext();
  const participantContext = await browser.newContext();
  const manager = await managerContext.newPage();
  const participant = await participantContext.newPage();
  const managerFailures = watchRuntime(manager);
  const participantFailures = watchRuntime(participant);

  try {
    const unique = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const email = `live-browser-${unique}@example.com`;
    const accessCode = `L${Date.now().toString(36).slice(-7)}`.toUpperCase();

    await manager.goto("/signup");
    await manager.locator('input[name="email"]').fill(email);
    await manager.locator('input[name="password"]').fill("BrowserPass!42");
    await manager.locator('input[name="fullName"]').fill("مدیر تست زنده");
    await manager.locator('button[type="submit"]').click();
    await expect(manager).toHaveURL(/\/manager\/panel$/);

    const fixture = await manager.evaluate(async ({ accessCode }) => {
      const cookieValue = (name) => {
        const prefix = `${encodeURIComponent(name)}=`;
        const item = document.cookie.split("; ").find((part) => part.startsWith(prefix));
        return item ? decodeURIComponent(item.slice(prefix.length)) : "";
      };
      const api = async (path, options = {}) => {
        const headers = new Headers(options.headers || {});
        headers.set("Content-Type", "application/json");
        const csrf = cookieValue("proslides_csrf");
        if (csrf) headers.set("X-CSRF-Token", csrf);
        const response = await fetch(`/api/v1${path}`, {
          method: options.method || "GET",
          credentials: "include",
          headers,
          body: options.body === undefined ? undefined : JSON.stringify(options.body),
        });
        const body = await response.json().catch(() => null);
        if (!response.ok) {
          throw new Error(`${options.method || "GET"} ${path}: ${response.status} ${JSON.stringify(body)}`);
        }
        return body;
      };

      const presentation = await api("/presentations", {
        method: "POST",
        body: { title: "چرخه کامل تست زنده", settings: {} },
      });

      const optionOneId = crypto.randomUUID();
      const optionTwoId = crypto.randomUUID();
      const slide = await api(`/presentations/${presentation.id}/slides`, {
        method: "POST",
        headers: { "If-Match": String(presentation.revision) },
        body: {
          position: 0,
          kind: "question",
          content: {
            title: "پرسش تست",
            text: "پایتخت ایران کدام شهر است؟",
            question_type: "single",
            question_time: 60,
            min_point: 0,
            max_point: 100,
            image_url: "",
            faster_answers_more_points: false,
            partial_scoring: false,
            show_leaderboard_after: true,
            options: [
              {
                id: optionOneId,
                text: "تهران",
                is_correct: true,
                image_url: "",
                order: 1,
              },
              {
                id: optionTwoId,
                text: "شیراز",
                is_correct: false,
                image_url: "",
                order: 2,
              },
            ],
          },
        },
      });

      await api(`/presentations/${presentation.id}/access-code`, {
        method: "PUT",
        body: { access_code: accessCode },
      });

      return {
        presentationId: presentation.id,
        slideId: slide.id,
        accessCode,
      };
    }, { accessCode });

    await manager.goto(`/manager/presentation/${fixture.presentationId}`);
    const startButton = manager.getByRole("button", { name: /شروع/ });
    await expect(startButton).toBeEnabled({ timeout: 15000 });
    await expectAccessible(manager, "manager live lobby");

    await participant.goto(`/${fixture.accessCode}`);
    await expect(participant.getByRole("heading", { name: "به کوئیز بپیوندید" })).toBeVisible();
    await participant.getByLabel("نام نمایشی").fill("شرکت‌کننده تست");
    await participant.getByRole("button", { name: "ورود به کوئیز" }).click();
    await expect(participant.getByRole("heading", { name: "شرکت‌کننده تست" })).toBeVisible();
    await expect(manager.getByText("شرکت‌کننده تست")).toBeVisible({ timeout: 15000 });

    await startButton.click();
    await expect(
      participant.getByRole("heading", { name: "پایتخت ایران کدام شهر است؟" }),
    ).toBeVisible({ timeout: 15000 });
    await expect(
      manager.getByRole("heading", { name: "پایتخت ایران کدام شهر است؟" }),
    ).toBeVisible({ timeout: 15000 });

    await participant.getByRole("button", { name: /تهران/ }).click();
    await participant.getByRole("button", { name: "ثبت پاسخ" }).click();
    await expect(participant.getByText("پاسخ شما ثبت شد.", { exact: true })).toBeVisible();

    await manager.getByRole("button", { name: "اسلاید بعدی" }).click();
    await expect(participant.getByRole("heading", { name: "جایگاه شما" })).toBeVisible({
      timeout: 15000,
    });
    await expect(manager.getByText("شرکت‌کننده تست")).toBeVisible({ timeout: 15000 });

    await participant.reload();
    await expect(participant.getByRole("heading", { name: "جایگاه شما" })).toBeVisible({
      timeout: 15000,
    });
    await expect(participant.getByText("امتیاز شما")).toBeVisible();

    const endButton = manager.getByRole("button", { name: "پایان پرزنتیشن" });
    await endButton.click();
    await endButton.click();
    await expect(
      manager.getByRole("button", { name: "بازگشت به پنل مدیریت" }),
    ).toBeVisible({ timeout: 15000 });

    expect(managerFailures).toEqual([]);
    expect(participantFailures).toEqual([]);
  } finally {
    await participantContext.close();
    await managerContext.close();
  }
});


test("question editor preserves typed draft semantics across save and edit conflict", async ({ page }) => {
  test.setTimeout(90000);
  const failures = watchRuntime(page);
  const unique = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const email = `editor-browser-${unique}@example.com`;

  await page.goto("/signup");
  await page.locator('input[name="email"]').fill(email);
  await page.locator('input[name="password"]').fill("BrowserPass!42");
  await page.locator('input[name="fullName"]').fill("مدیر تست ویرایشگر");
  await page.locator('button[type="submit"]').click();
  await expect(page).toHaveURL(/\/manager\/panel$/);

  const fixture = await page.evaluate(async () => {
    const cookieValue = (name) => {
      const prefix = `${encodeURIComponent(name)}=`;
      const item = document.cookie.split("; ").find((part) => part.startsWith(prefix));
      return item ? decodeURIComponent(item.slice(prefix.length)) : "";
    };
    const api = async (path, options = {}) => {
      const headers = new Headers(options.headers || {});
      headers.set("Content-Type", "application/json");
      const csrf = cookieValue("proslides_csrf");
      if (csrf) headers.set("X-CSRF-Token", csrf);
      const response = await fetch(`/api/v1${path}`, {
        method: options.method || "GET",
        credentials: "include",
        headers,
        body: options.body === undefined ? undefined : JSON.stringify(options.body),
      });
      const body = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(`${options.method || "GET"} ${path}: ${response.status} ${JSON.stringify(body)}`);
      }
      return body;
    };

    const presentation = await api("/presentations", {
      method: "POST",
      body: { title: "تست ویرایشگر سؤال", settings: {} },
    });
    const slide = await api(`/presentations/${presentation.id}/slides`, {
      method: "POST",
      headers: { "If-Match": String(presentation.revision) },
      body: {
        position: 0,
        kind: "question",
        content: {
          title: "",
          text: "پایتخت ایران کدام است؟",
          question_type: "single",
          question_time: 30,
          min_point: 0,
          max_point: 100,
          image_url: "",
          faster_answers_more_points: false,
          partial_scoring: false,
          show_leaderboard_after: true,
          options: [
            { id: crypto.randomUUID(), text: "تهران", is_correct: true, image_url: "", order: 1 },
            { id: crypto.randomUUID(), text: "شیراز", is_correct: false, image_url: "", order: 2 },
          ],
        },
      },
    });

    return {
      presentationId: presentation.id,
      slideId: slide.id,
    };
  });

  await page.goto(`/manager/panel/${fixture.presentationId}`);
  await page.getByRole("button", { name: "محتوا", exact: true }).click();
  await expect(page.getByRole("complementary", { name: "تنظیمات سؤال" })).toBeVisible();
  await expectAccessible(page, "question editor");

  const preview = page.getByRole("region", { name: "پیش‌نمایش سؤال" });
  await expect(preview).toBeVisible();
  const questionInput = page.getByRole("textbox", { name: "متن سؤال", exact: true });
  const timeInput = page.getByLabel("زمان پاسخ به ثانیه");
  await questionInput.fill("پایتخت ایران را انتخاب کنید");
  await timeInput.fill("۴۵");

  await expect(
    preview.getByText("پایتخت ایران را انتخاب کنید", { exact: true }),
  ).toBeVisible();
  await expect(preview.getByText("۴۵ ثانیه", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "انتقال گزینه ۱ به پایین" }).click();
  await expect(page.getByPlaceholder("متن گزینه ۱")).toHaveValue("شیراز");
  await expect(
    preview.getByRole("article", { name: /گزینه ۱: شیراز/ }),
  ).toBeVisible();
  await expect(
    preview.getByText("تغییرات ذخیره‌نشده", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText("تغییرات ذخیره‌نشده دارید.")).toBeVisible();

  const saveResponsePromise = page.waitForResponse(
    (response) =>
      response.request().method() === "PUT" &&
      new URL(response.url()).pathname.endsWith(
        `/api/v1/presentations/${fixture.presentationId}/slides/${fixture.slideId}`,
      ),
  );
  await page.getByRole("button", { name: "ذخیره تغییرات" }).click();
  const saveResponse = await saveResponsePromise;
  expect(saveResponse.status()).toBe(200);
  const savedSlide = await saveResponse.json();
  expect(savedSlide.content.text).toBe("پایتخت ایران را انتخاب کنید");
  expect(savedSlide.content.question_time).toBe(45);
  expect(savedSlide.content.options[0].text).toBe("شیراز");
  expect(savedSlide.content.options[0].order).toBe(1);
  await expect(page.getByText("همه تغییرات ذخیره شده است.")).toBeVisible();
  await expect(
    preview.getByText("تغییرات ذخیره‌نشده", { exact: true }),
  ).toBeHidden();

  await questionInput.fill("ویرایش موقت برای رد");
  await expect(
    preview.getByText("ویرایش موقت برای رد", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "بستن تنظیمات سؤال" }).click();
  const discardDialog = page.getByRole("alertdialog");
  await expect(discardDialog).toContainText("تغییرات ذخیره‌نشده این سؤال از بین می‌رود");
  await discardDialog.getByRole("button", { name: "رد تغییرات" }).click();
  await expect(page.getByRole("complementary", { name: "تنظیمات سؤال" })).toBeHidden();
  await expect(
    preview.getByText("پایتخت ایران را انتخاب کنید", { exact: true }),
  ).toBeVisible();

  await page.getByRole("button", { name: "محتوا", exact: true }).click();
  await expect(page.getByRole("complementary", { name: "تنظیمات سؤال" })).toBeVisible();
  await questionInput.fill("نسخه محلی که نباید بی‌صدا از بین برود");
  await expect(
    preview.getByText("نسخه محلی که نباید بی‌صدا از بین برود", { exact: true }),
  ).toBeVisible();

  await page.evaluate(
    async ({ presentationId, slideId, revision, content }) => {
      const cookieValue = (name) => {
        const prefix = `${encodeURIComponent(name)}=`;
        const item = document.cookie.split("; ").find((part) => part.startsWith(prefix));
        return item ? decodeURIComponent(item.slice(prefix.length)) : "";
      };
      const headers = new Headers({
        "Content-Type": "application/json",
        "If-Match": String(revision),
      });
      const csrf = cookieValue("proslides_csrf");
      if (csrf) headers.set("X-CSRF-Token", csrf);

      const response = await fetch(
        `/api/v1/presentations/${presentationId}/slides/${slideId}`,
        {
          method: "PUT",
          credentials: "include",
          headers,
          body: JSON.stringify({
            position: 0,
            kind: "question",
            content: {
              ...content,
              text: "نسخه جدید سرور",
            },
          }),
        },
      );
      if (!response.ok) {
        throw new Error(`external editor mutation failed: ${response.status}`);
      }
    },
    {
      presentationId: fixture.presentationId,
      slideId: fixture.slideId,
      revision: savedSlide.revision,
      content: savedSlide.content,
    },
  );

  const conflictResponsePromise = page.waitForResponse(
    (response) =>
      response.request().method() === "PUT" &&
      response.status() === 409 &&
      new URL(response.url()).pathname.endsWith(
        `/api/v1/presentations/${fixture.presentationId}/slides/${fixture.slideId}`,
      ),
  );
  await page.getByRole("button", { name: "ذخیره تغییرات" }).click();
  await conflictResponsePromise;

  await expect(
    page.getByText(/نسخه جدیدتری از این سؤال ذخیره شده است/),
  ).toBeVisible();
  await expect(questionInput).toHaveValue("نسخه محلی که نباید بی‌صدا از بین برود");
  await expect(
    preview.getByText("نسخه محلی که نباید بی‌صدا از بین برود", { exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "ذخیره تغییرات" })).toBeDisabled();

  await page.getByRole("button", { name: "بارگذاری نسخه سرور" }).click();
  const conflictDialog = page.getByRole("alertdialog");
  await expect(conflictDialog).toBeVisible();
  await expect(conflictDialog).toContainText("تغییرات محلی این پنل از بین می‌رود");
  await conflictDialog.getByRole("button", { name: "بارگذاری نسخه سرور" }).click();

  await expect(page.getByRole("complementary", { name: "تنظیمات سؤال" })).toBeHidden();
  await page.getByRole("button", { name: "محتوا", exact: true }).click();
  await expect(page.getByRole("textbox", { name: "متن سؤال", exact: true })).toHaveValue("نسخه جدید سرور");
  await expect(preview.getByText("نسخه جدید سرور", { exact: true })).toBeVisible();

  expect(failures).toEqual([]);
});


test("content editor projects unsaved draft and preserves it across edit conflicts", async ({ page }) => {
  test.setTimeout(90000);
  const failures = watchRuntime(page);
  const unique = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const email = `content-editor-${unique}@example.com`;

  await page.goto("/signup");
  await page.locator('input[name="email"]').fill(email);
  await page.locator('input[name="password"]').fill("BrowserPass!42");
  await page.locator('input[name="fullName"]').fill("مدیر تست محتوای ارائه");
  await page.locator('button[type="submit"]').click();
  await expect(page).toHaveURL(/\/manager\/panel$/);

  const fixture = await page.evaluate(async () => {
    const cookieValue = (name) => {
      const prefix = `${encodeURIComponent(name)}=`;
      const item = document.cookie.split("; ").find((part) => part.startsWith(prefix));
      return item ? decodeURIComponent(item.slice(prefix.length)) : "";
    };
    const api = async (path, options = {}) => {
      const headers = new Headers(options.headers || {});
      headers.set("Content-Type", "application/json");
      const csrf = cookieValue("proslides_csrf");
      if (csrf) headers.set("X-CSRF-Token", csrf);
      const response = await fetch(`/api/v1${path}`, {
        method: options.method || "GET",
        credentials: "include",
        headers,
        body: options.body === undefined ? undefined : JSON.stringify(options.body),
      });
      const body = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(`${options.method || "GET"} ${path}: ${response.status} ${JSON.stringify(body)}`);
      }
      return body;
    };

    const presentation = await api("/presentations", {
      method: "POST",
      body: { title: "تست ویرایشگر محتوا", settings: {} },
    });
    const slide = await api(`/presentations/${presentation.id}/slides`, {
      method: "POST",
      headers: { "If-Match": String(presentation.revision) },
      body: {
        position: 0,
        kind: "content",
        content: {
          title: "عنوان اولیه",
          text: "متن اولیه",
          image_url: "",
        },
      },
    });

    return {
      presentationId: presentation.id,
      slideId: slide.id,
    };
  });

  await page.goto(`/manager/panel/${fixture.presentationId}`);
  await page.getByRole("button", { name: "محتوا", exact: true }).click();

  const inspector = page.getByRole("complementary", {
    name: "تنظیمات اسلاید محتوا",
  });
  const preview = page.getByRole("region", {
    name: "پیش‌نمایش اسلاید محتوا",
  });
  await expect(inspector).toBeVisible();
  await expect(preview).toBeVisible();
  await expectAccessible(page, "content editor");

  const titleInput = inspector.getByRole("textbox", {
    name: "عنوان",
    exact: true,
  });
  const textInput = inspector.getByRole("textbox", {
    name: "متن",
    exact: true,
  });

  await titleInput.fill("عنوان ذخیره‌نشده");
  await textInput.fill("متن ذخیره‌نشده\nبا خط دوم");

  await expect(
    preview.getByText("عنوان ذخیره‌نشده", { exact: true }),
  ).toBeVisible();
  await expect(
    preview.getByText("متن ذخیره‌نشده\nبا خط دوم", { exact: true }),
  ).toBeVisible();
  await expect(
    preview.getByText("تغییرات ذخیره‌نشده", { exact: true }),
  ).toBeVisible();

  const saveResponsePromise = page.waitForResponse(
    (response) =>
      response.request().method() === "PUT" &&
      new URL(response.url()).pathname.endsWith(
        `/api/v1/presentations/${fixture.presentationId}/slides/${fixture.slideId}`,
      ),
  );
  await inspector.getByRole("button", { name: "ذخیره تغییرات" }).click();
  const saveResponse = await saveResponsePromise;
  expect(saveResponse.status()).toBe(200);
  const savedSlide = await saveResponse.json();
  expect(savedSlide.content.title).toBe("عنوان ذخیره‌نشده");
  expect(savedSlide.content.text).toBe("متن ذخیره‌نشده\nبا خط دوم");
  await expect(
    inspector.getByText("همه تغییرات ذخیره شده است."),
  ).toBeVisible();
  await expect(
    inspector.getByRole("button", { name: "ذخیره تغییرات" }),
  ).toBeDisabled();
  await expect(
    preview.getByText("تغییرات ذخیره‌نشده", { exact: true }),
  ).toBeHidden();

  await titleInput.fill("عنوان موقت برای رد");
  await expect(
    preview.getByText("عنوان موقت برای رد", { exact: true }),
  ).toBeVisible();
  await inspector
    .getByRole("button", { name: "بستن تنظیمات اسلاید محتوا" })
    .click();

  const discardDialog = page.getByRole("alertdialog");
  await expect(discardDialog).toContainText(
    "تغییرات ذخیره‌نشده این اسلاید محتوا از بین می‌رود",
  );
  await discardDialog.getByRole("button", { name: "رد تغییرات" }).click();
  await expect(inspector).toBeHidden();
  await expect(
    preview.getByText("عنوان ذخیره‌نشده", { exact: true }),
  ).toBeVisible();

  await page.getByRole("button", { name: "محتوا", exact: true }).click();
  await expect(inspector).toBeVisible();
  await titleInput.fill("نسخه محلی محتوا که باید حفظ شود");
  await expect(
    preview.getByText("نسخه محلی محتوا که باید حفظ شود", { exact: true }),
  ).toBeVisible();

  await page.evaluate(
    async ({ presentationId, slideId, revision, content }) => {
      const cookieValue = (name) => {
        const prefix = `${encodeURIComponent(name)}=`;
        const item = document.cookie.split("; ").find((part) => part.startsWith(prefix));
        return item ? decodeURIComponent(item.slice(prefix.length)) : "";
      };
      const headers = new Headers({
        "Content-Type": "application/json",
        "If-Match": String(revision),
      });
      const csrf = cookieValue("proslides_csrf");
      if (csrf) headers.set("X-CSRF-Token", csrf);

      const response = await fetch(
        `/api/v1/presentations/${presentationId}/slides/${slideId}`,
        {
          method: "PUT",
          credentials: "include",
          headers,
          body: JSON.stringify({
            position: 0,
            kind: "content",
            content: {
              ...content,
              title: "نسخه جدید سرور برای محتوا",
            },
          }),
        },
      );
      if (!response.ok) {
        throw new Error(`external content mutation failed: ${response.status}`);
      }
    },
    {
      presentationId: fixture.presentationId,
      slideId: fixture.slideId,
      revision: savedSlide.revision,
      content: savedSlide.content,
    },
  );

  const conflictResponsePromise = page.waitForResponse(
    (response) =>
      response.request().method() === "PUT" &&
      response.status() === 409 &&
      new URL(response.url()).pathname.endsWith(
        `/api/v1/presentations/${fixture.presentationId}/slides/${fixture.slideId}`,
      ),
  );
  await inspector.getByRole("button", { name: "ذخیره تغییرات" }).click();
  await conflictResponsePromise;

  await expect(
    inspector.getByText(/نسخه جدیدتری از این اسلاید ذخیره شده است/),
  ).toBeVisible();
  await expect(titleInput).toHaveValue("نسخه محلی محتوا که باید حفظ شود");
  await expect(
    preview.getByText("نسخه محلی محتوا که باید حفظ شود", { exact: true }),
  ).toBeVisible();
  await expect(
    inspector.getByRole("button", { name: "ذخیره تغییرات" }),
  ).toBeDisabled();

  await inspector.getByRole("button", { name: "بارگذاری نسخه سرور" }).click();
  const conflictDialog = page.getByRole("alertdialog");
  await expect(conflictDialog).toContainText(
    "تغییرات محلی این پنل از بین می‌رود",
  );
  await conflictDialog
    .getByRole("button", { name: "بارگذاری نسخه سرور" })
    .click();

  await expect(inspector).toBeHidden();
  await page.getByRole("button", { name: "محتوا", exact: true }).click();
  await expect(inspector).toBeVisible();
  await expect(titleInput).toHaveValue("نسخه جدید سرور برای محتوا");
  await expect(
    preview.getByText("نسخه جدید سرور برای محتوا", { exact: true }),
  ).toBeVisible();

  expect(failures).toEqual([]);
});


test("design editor projects a contrast-safe presentation draft and preserves conflicts", async ({ page }) => {
  test.setTimeout(90000);
  const failures = watchRuntime(page);
  const unique = String(Date.now()) + "-" + Math.random().toString(16).slice(2);
  const email = "design-editor-" + unique + "@example.com";

  await page.goto("/signup");
  await page.locator('input[name="email"]').fill(email);
  await page.locator('input[name="password"]').fill("BrowserPass!42");
  await page.locator('input[name="fullName"]').fill("مدیر تست طراحی");
  await page.locator('button[type="submit"]').click();
  await expect(page).toHaveURL(/\/manager\/panel$/);

  const fixture = await page.evaluate(async () => {
    const cookieValue = (name) => {
      const prefix = encodeURIComponent(name) + "=";
      const item = document.cookie.split("; ").find((part) => part.startsWith(prefix));
      return item ? decodeURIComponent(item.slice(prefix.length)) : "";
    };
    const api = async (path, options = {}) => {
      const headers = new Headers(options.headers || {});
      headers.set("Content-Type", "application/json");
      const csrf = cookieValue("proslides_csrf");
      if (csrf) headers.set("X-CSRF-Token", csrf);
      const response = await fetch("/api/v1" + path, {
        method: options.method || "GET",
        credentials: "include",
        headers,
        body: options.body === undefined ? undefined : JSON.stringify(options.body),
      });
      const body = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error((options.method || "GET") + " " + path + ": " + response.status + " " + JSON.stringify(body));
      }
      return body;
    };

    const presentation = await api("/presentations", {
      method: "POST",
      body: {
        title: "تست طراحی ارائه",
        settings: {
          background_color: "#ffffff",
          text_color: "#111827",
          background_image_url: "",
        },
      },
    });
    const slide = await api("/presentations/" + presentation.id + "/slides", {
      method: "POST",
      headers: { "If-Match": String(presentation.revision) },
      body: {
        position: 0,
        kind: "content",
        content: {
          title: "پیش‌نمایش طراحی",
          text: "متن نمونه برای طراحی",
          image_url: "",
        },
      },
    });

    return {
      presentationId: presentation.id,
      slideId: slide.id,
    };
  });

  await page.goto("/manager/panel/" + fixture.presentationId);
  const preview = page.getByRole("region", {
    name: "پیش‌نمایش اسلاید محتوا",
  });
  await expect(preview).toBeVisible();

  await page.getByRole("button", { name: "طراحی", exact: true }).click();
  const inspector = page.getByRole("complementary", {
    name: "تنظیمات طراحی ارائه",
  });
  await expect(inspector).toBeVisible();
  await expectAccessible(page, "design editor");

  const backgroundInput = inspector.locator("#design-background-custom");
  const textInput = inspector.locator("#design-text-custom");

  await backgroundInput.fill("#312e81");
  await expect.poll(async () =>
    preview.evaluate((element) =>
      getComputedStyle(element).getPropertyValue("--live-bg").trim()
    )
  ).toBe("#312e81");
  await expect.poll(async () =>
    preview.evaluate((element) =>
      getComputedStyle(element).getPropertyValue("--live-fg").trim()
    )
  ).toBe("#ffffff");
  await expect(
    preview.getByText("طراحی ذخیره‌نشده", { exact: true }),
  ).toBeVisible();

  await backgroundInput.fill("#ffffff");
  await textInput.fill("#ffffff");
  await expect(textInput).toHaveValue("#0f172a");
  await expect.poll(async () =>
    preview.evaluate((element) =>
      getComputedStyle(element).getPropertyValue("--live-fg").trim()
    )
  ).toBe("#0f172a");

  await backgroundInput.fill("#312e81");
  const saveResponsePromise = page.waitForResponse(
    (response) =>
      response.request().method() === "PATCH" &&
      new URL(response.url()).pathname.endsWith(
        "/api/v1/presentations/" + fixture.presentationId,
      ),
  );
  await inspector.getByRole("button", { name: "ذخیره طراحی" }).click();
  const saveResponse = await saveResponsePromise;
  expect(saveResponse.status()).toBe(200);
  const savedPresentation = await saveResponse.json();
  expect(savedPresentation.settings.background_color).toBe("#312e81");
  expect(savedPresentation.settings.text_color).toBe("#ffffff");
  await expect(
    inspector.getByText(/طراحی ذخیره شده است/),
  ).toBeVisible();

  await backgroundInput.fill("#f0fdf4");
  await expect.poll(async () =>
    preview.evaluate((element) =>
      getComputedStyle(element).getPropertyValue("--live-bg").trim()
    )
  ).toBe("#f0fdf4");

  await inspector
    .getByRole("button", { name: "بستن تنظیمات طراحی" })
    .click();
  const discardDialog = page.getByRole("alertdialog");
  await expect(discardDialog).toContainText(
    "تغییرات ذخیره‌نشده طراحی از بین می‌رود",
  );
  await discardDialog.getByRole("button", { name: "رد تغییرات" }).click();
  await expect(inspector).toBeHidden();
  await expect.poll(async () =>
    preview.evaluate((element) =>
      getComputedStyle(element).getPropertyValue("--live-bg").trim()
    )
  ).toBe("#312e81");

  await page.getByRole("button", { name: "طراحی", exact: true }).click();
  await expect(inspector).toBeVisible();
  await backgroundInput.fill("#eff6ff");
  await expect.poll(async () =>
    preview.evaluate((element) =>
      getComputedStyle(element).getPropertyValue("--live-bg").trim()
    )
  ).toBe("#eff6ff");

  await page.evaluate(
    async ({ presentationId, revision }) => {
      const cookieValue = (name) => {
        const prefix = encodeURIComponent(name) + "=";
        const item = document.cookie.split("; ").find((part) => part.startsWith(prefix));
        return item ? decodeURIComponent(item.slice(prefix.length)) : "";
      };
      const headers = new Headers({
        "Content-Type": "application/json",
        "If-Match": String(revision),
      });
      const csrf = cookieValue("proslides_csrf");
      if (csrf) headers.set("X-CSRF-Token", csrf);

      const response = await fetch(
        "/api/v1/presentations/" + presentationId,
        {
          method: "PATCH",
          credentials: "include",
          headers,
          body: JSON.stringify({
            settings: {
              background_color: "#111111",
              text_color: "#ffffff",
            },
          }),
        },
      );
      if (!response.ok) {
        throw new Error("external design mutation failed: " + response.status);
      }
    },
    {
      presentationId: fixture.presentationId,
      revision: savedPresentation.revision,
    },
  );

  const conflictResponsePromise = page.waitForResponse(
    (response) =>
      response.request().method() === "PATCH" &&
      response.status() === 409 &&
      new URL(response.url()).pathname.endsWith(
        "/api/v1/presentations/" + fixture.presentationId,
      ),
  );
  await inspector.getByRole("button", { name: "ذخیره طراحی" }).click();
  await conflictResponsePromise;

  await expect(
    inspector.getByText(/طراحی ارائه جای دیگری تغییر کرده است/),
  ).toBeVisible();
  await expect(backgroundInput).toHaveValue("#eff6ff");
  await expect.poll(async () =>
    preview.evaluate((element) =>
      getComputedStyle(element).getPropertyValue("--live-bg").trim()
    )
  ).toBe("#eff6ff");
  await expect(
    inspector.getByRole("button", { name: "ذخیره طراحی" }),
  ).toBeDisabled();

  await inspector.getByRole("button", { name: "بارگذاری نسخه سرور" }).click();
  const conflictDialog = page.getByRole("alertdialog");
  await expect(conflictDialog).toContainText(
    "تغییرات محلی از بین می‌رود",
  );
  await conflictDialog
    .getByRole("button", { name: "بارگذاری نسخه سرور" })
    .click();

  await expect(inspector).toBeHidden();
  await expect.poll(async () =>
    preview.evaluate((element) =>
      getComputedStyle(element).getPropertyValue("--live-bg").trim()
    )
  ).toBe("#111111");

  await page.getByRole("button", { name: "طراحی", exact: true }).click();
  await expect(inspector).toBeVisible();
  await expect(backgroundInput).toHaveValue("#111111");
  await expect(textInput).toHaveValue("#ffffff");

  expect(failures).toEqual([]);
});


test("audio editor validates, saves, discards, and preserves local draft across conflicts", async ({ page }) => {
  test.setTimeout(90000);
  const failures = watchRuntime(page);
  const unique = String(Date.now()) + "-" + Math.random().toString(16).slice(2);
  const email = "audio-editor-" + unique + "@example.com";
  const tinyWav = Buffer.from(
    "UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=",
    "base64",
  );

  await page.route("https://audio.example.test/**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "audio/wav",
      body: tinyWav,
    });
  });

  await page.goto("/signup");
  await page.locator('input[name="email"]').fill(email);
  await page.locator('input[name="password"]').fill("BrowserPass!42");
  await page.locator('input[name="fullName"]').fill("مدیر تست صدای ارائه");
  await page.locator('button[type="submit"]').click();
  await expect(page).toHaveURL(/\/manager\/panel$/);

  const fixture = await page.evaluate(async () => {
    const cookieValue = (name) => {
      const prefix = encodeURIComponent(name) + "=";
      const item = document.cookie.split("; ").find((part) => part.startsWith(prefix));
      return item ? decodeURIComponent(item.slice(prefix.length)) : "";
    };
    const headers = new Headers({ "Content-Type": "application/json" });
    const csrf = cookieValue("proslides_csrf");
    if (csrf) headers.set("X-CSRF-Token", csrf);
    const response = await fetch("/api/v1/presentations", {
      method: "POST",
      credentials: "include",
      headers,
      body: JSON.stringify({
        title: "تست صدای ارائه",
        settings: {},
      }),
    });
    const body = await response.json();
    if (!response.ok) {
      throw new Error("create presentation failed: " + response.status);
    }
    return { presentationId: body.id };
  });

  await page.goto("/manager/panel/" + fixture.presentationId);
  await page.getByRole("button", { name: "صدا", exact: true }).click();

  const inspector = page.getByRole("complementary", {
    name: "تنظیمات صدای ارائه",
  });
  await expect(inspector).toBeVisible();
  await expectAccessible(page, "audio editor");

  const urlInput = inspector.getByRole("textbox", {
    name: "نشانی صدا",
    exact: true,
  });
  const saveButton = inspector.getByRole("button", {
    name: "ذخیره صدا",
  });

  await urlInput.fill("javascript:alert(1)");
  await expect(
    inspector.getByText(/آدرس فایل صوتی باید با http:\/\/ یا https:\/\//),
  ).toBeVisible();
  await expect(saveButton).toBeDisabled();

  await urlInput.fill("https://audio.example.test/saved.wav");
  await expect(saveButton).toBeEnabled();
  await expect(
    inspector.getByText("تغییرات صدای ذخیره‌نشده دارید.", { exact: true }),
  ).toBeVisible();

  const saveResponsePromise = page.waitForResponse(
    (response) =>
      response.request().method() === "PATCH" &&
      new URL(response.url()).pathname.endsWith(
        "/api/v1/presentations/" + fixture.presentationId,
      ),
  );
  await saveButton.click();
  const saveResponse = await saveResponsePromise;
  expect(saveResponse.status()).toBe(200);
  const savedPresentation = await saveResponse.json();
  expect(savedPresentation.settings.music_url).toBe(
    "https://audio.example.test/saved.wav",
  );
  await expect(
    inspector.getByText(/تنظیمات صدا ذخیره شده است/),
  ).toBeVisible();
  await expect(saveButton).toBeDisabled();

  await urlInput.fill("https://audio.example.test/temporary.wav");
  await inspector
    .getByRole("button", { name: "بستن تنظیمات صدای ارائه" })
    .click();
  const discardDialog = page.getByRole("alertdialog");
  await expect(discardDialog).toContainText(
    "تغییرات ذخیره‌نشده صدای ارائه از بین می‌رود",
  );
  await discardDialog.getByRole("button", { name: "رد تغییرات" }).click();
  await expect(inspector).toBeHidden();

  await page.getByRole("button", { name: "صدا", exact: true }).click();
  await expect(inspector).toBeVisible();
  await expect(urlInput).toHaveValue("https://audio.example.test/saved.wav");

  await urlInput.fill("https://audio.example.test/local.wav");

  await page.evaluate(
    async ({ presentationId, revision }) => {
      const cookieValue = (name) => {
        const prefix = encodeURIComponent(name) + "=";
        const item = document.cookie.split("; ").find((part) => part.startsWith(prefix));
        return item ? decodeURIComponent(item.slice(prefix.length)) : "";
      };
      const headers = new Headers({
        "Content-Type": "application/json",
        "If-Match": String(revision),
      });
      const csrf = cookieValue("proslides_csrf");
      if (csrf) headers.set("X-CSRF-Token", csrf);

      const response = await fetch(
        "/api/v1/presentations/" + presentationId,
        {
          method: "PATCH",
          credentials: "include",
          headers,
          body: JSON.stringify({
            settings: {
              music_url: "https://audio.example.test/server.wav",
            },
          }),
        },
      );
      if (!response.ok) {
        throw new Error("external audio mutation failed: " + response.status);
      }
    },
    {
      presentationId: fixture.presentationId,
      revision: savedPresentation.revision,
    },
  );

  const conflictResponsePromise = page.waitForResponse(
    (response) =>
      response.request().method() === "PATCH" &&
      response.status() === 409 &&
      new URL(response.url()).pathname.endsWith(
        "/api/v1/presentations/" + fixture.presentationId,
      ),
  );
  await saveButton.click();
  await conflictResponsePromise;

  await expect(
    inspector.getByText(/تنظیمات ارائه جای دیگری تغییر کرده است/),
  ).toBeVisible();
  await expect(urlInput).toHaveValue("https://audio.example.test/local.wav");
  await expect(saveButton).toBeDisabled();

  await inspector.getByRole("button", { name: "بارگذاری نسخه سرور" }).click();
  const conflictDialog = page.getByRole("alertdialog");
  await expect(conflictDialog).toContainText(
    "تغییرات صدای محلی از بین می‌رود",
  );
  await conflictDialog
    .getByRole("button", { name: "بارگذاری نسخه سرور" })
    .click();

  await expect(inspector).toBeHidden();
  await page.getByRole("button", { name: "صدا", exact: true }).click();
  await expect(inspector).toBeVisible();
  await expect(urlInput).toHaveValue("https://audio.example.test/server.wav");

  expect(failures).toEqual([]);
});
