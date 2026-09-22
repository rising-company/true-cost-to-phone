// True Cost to Phone — the calculator.
//
// Pure functions over data/pricing.json. No DOM, no fetch, so the same module
// runs in the page and under `node --test`.
//
// A scenario is one (carrier, plan, route) combination priced over the term:
//
//   total = plan × term                 (account total for the line count)
//         + phones × (phone − credits)  (carrier credits never exceed the phone;
//                                        buying from Apple takes Apple Trade In
//                                        off the price instead)
//         + one-time fees × lines
//         + phones × trade-in into deal (Apple Trade In estimate of the phone a
//                                        carrier promo takes from you)
//
// `lines` is how many lines the plan carries; `phones` is how many of them get
// the new phone (each with the same trade-in). A promo's `maxDevices` caps how
// many of those phones earn credits.
//
// The last line is what makes "on us" honest: a phone handed to a carrier for
// bill credits is extra out-of-pocket at what Apple would have paid for it.
// Selling it to Apple on the buy-from-Apple route is not a cost — it is money
// off the phone.

const round2 = (n) => Math.round(n * 100) / 100;

const rank = (v) => (v === "unlimited" ? Infinity : Number(v) || 0);

/** The intro price that applies to a plan for this input, or null. */
export function planIntro(plan, { lines = 1, termMonths = 36, switching = false }) {
  const intro = plan.intro;
  const introMonthly = intro?.monthly?.[String(lines)];
  if (!intro || introMonthly == null || (intro.requires?.newLine && !switching)) return null;
  return { months: Math.min(intro.months, termMonths), monthly: introMonthly };
}

/** Plan cost over the term for a line count, or null when no price is known. */
export function planTotal(plan, { lines = 1, termMonths = 36, switching = false }) {
  const monthly = plan.monthly?.[String(lines)];
  if (monthly == null) return null;
  const intro = planIntro(plan, { lines, termMonths, switching });
  if (!intro) return round2(monthly * termMonths);
  return round2(intro.monthly * intro.months + monthly * (termMonths - intro.months));
}

/** Credit a promotion pays for a given trade-in device, or 0 when none applies. */
export function tierCredit(promo, tradeInId) {
  for (const tier of promo.tiers) {
    if (tier.devices?.includes(tradeInId)) return tier.credit;
  }
  const fallback = promo.tiers.find((t) => t.otherwise);
  return fallback ? fallback.credit : 0;
}

function tierFor(promo, tradeInId) {
  return promo.tiers.find((t) => t.devices?.includes(tradeInId)) || promo.tiers.find((t) => t.otherwise) || null;
}

function promoEligible(promo, planId, { switching, tradeInId }) {
  if (!promo.plans.includes(planId)) return false;
  const r = promo.requires || {};
  if ((r.newLine || r.portIn) && !switching) return false;
  if (r.existingLine && switching) return false; // an upgrade offer: the line is already on the account
  if (r.tradeIn && !tradeInId) return false;
  return true;
}

function planFits(plan, { minDataGb = 0, minutes = 0 }) {
  return rank(plan.premiumDataGb) >= rank(minDataGb) && rank(plan.minutes) >= rank(minutes);
}

function requirementsFor(carrier, plan, promo, input) {
  const out = [...(carrier.requires || [])];
  const r = promo?.requires || {};
  if (r.newLine && r.portIn) out.push("New line + port-in");
  else if (r.newLine) out.push("New line");
  else if (r.portIn) out.push("Port-in");
  else if (r.existingLine) out.push("Existing line");
  if (r.tradeIn) out.push(`Trade-in · ${r.tradeInCondition || "eligible"} condition`);
  if (!promo && input.tradeInId) out.push("Apple Trade In");
  if (planIntro(plan, input)) out.push("New customer intro price");
  return out;
}

/**
 * Costco member benefits for a route: value counted against the total, and
 * whether the carrier's one-time fee is waived. `financed` is the number of
 * lines buying a phone through the carrier on this route.
 */
