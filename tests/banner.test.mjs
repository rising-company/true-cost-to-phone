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
