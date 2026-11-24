import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EXERCISES, SESSIONS, SCHEDULE, MILESTONES } from '../js/data.js';
import {
  createStore, mergeRemote, phaseFor, sessionIdFor, defaultSets, readyToProgress, isClean,
  weekSummary, seriesOf, prescription, mondayOf, addDays, itemsFor,
} from '../js/store.js';
import { figureSVG, FIGURE_IDS } from '../js/figures.js';

const mem = () => { const m = new Map(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, v) }; };
const START = '2026-11-23'; // a Monday

test('every session item points at a real exercise, and every exercise has a diagram', () => {
  for (const s of Object.values(SESSIONS)) for (const it of s.items) assert.ok(EXERCISES[it.ex], it.ex);
  for (const id of Object.keys(EXERCISES)) assert.ok(FIGURE_IDS.includes(id), `no figure for ${id}`);
  for (const id of FIGURE_IDS) assert.match(figureSVG(id), /^<svg/);
  for (const d of [0, 1, 2, 3, 4, 5, 6]) assert.ok(SESSIONS[SCHEDULE[d]]);
});

test('no NaN in any diagram', () => {
  for (const id of FIGURE_IDS) assert.doesNotMatch(figureSVG(id), /NaN/, id);
});

test('prescriptions read like the spec', () => {
  assert.equal(prescription(EXERCISES['glute-bridge']), '3 x 12');
  assert.equal(prescription(EXERCISES['side-plank']), '3 x 20 to 30 s each');
  assert.equal(prescription(EXERCISES['short-foot'], { sets: 2 }), '2 x 10 each');
  assert.equal(prescription(EXERCISES['easy-walk']), '15 to 20 min');
});

test('schedule and phases follow the start date', () => {
  const s = createStore(mem(), START);
  assert.equal(sessionIdFor(s.state, '2026-11-23'), 'homeA');
  assert.equal(sessionIdFor(s.state, '2026-11-24'), 'gym1');
  assert.equal(sessionIdFor(s.state, '2026-11-29'), 'homeC');
  assert.equal(phaseFor(s.state, START).n, 1);
  assert.equal(phaseFor(s.state, addDays(START, 7 * 4)).n, 2);  // week 5
  assert.equal(phaseFor(s.state, addDays(START, 7 * 8)).n, 3);  // week 9
  const w13 = phaseFor(s.state, addDays(START, 7 * 12));
  assert.equal(w13.n, 3);
  assert.equal(w13.waiting, true);
  for (const m of MILESTONES) s.setMilestone(m.id, true, START);
  assert.equal(phaseFor(s.state, addDays(START, 7 * 12)).n, 4);
  s.setDaySession('2026-11-23', 'gym1');
  assert.equal(sessionIdFor(s.state, '2026-11-23'), 'gym1');
  assert.equal(mondayOf('2026-11-29'), '2026-11-23');
});

test('default sets come from last time, else the target', () => {
  const s = createStore(mem(), START);
  const first = defaultSets(s.state, 'hip-thrust', START);
  assert.deepEqual(first, [{ v: 10, kg: null, ok: false }, { v: 10, kg: null, ok: false }, { v: 10, kg: null, ok: false }]);
  s.setEntry('2026-11-24', 'hip-thrust', { done: true, sets: [{ v: 10, kg: 40, ok: true }, { v: 10, kg: 40, ok: true }, { v: 9, kg: 40, ok: true }] });
  const next = defaultSets(s.state, 'hip-thrust', '2026-11-27');
  assert.equal(next[0].kg, 40);
  assert.equal(next[2].v, 9);
  assert.equal(next[0].ok, false);
  // range target uses the low end
  assert.equal(defaultSets(s.state, 'push-up', START)[0].v, 8);
});

