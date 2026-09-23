// True Cost to Phone — the generated comparison pages.
//
// The tool is one URL answering a question people ask in several hundred different
// shapes: "verizon vs t-mobile iphone 18 pro", "is xfinity mobile worth it",
// "t-mobile costco iphone deal". One page cannot rank for all of them, and a page
// that just repeats the landing copy with the nouns swapped is sludge.
//
// Every one of those answers is already computable from data/pricing.json, so each
// page states a real number, names where it came from, and links into the tool
// pre-loaded with the situation it describes. `tools/gen-seo.mjs` renders these.

import { buildScenarios } from "./calc.js";
import { NO_TRADE_IN_SCENARIO, SWITCHER_SCENARIO } from "./scenario.js";

/* The phone every generated page is about — the same one the landing page and the
   social card price. Kept in the slug because that is how the question is typed. */
const PHONE_SLUG = "iphone-18-pro";

/* Carrier ids are short internal keys; slugs should read like the search. */
const SLUG_NAME = {
  tello: "tello",
  mint: "mint-mobile",
  tmobile: "tmobile",
  att: "att",
  verizon: "verizon",
  xfinity: "xfinity-mobile",
};

const slugFor = (carrierId) => SLUG_NAME[carrierId] || carrierId;

/**
 * One URL per pair, whichever way round it was asked. "Verizon vs T-Mobile" and
 * "T-Mobile vs Verizon" are the same question, and two pages answering it would
 * compete with each other rather than with anyone else.
 */
export function pairSlug(a, b) {
  const [first, second] = [slugFor(a), slugFor(b)].sort();
  return `${first}-vs-${second}-${PHONE_SLUG}`;
}

export function carrierSlug(carrierId) {
  return `${slugFor(carrierId)}-${PHONE_SLUG}-cost`;
}

const routeKey = (r) => `${r.carrierId}|${r.planId}|${r.route}`;

/* The tool opens with a trade-in selected; the pages price none. Carry that in the
   link so the tool shows the numbers the page just quoted. */
const NO_TRADE_IN_LINES = NO_TRADE_IN_SCENARIO.lineItems.map((li) => `${li.phoneId}:-`).join(",");

/** Every route for one carrier, cheapest first, for the no-trade-in situation. */
function routesFor(rows, carrierId) {
  return rows.filter((r) => r.carrierId === carrierId).map((r) => ({ ...r, key: routeKey(r) }));
}

/**
 * A carrier's promotions, each measured against buying the phone outright on the
 * *same plan*. That is the comparison the carrier's own page never makes, and the
 * only one that says what the deal is worth: the plan is held constant, so the
 * difference is the deal and nothing else.
 */
function dealsFor(data, carrierId) {
  const rows = buildScenarios(data, SWITCHER_SCENARIO);
  const mine = rows.filter((r) => r.carrierId === carrierId);
  const byodOn = new Map(mine.filter((r) => r.route === "byod").map((r) => [r.planId, r.total]));
  const tradeIn = data.tradeIns.find((t) => t.id === SWITCHER_SCENARIO.lineItems[0].tradeInId);
  return {
    tradeInName: tradeIn.name,
    tradeInValue: tradeIn.value,
    baseline: mine.find((r) => r.route === "byod") || null,
    routes: mine
      .filter((r) => r.route !== "byod")
      .map((r) => {
        const samePlanBaseline = byodOn.get(r.planId) ?? null;
        return {
          ...r,
          key: routeKey(r),
          samePlanBaseline,
          vsSamePlan: samePlanBaseline == null ? null : r.total - samePlanBaseline,
        };
      }),
  };
}

function sideFor(rows, carrier) {
  const routes = routesFor(rows, carrier.id);
  return {
    carrierId: carrier.id,
    carrierName: carrier.name,
    best: routes[0],
    top: routes.slice(0, 3),
  };
}

/** A page for each unordered pair of carriers: who is cheaper, by how much, and why. */
export function comparePages(data) {
  const rows = buildScenarios(data, NO_TRADE_IN_SCENARIO);
  const swRows = buildScenarios(data, SWITCHER_SCENARIO);
  const pages = [];
  for (let i = 0; i < data.carriers.length; i++) {
    for (let j = i + 1; j < data.carriers.length; j++) {
      // Sides follow the slug's alphabetical order so the page reads the way its URL does.
      const sides = [data.carriers[i], data.carriers[j]]
        .map((c) => sideFor(rows, c))
        .sort((a, b) => slugFor(a.carrierId).localeCompare(slugFor(b.carrierId)));
      const [cheaper, pricier] = [...sides].sort((a, b) => a.best.total - b.best.total).map((s) => s.best);
      // Someone comparing two carriers is usually about to switch, so the page answers
      // that version too rather than making them re-derive it.
      const swSides = [data.carriers[i], data.carriers[j]]
        .map((c) => sideFor(swRows, c))
        .sort((a, b) => a.best.total - b.best.total);
      pages.push({
        kind: "compare",
        slug: pairSlug(data.carriers[i].id, data.carriers[j].id),
        sides,
        cheaper,
        pricier,
        gap: pricier.total - cheaper.total,
        switcher: {
          cheaper: swSides[0].best,
          pricier: swSides[1].best,
          gap: swSides[1].best.total - swSides[0].best.total,
          sides: swSides,
        },
        toolUrl: `/?l=${NO_TRADE_IN_LINES}&cmp=${sides[0].best.key},${sides[1].best.key}&tab=compare`,
        crawledAt: data.meta.crawledAt,
        termMonths: rows[0].termMonths,
      });
    }
  }
  return pages;
}

/**
 * A page per carrier: every route it offers, ranked, measured against its own
 * bring-your-own route. That baseline is the honest yardstick — it is what the
 * carrier costs when you decline the phone deal.
 */
export function carrierPages(data) {
  const rows = buildScenarios(data, NO_TRADE_IN_SCENARIO);
  return data.carriers.map((carrier) => {
    const routes = routesFor(rows, carrier.id);
    const baseline = routes.find((r) => r.route === "byod") || null;
    return {
      kind: "carrier",
      slug: carrierSlug(carrier.id),
      carrierId: carrier.id,
      carrierName: carrier.name,
      network: carrier.network,
      baseline,
      routes: routes.map((r) => ({ ...r, vsBaseline: baseline ? r.total - baseline.total : null })),
      deals: dealsFor(data, carrier.id),
      toolUrl: `/?l=${NO_TRADE_IN_LINES}&carrier=${carrier.id}`,
      crawledAt: data.meta.crawledAt,
      termMonths: rows[0].termMonths,
    };
  });
}

export function sitemap(urls, lastmod) {
  const entries = [...new Set(urls)]
    .map((loc) => `  <url>\n    <loc>${loc}</loc>\n    <lastmod>${lastmod}</lastmod>\n  </url>`)
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries}\n</urlset>\n`;
}
