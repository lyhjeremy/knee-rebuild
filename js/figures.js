// Exercise diagrams: side-view stick figures built from a small skeleton.
// Each exercise has a start and an end pose (or one pose for holds).
// Angles are in degrees, 0 = facing right, 90 = up. Limbs can also be placed with
// two-bone IK: give the end point (ankle or hand) and a bend direction.

const F = 104; // floor line
const W = 120; // frame width
const H = 110; // frame height
const L = { torso: 25, neck: 3, head: 6, thigh: 22, shin: 21, foot: 7, ua: 14, fa: 13 };
const R = Math.PI / 180;
const dir = (a) => [Math.cos(a * R), -Math.sin(a * R)];
const add = (p, v, s = 1) => [p[0] + v[0] * s, p[1] + v[1] * s];
const r1 = (n) => Math.round(n * 10) / 10;

function ik(root, target, a, b, bend) {
  const dx = target[0] - root[0], dy = target[1] - root[1];
  const d = Math.hypot(dx, dy) || 0.001;
  const dd = Math.min(Math.max(d, Math.abs(a - b) + 0.01), a + b - 0.01);
  const ux = dx / d, uy = dy / d;
  const A = Math.acos(Math.max(-1, Math.min(1, (a * a + dd * dd - b * b) / (2 * a * dd)))) * bend;
  const mid = [root[0] + (ux * Math.cos(A) - uy * Math.sin(A)) * a, root[1] + (ux * Math.sin(A) + uy * Math.cos(A)) * a];
  const ex = target[0] - mid[0], ey = target[1] - mid[1];
  const e = Math.hypot(ex, ey) || 0.001;
  return [mid, [mid[0] + (ex / e) * b, mid[1] + (ey / e) * b]];
}

function limb(root, g, a, b) {
  if (g.rel) return ik(root, [root[0] + g.rel[0], root[1] + g.rel[1]], a, b, g.bend ?? -1);
  if (g.to) return ik(root, g.to, a, b, g.bend ?? -1);
  const mid = add(root, dir(g.a1), a);
  return [mid, add(mid, dir(g.a2 ?? g.a1), b)];
}

function pose(s) {
  const J = {};
  if (s.hip) { J.hip = s.hip; J.sh = add(s.hip, dir(s.t), L.torso); } else { J.sh = s.sh; J.hip = add(s.sh, dir(s.t), -L.torso); }
  const hd = s.hd ?? s.t;
  J.neck = add(J.sh, dir(hd), L.neck);
  J.head = add(J.sh, dir(hd), L.neck + L.head);
  for (const k of ['N', 'F']) {
    const g = s['leg' + k] || s.leg;
    [J['knee' + k], J['ankle' + k]] = limb(J.hip, g, L.thigh, L.shin);
    J['toe' + k] = g.toe || add(J['ankle' + k], dir(g.ft ?? 0), L.foot);
    const a = s['arm' + k] || s.arm;
    [J['elb' + k], J['hand' + k]] = limb(J.sh, a, L.ua, L.fa);
  }
  Object.assign(J, s.set || {});
  return J;
}

const pts = (...ps) => ps.map((p) => `${r1(p[0])},${r1(p[1])}`).join(' ');
const line = (cls, ...ps) => `<polyline class="${cls}" points="${pts(...ps)}"/>`;

