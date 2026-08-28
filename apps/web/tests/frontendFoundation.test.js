import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = (relativePath) =>
  readFileSync(new URL(`../${relativePath}`, import.meta.url), "utf8");

test("Tailwind and semantic theme have one CSS source", () => {
  const indexCss = source("src/index.css");
  const appCss = source("src/App.css");

  assert.equal((indexCss.match(/@import\s+["']tailwindcss["']/g) || []).length, 1);
  assert.equal((appCss.match(/@import\s+["']tailwindcss["']/g) || []).length, 0);
  assert.match(indexCss, /@theme\s*{/);
  assert.match(indexCss, /--color-brand:/);
  assert.match(indexCss, /--color-danger:/);
});

test("shared notice exposes assertive errors and polite pending or success states", () => {
  const notice = source("src/shared/ui/Notice.tsx");

  assert.match(notice, /isError \? "alert" : "status"/);
  assert.match(notice, /isError \? "assertive" : "polite"/);
  assert.match(notice, /aria-busy={pending \|\| undefined}/);
  assert.match(notice, /aria-atomic="true"/);
});

test("F2 dashboard editor and share slice has no native alerts and owns direction boundaries", () => {
  const paths = [
    "src/components/QuizHeader.jsx",
    "src/components/ShareMenu.jsx",
    "src/components/QuizManager.jsx",
    "src/pages/quiz/manager/EditorPage.jsx",
    "src/pages/quiz/manager/Sidebar.jsx",
    "src/pages/quiz/manager/SlidesPanel.jsx",
  ];
  const combined = paths.map(source).join("\n");

  assert.doesNotMatch(combined, /(?:window\.)?alert\s*\(/);
  assert.match(source("src/components/QuizHeader.jsx"), /dir="auto"/);
  assert.match(source("src/components/ShareMenu.jsx"), /dir="ltr"/);
  assert.match(source("src/components/QuizManager.jsx"), /dir="auto"/);
});
