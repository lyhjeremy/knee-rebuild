// Supabase sync over plain REST (no SDK), so the app stays small and works offline.
// Everything is saved on the phone first; this pushes the outbox and pulls newer rows.
import { mergeRemote } from './store.js';

export const SYNC_KEY = 'kr.sync.v1';
const EPOCH = '1970-01-01T00:00:00Z';
const TABLES = {
  log: { table: 'log_entries', conflict: 'user_id,log_date,exercise_id' },
  day: { table: 'day_sessions', conflict: 'user_id,log_date' },
  ms: { table: 'milestones', conflict: 'user_id,milestone_id' },
  settings: { table: 'settings', conflict: 'user_id' },
};

export function createSync(store, storage, fetchImpl = (...a) => fetch(...a)) {
  let cfg;
  try { cfg = JSON.parse(storage.getItem(SYNC_KEY) || 'null'); } catch { cfg = null; }
  cfg ||= {};
  cfg.cursors ||= {};
  const listeners = new Set();
  let running = null;
  let status = { state: 'idle', message: '' };

  const persist = () => storage.setItem(SYNC_KEY, JSON.stringify(cfg));
  const emit = (s) => { status = { ...status, ...s }; listeners.forEach((fn) => fn(status)); };
  const base = () => cfg.url.replace(/\/+$/, '');

  async function call(path, { method = 'GET', body, auth = true, prefer, retry = true } = {}) {
    const headers = { apikey: cfg.key, 'Content-Type': 'application/json' };
    if (auth) {
      await ensureToken();
      headers.Authorization = `Bearer ${cfg.session.access_token}`;
    }
    if (prefer) headers.Prefer = prefer;
    const res = await fetchImpl(base() + path, { method, headers, body: body ? JSON.stringify(body) : undefined });
    if (res.status === 401 && auth && retry) {
      await refresh();
      return call(path, { method, body, auth, prefer, retry: false });
    }
    const text = await res.text();
    let data = null;
    try { data = text ? JSON.parse(text) : null; } catch { data = text; }
    if (!res.ok) {
      const msg = data?.msg || data?.message || data?.error_description || data?.error || `HTTP ${res.status}`;
      const err = new Error(msg);
      err.status = res.status;
      throw err;
    }
    return data;
  }

  function saveSession(d) {
    cfg.session = {
      access_token: d.access_token,
      refresh_token: d.refresh_token,
      expires_at: d.expires_at || Math.floor(Date.now() / 1000) + (d.expires_in || 3600),
      user_id: d.user?.id || cfg.session?.user_id,
    };
    persist();
  }

  async function refresh() {
    if (!cfg.session?.refresh_token) throw Object.assign(new Error('Not signed in'), { status: 401 });
    try {
      const d = await call('/auth/v1/token?grant_type=refresh_token', {
        method: 'POST', auth: false, body: { refresh_token: cfg.session.refresh_token },
      });
      saveSession(d);
    } catch (e) {
      if (e.status === 400 || e.status === 401 || e.status === 403) {
        cfg.session = null;
        persist();
        emit({ state: 'signed-out', message: 'Signed out. Sign in again to keep syncing.' });
      }
      throw e;
    }
  }

  async function ensureToken() {
    if (!cfg.session) throw Object.assign(new Error('Not signed in'), { status: 401 });
    if (cfg.session.expires_at - 60 < Date.now() / 1000) await refresh();
  }

  function rowFor(kind, key) {
    const st = store.state;
    const uid = cfg.session.user_id;
    if (kind === 'log') {
      const [, date, exId] = key.split('|');
      const e = st.days[date]?.entries?.[exId];
      if (!e) return null;
      const kgs = (e.sets || []).filter((s) => s.ok && s.kg != null).map((s) => Number(s.kg));
      return {
        ts: e.ts,
        row: {
          user_id: uid, log_date: date, exercise_id: exId, session_id: e.session, done: e.done,
          sets: e.sets || [], pain: e.pain, notes: e.notes || [],
          weight_kg: kgs.length ? Math.max(...kgs) : null, client_ts: e.ts,
        },
      };
    }
    if (kind === 'day') {
      const [, date] = key.split('|');
      const d = st.days[date];
      if (!d) return null;
      return { ts: d.sessionTs, row: { user_id: uid, log_date: date, session_id: d.session, client_ts: d.sessionTs } };
    }
    if (kind === 'ms') {
      const [, id] = key.split('|');
      const m = st.milestones[id];
      if (!m) return null;
      return { ts: m.ts, row: { user_id: uid, milestone_id: id, achieved: m.achieved, achieved_on: m.date, client_ts: m.ts } };
    }
    if (kind === 'settings') {
      const { ts, ...data } = st.settings;
      return { ts, row: { user_id: uid, data, client_ts: ts } };
    }
    return null;
  }

  async function push() {
    const keys = Object.keys(store.state.outbox);
    if (!keys.length) return 0;
    const groups = {};
    for (const key of keys) {
      const kind = key === 'settings' ? 'settings' : key.split('|')[0];
      const r = rowFor(kind, key);
      if (!r) { delete store.state.outbox[key]; continue; }
      (groups[kind] ||= []).push({ key, ...r });
    }
    let n = 0;
    for (const [kind, items] of Object.entries(groups)) {
      const t = TABLES[kind];
      for (let i = 0; i < items.length; i += 500) {
        const chunk = items.slice(i, i + 500);
        await call(`/rest/v1/${t.table}?on_conflict=${t.conflict}`, {
          method: 'POST', body: chunk.map((c) => c.row), prefer: 'resolution=merge-duplicates,return=minimal',
        });
        // Clear only what was sent unchanged; edits made during the request stay queued.
        for (const c of chunk) {
          const again = rowFor(kind, c.key);
          if (!again || again.ts === c.ts) delete store.state.outbox[c.key];
        }
        n += chunk.length;
      }
    }
    store.save();
    return n;
  }

  async function pull() {
    let changed = 0;
    for (const [kind, t] of Object.entries(TABLES)) {
      const cursor = cfg.cursors[kind] || EPOCH;
      let offset = 0;
      let newest = cursor;
      for (;;) {
        const rows = await call(
          `/rest/v1/${t.table}?select=*&server_ts=gte.${encodeURIComponent(cursor)}&order=server_ts.asc&limit=1000&offset=${offset}`,
        );
        for (const row of rows) {
          if (mergeRemote(store.state, kind, row)) changed++;
          if (row.server_ts > newest) newest = row.server_ts;
        }
        if (rows.length < 1000) break;
        offset += 1000;
      }
      cfg.cursors[kind] = newest;
    }
    persist();
    if (changed) store.save();
    return changed;
  }

  async function syncNow() {
    if (!api.signedIn) return;
    if (running) return running;
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      emit({ state: 'offline', message: 'Offline. Changes are saved on this phone and will sync later.' });
      return;
    }
    emit({ state: 'syncing', message: 'Syncing...' });
    running = (async () => {
      try {
        await pull();
        const sent = await push();
        cfg.lastSync = new Date().toISOString();
        persist();
        emit({ state: 'ok', message: '', sent });
      } catch (e) {
        if (status.state !== 'signed-out') emit({ state: 'error', message: e.message || String(e) });
      } finally {
        running = null;
      }
    })();
    return running;
  }

  const api = {
    get config() { return cfg; },
    get status() { return status; },
    get configured() { return Boolean(cfg.url && cfg.key); },
    get signedIn() { return Boolean(cfg.url && cfg.key && cfg.session?.refresh_token); },
    onStatus(fn) { listeners.add(fn); return () => listeners.delete(fn); },

    configure(url, key) {
      const changed = url !== cfg.url || key !== cfg.key;
      cfg.url = url.trim();
      cfg.key = key.trim();
      if (changed) { cfg.session = null; cfg.cursors = {}; }
      persist();
      emit({ state: 'idle', message: '' });
    },
    async sendCode(email) {
      cfg.email = email.trim();
      persist();
      const redirect = typeof location !== 'undefined' ? `?redirect_to=${encodeURIComponent(location.origin + location.pathname)}` : '';
      await call(`/auth/v1/otp${redirect}`, { method: 'POST', auth: false, body: { email: cfg.email, create_user: true } });
    },
    async verify(code) {
      const d = await call('/auth/v1/verify', {
        method: 'POST', auth: false, body: { type: 'email', email: cfg.email, token: code.trim() },
      });
      saveSession(d);
      // A new sign-in pulls everything and re-sends anything only this device has.
      cfg.cursors = {};
      markAllDirty();
      persist();
      emit({ state: 'idle', message: '' });
      return syncNow();
    },
    // Magic-link fallback: the email link lands on the app with tokens in the URL hash.
    async acceptHash(hash) {
      const p = new URLSearchParams(hash.replace(/^#/, ''));
      if (!p.get('access_token') || !api.configured) return false;
      const session = {
        access_token: p.get('access_token'), refresh_token: p.get('refresh_token'),
        expires_in: Number(p.get('expires_in')) || 3600,
      };
      saveSession(session);
      try {
        const user = await call('/auth/v1/user');
        cfg.session.user_id = user.id;
        cfg.cursors = {};
        markAllDirty();
        persist();
        syncNow();
        return true;
      } catch (e) {
        emit({ state: 'error', message: e.message });
        return false;
      }
    },
    async signOut() {
      try { if (cfg.session) await call('/auth/v1/logout', { method: 'POST', retry: false }); } catch { /* offline is fine */ }
      cfg.session = null;
      cfg.cursors = {};
      persist();
      emit({ state: 'signed-out', message: '' });
    },
    async deleteRemote() {
      for (const t of Object.values(TABLES)) {
        await call(`/rest/v1/${t.table}?user_id=eq.${cfg.session.user_id}`, { method: 'DELETE', prefer: 'return=minimal' });
      }
      cfg.cursors = {};
      persist();
    },
    syncNow,
    push,
    pull,
  };

  function markAllDirty() {
    const st = store.state;
    for (const [date, d] of Object.entries(st.days)) {
      if (d.sessionTs) st.outbox[`day|${date}`] = 1;
      for (const exId of Object.keys(d.entries)) st.outbox[`log|${date}|${exId}`] = 1;
    }
    for (const id of Object.keys(st.milestones)) st.outbox[`ms|${id}`] = 1;
    if (st.settings.ts) st.outbox.settings = 1;
    store.save();
  }

  return api;
}
