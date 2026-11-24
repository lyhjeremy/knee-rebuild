import {
  EXERCISES, SESSIONS, SCHEDULE, DAY_NAMES, PHASES, MILESTONES, NOTE_OPTIONS, RULES, CATEGORIES, phaseItems,
} from './data.js';
import {
  createStore, iso, addDays, parseISO, mondayOf, phaseFor, sessionIdFor, prescription, defaultSets,
  readyToProgress, dayProgress, weekSummary, seriesOf, metricOf, historyOf, lastEntryBefore, allMilestonesMet,
  emptyState, STATE_KEY, itemsFor, itemFor as storeItemFor, parseSid, estimateMinutes, restSeconds, checkin,
  sorenessRising, milestoneHints,
} from './store.js';
import { createSync } from './sync.js';
import { PHOTOS, GIFS } from './media.js';
import { figureSVG, isSinglePose, animatedSVG, isAnimated, startAnimations } from './figures.js';
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
const itemOf = (date, exId) => storeItemFor(store.state, date, exId);
const sessionLabel = (raw) => { const { sid, cap } = parseSid(raw); return `${SESSIONS[sid]?.name || 'Rest'}${cap ? ' (easier)' : ''}`; };
const scale = (attrs, value, warnAbove = 4) => `<div class="scale" role="group">${Array.from({ length: 11 }, (_, n) =>
  `<button type="button" ${attrs} data-n="${n}" aria-pressed="${value === n}" class="${n > warnAbove ? 'high' : ''}">${n}</button>`).join('')}</div>`;
const demoUrl = (exId) => store.state.settings.demoLinks?.[exId] || `https://www.youtube.com/results?search_query=${encodeURIComponent(EXERCISES[exId].demo)}`;

