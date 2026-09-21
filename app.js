// True Cost to Phone — page wiring.
// Loads data/pricing.json, reads the controls, renders buildScenarios() output.
// State lives in the URL query so a result can be shared.

import { buildScenarios, tierCredit, heroSummary } from "./calc.js";
import { MAX_PLANS, defaultPlanIds, renderPicker, renderComparison, renderSummaryChart } from "./plans.js";
import { MAX_ROUTES, routeKey, renderCompare } from "./compare.js";

const $ = (sel) => document.querySelector(sel);
const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
const usd2 = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 });
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

const XF_PROMO = "xf-tradein-1300";
const DEFAULT_PHONE = "iphone-18-pro-256";
const DEFAULTS = { switching: "1", costco: "0", tab: "routes", plans: "", carrier: "", cmp: "" };
const MAX_LINES = 5;
const NONE = "-";

let data;
let showAll = false;
let tab = "routes";
let selectedPlans = null; // null until the first render picks defaults
let defaultPlans = [];
let plansTouched = false; // untouched picks follow the defaults as the situation changes
let carrierFilter = ""; // "" = every carrier
let compareKeys = []; // routes picked for the Compare tab, in pick order
let lastRows = [];
const TOP_PER_CARRIER = 3;
const PHONE = matchMedia("(max-width: 768px)"); // phones get gradual exposure: fewer rows, folded detail
const compact = () => PHONE.matches;
const topPerCarrier = () => (compact() ? 2 : TOP_PER_CARRIER);

/** Rows to display: the cheapest few per carrier unless the reader asked for everything. Keeps global rank. */
function visibleRows(rows) {
  if (showAll) return rows.map((r, i) => ({ ...r, rank: i + 1 }));
  const seen = new Map();
  return rows
    .map((r, i) => ({ ...r, rank: i + 1 }))
    .filter((r) => {
      const n = seen.get(r.carrierId) || 0;
      seen.set(r.carrierId, n + 1);
      return n < topPerCarrier();
    });
}

/** Lines travel in the URL as `l=phone:tradein,phone:tradein` with `-` for none. */
function parseLines(str) {
  const items = (str || "")
    .split(",")
    .filter(Boolean)
    .map((pair) => {
      const [phoneId = NONE, tradeInId = NONE, xf = ""] = pair.split(":");
      return { phoneId: phoneId === NONE ? null : phoneId, tradeInId: tradeInId === NONE ? null : tradeInId, xfCredit: xf === "" ? null : Number(xf) };
    });
  return items.length ? items.slice(0, MAX_LINES) : [{ phoneId: DEFAULT_PHONE, tradeInId: null }];
}

function readState() {
  const q = new URLSearchParams(location.search);
  return {
    lineItems: parseLines(q.get("l")),
    switching: (q.get("switching") ?? DEFAULTS.switching) !== "0",
    costco: q.get("costco") === "1",
    carrier: q.get("carrier") || "",
    tab: ["plans", "compare"].includes(q.get("tab")) ? q.get("tab") : "routes",
    plans: (q.get("plans") || "").split(",").filter(Boolean),
    cmp: (q.get("cmp") || "").split(",").filter(Boolean),
  };
}

function writeState(s) {
  const q = new URLSearchParams();
  const l = s.lineItems.map((li) => `${li.phoneId || NONE}:${li.tradeInId || NONE}${li.xfCredit != null ? `:${li.xfCredit}` : ""}`).join(",");
  if (l !== `${DEFAULT_PHONE}:${NONE}`) q.set("l", l);
  if (!s.switching) q.set("switching", "0");
  if (s.costco) q.set("costco", "1");
  if (carrierFilter) q.set("carrier", carrierFilter);
  if (tab !== "routes") q.set("tab", tab);
  if (compareKeys.length) q.set("cmp", compareKeys.join(","));
  if (plansTouched && selectedPlans && selectedPlans.join(",") !== defaultPlans.join(",")) q.set("plans", selectedPlans.join(","));
  const qs = q.toString();
  history.replaceState(null, "", qs ? `?${qs}` : location.pathname);
}

