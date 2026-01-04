import fs from "node:fs";
import path from "node:path";

const sitemapPath = path.resolve("public", "sitemap.xml");
const sitemap = fs.readFileSync(sitemapPath, "utf8");
const today = new Date().toISOString().slice(0, 10);

let updated = sitemap.replace(
  /<lastmod>.*?<\/lastmod>/g,
  `<lastmod>${today}</lastmod>`
);

if (!updated.includes("<lastmod>")) {
  updated = updated.replace(
    /(<loc>[^<]+<\/loc>\s*)(<changefreq>)/g,
    `$1<lastmod>${today}</lastmod>\n    $2`
  );
}

if (updated !== sitemap) {
  fs.writeFileSync(sitemapPath, updated, "utf8");
  console.log(`Updated sitemap lastmod to ${today}.`);
} else {
  console.log("Sitemap lastmod already up to date.");
}
