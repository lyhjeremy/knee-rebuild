import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EXERCISES, SESSIONS, phaseItems } from '../js/data.js';
import {
  createStore, itemsFor, defaultSets, isClean, estimateMinutes, sorenessRising, milestoneHints, mergeRemote,
  addDays, prescription, dayProgress,
} from '../js/store.js';
import { createSync } from '../js/sync.js';

const mem = () => { const m = new Map(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, v) }; };
const START = '2026-11-23';
const at = (week, dow = 0) => addDays(START, (week - 1) * 7 + dow); // dow 0 = Monday

test('TKE cues stop short of locking', () => {
  for (const id of ['band-tke', 'cable-tke']) {
    assert.equal(EXERCISES[id].caution, 'tke');
    assert.ok(EXERCISES[id].steps.some((x) => x.includes('just short of locked')));
    assert.ok(!EXERCISES[id].steps.some((x) => /straighten the knee fully/i.test(x)));
  }
});

test('phase versions switch in automatically', () => {
  const s = createStore(mem(), START);
  const ids = (date) => itemsFor(s.state, date).items.map((i) => i.ex);
  assert.deepEqual(ids(at(1, 0)), ['glute-bridge', 'sl-glute-bridge', 'side-leg-raise', 'clamshell', 'side-plank', 'short-foot', 'tib-raise', 'sl-balance']);
  assert.ok(!ids(at(5, 0)).includes('glute-bridge'));
  assert.equal(prescription(EXERCISES['sl-glute-bridge'], itemsFor(s.state, at(5, 0)).items[0]), '3 x 10 each');
  const b1 = ids(at(1, 2)), b5 = ids(at(5, 2)), b9 = ids(at(9, 2)), b11 = ids(at(11, 2));
  assert.ok(b1.includes('calf-raise') && !b1.includes('sl-calf-raise') && !b1.includes('pogo-hops'));
  assert.ok(!b5.includes('calf-raise') && !b5.includes('sl-calf-raise'));
  const a5 = ids(at(5, 0));
  assert.ok(a5.includes('sl-calf-raise') && b5.includes('bent-calf-raise'));
  assert.ok(b9.includes('pogo-hops') && !b9.includes('sl-hops'));
  assert.ok(b11.includes('sl-hops'));
  const wall = itemsFor(s.state, at(5, 2)).items.find((i) => i.ex === 'wall-sit');
  assert.equal(prescription(EXERCISES['wall-sit'], wall), '3 x 45 to 60 s');
  // Easier version for a day = Phase 1 items
  s.setDaySession(at(9, 2), 'homeB@1');
  assert.deepEqual(ids(at(9, 2)), b1);
  // Each exercise appears at most once on a given day
  for (const sid of Object.keys(SESSIONS)) for (const [p, w] of [[1, 1], [2, 5], [3, 9], [3, 11], [4, 13]]) {
    const list = phaseItems(sid, p, w).map((i) => i.ex);
    assert.equal(new Set(list).size, list.length, `${sid} phase ${p}`);
  }
});

test('shin raises are twice a week and calf work never uses weights', () => {
  const s = createStore(mem(), START);
  let tib = 0;
  for (let d = 0; d < 7; d++) tib += itemsFor(s.state, at(5, d)).items.filter((i) => i.ex === 'tib-raise').length;
  assert.equal(tib, 2);
  for (const id of ['calf-raise', 'sl-calf-raise', 'bent-calf-raise']) assert.ok(!EXERCISES[id].weighted);
});

test('left and right are logged separately for milestone moves', () => {
  for (const id of ['step-down', 'sl-calf-raise', 'sl-balance', 'sl-hops']) assert.ok(EXERCISES[id].lr, id);
  const s = createStore(mem(), START);
  const sets = defaultSets(s.state, 'step-down', START);
  assert.equal(sets[0].vr, 8);
  const ex = EXERCISES['step-down'];
  assert.equal(isClean({ done: true, sets: [8, 8, 8].map((v) => ({ v, vr: v, ok: true })) }, ex), true);
  assert.equal(isClean({ done: true, sets: [8, 8, 8].map((v) => ({ v, vr: 6, ok: true })) }, ex), false);
});