function costcoFor(carrier, plan, { byod, financed, lines, input }) {
  const c = carrier.costco;
  if (!input.costco || !c) return { value: 0, items: [], feeWaived: false, replaces: [] };
  const tier = plan.monthly?.["1"] ?? 0; // plan floor is quoted as the single-line price
  const items = [];
  for (const o of c.offers) {
    const r = o.requires || {};
    if (r.minPlanMonthly && tier < r.minPlanMonthly) continue;
    if ((r.portIn || r.newLine) && !input.switching) continue;
    const count = o.perLine === "financed" ? financed : Math.max(0, lines - financed);
    const n = Math.min(count, o.maxPerAccount ?? count);
    if (n > 0) items.push({ id: o.id, name: o.name, value: o.value * n, count: n });
  }
  return {
    value: round2(items.reduce((s, i) => s + i.value, 0)),
    items,
    feeWaived: !!c.feeWaivedWithFinancedPhone && financed > 0 && !byod,
    replaces: financed > 0 && !byod ? c.replaces || [] : [],
  };
}

/** Normalize the input into one entry per line: { phone, tradeIn } objects or nulls. */
function lineItemsFor(data, input) {
  const lines = input.lines ?? 1;
  const byPhone = (id) => (id ? data.phones.find((p) => p.id === id) || null : null);
  const byTrade = (id) => (id ? data.tradeIns.find((t) => t.id === id) || null : null);
  let items;
  if (input.lineItems) {
    items = input.lineItems.slice(0, lines).map((li) => ({ phone: byPhone(li?.phoneId), tradeIn: byPhone(li?.phoneId) ? byTrade(li?.tradeInId) : null, xfCredit: li?.xfCredit ?? null }));
  } else {
    // Legacy shape: one phone model and trade-in, on the first `phones` lines.
    const phones = Math.max(1, Math.min(lines, input.phones ?? lines));
    const phone = byPhone(input.phoneId);
    if (!phone) throw new Error(`unknown phone ${input.phoneId}`);
    const tradeIn = byTrade(input.tradeInId);
    items = Array.from({ length: phones }, () => ({ phone, tradeIn, xfCredit: input.overrides?.[Object.keys(input.overrides || {})[0]] ?? null }));
  }
  while (items.length < lines) items.push({ phone: null, tradeIn: null });
  return items;
}

const phoneName = (p) => `${p.model} ${p.storageGb >= 1024 ? `${p.storageGb / 1024} TB` : `${p.storageGb} GB`}`;

/**
 * Every priced combination for the input, cheapest first.
 *
 * input: { lines, lineItems: [{ phoneId, tradeInId }], termMonths, switching, minDataGb, minutes, overrides }
 *   Each line picks its own new phone (or none) and trade-in (or none).
 *   Legacy shape { phoneId, tradeInId, phones } is still accepted.
 *   overrides — { [promoId]: credit } for tiers a carrier does not publish (Xfinity).
 */
