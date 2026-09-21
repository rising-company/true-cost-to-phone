// True Cost to Phone — the Plans tab.
// Pick up to five plans across carriers; see them side by side and as
// cumulative plan cost over the term. Colors follow pick order, never rank.

import { comparePlans } from "./calc.js";

const $ = (sel) => document.querySelector(sel);
const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

export const MAX_PLANS = 5;
// Validated categorical palette (dataviz six checks, Daylight surface).
const SERIES = ["#0b7a4e", "#1f5fbf", "#c46a12", "#8a3f9e", "#c2185b"];

const dataLabel = (v) => (v === "unlimited" ? "Unlimited" : v === 0 ? "None" : `${v} GB`);
const minutesLabel = (v) => (v === "unlimited" ? "Unlimited" : v === 0 ? "None" : `${v} min`);

/** Plans behind the cheapest route per carrier — the default pick. */
export function defaultPlanIds(rows) {
  const seen = new Set();
  const ids = [];
  for (const r of rows) {
    if (seen.has(r.carrierId)) continue;
    seen.add(r.carrierId);
    ids.push(r.planId);
  }
  return ids.slice(0, MAX_PLANS);
}

export function renderPicker(data, selected, onToggle) {
  const full = selected.length >= MAX_PLANS;
  $("#plan-picker").innerHTML = data.carriers
    .map(
      (c) => `<div class="picker-group">
        <div class="stat-label">${esc(c.name)} <span class="picker-net">· ${esc(c.network)} network</span></div>
        <div class="chips">${c.plans
          .map((p) => {
            const on = selected.includes(p.id);
            const idx = selected.indexOf(p.id);
            return `<button type="button" class="chip${on ? " is-on" : ""}" data-plan="${p.id}" aria-pressed="${on}" ${!on && full ? "disabled" : ""}
              style="${on ? `--series:${SERIES[idx]}` : ""}"><span class="chip-dot" aria-hidden="true"></span>${esc(p.name)} <b>${usd.format(p.monthly["1"])}/mo</b></button>`;
          })
          .join("")}</div>
      </div>`,
    )
    .join("");
  $("#plan-picker").onclick = (e) => {
    const chip = e.target.closest("[data-plan]");
    if (chip && !chip.disabled) onToggle(chip.dataset.plan);
  };
  $("#picker-note").textContent = full
    ? `${MAX_PLANS} of ${MAX_PLANS} selected — unselect one to add another.`
    : `${selected.length} of ${MAX_PLANS} selected.`;
}

export function renderComparison(data, selected, input) {
  const cmp = comparePlans(data, selected, input);
  const host = $("#plan-compare");
  if (cmp.length === 0) {
    host.innerHTML = `<div class="empty-state"><div class="eyebrow">// Nothing to compare yet</div><p class="body">Pick two or more plans above to see them side by side.</p></div>`;
    $("#plan-chart").innerHTML = "";
    return;
  }
  const cheapest = Math.min(...cmp.map((c) => c.total));
  const row = (label, cell) => `<tr><th scope="row">${label}</th>${cmp.map((c, i) => `<td>${cell(c, i)}</td>`).join("")}</tr>`;
  host.innerHTML = `<div class="compare-scroll"><table class="compare">
    <thead><tr><th scope="col"></th>${cmp
      .map((c, i) => `<th scope="col"><span class="series-dot" style="--series:${SERIES[i]}" aria-hidden="true"></span><div class="card-tag">${esc(c.carrierName)}</div><div class="compare-plan">${esc(c.planName)}</div></th>`)
      .join("")}</tr></thead>
    <tbody>
      ${row("Network", (c) => esc(c.network))}
      ${row("Monthly", (c) => `${usd.format(c.monthly)}/mo`)}
      ${row("Intro price", (c) => (c.intro ? `${usd.format(c.intro.monthly)}/mo × ${c.intro.months}` : "—"))}
      ${row(`Plan over ${cmp[0].termMonths} mo`, (c) => `<b>${usd.format(c.total)}</b>${c.total > cheapest ? `<span class="delta">+${usd.format(c.total - cheapest)}</span>` : `<span class="delta">cheapest</span>`}`)}
      ${row("High-speed data", (c) => dataLabel(c.premiumDataGb))}
      ${row("Talk", (c) => minutesLabel(c.minutes))}
      ${row("One-time fee", (c) => (c.fee ? usd.format(c.fee) : "None"))}
      ${row("Phone", (c) => (c.phoneSource === "apple" ? "Buy from Apple · SIM unlocked" : "Carrier deals or bring your own"))}
      ${row("Phone deals now", (c) => (c.promoCount ? `${c.promoCount} eligible` : "None"))}
      ${row("Requires", (c) => (c.requires.length ? esc(c.requires.join(" · ")) : "—"))}
      ${row("Notes", (c) => esc(c.notes) || "—")}
    </tbody>
  </table></div>`;
  renderChart(cmp);
}