function storageLabel(gb) {
  return gb >= 1024 ? `${gb / 1024} TB` : `${gb} GB`;
}

const phoneOptions = () =>
  `<option value="${NONE}">No new phone — keeps their phone</option>` +
  data.phones.map((p) => `<option value="${p.id}">${esc(p.model)} · ${storageLabel(p.storageGb)} · ${usd.format(p.retail)}</option>`).join("");
const tradeInOptions = () =>
  `<option value="${NONE}">No trade-in</option>` +
  data.tradeIns.map((t) => `<option value="${t.id}">${esc(t.name)} · up to ${usd.format(t.appleValue)}</option>`).join("");

/** One row per line; added lines copy the first line's phone. */
function renderLineItems(items) {
  const host = $("#line-items");
  host.innerHTML = items
    .map(
      (li, i) => `<div class="line" data-line="${i}">
        <div class="line-id">Line<b>${String(i + 1).padStart(2, "0")}</b></div>
        <div class="field">
          <label class="field-label" for="phone-${i}">New phone</label>
          <select class="input" id="phone-${i}" data-role="phone">${phoneOptions()}</select>
        </div>
        <div class="field">
          <label class="field-label" for="tradein-${i}">Trade in</label>
          <select class="input" id="tradein-${i}" data-role="tradein" ${li.phoneId ? "" : "disabled"}>${tradeInOptions()}</select>
          <p class="field-help" id="tradein-help-${i}"></p>
        </div>
        <div class="field field-xf" id="xf-field-${i}" hidden>
          <label class="field-label" for="xf-${i}">Xfinity trade-in credit for this phone</label>
          <input class="input" id="xf-${i}" data-role="xf" type="number" inputmode="numeric" min="0" max="1300" step="10" value="${li.xfCredit ?? 1300}">
          <p class="field-help is-warning">Xfinity has not published a credit for this phone — only "up to $1,300". Set your checkout figure.</p>
        </div>
      </div>`,
    )
    .join("");
  items.forEach((li, i) => {
    $(`#phone-${i}`).value = li.phoneId || NONE;
    $(`#tradein-${i}`).value = li.phoneId ? li.tradeInId || NONE : NONE;
  });
}

function populateControls(state) {
  $("#lines").value = String(state.lineItems.length);
  renderLineItems(state.lineItems);
  $("#switching").checked = state.switching;
  $("#costco").checked = state.costco;
  carrierFilter = state.carrier;
}

function lineItemsFromControls() {
  return [...document.querySelectorAll("#line-items .line")].map((row) => {
    const phoneId = row.querySelector("[data-role=phone]").value;
    const tradeInId = row.querySelector("[data-role=tradein]").value;
    const xfField = row.querySelector(".field-xf");
    const xfCredit = xfField.hidden ? null : Math.max(0, Number(row.querySelector("[data-role=xf]").value) || 0);
    return { phoneId: phoneId === NONE ? null : phoneId, tradeInId: phoneId === NONE || tradeInId === NONE ? null : tradeInId, xfCredit };
  });
}

/** Keep the line rows in step with the Lines select. */
function syncLines() {
  const want = Number($("#lines").value) || 1;
  let items = lineItemsFromControls();
  if (items.length === want) return items;
  const first = items[0] || { phoneId: DEFAULT_PHONE, tradeInId: null };
  while (items.length < want) items.push({ phoneId: first.phoneId, tradeInId: null, xfCredit: null });
  items = items.slice(0, want);
  renderLineItems(items);
  return items;
}

function inputFromControls() {
  return {
    lineItems: lineItemsFromControls(),
    switching: $("#switching").checked,
    costco: $("#costco").checked,
  };
}

function planPriceLabel(r) {
  const forLines = r.lines > 1 ? ` for ${r.lines} lines (${usd2.format(r.perLine)}/line)` : "";
  if (!r.planIntro) return `${usd.format(r.planMonthly)}/mo${forLines}`;
  return `${usd.format(r.planIntro.monthly)}/mo × ${r.planIntro.months}, then ${usd.format(r.planMonthly)}/mo${forLines}`;
}

