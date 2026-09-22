// Run: node --test tests/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { CARD_SCENARIO, cardModel, stampIndex } from "../og.js";
import { HEADLINE_SCENARIO } from "../scenario.js";

const data = JSON.parse(readFileSync(new URL("../data/pricing.json", import.meta.url), "utf8"));

/* What the committed og.png shows. A re-crawl that moves any of these leaves every
   already-shared link advertising a price that is no longer true, so it fails here
   rather than quietly. Regenerate the card and restamp the tags — README, "The
   social card" — then update these. */
const ON_THE_CARD = {
  crawledAt: "2026-09-22",
  cheapestCarrier: "tello",
  cheapestTotal: 1589,
  priciestTotal: 3244,
  spread: 1655,
  carriers: 6,
};

test("the card prices the situation a visitor lands on: one line, an 18 Pro 256, an iPhone 16 Pro to trade, not switching", () => {
  assert.equal(CARD_SCENARIO, HEADLINE_SCENARIO, "card and landing page share one scenario");
  assert.deepEqual(CARD_SCENARIO, {
    lines: 1,
    lineItems: [{ phoneId: "iphone-18-pro-256", tradeInId: "iphone-16-pro" }],
    switching: false,
    costco: false,
    minDataGb: 50,
    minutes: "unlimited",
  });
});

test("one row per carrier, cheapest first", () => {
  const card = cardModel(data);
  assert.equal(card.rows.length, data.carriers.length);
  assert.equal(new Set(card.rows.map((r) => r.carrierId)).size, card.rows.length, "no carrier twice");
  const totals = card.rows.map((r) => r.total);
  assert.deepEqual(totals, [...totals].sort((a, b) => a - b), "sorted cheapest first");
});

test("every bar's segments add up to the total it is labelled with", () => {
  for (const row of cardModel(data).rows) {
    const summed = row.segments.reduce((sum, s) => sum + s.value, 0);
    assert.equal(summed, row.total, `${row.carrierId}: segments sum to the printed total`);
  }
});

test("bar widths are a share of the priciest carrier, so the longest bar fills the track", () => {
  const card = cardModel(data);
  assert.equal(card.rows[card.rows.length - 1].width, 100);
  for (const row of card.rows) assert.ok(row.width > 0 && row.width <= 100, `${row.carrierId} width in range`);
});

test("the numbers on the committed og.png are still the numbers the data produces", () => {
  const card = cardModel(data);
  assert.equal(card.crawledAt, ON_THE_CARD.crawledAt, "regenerate og.png: the data was re-crawled");
  assert.equal(card.rows[0].carrierId, ON_THE_CARD.cheapestCarrier, "regenerate og.png: a different carrier is cheapest");
  assert.equal(card.cheapest, ON_THE_CARD.cheapestTotal, "regenerate og.png: the cheapest total moved");
  assert.equal(card.priciest, ON_THE_CARD.priciestTotal, "regenerate og.png: the priciest total moved");
  assert.equal(card.spread, ON_THE_CARD.spread, "regenerate og.png: the headline spread moved");
  assert.equal(card.rows.length, ON_THE_CARD.carriers, "regenerate og.png: the carrier count changed");
});

/* ── The tags in index.html ──
   Social scrapers cache og:image by URL, so a regenerated card behind an unchanged
   URL keeps serving the old picture to Facebook, Slack and X for days. Stamping the
   crawl date into the query is what makes a re-crawl visible to them. */

const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const meta = (prop) =>
  html.match(new RegExp(`<meta\\s+(?:property|name)="${prop}"\\s+content="([^"]*)"`))?.[1] ?? null;

test("the card is advertised at an absolute URL stamped with the crawl date", () => {
  const image = meta("og:image");
  assert.equal(image, `https://true-cost-to-phone.rising.company/og.png?v=${cardModel(data).crawledAt}`);
  assert.equal(meta("twitter:image"), image, "both scrapers get the same stamped URL");
});

test("the tags a link preview needs are all present", () => {
  for (const prop of ["og:title", "og:description", "og:url", "og:type", "og:image:width", "og:image:height", "og:image:alt"]) {
    assert.ok(meta(prop), `${prop} is set`);
  }
  assert.equal(meta("twitter:card"), "summary_large_image");
  assert.ok(/<link rel="canonical" href="https:\/\/true-cost-to-phone\.rising\.company\/">/.test(html), "canonical URL is set");
});

test("the declared image dimensions match the committed og.png", () => {
  assert.equal(meta("og:image:width"), "2400");
  assert.equal(meta("og:image:height"), "1260");
});

test("the headline in the tags is the spread the data actually produces", () => {
  const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
  const spread = usd.format(cardModel(data).spread);
  assert.ok(meta("og:title").includes(spread), `og:title should quote ${spread}`);
  assert.ok(meta("twitter:title").includes(spread), `twitter:title should quote ${spread}`);
});

/* ── The usage floor ──
   The page only ever shows plans with real data and real minutes; it pins a floor
   when it calls the calculator. A scenario that leaves the floor out silently prices
   plans nobody is shown — a 300-minute Tello plan won the card once — so the floor
   lives in one place and app.js reads it from there. */

test("the headline scenario carries the same usage floor the page applies", () => {
  assert.equal(HEADLINE_SCENARIO.minDataGb, 50);
  assert.equal(HEADLINE_SCENARIO.minutes, "unlimited");
});

test("app.js takes the floor from scenario.js rather than repeating it", () => {
  const app = readFileSync(new URL("../app.js", import.meta.url), "utf8");
  assert.match(app, /import \{[^}]*USAGE_FLOOR[^}]*\} from "\.\/scenario\.js"/, "app.js imports the shared floor");
  assert.match(app, /\.\.\.USAGE_FLOOR/, "and spreads it into the calculator input");
  assert.doesNotMatch(app, /minDataGb:\s*50/, "no second copy of the floor to drift");
});

/* ── Restamping index.html ──
   Eight strings in the landing page are derived from the data: the ?v= stamps, the
   headline spread in the tags, the alt text's six totals, two JSON-LD dates, the
   no-JS hero line and the footer. Hand-editing eight strings after every re-crawl is
   how a page ends up half-updated, so one function derives them all and this test
   proves the committed page is what it derives. */

test("index.html is in sync with the data it was stamped from", () => {
  const current = readFileSync(new URL("../index.html", import.meta.url), "utf8");
  assert.equal(stampIndex(current, data), current, "run `node tools/restamp.mjs` — index.html is stale");
});

test("restamping is idempotent and actually rewrites a stale page", () => {
  const current = readFileSync(new URL("../index.html", import.meta.url), "utf8");
  const stale = current.replace(/og\.png\?v=[\d-]+/g, "og.png?v=1999-01-01");
  assert.notEqual(stale, current, "the fixture is genuinely stale");
  assert.equal(stampIndex(stale, data), current, "restamping repairs it exactly");
  assert.equal(stampIndex(stampIndex(stale, data), data), current, "and settles");
});