function setsSummary(ex, entry) {
  const ok = (entry?.sets || []).filter((s) => s.ok);
  if (!ok.length) return '';
  if (ex.mode === 'minutes') return `${ok[0].v} min`;
  if (ex.lr) {
    const f = (a) => (a.every((v) => v === a[0]) ? `${a.length} x ${a[0]}` : a.join(', '));
    const u2 = ex.mode === 'time' ? ' s' : '';
    return `L ${f(ok.map((x) => x.v))}${u2} · R ${f(ok.map((x) => x.vr ?? x.v))}${u2}`;
  }
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
  if (a === 'physio') return { name: 'physio' };
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
  else if (r.name === 'physio') view.innerHTML = renderPhysio();
  attachCharts(view);
  startAnimations(view);
  document.querySelectorAll('.tabbar a').forEach((a) => {
    const tab = a.dataset.tab;
    const on = tab === r.name || (tab === 'today' && r.name === 'ex') || (tab === 'plan' && (r.name === 'settings' || r.name === 'physio'));
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
  const { raw, sid, cap, session: s, items: list } = itemsFor(st, date);
  const ph = phaseFor(st, date);
  const prog = dayProgress(st, date);
  const entries = st.days[date]?.entries || {};
  const scheduled = SCHEDULE[parseISO(date).getDay()];
  const mins = list.length ? estimateMinutes(list, s.kind, st.settings) : 0;
  const rows = list.map((it, i) => {
    const ex = EXERCISES[it.ex];
    const e = entries[it.ex];
    const state = entryState(e);
    const ready = readyToProgress(st, it.ex, date, it);
    const sub = state === 'done' || state === 'partial' ? setsSummary(ex, e) : prescription(ex, it);
    const filler = ex.inRests && s.kind === 'home' && state !== 'done' ? ' · fit into rests' : '';
    return `<li><a class="ex-row is-${state}" href="#/ex/${it.ex}/${date}">
      <span class="status" aria-hidden="true">${state === 'done' ? '&#10003;' : state === 'skipped' ? '&#10005;' : i + 1}</span>
      <span class="ex-main"><span class="ex-name">${esc(ex.name)}</span>
      <span class="ex-sub">${state === 'skipped' ? 'Not done' : esc(sub)}${e?.pain != null ? ` · pain ${e.pain}` : ''}${filler}</span></span>
      ${ready ? '<span class="tag">Ready to progress</span>' : ''}
      <span class="chev" aria-hidden="true">&#8250;</span></a></li>`;
  }).join('');
  const cyc = entries.cycling;
  const firstTodo = list.find((it) => !['done', 'skipped'].includes(entryState(entries[it.ex])) && !EXERCISES[it.ex].inRests)
    || list.find((it) => !['done', 'skipped'].includes(entryState(entries[it.ex])));
  const before = ph.week < 1;
  const daily = checkin(st, 'daily', date) || {};
  const rising = sorenessRising(st, date);
  const mon = mondayOf(date);
  const weekly = checkin(st, 'weekly', mon) || {};
  const showWeekly = parseISO(date).getDay() === 0;
  const options = Object.entries(SESSIONS).map(([id, x]) => `<option value="${id}" ${id === raw ? 'selected' : ''}>${esc(x.name)}${id === scheduled ? ' (scheduled)' : ''}</option>`);
  if (ph.n > 1 && s.items.length) options.push(`<option value="${sid}@1" ${cap ? 'selected' : ''}>${esc(s.name)}, easier</option>`);
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
    ${date <= today() ? `<section class="card checkin">
      <div class="row-between"><h2>Morning check</h2>${daily.stairs != null && daily.soreness != null ? '<span class="tag">Done</span>' : '<span class="muted small">Two taps</span>'}</div>
      <p class="scale-label">Pain on stairs</p>${scale(`data-action="ck" data-kind="daily" data-date="${date}" data-field="stairs"`, daily.stairs, 3)}
      <p class="scale-label">Knee soreness this morning</p>${scale(`data-action="ck" data-kind="daily" data-date="${date}" data-field="soreness"`, daily.soreness, 3)}
    </section>` : ''}
    ${rising ? `<div class="callout warn"><strong>Morning soreness has gone up two days running.</strong> Your rule says to scale back today:
      ${ph.n > 1 && !cap ? 'switch to the easier version, or drop one set from each exercise.' : 'drop one set from each exercise, or skip the hardest ones.'}
      ${ph.n > 1 && !cap && s.items.length ? `<br><button type="button" class="btn small secondary" data-action="easier" data-date="${date}">Use the easier version today</button>` : ''}</div>` : ''}
    <section class="card">
      <div class="session-head">
        <div>
          <p class="eyebrow">${esc(s.name)}${mins ? ` · about ${mins} min` : ''}${raw !== scheduled ? (cap ? ' · easier' : ' · swapped') : ''}</p>
          <h2>${esc(s.title)}</h2>
        </div>
        ${prog.total ? ring(prog.done, prog.total) : ''}
      </div>
      ${list.length ? `<ol class="ex-list">${rows}</ol>` : '<p class="muted">Rest day. Easy cycling is fine if you feel like it.</p>'}
      ${s.kind === 'home' && list.some((it) => EXERCISES[it.ex].inRests) ? '<p class="muted small">Exercises marked "fit into rests" are light: do a set during another exercise\'s rest.</p>' : ''}
      <div class="row-between">
        <label class="select-label">Session
          <select data-action="switch-session" data-date="${date}">${options.join('')}</select>
        </label>
        ${firstTodo ? `<a class="btn primary" href="#/ex/${firstTodo.ex}/${date}">${prog.touched ? 'Continue' : 'Start'}</a>` : ''}
      </div>
    </section>
    ${showWeekly ? weeklyCard(mon, weekly) : ''}
    <section class="card">
      <a class="ex-row is-${entryState(cyc)}" href="#/ex/cycling/${date}">
        <span class="status" aria-hidden="true">${cyc?.done ? '&#10003;' : '&#9711;'}</span>
        <span class="ex-main"><span class="ex-name">Easy indoor cycling</span>
        <span class="ex-sub">${cyc?.done ? esc(setsSummary(EXERCISES.cycling, cyc)) : 'Optional, any day. Finish by 8 p.m.'}</span></span>
        <span class="chev" aria-hidden="true">&#8250;</span></a>
    </section>
    <p class="rule">${esc(RULES.effort)}</p>`;
}

function weeklyCard(mon, w) {
  const done = ['steps', 'walkPain', 'calfL', 'calfR'].every((k) => w[k] != null && w[k] !== '');
  return `<section class="card" id="weekly">
    <div class="row-between"><h2>Weekly check</h2>${done ? '<span class="tag">Done</span>' : '<span class="muted small">About a minute</span>'}</div>
    <p class="muted small">Week of ${shortDate(mon)}.</p>
    <form data-form="weekly" data-week="${mon}" class="form-grid">
      <label>Average daily steps<input name="steps" inputmode="numeric" value="${esc(w.steps ?? '')}" placeholder="e.g. 7500"></label>
      <label>Pain on longest walk (0 to 10)<input name="walkPain" inputmode="numeric" value="${esc(w.walkPain ?? '')}"></label>
      <label>Left calf girth, cm<input name="calfL" inputmode="decimal" value="${esc(w.calfL ?? '')}"></label>
      <label>Right calf girth, cm<input name="calfR" inputmode="decimal" value="${esc(w.calfR ?? '')}"></label>
      <button class="btn primary span2">${done ? 'Update' : 'Save'}</button>
    </form>
    <p class="muted small">Measure each calf at its widest point, standing, at the same time of day each week.</p>
  </section>`;
}

function ring(done, total) {
  const r = 18, c = 2 * Math.PI * r, f = total ? done / total : 0;
  return `<div class="ring" role="img" aria-label="${done} of ${total} done">
    <svg viewBox="0 0 44 44"><circle class="ring-bg" cx="22" cy="22" r="${r}"/>
    ${f > 0 ? `<circle class="ring-fg" cx="22" cy="22" r="${r}" stroke-dasharray="${(c * f).toFixed(1)} ${c.toFixed(1)}" transform="rotate(-90 22 22)"/>` : ''}</svg>
    <span>${done}/${total}</span></div>`;
}

// ---------- Exercise detail + log ----------
function mediaBlock(exId) {
  const photos = PHOTOS[exId] || [];
  const gifs = GIFS[exId] || [];
  if (!photos.length && !gifs.length) return '';
  const gifHtml = gifs.map((gif) => `<figure class="media-item gif">
      <img src="${esc(gif.url)}" alt="${esc(gif.alt)}" width="180" height="180" loading="lazy" decoding="async" onerror="this.closest('figure').hidden=true">
      <figcaption><strong>${esc(gif.label)}</strong>${gif.note ? `<br>${esc(gif.note)}` : ''}<br><span class="credit">3D animation: <a href="https://exercisedb.dev/" target="_blank" rel="noopener">ExerciseDB</a>, loads online</span></figcaption></figure>`).join('');
  const photoHtml = photos.map((p) => `<figure class="media-item">
      <img src="${esc(p.src)}" alt="${esc(p.alt)}" loading="lazy" decoding="async">
      <figcaption>${p.note ? `${esc(p.note)}<br>` : ''}<span class="credit">Photo: ${esc(p.author)}, <a href="${esc(p.page)}" target="_blank" rel="noopener">wger.de</a>, <a href="${esc(p.license.url)}" target="_blank" rel="noopener">${esc(p.license.name)}</a></span></figcaption></figure>`).join('');
  return `<section class="card media"><h2>${gifs.length && !photos.length ? 'Human-figure demo' : photos.length && !gifs.length ? 'Real-person demo' : 'Human demos'}</h2>${gifHtml}${photoHtml}</section>`;
}
function figureBlock(exId, ex) {
  if (!isAnimated(exId)) {
    return `<figure class="figure-card">${figureSVG(exId, { label: `${ex.name}: position to hold` })}
      <figcaption>Hold this position. Green marks the working area.</figcaption></figure>`;
  }
  const loop = exId === 'cycling' || exId === 'easy-walk';
  return `<figure class="figure-card">
      ${animatedSVG(exId, { label: `${ex.name}, animated` })}
      <figcaption>${loop ? 'Moving at an easy pace.' : 'Moving at the exercise tempo.'} Tap to pause. Green marks the working area.</figcaption>
      ${loop ? '' : `<div class="keyframes"><p class="eyebrow">Key positions</p>${figureSVG(exId, { label: `${ex.name}: start and finish positions` })}
        <div class="keyframe-labels"><span>1 ${exId === 'short-foot' ? 'Relaxed' : 'Start'}</span><span>2 ${exId === 'short-foot' ? 'Arch domed' : 'Finish'}</span></div></div>`}
    </figure>`;
}

function currentSets(exId, date) {
  const st = store.state;
  const e = st.days[date]?.entries?.[exId];
  if (e?.sets?.length) return e.sets.map((s) => ({ ...s }));
  return defaultSets(st, exId, date, itemOf(date, exId));
}

function renderExercise(exId, date) {
  const st = store.state;
  const ex = EXERCISES[exId];
  const { session: s, items: list } = itemsFor(st, date);
  const item = itemOf(date, exId);
  const pos = list.findIndex((it) => it.ex === exId);
  const e = st.days[date]?.entries?.[exId];
  const sets = currentSets(exId, date);
  const prev = lastEntryBefore(st, exId, date);
  const ready = readyToProgress(st, exId, date, item);
  const unit = unitOf(ex);
  const tempo = ex.tempo ? ` · Tempo: ${ex.tempo}` : '';
  const stepper = (i, f, val, label) => `<div class="stepper">${label ? `<span class="side">${label}</span>` : ''}
        <button type="button" data-action="step" data-i="${i}" data-f="${f}" data-d="-1" aria-label="Less">&#8722;</button>
        <input type="number" inputmode="numeric" min="0" data-field="${f}" data-i="${i}" value="${esc(val)}" aria-label="${label ? (label === 'L' ? 'Left ' : 'Right ') : ''}${ex.mode === 'reps' ? 'reps' : 'seconds'}">
        <button type="button" data-action="step" data-i="${i}" data-f="${f}" data-d="1" aria-label="More">+</button>
        <span class="unit">${unit}</span></div>`;
  const setRows = sets.map((set, i) => ex.lr ? `
    <div class="set-row lr ${set.ok ? 'is-ok' : ''}">
      <span class="set-n" aria-label="Set ${i + 1}">${i + 1}</span>
      <div class="lr-steppers">${stepper(i, 'v', set.v, 'L')}${stepper(i, 'vr', set.vr ?? set.v, 'R')}</div>
      ${ex.mode === 'time' ? `<button type="button" class="icon-btn" data-action="hold" data-i="${i}" aria-label="Start timer">&#9654;</button>` : ''}
      <button type="button" class="tick" data-action="tick" data-i="${i}" aria-pressed="${set.ok ? 'true' : 'false'}" aria-label="Set ${i + 1} done">&#10003;</button>
    </div>` : `
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
  const nextItem = pos >= 0 ? list.slice(pos + 1).find((it) => entryState(st.days[date]?.entries?.[it.ex]) !== 'done') : null;
  const kneeFlag = (x) => x && (x.pain >= 3 || (x.notes || []).includes('Knee discomfort'));
  const tkeWarn = ex.caution === 'tke' && (kneeFlag(e) || kneeFlag(prev?.entry));
  return `
    <header class="detail-top">
      <a class="back" href="#/day/${date}">&#8249; ${dayLabel(date)}</a>
      ${pos >= 0 ? `<span class="muted small">${pos + 1} of ${list.length} · ${esc(s.name)}</span>` : ''}
    </header>
    <p class="eyebrow">${esc(CATEGORIES[ex.cat])}</p>
    <h1 class="ex-title">${esc(ex.name)}</h1>
    <p class="rx">${esc(prescription(ex, item))}${esc(tempo)}</p>
    ${item.note ? `<p class="note">${esc(item.note)}</p>` : ''}
    ${tkeWarn ? `<div class="callout warn"><strong>You logged knee pain on this exercise.</strong> Skip it until your physio has checked it. If you do it, straighten only to just short of locked.</div>` : ''}
    ${ready ? `<div class="callout"><strong>Ready to progress.</strong> The last two sessions were clean. ${esc(ex.progress)}</div>` : ''}
    ${figureBlock(exId, ex)}
    ${mediaBlock(exId)}
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
      ${ex.lr ? `<p class="muted small">Log left (L) and right (R) separately.${ex.mode === 'time' ? ' The timer runs left, then right.' : ''}</p>`
        : ex.perSide && ex.mode !== 'minutes' ? `<p class="muted small">${ex.mode === 'time' ? 'Seconds' : 'Reps'} are per side. The timer runs both sides.</p>` : ''}
      ${ex.inRests && s.kind === 'home' ? '<p class="muted small">Light work: fit its sets into other exercises\' rests.</p>' : ''}
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
  const secsR = ex.lr ? Number(sets[i].vr ?? sets[i].v) : secs;
  if (!secs && !secsR) return;
  let steps;
  if (ex.mode === 'minutes') steps = [{ label: ex.name, secs, kind: 'block' }];
  else if (ex.perSide) {
    steps = [
      { label: 'Get ready', secs: 3, kind: 'ready' },
      { label: ex.lr ? 'Left side' : 'First side', secs, kind: 'hold' },
      { label: 'Switch sides', secs: 5, kind: 'switch' },
      { label: ex.lr ? 'Right side' : 'Second side', secs: secsR, kind: 'hold' },
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
  const st = store.state;
  const { session, items } = itemsFor(st, date);
  const ex = EXERCISES[exId];
  const secs = restSeconds(ex, session.kind, st.settings);
  let title = ex.name;
  if (session.kind === 'home' && !ex.inRests) {
    const filler = items.find((it) => EXERCISES[it.ex].inRests && entryState(st.days[date]?.entries?.[it.ex]) !== 'done');
    if (filler) title = `Use it for: ${EXERCISES[filler.ex].name}`;
  }
  timer.start([{ label: 'Rest', secs, kind: 'rest' }], { title });
}

function rerenderIf(exId, date) {
  const r = route();
  if (r.name === 'ex' && r.exId === exId && r.date === date) render();
}

// ---------- History ----------
function renderHistory() {
  const st = store.state;
  const mon = mondayOf(today());
  const weeks = Array.from({ length: 8 }, (_, k) => weekSummary(st, addDays(mon, -7 * k))).filter((w, k) => k === 0 || addDays(w.monday, 6) >= st.settings.startDate);
  const cur = weeks[0];
  const logged = Object.keys(EXERCISES).map((id) => ({ id, h: historyOf(st, id) })).filter((x) => x.h.length);
  const byCat = {};
  for (const x of logged) (byCat[EXERCISES[x.id].cat] ||= []).push(x);
  const fmtPain = (w) => (w.avgPain == null ? '-' : w.avgPain.toFixed(1));
  return `
    <header class="top"><h1>History</h1>${syncPill()}</header>
    ${goalsSection(st)}
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
      <h2>${weeks.length > 1 ? `Last ${weeks.length} weeks` : 'This week'}</h2>
      <table class="table">
        <thead><tr><th>Week of</th><th class="num">Sessions</th><th class="num">Avg pain</th><th class="num">Cycling</th></tr></thead>
        <tbody>${weeks.map((w) => `<tr><td>${shortDate(w.monday)}</td><td class="num">${w.completed}/${w.planned}${w.partial ? ` <span class="muted">+${w.partial}</span>` : ''}</td><td class="num">${fmtPain(w)}</td><td class="num">${w.cycling ? `${w.cycling} min` : '-'}</td></tr>`).join('')}</tbody>
      </table>
      <p class="muted small">Sessions counts days where every exercise was done; +n is days partly done. Sunday's optional session isn't counted as planned, nor are days before the plan started. Choosing the easier version still counts.</p>
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

function goalsSection(st) {
  const daily = Object.entries(st.checkins || {}).filter(([k]) => k.startsWith('daily|')).map(([k, v]) => ({ date: k.slice(6), ...v.data })).sort((a, b) => a.date.localeCompare(b.date));
  const weekly = Object.entries(st.checkins || {}).filter(([k]) => k.startsWith('weekly|')).map(([k, v]) => ({ date: k.slice(7), ...v.data })).sort((a, b) => a.date.localeCompare(b.date));
  const pts = (rows, f, unit, label) => rows.filter((r) => r[f] != null && r[f] !== '' && !Number.isNaN(Number(r[f])))
    .map((r) => ({ date: r.date, value: Number(r[f]), tip: `${shortDate(r.date)}: ${label} ${r[f]}${unit}` }));
  const stairs = pts(daily, 'stairs', '', 'stairs');
  const sore = pts(daily, 'soreness', '', 'soreness');
  const steps = pts(weekly, 'steps', '', 'steps');
  const walk = pts(weekly, 'walkPain', '', 'walk pain');
  const calfL = pts(weekly, 'calfL', ' cm', 'left');
  const calfR = pts(weekly, 'calfR', ' cm', 'right');
  const sunday = addDays(mondayOf(today()), 6);
  if (!stairs.length && !sore.length && !steps.length && !calfL.length) {
    return `<section class="card"><h2>Goals</h2><p class="muted">Do the morning check on the Today tab, and the weekly check on Sundays. Your stairs pain, soreness, steps and calf girth trends show here.</p>
      <a class="link" href="#/day/${sunday}">Open this week's weekly check</a></section>`;
  }
  const block = (title, p, opts) => (p.length ? `<h3>${title}</h3>${lineChart(p, opts)}` : '');
  return `<section class="card"><h2>Goals</h2>
    <p class="muted small">Goal: stairs and walking at 0 to 1, calves a little slimmer, then 10,000 steps without next-day soreness.</p>
    ${block('Pain on stairs, each morning <span class="muted small">(0 to 10)</span>', stairs, { label: 'Stairs pain', fixed: [0, 10] })}
    ${block('Knee soreness, each morning <span class="muted small">(0 to 10)</span>', sore, { label: 'Morning soreness', fixed: [0, 10] })}
    ${block('Pain on longest walk, weekly <span class="muted small">(0 to 10)</span>', walk, { label: 'Walk pain', fixed: [0, 10] })}
    ${block('Average daily steps, weekly', steps, { label: 'Steps' })}
    ${block('Left calf girth <span class="muted small">(cm)</span>', calfL, { unit: 'cm', label: 'Left calf girth' })}
    ${block('Right calf girth <span class="muted small">(cm)</span>', calfR, { unit: 'cm', label: 'Right calf girth' })}
    <a class="link" href="#/day/${sunday}">Open this week's weekly check</a>
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
    ${ex.lr ? `<section class="card">
      <h2>${esc(m.label.replace(' per side', ''))}, left <span class="muted small">(${m.unit})</span></h2>
      ${lineChart(pts, { unit: m.unit, label: `${ex.name}: left` })}
      <h2 class="mt">Right <span class="muted small">(${m.unit})</span></h2>
      ${lineChart(series.map((p) => ({ date: p.date, value: p.valueR, tip: `${shortDate(p.date)}: ${p.valueR} ${m.unit}` })), { unit: m.unit, label: `${ex.name}: right` })}
    </section>` : `<section class="card">
      <h2>${esc(m.label)} <span class="muted small">(${m.unit})</span></h2>
      ${lineChart(pts, { unit: m.unit, label: `${ex.name}: ${m.label}` })}
    </section>`}
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
  const hints = milestoneHints(st);
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
        const { raw, session: s, items } = itemsFor(st, date);
        const mins = items.length ? estimateMinutes(items, s.kind, st.settings) : 0;
        const p = dayProgress(st, date);
        const mark = p.total && p.done === p.total ? '&#10003;' : p.touched ? '&#9680;' : '';
        return `<li><a class="ex-row ${date === t ? 'is-today' : ''}" href="#/day/${date}">
          <span class="dow">${DAY_NAMES[dow].slice(0, 3)}</span>
          <span class="ex-main"><span class="ex-name">${esc(sessionLabel(raw))}${raw !== SCHEDULE[dow] && !parseSid(raw).cap ? ' <span class="muted small">(swapped)</span>' : ''}</span><span class="ex-sub">${esc(s.title)}${mins ? ` · about ${mins} min` : ''}</span></span>
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
          <span>${esc(m.name)}${v?.achieved && v.date ? `<span class="muted small"> · ${shortDate(v.date)}</span>` : ''}${hints[m.id] ? `<span class="hint">Your logs show ${esc(hints[m.id].replace(/(\d{4}-\d{2}-\d{2})/g, (d) => shortDate(d)))}. Tap to tick it if you agree.</span>` : ''}</span></button></li>`;
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
    <a class="card settings-link" href="#/physio"><span><strong>For my physio</strong><br><span class="muted small">Plan, changes, trends and questions on one printable page</span></span><span class="chev">&#8250;</span></a>
    <a class="card settings-link" href="#/settings"><span><strong>Sync, backup and timer</strong><br><span class="muted small">${sync.signedIn ? `Syncing as ${esc(sync.config.email || 'you')}` : 'Logs are only on this device'}</span></span><span class="chev">&#8250;</span></a>
    <p class="disclaimer">A planning framework, not medical advice. Review it with your physio before changing the plan.</p>`;
}

// ---------- For my physio ----------
const PLAN_CHANGES = [
  ['Terminal knee extensions (band and cable)', 'Straighten only to just short of locked, never past straight. The app warns and suggests skipping them if knee pain is logged on them.'],
  ['Calf raises', 'Two-leg bodyweight raises in Phase 1. From Phase 2, single-leg bodyweight raises building toward 3 x 20 each side (the running milestone), on Home A days, plus bent-knee raises for the lower calf on Home B days. No added weight.'],
  ['Tibialis (toe) raises', '2 x 15 on Home A days, for the shin.'],
  ['Phase versions', 'Phase 2 (weeks 5 to 8): single-leg glute bridge 3 x 10, a 20 cm step for step-downs, wall sits 45 to 60 s, longer walks with gentle hills. Phase 3: two-leg pogo hops from week 9, single-leg hops from week 11, low volume.'],
  ['Rest periods', '30 s after light floor work, 60 s after knee work at home, 90 s at the gym. Foot, balance and light calf work done during other rests.'],
  ['Tracking', 'Morning check of stairs pain and knee soreness; weekly steps, walk pain and calf girth. Left and right logged separately for step-downs, single-leg calf raises, balance and hops.'],
];
const PHYSIO_QUESTIONS = [
  'Terminal knee extensions: I stop just short of locking the knee. Is that the right range for my knee, or should I avoid end-range work for now?',
  'Squat and leg press: given my knee history, how deep is safe for the goblet squat and leg press?',
  'Calves and shin: does single-leg bodyweight calf work from week 5, plus toe raises, suit my calf tightness and shin strain?',
  'Hopping from week 9 and walk-run from about week 13: do these timelines look right?',
  'Flat feet: do I need proper arch supports or a running shoe assessment?',
  'If pain stops improving, is a new scan worth it?',
];

function renderPhysio() {
  const st = store.state;
  const t = today();
  const ph = phaseFor(st, t);
  const mon = mondayOf(t);
  const weeks = Array.from({ length: 4 }, (_, k) => weekSummary(st, addDays(mon, -7 * k)));
  const done = weeks.reduce((a, w) => a + w.completed, 0), planned = weeks.reduce((a, w) => a + w.planned, 0);
  const daily = Object.entries(st.checkins || {}).filter(([k]) => k.startsWith('daily|')).map(([k, v]) => ({ date: k.slice(6), ...v.data })).sort((a, b) => a.date.localeCompare(b.date));
  const weekly = Object.entries(st.checkins || {}).filter(([k]) => k.startsWith('weekly|')).map(([k, v]) => ({ date: k.slice(7), ...v.data })).sort((a, b) => a.date.localeCompare(b.date));
  const avg = (rows, f) => { const v = rows.map((r) => r[f]).filter((x) => x != null); return v.length ? (v.reduce((a, b) => a + b, 0) / v.length).toFixed(1) : '-'; };
  const firstWk = daily.slice(0, 7), lastWk = daily.slice(-7);
  const calf = (r) => (r ? `L ${r.calfL ?? '-'} / R ${r.calfR ?? '-'} cm (${shortDate(r.date)})` : '-');
  const painful = Object.keys(EXERCISES).map((id) => ({ id, n: historyOf(st, id).filter((x) => x.entry.pain >= 4 || (x.entry.notes || []).includes('Knee discomfort')).length })).filter((x) => x.n);
  const sessions = ['homeA', 'homeB', 'homeC', 'gym1'];
  return `
    <header class="detail-top no-print"><a class="back" href="#/plan">&#8249; Plan</a>
      <button type="button" class="btn small secondary" data-action="print">Print or save PDF</button></header>
    <h1>Knee Rebuild: plan review</h1>
    <p class="muted">For my physio · ${longDate(t)} · Week ${Math.max(ph.week, 0)}, Phase ${ph.n} (${esc(ph.phase.name)})</p>
    <section class="card">
      <h2>Where I am</h2>
      <table class="table"><tbody>
        <tr><td>Sessions done, last 4 weeks</td><td class="num">${done} of ${planned}</td></tr>
        <tr><td>Stairs pain, first week of checks</td><td class="num">${avg(firstWk, 'stairs')}</td></tr>
        <tr><td>Stairs pain, latest week</td><td class="num">${avg(lastWk, 'stairs')}</td></tr>
        <tr><td>Morning knee soreness, first week</td><td class="num">${avg(firstWk, 'soreness')}</td></tr>
        <tr><td>Morning knee soreness, latest week</td><td class="num">${avg(lastWk, 'soreness')}</td></tr>
        <tr><td>Average daily steps, latest week</td><td class="num">${weekly.length ? esc(weekly[weekly.length - 1].steps ?? '-') : '-'}</td></tr>
        <tr><td>Calf girth, first</td><td class="num">${calf(weekly[0])}</td></tr>
        <tr><td>Calf girth, latest</td><td class="num">${calf(weekly[weekly.length - 1])}</td></tr>
        <tr><td>Milestones met</td><td class="num">${MILESTONES.filter((m) => st.milestones[m.id]?.achieved).length} of ${MILESTONES.length}</td></tr>
      </tbody></table>
      ${painful.length ? `<p class="small"><strong>Exercises where I logged pain of 4 or more, or knee discomfort:</strong> ${painful.map((x) => `${esc(EXERCISES[x.id].name)} (${x.n})`).join(', ')}.</p>` : '<p class="small muted">No exercise logged with pain of 4 or more so far.</p>'}
      <p class="small muted">Stairs and soreness are 0 to 10, from my morning checks.</p>
    </section>
    <section class="card">
      <h2>Changes made to the original plan</h2>
      <ul class="rules">${PLAN_CHANGES.map(([a, b]) => `<li><strong>${esc(a)}.</strong> ${esc(b)}</li>`).join('')}</ul>
    </section>
    <section class="card">
      <h2>Questions for you</h2>
      <ol class="rules">${PHYSIO_QUESTIONS.map((q) => `<li>${esc(q)}</li>`).join('')}</ol>
    </section>
    <section class="card">
      <h2>Current plan, Phase ${ph.n}</h2>
      <p class="small">Mon Home A · Tue Gym · Wed Home B · Thu Home A · Fri Gym · Sat Home B · Sun rest or Home C. Easy indoor cycling on any day.</p>
      ${sessions.map((sid) => {
        const items = phaseItems(sid, ph.n, Math.max(1, ph.week));
        return `<h3>${esc(SESSIONS[sid].name === 'Gym day 1' ? 'Gym days' : SESSIONS[sid].name)}: ${esc(SESSIONS[sid].title)}</h3>
          <table class="table"><tbody>${items.map((it) => `<tr><td>${esc(EXERCISES[it.ex].name)}</td><td class="num">${esc(prescription(EXERCISES[it.ex], it))}</td></tr>`).join('')}</tbody></table>`;
      }).join('')}
      <h3>Rules I follow</h3>
      <ul class="rules"><li>${esc(RULES.effort)}</li><li>${esc(RULES.pain)}</li><li>${esc(RULES.gymLoad)}</li></ul>
    </section>
    <p class="disclaimer">Made with the Knee Rebuild app. A planning framework, not medical advice.</p>`;
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
        <label>Light floor work<select data-setting="restLight">${[20, 30, 45].map((n) => `<option value="${n}" ${st.settings.restLight === n ? 'selected' : ''}>${n} s</option>`).join('')}</select></label>
        <label>Knee work at home<select data-setting="restHome">${[45, 60, 75, 90].map((n) => `<option value="${n}" ${st.settings.restHome === n ? 'selected' : ''}>${n} s</option>`).join('')}</select></label>
        <label>Gym sets<select data-setting="restGym">${[60, 90, 120, 150].map((n) => `<option value="${n}" ${st.settings.restGym === n ? 'selected' : ''}>${n} s</option>`).join('')}</select></label>
      </div>
      <p class="muted small">The rest timer starts when you tick a set and suggests a light exercise to fit in. It beeps if the ringer is on.</p>
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
      const f = b.dataset.f === 'vr' ? 'vr' : 'v';
      updateSets(exId, date, (s) => { s[i][f] = Math.max(0, (Number(s[i][f] ?? s[i].v) || 0) + inc * Number(b.dataset.d)); });
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
      const { items } = itemsFor(store.state, date);
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
      store.setEntry(date, exId, { done: null, pain: null, notes: [], sets: defaultSets(store.state, exId, date, itemOf(date, exId)) });
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
  if (act === 'ck') {
    const cur = checkin(store.state, b.dataset.kind, b.dataset.date)?.[b.dataset.field];
    const n = Number(b.dataset.n);
    store.setCheckin(b.dataset.kind, b.dataset.date, { [b.dataset.field]: cur === n ? null : n });
    return render();
  }
  if (act === 'easier') {
    const { sid } = itemsFor(store.state, b.dataset.date);
    store.setDaySession(b.dataset.date, `${sid}@1`);
    return render();
  }
  if (act === 'print') { window.print(); return; }
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
    if (k === 'restHome' || k === 'restGym' || k === 'restLight') v = Number(v);
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
    if (f.dataset.form === 'weekly') {
      const num = (v) => { const x = String(v ?? '').replace(',', '.').trim(); return x === '' || Number.isNaN(Number(x)) ? null : Number(x); };
      const walkPain = num(data.walkPain);
      if (walkPain != null && (walkPain < 0 || walkPain > 10)) throw new Error('Walk pain should be 0 to 10');
      store.setCheckin('weekly', f.dataset.week, { steps: num(data.steps), walkPain, calfL: num(data.calfL), calfR: num(data.calfR) });
      ui.msg = '';
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
    const next = { v: 1, settings: d.settings, days: d.days, milestones: d.milestones || {}, checkins: d.checkins || {}, outbox: {} };
    // Queue everything so a signed-in device pushes the restored data.
    for (const [date, day] of Object.entries(next.days)) {
      if (day.sessionTs) next.outbox[`day|${date}`] = 1;
      for (const exId of Object.keys(day.entries || {})) next.outbox[`log|${date}|${exId}`] = 1;
    }
    for (const id of Object.keys(next.milestones)) next.outbox[`ms|${id}`] = 1;
    for (const key of Object.keys(next.checkins)) next.outbox[`ck|${key}`] = 1;
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
