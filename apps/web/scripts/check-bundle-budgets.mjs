import { readFileSync, statSync } from "node:fs";
import { gzipSync } from "node:zlib";

const root = new URL("../", import.meta.url);
const dist = new URL("dist/", root);
const manifest = JSON.parse(readFileSync(new URL(".vite/manifest.json", dist), "utf8"));
const budgets = JSON.parse(readFileSync(new URL("bundle-budgets.json", root), "utf8"));
const entry = manifest["index.html"];

if (!entry?.isEntry) throw new Error("Vite entry is missing from dist/.vite/manifest.json");

const kib = (bytes) => bytes / 1024;
const gzipKiB = (file) => kib(gzipSync(readFileSync(new URL(file, dist))).byteLength);
const rawKiB = (file) => kib(statSync(new URL(file, dist)).size);
const html = readFileSync(new URL("index.html", dist), "utf8");
const initialJavaScript = gzipKiB(entry.file);
const initialCss = (entry.css || []).reduce((total, file) => total + gzipKiB(file), 0);
const routes = Object.values(manifest).filter(({ isDynamicEntry }) => isDynamicEntry);
const largestRoute = routes
  .map(({ file, src }) => ({ file, src, gzipKiB: gzipKiB(file) }))
  .sort((a, b) => b.gzipKiB - a.gzipKiB)[0];
const javascript = Object.values(manifest)
  .filter(({ file }) => file?.endsWith(".js"))
  .map(({ file }) => ({ file, rawKiB: rawKiB(file) }))
  .sort((a, b) => b.rawKiB - a.rawKiB)[0];
const modulePreloads = (html.match(/rel="modulepreload"/g) || []).length;

const measurements = {
  initialJavaScriptGzipKiB: initialJavaScript,
  initialCssGzipKiB: initialCss,
  largestRouteJavaScriptGzipKiB: largestRoute.gzipKiB,
  largestJavaScriptRawKiB: javascript.rawKiB,
  initialModulePreloads: modulePreloads,
};

for (const [metric, actual] of Object.entries(measurements)) {
  const limit = budgets[metric];
  if (typeof limit !== "number" || actual > limit) {
    throw new Error(`${metric} ${actual.toFixed(2)} exceeds budget ${limit}`);
  }
}

console.log(JSON.stringify({
  ...Object.fromEntries(Object.entries(measurements).map(([key, value]) => [key, Number(value.toFixed(2))])),
  largestRoute: largestRoute.src,
  largestJavaScript: javascript.file,
}, null, 2));
