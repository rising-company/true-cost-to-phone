// The one situation everything off the tool quotes.
//
// The landing page computes it on first load, the social card is a picture of it,
// and every generated SEO page prices it. They have to agree: a search result that
// promises one number and a page that shows another is worse than no page.

/**
 * What counts as a plan worth showing. The page has always pinned this: a plan with
 * 300 minutes and no data is not an answer to "what does an iPhone 18 Pro cost", and
 * pricing one makes every carrier above it look worse than it is. It lives here so
 * the page, the social card and the generated pages cannot drift apart — they did
 * once, and the card shipped a Tello plan with no data on it.
 */
export const USAGE_FLOOR = { minDataGb: 50, minutes: "unlimited" };

/** One line, an iPhone 18 Pro 256, no trade-in, not switching. */
export const HEADLINE_SCENARIO = {
  lines: 1,
  lineItems: [{ phoneId: "iphone-18-pro-256", tradeInId: null }],
  switching: false,
  costco: false,
  ...USAGE_FLOOR,
};

/**
 * The situation the phone deals actually need: switching in with a phone to trade.
 * Every carrier promotion requires a port-in, a trade-in or both, so the headline
 * scenario filters all of them out — a page about "is this deal worth it" has to
 * price the case where the deal is on the table. An iPhone 16 Pro is the trade-in:
 * two years old at the crawl date, and Apple puts it at $510.
 */
export const SWITCHER_SCENARIO = {
  lines: 1,
  lineItems: [{ phoneId: "iphone-18-pro-256", tradeInId: "iphone-16-pro" }],
  switching: true,
  costco: false,
  ...USAGE_FLOOR,
};
