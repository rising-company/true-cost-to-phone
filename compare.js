// True Cost to Phone — the Compare tab.
// Up to five routes picked from the list, side by side, with the cash-flow
// curve each one asks of you over the term. Colors follow pick order.

import { cashflow } from "./calc.js";

const $ = (sel) => document.querySelector(sel);
const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
const usd2 = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 });
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

export const MAX_ROUTES = 5;
const SERIES = ["#0b7a4e", "#1f5fbf", "#c46a12", "#8a3f9e", "#c2185b"];

export const routeKey = (r) => `${r.carrierId}|${r.planId}|${r.route}`;

export function renderCompare(rows, keys) {
  const picked = keys.map((k) => rows.find((r) => routeKey(r) === k)).filter(Boolean);
  const host = $("#route-compare");
  $("#compare-note").textContent = picked.length
    ? `${picked.length} of ${MAX_ROUTES} selected — add more with the Compare button on any route.`
    : `Nothing selected yet — use the Compare button on routes in the Routes tab (up to ${MAX_ROUTES}).`;
  if (picked.length === 0) {
    host.innerHTML = `<div class="empty-state"><div class="eyebrow">// Nothing to compare yet</div><p class="body">Pick two or more routes from the Routes tab to see them side by side.</p></div>`;
    $("#route-chart").innerHTML = "";
    return;
  }
  const cheapest = Math.min(...picked.map((r) => r.total));
  const row = (label, cell) => `<tr><th scope="row">${label}</th>${picked.map((r, i) => `<td>${cell(r, i)}</td>`).join("")}</tr>`;
  const money = (v, strong) => (v ? (strong ? `<b>${usd.format(v)}</b>` : usd.format(v)) : "—");
  host.innerHTML = `<div class="compare-scroll"><table class="compare">
    <thead><tr><th scope="col"></th>${picked
      .map((r, i) => `<th scope="col"><span class="series-dot" style="--series:${SERIES[i]}" aria-hidden="true"></span><div class="card-tag">${esc(r.carrierName)} · ${esc(r.planName)}</div><div class="compare-plan">${esc(r.routeName)}</div>
        <button type="button" class="chip chip-remove" data-remove="${esc(routeKey(r))}">Remove</button></th>`)
      .join("")}</tr></thead>
    <tbody>
      ${row(`Total · ${picked[0].termMonths} mo`, (r) => `<b>${usd.format(r.total)}</b><span class="delta">${r.total > cheapest ? `+${usd.format(r.total - cheapest)}` : "cheapest"}</span>`)}
      ${row("Per month", (r) => `${usd2.format(r.perMonth)}`)}
      ${row("Day one", (r) => usd.format(cashflow(r)[0]))}
      ${row("Plan", (r) => `${usd.format(r.plan)}<span class="delta">${r.planIntro ? `${usd.format(r.planIntro.monthly)}/mo × ${r.planIntro.months}, then ` : ""}${usd.format(r.planMonthly)}/mo${r.lines > 1 ? ` · ${r.lines} lines` : ""}</span>`)}
      ${row("Phones", (r) => (r.phones ? `${usd.format(r.phone)}<span class="delta">${r.phones} phone${r.phones > 1 ? "s" : ""}</span>` : "—"))}
      ${row("Credits", (r) => (r.credits ? `−${usd.format(r.credits)}` : "—"))}
      ${row("Apple trade-in", (r) => (r.appleTradeIn ? `−${usd.format(r.appleTradeIn)}` : "—"))}
      ${row("One-time fees", (r) => (r.fees ? usd.format(r.fees) : r.feesWaived ? "Waived" : "—"))}
      ${row("Trade-in into the deal", (r) => (r.tradeInValue ? `${usd.format(r.tradeInValue)}<span class="delta">${esc(r.tradeInName || "")}</span>` : "—"))}
      ${row("Costco", (r) => (r.costcoValue ? `−${usd.format(r.costcoValue)}` : "—"))}
      ${row("Requires", (r) => (r.requires.length ? esc(r.requires.join(" · ")) : "—"))}
      ${row("Phone lock", (r) => (r.phones === 0 ? "—" : r.simUnlocked ? "SIM unlocked" : "Locked until paid off"))}
      ${row("Network", (r) => esc(r.network))}
    </tbody>
  </table></div>`;
  renderChart(picked);
}

