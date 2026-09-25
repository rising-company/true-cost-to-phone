// Renders the generated comparison pages, the sitemap and robots.txt.
//
//   node tools/gen-seo.mjs
//
// Output is committed, the same way og.png is: there is no build step here, and a
// generated page that only exists on a server nobody can inspect is worse than one
// sitting in the repo next to the data it came from.
//
// Two rules keep this from becoming SEO sludge. Every page states numbers the
// calculator actually produced and carries the crawl date they came from, so it
// regenerates rather than rots. And every page makes a point a human would bother
// writing — usually "this deal costs you more than declining it, here is by how
// much" — rather than restating the landing copy with the nouns swapped.

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { comparePages, carrierPages, sitemap } from "../seo.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SITE = "https://true-cost-to-phone.rising.company";
const data = JSON.parse(readFileSync(join(ROOT, "data/pricing.json"), "utf8"));

const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
const esc = (s) =>
  String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const money = (n) => usd.format(n);

/** "$520 more" / "$310 less" / "exactly the same" — for a signed difference. */
function delta(n) {
  if (n === 0) return "exactly the same";
  return `${money(Math.abs(n))} ${n > 0 ? "more" : "less"}`;
}

/** A gap is always positive and always belongs to the cheaper side. Say so. */
function cheaperBy(gap) {
  return gap === 0 ? "exactly the same" : `${money(gap)} cheaper`;
}

const sourceUrl = (key) => (key ? data.meta.sources[key] : null);

/* ── The shell ──
   Same fonts, same design system, same Daylight theme as the tool. These pages are
   part of the site, not a satellite farm, and they should look like it. */
function shell({ title, description, slug, jsonLd, body }) {
  const url = `${SITE}/${slug}`;
  return `<!DOCTYPE html>
<html lang="en" data-theme="daylight">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<link rel="canonical" href="${url}">
<meta property="og:type" content="article">
<meta property="og:site_name" content="True Cost to Phone">
<meta property="og:url" content="${url}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:image" content="${SITE}/og.png?v=${data.meta.crawledAt}">
<meta property="og:image:width" content="2400">
<meta property="og:image:height" content="1260">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(title)}">
<meta name="twitter:description" content="${esc(description)}">
<meta name="twitter:image" content="${SITE}/og.png?v=${data.meta.crawledAt}">
<link rel="icon" type="image/svg+xml" href="https://design-system.rising.company/branding/favicon.svg">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Share+Tech+Mono&family=Rajdhani:wght@300;500;700&display=swap">
<link rel="stylesheet" href="https://design-system.rising.company/rising.css">
<style>
  body { display: flex; flex-direction: column; min-height: 100vh; }
  .shell { max-width: 820px; margin: 0 auto; padding: 0 24px; width: 100%; box-sizing: border-box; }
  .page { padding: 48px 0 64px; }
  h1 { max-width: 20ch; margin-bottom: 16px; }
  .lede { font-size: 20px; line-height: 1.55; color: var(--text-muted); max-width: 58ch; margin: 0 0 8px; }
  .stamp { font-family: "Share Tech Mono", monospace; font-size: 12px; letter-spacing: 0.1em; text-transform: uppercase; color: var(--text-label); margin: 20px 0 36px; }
  h2 { font-size: 24px; margin: 44px 0 12px; color: var(--text-heading); }
  p { line-height: 1.7; margin: 0 0 16px; max-width: 68ch; }
  .answer { border-left: 3px solid var(--accent-ink); background: var(--accent-wash); padding: 18px 22px; border-radius: 0 6px 6px 0; margin: 0 0 28px; }
  .answer p { margin: 0; font-size: 18px; }
  .answer b { color: var(--accent-ink); font-weight: 500; }
  table { width: 100%; border-collapse: collapse; margin: 0 0 24px; }
  th { text-align: left; font-family: "Share Tech Mono", monospace; font-size: 12px; letter-spacing: 0.1em; text-transform: uppercase; color: var(--text-label); font-weight: normal; padding: 8px 12px 8px 0; border-bottom: 1px solid var(--border); }
  td { padding: 12px 12px 12px 0; border-bottom: 1px solid var(--border-subtle); vertical-align: top; font-size: 15px; line-height: 1.5; }
  td.num, th.num { text-align: right; padding-right: 0; font-family: "Share Tech Mono", monospace; font-variant-numeric: tabular-nums; white-space: nowrap; }
  tr.is-best td { color: var(--accent-ink); }
  .sub { display: block; font-size: 13px; color: var(--text-label); margin-top: 3px; }
  .cta { margin: 32px 0 8px; }
  .related { margin-top: 48px; padding-top: 24px; border-top: 1px solid var(--border); }
  .related ul { list-style: none; padding: 0; display: flex; flex-wrap: wrap; gap: 8px 20px; }
  .related a { font-size: 15px; }
  .sources { font-family: "Share Tech Mono", monospace; font-size: 12px; line-height: 1.8; }
  .sources a { color: var(--text-subtle); word-break: break-all; }
  @media (max-width: 640px) {
    .page { padding: 28px 0 48px; }
    h1 { font-size: 28px; }
    .lede { font-size: 17px; }
    td, th { font-size: 14px; }
  }
</style>
<script type="application/ld+json">${JSON.stringify(jsonLd)}</script>
</head>
<body>
  <nav class="nav">
    <div class="shell nav-inner">
      <div class="nav-brand">
        <a class="wordmark" href="/">True Cost to Phone</a>
        <a class="app-byline" href="https://rising.company">by <span>rising.company</span></a>
      </div>
    </div>
  </nav>
  <main class="shell page">
${body}
  </main>
  <footer class="site-footer">
    <div class="shell">
      <span>Prices from each carrier's own pages, ${data.meta.crawledAt}. Taxes excluded.</span>
      <a href="https://github.com/rising-company/true-cost-to-phone">Source and data</a>
    </div>
  </footer>
</body>
</html>
`;
}

