// Run: node --test tests/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");

test("the page tells iPhone Duo shoppers support follows the 10/16 pre-order", () => {
  const banner = html.match(/<aside class="banner"[^>]*>([\s\S]*?)<\/aside>/);
  assert.ok(banner, "index.html carries an <aside class=\"banner\">");
  const text = banner[1].replace(/<[^>]+>/g, "");
  assert.match(text, /iPhone Duo/);
  assert.match(text, /10\/16/);
  assert.match(text, /pre-order/i);
});

test("every Buy me a coffee link goes to buymeacoffee.com/risingben", () => {
  const links = [...html.matchAll(/https:\/\/buymeacoffee\.com\/[\w-]+/g)].map((m) => m[0]);
  assert.ok(links.length > 0, "the page links to Buy me a coffee");
  for (const l of links) assert.equal(l, "https://buymeacoffee.com/risingben");
});
