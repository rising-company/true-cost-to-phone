# True Cost to Phone

What an iPhone 18 Pro really costs over 36 months — plan, phone, one-time fees, and the
trade-in you hand over — compared across Tello, Mint Mobile, T-Mobile, AT&T, Verizon and Xfinity Mobile.

A static tool in the Rising Company **Daylight** theme. No build step: `index.html` +
`app.js` + `calc.js` read `data/pricing.json`.

## The formula

```
total = monthly plan × 36
      + phone price − promo credits        (buying from Apple: − trade-in value instead)
      + one-time fees                       (activation · device connection charge)
      + trade-in into the deal              (maker's trade-in estimate of the phone the carrier takes)
```

A phone handed to a carrier for bill credits is extra out-of-pocket at what Apple would
have paid for it — trading an iPhone 16 Pro into a deal costs you the $510 Apple offers.
Buying from Apple instead trades that phone in to Apple, so its value simply comes off the
price.

Every (carrier, plan, route) combination is priced: the "buy from Apple with trade-in,
bring your own" route on every plan, plus each promotion the plan qualifies for. Sorted
cheapest first.

## Lines and phones

**Lines** (1–5) prices the plan as an account total for that many lines. Each line picks its
own new phone (or none) and its own trade-in (or none). Promotions credit each line on its
own trade-in; a line without a qualifying trade-in pays full price on that route. One-time
fees are per line regardless. T-Mobile promotions credit at most four devices per account.
Xfinity's first-year price covers one line; Mint's $15 intro year applies per line. Verizon's
myPlan gives new 3+-line accounts a $10/mo account credit for 36 months; Simplicity is one
flat price per line.

The **Extra savings** card holds account-level toggles:

- **Switching carriers** — new line + port-in, which unlocks port-in deals and intro prices.
- **Costco member** — buy through Costco. T-Mobile: $150 Shop Card per financed phone on an
  $85+ plan, $250 prepaid Visa per financed phone on a new $100+ account with port-in (max 4),
  $75 Shop Card per new line without a financed phone, device connection charge waived.
  AT&T: $250 bill credits + $100 Shop Card per ported line with a financed phone (replaces
  the $200 online credit), activation waived; bring-your-own does not qualify. Cards are
  counted at face value. Costco sells no Verizon, Xfinity, Tello or Mint plans.

An Xfinity trade-in credit field appears on a line whose trade-in Xfinity has not priced.
The route list can be filtered to one carrier; the filter shows every route for that
carrier with its overall rank.

## Three tabs

- **Routes** — every (carrier, plan, route) combination priced for your situation, cheapest
  first, top three per carrier until you ask for all.
- **Compare** — up to five routes picked with the Compare button on any row, side by side
  (total, per month, day one, plan, phones, credits, Apple trade-in, fees, trade-in into the
  deal, Costco, requirements, lock status) plus a month-by-month out-of-pocket chart: buying
  from Apple pays the phone on day one, a carrier spreads it over the term. Picks are in the
  URL as `cmp=`.
- **Plans** — pick up to five plans across carriers and see them side by side (monthly,
  intro price, cost over the term, high-speed data, talk, fees, how the phone is bought,
  how many phone deals the plan qualifies for right now) plus a cumulative plan-cost chart
  that makes intro pricing visible. Colors follow pick order. The pick is in the URL.

## Run it

```sh
python3 -m http.server 8000      # then open http://localhost:8000
node --test tests/               # calculator + analytics tests
```

The page fetches `data/pricing.json`, so it needs to be served — `file://` blocks fetch.

## Data

`data/pricing.json` was captured from the carriers' own pages on **2026-09-21** with
`agent-browser` (the carrier sites block plain HTTP fetches; a headed session gets through).
Sources are listed in `meta.sources` and on the page.

What's in it:

- `phones` — iPhone 18 Pro and iPhone 18 Pro Max storage tiers with one retail price each.
  Apple, T-Mobile, AT&T and Verizon list the same figure (carriers show it as $x.99); Xfinity does
  not publish one, so Apple's is used everywhere.
- `tradeIns` — the phone you hand over, valued by its maker's own trade-in program ("up to"
  values, top storage, good condition): Apple Trade In's full iPhone table; Samsung's
  standalone trade-in (run by Likewize, pays without a purchase) for Galaxy S20–S25, Note20,
  Z Fold3–7 and Z Flip3–7; the Google Store estimator for Pixel 6–10 (Google pays the same
  whichever Pixel is bought). Each entry names its `brand` and `valueSource`. Galaxy S26 and
  Pixel 11 are in neither maker's program yet, so they are not offered.
