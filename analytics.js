// True Cost to Phone — measurement.
// PostHog, provisioned through the Vercel Marketplace. The project token is a public
// write-only key: it ships in the page like every client-side analytics key does.
// No build step here, so it is written in rather than injected from the environment.

import { heroSummary } from "./calc.js";

const TOKEN = "phc_BjJenex2UjxsZ7NTyQBxiNWCEr6AW3vuAMtm3EairtxT";
const HOST = "https://us.posthog.com";

const LOCAL = new Set(["localhost", "127.0.0.1", "[::1]", "::1", "0.0.0.0", ""]);

/** Development is not a visitor. Keeps `python3 -m http.server` out of the numbers. */
export function shouldTrack(hostname) {
  const h = String(hostname || "").toLowerCase();
  return !LOCAL.has(h) && !h.endsWith(".local");
}

/**
 * What a priced situation looks like as event properties: the inputs the reader chose and
 * the route that won them. Shapes, counts and ids only — no free text, no identifiers.
 */
export function situationProps(state, rows) {
  const items = state.lineItems || [];
  const withPhone = items.filter((li) => li.phoneId);
  const best = rows.length ? rows[0] : null;
  const models = [...new Set(withPhone.map((li) => li.phoneId))].sort();
  return {
    lines: items.length,
    new_phones: withPhone.length,
    trade_ins: items.filter((li) => li.tradeInId).length,
    switching: !!state.switching,
    costco: !!state.costco,
    carrier_filter: state.carrier || "all",
    phone_models: models.length ? models.join(",") : "none",
    routes: rows.length,
    cheapest_carrier: best ? best.carrierId : null,
    cheapest_plan: best ? best.planId : null,
    cheapest_route: best ? best.route : null,
    cheapest_total: best ? best.total : null,
    spread: best ? heroSummary(rows).spread : null,
  };
}

let lastSituation = null;

/**
 * Renders repeat for reasons that are not a new situation — switching tabs, folding a
 * section. Counting those again would inflate what people actually priced.
 */
export function situationIsNew(props) {
  const seen = JSON.stringify(props);
  if (seen === lastSituation) return false;
  lastSituation = seen;
  return true;
}

/* PostHog's official loader stub — it queues calls until array.js arrives. Verbatim from
   the install snippet; leaving it unformatted keeps it diffable against theirs. */
function loadSnippet() {
  !function(t,e){var o,n,p,r;e.__SV||(window.posthog=e,e._i=[],e.init=function(i,s,a){function g(t,e){var o=e.split(".");2==o.length&&(t=t[o[0]],e=o[1]),t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}}(p=t.createElement("script")).type="text/javascript",p.crossOrigin="anonymous",p.async=!0,p.src=s.api_host+"/static/array.js",(r=t.getElementsByTagName("script")[0]).parentNode.insertBefore(p,r);var u=e;for(void 0!==a?u=e[a]=[]:a="posthog",u.people=u.people||[],u.toString=function(t){var e="posthog";return"posthog"!==a&&(e+="."+a),t||(e+=" (stub)"),e},u.people.toString=function(){return u.toString(1)+".people (stub)"},o="capture identify alias people.set people.set_once set_config register register_once unregister opt_out_capturing has_opted_out_capturing opt_in_capturing reset isFeatureEnabled onFeatureFlags getFeatureFlag getFeatureFlagPayload reloadFeatureFlags group updateEarlyAccessFeatureEnrollment getEarlyAccessFeatures getActiveMatchingSurveys getSurveys getNextSurveyStep".split(" "),n=0;n<o.length;n++)g(u,o[n]);e._i.push([i,s,a])},e.__SV=1)}(document,window.posthog||[]);
}

let on = false;

/** Loads PostHog unless this is a local session. Safe to call more than once. */
export function init() {
  if (on || typeof window === "undefined" || !shouldTrack(location.hostname)) return false;
  loadSnippet();
  window.posthog.init(TOKEN, {
    api_host: HOST,
    defaults: "2025-05-24",
    person_profiles: "identified_only", // nobody signs in here; these are anonymous readers
  });
  on = true;
  return true;
}

/** Fire and forget. A no-op when measurement is off, so callers never guard. */
export function track(event, props) {
  if (on) window.posthog.capture(event, props);
}
