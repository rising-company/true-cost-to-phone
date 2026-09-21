// Run: node --test tests/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { buildScenarios, tierCredit, planTotal, comparePlans, cashflow } from "../calc.js";

const data = JSON.parse(readFileSync(new URL("../data/pricing.json", import.meta.url), "utf8"));

const baseInput = {
  phoneId: "iphone-18-pro-256",
  tradeInId: "iphone-14",
  lines: 1,
  termMonths: 36,
  switching: true,
  minDataGb: 50,
  minutes: "unlimited",
  overrides: {},
};

const find = (rows, carrierId, planId, route) =>
  rows.find((r) => r.carrierId === carrierId && r.planId === planId && r.route === route);

test("Tello unlimited + Apple outright: plan × term + (Apple retail − Apple trade-in); nothing added back", () => {
  const rows = buildScenarios(data, baseInput);
  const row = find(rows, "tello", "tello-unl-unl", "byod");
  assert.ok(row, "Tello unlimited BYOD scenario exists");
  assert.equal(row.plan, 25 * 36);
  assert.equal(row.phone, 1199);
  assert.equal(row.appleTradeIn, 195, "Apple pays $195 for the iPhone 14 toward the purchase");
  assert.equal(row.credits, 0, "no carrier credits");
  assert.equal(row.phoneNet, 1199 - 195);
  assert.equal(row.fees, 0);
  assert.equal(row.tradeInValue, 0, "selling to Apple is not an out-of-pocket cost; only a trade-in into a carrier deal is");
  assert.equal(row.total, 900 + 1199 - 195);
});

test("a trade-in into a carrier deal is added to out-of-pocket at its Apple value", () => {
  const rows = buildScenarios(data, { ...baseInput, tradeInId: "iphone-16-pro" });
  const promo = find(rows, "tmobile", "tmo-beyond-2", "tmo-ID260835");
  assert.equal(promo.credits, 1199);
  assert.equal(promo.tradeInValue, 510, "the iPhone 16 Pro handed to T-Mobile costs its $510 Apple value");
  assert.equal(promo.total, +(3600 + 0 + 35 + 510).toFixed(2));
  const apple = find(rows, "tmobile", "tmo-beyond-2", "byod");
  assert.equal(apple.phoneNet, 1199 - 510);
  assert.equal(apple.tradeInValue, 0);
});

test("T-Mobile Beyond 2.0 with an iPhone 14 lands in the $930 tier, not the $1,200 headline", () => {
  const promo = data.carriers.find((c) => c.id === "tmobile").promos.find((p) => p.id === "tmo-ID260835");
  assert.equal(tierCredit(promo, "iphone-14"), 930);
  assert.equal(tierCredit(promo, "iphone-16"), 1200);
  assert.equal(tierCredit(promo, "iphone-11"), 500);
});

test("T-Mobile Beyond 2.0 trade-in route: plan + (retail − credit) + $35 + surrendered iPhone 14 at Apple value", () => {
  const rows = buildScenarios(data, baseInput);
  const row = find(rows, "tmobile", "tmo-beyond-2", "tmo-ID260835");
  assert.ok(row);
  assert.equal(row.plan, 3600);
  assert.equal(row.phone, 1199, "one retail price per phone — carriers list the same number");
  assert.equal(row.credits, 930);
  assert.equal(row.fees, 35);
  assert.equal(row.tradeInValue, 195);
  assert.equal(row.total, 3600 + 1199 - 930 + 35 + 195);
});

test("credits never exceed the phone price", () => {
  const rows = buildScenarios(data, { ...baseInput, tradeInId: "iphone-16" });
  const row = find(rows, "tmobile", "tmo-beyond-2", "tmo-ID260835");
  assert.equal(row.credits, 1199);
  assert.equal(row.phoneNet, 0);
});