function segments(row) {
  return [
    { key: "plan", label: "Plan", value: row.plan, seg: "var(--seg-plan)" },
    { key: "phone", label: row.phones > 1 ? `Phones ×${row.phones}` : "Phone", value: row.phoneNet, seg: "var(--seg-phone)" },
    { key: "fees", label: "Fees", value: row.fees, seg: "var(--seg-fees)" },
    { key: "tradein", label: "Trade-in to deal", value: row.tradeInValue, seg: "var(--seg-tradein)" },
  ];
}

/** The hero's trust line: term, the spread across carriers for the current situation, and the crawl date. */
function renderHero(rows) {
  const hero = heroSummary(rows);
  const trust = `${data.meta.defaultTermMonths} months · taxes excluded · prices updated ${data.meta.crawledAt}`;
  $("#trust").innerHTML = hero && hero.spread > 0 ? `<b>${usd.format(hero.spread)} apart</b> · ${esc(trust)}` : esc(trust);
}

function renderSummary(rows) {
  const best = new Map();
  for (const r of rows) if (!best.has(r.carrierId)) best.set(r.carrierId, r);
  const cheapest = rows[0];
  const order = [...data.carriers].sort((a, b) => (best.get(a.id)?.total ?? Infinity) - (best.get(b.id)?.total ?? Infinity)); // cheapest first
  $("#summary").innerHTML = order
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

function renderCarrierFilter(rows) {
  const counts = new Map();
  for (const r of rows) counts.set(r.carrierId, (counts.get(r.carrierId) || 0) + 1);
  const chip = (id, label, n) => `<button type="button" class="chip${carrierFilter === id ? " is-on" : ""}" data-carrier="${id}" aria-pressed="${carrierFilter === id}">${esc(label)} <b>${n}</b></button>`;
  $("#carrier-filter").innerHTML =
    chip("", "All carriers", rows.length) + data.carriers.filter((c) => counts.has(c.id)).map((c) => chip(c.id, c.name, counts.get(c.id))).join("");
}

function renderRows(allRows) {
  renderCarrierFilter(allRows);
  const rows = carrierFilter ? allRows.filter((r) => r.carrierId === carrierFilter) : allRows;
  const max = Math.max(...allRows.map((r) => r.total));
  const cheapest = allRows[0]?.total ?? 0;

  const shown = carrierFilter ? rows.map((r) => ({ ...r, rank: allRows.indexOf(r) + 1 })) : visibleRows(rows);
  $("#rows").innerHTML = shown
    .map((r) => {
      const segs = segments(r);
      const bar = segs
        .filter((s) => s.value > 0)
        .map((s) => `<span style="--seg:${s.seg}; flex: ${s.value} 0 0" title="${s.label} ${usd.format(s.value)}"></span>`)
        .join("");
      const legend = segs
        .map((s) => `<span style="--seg:${s.seg}" class="${s.value > 0 ? "" : "is-zero"}">${s.label} <b>${usd.format(s.value)}</b></span>`)
        .join("") + (r.costcoValue > 0 ? `<span class="is-zero">Costco <b>−${usd.format(r.costcoValue)}</b></span>` : "");
      const badges = [
        r.simUnlocked ? `<span class="badge is-accent">SIM unlocked</span>` : "",
        ...r.requires.map((q) => `<span class="badge">${esc(q)}</span>`),
        r.credits > 0 ? `<span class="badge is-accent">${usd.format(r.credits)} in credits</span>` : "",
        r.costcoValue > 0 ? `<span class="badge is-accent">Costco ${usd.format(r.costcoValue)}</span>` : "",
        r.feesWaived ? `<span class="badge is-accent">Fees waived</span>` : "",
        r.unverified ? `<span class="badge is-warning">Unverified Xfinity credit</span>` : "",
        r.endsOn ? `<span class="badge">Ends ${esc(r.endsOn)}</span>` : "",
      ].join("");
      const notes = [];
      if (r.planIntro) notes.push(`Plan is ${usd.format(r.planIntro.monthly)}/mo for the first ${r.planIntro.months} months as a new customer, then ${usd.format(r.planMonthly)}/mo — ${usd.format(r.plan)} over ${r.termMonths} months.`);
      if (r.route !== "byod" && r.tradeInValue > 0) notes.push(`Hands your ${esc(r.tradeInName)} to the carrier — that is ${usd.format(r.tradeInValue)} out of pocket, what Apple would have paid.`);
      if (r.route === "byod" && r.appleTradeIn > 0) notes.push(`Trades ${esc([...new Set(r.lineDetails.filter((l) => l.tradeInName).map((l) => l.tradeInName))].join(", "))} in to Apple for ${usd.format(r.appleTradeIn)} off the phone${r.phones > 1 ? "s" : ""}.`);
      if (r.lines > 1 && r.phones > 0) notes.push(r.lineDetails.map((l, i) => `Line ${i + 1}: ${l.phoneName ? esc(l.phoneName) + (l.credit ? ` − ${usd.format(l.credit)}` : "") + (l.appleTradeIn ? ` − ${usd.format(l.appleTradeIn)} Apple trade-in` : "") : "no new phone"}`).join(" · "));
      if (r.simUnlocked) notes.push("Apple sells it unlocked — switch carriers any time, no payoff to leave.");
      if (r.stacked > 0) notes.push(`Includes the ${usd.format(r.stacked)} online new-line credit${r.lines > 1 ? ` (${r.lines} lines)` : ""}.`);
      if (r.creditCapped) notes.push(`Credits stop at ${r.creditedPhones} phones (carrier limit); the rest pay full price.`);
      if (r.costcoValue > 0) {
        const src = data.meta.sources[r.costcoSourceKey];
        notes.push(`Costco: ${r.costcoItems.map((c) => `${esc(c.name)}${c.count > 1 ? ` ×${c.count}` : ""}`).join(" + ")} = ${usd.format(r.costcoValue)}, counted at face value${r.feesWaived ? "; " + esc(r.feesLabel.replace(/\s*\(.*\)$/, "")) + " waived" : ""}.${src ? ` <a href="${esc(src)}" target="_blank" rel="noopener noreferrer">Costco terms ↗</a>` : ""}`);
      }
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
          ${compact()
            ? `<details class="row-more"><summary>Breakdown</summary><div class="row-legend">${legend}</div>${notes.length ? `<div class="row-notes">${notes.join(" ")}</div>` : ""}</details>`
            : `<div class="row-legend">${legend}</div>${notes.length ? `<div class="row-notes">${notes.join(" ")}</div>` : ""}`}
        </div>
        <div class="row-total">
          <div class="total">${usd.format(r.total)}</div>
          <div class="subtitle">${usd2.format(r.perMonth)}/mo · ${r.termMonths} mo</div>
          <div class="delta">${delta > 0 ? `+${usd.format(delta)} vs cheapest` : "cheapest"}</div>
          <button type="button" class="chip row-compare${compareKeys.includes(routeKey(r)) ? " is-on" : ""}" data-compare="${esc(routeKey(r))}" aria-pressed="${compareKeys.includes(routeKey(r))}" ${!compareKeys.includes(routeKey(r)) && compareKeys.length >= MAX_ROUTES ? "disabled" : ""}>${compareKeys.includes(routeKey(r)) ? "Comparing" : "Compare"}</button>
        </div>
      </article>`;
    })
    .join("");

  const hidden = rows.length - shown.length;
  const more = $("#show-all");
  more.hidden = !!carrierFilter || (rows.length <= shown.length && !showAll);
  more.textContent = showAll ? `Show top ${topPerCarrier()} per carrier` : `Show all ${rows.length} routes · ${hidden} hidden`;
  more.setAttribute("aria-expanded", String(showAll));

  $("#table tbody").innerHTML = allRows
    .map(
      (r, i) => `<tr><td>${i + 1}</td><td>${esc(r.carrierName)}</td><td>${esc(r.planName)}</td><td>${esc(r.routeName)}</td>
        <td class="num">${usd.format(r.plan)}</td><td class="num">${usd.format(r.phoneNet)}</td><td class="num">${usd.format(r.fees)}</td><td class="num">${usd.format(r.tradeInValue)}</td>
        <td class="num">${usd2.format(r.total)}</td><td class="num">${usd2.format(r.perMonth)}</td></tr>`,
    )
    .join("");
}

function render() {
  syncLines();
  const state = inputFromControls();
  const items = state.lineItems;
  writeState(state);

  // Per-line trade-in help; the Xfinity override shows only on a line whose trade-in Xfinity has not priced.
  const xfPromo = data.carriers.find((c) => c.id === "xfinity").promos.find((p) => p.id === XF_PROMO);
  items.forEach((li, i) => {
    $(`#tradein-${i}`).disabled = !li.phoneId;
    const tradeIn = data.tradeIns.find((t) => t.id === li.tradeInId);
    $(`#tradein-help-${i}`).textContent = !li.phoneId
      ? ""
      : tradeIn
        ? `Apple pays up to ${usd.format(tradeIn.appleValue)}; handing it to a carrier deal costs that much.`
        : "Trade-in deals need a phone; without one this line pays full price.";
    const unlisted = !!tradeIn && !xfPromo.tiers.some((t) => t.devices?.includes(tradeIn.id));
    const field = $(`#xf-field-${i}`);
    if (field.hidden === unlisted) {
      field.hidden = !unlisted;
      if (unlisted) li.xfCredit = Math.max(0, Number($(`#xf-${i}`).value) || 0);
      else li.xfCredit = null;
    }
  });
  writeState(state);

  const rows = buildScenarios(data, {
    lines: items.length,
    lineItems: items,
    termMonths: data.meta.defaultTermMonths,
    switching: state.switching,
    costco: state.costco,
    minDataGb: 50,
    minutes: "unlimited",
  });

  lastRows = rows;
  compareKeys = compareKeys.filter((k) => rows.some((r) => routeKey(r) === k)); // a pick can vanish when the situation changes
  renderSummary(rows);
  renderSummaryChart(rows);
  renderHero(rows);
  renderRows(rows);
  renderCompare(rows, compareKeys);
  $("#tab-compare").innerHTML = `Compare${compareKeys.length ? `<b>${compareKeys.length}</b>` : ""}`;
  renderTray();
  defaultPlans = defaultPlanIds(rows);
  if (!selectedPlans || !plansTouched) selectedPlans = defaultPlans;
  renderPlansTab(state);
  const phones = items.filter((li) => li.phoneId).length;
  const linesText = `${items.length} line${items.length === 1 ? "" : "s"} · ${phones} new phone${phones === 1 ? "" : "s"}`;
  $("#results-sub").textContent = `${rows.length} routes · ${linesText} · unlimited talk, 50 GB+ data · sorted by ${data.meta.defaultTermMonths}-month total`;
}

function renderPlansTab(state) {
  const input = { lines: state.lineItems.length, termMonths: data.meta.defaultTermMonths, switching: state.switching, tradeInId: state.lineItems.some((li) => li.tradeInId) ? "any" : null };
  // A pick with no price at this line count can't be compared — drop it rather than show it disabled.
  const priced = (id) => data.carriers.some((c) => c.plans.some((p) => p.id === id && p.monthly[String(state.lineItems.length)] != null));
  selectedPlans = selectedPlans.filter(priced);
  if (selectedPlans.length === 0) selectedPlans = defaultPlans;
  writeState(state);
  renderPicker(data, selectedPlans, (id) => {
    plansTouched = true;
    selectedPlans = selectedPlans.includes(id) ? selectedPlans.filter((p) => p !== id) : [...selectedPlans, id].slice(0, MAX_PLANS);
    render();
  }, state.lineItems.length);
  renderComparison(data, selectedPlans, input);
}

/** The phone menu: the hamburger toggles the nav links; a link, Escape, or a tap outside closes it. */
function wireMenu() {
  const nav = $(".nav");
  const btn = $("#nav-menu-btn");
  const setOpen = (open) => {
    nav.classList.toggle("is-open", open);
    btn.setAttribute("aria-expanded", String(open));
  };
  btn.addEventListener("click", () => setOpen(!nav.classList.contains("is-open")));
  $("#nav-links").addEventListener("click", (e) => { if (e.target.closest("a")) setOpen(false); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && nav.classList.contains("is-open")) { setOpen(false); btn.focus(); } });
  document.addEventListener("click", (e) => { if (!nav.contains(e.target)) setOpen(false); });
}

