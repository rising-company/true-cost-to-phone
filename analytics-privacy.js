// Nothing that identifies a person, and no secret, may reach a tracking service.
// Vercel Analytics and PostHog both record the full URL, so query strings and
// fragments are dropped, and path segments holding an id or token are masked.

const EMAIL = /[^\s/?&=#@]+(?:@|%40)[^\s/?&=#@]+\.[^\s/?&=#@]+/gi;
const OPAQUE_SEGMENT = /@|%40|^(?=.*\d)\w{8,}$|^[0-9a-f-]{32,}$/i;
// The segment after each of these is a record id or access code, whatever it looks like.
const MASKED_AFTER = [];

function redactPath(pathname) {
  const segments = pathname.split("/");
  return segments
    .map((segment, i) => (MASKED_AFTER.includes(segments[i - 1]) || OPAQUE_SEGMENT.test(segment) ? ":id" : segment))
    .join("/");
}

export function redactUrl(raw) {
  const url = new URL(raw);
  url.search = "";
  url.hash = "";
  url.pathname = redactPath(url.pathname);
  return url.href;
}

function clean(value, key) {
  if (typeof value === "string") {
    if (/^https?:\/\//.test(value)) return redactUrl(value);
    if (key === "$pathname") return redactPath(value);
    return value.replace(EMAIL, "[redacted]");
  }
  if (Array.isArray(value)) return value.map((item) => clean(item));
  if (value && Object.getPrototypeOf(value) === Object.prototype) {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, clean(v, k)]));
  }
  return value;
}

/** PostHog `before_send`: scrubs every property, including $referrer and $initial_*. */
export function scrubPostHogEvent(event) {
  if (!event) return event;
  return { ...event, properties: clean(event.properties), $set: clean(event.$set), $set_once: clean(event.$set_once) };
}

/** Vercel Analytics `beforeSend`. */
export function redactAnalyticsEvent(event) {
  return { ...event, url: redactUrl(event.url) };
}
