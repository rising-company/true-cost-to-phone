# What to read, per carrier

Every figure in `data/pricing.json` names a key in `meta.sources`. This is what each
source is for and what it gets wrong if read carelessly.

The recurring trap: **carriers advertise the number they want you to see.** Plan pages
show prices with AutoPay and paperless billing already applied, "up to" trade-in values
that only the newest phone reaches, and promotions whose real terms appear at checkout.
The tool's value is reading past that, so read past it.

## Contents

- [Apple — the baseline](#apple--the-baseline)
- [T-Mobile](#t-mobile)
- [AT&T](#att)
- [Verizon](#verizon)
- [Xfinity Mobile](#xfinity-mobile)
- [Tello and Mint](#tello-and-mint)
- [Costco](#costco)
- [Shape of the file](#shape-of-the-file)

## Apple — the baseline

| Source key | What to read |
|---|---|
| `apple-iphone` | Retail price per storage tier — the `phones[]` figures |
| `apple-tradein` | The full iPhone trade-in table — `tradeIns[]` |

Apple's trade-in values are the spine of the whole calculation: a phone handed to a
carrier is counted as out-of-pocket at what Apple would have paid. If these move,
every promotion's true cost moves with them.

Carriers list the same retail price as Apple, shown as `$x.99`. Xfinity publishes none,
so Apple's is used everywhere.

## T-Mobile

| Source key | What to read |
|---|---|
| `tmobile-plans` | Plan prices **by line count** — an account total, not per-line |
| `tmobile-iphone`, `tmobile-iphone-max` | Device pages and current promotions |
| `tmobile-press` | Launch-day promotion terms, usually clearer than the device page |

Traps:

- Prices include the $5/line AutoPay discount. Keep that convention and note it.
- Promotions credit **at most four devices per account** (`maxDevices: 4`).
- "iPhone 18 Pro on Us" needs an iPhone 15 Pro or newer. Older phones land in much
  smaller tiers that differ per plan — read every tier, not the headline.
- Essentials 2.0 at 2 and 5 lines, and Essentials Saver above 2 lines, are not
  published. Leave them out rather than interpolating; the calculator skips a plan
  with no price for the requested count.

## AT&T

| Source key | What to read |
|---|---|
| `att-plans`, `att-plans-lines` | Plan prices per line count |
| `att-iphone`, `att-iphone-max` | Device pages and trade-in tiers |
| `att-press` | Launch promotion terms |

Traps:

- Prices are after the AutoPay + paperless discount.
- The $200 online credit is **stackable** (`stackable: true`) and applies on top of a
  main promotion — and, with `appliesToByod`, on top of bringing your own phone.
- The headline $1,200 only exists on Premium 2.0 and Elite 2.0. Extra 2.0 gets $930,
  Value 2.0 $500. The tier depends on the plan, not just the phone.
- Value 2.0 does not meet the site's usage floor, so it is priced but never shown.

## Verizon

| Source key | What to read |
|---|---|
| `verizon-myplan` | myPlan tiers by line count |
| `verizon-simplicity` | Simplicity — flat per-line, no phone deals at all |
| `verizon-press` | Launch promotion terms |
| `verizon-loyalty-faq` | Why the $40 activation fee is counted as $0 |
| `bestbuy-verizon-tradein` | Which devices fall in which trade-in tier |

Traps:

- Prices are after Auto Pay + paper-free billing ($10/line more without).
- New 3+-line accounts get a $10/mo account credit for 36 months. It is an account
  credit, not per line.
- Credits differ between a **new line** and an **upgrade** — $1,200 vs $1,020 on
  Unlimited Ultimate. Record both.
- Simplicity Pro is a lease (the phone goes back every year), so it is not a route.
- Verizon does not publish the tier membership clearly; Best Buy's page does, which is
  why that source exists. Anything still unclear is `verified: false`.

## Xfinity Mobile

| Source key | What to read |
|---|---|
| `xfinity-plans` | Plan prices — the same per line |
| `xfinity-deals` | Advertised promotions |
| `xfinity-checkout` | **The real trade-in credits** |

Traps:

- Requires residential Xfinity Internet, and published prices include the $10
  internet-customer discount.
- Credits only apply on Mobile Plus. Mobile Select is cheaper and unlocks nothing.
- The credits are **not published** — they were read at checkout for a new Mobile Plus
  line. Re-read them the same way, and mark anything not observed `verified: false`;
  the page lets a reader override those.
- The first-year intro price covers **one line** only.

## Tello and Mint

| Source key | What to read |
|---|---|
| `tello` | The plan builder — same price per line |
| `mint` | 12-month prepaid plans |

Neither runs phone promotions, which is the point of including them: they are the
"buy the phone, bring it" baseline the big carriers are measured against. Mint's
$15/mo intro year is per line and applies to new customers on any plan; its 3- and
6-month terms cost more, so price the 12-month ones.

Most of Tello's plans sit below the usage floor and are priced but never shown.

## Costco

| Source key | What to read |
|---|---|
| `costco-tmobile`, `costco-att` | Member benefits per carrier |

Costco sells no Verizon, Xfinity, Tello or Mint plans. Shop Cards and prepaid Visa
cards are counted at face value. The rules are fiddly and change often — re-read both
showcases rather than assuming last crawl's terms still hold, and check whether the
device connection charge or activation fee is still waived.

## Shape of the file

```
meta.crawledAt          today, YYYY-MM-DD — everything downstream keys off this
meta.sources            key → URL; every figure cites one
meta.notes              how a carrier prices, when that is not obvious from the numbers
phones[]                retail per storage tier
tradeIns[]              Apple's table, "up to" values
carriers[].plans[]      monthly keyed by line count ("1".."5"), premiumDataGb, minutes
carriers[].promos[]     plans[], requires{}, maxDevices, stackable, tiers[]
carriers[].fees         perLineOneTime + label
carriers[].costco       member terms, where they exist
```

A promo tier carries `devices[]` plus an `otherwise` tier for everything unlisted.
`verified: false` on a tier means the figure was inferred rather than observed — the
page surfaces an override field for exactly those.