- `carriers[].plans` — `monthly` is the account total keyed by **line count** (`"1"`…`"5"`,
  T-Mobile Beyond to `"8"`). T-Mobile and AT&T totals were read from their plan pages per
  line count; Xfinity, Tello and Mint charge the same per line. A plan with no price for the
  requested count is skipped rather than guessed. `premiumDataGb` and `minutes` let the
  calculator filter by usage.
- `carriers[].promos` — per-plan eligibility, `requires` (trade-in / new line / port-in /
  existing line),
  bill-credit term, and trade-in **tiers** keyed by device id, with an `otherwise` tier
  for anything not listed. `stackable` promos (AT&T's $200 online credit) add on top of a
  main promo and, with `appliesToByod`, on top of a bring-your-own phone.
- Anything a carrier did not publish is flagged, not guessed. Xfinity's trade-in credits were read at checkout on the crawl date for a
  new Mobile Plus line: the full $1,300 for iPhone 15 Pro and anything newer or higher (16,
  16 Plus/Pro/Pro Max, Air, 17 series) · $700 iPhone 15, 15 Plus, 16e, 14 Pro/Pro Max,
  13 Pro Max and Pixel 9 · $600 iPhone 14, 14 Plus, 13 series and 12 Pro Max · $500 iPhone 12
  and 12 Pro · $450 every older iPhone. Every Samsung and Google trade-in was quoted the same
  way; two are turned away (Galaxy S20 FE, Pixel Fold get only a one-time credit), so those
  lines keep their phone and pay full price. Credits only kick in on Mobile Plus.
  Every iPhone in Apple's trade-in table has been quoted, so none needs an override; a tier
  marked `verified: false` is one read nowhere, and the page lets you override it.

Things worth knowing that the marketing copy hides:

- T-Mobile's "iPhone 18 Pro on Us" needs an iPhone 15 Pro or newer. An iPhone 14 lands in
  the $930 tier on Beyond 2.0, $730 on Experience More 2.0, $300 on Essentials 2.0.
- AT&T's $1,200 takes any iPhone 14 or newer in any condition, but only on Premium 2.0 or
  Elite 2.0; Extra 2.0 gets $930, Value 2.0 gets $500.
- Xfinity's deals require Xfinity Internet and the Mobile Plus line; Mobile Select is
  cheaper but unlocks no phone deals. Its "up to $1,300" is $600 for an iPhone 14, $700 for
  an iPhone 15, and only reaches $1,300 from iPhone 15 Pro up.
- Verizon's "up to $1,200" is the new-line credit on Unlimited Ultimate for an iPhone 14
  or newer (any working condition); upgrading an existing line gets $1,020. Unlimited Plus
  pays $840 / $660, Unlimited Welcome $480 / $300, and any older phone lands in a tier
  worth half. Simplicity has no phone deals at all — its pitch is the flat $30/line
  switcher price with the phone bought from Apple. Simplicity Pro ($50/mo on top, phone
  returned every year) is a lease, so it is not a route.
- Mint Mobile is priced on its 12-month prepaid plans; new customers get $15/mo for the
  first year on any plan, then $30/mo for Unlimited. 3- and 6-month terms cost more.
- Taxes are excluded everywhere. T-Mobile, AT&T and Verizon prices are with AutoPay (AT&T
  and Verizon also paperless); Xfinity prices include the $10 internet-customer discount.
  Verizon's $40 activation fee is counted as $0 because the free Loyalty opt-in waives it.

## Planned

The calculator already takes these as inputs; the page just pins them for now.

- More phone models beyond the 18 Pro and Pro Max (`phones[]`).
- Choose the trade-in device — present on the page today, backed by Apple's full table.
- Monthly data and minutes needed (`minDataGb`, `minutes`) so Tello's smaller plans and
  AT&T Value 2.0 come into play.
- T-Mobile Essentials 2.0 at 2 lines and Essentials Saver beyond 2 lines are not published
  on the plan page (4 and 5 lines are priced from its "Essentials 4 Line Offer").

## The social card

Every input is in the URL, so a shared link opens on the situation the sender priced.
The link preview has to carry its weight: `og.png` is a picture of the page's own
carrier chart — same segments, same colors, same cheapest-first ranking — so the point
survives a timeline and the click is verification rather than curiosity.

`og.js` holds the card's data model (`CARD_SCENARIO`, `cardModel`). The scenario is the
one the page itself computes on first load: one line, an iPhone 18 Pro 256, an iPhone 16
Pro to trade, not switching. A card that disagrees with the page it links to is a worse card.

Regenerate it whenever `data/pricing.json` moves:

```sh
python3 -m http.server 8000
agent-browser set viewport 1240 720 2          # 2x — the card is 1200x630 CSS px
agent-browser open http://localhost:8000/tools/og.html
agent-browser wait --load networkidle
agent-browser screenshot "#card" og.png        # writes 2400x1260
```

Then restamp the landing page, which owns eight strings derived from the data — the
`?v=` cache stamps, the headline spread in the tags, the six totals in the alt text,
the two dataset dates, the no-JS hero line and the footer:

```sh
node tools/restamp.mjs           # rewrite in place
node tools/restamp.mjs --check   # exit 1 if index.html has drifted
```

Scrapers cache `og:image` by URL, so without a new stamp Facebook, Slack and X keep
serving the old numbers for days — the exact failure a weekly re-crawl exists to avoid.

The whole refresh is written up as a skill: `.claude/skills/refresh-carrier-pricing`.

`tests/og.test.mjs` pins all of it: the scenario, the arithmetic behind each bar, the
numbers printed on the committed card, the stamp against `meta.crawledAt`, and the
spread quoted in the tags. Moving the data without regenerating the card is a failing
test, not a stale share.

## Generated pages

The tool answers every situation at one URL, but the question arrives in several
hundred shapes — "verizon vs t-mobile iphone 18 pro", "is xfinity mobile worth it".
`seo.js` builds a model for each of those, and `tools/gen-seo.mjs` renders them:

```sh
node tools/gen-seo.mjs     # 15 compare/ pages, 6 carrier/ pages, sitemap.xml, robots.txt
```

Output is committed, like `og.png`. Regenerate it whenever `data/pricing.json` moves;
`tests/seo.test.mjs` fails if the committed pages carry a stale crawl date.

Each page states numbers the calculator produced, names its sources, and deep-links
into the tool pre-loaded with the situation it describes. The carrier pages carry the
part the carriers' own pages never show: each promotion priced against buying the same
phone outright **on the same plan**, which holds the plan constant so the difference is
the deal and nothing else.

Two scenarios drive everything, both in `scenario.js`:

- `HEADLINE_SCENARIO` — one line, an iPhone 18 Pro 256, an iPhone 16 Pro to trade, not
  switching. What the landing page computes on first load, so the card agrees with it.
- `NO_TRADE_IN_SCENARIO` — the same line with nothing to trade. The generated pages lead
  with it, and their tool links carry it (`l=iphone-18-pro-256:-`) so the tool opens on
  the numbers the page quoted.
- `SWITCHER_SCENARIO` — the same line switching in with an iPhone 16 Pro to trade.
  Every promotion requires a port-in, a trade-in or both, so the no-trade-in scenario
  filters all of them out; a page about whether a deal is worth taking has to price
  the case where it is on the table.

Both spread in `USAGE_FLOOR` (50 GB premium data, unlimited minutes) — the floor
`app.js` has always applied. It lives in `scenario.js` because leaving it out prices
plans the page never shows: the social card once shipped a Tello plan with 300 minutes
and no data as the cheapest route.

## Measurement

PostHog, provisioned through the Vercel Marketplace (`vercel integration add posthog`,
US region). `analytics.js` holds the whole of it.

The project token in `analytics.js` is a public write-only key — the same one PostHog's
own snippet puts in the page source. There is no build step to inject it from the
environment, so it is written in. The Marketplace also set `*_POSTHOG_PROJECT_TOKEN` and
`*_POSTHOG_HOST` on the Vercel project for anything that later needs them.

Nobody signs in here, so nobody is identified: `person_profiles: "identified_only"` keeps
readers anonymous. `shouldTrack()` drops localhost and `.local`, so serving the folder
locally never reaches the numbers.

Alongside PostHog's automatic pageviews and click autocapture:

- `situation_priced` — the situation someone actually priced (lines, phones, trade-ins,
  switching, Costco, carrier filter) and what won it (carrier, plan, route, total, spread).
  Debounced, and a situation already reported is not reported again until something
  changes — tab switches re-render without being a new data point.
- `tab_selected` · `route_compared` / `route_uncompared` · `carrier_filtered` ·
  `routes_expanded` · `compare_tray_used`

Counts and ids only. No prices typed by the reader, no free text, no identifiers.

## Contributing

Everything the page shows comes from `data/pricing.json`, and each entry names its source.
If a price has moved, a promotion is missing, your carrier is not here, or a checkout showed
you a trade-in credit the carrier does not publish, open a pull request or an issue at
<https://github.com/rising-company/true-cost-to-phone>. Keep `meta.crawledAt` honest, note
where a number came from, and run `node --test tests/` — the tests pin the arithmetic and a
few facts worth not losing (T-Mobile's tiers, Xfinity's one-line intro, the Costco rules).

## Tests

`node --test tests/` — zero-dependency, matching the other static tools in this workspace
(`www/stream`). This deviates from handbook ADR-0006 (Vitest) because there is no
`package.json` to hang it on; the layout (`tests/` folder, node environment) is the same.
