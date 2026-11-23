import {
  EXERCISES, SESSIONS, SCHEDULE, DAY_NAMES, PHASES, MILESTONES, NOTE_OPTIONS, RULES, CATEGORIES,
} from './data.js';
import {
  createStore, iso, addDays, parseISO, mondayOf, phaseFor, sessionIdFor, prescription, defaultSets,
  readyToProgress, dayProgress, weekSummary, seriesOf, metricOf, historyOf, lastEntryBefore, allMilestonesMet,
  emptyState, STATE_KEY,
} from './store.js';
import { createSync } from './sync.js';
import { figureSVG, isSinglePose } from './figures.js';
import { createTimer, unlockAudio } from './timer.js';
import { lineChart, attachCharts, shortDate } from './charts.js';

const store = createStore(localStorage);
const sync = createSync(store, localStorage);
const timer = createTimer(document.getElementById('timerbar'));
const view = document.getElementById('view');
const ui = { demoEdit: false, confirm: null, codeSent: false, msg: '' };
let lastRoute = '';

// ---------- helpers ----------
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const today = () => iso();
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const longDate = (s) => { const d = parseISO(s); return `${DAY_NAMES[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}`; };
const dayLabel = (s) => (s === today() ? 'Today' : s === addDays(today(), -1) ? 'Yesterday' : s === addDays(today(), 1) ? 'Tomorrow' : DAY_NAMES[parseISO(s).getDay()]);
const unitOf = (ex) => (ex.mode === 'reps' ? 'reps' : ex.mode === 'time' ? 's' : 'min');
const itemFor = (sid, exId) => SESSIONS[sid]?.items.find((it) => it.ex === exId) || {};
const demoUrl = (exId) => store.state.settings.demoLinks?.[exId] || `https://www.youtube.com/results?search_query=${encodeURIComponent(EXERCISES[exId].demo)}`;
const restFor = (sid) => (SESSIONS[sid]?.kind === 'gym' ? store.state.settings.restGym : store.state.settings.restHome) || 60;

function setsSummary(ex, entry) {
  const ok = (entry?.sets || []).filter((s) => s.ok);
  if (!ok.length) return '';
  if (ex.mode === 'minutes') return `${ok[0].v} min`;
  const vals = ok.map((s) => s.v);
  const same = vals.every((v) => v === vals[0]);
  const u = ex.mode === 'time' ? ' s' : '';
  let out = same ? `${ok.length} x ${vals[0]}${u}` : `${vals.join(', ')}${u}`;
  const kgs = ok.map((s) => s.kg).filter((k) => k != null && k !== '');
  if (kgs.length) out += ` at ${Math.max(...kgs.map(Number))} kg`;
  return out;
}
function entryState(e) {
  if (!e) return 'todo';
  if (e.done === true) return 'done';
  if (e.done === false) return 'skipped';
  return e.sets?.some((s) => s.ok) ? 'partial' : 'todo';
}

