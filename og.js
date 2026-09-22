// True Cost to Phone — the social card's data model.
//
// The Open Graph image is a picture of the page's own carrier chart, so it has to
// be built from the same calculator and the same situation a visitor arrives on.
// `tools/og.html` renders this; `tests/og.test.mjs` pins it so a re-crawl that moves
// the numbers fails loudly instead of leaving a stale card in every shared link.

import { buildScenarios, heroSummary } from "./calc.js";
import { HEADLINE_SCENARIO } from "./scenario.js";

/** The situation the card shows: the one the page itself computes on first load. */
export const CARD_SCENARIO = HEADLINE_SCENARIO;

/* The same four segments, in the same order and the same colors, as the page's
   summary chart. A card that reads differently from the page it links to is a
   worse card. */
const SEGMENTS = [
  { label: "Plan", key: "plan", seg: "var(--seg-plan)" },
  { label: "Phone after credits", key: "phoneNet", seg: "var(--seg-phone)" },
  { label: "One-time fees", key: "fees", seg: "var(--seg-fees)" },
  { label: "Trade-in into the deal", key: "tradeInValue", seg: "var(--seg-tradein)" },
];

/** Rows for the card — one per carrier, cheapest first, with stacked segments. */
export function cardModel(data) {
  const summary = heroSummary(buildScenarios(data, CARD_SCENARIO));
  const priciest = summary.priciest.total;
  return {
    crawledAt: data.meta.crawledAt,
    phoneName: data.phones.find((p) => p.id === CARD_SCENARIO.lineItems[0].phoneId).model,
    termMonths: data.meta.defaultTermMonths ?? 36,
    cheapest: summary.cheapest.total,
    priciest,
    spread: summary.spread,
    rows: summary.carriers.map((r) => ({
      carrierId: r.carrierId,
      carrierName: r.carrierName,
      planName: r.planName,
      routeName: r.routeName,
      total: r.total,
      width: (r.total / priciest) * 100,
      segments: SEGMENTS.map((s) => ({ ...s, value: r[s.key] })).filter((s) => s.value !== 0),
    })),
  };
}
