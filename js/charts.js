// Small single-series line chart (SVG) with a tap/hover crosshair and tooltip.
import { parseISO } from './store.js';

const W = 340, H = 180, M = { l: 34, r: 12, t: 14, b: 26 };
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const shortDate = (s) => { const d = parseISO(s); return `${d.getDate()} ${MONTHS[d.getMonth()]}`; };

function niceStep(range) {
  const raw = range / 3;
  const mag = 10 ** Math.floor(Math.log10(raw || 1));
  const n = raw / mag;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * mag;
}

// points: [{date, value, tip}], fixed: optional [min, max] y domain (e.g. 0-10 pain)
export function lineChart(points, { unit = '', label = '', fixed = null } = {}) {
  if (!points.length) return '<p class="muted">Nothing logged yet.</p>';
  const xs = points.map((p) => parseISO(p.date).getTime());
  let x0 = Math.min(...xs), x1 = Math.max(...xs);
  if (x0 === x1) { x0 -= 3 * 86400000; x1 += 3 * 86400000; }
  const vals = points.map((p) => p.value);
  let y0, y1, step;
  if (fixed) { [y0, y1] = fixed; step = (y1 - y0) / 2; } else {
    const lo = Math.min(...vals), hi = Math.max(...vals);
    step = niceStep(Math.max(hi - lo, hi * 0.2, 1));
    y0 = Math.max(0, Math.floor((lo - step * 0.5) / step) * step);
    y1 = Math.ceil((hi + step * 0.25) / step) * step;
    if (y1 === y0) y1 = y0 + step;
  }
  const sx = (t) => M.l + ((t - x0) / (x1 - x0)) * (W - M.l - M.r);
  const sy = (v) => H - M.b - ((v - y0) / (y1 - y0)) * (H - M.t - M.b);
  const grid = [];
  for (let v = y0; v <= y1 + 1e-9; v += step) {
    grid.push(`<line class="ch-grid" x1="${M.l}" x2="${W - M.r}" y1="${sy(v)}" y2="${sy(v)}"/>
      <text class="ch-tick" x="${M.l - 6}" y="${sy(v) + 3.5}" text-anchor="end">${+v.toFixed(1)}</text>`);
  }
  const first = points[0].date, last = points[points.length - 1].date;
  const xt = `<text class="ch-tick" x="${M.l}" y="${H - 6}" text-anchor="start">${shortDate(first)}</text>
    ${first !== last ? `<text class="ch-tick" x="${W - M.r}" y="${H - 6}" text-anchor="end">${shortDate(last)}</text>` : ''}`;
  const coords = points.map((p, i) => [sx(xs[i]), sy(p.value)]);
  const path = coords.map((c, i) => `${i ? 'L' : 'M'}${c[0].toFixed(1)} ${c[1].toFixed(1)}`).join(' ');
  const dots = coords.map((c) => `<circle class="ch-dot" cx="${c[0].toFixed(1)}" cy="${c[1].toFixed(1)}" r="4"/>`).join('');
  const lastC = coords[coords.length - 1];
  const lastLabel = `<text class="ch-last" x="${Math.min(lastC[0], W - M.r - 2)}" y="${lastC[1] - 9}" text-anchor="${lastC[0] > W - 60 ? 'end' : 'middle'}">${points[points.length - 1].value}${unit ? ' ' + unit : ''}</text>`;
  const data = encodeURIComponent(JSON.stringify(points.map((p, i) => ({ x: +coords[i][0].toFixed(1), y: +coords[i][1].toFixed(1), tip: p.tip }))));
  return `<div class="chart" data-points="${data}">
    <svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${label}">
      ${grid.join('')}${xt}
      <path class="ch-line" d="${path}"/>${dots}${lastLabel}
      <g class="ch-cross" visibility="hidden"><line class="ch-crossline" y1="${M.t}" y2="${H - M.b}"/><circle class="ch-focus" r="6"/></g>
      <rect class="ch-hit" x="0" y="0" width="${W}" height="${H}"/>
    </svg>
    <div class="ch-tip" hidden></div>
  </div>`;
}

// Wire up every chart under root. Call after each render.
export function attachCharts(root) {
  root.querySelectorAll('.chart').forEach((el) => {
    const pts = JSON.parse(decodeURIComponent(el.dataset.points));
    const svg = el.querySelector('svg');
    const cross = el.querySelector('.ch-cross');
    const tip = el.querySelector('.ch-tip');
    const show = (evt) => {
      const r = svg.getBoundingClientRect();
      const x = ((evt.clientX - r.left) / r.width) * W;
      let best = pts[0];
      for (const p of pts) if (Math.abs(p.x - x) < Math.abs(best.x - x)) best = p;
      cross.setAttribute('visibility', 'visible');
      cross.querySelector('line').setAttribute('x1', best.x);
      cross.querySelector('line').setAttribute('x2', best.x);
      cross.querySelector('circle').setAttribute('cx', best.x);
      cross.querySelector('circle').setAttribute('cy', best.y);
      tip.hidden = false;
      tip.textContent = best.tip;
      const left = (best.x / W) * r.width;
      tip.style.left = `${Math.max(4, Math.min(r.width - tip.offsetWidth - 4, left - tip.offsetWidth / 2))}px`;
    };
    svg.addEventListener('pointerdown', show);
    svg.addEventListener('pointermove', show);
    svg.addEventListener('pointerleave', (e) => {
      if (e.pointerType === 'mouse') { cross.setAttribute('visibility', 'hidden'); tip.hidden = true; }
    });
  });
}