/** Folds are closed on phones and open (summary hidden) on desktop. */
function applyFolds() {
  for (const d of document.querySelectorAll("details.fold")) d.open = !compact();
}

/** The compare tray: up while two or more routes are picked and the Routes tab is showing. */
function renderTray() {
  const on = tab === "routes" && compareKeys.length >= 2;
  $("#compare-tray").classList.toggle("is-on", on);
  $("#compare-tray-go").disabled = !on; // not tabbable while faded out
  if (on) $("#compare-tray-text").innerHTML = `<b>${compareKeys.length}</b> routes picked`;
}

function selectTab(next) {
  tab = next;
  for (const name of ["routes", "plans", "compare"]) {
    $(`#tab-${name}`).setAttribute("aria-selected", String(name === tab));
    $(`#panel-${name}`).hidden = name !== tab;
  }
  renderTray();
  writeState(inputFromControls());
}

function renderStatic() {
  $("#notes").innerHTML = data.meta.notes.map((n) => `<li>${esc(n)}</li>`).join("");
  $("#notes-count").textContent = `${data.meta.notes.length} notes`;
  $("#sources-count").textContent = `${Object.keys(data.meta.sources).length} pages`;
  $("#sources-list").innerHTML = Object.entries(data.meta.sources)
    .map(([k, url]) => `<a href="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(url.replace(/^https?:\/\/(www\.)?/, ""))}</a>`)
    .join("");
}

