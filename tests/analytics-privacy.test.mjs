import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { redactAnalyticsEvent, redactUrl, scrubPostHogEvent } from "../analytics-privacy.js";

const POSTHOG_FILE = new URL("../analytics.js", import.meta.url);
const check = test;
const eq = assert.equal;
const ok = assert.ok;

const PAGE = "https://example.org/manage-registration?id=42&email=jo%40example.com#receipt";

check("redactUrl drops the query and fragment", () => {
  eq(redactUrl(PAGE), "https://example.org/manage-registration");
});

check("redactUrl masks ids, tokens and emails in the path", () => {
  eq(redactUrl("https://example.org/a/jo@example.com"), "https://example.org/a/:id");
  eq(redactUrl("https://example.org/a/k97abc123def456"), "https://example.org/a/:id");
  eq(redactUrl("https://example.org/about/our-team"), "https://example.org/about/our-team");
  eq(redactUrl("https://example.org/carrier/att-iphone-18-pro-cost"), "https://example.org/carrier/att-iphone-18-pro-cost");
});

check("scrubPostHogEvent cleans every URL and email property", () => {
  const event = scrubPostHogEvent({
    event: "$pageview",
    properties: { $current_url: PAGE, $referrer: PAGE, $pathname: "/a/k97abc123def456", note: "from jo@example.com", distinct_id: "jo@example.com", count: 3 },
    $set_once: { $initial_current_url: PAGE },
  });
  eq(event.properties.$current_url, "https://example.org/manage-registration");
  eq(event.properties.$referrer, "https://example.org/manage-registration");
  eq(event.properties.$pathname, "/a/:id");
  eq(event.properties.note, "from [redacted]");
  eq(event.properties.distinct_id, "[redacted]");
  eq(event.properties.count, 3);
  eq(event.$set_once.$initial_current_url, "https://example.org/manage-registration");
});

check("redactAnalyticsEvent cleans the Vercel Analytics URL", () => {
  eq(redactAnalyticsEvent({ type: "pageview", url: PAGE }).url, "https://example.org/manage-registration");
});

check("PostHog is told to mask text and never record sessions", () => {
  const config = readFileSync(POSTHOG_FILE, "utf8");
  for (const option of ["before_send: scrubPostHogEvent", "mask_all_text: true", "mask_all_element_attributes: true", "disable_session_recording: true"]) {
    ok(config.includes(option), option);
  }
});