test("switching off hides port-in promos and AT&T's stackable online credit", () => {
  const on = buildScenarios(data, baseInput);
  const off = buildScenarios(data, { ...baseInput, switching: false });
  assert.ok(find(on, "tmobile", "tmo-beyond-2", "tmo-ID260824"));
  assert.equal(find(off, "tmobile", "tmo-beyond-2", "tmo-ID260824"), undefined);
  assert.equal(find(on, "att", "att-premium-2", "att-tradein-1200").credits, 1199);
  assert.equal(find(on, "att", "att-premium-2", "att-tradein-1200").stacked, 200);
  assert.equal(find(off, "att", "att-premium-2", "att-tradein-1200").stacked, 0);
  assert.equal(find(on, "att", "att-premium-2", "byod").credits, 200);
});

test("Xfinity: intro pricing for the first 12 months, published tiers win over the override, unlisted devices stay editable", () => {
  const rows = buildScenarios(data, { ...baseInput, overrides: { "xf-tradein-1300": 1300 } });
  const row = find(rows, "xfinity", "xf-plus", "xf-tradein-1300");
  assert.equal(row.plan, 15 * 12 + 45 * 24);
  assert.deepEqual(row.planIntro, { months: 12, monthly: 15 }, "the intro price is reported so the page can show the math");
  const select = find(rows, "xfinity", "xf-select", "byod");
  assert.equal(select.plan, 0 * 12 + 30 * 24);
  assert.deepEqual(select.planIntro, { months: 12, monthly: 0 });
  assert.equal(find(buildScenarios(data, { ...baseInput, switching: false }), "xfinity", "xf-select", "byod").planIntro, null, "no intro price without a new line");
  assert.equal(find(rows, "tello", "tello-unl-unl", "byod").planIntro, null);
  assert.equal(row.credits, 600, "iPhone 14 is a published $600 tier; the override must not touch it");
  assert.equal(row.unverified, false);
  assert.equal(row.phone, 1199);
  assert.ok(row.requires.includes("Xfinity Internet"));

  const promo = data.carriers.find((c) => c.id === "xfinity").promos.find((p) => p.id === "xf-tradein-1300");
  assert.equal(tierCredit(promo, "iphone-15"), 600);
  assert.equal(tierCredit(promo, "iphone-15-plus"), 700);
  for (const id of ["iphone-15-pro", "iphone-15-pro-max", "iphone-16", "iphone-16-plus", "iphone-16-pro", "iphone-16-pro-max", "iphone-air", "iphone-17", "iphone-17-pro", "iphone-17-pro-max"]) {
    assert.equal(tierCredit(promo, id), 1300, `${id} is at or above iPhone 15 Pro`);
  }
  assert.deepEqual(promo.plans, ["xf-plus"], "credits only kick in on Mobile Plus");

  assert.equal(tierCredit(promo, "iphone-13"), 600);
  assert.equal(tierCredit(promo, "iphone-12"), 500);
  // iPhone 11 is not in Xfinity's published list: unverified, and the override applies.
  const unlisted = find(buildScenarios(data, { ...baseInput, tradeInId: "iphone-11" }), "xfinity", "xf-plus", "xf-tradein-1300");
  assert.equal(unlisted.unverified, true);
  const overridden = find(buildScenarios(data, { ...baseInput, tradeInId: "iphone-11", overrides: { "xf-tradein-1300": 500 } }), "xfinity", "xf-plus", "xf-tradein-1300");
  assert.equal(overridden.credits, 500);
  assert.equal(overridden.unverified, true, "an override is still an assumption");
});

test("plans below the data / minutes floor and plans without a price for the line count are excluded", () => {
  const rows = buildScenarios(data, baseInput);
  assert.equal(find(rows, "tello", "tello-unl-20", "byod"), undefined);
  assert.equal(find(rows, "tello", "tello-300-unl", "byod"), undefined);
  assert.equal(find(rows, "att", "att-value-2", "byod"), undefined, "5 GB premium data is below a 50 GB floor");
  const four = buildScenarios(data, { ...baseInput, lines: 4 });
  assert.equal(find(four, "tmobile", "tmo-beyond-2", "byod").plan, 215 * 36);
  assert.equal(find(four, "tmobile", "tmo-more-2", "byod").plan, 170 * 36);
  assert.equal(find(four, "tmobile", "tmo-essentials-saver-2", "byod"), undefined, "Saver is only priced at 1 and 2 lines");
  assert.equal(planTotal({ monthly: { "1": 10 } }, { lines: 2, termMonths: 36, switching: false }), null);
});

