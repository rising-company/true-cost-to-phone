// Run: node --test tests/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { pairSlug, carrierSlug, comparePages, carrierPages, sitemap } from "../seo.js";
import { SWITCHER_SCENARIO } from "../scenario.js";

const data = JSON.parse(readFileSync(new URL("../data/pricing.json", import.meta.url), "utf8"));

test("a pair has one slug whichever way round it is asked for", () => {
  assert.equal(pairSlug("verizon", "tmobile"), "tmobile-vs-verizon-iphone-18-pro");
  assert.equal(pairSlug("tmobile", "verizon"), "tmobile-vs-verizon-iphone-18-pro");
});

test("carrier slugs read like the query they answer", () => {
  assert.equal(carrierSlug("xfinity"), "xfinity-mobile-iphone-18-pro-cost");
  assert.equal(carrierSlug("att"), "att-iphone-18-pro-cost");
});

test("every pair of carriers gets a page, and no pair twice", () => {
  const pages = comparePages(data);
  const n = data.carriers.length;
  assert.equal(pages.length, (n * (n - 1)) / 2, "one page per unordered pair");
  assert.equal(new Set(pages.map((p) => p.slug)).size, pages.length, "slugs are unique");
});

test("a comparison page names the cheaper carrier and the gap between them", () => {
  const page = comparePages(data).find((p) => p.slug === "tmobile-vs-verizon-iphone-18-pro");
  assert.equal(page.cheaper.carrierId, "verizon", "Verizon is cheaper than T-Mobile here");
  assert.equal(page.gap, page.pricier.total - page.cheaper.total);
  assert.ok(page.gap > 0, "a gap the page can actually quote");
  assert.equal(page.sides.length, 2);
  for (const side of page.sides) {
    assert.ok(side.best.total > 0, `${side.carrierId} has a priced best route`);
    assert.ok(side.top.length > 0 && side.top.length <= 3, `${side.carrierId} shows up to three routes`);
  }
});

test("a comparison page deep-links into the Compare tab with both routes picked", () => {
  const page = comparePages(data).find((p) => p.slug === "tmobile-vs-verizon-iphone-18-pro");
  const [a, b] = page.sides;
  assert.equal(page.toolUrl, `/?l=iphone-18-pro-256:-&cmp=${a.best.key},${b.best.key}&tab=compare`, "opens on the no-trade-in situation the page priced");
  assert.match(a.best.key, /^[a-z]+\|[a-z0-9-]+\|[a-z0-9-]+$/, "a routeKey the page can hand the tool");
});

test("one page per carrier, deep-linked to that carrier's filter", () => {
  const pages = carrierPages(data);
  assert.equal(pages.length, data.carriers.length);
  const xfinity = pages.find((p) => p.carrierId === "xfinity");
  assert.equal(xfinity.toolUrl, "/?l=iphone-18-pro-256:-&carrier=xfinity", "opens on the no-trade-in situation the page priced");
  assert.ok(xfinity.routes.length > 1, "every route that carrier offers, not just the best");
  const totals = xfinity.routes.map((r) => r.total);
  assert.deepEqual(totals, [...totals].sort((a, b) => a - b), "cheapest first");
});

test("a carrier page measures its promos against that carrier's own buy-outright route", () => {
  const att = carrierPages(data).find((p) => p.carrierId === "att");
  assert.ok(att.baseline, "there is a bring-your-own baseline to compare against");
  assert.equal(att.baseline.route, "byod");
  for (const r of att.routes) assert.equal(r.vsBaseline, r.total - att.baseline.total);
});

test("every page carries the crawl date it was built from", () => {
  for (const page of [...comparePages(data), ...carrierPages(data)]) {
    assert.equal(page.crawledAt, data.meta.crawledAt, `${page.slug} is stamped`);
  }
});

test("the sitemap is well-formed and lists what it is given, once each", () => {
  const xml = sitemap(["https://example.com/", "https://example.com/a"], "2026-09-21");
  assert.match(xml, /^<\?xml version="1\.0" encoding="UTF-8"\?>/);
  assert.match(xml, /<urlset xmlns="http:\/\/www\.sitemaps\.org\/schemas\/sitemap\/0\.9">/);
  assert.equal((xml.match(/<loc>/g) || []).length, 2);
  assert.match(xml, /<loc>https:\/\/example\.com\/a<\/loc>/);
  assert.match(xml, /<lastmod>2026-09-21<\/lastmod>/);
  assert.match(xml, /<\/urlset>\s*$/);
});