// ---------- props ----------
const P = {
  floor: () => `<line class="fp-floor" x1="2" y1="${F}" x2="${W - 2}" y2="${F}"/>`,
  wall: (x) => `<line class="fp-prop" x1="${x}" y1="${F}" x2="${x}" y2="12"/>`,
  box: (x, y, w, h) => `<rect class="fp-prop" x="${x}" y="${y}" width="${w}" height="${h}" rx="1.5"/>`,
  chair: (x) => `<path class="fp-prop" d="M${x} ${F} V${F - 44} M${x} ${F - 34} H${x + 24} M${x + 24} ${F - 34} V${F}"/>`,
  bench: (x, w, h) => `<path class="fp-prop" d="M${x} ${F - h} H${x + w} M${x + 4} ${F - h} V${F} M${x + w - 4} ${F - h} V${F}"/>`,
  pole: (x) => `<line class="fp-prop" x1="${x}" y1="${F}" x2="${x}" y2="20"/>`,
  tower: (x) => `<path class="fp-prop" d="M${x} ${F} V14 M${x - 7} ${F} H${x + 7} M${x - 7} 14 H${x + 7}"/>`,
  band: (a, b) => `<line class="fp-band" x1="${r1(a[0])}" y1="${r1(a[1])}" x2="${r1(b[0])}" y2="${r1(b[1])}"/>`,
  cable: (a, b) => `<line class="fp-cable" x1="${r1(a[0])}" y1="${r1(a[1])}" x2="${r1(b[0])}" y2="${r1(b[1])}"/>`,
  dumbbell: (p, vertical = false) => vertical
    ? `<path class="fp-weight" d="M${r1(p[0])} ${r1(p[1] - 6)} V${r1(p[1] + 6)}"/><path class="fp-weight-end" d="M${r1(p[0] - 3.5)} ${r1(p[1] - 6)} H${r1(p[0] + 3.5)} M${r1(p[0] - 3.5)} ${r1(p[1] + 6)} H${r1(p[0] + 3.5)}"/>`
    : `<path class="fp-weight" d="M${r1(p[0] - 6)} ${r1(p[1])} H${r1(p[0] + 6)}"/><path class="fp-weight-end" d="M${r1(p[0] - 6)} ${r1(p[1] - 3.5)} V${r1(p[1] + 3.5)} M${r1(p[0] + 6)} ${r1(p[1] - 3.5)} V${r1(p[1] + 3.5)}"/>`,
  plate: (p, r = 6) => `<circle class="fp-plate" cx="${r1(p[0])}" cy="${r1(p[1])}" r="${r}"/>`,
};

// ---------- drawing ----------
function drawFigure(J, s) {
  const far = s.front ? 'fs-ink' : 'fs-far';
  const hi = new Set(s.hi || []);
  const seg = (name, cls, ...ps) => line(hi.has(name) ? `${cls} fs-hi` : cls, ...ps);
  let out = '';
  out += seg('legF', far, J.hip, J.kneeF, J.ankleF, J.toeF);
  out += seg('armF', far, J.sh, J.elbF, J.handF);
  out += seg('torso', 'fs-ink', J.hip, J.sh, J.neck);
  out += `<circle class="fs-head" cx="${r1(J.head[0])}" cy="${r1(J.head[1])}" r="${L.head}"/>`;
  out += seg('legN', 'fs-ink', J.hip, J.kneeN, J.ankleN, J.toeN);
  out += seg('armN', 'fs-ink', J.sh, J.elbN, J.handN);
  if (hi.has('thighN')) out += line('fs-ink fs-hi', J.hip, J.kneeN);
  if (hi.has('thighF')) out += line(`${far} fs-hi`, J.hip, J.kneeF);
  if (hi.has('shinN')) out += line('fs-ink fs-hi', J.kneeN, J.ankleN);
  if (hi.has('hip')) out += `<circle class="fs-dot" cx="${r1(J.hip[0])}" cy="${r1(J.hip[1])}" r="4.2"/>`;
  return out;
}

function frame(s) {
  if (s.custom) return s.custom();
  const J = pose(s);
  const back = (s.back || []).map((p) => (typeof p === 'function' ? p(J) : p)).join('');
  const props = (s.props || []).map((p) => (typeof p === 'function' ? p(J) : p)).join('');
  return P.floor() + back + drawFigure(J, s) + props;
}