test("iPhone 18 Pro Max is priced at every storage tier and flows through the same promos", () => {
  const ids = data.phones.map((p) => p.id);
  for (const id of ["iphone-18-pro-max-256", "iphone-18-pro-max-512", "iphone-18-pro-max-1tb", "iphone-18-pro-max-2tb"]) assert.ok(ids.includes(id), id);
  const rows = buildScenarios(data, { ...baseInput, phoneId: "iphone-18-pro-max-256" });
  assert.equal(find(rows, "tello", "tello-unl-unl", "byod").phone, 1299);
  const tmo = find(rows, "tmobile", "tmo-beyond-2", "tmo-ID260835");
  assert.equal(tmo.credits, 930);
  assert.equal(tmo.phoneNet, 1299 - 930);
});

test("results are sorted by total ascending", () => {
  const rows = buildScenarios(data, baseInput);
  for (let i = 1; i < rows.length; i++) assert.ok(rows[i - 1].total <= rows[i].total);
});

test("no trade-in: promos that need one drop out, buy-from-Apple pays full retail, no trade-in cost anywhere", () => {
  const rows = buildScenarios(data, { ...baseInput, tradeInId: null });
  assert.ok(rows.length > 0);
  for (const r of rows) {
    assert.equal(r.tradeInValue, 0);
    assert.equal(r.appleTradeIn, 0);
    assert.ok(!r.requires.some((q) => /trade-in/i.test(q)), `${r.carrierId} ${r.route} should not require a trade-in`);
  }
  assert.equal(find(rows, "tmobile", "tmo-beyond-2", "tmo-ID260835"), undefined, "any-condition trade-in promo needs a phone");
  assert.ok(find(rows, "tmobile", "tmo-beyond-2", "tmo-ID260824"), "new line + port-in promo still applies");
  assert.equal(find(rows, "tello", "tello-unl-unl", "byod").phoneNet, 1199);
  assert.equal(find(rows, "tello", "tello-unl-unl", "byod").routeName, "Buy from Apple");
  assert.equal(find(rows, "tmobile", "tmo-beyond-2", "byod").routeName, "Buy from Apple, bring your own");
  assert.equal(find(rows, "xfinity", "xf-plus", "xf-tradein-1300"), undefined);
});

test("buying from Apple is SIM unlocked; a carrier-financed promo phone is not", () => {
  const rows = buildScenarios(data, baseInput);
  assert.equal(find(rows, "tello", "tello-unl-unl", "byod").simUnlocked, true);
  assert.equal(find(rows, "tmobile", "tmo-beyond-2", "byod").simUnlocked, true);
  assert.equal(find(rows, "tmobile", "tmo-beyond-2", "tmo-ID260835").simUnlocked, false);
  assert.equal(find(rows, "xfinity", "xf-plus", "xf-tradein-1300").simUnlocked, false);
});

test("Mint Mobile: 12-month prepaid unlimited, $15 intro year for new customers, phone from Apple", () => {
  const rows = buildScenarios(data, baseInput);
  const row = find(rows, "mint", "mint-unlimited-12", "byod");
  assert.ok(row, "Mint unlimited scenario exists");
  assert.equal(row.plan, 15 * 12 + 30 * 24);
  assert.deepEqual(row.planIntro, { months: 12, monthly: 15 });
  assert.equal(row.phoneNet, 1199 - 195);
  assert.equal(row.fees, 0);
  assert.equal(row.simUnlocked, true);
  assert.equal(row.total, 900 + 1004);
  const existing = find(buildScenarios(data, { ...baseInput, switching: false }), "mint", "mint-unlimited-12", "byod");
  assert.equal(existing.plan, 30 * 36, "no intro price without being a new customer");
  assert.equal(find(rows, "mint", "mint-23gb-12", "byod"), undefined, "23 GB is below the 50 GB floor");
});

