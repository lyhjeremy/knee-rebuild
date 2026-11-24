import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createStore } from '../js/store.js';
import { createSync } from '../js/sync.js';

const mem = () => { const m = new Map(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, v) }; };

// A tiny fake of the Supabase REST endpoints the app uses, with the same newest-wins rule as the SQL trigger.
function fakeSupabase() {
  const tables = { log_entries: new Map(), day_sessions: new Map(), milestones: new Map(), settings: new Map(), checkins: new Map() };
  const keys = { log_entries: ['user_id', 'log_date', 'exercise_id'], day_sessions: ['user_id', 'log_date'], milestones: ['user_id', 'milestone_id'], settings: ['user_id'], checkins: ['user_id', 'kind', 'log_date'] };
  let clock = 0;
  const calls = [];
  let tokenValid = true;
  const json = (status, body) => ({ ok: status < 300, status, text: async () => (body == null ? '' : JSON.stringify(body)) });
  async function fetchImpl(url, opts) {
    const u = new URL(url);
    calls.push(`${opts.method} ${u.pathname}`);
    const body = opts.body ? JSON.parse(opts.body) : null;
    if (u.pathname === '/auth/v1/otp') return json(200, {});
    if (u.pathname === '/auth/v1/verify') {
      if (body.token !== '123456') return json(403, { msg: 'Token has expired or is invalid' });
      return json(200, { access_token: 'at1', refresh_token: 'rt1', expires_in: 3600, user: { id: 'u1' } });
    }
    if (u.pathname === '/auth/v1/token') { tokenValid = true; return json(200, { access_token: 'at2', refresh_token: 'rt2', expires_in: 3600 }); }
    if (!tokenValid) return json(401, { message: 'JWT expired' });
    const table = u.pathname.replace('/rest/v1/', '');
    const t = tables[table];
    if (opts.method === 'POST') {
      for (const row of body) {
        const k = keys[table].map((c) => row[c]).join('|');
        const old = t.get(k);
        if (old && row.client_ts < old.client_ts) continue;
        t.set(k, { ...row, server_ts: new Date(Date.UTC(2026, 10, 23, 0, 0, ++clock)).toISOString() });
      }
      return json(201, null);
    }
    if (opts.method === 'GET') {
      const since = decodeURIComponent(u.searchParams.get('server_ts').replace('gte.', ''));
      const rows = [...t.values()].filter((r) => r.server_ts >= since).sort((a, b) => a.server_ts.localeCompare(b.server_ts));
      return json(200, rows);
    }
    if (opts.method === 'DELETE') { t.clear(); return json(204, null); }
    return json(404, {});
  }
  return { fetchImpl, tables, calls, expire: () => { tokenValid = false; } };
}

test('two devices sync through Supabase, newest edit wins', async () => {
  const sb = fakeSupabase();
  const phone = createStore(mem(), '2026-11-23');
  const mac = createStore(mem(), '2026-11-23');
  const syncPhone = createSync(phone, mem(), sb.fetchImpl);
  const syncMac = createSync(mac, mem(), sb.fetchImpl);
  for (const s of [syncPhone, syncMac]) {
    s.configure('https://demo.supabase.co', 'sb_publishable_x');
    await s.sendCode('me@example.com');
  }
  await assert.rejects(syncPhone.verify('000000'), /invalid/);

  phone.setEntry('2026-11-23', 'glute-bridge', { done: true, sets: [{ v: 12, ok: true }], pain: 1 });
  phone.setMilestone('stairs', true, '2026-11-23');
  await syncPhone.verify('123456'); // signs in and syncs
  assert.equal(Object.keys(phone.state.outbox).length, 0);
  assert.equal(sb.tables.log_entries.size, 1);
  assert.equal(sb.tables.log_entries.get('u1|2026-11-23|glute-bridge').pain, 1);

  await syncMac.verify('123456');
  assert.equal(mac.state.days['2026-11-23'].entries['glute-bridge'].pain, 1);
  assert.equal(mac.state.milestones.stairs.achieved, true);

  // Mac edits later; phone pulls it.
  mac.setEntry('2026-11-23', 'glute-bridge', { pain: 3 });
  await syncMac.syncNow();
  await syncPhone.syncNow();
  assert.equal(phone.state.days['2026-11-23'].entries['glute-bridge'].pain, 3);

  // An expired token is refreshed and the call retried.
  sb.expire();
  phone.setEntry('2026-11-24', 'hip-thrust', { done: true, sets: [{ v: 10, kg: 40, ok: true }] });
  await syncPhone.syncNow();
  assert.equal(syncPhone.status.state, 'ok');
  assert.equal(sb.tables.log_entries.get('u1|2026-11-24|hip-thrust').weight_kg, 40);
  assert.ok(sb.calls.includes('POST /auth/v1/token'));
});

test('an older offline edit does not overwrite a newer one on the server', async () => {
  const sb = fakeSupabase();
  const a = createStore(mem(), '2026-11-23');
  const b = createStore(mem(), '2026-11-23');
  const sa = createSync(a, mem(), sb.fetchImpl);
  const sbb = createSync(b, mem(), sb.fetchImpl);
  for (const s of [sa, sbb]) { s.configure('https://demo.supabase.co', 'k'); await s.sendCode('me@example.com'); await s.verify('123456'); }
  a.setEntry('2026-11-25', 'wall-sit', { done: true, sets: [{ v: 30, ok: true }] }); // older
  await new Promise((r) => setTimeout(r, 5));
  b.setEntry('2026-11-25', 'wall-sit', { done: true, sets: [{ v: 45, ok: true }] }); // newer
  await sbb.syncNow();
  await sa.syncNow(); // pulls the newer row first, so its own older edit is dropped
  assert.equal(a.state.days['2026-11-25'].entries['wall-sit'].sets[0].v, 45);
  assert.equal(sb.tables.log_entries.get('u1|2026-11-25|wall-sit').sets[0].v, 45);
});
