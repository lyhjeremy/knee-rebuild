// One shared countdown for holds, rest between sets and timed blocks.
// Time is measured against the clock, so it stays right if the phone sleeps.

let ctx = null;
export function unlockAudio() {
  try {
    ctx ||= new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === 'suspended') ctx.resume();
  } catch { ctx = null; }
}
function beep(freq = 880, dur = 0.12, gain = 0.25) {
  if (!ctx) return;
  const t = ctx.currentTime;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.frequency.value = freq;
  g.gain.setValueAtTime(gain, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(ctx.destination);
  o.start(t);
  o.stop(t + dur + 0.02);
}

export function createTimer(el) {
  let steps = [], idx = 0, endAt = 0, left = 0, paused = false, iv = null, onDone = null, title = '', lastWhole = null;
  let lock = null;

  async function wake(on) {
    try {
      if (on && !lock && 'wakeLock' in navigator) lock = await navigator.wakeLock.request('screen');
      if (!on && lock) { await lock.release(); lock = null; }
    } catch { lock = null; }
  }
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && iv && !paused) { lock = null; wake(true); }
  });

  const fmt = (s) => {
    s = Math.max(0, Math.ceil(s));
    return s >= 60 ? `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}` : `${s}`;
  };

  function paint() {
    if (!steps.length) { el.hidden = true; document.body.classList.remove('timer-on'); return; }
    const st = steps[idx];
    const remaining = paused ? left : (endAt - Date.now()) / 1000;
    el.hidden = false;
    document.body.classList.add('timer-on');
    el.dataset.kind = st.kind;
    el.innerHTML = `
      <div class="tb-text">
        <span class="tb-title">${title}</span>
        <span class="tb-label">${st.label}${steps.length > 1 ? ` <span class="tb-step">${idx + 1}/${steps.length}</span>` : ''}</span>
      </div>
      <span class="tb-time" aria-live="off">${fmt(remaining)}</span>
      <div class="tb-buttons">
        <button type="button" data-t="add" aria-label="Add 15 seconds">+15</button>
        <button type="button" data-t="${paused ? 'resume' : 'pause'}" aria-label="${paused ? 'Resume' : 'Pause'}">${paused ? '&#9654;' : '&#10073;&#10073;'}</button>
        <button type="button" data-t="skip" aria-label="Skip">&#9197;</button>
        <button type="button" data-t="stop" aria-label="Stop">&#10005;</button>
      </div>`;
  }

  function enter(i) {
    idx = i;
    endAt = Date.now() + steps[i].secs * 1000;
    lastWhole = null;
    paint();
  }

  function tick() {
    if (paused || !steps.length) return;
    const remaining = (endAt - Date.now()) / 1000;
    const whole = Math.ceil(remaining);
    if (whole !== lastWhole) {
      if (whole <= 3 && whole > 0 && steps[idx].kind !== 'block') beep(660, 0.08, 0.15);
      lastWhole = whole;
      paint();
    }
    if (remaining <= 0) {
      const finished = steps[idx];
      if (idx + 1 < steps.length) {
        beep(finished.kind === 'ready' || finished.kind === 'switch' ? 990 : 880, 0.18);
        enter(idx + 1);
      } else {
        beep(880, 0.15); setTimeout(() => beep(1175, 0.25), 180);
        const cb = onDone;
        stop();
        cb?.(finished);
      }
    }
  }

  function start(newSteps, opts = {}) {
    unlockAudio();
    steps = newSteps.filter((s) => s.secs > 0);
    if (!steps.length) return;
    title = opts.title || '';
    onDone = opts.onDone || null;
    paused = false;
    clearInterval(iv);
    iv = setInterval(tick, 200);
    wake(true);
    enter(0);
  }
  function stop() {
    clearInterval(iv);
    iv = null;
    steps = [];
    onDone = null;
    wake(false);
    paint();
  }

  el.addEventListener('click', (e) => {
    const b = e.target.closest('button[data-t]');
    if (!b) return;
    unlockAudio();
    const t = b.dataset.t;
    if (t === 'pause') { left = (endAt - Date.now()) / 1000; paused = true; }
    if (t === 'resume') { endAt = Date.now() + left * 1000; paused = false; }
    if (t === 'add') { if (paused) left += 15; else endAt += 15000; }
    if (t === 'skip') { if (paused) { left = 0; paused = false; } endAt = Date.now(); tick(); return; }
    if (t === 'stop') { stop(); return; }
    paint();
  });

  return { start, stop, get running() { return steps.length > 0; } };
}