test("comparePlans: per-plan facts and a cumulative cost series over the term", () => {
  const cmp = comparePlans(data, ["xf-select", "tello-unl-unl", "tmo-beyond-2"], baseInput);
  assert.equal(cmp.length, 3);
  const xf = cmp.find((c) => c.planId === "xf-select");
  assert.equal(xf.carrierName, "Xfinity Mobile");
  assert.equal(xf.monthly, 30);
  assert.deepEqual(xf.intro, { months: 12, monthly: 0 });
  assert.equal(xf.total, 720);
  assert.equal(xf.cumulative.length, 37, "month 0 through 36");
  assert.equal(xf.cumulative[0], 0);
  assert.equal(xf.cumulative[12], 0);
  assert.equal(xf.cumulative[13], 30);
  assert.equal(xf.cumulative[36], 720);
  assert.equal(xf.fee, 25);
  assert.equal(xf.promoCount, 0, "Select unlocks no phone deals");
  const tmo = cmp.find((c) => c.planId === "tmo-beyond-2");
  assert.equal(tmo.fee, 35);
  assert.equal(tmo.cumulative[36], 3600);
  assert.equal(tmo.promoCount, 6, "switching on with an iPhone 14: every Beyond promo qualifies");
  assert.equal(comparePlans(data, ["tmo-beyond-2"], { ...baseInput, tradeInId: null, switching: false })[0].promoCount, 0);
  assert.equal(cmp.find((c) => c.planId === "tello-unl-unl").premiumDataGb, 50);
  assert.deepEqual(comparePlans(data, ["nope"], baseInput), []);
});

test("multi-line: plan priced for the line count, fees per line, phone/credits/trade-in per new phone", () => {
  const three = buildScenarios(data, { ...baseInput, lines: 3, phones: 3 });
  const tmo = find(three, "tmobile", "tmo-beyond-2", "tmo-ID260835");
  assert.equal(tmo.plan, 170 * 36, "Beyond 2.0 is $170/mo for 3 lines with AutoPay");
  assert.equal(tmo.planMonthly, 170);
  assert.equal(tmo.perLine, +(170 / 3).toFixed(2));
  assert.equal(tmo.phone, 3 * 1199);
  assert.equal(tmo.credits, 3 * 930);
  assert.equal(tmo.fees, 3 * 35);
  assert.equal(tmo.tradeInValue, 3 * 195);
  assert.equal(tmo.total, 170 * 36 + 3 * (1199 - 930) + 105 + 585);

  const onePhone = find(buildScenarios(data, { ...baseInput, lines: 3, phones: 1 }), "tmobile", "tmo-beyond-2", "tmo-ID260835");
  assert.equal(onePhone.phone, 1199);
  assert.equal(onePhone.credits, 930);
  assert.equal(onePhone.tradeInValue, 195);
  assert.equal(onePhone.fees, 105, "connection charge is per line, not per phone");

  const att = find(three, "att", "att-premium-2", "att-tradein-1200");
  assert.equal(att.plan, 65 * 3 * 36, "AT&T Premium 2.0 is $65/line at 3 lines");
  assert.equal(att.stacked, 3 * 200, "online new-line credit is per line");

  const xf = find(three, "xfinity", "xf-select", "byod");
  assert.equal(xf.plan, (0 + 30 * 2) * 12 + 30 * 3 * 24, "Xfinity's free year covers one Select line only");
  assert.equal(xf.fees, 3 * 25);

  const mint = find(three, "mint", "mint-unlimited-12", "byod");
  assert.equal(mint.plan, 15 * 3 * 12 + 30 * 3 * 24, "Mint family lines cost the same as single lines");
  assert.equal(find(three, "tello", "tello-unl-unl", "byod").plan, 25 * 3 * 36);
});

test("multi-line: T-Mobile credits stop at four discounted devices per account", () => {
  const five = buildScenarios(data, { ...baseInput, lines: 5, phones: 5 });
  const tmo = find(five, "tmobile", "tmo-beyond-2", "tmo-ID260835");
  assert.equal(tmo.credits, 4 * 930);
  assert.equal(tmo.phone, 5 * 1199);
  assert.equal(tmo.creditedPhones, 4);
  assert.equal(tmo.creditCapped, true);
  assert.equal(find(five, "tmobile", "tmo-beyond-2", "byod").creditCapped, false);
  assert.equal(find(five, "tmobile", "tmo-beyond-2", "byod").appleTradeIn, 5 * 195, "Apple trades every phone in");
});