/* ── What the deals actually pay ──
   Every promo needs a port-in or a trade-in, so the no-trade-in scenario shows none of
   them. A page answering "is this deal worth it" has to price the case where it is
   on the table, and measure it against buying outright *on the same plan* — which is
   the comparison the carrier's own page never makes. */

test("the switcher situation is a trade-in and a port-in, on the same phone", () => {
  assert.deepEqual(SWITCHER_SCENARIO, {
    lines: 1,
    lineItems: [{ phoneId: "iphone-18-pro-256", tradeInId: "iphone-16-pro" }],
    switching: true,
    costco: false,
    minDataGb: 50,
    minutes: "unlimited",
  });
});

test("a carrier page shows its promos, each against buying outright on that same plan", () => {
  const att = carrierPages(data).find((p) => p.carrierId === "att");
  assert.ok(att.deals.routes.length > 0, "AT&T has deals once a trade-in is on the table");
  assert.ok(att.deals.routes.every((r) => r.route !== "byod"), "the baseline is not itself a deal");
  const extra930 = att.deals.routes.find((r) => r.planId === "att-extra-2");
  assert.equal(extra930.total, 3134);
  assert.equal(extra930.samePlanBaseline, 3044, "Extra 2.0 with the phone bought outright");
  assert.equal(extra930.vsSamePlan, 90, "the $930-off deal still costs $90 more than declining it");
  const premium = att.deals.routes.find((r) => r.planId === "att-premium-2");
  assert.equal(premium.vsSamePlan, -179, "the $1,200 deal wins once the $200 online line credit is not lost against the phone");
});

test("a carrier with no promotions says so rather than inventing one", () => {
  const tello = carrierPages(data).find((p) => p.carrierId === "tello");
  assert.deepEqual(tello.deals.routes, []);
});

test("the deals section names the trade-in it assumed and what Apple pays for it", () => {
  const page = carrierPages(data).find((p) => p.carrierId === "verizon");
  assert.equal(page.deals.tradeInName, "iPhone 16 Pro");
  assert.equal(page.deals.tradeInValue, 510);
});

test("a comparison page also answers the switcher's version of the question", () => {
  const page = comparePages(data).find((p) => p.slug === "tmobile-vs-verizon-iphone-18-pro");
  assert.equal(page.switcher.cheaper.carrierId, "verizon");
  assert.equal(page.switcher.gap, page.switcher.pricier.total - page.switcher.cheaper.total);
  assert.ok(page.switcher.gap > 0);
});

/* ── The generated files themselves ──
   The pages are committed output, like og.png. A sentence that names the wrong
   winner is the one mistake that would make every page worthless, so it is checked
   against the model rather than trusted to a template. */

const page = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("a comparison page says the cheaper carrier is cheaper, not dearer", () => {
  const model = comparePages(data).find((p) => p.slug === "tmobile-vs-verizon-iphone-18-pro");
  const html = page(`compare/${model.slug}.html`);
  assert.ok(
    html.includes(`${model.cheaper.carrierName} is $${model.gap.toLocaleString("en-US")} cheaper`),
    "the headline answer names the winner and the direction",
  );
  assert.ok(!/is \$[\d,]+ more/.test(html), "never phrases the cheaper side as costing more");
});

test("generated pages are regenerated from the current data", () => {
  for (const p of [...comparePages(data), ...carrierPages(data)]) {
    const dir = p.kind === "compare" ? "compare" : "carrier";
    const html = page(`${dir}/${p.slug}.html`);
    assert.ok(html.includes(`Prices ${data.meta.crawledAt}`), `${p.slug} carries the current crawl date`);
  }
});

test("internal links between generated pages resolve to real files", () => {
  const all = [
    ...comparePages(data).map((p) => ["compare", p.slug]),
    ...carrierPages(data).map((p) => ["carrier", p.slug]),
  ];
  const known = new Set(all.map(([dir, slug]) => `/${dir}/${slug}`));
  for (const [dir, slug] of all) {
    const html = page(`${dir}/${slug}.html`);
    const hrefs = [...html.matchAll(/<li><a href="([^"]+)">/g)].map((m) => m[1]);
    assert.ok(hrefs.length > 0, `${slug} links to related pages`);
    for (const href of hrefs) assert.ok(known.has(href), `${slug} links to ${href}, which is not a generated page`);
  }
});
