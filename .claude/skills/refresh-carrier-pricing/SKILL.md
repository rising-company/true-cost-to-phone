---
name: refresh-carrier-pricing
description: Re-crawl US carrier plan prices, phone promotions and trade-in values for True Cost to Phone, then propagate the new data through the card, the generated pages and the deploy. Use this whenever the user asks to refresh, re-crawl, update or check the pricing data, mentions that a carrier price or promotion has changed, asks whether the site's numbers are still current, asks to run the weekly or Black Friday data update, or asks to fix a price someone reported as wrong — even if they don't name this skill or mention crawling.
---

# Refresh carrier pricing

`data/pricing.json` is the product. Everything else on the site — the ranked routes,
the social card, the 21 generated pages, the sitemap, the headline claims — is derived
from it. A refresh is therefore not "edit some numbers": it is change the data, then
push that change all the way to production before anyone sees a page that disagrees
with itself.

The site's whole pitch is that its numbers are sourced and current. Stale numbers do
more damage here than a missing feature, because a reader has no way to tell.

## Core principle

**Change `data/pricing.json`, then let the tooling derive the rest.** Two scripts
regenerate everything mechanical. The tests then name the handful of pinned figures a
human has to confirm. Never hand-edit a derived string — if you find yourself editing
a price inside `index.html` or a `compare/` page, you are editing output, and the next
regeneration will silently revert you.

## Step 1 — Crawl

Carrier sites block plain HTTP fetches; a headed browser session gets through. Use the
`agent-browser` skill, not `curl` or WebFetch.

```bash
agent-browser skills get core
export AGENT_BROWSER_SESSION="$(agent-browser session id --scope worktree --prefix crawl)"
agent-browser open https://www.t-mobile.com/cell-phone-plans
agent-browser read          # rendered DOM of the active tab
```

`references/carriers.md` lists every source URL, what to read from each, and the traps
each carrier sets (prices shown with AutoPay already applied, promotions that only
appear at checkout, plan prices that change with line count). Read it before crawling —
the traps are the reason the numbers are worth anything.

Record what you actually saw. If a carrier does not publish a figure, mark the tier
`"verified": false` rather than guessing it; the page has a UI for overriding unverified
credits, and a guess dressed as a fact is the one thing that would discredit the tool.

## Step 2 — Update the data

Edit `data/pricing.json` directly:

- `meta.crawledAt` — today, `YYYY-MM-DD`. Everything downstream keys off this.
- `meta.sources` — add a key for any new page you read; every figure cites one.
- `meta.notes` — if a carrier changed *how* it prices (not just the number), say so here.
- `carriers[].plans[].monthly` — account totals keyed by line count, not per-line.
- `carriers[].promos[]` — eligibility, `requires`, credit term, trade-in `tiers`.

Drop promotions that have ended rather than leaving them with a past `endsOn`. A dead
promotion still ranks in the route list.

## Step 3 — Propagate

```bash
node tools/restamp.mjs      # index.html: ?v= stamp, headline spread, alt text, dataset dates, hero line, footer
node tools/gen-seo.mjs      # 15 compare/ pages, 6 carrier/ pages, sitemap.xml, robots.txt
```

Then regenerate the social card, which is a screenshot of a real page:

```bash
python3 -m http.server 8000 &
agent-browser set viewport 1240 720 2
agent-browser open http://localhost:8000/tools/og.html
agent-browser wait --load networkidle
agent-browser screenshot "#card" og.png      # 2400x1260
```

Look at the card before moving on. It is the thing most people will see, and it is the
easiest place for a data error to become obvious — a carrier bar that suddenly doubles
usually means a plan price went in per-line when it should have been an account total.

## Step 4 — Let the tests tell you what is left

```bash
node --test tests/
```

Some tests pin figures on purpose, so that a re-crawl cannot quietly change what the
site claims. Each failure message says what moved and where to fix it:

- `tests/og.test.mjs` → `ON_THE_CARD`: the cheapest and priciest totals and the spread
  printed on the committed card.
- `tests/seo.test.mjs`: the worked AT&T example, and a check that every generated page
  carries the current crawl date.

Update those constants to the new figures **after** confirming the new figures are
right. They are a tripwire, not a formality: if a pinned number moved and you cannot
say why, that is the signal to re-read the carrier's page, not to edit the test.

## Step 5 — Check the claims that live outside the data

The marketing copy quotes figures derived from the data, and nothing regenerates prose:

- `docs/plans/2026-09-22-marketing-plan.html` — the spread, the coin-flip percentage
  and the promo swing in sections 02 and 07. Re-derive them by sweeping
  `buildScenarios()`; do not carry the old numbers forward.
- `README.md` — the worked examples under "Things worth knowing".

A claim in the plan that no longer matches the data is how a Show HN post gets taken
apart in the comments.

## Step 6 — Verify, then ship

```bash
node --test tests/
node tools/restamp.mjs --check     # exits 1 if index.html drifted
git add -A && git commit && git push origin main
vercel --prod --yes
```

Then confirm production actually serves it:

```bash
curl -s https://true-cost-to-phone.rising.company/ | grep -o 'og.png?v=[0-9-]*'
curl -s -o /dev/null -w '%{http_code}\n' https://true-cost-to-phone.rising.company/sitemap.xml
```

## Two traps worth naming

**The usage floor.** `app.js` only ever shows plans meeting `USAGE_FLOOR` in
`scenario.js` (50 GB premium data, unlimited minutes). Any scenario you build by hand
for a sanity check must spread it in, or you will price plans the page never shows and
conclude the site is wrong when it isn't. This has already caused one bad social card.

**Scraper caches.** Social platforms cache `og:image` by URL. `restamp.mjs` bumps the
`?v=` stamp to the new crawl date, which is what makes a regenerated card visible to
them. Skipping it means every existing share keeps showing last week's prices.