test("comparePlans reports the line count and per-line price", () => {
  const cmp = comparePlans(data, ["tmo-beyond-2", "att-premium-2"], { ...baseInput, lines: 4 });
  assert.equal(cmp[0].monthly, 215);
  assert.equal(cmp[0].lines, 4);
  assert.equal(cmp[0].perLine, 53.75);
  assert.equal(cmp[1].monthly, 200);
  assert.equal(cmp[0].cumulative[36], 215 * 36);
});

test("per-line phones and trade-ins: each line priced on its own, promos credit only lines that qualify", () => {
  const input = {
    ...baseInput,
    phoneId: undefined, tradeInId: undefined, lines: 3,
    lineItems: [
      { phoneId: "iphone-18-pro-256", tradeInId: "iphone-16" },      // $1,200 tier on Beyond, Apple $430
      { phoneId: "iphone-18-pro-max-512", tradeInId: null },         // new phone, nothing to trade
      { phoneId: null, tradeInId: null },                            // keeps their phone
    ],
  };
  const rows = buildScenarios(data, input);
  const tmo = find(rows, "tmobile", "tmo-beyond-2", "tmo-ID260835");
  assert.equal(tmo.phones, 2);
  assert.equal(tmo.phone, 1199 + 1499);
  assert.equal(tmo.credits, 1199, "only line 1 has a trade-in; its credit is capped at its phone");
  assert.equal(tmo.creditedPhones, 1);
  assert.equal(tmo.tradeInValue, 430);
  assert.equal(tmo.fees, 3 * 35);
  assert.equal(tmo.total, 170 * 36 + (1199 + 1499) - 1199 + 105 + 430);
  assert.deepEqual(tmo.lineDetails.map((l) => [l.phoneName, l.tradeInName, l.credit]), [
    ["iPhone 18 Pro 256 GB", "iPhone 16", 1199],
    ["iPhone 18 Pro Max 512 GB", null, 0],
    [null, null, 0],
  ]);

  const apple = find(rows, "tmobile", "tmo-beyond-2", "byod");
  assert.equal(apple.appleTradeIn, 430);
  assert.equal(apple.phoneNet, 1199 + 1499 - 430);
  assert.equal(apple.routeName, "Buy from Apple with trade-in, bring your own");

  const port = find(rows, "tmobile", "tmo-beyond-2", "tmo-ID260824");
  assert.equal(port.credits, 1199 + 1200, "no-trade-in promo credits every new phone, each capped at its own price");
});

test("per-line: a trade-in promo drops out when no line trades in; no new phones means plan-only routes", () => {
  const none = buildScenarios(data, { ...baseInput, phoneId: undefined, tradeInId: undefined, lines: 2, lineItems: [{ phoneId: "iphone-18-pro-256" }, { phoneId: "iphone-18-pro-256" }] });
  assert.equal(find(none, "tmobile", "tmo-beyond-2", "tmo-ID260835"), undefined);
  assert.ok(find(none, "tmobile", "tmo-beyond-2", "tmo-ID260824"));
  const planOnly = buildScenarios(data, { ...baseInput, phoneId: undefined, tradeInId: undefined, lines: 2, lineItems: [{}, {}] });
  const t = find(planOnly, "tello", "tello-unl-unl", "byod");
  assert.equal(t.phone, 0);
  assert.equal(t.phones, 0);
  assert.equal(t.total, 50 * 36);
  assert.equal(t.routeName, "No new phone");
  assert.equal(find(planOnly, "tmobile", "tmo-beyond-2", "tmo-ID260824"), undefined, "nothing to credit");
});

test("per-line Xfinity override: only that line's unlisted trade-in uses it", () => {
  const input = { ...baseInput, phoneId: undefined, tradeInId: undefined, lines: 2, overrides: {},
    lineItems: [{ phoneId: "iphone-18-pro-256", tradeInId: "iphone-14" }, { phoneId: "iphone-18-pro-256", tradeInId: "iphone-11", xfCredit: 300 }] };
  const row = find(buildScenarios(data, input), "xfinity", "xf-plus", "xf-tradein-1300");
  assert.deepEqual(row.lineDetails.map((l) => l.credit), [600, 300]);
  assert.equal(row.unverified, true);
  const noOverride = find(buildScenarios(data, { ...input, lineItems: [{ phoneId: "iphone-18-pro-256", tradeInId: "iphone-11" }] }), "xfinity", "xf-plus", "xf-tradein-1300");
  assert.equal(noOverride.lineDetails[0].credit, 1199, "no override → the published ceiling, capped at the phone");
});