// ---------- routing ----------
function route() {
  const h = location.hash.replace(/^#\/?/, '');
  const [a, b, c] = h.split('/');
  if (a === 'ex' && EXERCISES[b]) return { name: 'ex', exId: b, date: c || today() };
  if (a === 'day' && /^\d{4}-\d{2}-\d{2}$/.test(b || '')) return { name: 'today', date: b };
  if (a === 'history') return { name: 'history', exId: EXERCISES[b] ? b : null };
  if (a === 'plan') return { name: 'plan' };
  if (a === 'settings') return { name: 'settings' };
  return { name: 'today', date: today() };
}

function render() {
  const r = route();
  const key = location.hash;
  const sameRoute = key === lastRoute;
  const y = window.scrollY;
  if (r.name === 'today') view.innerHTML = renderToday(r.date);
  else if (r.name === 'ex') view.innerHTML = renderExercise(r.exId, r.date);
  else if (r.name === 'history') view.innerHTML = r.exId ? renderExerciseHistory(r.exId) : renderHistory();
  else if (r.name === 'plan') view.innerHTML = renderPlan();
  else if (r.name === 'settings') view.innerHTML = renderSettings();
  attachCharts(view);
  document.querySelectorAll('.tabbar a').forEach((a) => {
    const tab = a.dataset.tab;
    const on = tab === r.name || (tab === 'today' && r.name === 'ex') || (tab === 'plan' && r.name === 'settings');
    a.setAttribute('aria-current', on ? 'page' : 'false');
  });
  window.scrollTo(0, sameRoute ? y : 0);
  lastRoute = key;
}

// ---------- Today ----------
function syncPill() {
  if (!sync.signedIn) return '';
  const s = sync.status.state;
  const pending = Object.keys(store.state.outbox).length;
  const text = s === 'syncing' ? 'Syncing' : s === 'error' ? 'Sync error' : s === 'offline' ? 'Offline' : pending ? `${pending} to sync` : 'Synced';
  return `<a class="pill pill-${s === 'error' ? 'bad' : pending || s === 'offline' ? 'wait' : 'ok'}" href="#/settings">${text}</a>`;
}

function renderToday(date) {
  const st = store.state;
  const sid = sessionIdFor(st, date);
  const s = SESSIONS[sid];
  const ph = phaseFor(st, date);
  const prog = dayProgress(st, date);
  const entries = st.days[date]?.entries || {};
  const scheduled = SCHEDULE[parseISO(date).getDay()];
  const items = s.items.map((it, i) => {
    const ex = EXERCISES[it.ex];
    const e = entries[it.ex];
    const state = entryState(e);
    const ready = readyToProgress(st, it.ex, date, it);
    const sub = state === 'done' || state === 'partial' ? setsSummary(ex, e) : prescription(ex, it);
    return `<li><a class="ex-row is-${state}" href="#/ex/${it.ex}/${date}">
      <span class="status" aria-hidden="true">${state === 'done' ? '&#10003;' : state === 'skipped' ? '&#10005;' : i + 1}</span>
      <span class="ex-main"><span class="ex-name">${esc(ex.name)}</span>
      <span class="ex-sub">${state === 'skipped' ? 'Not done' : esc(sub)}${e?.pain != null ? ` · pain ${e.pain}` : ''}</span></span>
      ${ready ? '<span class="tag">Ready to progress</span>' : ''}
      <span class="chev" aria-hidden="true">&#8250;</span></a></li>`;
  }).join('');
  const cyc = entries.cycling;
  const firstTodo = s.items.find((it) => !['done', 'skipped'].includes(entryState(entries[it.ex])));
  const before = ph.week < 1;
  return `
    <header class="top">
      <div class="daynav">
        <a class="round" href="#/day/${addDays(date, -1)}" aria-label="Previous day">&#8249;</a>
        <div class="daynav-title"><h1>${dayLabel(date)}</h1>
          <p>${longDate(date)}${before ? '' : ` · Week ${ph.week} · Phase ${ph.n}`}</p></div>
        <a class="round" href="#/day/${addDays(date, 1)}" aria-label="Next day">&#8250;</a>
      </div>
      ${syncPill()}
    </header>
    ${before ? `<p class="note">The plan starts on ${longDate(st.settings.startDate)}. Change it on the Plan tab.</p>` : ''}
    ${date !== today() ? `<p class="center"><a class="link" href="#/day/${today()}">Back to today</a></p>` : ''}
    <section class="card">
      <div class="session-head">
        <div>
          <p class="eyebrow">${esc(s.name)}${s.mins ? ` · ${esc(s.mins)}` : ''}${sid !== scheduled ? ' · swapped' : ''}</p>
          <h2>${esc(s.title)}</h2>
        </div>
        ${prog.total ? ring(prog.done, prog.total) : ''}
      </div>
      ${s.items.length ? `<ol class="ex-list">${items}</ol>` : '<p class="muted">Rest day. Easy cycling is fine if you feel like it.</p>'}
      <div class="row-between">
        <label class="select-label">Session
          <select data-action="switch-session" data-date="${date}">
            ${Object.entries(SESSIONS).map(([id, x]) => `<option value="${id}" ${id === sid ? 'selected' : ''}>${esc(x.name)}${id === scheduled ? ' (scheduled)' : ''}</option>`).join('')}
          </select>
        </label>
        ${firstTodo ? `<a class="btn primary" href="#/ex/${firstTodo.ex}/${date}">${prog.touched ? 'Continue' : 'Start'}</a>` : ''}
      </div>
    </section>
    <section class="card">
      <a class="ex-row is-${entryState(cyc)}" href="#/ex/cycling/${date}">
        <span class="status" aria-hidden="true">${cyc?.done ? '&#10003;' : '&#9711;'}</span>
        <span class="ex-main"><span class="ex-name">Easy indoor cycling</span>
        <span class="ex-sub">${cyc?.done ? esc(setsSummary(EXERCISES.cycling, cyc)) : 'Optional, any day. Finish by 8 p.m.'}</span></span>
        <span class="chev" aria-hidden="true">&#8250;</span></a>
    </section>
    <p class="rule">${esc(RULES.effort)}</p>`;
}

function ring(done, total) {
  const r = 18, c = 2 * Math.PI * r, f = total ? done / total : 0;
  return `<div class="ring" role="img" aria-label="${done} of ${total} done">
    <svg viewBox="0 0 44 44"><circle class="ring-bg" cx="22" cy="22" r="${r}"/>
    ${f > 0 ? `<circle class="ring-fg" cx="22" cy="22" r="${r}" stroke-dasharray="${(c * f).toFixed(1)} ${c.toFixed(1)}" transform="rotate(-90 22 22)"/>` : ''}</svg>
    <span>${done}/${total}</span></div>`;
}

// ---------- Exercise detail + log ----------
function currentSets(exId, date) {
  const st = store.state;
  const e = st.days[date]?.entries?.[exId];
  if (e?.sets?.length) return e.sets.map((s) => ({ ...s }));
  return defaultSets(st, exId, date, itemFor(sessionIdFor(st, date), exId));
}

function renderExercise(exId, date) {
  const st = store.state;
  const ex = EXERCISES[exId];
  const sid = sessionIdFor(st, date);
  const s = SESSIONS[sid];
  const item = itemFor(sid, exId);
  const pos = s.items.findIndex((it) => it.ex === exId);
  const e = st.days[date]?.entries?.[exId];
  const sets = currentSets(exId, date);
  const prev = lastEntryBefore(st, exId, date);
  const ready = readyToProgress(st, exId, date, item);
  const unit = unitOf(ex);
  const tempo = ex.tempo ? ` · Tempo: ${ex.tempo}` : '';
  const setRows = sets.map((set, i) => `
    <div class="set-row ${set.ok ? 'is-ok' : ''}">
      <span class="set-n" aria-label="${ex.mode === 'minutes' ? 'Time' : `Set ${i + 1}`}">${ex.mode === 'minutes' ? '&#9201;' : i + 1}</span>
      <div class="stepper">
        <button type="button" data-action="step" data-i="${i}" data-d="-1" aria-label="Less">&#8722;</button>
        <input type="number" inputmode="numeric" min="0" data-field="v" data-i="${i}" value="${esc(set.v)}" aria-label="${ex.mode === 'reps' ? 'Reps' : ex.mode === 'time' ? 'Seconds' : 'Minutes'}">
        <button type="button" data-action="step" data-i="${i}" data-d="1" aria-label="More">+</button>
        ${ex.weighted ? '' : `<span class="unit">${unit}</span>`}
      </div>
      ${ex.weighted ? `<label class="kg"><input type="text" inputmode="decimal" data-field="kg" data-i="${i}" value="${esc(set.kg ?? '')}" placeholder="0" aria-label="Weight in kg"><span>kg</span></label>` : ''}
      ${ex.mode === 'time' || ex.mode === 'minutes' ? `<button type="button" class="icon-btn" data-action="hold" data-i="${i}" aria-label="Start timer">&#9654;</button>` : ''}
      <button type="button" class="tick" data-action="tick" data-i="${i}" aria-pressed="${set.ok ? 'true' : 'false'}" aria-label="Set ${i + 1} done">&#10003;</button>
    </div>`).join('');
  const nextItem = pos >= 0 ? s.items.slice(pos + 1).find((it) => entryState(st.days[date]?.entries?.[it.ex]) !== 'done') : null;
  return `
    <header class="detail-top">
      <a class="back" href="#/day/${date}">&#8249; ${dayLabel(date)}</a>
      ${pos >= 0 ? `<span class="muted small">${pos + 1} of ${s.items.length} · ${esc(s.name)}</span>` : ''}
    </header>
    <p class="eyebrow">${esc(CATEGORIES[ex.cat])}</p>
    <h1 class="ex-title">${esc(ex.name)}</h1>
    <p class="rx">${esc(prescription(ex, item))}${esc(tempo)}</p>
    ${ready ? `<div class="callout"><strong>Ready to progress.</strong> The last two sessions were clean. ${esc(ex.progress)}</div>` : ''}
    <figure class="figure-card">${figureSVG(exId, { label: `${ex.name}: start and finish positions` })}
      <figcaption>${exId === 'short-foot' ? 'Relaxed, then arch domed.' : isSinglePose(exId) ? 'Hold this position. Green marks the working area.' : 'Start, then finish. Green marks the working area.'}</figcaption></figure>
    <div class="demo-row">
      <a class="btn secondary" href="${esc(demoUrl(exId))}" target="_blank" rel="noopener">${st.settings.demoLinks?.[exId] ? 'Watch my demo' : 'Watch demos on YouTube'}</a>
      <button type="button" class="link" data-action="edit-demo">${st.settings.demoLinks?.[exId] ? 'Change link' : 'Use my own link'}</button>
    </div>
    ${ui.demoEdit ? `<form class="demo-form" data-form="demo">
      <input type="url" name="url" placeholder="Paste a video link" value="${esc(st.settings.demoLinks?.[exId] || '')}">
      <button class="btn small primary">Save</button>
      ${st.settings.demoLinks?.[exId] ? '<button type="button" class="btn small ghost" data-action="clear-demo">Reset</button>' : ''}
    </form>` : ''}
    <section class="card">
      <h2>How to do it</h2>
      <ol class="steps">${ex.steps.map((x) => `<li>${esc(x)}</li>`).join('')}</ol>
      <p class="note">${esc(ex.note)}</p>
      <p class="muted small">Next step when it gets easy: ${esc(ex.progress)}</p>
    </section>
    <section class="card log">
      <div class="row-between"><h2>Log</h2>${e && entryState(e) !== 'todo' ? '<button type="button" class="link" data-action="clear">Clear</button>' : ''}</div>
      ${prev ? `<p class="muted small">Last time (${shortDate(prev.date)}): ${esc(setsSummary(ex, prev.entry) || (prev.entry.done === false ? 'not done' : 'no sets ticked'))}${prev.entry.pain != null ? `, pain ${prev.entry.pain}` : ''}</p>` : ''}
      ${ex.perSide && ex.mode !== 'minutes' ? `<p class="muted small">${ex.mode === 'time' ? 'Seconds' : 'Reps'} are per side. The timer runs both sides.</p>` : ''}
      ${ex.weighted ? '<p class="muted small cols">Reps and weight per set</p>' : ''}<div class="sets">${setRows}</div>
      ${ex.mode !== 'minutes' ? `<div class="set-tools"><button type="button" class="link" data-action="add-set">Add a set</button>
        ${sets.length > 1 ? '<button type="button" class="link" data-action="remove-set">Remove a set</button>' : ''}</div>` : ''}
      <h3>Pain during this exercise <span class="muted small">(optional)</span></h3>
      <div class="scale" role="group" aria-label="Pain 0 to 10">
        ${Array.from({ length: 11 }, (_, n) => `<button type="button" data-action="pain" data-n="${n}" aria-pressed="${e?.pain === n}" class="${n > 4 ? 'high' : ''}">${n}</button>`).join('')}
      </div>
      <p class="muted small">Stop or scale back above 4.</p>
      <h3>How it went <span class="muted small">(optional)</span></h3>
      <div class="chips">${NOTE_OPTIONS.map((n) => `<button type="button" data-action="note" data-note="${esc(n)}" aria-pressed="${(e?.notes || []).includes(n)}">${esc(n)}</button>`).join('')}</div>
      <div class="actions">
        <button type="button" class="btn primary wide" data-action="done">${e?.done === true ? 'Saved as done' : nextItem ? 'Done, next exercise' : 'Done'}</button>
        <button type="button" class="btn ghost" data-action="not-done">${e?.done === false ? 'Marked not done' : 'Not done'}</button>
      </div>
    </section>
    <p class="rule">${esc(RULES.effort)} ${esc(RULES.rest)}</p>`;
}

function updateSets(exId, date, fn) {
  const sets = currentSets(exId, date);
  fn(sets);
  const sid = sessionIdFor(store.state, date);
  store.setEntry(date, exId, { sets, session: sid });
}

function startHold(exId, date, i) {
  const ex = EXERCISES[exId];
  const sets = currentSets(exId, date);
  const secs = ex.mode === 'minutes' ? Number(sets[i].v) * 60 : Number(sets[i].v);
  if (!secs) return;
  let steps;
  if (ex.mode === 'minutes') steps = [{ label: ex.name, secs, kind: 'block' }];
  else if (ex.perSide) {
    steps = [
      { label: 'Get ready', secs: 3, kind: 'ready' },
      { label: 'First side', secs, kind: 'hold' },
      { label: 'Switch sides', secs: 5, kind: 'switch' },
      { label: 'Second side', secs, kind: 'hold' },
    ];
  } else steps = [{ label: 'Get ready', secs: 3, kind: 'ready' }, { label: 'Hold', secs, kind: 'hold' }];
  timer.start(steps, {
    title: `${ex.name}${ex.mode === 'minutes' ? '' : ` · set ${i + 1}`}`,
    onDone: () => {
      updateSets(exId, date, (s) => { s[i].ok = true; });
      rerenderIf(exId, date);
      const left = currentSets(exId, date).some((s) => !s.ok);
      if (left && ex.mode !== 'minutes') startRest(exId, date);
    },
  });
}

function startRest(exId, date) {
  const sid = sessionIdFor(store.state, date);
  timer.start([{ label: 'Rest', secs: restFor(sid), kind: 'rest' }], { title: EXERCISES[exId].name });
}

function rerenderIf(exId, date) {
  const r = route();
  if (r.name === 'ex' && r.exId === exId && r.date === date) render();
}

// ---------- History ----------
function renderHistory() {
  const st = store.state;
  const mon = mondayOf(today());
  const weeks = Array.from({ length: 8 }, (_, k) => weekSummary(st, addDays(mon, -7 * k)));
  const cur = weeks[0];
  const logged = Object.keys(EXERCISES).map((id) => ({ id, h: historyOf(st, id) })).filter((x) => x.h.length);
  const byCat = {};
  for (const x of logged) (byCat[EXERCISES[x.id].cat] ||= []).push(x);
  const fmtPain = (w) => (w.avgPain == null ? '-' : w.avgPain.toFixed(1));
  return `
    <header class="top"><h1>History</h1>${syncPill()}</header>
    <section class="card">
      <p class="eyebrow">This week · from ${shortDate(mon)}</p>
      <div class="stats">
        <div><span class="big">${cur.completed}<small>/${cur.planned}</small></span><span class="muted small">sessions done</span></div>
        <div><span class="big">${fmtPain(cur)}</span><span class="muted small">average pain${cur.painN ? ` (${cur.painN})` : ''}</span></div>
        <div><span class="big">${cur.cycling}</span><span class="muted small">cycling min</span></div>
      </div>
      ${cur.partial ? `<p class="muted small">${cur.partial} more session${cur.partial > 1 ? 's' : ''} partly done.</p>` : ''}
    </section>
    <section class="card">
      <h2>Last 8 weeks</h2>
      <table class="table">
        <thead><tr><th>Week of</th><th class="num">Sessions</th><th class="num">Avg pain</th><th class="num">Cycling</th></tr></thead>
        <tbody>${weeks.map((w) => `<tr><td>${shortDate(w.monday)}</td><td class="num">${w.completed}/${w.planned}${w.partial ? ` <span class="muted">+${w.partial}</span>` : ''}</td><td class="num">${fmtPain(w)}</td><td class="num">${w.cycling ? `${w.cycling} min` : '-'}</td></tr>`).join('')}</tbody>
      </table>
      <p class="muted small">Sessions counts days where every exercise was done; +n is days partly done. Sunday's optional session isn't counted as planned.</p>
    </section>
    <section class="card">
      <h2>By exercise</h2>
      ${logged.length ? Object.entries(CATEGORIES).filter(([c]) => byCat[c]).map(([c, name]) => `
        <p class="eyebrow">${esc(name)}</p>
        <ul class="plain-list">${byCat[c].map(({ id, h }) => {
          const last = h[h.length - 1];
          return `<li><a class="ex-row" href="#/history/${id}"><span class="ex-main"><span class="ex-name">${esc(EXERCISES[id].name)}</span>
            <span class="ex-sub">${h.length} log${h.length > 1 ? 's' : ''} · last ${shortDate(last.date)}: ${esc(setsSummary(EXERCISES[id], last.entry) || 'not done')}</span></span>
            <span class="chev" aria-hidden="true">&#8250;</span></a></li>`;
        }).join('')}</ul>`).join('') : '<p class="muted">Nothing logged yet. Finish an exercise on the Today tab and it shows up here.</p>'}
    </section>`;
}

function renderExerciseHistory(exId) {
  const st = store.state;
  const ex = EXERCISES[exId];
  const m = metricOf(ex);
  const series = seriesOf(st, exId);
  const pts = series.map((p) => ({
    date: p.date, value: p.value,
    tip: `${shortDate(p.date)}: ${p.value} ${m.unit}${p.pain != null ? ` · pain ${p.pain}` : ''}`,
  }));
  const painPts = series.filter((p) => p.pain != null).map((p) => ({ date: p.date, value: p.pain, tip: `${shortDate(p.date)}: pain ${p.pain}` }));
  const rows = historyOf(st, exId).slice().reverse();
  return `
    <header class="detail-top"><a class="back" href="#/history">&#8249; History</a></header>
    <p class="eyebrow">${esc(CATEGORIES[ex.cat])}</p>
    <h1 class="ex-title">${esc(ex.name)}</h1>
    <section class="card">
      <h2>${esc(m.label)} <span class="muted small">(${m.unit})</span></h2>
      ${lineChart(pts, { unit: m.unit, label: `${ex.name}: ${m.label}` })}
    </section>
    ${painPts.length ? `<section class="card"><h2>Pain score <span class="muted small">(0 to 10)</span></h2>
      ${lineChart(painPts, { label: `${ex.name}: pain`, fixed: [0, 10] })}</section>` : ''}
    <section class="card">
      <h2>All logs</h2>
      <table class="table">
        <thead><tr><th>Date</th><th>Sets</th><th class="num">Pain</th></tr></thead>
        <tbody>${rows.map(({ date, entry }) => `<tr><td><a class="link" href="#/ex/${exId}/${date}">${shortDate(date)}</a></td>
          <td>${entry.done === false ? '<span class="muted">Not done</span>' : esc(setsSummary(ex, entry))}${(entry.notes || []).length ? `<br><span class="muted small">${esc(entry.notes.join(', '))}</span>` : ''}</td>
          <td class="num">${entry.pain ?? '-'}</td></tr>`).join('')}</tbody>
      </table>
    </section>`;
}

// ---------- Plan ----------
function renderPlan() {
  const st = store.state;
  const t = today();
  const ph = phaseFor(st, t);
  const mon = mondayOf(t);
  const order = [1, 2, 3, 4, 5, 6, 0];
  const met = MILESTONES.filter((m) => st.milestones[m.id]?.achieved).length;
  return `
    <header class="top"><h1>Plan</h1>${syncPill()}</header>
    <section class="card">
      <p class="eyebrow">${ph.week < 1 ? 'Not started' : `Week ${ph.week}`}${ph.manual ? ' · phase set by hand' : ''}</p>
      <h2>Phase ${ph.n}: ${esc(ph.phase.name)}</h2>
      <p>${esc(ph.phase.text)}</p>
      ${ph.waiting ? `<p class="callout">Week 13 or later, but ${MILESTONES.length - met} milestone${MILESTONES.length - met === 1 ? '' : 's'} still open, so you stay in Phase 3 until they're met.</p>` : ''}
      <div class="form-grid">
        <label>Week 1 started<input type="date" data-setting="startDate" value="${esc(st.settings.startDate)}"></label>
        <label>Phase
          <select data-setting="phaseOverride">
            <option value="">Automatic</option>
            ${PHASES.map((p) => `<option value="${p.n}" ${st.settings.phaseOverride === p.n ? 'selected' : ''}>Phase ${p.n}</option>`).join('')}
          </select></label>
      </div>
    </section>
    <section class="card">
      <h2>This week</h2>
      <ul class="plain-list">${order.map((dow, k) => {
        const date = addDays(mon, k);
        const sid = sessionIdFor(st, date);
        const s = SESSIONS[sid];
        const p = dayProgress(st, date);
        const mark = p.total && p.done === p.total ? '&#10003;' : p.touched ? '&#9680;' : '';
        return `<li><a class="ex-row ${date === t ? 'is-today' : ''}" href="#/day/${date}">
          <span class="dow">${DAY_NAMES[dow].slice(0, 3)}</span>
          <span class="ex-main"><span class="ex-name">${esc(s.name)}${sid !== SCHEDULE[dow] ? ' <span class="muted small">(swapped)</span>' : ''}</span><span class="ex-sub">${esc(s.title)}${s.mins ? ` · ${esc(s.mins)}` : ''}</span></span>
          <span class="mark" aria-label="${mark ? 'progress' : ''}">${mark}</span></a></li>`;
      }).join('')}</ul>
      <p class="muted small">Easy indoor cycling can go on any day, ideally finished by 8 p.m.</p>
    </section>
    <section class="card">
      <div class="row-between"><h2>Milestones before running</h2><span class="muted">${met}/${MILESTONES.length}</span></div>
      <ul class="checklist">${MILESTONES.map((m) => {
        const v = st.milestones[m.id];
        return `<li><button type="button" class="check-row" data-action="milestone" data-id="${m.id}" aria-pressed="${Boolean(v?.achieved)}">
          <span class="box" aria-hidden="true">${v?.achieved ? '&#10003;' : ''}</span>
          <span>${esc(m.name)}${v?.achieved && v.date ? `<span class="muted small"> · ${shortDate(v.date)}</span>` : ''}</span></button></li>`;
      }).join('')}</ul>
      ${allMilestonesMet(st) ? '<p class="callout">All milestones met. Phase 4 (walk-run) can start once you reach week 13.</p>' : ''}
    </section>
    <section class="card">
      <h2>Phases</h2>
      <ol class="phases">${PHASES.map((p) => `<li class="${p.n === ph.n ? 'is-current' : ''}"><strong>Phase ${p.n}, ${p.weeks[1] ? `weeks ${p.weeks[0]} to ${p.weeks[1]}` : `from week ${p.weeks[0]}`}: ${esc(p.name)}.</strong> ${esc(p.text)}</li>`).join('')}</ol>
    </section>
    <section class="card">
      <h2>Rules</h2>
      <ul class="rules">
        <li>${esc(RULES.effort)}</li><li>${esc(RULES.pain)}</li><li>${esc(RULES.gymLoad)}</li><li>${esc(RULES.rest)}</li>
      </ul>
      <h3>When running returns</h3>
      <ul class="rules">${RULES.running.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>
    </section>
    <a class="card settings-link" href="#/settings"><span><strong>Sync, backup and timer</strong><br><span class="muted small">${sync.signedIn ? `Syncing as ${esc(sync.config.email || 'you')}` : 'Logs are only on this device'}</span></span><span class="chev">&#8250;</span></a>
    <p class="disclaimer">A planning framework, not medical advice. Review it with your physio before changing the plan.</p>`;
}

// ---------- Settings ----------
function renderSettings() {
  const st = store.state;
  const c = sync.config;
  const stt = sync.status;
  let syncHtml;
  if (!sync.configured) {
    syncHtml = `<p class="muted small">Connect your Supabase project to sync logs across devices. The README has the five-minute setup.</p>
      <form data-form="configure" class="stack">
        <label>Project URL<input name="url" type="url" placeholder="https://xxxx.supabase.co" required autocomplete="off"></label>
        <label>Publishable (anon) key<input name="key" type="text" placeholder="sb_publishable_... or eyJ..." required autocomplete="off" autocapitalize="off" spellcheck="false"></label>
        <button class="btn primary">Save</button>
      </form>`;
  } else if (!sync.signedIn) {
    syncHtml = `<p class="muted small">Project: ${esc(c.url)}</p>
      ${!ui.codeSent ? `<form data-form="send-code" class="stack">
        <label>Email<input name="email" type="email" autocomplete="email" value="${esc(c.email || '')}" required></label>
        <button class="btn primary">Email me a sign-in code</button></form>`
      : `<form data-form="verify" class="stack">
        <p class="small">Code sent to ${esc(c.email)}. It can take a minute to arrive.</p>
        <label>Code from the email<input name="code" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]*" required></label>
        <button class="btn primary">Sign in</button>
        <button type="button" class="link" data-action="code-reset">Use a different email or resend</button></form>`}
      <button type="button" class="link" data-action="unconfigure">Change project</button>`;
  } else {
    const pending = Object.keys(st.outbox).length;
    syncHtml = `<p>Signed in as <strong>${esc(c.email || 'you')}</strong></p>
      <p class="muted small">${c.lastSync ? `Last synced ${new Date(c.lastSync).toLocaleString()}` : 'Not synced yet'}${pending ? ` · ${pending} change${pending > 1 ? 's' : ''} waiting` : ''}</p>
      <div class="actions"><button type="button" class="btn primary" data-action="sync-now">Sync now</button>
      <button type="button" class="btn ghost" data-action="sign-out">Sign out</button></div>`;
  }
  return `
    <header class="detail-top"><a class="back" href="#/plan">&#8249; Plan</a></header>
    <h1>Sync, backup and timer</h1>
    <section class="card">
      <h2>Sync</h2>
      ${stt.message ? `<p class="${stt.state === 'error' || stt.state === 'signed-out' ? 'error' : 'muted'} small">${esc(stt.message)}</p>` : ''}
      ${ui.msg ? `<p class="small">${esc(ui.msg)}</p>` : ''}
      ${syncHtml}
    </section>
    <section class="card">
      <h2>Rest timer</h2>
      <div class="form-grid">
        <label>Home sets<select data-setting="restHome">${[45, 60, 75, 90].map((n) => `<option value="${n}" ${st.settings.restHome === n ? 'selected' : ''}>${n} s</option>`).join('')}</select></label>
        <label>Gym sets<select data-setting="restGym">${[60, 90, 120, 150].map((n) => `<option value="${n}" ${st.settings.restGym === n ? 'selected' : ''}>${n} s</option>`).join('')}</select></label>
      </div>
      <p class="muted small">The rest timer starts when you tick a set. It beeps if the ringer is on.</p>
    </section>
    <section class="card">
      <h2>Backup</h2>
      <p class="muted small">A file with every log, milestone and setting. Save it to Files or iCloud Drive.</p>
      <div class="actions">
        <button type="button" class="btn secondary" data-action="export">Export backup</button>
        <label class="btn secondary file-btn">Import backup<input type="file" accept="application/json,.json" data-action="import" hidden></label>
      </div>
    </section>
    <section class="card">
      <h2>Reset</h2>
      <p class="muted small">Deletes everything on this device and signs out. Synced data stays in Supabase.</p>
      <button type="button" class="btn danger" data-action="reset">${ui.confirm === 'reset' ? 'Tap again to delete' : 'Delete data on this device'}</button>
    </section>`;
}

// ---------- events ----------
view.addEventListener('click', async (e) => {
  const b = e.target.closest('[data-action]');
  if (!b || b.tagName === 'SELECT' || b.tagName === 'INPUT') return;
  const r = route();
  const act = b.dataset.action;
  unlockAudio();
  if (r.name === 'ex') {
    const { exId, date } = r;
    const ex = EXERCISES[exId];
    const i = Number(b.dataset.i);
    if (act === 'step') {
      const inc = ex.mode === 'reps' ? 1 : 5;
      updateSets(exId, date, (s) => { s[i].v = Math.max(0, (Number(s[i].v) || 0) + inc * Number(b.dataset.d)); });
      return render();
    }
    if (act === 'tick') {
      let nowOk = false;
      updateSets(exId, date, (s) => { s[i].ok = !s[i].ok; nowOk = s[i].ok; });
      render();
      if (nowOk && ex.mode !== 'minutes' && currentSets(exId, date).some((s) => !s.ok)) startRest(exId, date);
      return;
    }
    if (act === 'hold') return startHold(exId, date, i);
    if (act === 'add-set') { updateSets(exId, date, (s) => s.push({ ...s[s.length - 1], ok: false })); return render(); }
    if (act === 'remove-set') { updateSets(exId, date, (s) => s.length > 1 && s.pop()); return render(); }
    if (act === 'pain') {
      const cur = store.state.days[date]?.entries?.[exId]?.pain;
      const n = Number(b.dataset.n);
      store.setEntry(date, exId, { pain: cur === n ? null : n, session: sessionIdFor(store.state, date), sets: currentSets(exId, date) });
      return render();
    }
    if (act === 'note') {
      const notes = new Set(store.state.days[date]?.entries?.[exId]?.notes || []);
      const n = b.dataset.note;
      notes.has(n) ? notes.delete(n) : notes.add(n);
      store.setEntry(date, exId, { notes: [...notes], session: sessionIdFor(store.state, date), sets: currentSets(exId, date) });
      return render();
    }
    if (act === 'done') {
      let sets = currentSets(exId, date);
      if (!sets.some((s) => s.ok)) sets = sets.map((s) => ({ ...s, ok: true }));
      store.setEntry(date, exId, { done: true, sets, session: sessionIdFor(store.state, date) });
      if (timer.running) timer.stop();
      const sid = sessionIdFor(store.state, date);
      const items = SESSIONS[sid].items;
      const pos = items.findIndex((it) => it.ex === exId);
      const next = pos >= 0 ? items.slice(pos + 1).find((it) => entryState(store.state.days[date]?.entries?.[it.ex]) !== 'done') : null;
      ui.demoEdit = false;
      location.hash = next ? `#/ex/${next.ex}/${date}` : `#/day/${date}`;
      return;
    }
    if (act === 'not-done') {
      store.setEntry(date, exId, { done: false, sets: currentSets(exId, date), session: sessionIdFor(store.state, date) });
      location.hash = `#/day/${date}`;
      return;
    }
    if (act === 'clear') {
      store.setEntry(date, exId, { done: null, pain: null, notes: [], sets: defaultSets(store.state, exId, date, itemFor(sessionIdFor(store.state, date), exId)) });
      return render();
    }
    if (act === 'edit-demo') { ui.demoEdit = !ui.demoEdit; return render(); }
    if (act === 'clear-demo') {
      const links = { ...store.state.settings.demoLinks };
      delete links[exId];
      store.setSettings({ demoLinks: links });
      ui.demoEdit = false;
      return render();
    }
  }
  if (act === 'milestone') {
    const id = b.dataset.id;
    store.setMilestone(id, !store.state.milestones[id]?.achieved, today());
    return render();
  }
  if (act === 'sync-now') { await sync.syncNow(); return render(); }
  if (act === 'sign-out') { await sync.signOut(); ui.codeSent = false; return render(); }
  if (act === 'code-reset') { ui.codeSent = false; return render(); }
  if (act === 'unconfigure') { sync.configure('', ''); ui.codeSent = false; return render(); }
  if (act === 'export') return exportBackup();
  if (act === 'reset') {
    if (ui.confirm !== 'reset') { ui.confirm = 'reset'; render(); setTimeout(() => { if (ui.confirm === 'reset') { ui.confirm = null; render(); } }, 4000); return; }
    ui.confirm = null;
    await sync.signOut();
    store.replace(emptyState(today()));
    ui.msg = 'All data on this device was deleted.';
    return render();
  }
});

