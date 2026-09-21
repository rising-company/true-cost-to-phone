// True Cost to Phone — page wiring.
// Loads data/pricing.json, reads the controls, renders buildScenarios() output.
// State lives in the URL query so a result can be shared.

import { buildScenarios, tierCredit } from "./calc.js";
import { MAX_PLANS, defaultPlanIds, renderPicker, renderComparison } from "./plans.js";

const $ = (sel) => document.querySelector(sel);
const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
const usd2 = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 });
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

const XF_PROMO = "xf-tradein-1300";
const DEFAULTS = { phone: "iphone-18-pro-256", tradein: "", switching: "1", xf: "1300", tab: "routes", plans: "" };

let data;
let showAll = false;
let tab = "routes";
let selectedPlans = null; // null until the first render picks defaults
let defaultPlans = [];
const TOP_PER_CARRIER = 3;

/** Rows to display: the cheapest few per carrier unless the reader asked for everything. Keeps global rank. */
function visibleRows(rows) {
  if (showAll) return rows.map((r, i) => ({ ...r, rank: i + 1 }));
  const seen = new Map();
  return rows
    .map((r, i) => ({ ...r, rank: i + 1 }))
    .filter((r) => {
      const n = seen.get(r.carrierId) || 0;
      seen.set(r.carrierId, n + 1);
      return n < TOP_PER_CARRIER;
    });
}

function readState() {
  const q = new URLSearchParams(location.search);
  return {
    phone: q.get("phone") || DEFAULTS.phone,
    tradein: q.get("tradein") || DEFAULTS.tradein,
    switching: (q.get("switching") ?? DEFAULTS.switching) !== "0",
    xf: Number(q.get("xf") ?? DEFAULTS.xf),
    tab: q.get("tab") === "plans" ? "plans" : "routes",
    plans: (q.get("plans") || "").split(",").filter(Boolean),
  };
}

function writeState(s) {
  const q = new URLSearchParams();
  if (s.phone !== DEFAULTS.phone) q.set("phone", s.phone);
  if (s.tradein !== DEFAULTS.tradein) q.set("tradein", s.tradein);
  if (!s.switching) q.set("switching", "0");
  if (String(s.xf) !== DEFAULTS.xf) q.set("xf", String(s.xf));
  if (tab === "plans") q.set("tab", "plans");
  if (selectedPlans && selectedPlans.join(",") !== defaultPlans.join(",")) q.set("plans", selectedPlans.join(","));
  const qs = q.toString();
  history.replaceState(null, "", qs ? `?${qs}` : location.pathname);
}

function storageLabel(gb) {
  return gb >= 1024 ? `${gb / 1024} TB` : `${gb} GB`;
}

function populateControls(state) {
  const phone = $("#phone");
  phone.innerHTML = data.phones
    .map((p) => `<option value="${p.id}">${esc(p.model)} · ${storageLabel(p.storageGb)} · ${usd.format(p.retail)}</option>`)
    .join("");
  phone.value = state.phone;

  const tradein = $("#tradein");
  tradein.innerHTML =
    `<option value="">No trade-in — keep my phone</option>` +
    data.tradeIns.map((t) => `<option value="${t.id}">${esc(t.name)} · up to ${usd.format(t.appleValue)}</option>`).join("");
  tradein.value = state.tradein;

  $("#switching").checked = state.switching;
  $("#xf").value = state.xf;
}

function inputFromControls() {
  return {
    phone: $("#phone").value,
    tradein: $("#tradein").value,
    switching: $("#switching").checked,
    xf: Math.max(0, Number($("#xf").value) || 0),
  };
}

function planPriceLabel(r) {
  if (!r.planIntro) return `${usd.format(r.planMonthly)}/mo`;
  return `${usd.format(r.planIntro.monthly)}/mo × ${r.planIntro.months}, then ${usd.format(r.planMonthly)}/mo`;
}

function segments(row) {
  return [
    { key: "plan", label: "Plan", value: row.plan, seg: "var(--seg-plan)" },
    { key: "phone", label: "Phone", value: row.phoneNet, seg: "var(--seg-phone)" },
    { key: "fees", label: "Fees", value: row.fees, seg: "var(--seg-fees)" },
    { key: "tradein", label: "Trade-in to deal", value: row.tradeInValue, seg: "var(--seg-tradein)" },
  ];
}