async function main() {
  const res = await fetch("data/pricing.json");
  data = await res.json();
  const initial = readState();
  populateControls(initial);
  if (initial.plans.length) {
    plansTouched = true;
    selectedPlans = initial.plans.filter((id) => data.carriers.some((c) => c.plans.some((p) => p.id === id))).slice(0, MAX_PLANS);
  }
  renderStatic();
  applyFolds();
  render();
  PHONE.addEventListener("change", () => { applyFolds(); render(); });
  compareKeys = initial.cmp.slice(0, MAX_ROUTES);
  if (compareKeys.length) render();
  selectTab(initial.tab);
  wireMenu();
  $("#tab-routes").addEventListener("click", () => selectTab("routes"));
  $("#tab-plans").addEventListener("click", () => selectTab("plans"));
  $("#tab-compare").addEventListener("click", () => selectTab("compare"));
  $("#rows").addEventListener("click", (e) => {
    const b = e.target.closest("[data-compare]");
    if (!b || b.disabled) return;
    const k = b.dataset.compare;
    compareKeys = compareKeys.includes(k) ? compareKeys.filter((x) => x !== k) : [...compareKeys, k].slice(0, MAX_ROUTES);
    render();
  });
  $("#route-compare").addEventListener("click", (e) => {
    const b = e.target.closest("[data-remove]");
    if (!b) return;
    compareKeys = compareKeys.filter((x) => x !== b.dataset.remove);
    render();
  });
  $("#compare-clear").addEventListener("click", () => { compareKeys = []; render(); });
  $("#compare-tray-go").addEventListener("click", () => {
    selectTab("compare");
    $(".tabs").scrollIntoView({ behavior: "smooth", block: "start" });
  });
  $("#carrier-filter").addEventListener("click", (e) => {
    const chip = e.target.closest("[data-carrier]");
    if (!chip) return;
    carrierFilter = chip.dataset.carrier;
    render();
  });
  $("#show-all").addEventListener("click", () => {
    showAll = !showAll;
    render();
  });
  $("#controls").addEventListener("input", render);
  $("#controls").addEventListener("change", render);
  $("#extra").addEventListener("change", render);
  $("#controls").addEventListener("submit", (e) => e.preventDefault());
}

main().catch((err) => {
  $("#rows").innerHTML = `<div class="card"><div class="section-label">// Could not load pricing data</div><p class="body">${esc(err.message)} — serve this folder over HTTP (e.g. <code>python3 -m http.server</code>); browsers block fetch from file://.</p></div>`;
});
