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

const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

/**
 * Rewrites every string in index.html that is derived from the data.
 *
 * The landing page is hand-written except for these: the card's cache-busting stamp,
 * the headline spread quoted in the tags, the six totals in the alt text, the two
 * dataset dates, the hero line a reader sees before the script runs, and the footer.
 * They all move together on a re-crawl, and editing eight strings by hand is how a
 * page ends up advertising one number while showing another. Derive them instead.
 */
export function stampIndex(html, data) {
  const card = cardModel(data);
  const at = data.meta.crawledAt;
  const headline = `The same iPhone. ${usd.format(card.spread)} apart.`;
  const alt =
    `Six carriers ranked cheapest first for the same iPhone 18 Pro over ${card.termMonths} months: ` +
    card.rows.map((r) => `${r.carrierName} ${usd.format(r.total)}`).join(", ") +
    ".";

  /* Callback form throughout: the derived text contains "$1,655", and a string
     replacement would read that "$1" as a capture-group reference. */
  let out = html.replace(/(og\.png\?v=)[\d-]+/g, (_, a) => `${a}${at}`);
  const sub = (re, value) => {
    out = out.replace(re, (_, a, b) => `${a}${value}${b}`);
  };
  sub(/(<meta property="og:title" content=")[^"]*(">)/, headline);
  sub(/(<meta name="twitter:title" content=")[^"]*(">)/, headline);
  sub(/(<meta property="og:image:alt" content=")[^"]*(">)/, alt);
  sub(/("dateModified":")[^"]*(")/, at);
  sub(/("temporalCoverage":")[^"]*(")/, at);
  sub(
    /(<div class="hero-trust" id="trust">)[^<]*(<\/div>)/,
    `${card.termMonths} months · taxes excluded · prices updated ${at}`,
  );
  sub(/(<span>\/\/ True Cost to Phone · data )[\d-]+(<\/span>)/, at);
  return out;
}