function renderSummary(rows) {
  const best = new Map();
  for (const r of rows) if (!best.has(r.carrierId)) best.set(r.carrierId, r);
  const cheapest = rows[0];
  $("#summary").innerHTML = data.carriers
    .map((c) => {
      const r = best.get(c.id);
      if (!r) return `<div class="card"><div class="stat-label">${esc(c.name)}</div><div class="route">No plan fits the current filters.</div></div>`;
      const isBest = r === cheapest;
      return `<div class="card${isBest ? " is-best" : ""}">
        <div class="stat-label"><span>${esc(c.name)}</span>${isBest ? "<span>Cheapest</span>" : ""}</div>
        <div class="big">${usd.format(r.total)}<small>${usd.format(r.perMonth)}/mo</small></div>
        <div class="route">${esc(r.planName)} · ${esc(r.routeName)}${r.unverified ? " · <em>credit unverified</em>" : ""}</div>
      </div>`;
    })
    .join("");
}

function renderRows(rows, state) {
  const max = Math.max(...rows.map((r) => r.total));
  const cheapest = rows[0]?.total ?? 0;
  const tradeIn = data.tradeIns.find((t) => t.id === state.tradein);

  const shown = visibleRows(rows);
  $("#rows").innerHTML = shown
    .map((r) => {
      const segs = segments(r);
      const bar = segs
        .filter((s) => s.value > 0)
        .map((s) => `<span style="--seg:${s.seg}; flex: ${s.value} 0 0" title="${s.label} ${usd.format(s.value)}"></span>`)
        .join("");
      const legend = segs
        .map((s) => `<span style="--seg:${s.seg}" class="${s.value > 0 ? "" : "is-zero"}">${s.label} <b>${usd.format(s.value)}</b></span>`)
        .join("");
      const badges = [
        r.simUnlocked ? `<span class="badge is-accent">SIM unlocked</span>` : "",
        ...r.requires.map((q) => `<span class="badge">${esc(q)}</span>`),
        r.credits > 0 ? `<span class="badge is-accent">${usd.format(r.credits)} in credits</span>` : "",
        r.unverified ? `<span class="badge is-warning">Unverified · assumes ${usd.format(r.credits)} credit</span>` : "",
        r.endsOn ? `<span class="badge">Ends ${esc(r.endsOn)}</span>` : "",
      ].join("");
      const notes = [];
      if (r.planIntro) notes.push(`Plan is ${usd.format(r.planIntro.monthly)}/mo for the first ${r.planIntro.months} months as a new customer, then ${usd.format(r.planMonthly)}/mo — ${usd.format(r.plan)} over ${r.termMonths} months.`);
      if (r.route !== "byod" && r.tradeInValue > 0) notes.push(`Hands your ${esc(r.tradeInName)} to the carrier — that is ${usd.format(r.tradeInValue)} out of pocket, what Apple would have paid for it.`);
      if (r.route === "byod" && r.appleTradeIn > 0) notes.push(`Trades your ${esc(tradeIn.name)} in to Apple for ${usd.format(r.appleTradeIn)} off the phone.`);
      if (r.simUnlocked) notes.push("Apple sells it unlocked — switch carriers any time, no payoff to leave.");
      if (r.stacked > 0) notes.push(`Includes the ${usd.format(r.stacked)} online new-line credit.`);
      if (r.planNotes) notes.push(esc(r.planNotes));
      const src = r.sourceKey && data.meta.sources[r.sourceKey];
      if (src) notes.push(`<a href="${esc(src)}" target="_blank" rel="noopener noreferrer">Offer terms ↗</a>`);
      const delta = r.total - cheapest;
      return `<article class="card row${r.rank === 1 ? " is-best" : ""}">
        <div class="rank">${String(r.rank).padStart(2, "0")}</div>
        <div class="row-body">
          <div class="card-tag"><span>${esc(r.carrierName)} · ${esc(r.planName)}</span><span class="plan-monthly">${planPriceLabel(r)} · ${esc(r.network)} network</span></div>
          <div class="row-title">${esc(r.routeName)}</div>
          <div class="badges">${badges}</div>
          <div class="bar" role="img" aria-label="${segs.map((s) => `${s.label} ${usd.format(s.value)}`).join(", ")}" style="width:${Math.max(30, (r.total / max) * 100)}%">${bar}</div>
          <div class="row-legend">${legend}</div>
          ${notes.length ? `<div class="row-notes">${notes.join(" ")}</div>` : ""}
        </div>
        <div class="row-total">
          <div class="total">${usd.format(r.total)}</div>
          <div class="subtitle">${usd2.format(r.perMonth)}/mo · ${r.termMonths} mo</div>
          <div class="delta">${delta > 0 ? `+${usd.format(delta)} vs cheapest` : "cheapest"}</div>
        </div>
      </article>`;
    })
    .join("");

  const hidden = rows.length - shown.length;
  const more = $("#show-all");
  more.hidden = rows.length <= shown.length && !showAll;
  more.textContent = showAll ? `Show top ${TOP_PER_CARRIER} per carrier` : `Show all ${rows.length} routes · ${hidden} hidden`;
  more.setAttribute("aria-expanded", String(showAll));

  $("#table tbody").innerHTML = rows
    .map(
      (r, i) => `<tr><td>${i + 1}</td><td>${esc(r.carrierName)}</td><td>${esc(r.planName)}</td><td>${esc(r.routeName)}</td>
        <td class="num">${usd.format(r.plan)}</td><td class="num">${usd.format(r.phoneNet)}</td><td class="num">${usd.format(r.fees)}</td><td class="num">${usd.format(r.tradeInValue)}</td>
        <td class="num">${usd2.format(r.total)}</td><td class="num">${usd2.format(r.perMonth)}</td></tr>`,
    )
    .join("");
}