test('session estimates', () => {
  const settings = { restLight: 30, restHome: 60, restGym: 90 };
  const est = (sid, p, w) => estimateMinutes(phaseItems(sid, p, w), SESSIONS[sid].kind, settings);
  assert.ok(est('homeA', 1, 1) <= 35, String(est('homeA', 1, 1)));
  assert.ok(est('homeB', 1, 1) <= 35, String(est('homeB', 1, 1)));
  assert.ok(est('gym1', 1, 1) >= 40 && est('gym1', 1, 1) <= 60);
  for (const [p, w] of [[2, 5], [3, 9], [3, 11]]) {
    assert.ok(est('homeA', p, w) <= 40, `homeA ${p}: ${est('homeA', p, w)}`);
    assert.ok(est('homeB', p, w) <= 40, `homeB ${p}: ${est('homeB', p, w)}`);
  }
});

test('soreness rule and milestone hints', () => {
  const s = createStore(mem(), START);
  s.setCheckin('daily', '2026-11-23', { stairs: 4, soreness: 1 });
  s.setCheckin('daily', '2026-11-24', { stairs: 4, soreness: 2 });
  assert.equal(sorenessRising(s.state, '2026-11-24'), false);
  s.setCheckin('daily', '2026-11-25', { stairs: 3, soreness: 3 });
  assert.equal(sorenessRising(s.state, '2026-11-25'), true);
  s.setCheckin('daily', '2026-11-26', { stairs: 3, soreness: 3 });
  assert.equal(sorenessRising(s.state, '2026-11-26'), false);
  // hints
  s.setEntry('2026-12-01', 'step-down', { done: true, notes: [], sets: [{ v: 15, vr: 15, ok: true }] });
  s.setEntry('2026-12-02', 'sl-balance', { done: true, sets: [{ v: 30, vr: 25, ok: true }] });
  for (let i = 0; i < 7; i++) s.setCheckin('daily', addDays('2027-01-04', i), { stairs: i % 2, soreness: 0 });
  const h = milestoneHints(s.state);
  assert.ok(h.stepdown15);
  assert.ok(!h.balance30);
  assert.ok(h.stairs);
  s.setMilestone('stepdown15', true, '2026-12-01');
  assert.ok(!milestoneHints(s.state).stepdown15);
});

test('check-ins merge newest-wins and sync through Supabase', async () => {
  const s = createStore(mem(), START);
  s.setCheckin('weekly', '2026-11-23', { steps: 7000, calfL: 39.5, calfR: 39 });
  assert.ok(s.state.outbox['ck|weekly|2026-11-23']);
  const ts = s.state.checkins['weekly|2026-11-23'].ts;
  assert.equal(mergeRemote(s.state, 'ck', { kind: 'weekly', log_date: '2026-11-23', data: { steps: 1 }, client_ts: ts - 1 }), false);
  assert.equal(mergeRemote(s.state, 'ck', { kind: 'weekly', log_date: '2026-11-23', data: { steps: 8000 }, client_ts: ts + 1 }), true);
  assert.equal(s.state.checkins['weekly|2026-11-23'].data.steps, 8000);
  // through the REST layer
  const rows = [];
  const fetchImpl = async (url, opts) => {
    const u = new URL(url);
    const json = (status, body) => ({ ok: status < 300, status, text: async () => (body == null ? '' : JSON.stringify(body)) });
    if (u.pathname === '/auth/v1/verify') return json(200, { access_token: 'a', refresh_token: 'r', expires_in: 3600, user: { id: 'u1' } });
    if (opts.method === 'POST' && u.pathname === '/rest/v1/checkins') { rows.push(...JSON.parse(opts.body)); return json(201, null); }
    if (opts.method === 'GET') return json(200, []);
    return json(201, null);
  };
  const store = createStore(mem(), START);
  store.setCheckin('daily', '2026-11-23', { stairs: 4, soreness: 2 });
  const sync = createSync(store, mem(), fetchImpl);
  sync.configure('https://x.supabase.co', 'k');
  await sync.sendCode('a@b.c').catch(() => {});
  await sync.verify('123456');
  assert.equal(rows.length, 1);
  assert.deepEqual({ kind: rows[0].kind, log_date: rows[0].log_date, data: rows[0].data }, { kind: 'daily', log_date: '2026-11-23', data: { stairs: 4, soreness: 2 } });
  assert.equal(Object.keys(store.state.outbox).length, 0);
});

test('a day with every Phase 1 item done counts as complete', () => {
  const s = createStore(mem(), START);
  for (const it of itemsFor(s.state, START).items) s.setEntry(START, it.ex, { done: true, sets: [{ v: 1, ok: true }] });
  const p = dayProgress(s.state, START);
  assert.equal(p.done, p.total);
});