// ---------- the short-foot close-up ----------
function footFrame(domed) {
  // Inside view of a right foot: heel on the left, toes on the right.
  const ball = domed ? 74 : 78;
  const archY = domed ? F - 17 : F - 6;
  const outline = `M 30 ${F - 1} C 20 ${F - 1}, 18 ${F - 10}, 22 ${F - 22} L 26 ${F - 56}
    M 42 ${F - 56} L 44 ${F - 30} C 58 ${F - 24}, 82 ${F - 14}, 98 ${F - 8} C 104 ${F - 6}, 106 ${F - 1}, 100 ${F - 1}
    L ${ball} ${F - 1} C ${ball - 12} ${archY}, 44 ${archY}, 34 ${F - 1} Z`;
  const arrows = domed
    ? `<path class="fs-arrow" d="M 55 ${F - 5} V ${F - 12}"/><path class="fs-arrowhead" d="M 51 ${F - 9} L 55 ${F - 14} L 59 ${F - 9}"/>
       <path class="fs-arrow" d="M 90 ${F - 24} H 74"/><path class="fs-arrowhead" d="M 78 ${F - 28} L 73 ${F - 24} L 78 ${F - 20}"/>`
    : '';
  return P.floor() + `<path class="fs-foot" d="${outline}"/>${arrows}
    <text class="fs-label" x="60" y="22" text-anchor="middle">${domed ? 'Arch domed' : 'Relaxed'}</text>`;
}

// ---------- poses ----------
const stand = (x = 58, extra = {}) => ({
  hip: [x, F - 47], t: 90,
  legN: { to: [x + 1, F - 4], ft: 0 }, legF: { to: [x - 1, F - 4], ft: 0 },
  arm: { to: [x - 2, F - 47], bend: 1 },
  ...extra,
});