view.addEventListener('change', (e) => {
  const el = e.target;
  const r = route();
  if (el.dataset.action === 'switch-session') {
    store.setDaySession(el.dataset.date, el.value);
    return render();
  }
  if (el.dataset.action === 'import') return importBackup(el.files?.[0]);
  if (el.dataset.setting) {
    const k = el.dataset.setting;
    let v = el.value;
    if (k === 'phaseOverride') v = v ? Number(v) : null;
    if (k === 'restHome' || k === 'restGym') v = Number(v);
    if (k === 'startDate' && !/^\d{4}-\d{2}-\d{2}$/.test(v)) return;
    store.setSettings({ [k]: v });
    return render();
  }
  if (r.name === 'ex' && el.dataset.field) {
    const i = Number(el.dataset.i);
    const f = el.dataset.field;
    const raw = el.value.replace(',', '.').trim();
    updateSets(r.exId, r.date, (s) => { s[i][f] = raw === '' ? (f === 'kg' ? null : 0) : Number(raw); });
    // Same weight for later sets when they are still empty.
    if (f === 'kg' && raw !== '') updateSets(r.exId, r.date, (s) => { for (let j = i + 1; j < s.length; j++) if (s[j].kg == null && !s[j].ok) s[j].kg = Number(raw); });
    render();
  }
});

