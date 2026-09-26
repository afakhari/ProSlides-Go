import { expect, test } from "@playwright/test";

async function settleVisualSurface(page) {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.evaluate(async () => {
    await document.fonts.ready;
  });
  await page.waitForTimeout(150);
}

test("landing desktop visual baseline", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/");
  await settleVisualSurface(page);

  await expect(page).toHaveScreenshot("landing-desktop.png", {
    fullPage: true,
    animations: "disabled",
    caret: "hide",
    maxDiffPixelRatio: 0.002,
  });
});

test("authentication mobile visual baseline", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/auth");
  await settleVisualSurface(page);

  await expect(page).toHaveScreenshot("auth-mobile.png", {
    fullPage: true,
    animations: "disabled",
    caret: "hide",
    maxDiffPixelRatio: 0.002,
  });
});

test("participant join mobile visual baseline", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.route(
    "**/api/v1/live/sessions/resolve?join_code=VISUAL1",
    async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          session_id: "11111111-1111-4111-8111-111111111111",
          presentation_id: "22222222-2222-4222-8222-222222222222",
          presentation: {
            title: "آزمون تصویری پایدار",
            background_color: "#0f766e",
            background_image_url: "",
            music_url: "",
            text_color: "#ffffff",
          },
        }),
      });
    },
  );

  await page.goto("/VISUAL1");
  await expect(
    page.getByRole("heading", { name: "به کوئیز بپیوندید" }),
  ).toBeVisible();
  await settleVisualSurface(page);

  await expect(page).toHaveScreenshot("participant-join-mobile.png", {
    fullPage: true,
    animations: "disabled",
    caret: "hide",
    maxDiffPixelRatio: 0.002,
  });
});
