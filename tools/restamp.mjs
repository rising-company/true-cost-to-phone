// Rewrites the strings in index.html that are derived from data/pricing.json.
//
//   node tools/restamp.mjs           # rewrite in place
//   node tools/restamp.mjs --check   # exit 1 if it would change anything
//
// Run it after every re-crawl, before regenerating the card and the pages. The
// strings it owns — the ?v= cache stamp, the headline spread in the tags, the six
// totals in the alt text, the two dataset dates, the no-JS hero line, the footer —
// all move together, and a page that advertises one number while showing another
// is worse than one that is simply a week old.

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { stampIndex } from "../og.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const data = JSON.parse(readFileSync(join(ROOT, "data/pricing.json"), "utf8"));
const path = join(ROOT, "index.html");
const before = readFileSync(path, "utf8");
const after = stampIndex(before, data);

if (before === after) {
  console.log(`index.html already matches the data (crawled ${data.meta.crawledAt})`);
  process.exit(0);
}
if (process.argv.includes("--check")) {
  console.error(`index.html is stale against data crawled ${data.meta.crawledAt}. Run: node tools/restamp.mjs`);
  process.exit(1);
}
writeFileSync(path, after);
console.log(`index.html restamped to ${data.meta.crawledAt}`);
