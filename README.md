# True Cost to Phone

What an iPhone 18 Pro really costs over 36 months — plan, phone, one-time fees, and the
trade-in you hand over — compared across Tello, Mint Mobile, T-Mobile, AT&T and Xfinity Mobile.

A static tool in the Rising Company **Daylight** theme. No build step: `index.html` +
`app.js` + `calc.js` read `data/pricing.json`.

## The formula

```
total = monthly plan × 36
      + phone price − promo credits        (buying from Apple: − Apple Trade In instead)
      + one-time fees                       (activation · device connection charge)
      + trade-in into the deal              (Apple Trade In estimate of the phone the carrier takes)
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
Xfinity's first-year price covers one line; Mint's $15 intro year applies per line.

The **Extra savings** card holds account-level toggles:

- **Switching carriers** — new line + port-in, which unlocks port-in deals and intro prices.
- **Costco member** — buy through Costco. T-Mobile: $150 Shop Card per financed phone on an
  $85+ plan, $250 prepaid Visa per financed phone on a new $100+ account with port-in (max 4),
  $75 Shop Card per new line without a financed phone, device connection charge waived.
  AT&T: $250 bill credits + $100 Shop Card per ported line with a financed phone (replaces
  the $200 online credit), activation waived; bring-your-own does not qualify. Cards are
  counted at face value. Costco sells no Xfinity, Tello or Mint plans.

An Xfinity trade-in credit field appears on a line whose trade-in Xfinity has not priced.
The route list can be filtered to one carrier; the filter shows every route for that
carrier with its overall rank.

## Two tabs

- **Routes** — every (carrier, plan, route) combination priced for your situation, cheapest
  first, top three per carrier until you ask for all.
- **Plans** — pick up to five plans across carriers and see them side by side (monthly,
  intro price, cost over the term, high-speed data, talk, fees, how the phone is bought,
  how many phone deals the plan qualifies for right now) plus a cumulative plan-cost chart
  that makes intro pricing visible. Colors follow pick order. The pick is in the URL.

## Run it

```sh
python3 -m http.server 8000      # then open http://localhost:8000
node --test tests/               # calculator tests
```

The page fetches `data/pricing.json`, so it needs to be served — `file://` blocks fetch.

## Data

`data/pricing.json` was captured from the carriers' own pages on **2026-09-21** with
`agent-browser` (the carrier sites block plain HTTP fetches; a headed session gets through).
Sources are listed in `meta.sources` and on the page.

What's in it:

- `phones` — iPhone 18 Pro and iPhone 18 Pro Max storage tiers with one retail price each.
  Apple, T-Mobile and AT&T list the same figure (carriers show it as $x.99); Xfinity does
  not publish one, so Apple's is used everywhere.
- `tradeIns` — Apple's full iPhone trade-in table ("up to" values).
- `carriers[].plans` — `monthly` is the account total keyed by **line count** (`"1"`…`"5"`,
  T-Mobile Beyond to `"8"`). T-Mobile and AT&T totals were read from their plan pages per
  line count; Xfinity, Tello and Mint charge the same per line. A plan with no price for the
  requested count is skipped rather than guessed. `premiumDataGb` and `minutes` let the
  calculator filter by usage.
- `carriers[].promos` — per-plan eligibility, `requires` (trade-in / new line / port-in),
  bill-credit term, and trade-in **tiers** keyed by device id, with an `otherwise` tier
  for anything not listed. `stackable` promos (AT&T's $200 online credit) add on top of a
  main promo and, with `appliesToByod`, on top of a bring-your-own phone.
- Anything a carrier did not publish is flagged, not guessed. Xfinity's trade-in credits were read at checkout on the crawl date for a
  new Mobile Plus line: the full $1,300 for iPhone 15 Pro and anything newer or higher (16,
  16 Plus/Pro/Pro Max, Air, 17 series) · $700 iPhone 15 Plus and Pixel 9 · $600 iPhone 14 and
  iPhone 15. Credits only kick in on Mobile Plus.
  Other devices fall to an `otherwise` tier marked `verified: false`, which the page lets
  you override.

Things worth knowing that the marketing copy hides:

- T-Mobile's "iPhone 18 Pro on Us" needs an iPhone 15 Pro or newer. An iPhone 14 lands in
  the $930 tier on Beyond 2.0, $730 on Experience More 2.0, $300 on Essentials 2.0.
- AT&T's $1,200 takes any iPhone 14 or newer in any condition, but only on Premium 2.0 or
  Elite 2.0; Extra 2.0 gets $930, Value 2.0 gets $500.
- Xfinity's deals require Xfinity Internet and the Mobile Plus line; Mobile Select is
  cheaper but unlocks no phone deals. Its "up to $1,300" is $600 for an iPhone 14 or 15 and
  only reaches $1,300 from iPhone 15 Pro up.
- Mint Mobile is priced on its 12-month prepaid plans; new customers get $15/mo for the
  first year on any plan, then $30/mo for Unlimited. 3- and 6-month terms cost more.
- Taxes are excluded everywhere. T-Mobile and AT&T prices are with AutoPay (AT&T also
  paperless); Xfinity prices include the $10 internet-customer discount.

## Planned

The calculator already takes these as inputs; the page just pins them for now.

- More phone models beyond the 18 Pro and Pro Max (`phones[]`).
- Choose the trade-in device — present on the page today, backed by Apple's full table.
- Monthly data and minutes needed (`minDataGb`, `minutes`) so Tello's smaller plans and
  AT&T Value 2.0 come into play.
- T-Mobile Essentials 2.0 at 2 and 5 lines and Essentials Saver beyond 2 lines are not
  published on the plan page (T-Mobile shows an "Essentials 4 Line Offer" there instead).

## Tests

`node --test tests/` — zero-dependency, matching the other static tools in this workspace
(`www/stream`). This deviates from handbook ADR-0006 (Vitest) because there is no
`package.json` to hang it on; the layout (`tests/` folder, node environment) is the same.