/** The method note every page carries — the argument, stated once, in full. */
function method(page) {
  return `<h2>How this is counted</h2>
<p>Everything over ${page.termMonths} months: the plan, the phone after any bill credits,
one-time fees, and — the step most comparisons skip — the phone you hand the carrier.
A phone traded into a deal for bill credits is money out of your pocket at exactly what
Apple would have paid you for it. Buying from Apple instead sells that phone to Apple,
so its value comes off the price rather than being given away.</p>
<p>Taxes are excluded. T-Mobile, AT&amp;T and Verizon prices assume AutoPay; Xfinity's
include the internet-customer discount. Anything a carrier does not publish is flagged
rather than guessed.</p>`;
}

function sources(keys) {
  const urls = [...new Set(keys.map(sourceUrl).filter(Boolean))];
  if (!urls.length) return "";
  return `<h2>Sources</h2>
<p class="sources">${urls.map((u) => `<a href="${esc(u)}" rel="nofollow noopener" target="_blank">${esc(u)}</a>`).join("<br>")}</p>`;
}

function related(currentSlug, all) {
  const links = all
    .filter((p) => p.slug !== currentSlug)
    .slice(0, 8)
    .map((p) => `<li><a href="${p.href}">${esc(p.linkText)}</a></li>`)
    .join("");
  return `<div class="related"><h2>Related</h2><ul>${links}</ul></div>`;
}

/* ── Comparison page ── */
function renderCompare(page, index) {
  const [a, b] = page.sides;
  const title = `${a.carrierName} vs ${b.carrierName}: iPhone 18 Pro cost over ${page.termMonths} months`;
  const description = `${page.cheaper.carrierName} works out ${money(page.gap)} cheaper than ${page.pricier.carrierName} for an iPhone 18 Pro over ${page.termMonths} months — ${money(page.cheaper.total)} against ${money(page.pricier.total)}, counting plan, phone, fees and trade-in.`;

  const sw = page.switcher;
  const rows = (side) =>
    side.top
      .map(
        (r, i) => `<tr${i === 0 ? ' class="is-best"' : ""}>
          <td>${esc(r.planName)}<span class="sub">${esc(r.routeName)}</span></td>
          <td class="num">${money(r.planMonthly)}/mo</td>
          <td class="num">${money(r.total)}</td>
        </tr>`,
      )
      .join("");

  const body = `<h1>${esc(a.carrierName)} vs ${esc(b.carrierName)} for an iPhone 18 Pro</h1>
<p class="lede">Both carriers, same phone, same ${page.termMonths} months — with the plan, the phone, the fees and the trade-in all counted.</p>
<div class="stamp">Prices ${page.crawledAt} · taxes excluded · 1 line · iPhone 18 Pro 256 GB</div>

<div class="answer"><p><b>${esc(page.cheaper.carrierName)} is ${cheaperBy(page.gap)}</b> — ${money(page.cheaper.total)} against ${money(page.pricier.total)} over ${page.termMonths} months, buying the phone outright and bringing it to each carrier's cheapest plan.</p></div>

<h2>Cheapest route at each</h2>
<table>
  <thead><tr><th>${esc(a.carrierName)}</th><th class="num">Plan</th><th class="num">${page.termMonths} months</th></tr></thead>
  <tbody>${rows(a)}</tbody>
</table>
<table>
  <thead><tr><th>${esc(b.carrierName)}</th><th class="num">Plan</th><th class="num">${page.termMonths} months</th></tr></thead>
  <tbody>${rows(b)}</tbody>
</table>

<h2>If you are switching with a phone to trade</h2>
<p>Every phone promotion at both carriers needs a port-in, a trade-in or both, so none of
them apply to the figures above. Priced again as a switcher trading in an iPhone 16 Pro —
which Apple values at ${money(data.tradeIns.find((t) => t.id === "iphone-16-pro").value)} —
<b>${esc(sw.cheaper.carrierName)} comes out ${cheaperBy(sw.gap)}</b>: ${money(sw.cheaper.total)} on
${esc(sw.cheaper.planName)} against ${money(sw.pricier.total)} on ${esc(sw.pricier.planName)}.</p>
<p>Both of those winning routes still buy the phone from Apple. That is the usual result:
once the phone you hand over is counted at what Apple would have paid for it, the bill
credits rarely cover what the deal costs you.</p>

<div class="cta"><a class="btn btn-primary" href="${esc(page.toolUrl)}">Compare these two side by side</a></div>

${method(page)}
${sources([...a.top, ...b.top].map((r) => r.sourceKey).concat([`${a.carrierId}-plans`, `${b.carrierId}-plans`]))}
${related(page.slug, index)}`;

  return {
    slug: page.slug,
    html: shell({
      title,
      description,
      slug: page.slug,
      body,
      jsonLd: {
        "@context": "https://schema.org",
        "@type": "Article",
        headline: title,
        description,
        datePublished: page.crawledAt,
        dateModified: page.crawledAt,
        isBasedOn: `${SITE}/data/pricing.json`,
        author: { "@type": "Organization", name: "Rising Company", url: "https://rising.company" },
        mainEntityOfPage: `${SITE}/${page.slug}`,
      },
    }),
  };
}

