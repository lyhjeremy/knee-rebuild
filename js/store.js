// Local state, plan logic and the sync outbox. No DOM here, so tests can run it in Node.
import { EXERCISES, SESSIONS, SCHEDULE, PHASES, MILESTONES, BAD_NOTES, phaseItems } from './data.js';

export const STATE_KEY = 'kr.state.v1';

// ---------- dates (local time, YYYY-MM-DD) ----------
export function iso(d = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
export function parseISO(s) {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}
export function addDays(s, n) {
  const d = parseISO(s);
  d.setDate(d.getDate() + n);
  return iso(d);
}
export function daysBetween(a, b) {
  return Math.round((parseISO(b) - parseISO(a)) / 86400000);
}
export function mondayOf(s) {
  const dow = parseISO(s).getDay();
  return addDays(s, dow === 0 ? -6 : 1 - dow);
}

// ---------- state ----------
export function emptyState(today = iso()) {
  return {
    v: 1,
    settings: { startDate: today, phaseOverride: null, restLight: 30, restHome: 60, restGym: 90, demoLinks: {}, ts: 0 },
    days: {},
    milestones: {},
    checkins: {},
    outbox: {},
  };
}

export function createStore(storage, today = iso()) {
  let state;
  try {
    state = JSON.parse(storage.getItem(STATE_KEY) || 'null');
  } catch {
    state = null;
  }
  if (!state || state.v !== 1) state = emptyState(today);
  state.outbox ||= {};
  state.checkins ||= {};
  state.settings.restLight ??= 30;
  const listeners = new Set();
  let clock = 0;
  const now = () => { clock = Math.max(Date.now(), clock + 1); return clock; };

  function save() {
    storage.setItem(STATE_KEY, JSON.stringify(state));
    listeners.forEach((fn) => fn(state));
  }
  function day(date) {
    return (state.days[date] ||= { session: null, sessionTs: 0, entries: {} });
  }

  return {
    get state() { return state; },
    onChange(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    save,
    replace(next) { state = next; state.outbox ||= {}; state.checkins ||= {}; save(); },

    setEntry(date, exId, patch) {
      const d = day(date);
      const prev = d.entries[exId] || { done: null, sets: [], pain: null, notes: [], session: null };
      d.entries[exId] = { ...prev, ...patch, ts: now() };
      state.outbox[`log|${date}|${exId}`] = 1;
      save();
      return d.entries[exId];
    },
    setDaySession(date, sid) {
      const d = day(date);
      d.session = sid;
      d.sessionTs = now();
      state.outbox[`day|${date}`] = 1;
      save();
    },
    setMilestone(id, achieved, date) {
      state.milestones[id] = { achieved, date: achieved ? date : null, ts: now() };
      state.outbox[`ms|${id}`] = 1;
      save();
    },
    // kind 'daily' is keyed by date, 'weekly' by the week's Monday.
    setCheckin(kind, date, patch) {
      const key = `${kind}|${date}`;
      const prev = state.checkins[key]?.data || {};
      state.checkins[key] = { data: { ...prev, ...patch }, ts: now() };
      state.outbox[`ck|${key}`] = 1;
      save();
    },
    setSettings(patch) {
      state.settings = { ...state.settings, ...patch, ts: now() };
      state.outbox.settings = 1;
      save();
    },
  };
}

// ---------- remote merge (newest client timestamp wins) ----------
export function mergeRemote(state, kind, row) {
  const ts = Number(row.client_ts) || 0;
  if (kind === 'log') {
    const d = (state.days[row.log_date] ||= { session: null, sessionTs: 0, entries: {} });
    const cur = d.entries[row.exercise_id];
    if (cur && cur.ts >= ts) return false;
    d.entries[row.exercise_id] = {
      done: row.done, sets: row.sets || [], pain: row.pain, notes: row.notes || [],
      session: row.session_id, ts,
    };
    delete state.outbox[`log|${row.log_date}|${row.exercise_id}`];
    return true;
  }
  if (kind === 'day') {
    const d = (state.days[row.log_date] ||= { session: null, sessionTs: 0, entries: {} });
    if (d.sessionTs >= ts) return false;
    d.session = row.session_id;
    d.sessionTs = ts;
    delete state.outbox[`day|${row.log_date}`];
    return true;
  }
  if (kind === 'ms') {
    const cur = state.milestones[row.milestone_id];
    if (cur && cur.ts >= ts) return false;
    state.milestones[row.milestone_id] = { achieved: row.achieved, date: row.achieved_on, ts };
    delete state.outbox[`ms|${row.milestone_id}`];
    return true;
  }
  if (kind === 'ck') {
    state.checkins ||= {};
    const key = `${row.kind}|${row.log_date}`;
    const cur = state.checkins[key];
    if (cur && cur.ts >= ts) return false;
    state.checkins[key] = { data: row.data || {}, ts };
    delete state.outbox[`ck|${key}`];
    return true;
  }
  if (kind === 'settings') {
    if (state.settings.ts >= ts) return false;
    state.settings = { ...state.settings, ...(row.data || {}), ts };
    delete state.outbox.settings;
    return true;
  }
  return false;
}

// ---------- plan logic ----------
export function weekNumber(state, date) {
  return Math.floor(daysBetween(state.settings.startDate, date) / 7) + 1;
}
export function allMilestonesMet(state) {
  return MILESTONES.every((m) => state.milestones[m.id]?.achieved);
}
// Returns { n, phase, waiting } where waiting means week 13+ but milestones not yet met.
export function phaseFor(state, date) {
  const week = weekNumber(state, date);
  const ov = state.settings.phaseOverride;
  if (ov) return { n: ov, phase: PHASES[ov - 1], week, waiting: false, manual: true };
  let n = 1;
  for (const p of PHASES) if (week >= p.weeks[0]) n = p.n;
  let waiting = false;
  if (n === 4 && !allMilestonesMet(state)) { n = 3; waiting = true; }
  return { n, phase: PHASES[n - 1], week, waiting, manual: false };
}

// The stored session id may carry '@1' for "easier version today" (Phase 1 versions).
export function sessionIdFor(state, date) {
  return state.days[date]?.session || SCHEDULE[parseISO(date).getDay()];
}
export function parseSid(raw) {
  const [sid, cap] = String(raw).split('@');
  return { sid, cap: cap ? Number(cap) : null };
}
export function itemsFor(state, date) {
  const raw = sessionIdFor(state, date);
  const { sid, cap } = parseSid(raw);
  const ph = phaseFor(state, date);
  const phase = Math.max(1, cap ? Math.min(cap, ph.n) : ph.n);
  const week = Math.max(1, ph.week);
  return { raw, sid, cap, phase, week, session: SESSIONS[sid] || SESSIONS.rest, items: phaseItems(sid, phase, cap ? 1 : week) };
}
export function itemFor(state, date, exId) {
  return itemsFor(state, date).items.find((it) => it.ex === exId) || {};
}

const lo = (v) => (Array.isArray(v) ? v[0] : v);
const hi = (v) => (Array.isArray(v) ? v[1] : v);
export function targetOf(ex, item = {}) {
  return ex.mode === 'reps' ? (item.reps ?? ex.reps) : ex.mode === 'time' ? (item.secs ?? ex.secs) : (item.mins ?? ex.mins);
}
export function prescription(ex, item = {}) {
  const sets = item.sets ?? ex.sets;
  const t = targetOf(ex, item);
  const val = Array.isArray(t) ? `${t[0]} to ${t[1]}` : `${t}`;
  const unit = ex.mode === 'reps' ? '' : ex.mode === 'time' ? ' s' : ' min';
  const side = ex.perSide ? ' each' : '';
  if (ex.mode === 'minutes') return `${val} min`;
  return `${sets} x ${val}${unit}${side}`;
}

// All entries for an exercise, oldest first: [{date, entry}]
export function historyOf(state, exId) {
  const out = [];
  for (const date of Object.keys(state.days).sort()) {
    const e = state.days[date].entries[exId];
    if (e && (e.done !== null || e.sets?.some((s) => s.ok))) out.push({ date, entry: e });
  }
  return out;
}

export function lastEntryBefore(state, exId, date) {
  const h = historyOf(state, exId).filter((x) => x.date < date);
  return h.length ? h[h.length - 1] : null;
}

// The set rows to show before anything is logged: last time's values, or the targets.
export function defaultSets(state, exId, date, item = {}) {
  const ex = EXERCISES[exId];
  const n = item.sets ?? ex.sets;
  const prev = lastEntryBefore(state, exId, date)?.entry;
  const t = lo(targetOf(ex, item));
  return Array.from({ length: n }, (_, i) => {
    const p = prev?.sets?.[i] || prev?.sets?.[prev.sets.length - 1];
    const set = { v: p?.v ?? t, kg: ex.weighted ? (p?.kg ?? null) : null, ok: false };
    if (ex.lr) set.vr = p?.vr ?? p?.v ?? t;
    return set;
  });
}

export function isClean(entry, ex, item = {}) {
  if (!entry || entry.done !== true) return false;
  const n = item.sets ?? ex.sets;
  const ok = (entry.sets || []).filter((s) => s.ok);
  if (ok.length < n) return false;
  const top = ex.mode === 'minutes' ? lo(targetOf(ex, item)) : hi(targetOf(ex, item));
  if (ok.some((s) => Number(s.v) < top || (ex.lr && Number(s.vr) < top))) return false;
  if (entry.pain != null && entry.pain > 3) return false;
  if ((entry.notes || []).some((x) => BAD_NOTES.includes(x))) return false;
  return true;
}

// True when the last two attempts (up to and including `date`) were both clean.
export function readyToProgress(state, exId, date, item = {}) {
  const ex = EXERCISES[exId];
  if (!ex || ex.mode === 'minutes' || ex.cat === 'mobility') return false;
  const h = historyOf(state, exId).filter((x) => x.date <= date && x.entry.done !== null);
  if (h.length < 2) return false;
  return h.slice(-2).every((x) => isClean(x.entry, ex, item));
}

export function dayProgress(state, date) {
  const { raw: sid, items } = itemsFor(state, date);
  const entries = state.days[date]?.entries || {};
  const done = items.filter((it) => entries[it.ex]?.done === true).length;
  const touched = items.filter((it) => entries[it.ex] && (entries[it.ex].done !== null || entries[it.ex].sets?.some((s) => s.ok))).length;
  return { sid, total: items.length, done, touched };
}

export function weekSummary(state, monday) {
  let completed = 0, partial = 0, planned = 0, painSum = 0, painN = 0, cycling = 0;
  for (let i = 0; i < 7; i++) {
    const date = addDays(monday, i);
    if (date < state.settings.startDate) continue;
    const { session: s, items } = itemsFor(state, date);
    if (items.length && !s.optional) planned++;
    const p = dayProgress(state, date);
    if (p.total && p.done === p.total) completed++;
    else if (p.touched) partial++;
    const entries = state.days[date]?.entries || {};
    for (const [exId, e] of Object.entries(entries)) {
      if (e.pain != null) { painSum += e.pain; painN++; }
      if (exId === 'cycling' && e.done) cycling += Number(e.sets?.[0]?.v) || 0;
    }
  }
  return { monday, completed, partial, planned, avgPain: painN ? painSum / painN : null, painN, cycling };
}

// One number per logged day for the History chart.
export function metricOf(ex) {
  if (ex.weighted) return { label: 'Top set weight', unit: 'kg' };
  if (ex.mode === 'time') return { label: 'Longest hold', unit: 's' };
  if (ex.mode === 'minutes') return { label: 'Minutes', unit: 'min' };
  return { label: ex.perSide ? 'Total reps per side' : 'Total reps', unit: 'reps' };
}
export function seriesOf(state, exId) {
  const ex = EXERCISES[exId];
  return historyOf(state, exId)
    .filter((x) => x.entry.done !== false)
    .map(({ date, entry }) => {
      const ok = (entry.sets || []).filter((s) => s.ok);
      const vals = ok.map((s) => Number(s.v) || 0);
      let value;
      if (ex.weighted) value = Math.max(0, ...ok.map((s) => Number(s.kg) || 0));
      else if (ex.mode === 'time') value = Math.max(0, ...vals);
      else value = vals.reduce((a, b) => a + b, 0);
      const valueR = ex.lr ? (ex.mode === 'time' ? Math.max(0, ...ok.map((s) => Number(s.vr) || 0)) : ok.reduce((a, s) => a + (Number(s.vr) || 0), 0)) : null;
      return { date, value, valueR, pain: entry.pain, sets: ok.length, entry };
    })
    .filter((p) => p.sets > 0);
}

// ---------- session time ----------
// Rough minutes for a list of items: work time, rest between sets, 30 s to set up each exercise.
// Items marked inRests (short foot, balance) are done during other exercises' rests, so they
// add nothing when the session has enough other rests to fit them.
export function restSeconds(ex, kind, settings) {
  if (kind === 'gym') return settings.restGym ?? 90;
  return ex.rest === 'light' ? (settings.restLight ?? 30) : (settings.restHome ?? 60);
}
export function workSeconds(ex, item = {}) {
  const sets = item.sets ?? ex.sets;
  const sides = ex.perSide ? 2 : 1;
  const t = targetOf(ex, item);
  const v = Array.isArray(t) ? (t[0] + t[1]) / 2 : t;
  if (ex.mode === 'minutes') return v * 60;
  const per = ex.mode === 'time' ? v : v * (ex.repSecs ?? 4);
  return sets * sides * per + (ex.perSide ? sets * 5 : 0);
}
export function estimateMinutes(items, kind, settings) {
  let work = 0, rest = 0, filler = 0;
  for (const it of items) {
    const ex = EXERCISES[it.ex];
    const sets = it.sets ?? ex.sets;
    const w = workSeconds(ex, it);
    if (ex.inRests && kind === 'home') { filler += w; continue; }
    work += w + 30;
    rest += Math.max(0, sets - 1) * restSeconds(ex, kind, settings);
  }
  const overflow = Math.max(0, filler - rest);
  return Math.round((work + rest + overflow) / 60);
}

// ---------- check-ins and the soreness rule ----------
export const checkin = (state, kind, date) => state.checkins?.[`${kind}|${date}`]?.data || null;
// The plan's rule: scale back if next-morning soreness gets worse two days in a row.
export function sorenessRising(state, date) {
  const s = [2, 1, 0].map((k) => checkin(state, 'daily', addDays(date, -k))?.soreness);
  return s.every((x) => x != null) && s[0] < s[1] && s[1] < s[2];
}

// ---------- milestone hints ----------
// Returns { milestoneId: 'reason' } for milestones the logs suggest are met but not ticked.
export function milestoneHints(state) {
  const out = {};
  const best = (exId, min, extra = () => true) => {
    for (const { date, entry } of historyOf(state, exId).slice().reverse()) {
      if (!extra(entry)) continue;
      if ((entry.sets || []).some((s) => s.ok && Number(s.v) >= min && Number(s.vr) >= min)) return date;
    }
    return null;
  };
  const clean = (e) => !(e.notes || []).some((n) => ['Form broke down', 'Knee discomfort'].includes(n));
  const painFree = (e) => !e.pain;
  const d1 = best('step-down', 15, clean);
  if (d1) out.stepdown15 = `15 each side on ${d1}`;
  const d2 = best('sl-calf-raise', 20, painFree);
  if (d2) out.calf20 = `20 each side, no pain, on ${d2}`;
  const d3 = best('sl-balance', 30);
  if (d3) out.balance30 = `30 s each side on ${d3}`;
  // Stairs at 0 to 1 on 7 mornings running.
  const dailies = Object.entries(state.checkins || {}).filter(([k]) => k.startsWith('daily|')).map(([k, v]) => [k.slice(6), v.data]).sort();
  let run = 0, prev = null;
  for (const [date, d] of dailies) {
    const good = d.stairs != null && d.stairs <= 1;
    run = good ? (prev && addDays(prev, 1) === date ? run + 1 : 1) : 0;
    prev = date;
    if (run >= 7) out.stairs = `stairs at 0 to 1 for 7 mornings to ${date}`;
  }
  // 10,000 steps a day on average in a week with no morning soreness above 1.
  for (const [k, v] of Object.entries(state.checkins || {})) {
    if (!k.startsWith('weekly|') || !(Number(v.data.steps) >= 10000)) continue;
    const mon = k.slice(7);
    const sore = [0, 1, 2, 3, 4, 5, 6, 7].map((i) => checkin(state, 'daily', addDays(mon, i))?.soreness).filter((x) => x != null);
    if (sore.length >= 4 && Math.max(...sore) <= 1) out.steps10k = `week of ${mon}: ${v.data.steps} steps a day, soreness 0 to 1`;
  }
  for (const id of Object.keys(out)) if (state.milestones[id]?.achieved) delete out[id];
  return out;
}