export function buildScenarios(data, input) {
  const termMonths = input.termMonths ?? data.meta.defaultTermMonths ?? 36;
  const lines = input.lines ?? 1;
  const items = lineItemsFor(data, input);
  const overrides = input.overrides || {};
  const withPhone = items.filter((li) => li.phone);
  const phones = withPhone.length;
  const anyTradeIn = withPhone.some((li) => li.tradeIn);
  const rows = [];

  for (const carrier of data.carriers) {
    const fees = round2((carrier.fees?.perLineOneTime || 0) * lines);

    for (const plan of carrier.plans) {
      if (!planFits(plan, input)) continue;
      const plan$ = planTotal(plan, { lines, termMonths, switching: input.switching });
      if (plan$ == null) continue;
      const intro = planIntro(plan, { lines, termMonths, switching: input.switching });

      const eligible = carrier.promos.filter((p) => promoEligible(p, plan.id, { ...input, tradeInId: anyTradeIn ? "any" : null }));
      const stackables = eligible.filter((p) => p.stackable);
      const mains = eligible.filter((p) => !p.stackable);

      const push = ({ route, routeName, promo, unverified }) => {
        const byod = route === "byod";
        const maxCredited = promo?.maxDevices ?? Infinity;
        let credited = 0;
        let creditCapped = false;
        const lineDetails = items.map((li) => {
          if (!li.phone) return { phoneName: null, tradeInName: null, retail: 0, credit: 0, appleTradeIn: 0, tradeInValue: 0 };
          const retail = li.phone.retail;
          const tradeInValue = li.tradeIn?.appleValue || 0;
          if (byod) {
            return { phoneName: phoneName(li.phone), tradeInName: li.tradeIn?.name || null, retail, credit: 0, appleTradeIn: Math.min(tradeInValue, retail), tradeInValue: 0 };
          }
          const needsTrade = !!promo.requires?.tradeIn;
          const tier = needsTrade ? (li.tradeIn ? tierFor(promo, li.tradeIn.id) : null) : tierFor(promo, null);
          let credit = 0;
          if (tier && credited < maxCredited) {
            credit = Math.min(tier.verified === false ? li.xfCredit ?? overrides[promo.id] ?? tier.credit : tier.credit, retail);
            credited++;
          } else if (tier) {
            creditCapped = true;
          }
          // The phone only goes to the carrier when the promo actually takes it.
          const surrendered = needsTrade && credit > 0;
          return { phoneName: phoneName(li.phone), tradeInName: surrendered ? li.tradeIn.name : null, retail, credit, appleTradeIn: 0, tradeInValue: surrendered ? tradeInValue : 0 };
        });
        const phoneCost = round2(lineDetails.reduce((s, l) => s + l.retail, 0));
        const appleTradeIn = round2(lineDetails.reduce((s, l) => s + l.appleTradeIn, 0));
        const costco = costcoFor(carrier, plan, { byod, financed: byod ? 0 : phones, lines, input });
        const stacked = round2(stackables.filter((p) => (!byod || p.appliesToByod) && !costco.replaces.includes(p.id)).reduce((sum, p) => sum + tierCredit(p, null), 0) * lines);
        // Device credits never exceed the phone. Stackable credits are line bill credits
        // (AT&T's $200 pays out on a bring-your-own line too), so they are not capped:
        // what the phone cannot absorb comes off the plan instead.
        const phoneAfterApple = round2(phoneCost - appleTradeIn);
        const credits = round2(Math.min(round2(lineDetails.reduce((s, l) => s + l.credit, 0)), phoneAfterApple) + stacked);
        const planCredit = round2(Math.max(0, credits - phoneAfterApple));
        const tradeInValue = round2(lineDetails.reduce((s, l) => s + l.tradeInValue, 0));
        const routeFees = costco.feeWaived ? 0 : fees;
        const total = round2(plan$ + phoneCost - appleTradeIn - credits + routeFees + tradeInValue - costco.value);
        const surrenderedNames = lineDetails.filter((l) => l.tradeInName).map((l) => l.tradeInName);
        rows.push({
          carrierId: carrier.id,
          carrierName: carrier.name,
          network: carrier.network,
          planId: plan.id,
          planName: plan.name,
          planMonthly: plan.monthly[String(lines)],
          perLine: round2(plan.monthly[String(lines)] / lines),
          planIntro: intro,
          planNotes: plan.notes || "",
          route,
          routeName,
          simUnlocked: byod && phones > 0, // Apple sells unlocked; a carrier-financed phone stays locked until paid off
          promoId: promo?.id || null,
          sourceKey: promo?.sourceKey || null,
          termMonths,
          lines,
          phones,
          creditedPhones: credited,
          creditCapped,
          lineDetails,
          plan: round2(plan$ - planCredit),
          planCredit,
          phone: phoneCost,
          appleTradeIn,
          credits,
          stacked,
          phoneNet: round2(phoneAfterApple - credits + planCredit),
          fees: routeFees,
          feesWaived: costco.feeWaived,
          feesLabel: carrier.fees?.label || "",
          costcoValue: costco.value,
          costcoItems: costco.items,
          costcoSourceKey: costco.value ? carrier.costco.sourceKey : null,
          tradeInValue,
          tradeInName: surrenderedNames.length ? [...new Set(surrenderedNames)].join(", ") : null,
          tradeInCondition: promo?.requires?.tradeInCondition || null,
          unverified: !!unverified,
          endsOn: promo?.endsOn || null,
          requires: requirementsFor(carrier, plan, promo, { ...input, tradeInId: anyTradeIn ? "any" : null }),
          total,
          perMonth: round2(total / termMonths),
        });
      };

      // Route 1 — buy from Apple (trading the old phone in to Apple), bring the new one to the plan.
      const byodName = phones === 0 ? "No new phone" : `Buy from Apple${anyTradeIn ? " with trade-in" : ""}${carrier.phoneSource === "carrier" ? ", bring your own" : ""}`;
      push({ route: "byod", routeName: byodName, promo: null });

      // Route 2..n — each promotion the plan qualifies for, when there is a phone to credit.
      if (phones === 0) continue;
      for (const promo of mains) {
        const unverified = withPhone.some((li) => {
          const tier = promo.requires?.tradeIn ? (li.tradeIn ? tierFor(promo, li.tradeIn.id) : null) : tierFor(promo, null);
          return tier?.verified === false;
        });
        push({ route: promo.id, routeName: promo.name, promo, unverified });
      }
    }
  }

  return rows.sort((a, b) => a.total - b.total);
}