view.addEventListener('submit', async (e) => {
  e.preventDefault();
  const f = e.target;
  const data = Object.fromEntries(new FormData(f));
  const r = route();
  ui.msg = '';
  try {
    if (f.dataset.form === 'demo' && r.name === 'ex') {
      const url = (data.url || '').trim();
      const links = { ...store.state.settings.demoLinks };
      if (/^https?:\/\//i.test(url)) links[r.exId] = url; else delete links[r.exId];
      store.setSettings({ demoLinks: links });
      ui.demoEdit = false;
    }
    if (f.dataset.form === 'configure') {
      if (!/^https:\/\/.+/i.test(data.url)) throw new Error('The project URL should start with https://');
      sync.configure(data.url, data.key);
    }
    if (f.dataset.form === 'send-code') {
      await sync.sendCode(data.email);
      ui.codeSent = true;
    }
    if (f.dataset.form === 'verify') {
      await sync.verify(data.code);
      ui.codeSent = false;
      ui.msg = 'Signed in. Your logs now sync.';
    }
  } catch (err) {
    ui.msg = `Couldn't do that: ${err.message}`;
  }
  render();
});

// ---------- backup ----------
async function exportBackup() {
  const { outbox, ...rest } = store.state;
  const blob = new Blob([JSON.stringify({ app: 'knee-rebuild', exported: new Date().toISOString(), ...rest }, null, 1)], { type: 'application/json' });
  const name = `knee-rebuild-backup-${today()}.json`;
  const file = new File([blob], name, { type: 'application/json' });
  if (navigator.canShare?.({ files: [file] })) {
    try { await navigator.share({ files: [file], title: name }); return; } catch (err) { if (err.name === 'AbortError') return; }
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

async function importBackup(file) {
  if (!file) return;
  try {
    const d = JSON.parse(await file.text());
    if (d.app !== 'knee-rebuild' || d.v !== 1 || !d.days || !d.settings) throw new Error('This is not a Knee Rebuild backup file.');
    const next = { v: 1, settings: d.settings, days: d.days, milestones: d.milestones || {}, outbox: {} };
    // Queue everything so a signed-in device pushes the restored data.
    for (const [date, day] of Object.entries(next.days)) {
      if (day.sessionTs) next.outbox[`day|${date}`] = 1;
      for (const exId of Object.keys(day.entries || {})) next.outbox[`log|${date}|${exId}`] = 1;
    }
    for (const id of Object.keys(next.milestones)) next.outbox[`ms|${id}`] = 1;
    if (next.settings.ts) next.outbox.settings = 1;
    store.replace(next);
    ui.msg = `Backup restored: ${Object.keys(next.days).length} days of logs.`;
    sync.syncNow();
  } catch (err) {
    ui.msg = `Import failed: ${err.message}`;
  }
  render();
}

// ---------- boot ----------
let syncTimer = null;
store.onChange(() => {
  if (!sync.signedIn) return;
  clearTimeout(syncTimer);
  syncTimer = setTimeout(() => sync.syncNow(), 2500);
});
sync.onStatus((s) => {
  const active = document.activeElement;
  const typing = active && (active.tagName === 'INPUT' || active.tagName === 'SELECT') && view.contains(active);
  if (!typing && (s.state !== 'syncing' || route().name === 'settings')) render();
});
window.addEventListener('hashchange', () => { ui.demoEdit = false; ui.confirm = null; render(); });
window.addEventListener('online', () => sync.syncNow());
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') { sync.syncNow(); if (route().name === 'today') render(); }
});

(async function boot() {
  if (location.hash.includes('access_token=')) {
    const ok = await sync.acceptHash(location.hash);
    ui.msg = ok ? 'Signed in from the email link.' : 'That sign-in link did not work. Try the code instead.';
    history.replaceState(null, '', '#/settings');
  } else if (location.hash.includes('error_description=')) {
    const p = new URLSearchParams(location.hash.slice(1));
    ui.msg = `Sign-in failed: ${p.get('error_description')}`;
    history.replaceState(null, '', '#/settings');
  }
  render();
  sync.syncNow();
  if ('serviceWorker' in navigator && location.protocol === 'https:') {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
  navigator.storage?.persist?.().catch(() => {});
})();

// Exposed for debugging in the console.
window.kneeRebuild = { store, sync, STATE_KEY };