/* ── Carrier page ── */
function renderCarrier(page, index) {
  const title = `${page.carrierName} iPhone 18 Pro cost: every plan over ${page.termMonths} months`;
  const cheapest = page.routes[0];
  const deals = page.deals.routes;
  const worstDeal = deals.length ? deals.reduce((w, r) => (r.vsSamePlan > w.vsSamePlan ? r : w)) : null;
  const bestDeal = deals.length ? deals.reduce((b, r) => (r.vsSamePlan < b.vsSamePlan ? r : b)) : null;
  const description = deals.length
    ? `${page.carrierName}'s cheapest route to an iPhone 18 Pro is ${money(cheapest.total)} over ${page.termMonths} months. Its phone deals are priced against buying the same phone outright on the same plan.`
    : `${page.carrierName}'s cheapest route to an iPhone 18 Pro is ${money(cheapest.total)} over ${page.termMonths} months, with the phone bought outright. It runs no phone promotions.`;

  const planRows = page.routes
    .map(
      (r, i) => `<tr${i === 0 ? ' class="is-best"' : ""}>
        <td>${esc(r.planName)}${r.planNotes ? `<span class="sub">${esc(r.planNotes)}</span>` : ""}</td>
        <td class="num">${money(r.planMonthly)}/mo</td>
        <td class="num">${money(r.total)}${i > 0 ? `<span class="sub">+${money(r.vsBaseline)}</span>` : ""}</td>
      </tr>`,
    )
    .join("");

  const dealRows = deals
    .map(
      (r) => `<tr>
        <td>${esc(r.routeName)}<span class="sub">${esc(r.planName)}${r.requires.length ? ` · ${esc(r.requires.join(" · "))}` : ""}</span></td>
        <td class="num">${money(r.credits)}</td>
        <td class="num">${money(r.total)}</td>
        <td class="num">${r.vsSamePlan === 0 ? "same" : `${r.vsSamePlan > 0 ? "+" : "−"}${money(Math.abs(r.vsSamePlan))}`}</td>
      </tr>`,
    )
    .join("");

  const dealsSection = deals.length
    ? `<h2>What its phone deals are actually worth</h2>
<p>Every ${esc(page.carrierName)} phone promotion needs a port-in, a trade-in or both, so none
of them apply to the table above. Priced as a switcher trading in an iPhone 16 Pro — which
Apple values at ${money(page.deals.tradeInValue)} — each deal is compared against buying the
same phone outright <em>on the same plan</em>. That holds the plan constant, so the difference
is the deal and nothing else.</p>
<table>
  <thead><tr><th>Deal</th><th class="num">Credits</th><th class="num">${page.termMonths} months</th><th class="num">vs buying outright</th></tr></thead>
  <tbody>${dealRows}</tbody>
</table>
<p>${
        worstDeal.vsSamePlan > 0
          ? `The worst of them, ${esc(worstDeal.routeName)}, costs ${delta(worstDeal.vsSamePlan)} than simply declining it and buying the phone from Apple on the same plan.`
          : `Unusually, ${esc(bestDeal.routeName)} comes out ${delta(bestDeal.vsSamePlan)} than buying the phone outright on the same plan — worth taking.`
      }${
        bestDeal.vsSamePlan < 0 && worstDeal.vsSamePlan > 0
          ? ` ${esc(bestDeal.routeName)} is the exception, at ${delta(bestDeal.vsSamePlan)}.`
          : ""
      }</p>`
    : `<h2>Phone deals</h2>
<p>${esc(page.carrierName)} runs no phone promotions — there are no bill credits, no trade-in
tiers and nothing to qualify for. You buy the phone and bring it. That is the whole pitch,
and at ${money(cheapest.total)} over ${page.termMonths} months it is a strong one.</p>`;

  const body = `<h1>What an iPhone 18 Pro costs on ${esc(page.carrierName)}</h1>
<p class="lede">Every ${esc(page.carrierName)} plan priced over ${page.termMonths} months with an iPhone 18 Pro — plan, phone, fees and trade-in all counted.</p>
<div class="stamp">Prices ${page.crawledAt} · taxes excluded · 1 line · iPhone 18 Pro 256 GB${page.network ? ` · ${esc(page.network)} network` : ""}</div>

<div class="answer"><p><b>${money(cheapest.total)} over ${page.termMonths} months</b> is the cheapest way to an iPhone 18 Pro on ${esc(page.carrierName)} — ${esc(cheapest.planName)}, with the phone bought outright from Apple. That works out at ${money(cheapest.perMonth)} a month all in.</p></div>

<h2>Every plan, cheapest first</h2>
<table>
  <thead><tr><th>Plan</th><th class="num">Monthly</th><th class="num">${page.termMonths} months</th></tr></thead>
  <tbody>${planRows}</tbody>
</table>

${dealsSection}

<div class="cta"><a class="btn btn-primary" href="${esc(page.toolUrl)}">Price your own situation on ${esc(page.carrierName)}</a></div>

${method(page)}
${sources([...page.routes, ...deals].map((r) => r.sourceKey).concat([`${page.carrierId}-plans`, `${page.carrierId}-iphone`, `${page.carrierId}-deals`]))}
${related(page.slug, index)}`;

  return {
    slug: page.slug,
    html: shell({
      title,
      description,
      slug: page.slug,
      body,
      jsonLd: {
        "@context": "https://schema.org",
        "@type": "Article",
        headline: title,
        description,
        datePublished: page.crawledAt,
        dateModified: page.crawledAt,
        isBasedOn: `${SITE}/data/pricing.json`,
        author: { "@type": "Organization", name: "Rising Company", url: "https://rising.company" },
        mainEntityOfPage: `${SITE}/${page.slug}`,
      },
    }),
  };
}