function renderChart(cmp) {
  const host = $("#plan-chart");
  const W = 720, H = 300, padL = 56, padR = 16, padT = 16, padB = 32;
  const term = cmp[0].termMonths;
  const maxY = Math.max(...cmp.map((c) => c.total)) || 1;
  const x = (m) => padL + ((W - padL - padR) * m) / term;
  const y = (v) => padT + (H - padT - padB) * (1 - v / maxY);
  const step = maxY > 3000 ? 1000 : maxY > 1200 ? 500 : 250;
  const ticks = [];
  for (let v = 0; v <= maxY; v += step) ticks.push(v);
  const grid = ticks
    .map((v) => `<line x1="${padL}" x2="${W - padR}" y1="${y(v)}" y2="${y(v)}" class="grid"/><text x="${padL - 8}" y="${y(v)}" class="tick" text-anchor="end" dominant-baseline="middle">${usd.format(v)}</text>`)
    .join("");
  const xTicks = [0, 6, 12, 18, 24, 30, 36]
    .filter((m) => m <= term)
    .map((m) => `<text x="${x(m)}" y="${H - padB + 18}" class="tick" text-anchor="middle">${m === 0 ? "Month 0" : m}</text>`)
    .join("");
  const lines = cmp
    .map((c, i) => {
      const d = c.cumulative.map((v, m) => `${m === 0 ? "M" : "L"}${x(m).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
      return `<path d="${d}" fill="none" stroke="${SERIES[i]}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>`;
    })
    .join("");
  // Direct labels at the line ends, nudged apart when they collide.
  const ends = cmp
    .map((c, i) => ({ i, y: y(c.total), text: `${c.planName} · ${usd.format(c.total)}` }))
    .sort((a, b) => a.y - b.y);
  for (let k = 1; k < ends.length; k++) if (ends[k].y - ends[k - 1].y < 14) ends[k].y = ends[k - 1].y + 14;
  const labels = ends
    .map((e) => `<text x="${W - padR}" y="${e.y}" class="end-label" text-anchor="end" dominant-baseline="middle" dy="-8">${esc(e.text)}</text>`)
    .join("");
  host.innerHTML = `
    <div class="chart-head"><div class="section-label">// Cumulative plan cost</div>
      <div class="legend">${cmp.map((c, i) => `<span style="--seg:${SERIES[i]}">${esc(c.carrierName)} ${esc(c.planName)}</span>`).join("")}</div></div>
    <div class="chart-wrap">
      <svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Cumulative plan cost by month for ${cmp.map((c) => `${c.carrierName} ${c.planName}`).join(", ")}">
        ${grid}${xTicks}${lines}${labels}
        <line id="chart-cursor" x1="0" x2="0" y1="${padT}" y2="${H - padB}" class="cursor" visibility="hidden"/>
        <rect x="${padL}" y="${padT}" width="${W - padL - padR}" height="${H - padT - padB}" fill="transparent" id="chart-hit"/>
      </svg>
      <div class="chart-tip" id="chart-tip" hidden></div>
    </div>`;
  const svg = host.querySelector("svg");
  const hit = host.querySelector("#chart-hit");
  const cursor = host.querySelector("#chart-cursor");
  const tip = host.querySelector("#chart-tip");
  const show = (evt) => {
    const pt = svg.createSVGPoint();
    pt.x = evt.clientX; pt.y = evt.clientY;
    const p = pt.matrixTransform(svg.getScreenCTM().inverse());
    const m = Math.max(0, Math.min(term, Math.round(((p.x - padL) / (W - padL - padR)) * term)));
    cursor.setAttribute("x1", x(m)); cursor.setAttribute("x2", x(m)); cursor.setAttribute("visibility", "visible");
    tip.hidden = false;
    tip.innerHTML = `<div class="stat-label">Month ${m}</div>${cmp.map((c, i) => `<div class="tip-row"><span class="series-dot" style="--series:${SERIES[i]}"></span>${esc(c.planName)}<b>${usd.format(c.cumulative[m])}</b></div>`).join("")}`;
    const box = host.querySelector(".chart-wrap").getBoundingClientRect();
    const left = evt.clientX - box.left;
    tip.style.left = `${Math.min(left + 12, box.width - tip.offsetWidth - 8)}px`;
    tip.style.top = `${evt.clientY - box.top + 12}px`;
  };
  hit.addEventListener("pointermove", show);
  hit.addEventListener("pointerleave", () => { cursor.setAttribute("visibility", "hidden"); tip.hidden = true; });
}