function renderChart(picked) {
  const host = $("#route-chart");
  const W = 720, H = 300, padL = 56, padR = 16, padT = 16, padB = 32;
  const term = picked[0].termMonths;
  const flows = picked.map((r) => cashflow(r));
  const minY = Math.min(0, ...flows.map((f) => Math.min(...f)));
  const maxY = Math.max(1, ...flows.map((f) => Math.max(...f)));
  const x = (m) => padL + ((W - padL - padR) * m) / term;
  const y = (v) => padT + (H - padT - padB) * (1 - (v - minY) / (maxY - minY));
  const step = maxY - minY > 3000 ? 1000 : maxY - minY > 1200 ? 500 : 250;
  const ticks = [];
  for (let v = Math.ceil(minY / step) * step; v <= maxY; v += step) ticks.push(v);
  const grid = ticks
    .map((v) => `<line x1="${padL}" x2="${W - padR}" y1="${y(v)}" y2="${y(v)}" class="grid${v === 0 ? " zero" : ""}"/><text x="${padL - 8}" y="${y(v)}" class="tick" text-anchor="end" dominant-baseline="middle">${usd.format(v)}</text>`)
    .join("");
  const xTicks = [0, 6, 12, 18, 24, 30, 36].filter((m) => m <= term)
    .map((m) => `<text x="${x(m)}" y="${H - padB + 18}" class="tick" text-anchor="middle">${m === 0 ? "Day one" : m}</text>`).join("");
  const lines = flows
    .map((f, i) => `<path d="${f.map((v, m) => `${m === 0 ? "M" : "L"}${x(m).toFixed(1)},${y(v).toFixed(1)}`).join(" ")}" fill="none" stroke="${SERIES[i]}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>`)
    .join("");
  const ends = picked.map((r, i) => ({ y: y(r.total), text: `${r.carrierName} · ${usd.format(r.total)}` })).sort((a, b) => a.y - b.y);
  for (let k = 1; k < ends.length; k++) if (ends[k].y - ends[k - 1].y < 14) ends[k].y = ends[k - 1].y + 14;
  const labels = ends.map((e) => `<text x="${W - padR}" y="${e.y}" class="end-label" text-anchor="end" dominant-baseline="middle" dy="-8">${esc(e.text)}</text>`).join("");
  host.innerHTML = `
    <div class="chart-head"><div class="section-label">// Out of pocket, month by month</div>
      <div class="legend">${picked.map((r, i) => `<span style="--seg:${SERIES[i]}">${esc(r.carrierName)} ${esc(r.planName)}</span>`).join("")}</div></div>
    <div class="chart-wrap">
      <svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Cumulative out-of-pocket by month for ${picked.map((r) => `${r.carrierName} ${r.planName} ${r.routeName}`).join("; ")}">
        ${grid}${xTicks}${lines}${labels}
        <line id="rchart-cursor" x1="0" x2="0" y1="${padT}" y2="${H - padB}" class="cursor" visibility="hidden"/>
        <rect x="${padL}" y="${padT}" width="${W - padL - padR}" height="${H - padT - padB}" fill="transparent" id="rchart-hit"/>
      </svg>
      <div class="chart-tip" id="rchart-tip" hidden></div>
    </div>
    <p class="body" style="margin-top:12px;max-width:72ch">Buying from Apple pays the phone on day one; a carrier finances it over the term and pays the credits back month by month, which is why leaving early costs more than the total suggests.</p>`;
  const svg = host.querySelector("svg"), hit = host.querySelector("#rchart-hit"), cursor = host.querySelector("#rchart-cursor"), tip = host.querySelector("#rchart-tip");
  hit.addEventListener("pointermove", (evt) => {
    const pt = svg.createSVGPoint(); pt.x = evt.clientX; pt.y = evt.clientY;
    const p = pt.matrixTransform(svg.getScreenCTM().inverse());
    const m = Math.max(0, Math.min(term, Math.round(((p.x - padL) / (W - padL - padR)) * term)));
    cursor.setAttribute("x1", x(m)); cursor.setAttribute("x2", x(m)); cursor.setAttribute("visibility", "visible");
    tip.hidden = false;
    tip.innerHTML = `<div class="stat-label">${m === 0 ? "Day one" : `Month ${m}`}</div>${picked.map((r, i) => `<div class="tip-row"><span class="series-dot" style="--series:${SERIES[i]}"></span>${esc(r.carrierName)}<b>${usd.format(flows[i][m])}</b></div>`).join("")}`;
    const box = host.querySelector(".chart-wrap").getBoundingClientRect();
    tip.style.left = `${Math.min(evt.clientX - box.left + 12, box.width - tip.offsetWidth - 8)}px`;
    tip.style.top = `${evt.clientY - box.top + 12}px`;
  });
  hit.addEventListener("pointerleave", () => { cursor.setAttribute("visibility", "hidden"); tip.hidden = true; });
}