test("Costco: T-Mobile shop card and Visa per line, connection charge waived; AT&T credits replace the online offer", () => {
  const on = buildScenarios(data, { ...baseInput, tradeInId: null, costco: true });
  const off = buildScenarios(data, { ...baseInput, tradeInId: null });
  const tmo = find(on, "tmobile", "tmo-beyond-2", "tmo-ID260824");
  assert.equal(tmo.costcoValue, 150 + 250, "financed phone on Beyond, ported: $150 shop card + $250 Visa");
  assert.equal(tmo.fees, 0, "device connection charge waived through Costco");
  assert.equal(tmo.total, find(off, "tmobile", "tmo-beyond-2", "tmo-ID260824").total - 400 - 35);
  assert.equal(find(on, "tmobile", "tmo-more-2", "tmo-more-port").costcoValue, 150, "More 2.0 is below the $100 Visa floor");
  assert.equal(find(on, "tmobile", "tmo-essentials-2", "byod").costcoValue, 0, "Essentials is below the $85 floor");
  assert.equal(find(on, "tmobile", "tmo-beyond-2", "byod").costcoValue, 75, "bring your own on a new $85+ line: $75 shop card");
  assert.equal(find(on, "tmobile", "tmo-beyond-2", "byod").fees, 35, "no financed phone, no waiver");

  const withTrade = buildScenarios(data, { ...baseInput, costco: true });
  const att = find(withTrade, "att", "att-premium-2", "att-tradein-1200");
  assert.equal(att.costcoValue, 250 + 100);
  assert.equal(att.stacked, 0, "Costco's credits replace the $200 online offer");
  assert.equal(att.fees, 0, "activation waived");
  assert.equal(find(withTrade, "att", "att-premium-2", "byod").costcoValue, 0, "BYOD does not qualify at Costco");
  assert.equal(find(withTrade, "att", "att-premium-2", "byod").stacked, 200, "the online credit still applies to bring-your-own");

  const noSwitch = find(buildScenarios(data, { ...baseInput, tradeInId: null, costco: true, switching: false }), "tmobile", "tmo-beyond-2", "byod");
  assert.equal(noSwitch.costcoValue, 0, "the $75 needs a new line");
  assert.equal(find(on, "tello", "tello-unl-unl", "byod").costcoValue, 0);
});

test("cashflow: cumulative out-of-pocket by month; upfront differs by route, month 36 equals the total", () => {
  const rows = buildScenarios(data, baseInput);
  const apple = find(rows, "tello", "tello-unl-unl", "byod");
  const cf = cashflow(apple);
  assert.equal(cf.length, 37);
  assert.equal(cf[0], 1199 - 195, "Apple route pays the phone up front, less the Apple trade-in");
  assert.equal(cf[1], 1004 + 25);
  assert.equal(cf[36], apple.total);

  const promo = find(rows, "tmobile", "tmo-beyond-2", "tmo-ID260835");
  const pf = cashflow(promo);
  assert.equal(pf[0], 35 + 195, "carrier route: connection charge and the surrendered phone on day one");
  assert.equal(pf[1], +(35 + 195 + 100 + (1199 - 930) / 36).toFixed(2), "then plan plus the financed phone net of credits");
  assert.equal(pf[36], promo.total);

  const xf = find(rows, "xfinity", "xf-select", "byod");
  const xc = cashflow(xf);
  assert.equal(xc[12], xc[0], "free first year: nothing accrues for 12 months");
  assert.equal(xc[36], xf.total);

  const costco = find(buildScenarios(data, { ...baseInput, tradeInId: null, costco: true }), "tmobile", "tmo-beyond-2", "tmo-ID260824");
  assert.equal(cashflow(costco)[0], 0 - 400, "Costco cards counted on day one");
  assert.equal(cashflow(costco)[36], costco.total);
});