test('progression prompt needs two clean sessions in a row', () => {
  const s = createStore(mem(), START);
  const clean = { done: true, pain: 2, notes: ['Just right'], sets: [12, 12, 12].map((v) => ({ v, ok: true })) };
  s.setEntry('2026-11-23', 'glute-bridge', clean);
  assert.equal(readyToProgress(s.state, 'glute-bridge', '2026-11-23'), false);
  s.setEntry('2026-11-26', 'glute-bridge', clean);
  assert.equal(readyToProgress(s.state, 'glute-bridge', '2026-11-26'), true);
  // Pain above 3 breaks it
  s.setEntry('2026-11-26', 'glute-bridge', { ...clean, pain: 4 });
  assert.equal(readyToProgress(s.state, 'glute-bridge', '2026-11-26'), false);
  // A range target needs the top of the range
  assert.equal(isClean({ done: true, sets: [8, 8].map((v) => ({ v, ok: true })) }, EXERCISES['push-up']), false);
  assert.equal(isClean({ done: true, sets: [12, 12].map((v) => ({ v, ok: true })) }, EXERCISES['push-up']), true);
  // A "Form broke down" note breaks it
  assert.equal(isClean({ done: true, notes: ['Form broke down'], sets: [12, 12].map((v) => ({ v, ok: true })) }, EXERCISES['push-up']), false);
  // Fewer sets than prescribed breaks it
  assert.equal(isClean({ done: true, sets: [12].map((v) => ({ v, ok: true })) }, EXERCISES['push-up']), false);
});

test('weekly summary counts full sessions, pain and cycling', () => {
  const s = createStore(mem(), START);
  const homeA = itemsFor(s.state, '2026-11-23').items;
  for (const it of homeA) s.setEntry('2026-11-23', it.ex, { done: true, pain: 2, sets: [{ v: 10, ok: true }] });
  s.setEntry('2026-11-24', 'hip-thrust', { done: true, pain: 4, sets: [{ v: 10, kg: 30, ok: true }] });
  s.setEntry('2026-11-24', 'cycling', { done: true, sets: [{ v: 35, ok: true }] });
  const w = weekSummary(s.state, '2026-11-23');
  assert.equal(w.completed, 1);
  assert.equal(w.partial, 1);
  assert.equal(w.planned, 6);
  assert.equal(w.cycling, 35);
  assert.equal(w.avgPain, (2 * homeA.length + 4) / (homeA.length + 1));
});

test('history series picks the right metric', () => {
  const s = createStore(mem(), START);
  s.setEntry('2026-11-24', 'hip-thrust', { done: true, sets: [{ v: 10, kg: 40, ok: true }, { v: 10, kg: 45, ok: true }, { v: 8, kg: 50, ok: false }] });
  assert.equal(seriesOf(s.state, 'hip-thrust')[0].value, 45);
  s.setEntry('2026-11-25', 'wall-sit', { done: true, sets: [{ v: 30, ok: true }, { v: 40, ok: true }] });
  assert.equal(seriesOf(s.state, 'wall-sit')[0].value, 40);
  s.setEntry('2026-11-23', 'glute-bridge', { done: true, sets: [{ v: 12, ok: true }, { v: 10, ok: true }] });
  assert.equal(seriesOf(s.state, 'glute-bridge')[0].value, 22);
  s.setEntry('2026-11-26', 'glute-bridge', { done: false, sets: [] });
  assert.equal(seriesOf(s.state, 'glute-bridge').length, 1);
});

test('edits queue in the outbox, and remote merge keeps the newest', () => {
  const s = createStore(mem(), START);
  const e = s.setEntry('2026-11-23', 'plank', { done: true, sets: [{ v: 30, ok: true }] });
  assert.ok(s.state.outbox['log|2026-11-23|plank']);
  // Older remote row loses
  assert.equal(mergeRemote(s.state, 'log', { log_date: '2026-11-23', exercise_id: 'plank', done: false, sets: [], client_ts: e.ts - 10 }), false);
  assert.equal(s.state.days['2026-11-23'].entries.plank.done, true);
  // Newer remote row wins and clears the queued edit
  assert.equal(mergeRemote(s.state, 'log', { log_date: '2026-11-23', exercise_id: 'plank', done: false, sets: [], notes: [], pain: 3, client_ts: e.ts + 10 }), true);
  assert.equal(s.state.days['2026-11-23'].entries.plank.pain, 3);
  assert.equal(s.state.outbox['log|2026-11-23|plank'], undefined);
  assert.equal(mergeRemote(s.state, 'settings', { data: { startDate: '2026-11-16' }, client_ts: Date.now() + 1000 }), true);
  assert.equal(s.state.settings.startDate, '2026-11-16');
});

test('state survives a reload', () => {
  const store = mem();
  const a = createStore(store, START);
  a.setEntry('2026-11-23', 'plank', { done: true, sets: [{ v: 30, ok: true }] });
  const b = createStore(store, START);
  assert.equal(b.state.days['2026-11-23'].entries.plank.done, true);
});