const FIGS = {
  'glute-bridge': {
    hi: ['hip'],
    a: { sh: [30, F - 6], t: 180, hd: 180, leg: { to: [78, F - 5], ft: 0 }, arm: { a1: -4, a2: 0 } },
    b: { sh: [30, F - 6], t: 207, hd: 180, leg: { to: [78, F - 5], ft: 0 }, arm: { a1: -4, a2: 0 } },
  },
  'sl-glute-bridge': {
    hi: ['hip'],
    a: { sh: [30, F - 6], t: 180, hd: 180, legF: { to: [78, F - 5], ft: 0 }, legN: { a1: 40, a2: 40, ft: 120 }, arm: { a1: -4, a2: 0 } },
    b: { sh: [30, F - 6], t: 207, hd: 180, legF: { to: [78, F - 5], ft: 0 }, legN: { a1: 27, a2: 27, ft: 110 }, arm: { a1: -4, a2: 0 } },
  },
  'side-leg-raise': {
    hi: ['legN'], front: true,
    a: { sh: [36, F - 8], t: 180, hd: 175, legF: { a1: 0, a2: 0, ft: 0 }, legN: { a1: 4, a2: 2, ft: 2 },
      armF: { a1: 165, a2: 165 }, armN: { to: [46, F - 1], bend: 1 } },
    b: { sh: [36, F - 8], t: 180, hd: 175, legF: { a1: 0, a2: 0, ft: 0 }, legN: { a1: 35, a2: 35, ft: 35 },
      armF: { a1: 165, a2: 165 }, armN: { to: [46, F - 1], bend: 1 } },
  },
  'clamshell': {
    hi: ['thighN'], front: true,
    a: { sh: [30, F - 8], t: 180, hd: 175, legF: { to: [76, F - 4], ft: 0 }, legN: { to: [76, F - 7], ft: 0 },
      armF: { a1: 165, a2: 165 }, armN: { to: [44, F - 1], bend: 1 },
      set: { kneeF: [70, F - 2], kneeN: [70, F - 8], ankleF: [82, F - 7], ankleN: [82, F - 8], toeF: [88, F - 7], toeN: [88, F - 8] },
      props: [(J) => P.band([J.kneeF[0] - 3, J.kneeF[1] - 1], [J.kneeN[0] - 3, J.kneeN[1] + 1])] },
    b: { sh: [30, F - 8], t: 180, hd: 175, legF: { to: [76, F - 4], ft: 0 }, legN: { to: [76, F - 7], ft: 0 },
      armF: { a1: 165, a2: 165 }, armN: { to: [44, F - 1], bend: 1 },
      set: { kneeF: [70, F - 2], kneeN: [66, F - 25], ankleF: [82, F - 7], ankleN: [82, F - 8], toeF: [88, F - 7], toeN: [88, F - 8] },
      props: [(J) => P.band([J.kneeF[0] - 3, J.kneeF[1] - 1], [J.kneeN[0] - 3, J.kneeN[1] + 1])] },
  },
  'side-plank': {
    hi: ['torso'], front: true,
    one: { sh: [28, F - 16], t: 170, hd: 172, legF: { a1: -10, a2: -10, ft: 20 }, legN: { a1: -8, a2: -10, ft: 20 },
      armF: { a1: -90, a2: 180 }, armN: { to: [50, F - 16], bend: -1 } },
  },
  'short-foot': { a: { custom: () => footFrame(false) }, b: { custom: () => footFrame(true) } },
  'sl-balance': {
    hi: ['legN'],
    one: { hip: [58, F - 47], t: 90, legN: { to: [59, F - 4], ft: 0 }, legF: { to: [46, F - 30], bend: -1, ft: -60 },
      armN: { to: [76, F - 52], bend: 1 }, armF: { to: [72, F - 50], bend: 1 }, props: [P.wall(84)] },
  },
  'sit-to-stand': {
    hi: ['thighN'],
    a: { hip: [42, F - 38], t: 72, leg: { to: [60, F - 4], ft: 0 }, arm: { rel: [9, 9], bend: -1 }, back: [P.chair(22)] },
    b: { hip: [57, F - 47], t: 88, leg: { to: [60, F - 4], ft: 0 }, arm: { rel: [9, 9], bend: -1 }, back: [P.chair(22)] },
  },
  'step-down': {
    hi: ['thighN'],
    a: { hip: [48, F - 59], t: 88, legN: { to: [49, F - 16], ft: 0 }, legF: { to: [66, F - 20], ft: -20 },
      arm: { to: [52, F - 58], bend: 1 }, back: [P.box(30, F - 12, 32, 12)] },
    b: { hip: [42, F - 50], t: 78, legN: { to: [49, F - 16], ft: 0 }, legF: { to: [67, F - 4], ft: 0 },
      arm: { rel: [24, 4], bend: 1 }, back: [P.box(30, F - 12, 32, 12)] },
  },
  'wall-sit': {
    hi: ['thighN'],
    a: { hip: [37, F - 47], t: 90, leg: { to: [52, F - 4], ft: 0 }, arm: { to: [40, F - 46], bend: 1 }, back: [P.wall(30)] },
    b: { hip: [37, F - 27], t: 90, leg: { to: [59, F - 4], ft: 0 }, arm: { to: [48, F - 30], bend: 1 }, back: [P.wall(30)] },
  },
  'band-tke': {
    hi: ['thighN'],
    a: { hip: [46, F - 45], t: 88, legN: { to: [49, F - 4], bend: -1.5, ft: 0 }, legF: { to: [36, F - 4], ft: 0 },
      arm: { to: [50, F - 46], bend: 1 }, props: [P.pole(104), (J) => P.band([104, F - 24], [J.kneeN[0] - 2, J.kneeN[1] + 1])] },
    b: { hip: [49, F - 47], t: 90, legN: { to: [50, F - 4], ft: 0 }, legF: { to: [36, F - 4], ft: 0 },
      arm: { to: [52, F - 47], bend: 1 }, props: [P.pole(104), (J) => P.band([104, F - 24], [J.kneeN[0] - 2, J.kneeN[1] + 1])] },
  },
  'calf-raise': {
    hi: ['legN'],
    a: { hip: [56, F - 47], t: 90, leg: { to: [56, F - 4], ft: 0 }, arm: { to: [86, F - 62], bend: 1 }, props: [P.wall(90)] },
    b: { hip: [58, F - 53], t: 90, leg: { to: [59, F - 10], toe: [64, F - 1] }, arm: { to: [86, F - 66], bend: 1 }, props: [P.wall(90)] },
  },
  'push-up': {
    hi: ['armN'],
    a: { hip: [44, F - 37], t: 51, leg: { a1: 231, a2: 231, ft: 280 }, arm: { to: [82, F - 40], bend: -1 }, back: [P.box(78, F - 40, 34, 40)] },
    b: { hip: [47, F - 30], t: 39, leg: { a1: 219, a2: 219, ft: 280 }, arm: { to: [82, F - 40], bend: 1 }, back: [P.box(78, F - 40, 34, 40)] },
  },
  'band-row': {
    hi: ['armN'],
    a: { hip: [48, F - 46], t: 92, leg: { to: [50, F - 4], ft: 0 }, arm: { to: [75, F - 64], bend: 1 },
      props: [P.wall(106), (J) => P.band([106, F - 64], J.handN)] },
    b: { hip: [48, F - 46], t: 92, leg: { to: [50, F - 4], ft: 0 }, arm: { to: [56, F - 62], bend: 1 },
      props: [P.wall(106), (J) => P.band([106, F - 64], J.handN)] },
  },
  'plank': {
    hi: ['torso'],
    one: { sh: [86, F - 16], t: 12, hd: 12, leg: { a1: 192, a2: 192, ft: 280 }, arm: { a1: -90, a2: 0 } },
  },
  'calf-stretch': {
    hi: ['legN'],
    a: { hip: [55, F - 39], t: 55, legN: { to: [30, F - 4], bend: 1, ft: 0 }, legF: { to: [76, F - 4], ft: 0 },
      arm: { to: [96, F - 62], bend: 1 }, props: [P.wall(100)] },
    b: { hip: [57, F - 34], t: 58, legN: { to: [30, F - 4], bend: -1, ft: 0 }, legF: { to: [76, F - 4], ft: 0 },
      arm: { to: [96, F - 60], bend: 1 }, props: [P.wall(100)] },
  },
  'hip-flexor-stretch': {
    hi: ['thighN'],
    a: { hip: [48, F - 25], t: 90, legN: { to: [24, F - 3], bend: 1, ft: 180 }, legF: { to: [72, F - 4], ft: 0 },
      arm: { to: [50, F - 28], bend: 1 }, set: { kneeN: [42, F - 3] } },
    b: { hip: [56, F - 23], t: 90, legN: { to: [24, F - 3], bend: 1, ft: 180 }, legF: { to: [76, F - 4], ft: 0 },
      arm: { to: [58, F - 26], bend: 1 }, set: { kneeN: [42, F - 3] } },
  },
  'quad-stretch': {
    hi: ['thighN'],
    one: { hip: [56, F - 47], t: 90, legF: { to: [57, F - 4], ft: 0 }, legN: { a1: -96, a2: 100, ft: 160 },
      armN: { to: [47, F - 48], bend: 1 }, armF: { to: [82, F - 58], bend: 1 }, props: [P.wall(86)] },
  },
  'easy-walk': {
    hi: [],
    one: { hip: [58, F - 46], t: 88, legN: { to: [72, F - 4], ft: 10 }, legF: { to: [44, F - 6], ft: -30 },
      armN: { to: [48, F - 50], bend: 1 }, armF: { to: [68, F - 50], bend: -1 } },
  },
  'hip-thrust': {
    hi: ['hip'],
    a: { sh: [32, F - 28], t: 132, hd: 110, leg: { to: [78, F - 4], ft: 0 }, arm: { to: [52, F - 16], bend: -1 },
      back: [P.bench(6, 28, 24)], props: [(J) => P.plate([J.hip[0] + 1, J.hip[1] - 7])] },
    b: { sh: [32, F - 28], t: 182, hd: 150, leg: { to: [78, F - 4], ft: 0 }, arm: { to: [56, F - 35], bend: -1 },
      back: [P.bench(6, 28, 24)], props: [(J) => P.plate([J.hip[0] + 1, J.hip[1] - 7])] },
  },
  'cable-abduction': {
    hi: ['legN'], front: true,
    a: { hip: [62, F - 47], t: 90, legF: { to: [58, F - 4], ft: 180 }, legN: { to: [66, F - 4], ft: 0 },
      armF: { to: [24, F - 56], bend: 1 }, armN: { to: [70, F - 44], bend: -1 },
      back: [P.tower(16)], props: [(J) => P.cable([18, F - 6], J.ankleN)] },
    b: { hip: [62, F - 47], t: 92, legF: { to: [58, F - 4], ft: 180 }, legN: { a1: -58, a2: -58, ft: 20 },
      armF: { to: [24, F - 56], bend: 1 }, armN: { to: [70, F - 44], bend: -1 },
      back: [P.tower(16)], props: [(J) => P.cable([18, F - 6], J.ankleN)] },
  },
  'rdl': {
    hi: ['thighN', 'hip'],
    a: { hip: [57, F - 46], t: 90, leg: { to: [59, F - 4], ft: 0 }, arm: { a1: -88, a2: -88 }, props: [(J) => P.dumbbell(J.handN)] },
    b: { hip: [42, F - 42], t: 28, hd: 22, leg: { to: [58, F - 4], ft: 0 }, arm: { a1: -90, a2: -90 }, props: [(J) => P.dumbbell(J.handN)] },
  },
  'goblet-squat': {
    hi: ['thighN', 'hip'],
    a: { hip: [57, F - 46], t: 90, leg: { to: [59, F - 4], ft: 0 }, arm: { to: [65, F - 57], bend: -1 }, props: [(J) => P.dumbbell(J.handN, true)] },
    b: { hip: [44, F - 28], t: 68, leg: { to: [59, F - 4], ft: 0 }, arm: { to: [60, F - 46], bend: -1 }, props: [(J) => P.dumbbell(J.handN, true)] },
  },
  'leg-press': {
    hi: ['thighN'],
    a: { hip: [34, F - 18], t: 140, hd: 120, leg: { to: [62, F - 40], bend: -1, ft: 135 }, arm: { to: [40, F - 18], bend: 1 },
      back: [`<line class="fp-prop" x1="20" y1="${F}" x2="104" y2="${F - 74}"/>`, `<path class="fp-prop" d="M 8 ${F - 34} L 30 ${F - 10} H 46"/>`],
      props: [(J) => `<line class="fp-plate-line" x1="${r1(J.ankleN[0] - 2)}" y1="${r1(J.ankleN[1] + 9)}" x2="${r1(J.ankleN[0] + 9)}" y2="${r1(J.ankleN[1] - 2)}"/>`] },
    b: { hip: [34, F - 18], t: 140, hd: 120, leg: { to: [72, F - 56], bend: -1, ft: 135 }, arm: { to: [40, F - 18], bend: 1 },
      back: [`<line class="fp-prop" x1="20" y1="${F}" x2="104" y2="${F - 74}"/>`, `<path class="fp-prop" d="M 8 ${F - 34} L 30 ${F - 10} H 46"/>`],
      props: [(J) => `<line class="fp-plate-line" x1="${r1(J.ankleN[0] - 2)}" y1="${r1(J.ankleN[1] + 9)}" x2="${r1(J.ankleN[0] + 9)}" y2="${r1(J.ankleN[1] - 2)}"/>`] },
  },
  'cable-tke': {
    hi: ['thighN'],
    a: { hip: [46, F - 45], t: 88, legN: { to: [49, F - 4], bend: -1.5, ft: 0 }, legF: { to: [36, F - 4], ft: 0 },
      arm: { to: [50, F - 46], bend: 1 }, back: [P.tower(104)], props: [(J) => P.cable([100, F - 26], [J.kneeN[0] - 2, J.kneeN[1] + 1])] },
    b: { hip: [49, F - 47], t: 90, legN: { to: [50, F - 4], ft: 0 }, legF: { to: [36, F - 4], ft: 0 },
      arm: { to: [52, F - 47], bend: 1 }, back: [P.tower(104)], props: [(J) => P.cable([100, F - 26], [J.kneeN[0] - 2, J.kneeN[1] + 1])] },
  },
  'pallof': {
    hi: ['torso'],
    a: { hip: [48, F - 45], t: 90, legN: { to: [54, F - 4], ft: 0 }, legF: { to: [42, F - 4], ft: 0 }, arm: { to: [60, F - 60], bend: 1 },
      back: [P.tower(30), (J) => P.cable([33, F - 60], J.handN)] },
    b: { hip: [48, F - 45], t: 90, legN: { to: [54, F - 4], ft: 0 }, legF: { to: [42, F - 4], ft: 0 }, arm: { a1: -2, a2: -2 },
      back: [P.tower(30), (J) => P.cable([33, F - 60], J.handN)] },
  },
  'cycling': {
    hi: ['legN'],
    one: { hip: [44, F - 54], t: 62, hd: 55, legN: { to: [66, F - 18], ft: -10 }, legF: { to: [52, F - 34], ft: 10 },
      arm: { to: [82, F - 66], bend: -1 },
      back: [`<path class="fp-prop" d="M 38 ${F - 50} H 50 M 44 ${F - 50} L 59 ${F - 26} L 84 ${F - 64} M 79 ${F - 66} H 88 M 59 ${F - 26} L 59 ${F - 4} M 40 ${F} H 80"/>
        <circle class="fp-prop" cx="59" cy="${F - 26}" r="9"/>`] },
  },
};

