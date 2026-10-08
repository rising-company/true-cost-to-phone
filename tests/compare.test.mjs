// Run: node --test tests/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { buildScenarios } from "../calc.js";
import { routeAnchor } from "../compare.js";
import { HEADLINE_SCENARIO } from "../scenario.js";

const data = JSON.parse(readFileSync(new URL("../data/pricing.json", import.meta.url), "utf8"));

test("every route gets its own anchor, usable as an element id", () => {
  const rows = buildScenarios(data, HEADLINE_SCENARIO);
  const anchors = rows.map(routeAnchor);
  assert.equal(new Set(anchors).size, rows.length, "one anchor per route");
  for (const a of anchors) assert.match(a, /^route-[a-z0-9-]+$/, `${a} is a plain id`);
});