/* ── Write everything ── */
const compares = comparePages(data);
const carriers = carrierPages(data);

// The index every page links into, so the set is crawlable from any entry point.
const index = [
  ...carriers.map((p) => ({ slug: p.slug, href: `/carrier/${p.slug}`, linkText: `${p.carrierName} iPhone 18 Pro cost` })),
  ...compares.map((p) => ({
    slug: p.slug,
    href: `/compare/${p.slug}`,
    linkText: `${p.sides[0].carrierName} vs ${p.sides[1].carrierName}`,
  })),
];

const written = [];
for (const dir of ["compare", "carrier"]) mkdirSync(join(ROOT, dir), { recursive: true });

for (const page of compares) {
  const { slug, html } = renderCompare(page, index);
  writeFileSync(join(ROOT, "compare", `${slug}.html`), html);
  written.push(`${SITE}/compare/${slug}`);
}
for (const page of carriers) {
  const { slug, html } = renderCarrier(page, index);
  writeFileSync(join(ROOT, "carrier", `${slug}.html`), html);
  written.push(`${SITE}/carrier/${slug}`);
}

writeFileSync(join(ROOT, "sitemap.xml"), sitemap([`${SITE}/`, ...written], data.meta.crawledAt));
writeFileSync(
  join(ROOT, "robots.txt"),
  `User-agent: *\nAllow: /\n\n# The dataset every page is built from.\n# ${SITE}/data/pricing.json\n\nSitemap: ${SITE}/sitemap.xml\n`,
);

console.log(`${compares.length} comparison pages, ${carriers.length} carrier pages`);
console.log(`sitemap.xml: ${written.length + 1} urls · robots.txt · crawled ${data.meta.crawledAt}`);