function render() {
  const state = inputFromControls();
  writeState(state);
  const tradeIn = data.tradeIns.find((t) => t.id === state.tradein);
  $("#tradein-help").textContent = tradeIn
    ? `Apple Trade In pays up to ${usd.format(tradeIn.appleValue)} for your ${tradeIn.name}. Handing it to a carrier deal instead costs you that much.`
    : "Trade-in deals need a phone. Pick one to see them; without it you pay full price and keep what you have.";

  // The Xfinity override only stands in for devices Xfinity has not priced.
  const xfPromo = data.carriers.find((c) => c.id === "xfinity").promos.find((p) => p.id === XF_PROMO);
  const xfTier = xfPromo.tiers.find((t) => t.devices?.includes(state.tradein));
  // The field only appears for a device Xfinity has not priced; a confirmed tier needs no input.
  const xfField = $("#xf-field");
  xfField.hidden = !state.tradein || !!xfTier;
  if (!xfField.hidden) {
    $("#xf-help").textContent = `Xfinity has not published a credit for this phone — only "up to $1,300". Set your checkout figure here.`;
  }

  const rows = buildScenarios(data, {
    phoneId: state.phone,
    tradeInId: state.tradein || null,
    lines: 1,
    termMonths: data.meta.defaultTermMonths,
    switching: state.switching,
    minDataGb: 50,
    minutes: "unlimited",
    overrides: { [XF_PROMO]: state.xf },
  });

  renderSummary(rows);
  renderRows(rows, state);
  defaultPlans = defaultPlanIds(rows);
  if (!selectedPlans) selectedPlans = defaultPlans;
  renderPlansTab(state);
  const phone = data.phones.find((p) => p.id === state.phone);
  $("#results-sub").textContent = `${rows.length} routes · ${phone.model} ${storageLabel(phone.storageGb)} · 1 line · unlimited talk, 50 GB+ data · sorted by ${data.meta.defaultTermMonths}-month total`;
}

function renderPlansTab(state) {
  const input = { lines: 1, termMonths: data.meta.defaultTermMonths, switching: state.switching, tradeInId: state.tradein || null };
  renderPicker(data, selectedPlans, (id) => {
    selectedPlans = selectedPlans.includes(id) ? selectedPlans.filter((p) => p !== id) : [...selectedPlans, id].slice(0, MAX_PLANS);
    render();
  });
  renderComparison(data, selectedPlans, input);
}

function selectTab(next) {
  tab = next;
  for (const name of ["routes", "plans"]) {
    $(`#tab-${name}`).setAttribute("aria-selected", String(name === tab));
    $(`#panel-${name}`).hidden = name !== tab;
  }
  writeState(inputFromControls());
}

function renderStatic() {
  $("#notes").innerHTML = data.meta.notes.map((n) => `<li>${esc(n)}</li>`).join("");
  $("#sources-list").innerHTML = Object.entries(data.meta.sources)
    .map(([k, url]) => `<a href="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(url.replace(/^https?:\/\/(www\.)?/, ""))}</a>`)
    .join("");
  $("#trust").textContent = `${data.meta.defaultTermMonths} months · taxes excluded · prices crawled ${data.meta.crawledAt}`;
}

async function main() {
  const res = await fetch("data/pricing.json");
  data = await res.json();
  const initial = readState();
  populateControls(initial);
  if (initial.plans.length) selectedPlans = initial.plans.filter((id) => data.carriers.some((c) => c.plans.some((p) => p.id === id))).slice(0, MAX_PLANS);
  renderStatic();
  render();
  selectTab(initial.tab);
  $("#tab-routes").addEventListener("click", () => selectTab("routes"));
  $("#tab-plans").addEventListener("click", () => selectTab("plans"));
  $("#show-all").addEventListener("click", () => {
    showAll = !showAll;
    render();
  });
  $("#controls").addEventListener("input", render);
  $("#controls").addEventListener("change", render);
  $("#controls").addEventListener("submit", (e) => e.preventDefault());
}

main().catch((err) => {
  $("#rows").innerHTML = `<div class="card"><div class="section-label">// Could not load pricing data</div><p class="body">${esc(err.message)} — serve this folder over HTTP (e.g. <code>python3 -m http.server</code>); browsers block fetch from file://.</p></div>`;
});
