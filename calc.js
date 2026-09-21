// True Cost to Phone — the calculator.
//
// Pure functions over data/pricing.json. No DOM, no fetch, so the same module
// runs in the page and under `node --test`.
//
// A scenario is one (carrier, plan, route) combination priced over the term:
//
//   total = plan × term
//         + phone − credits            (carrier credits never exceed the phone;
//                                        buying from Apple takes Apple Trade In
//                                        off the price instead)
//         + one-time fees × lines
//         + trade-in into the deal      (Apple Trade In estimate of the phone a
//                                        carrier promo takes from you)
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
  if (r.tradeIn) out.push(`Trade-in · ${r.tradeInCondition || "eligible"} condition`);
  if (!promo && input.tradeInId) out.push("Apple Trade In");
  if (planIntro(plan, input)) out.push("New customer intro price");
  return out;
}

/**
 * Every priced combination for the input, cheapest first.
 *
 * input: { phoneId, tradeInId, lines, termMonths, switching, minDataGb, minutes, overrides }
 *   overrides — { [promoId]: credit } for tiers a carrier does not publish (Xfinity).
 */
export function buildScenarios(data, input) {
  const termMonths = input.termMonths ?? data.meta.defaultTermMonths ?? 36;
  const lines = input.lines ?? 1;
  const phone = data.phones.find((p) => p.id === input.phoneId);
  const tradeIn = data.tradeIns.find((t) => t.id === input.tradeInId);
  if (!phone) throw new Error(`unknown phone ${input.phoneId}`);
  const overrides = input.overrides || {};
  const rows = [];

  for (const carrier of data.carriers) {
    const fees = round2((carrier.fees?.perLineOneTime || 0) * lines);

    for (const plan of carrier.plans) {
      if (!planFits(plan, input)) continue;
      const plan$ = planTotal(plan, { lines, termMonths, switching: input.switching });
      if (plan$ == null) continue;
      const intro = planIntro(plan, { lines, termMonths, switching: input.switching });

      const eligible = carrier.promos.filter((p) => promoEligible(p, plan.id, input));
      const stackables = eligible.filter((p) => p.stackable);
      const mains = eligible.filter((p) => !p.stackable);
      const stackedCredit = (byod) =>
        stackables.filter((p) => !byod || p.appliesToByod).reduce((sum, p) => sum + tierCredit(p, input.tradeInId), 0);

      const push = ({ route, routeName, promo, credit, stacked, unverified, surrendered }) => {
        const byod = route === "byod";
        const phoneCost = phone.retail; // same sticker everywhere — see meta.notes
        const appleTradeIn = byod ? Math.min(tradeIn?.appleValue || 0, phoneCost) : 0;
        const credits = Math.min(round2(credit + stacked), phoneCost - appleTradeIn);
        const tradeInValue = surrendered ? tradeIn?.appleValue || 0 : 0;
        const total = round2(plan$ + phoneCost - appleTradeIn - credits + fees + tradeInValue);
        rows.push({
          carrierId: carrier.id,
          carrierName: carrier.name,
          network: carrier.network,
          planId: plan.id,
          planName: plan.name,
          planMonthly: plan.monthly[String(lines)],
          planIntro: intro,
          planNotes: plan.notes || "",
          route,
          routeName,
          simUnlocked: byod, // Apple sells unlocked; a carrier-financed phone stays locked until paid off
          promoId: promo?.id || null,
          sourceKey: promo?.sourceKey || null,
          termMonths,
          lines,
          plan: plan$,
          phone: phoneCost,
          appleTradeIn,
          credits,
          stacked,
          phoneNet: round2(phoneCost - appleTradeIn - credits),
          fees,
          feesLabel: carrier.fees?.label || "",
          tradeInValue,
          tradeInName: surrendered ? tradeIn?.name || input.tradeInId : null,
          tradeInCondition: promo?.requires?.tradeInCondition || null,
          unverified: !!unverified,
          endsOn: promo?.endsOn || null,
          requires: requirementsFor(carrier, plan, promo, input),
          total,
          perMonth: round2(total / termMonths),
        });
      };

      // Route 1 — buy from Apple, trade the old phone in to Apple, bring the new one to the plan.
      push({
        route: "byod",
        routeName: `Buy from Apple${tradeIn ? " with trade-in" : ""}${carrier.phoneSource === "carrier" ? ", bring your own" : ""}`,
        promo: null,
        credit: 0,
        stacked: stackedCredit(true),
        surrendered: false,
      });

      // Route 2..n — each promotion the plan qualifies for.
      for (const promo of mains) {
        const tier = tierFor(promo, input.tradeInId);
        if (!tier) continue;
        // An override only stands in for a tier the carrier has not published.
        const credit = tier.verified === false ? overrides[promo.id] ?? tier.credit : tier.credit;
        push({
          route: promo.id,
          routeName: promo.name,
          promo,
          credit,
          stacked: stackedCredit(false),
          unverified: tier.verified === false,
          surrendered: !!promo.requires?.tradeIn,
        });
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
