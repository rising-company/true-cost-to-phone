// Run: node --test tests/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { execSync } from "node:child_process";

/* The site lives at true-cost-to-phone.bencao.it. It started at
   true-cost-to-phone.rising.company, and links to that host are out in the world, so the
   old host stays attached to the project and redirects here, path and all. */

const root = new URL("..", import.meta.url);
const OLD = "true-cost-to-phone.rising.company";

test("the old rising.company host redirects permanently to bencao.it, keeping the path", () => {
  const { redirects = [] } = JSON.parse(readFileSync(new URL("vercel.json", root), "utf8"));
  const r = redirects.find((r) => r.has?.some((h) => h.type === "host" && h.value === OLD));
  assert.ok(r, `vercel.json redirects requests for ${OLD}`);
  assert.equal(r.source, "/:path(.*)");
  assert.equal(r.destination, "https://true-cost-to-phone.bencao.it/:path");
  assert.equal(r.permanent, true);
});

test("nothing the site serves or generates still points at the old host", () => {
  // docs/plans is a record of what was planned at the time; the redirect covers it.
  const files = execSync("git ls-files", { cwd: root, encoding: "utf8" })
    .split("\n")
    .filter((f) => /\.(html|js|mjs|xml|txt|md)$/.test(f) && !f.startsWith("docs/plans/") && f !== "tests/host.test.mjs");
  const stale = files.filter((f) => readFileSync(new URL(f, root), "utf8").includes(OLD));
  assert.deepEqual(stale, []);
});

test("the page credits bencao.it, not Rising Company", () => {
  const html = readFileSync(new URL("index.html", root), "utf8");
  assert.match(html, /<a class="app-byline" href="https:\/\/www\.bencao\.it">by <span>bencao\.it<\/span><\/a>/);
  assert.match(html, /<a class="rising-backlink" href="https:\/\/www\.bencao\.it"[^>]*>bencao\.it<\/a>/);
  assert.doesNotMatch(html, /"name":"Rising Company"/, "JSON-LD names the person who publishes it");
  assert.doesNotMatch(html, /\/\/ Rising Company/, "the hero eyebrow");
});
