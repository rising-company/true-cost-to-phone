// Run: node --test tests/
import { test } from "node:test";
import assert from "node:assert/strict";

import { readFileSync } from "node:fs";

import { shouldTrack, situationProps, situationIsNew } from "../analytics.js";
import { buildScenarios, heroSummary } from "../calc.js";

const data = JSON.parse(readFileSync(new URL("../data/pricing.json", import.meta.url), "utf8"));

test("local development is not measured; the deployed site is", () => {
  assert.equal(shouldTrack("localhost"), false);
  assert.equal(shouldTrack("127.0.0.1"), false);
  assert.equal(shouldTrack("[::1]"), false);
  assert.equal(shouldTrack("bens-mac.local"), false);
  assert.equal(shouldTrack("true-cost-to-phone.vercel.app"), true);
  assert.equal(shouldTrack("phone.rising.company"), true);
});

test("a priced situation reports the inputs and what won, never the visitor", () => {
  const rows = buildScenarios(data, {
    phoneId: "iphone-18-pro-256",
    tradeInId: "iphone-14",
    lines: 1,
    termMonths: 36,
    switching: true,
    minDataGb: 50,
    minutes: "unlimited",
    overrides: {},
  });
  const props = situationProps(
    { lineItems: [{ phoneId: "iphone-18-pro-256", tradeInId: "iphone-14" }], switching: true, costco: false, carrier: "" },
    rows,
  );
  assert.equal(props.lines, 1);
  assert.equal(props.new_phones, 1);
  assert.equal(props.trade_ins, 1);
  assert.equal(props.switching, true);
  assert.equal(props.costco, false);
  assert.equal(props.carrier_filter, "all");
  assert.equal(props.routes, rows.length);
  assert.equal(props.cheapest_carrier, rows[0].carrierId);
  assert.equal(props.cheapest_plan, rows[0].planId);
  assert.equal(props.cheapest_route, rows[0].route);
  assert.equal(props.cheapest_total, rows[0].total);
  assert.equal(props.spread, heroSummary(rows).spread);
  assert.equal(props.phone_models, "iphone-18-pro-256");
});

test("no rows still reports the situation, with nothing claimed about a winner", () => {
  const props = situationProps({ lineItems: [{ phoneId: null, tradeInId: null }], switching: false, costco: true, carrier: "tello" }, []);
  assert.equal(props.routes, 0);
  assert.equal(props.new_phones, 0);
  assert.equal(props.carrier_filter, "tello");
  assert.equal(props.cheapest_carrier, null);
  assert.equal(props.spread, null);
  assert.equal(props.phone_models, "none");
});

test("a situation already reported is not reported again until something changes", () => {
  const props = { lines: 1, cheapest_total: 4200 };
  assert.equal(situationIsNew(props), true, "first sighting counts");
  assert.equal(situationIsNew({ ...props }), false, "an identical re-render is the same data point");
  assert.equal(situationIsNew({ ...props, lines: 2 }), true, "a changed situation counts again");
  assert.equal(situationIsNew({ ...props }), true, "and so does changing back");
});