export function hasFigure(id) { return Boolean(FIGS[id]); }
export function isSinglePose(id) { return Boolean(FIGS[id]?.one); }

// Top of the drawing, so lying-down exercises don't carry empty space above them.
function topOf(markup) {
  let min = H;
  for (const m of markup.matchAll(/points="([^"]+)"/g)) for (const pr of m[1].split(' ')) min = Math.min(min, Number(pr.split(',')[1]));
  for (const m of markup.matchAll(/cy="([\d.]+)" r="([\d.]+)"/g)) min = Math.min(min, Number(m[1]) - Number(m[2]));
  for (const m of markup.matchAll(/ y[12]?="([\d.]+)"/g)) min = Math.min(min, Number(m[1]) - (markup.includes('fs-label') ? 10 : 0));
  for (const m of markup.matchAll(/d="M\s*[\d.]+ ([\d.]+) V\s*([\d.]+)/g)) min = Math.min(min, Number(m[1]), Number(m[2]));
  return Math.max(0, Math.floor(min - 8));
}

// Returns an SVG string. Two frames with an arrow between them, or one frame.
export function figureSVG(id, { label = '' } = {}) {
  const f = FIGS[id];
  if (!f) return '';
  const style = (s) => ({ hi: f.hi, front: f.front, ...s });
  const title = `<title>${label}</title>`;
  if (f.one) {
    const body = frame(style(f.one));
    const y0 = Math.min(topOf(body), H - 60);
    return `<svg class="fig one" viewBox="0 ${y0} ${W} ${H - y0 + 2}" role="img" aria-label="${label}">${title}${body}</svg>`;
  }
  const a = frame(style(f.a));
  const b = frame(style(f.b));
  const y0 = Math.min(topOf(a), topOf(b), H - 50);
  const gap = 18;
  const total = W * 2 + gap;
  const ax = W + 2;
  const ay = (y0 + F) / 2;
  return `<svg class="fig" viewBox="0 ${y0} ${total} ${H - y0 + 2}" role="img" aria-label="${label}">${title}
    <g>${a}</g>
    <path class="fs-arrow" d="M ${ax} ${ay} H ${ax + gap - 6}"/><path class="fs-arrowhead" d="M ${ax + gap - 10} ${ay - 4} L ${ax + gap - 5} ${ay} L ${ax + gap - 10} ${ay + 4}"/>
    <g transform="translate(${W + gap} 0)">${b}</g>
  </svg>`;
}

export const FIGURE_IDS = Object.keys(FIGS);