/**
 * Side-by-side facts for chosen plans, for the Plans tab. Same input as
 * buildScenarios; the cumulative series is plan cost only (no phone, no fees),
 * month 0 through termMonths, so intro pricing shows as a flatter first year.
 */
export function comparePlans(data, planIds, input) {
  const termMonths = input.termMonths ?? data.meta.defaultTermMonths ?? 36;
  const lines = input.lines ?? 1;
  const out = [];
  for (const carrier of data.carriers) {
    for (const plan of carrier.plans) {
      if (!planIds.includes(plan.id)) continue;
      const monthly = plan.monthly?.[String(lines)];
      if (monthly == null) continue;
      const intro = planIntro(plan, { lines, termMonths, switching: input.switching });
      const cumulative = [0];
      for (let m = 1; m <= termMonths; m++) {
        const rate = intro && m <= intro.months ? intro.monthly : monthly;
        cumulative.push(round2(cumulative[m - 1] + rate));
      }
      out.push({
        planId: plan.id,
        planName: plan.name,
        carrierId: carrier.id,
        carrierName: carrier.name,
        network: carrier.network,
        monthly,
        lines,
        perLine: round2(monthly / lines),
        intro,
        total: cumulative[termMonths],
        cumulative,
        fee: round2((carrier.fees?.perLineOneTime || 0) * lines),
        feeLabel: carrier.fees?.label || "",
        premiumDataGb: plan.premiumDataGb,
        minutes: plan.minutes,
        notes: plan.notes || "",
        requires: carrier.requires || [],
        phoneSource: carrier.phoneSource,
        promoCount: carrier.promos.filter((p) => promoEligible(p, plan.id, input)).length,
        termMonths,
      });
    }
  }
  // Keep the caller's order so a chart's colors follow the pick order.
  return planIds.map((id) => out.find((c) => c.planId === id)).filter(Boolean);
}

/**
 * Cumulative out-of-pocket for a scenario, month 0 through the term.
 * Day one: fees, the phone you hand to a carrier (at its Apple value), and —
 * on the buy-from-Apple route — the phones themselves net of Apple Trade In.
 * Then each month: the plan (intro-aware) plus, on carrier routes, the
 * financed phones net of credits spread over the term. Costco cards and
 * stackable credits are taken on day one. Month `term` equals `total`.
 */
export function cashflow(row) {
  const term = row.termMonths;
  const byod = row.route === "byod";
  const monthlyPhone = byod ? 0 : (row.phone - row.credits) / term;
  const upfront = row.fees + row.tradeInValue + (byod ? row.phone - row.appleTradeIn - row.credits : 0) - (row.costcoValue || 0);
  const out = [round2(upfront)];
  for (let m = 1; m <= term; m++) {
    const rate = row.planIntro && m <= row.planIntro.months ? row.planIntro.monthly : row.planMonthly;
    out.push(round2(out[m - 1] + rate + monthlyPhone));
  }
  out[term] = row.total; // absorb rounding drift so the curve lands on the headline number
  return out;
}

/** The hero's glance: the cheapest route per carrier, cheapest first, and the gap between the ends. */
export function heroSummary(rows) {
  if (!rows.length) return null;
  const best = new Map();
  for (const r of rows) if (!best.has(r.carrierId)) best.set(r.carrierId, r); // rows arrive sorted cheapest first
  const carriers = [...best.values()].sort((a, b) => a.total - b.total);
  const cheapest = carriers[0];
  const priciest = carriers[carriers.length - 1];
  return { carriers, cheapest, priciest, spread: priciest.total - cheapest.total };
}
