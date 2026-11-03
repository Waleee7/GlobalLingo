// GlobalLingo v2 — UI wiring. All translation logic lives in translate-core.js; this file only
// connects it to the DOM, the globe, the passport and the browser's on-device APIs.

import { LANGUAGES, BY_CODE, langName } from './languages.js';
import { PHRASEBOOK, PHRASE_IDS } from './phrasebook.js';
import {
  ENGINES, MAX_INPUT_CHARS, MM_DAILY_CHARS, createCache, createMyMemory, createPhrasebook, createQuotaMeter, detectLanguage, translate,
} from './translate-core.js';
import { deviceDetector, findVoice, onDevice, speak, stopSpeaking } from './engines.js';
import { DAILY_GOAL, MILESTONES, dayKey, loadState, rankFor, recordTranslation, saveState, streakInfo } from './rewards.js';
import { createGlobe } from './globe.js';

const $ = (id) => document.getElementById(id);
const root = document.documentElement;

const storage = (() => {
  try { localStorage.setItem('gl2:probe', '1'); localStorage.removeItem('gl2:probe'); return localStorage; } catch { return null; }
})();

const phrasebook = createPhrasebook(PHRASEBOOK, PHRASE_IDS);
const cache = createCache(storage);
const meter = createQuotaMeter(storage);
const myMemory = createMyMemory({ fetchImpl: (...a) => fetch(...a), codes: (c) => BY_CODE[c]?.mm ?? c, meter });
const KNOWN = LANGUAGES.map((l) => l.code);
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');

let state = loadState(storage);
const prefs = (() => { try { return JSON.parse(storage?.getItem('gl2:prefs') ?? '{}'); } catch { return {}; } })();
const params = new URLSearchParams(location.search);
const pickCode = (v, fallback) => (BY_CODE[v] ? v : fallback);

const ui = {
  from: params.get('from') === 'auto' || prefs.from === 'auto' || (!params.get('from') && !prefs.from) ? 'auto' : pickCode(params.get('from') ?? prefs.from, 'auto'),
  to: pickCode(params.get('to') ?? prefs.to, 'es'),
  armed: 'to',
  detected: null,
  busy: false,
  last: null,
  showAll: false,
  globe: null,
};

// ------------------------------------------------------------------ small helpers

const PATTERNS = { tick: 8, tap: 12, success: [10, 40, 16], stamp: [18, 50, 36], error: [30, 60, 30] };
function haptic(kind) {
  if (!state.haptics) return;
  try { navigator.vibrate?.(PATTERNS[kind]); } catch { /* unsupported */ }
}

function toast({ stamp, title, sub, plain = false }) {
  const host = $('toasts');
  while (host.children.length >= 3) host.firstChild.remove();
  const el = document.createElement('div');
  el.className = `toast${stamp ? '' : ' plain'}`;
  if (stamp) { const s = document.createElement('div'); s.className = 'toast-stamp'; s.textContent = stamp; el.append(s); }
  const body = document.createElement('div');
  const t = document.createElement('div'); t.className = 'toast-title'; t.textContent = title;
  body.append(t);
  if (sub) { const s = document.createElement('div'); s.className = 'toast-sub'; s.textContent = sub; body.append(s); }
  el.append(body);
  host.append(el);
  setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 200); }, plain ? 2600 : 3800);
}

const fmtCoord = (lat, lon) => `${Math.abs(lat).toFixed(1)}°${lat >= 0 ? 'N' : 'S'} ${Math.abs(lon).toFixed(1)}°${lon >= 0 ? 'E' : 'W'}`;
const effFrom = () => (ui.from === 'auto' ? ui.detected?.lang ?? null : ui.from);
const savePrefs = () => { try { storage?.setItem('gl2:prefs', JSON.stringify({ from: ui.from, to: ui.to })); } catch { /* ignore */ } };

// ------------------------------------------------------------------ language controls

function fillSelects() {
  const from = $('from-lang'); const to = $('to-lang');
  const opt = (l) => Object.assign(document.createElement('option'), { value: l.code, textContent: matchMedia('(max-width: 900px)').matches ? l.name : `${l.name} · ${l.native}` });
  from.append(Object.assign(document.createElement('option'), { value: 'auto', textContent: 'Auto-detect' }));
  for (const l of LANGUAGES) { from.append(opt(l)); to.append(opt(l)); }
}

function renderRoute() {
  $('from-lang').value = ui.from;
  $('to-lang').value = ui.to;
  const fromEff = effFrom();
  const fc = $('from-code');
  fc.textContent = ui.from === 'auto' ? (fromEff ? fromEff.toUpperCase() : 'AUTO') : ui.from.toUpperCase();
  fc.toggleAttribute('data-auto', fc.textContent.length > 2);
  $('to-code').textContent = ui.to.toUpperCase();
  $('to-code').toggleAttribute('data-auto', ui.to.length > 2);
  const armed = ui.armed;
  $('gate-from').classList.toggle('is-armed', armed === 'from');
  $('gate-to').classList.toggle('is-armed', armed === 'to');
  fc.setAttribute('aria-pressed', String(armed === 'from'));
  $('to-code').setAttribute('aria-pressed', String(armed === 'to'));
  fc.setAttribute('aria-label', `Source language ${ui.from === 'auto' ? 'automatic' : langName(ui.from)}. Press so globe picks set the source.`);
  $('to-code').setAttribute('aria-label', `Target language ${langName(ui.to)}. Press so globe picks set the target.`);
  $('armed-hint').replaceChildren();
  $('armed-hint').append('Tap the globe to set ', Object.assign(document.createElement('b'), { textContent: armed === 'to' ? 'To' : 'From' }), '. Tap a code to switch sides.');
}

function renderReadout() {
  const code = ui.armed === 'from' && effFrom() ? effFrom() : ui.to;
  const l = BY_CODE[code];
  $('readout-kicker').textContent = ui.armed === 'from' && effFrom() ? 'Translating from' : 'Translating into';
  const name = $('readout-name'); name.textContent = l.native; name.lang = code; name.dir = l.rtl ? 'rtl' : 'ltr';
  const c = ui.globe?.locate(ui.focusCountry ?? l.home);
  $('readout-sub').textContent = `${ui.focusCountry ?? l.home}${c ? ` · ${fmtCoord(c.lat, c.lon)}` : ''}`;
}

function syncGlobe(selected) {
  ui.globe?.setState({ from: effFrom(), to: ui.to, selected });
}

function renderChips() {
  const to = ui.to;
  const ess = $('ess-lang'); ess.textContent = langName(to);
  let src = effFrom() ?? 'en';
  if (src === to) src = to === 'en' ? 'es' : 'en';
  const items = phrasebook.list(src, to);
  const list = $('chips'); list.replaceChildren();
  const visible = ui.showAll ? items : items.slice(0, 8);
  for (const it of visible) {
    const li = document.createElement('li');
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'chip';
    b.dataset.src = src; b.dataset.index = it.index;
    const a = document.createElement('span'); a.className = 'chip-src'; a.textContent = it.source; a.lang = src;
    const t = document.createElement('span'); t.className = 'chip-tgt'; t.textContent = it.text; t.lang = to;
    if (BY_CODE[to].rtl) t.dir = 'rtl';
    b.append(a, t);
    li.append(b); list.append(li);
  }
  if (items.length > 8) {
    const li = document.createElement('li');
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'chip-more'; b.id = 'chip-more';
    b.textContent = ui.showAll ? 'Show fewer' : `Show all ${items.length}`;
    b.setAttribute('aria-expanded', String(ui.showAll));
    li.append(b); list.append(li);
  }
}

let engineTimer = 0;
function updateEngines() {
  clearTimeout(engineTimer);
  engineTimer = setTimeout(async () => {
    const from = effFrom() ?? 'en';
    const set = (id, ok, text) => { const li = $(id); li.dataset.ok = String(ok); li.querySelector('.eng-state').textContent = text; };

    if (!onDevice.supported()) set('eng-device', false, 'not in this browser (try desktop Chrome)');
    else if (from === ui.to) set('eng-device', false, 'pick two languages');
    else {
      const a = await onDevice.availability(from, ui.to);
      const label = { available: 'ready · private', downloadable: 'model downloads on first use', downloading: 'model downloading', unavailable: `no model for ${from.toUpperCase()}→${ui.to.toUpperCase()}` }[a] ?? a;
      set('eng-device', a !== 'unavailable', label);
    }

    const m = meter.state();
    if (!navigator.onLine) set('eng-mm', false, 'offline');
    else if (m.blocked) set('eng-mm', false, 'daily limit reached');
    else set('eng-mm', true, `online · ~${meter.remaining().toLocaleString()} chars left today`);

    set('eng-book', true, `${phrasebook.coverage(ui.to)} phrases in ${langName(ui.to)}`);
    refreshListen();
  }, 120);
}

let voiceFor = null; let voiceOk = false;
async function refreshListen() {
  const code = ui.last?.to ?? ui.to;
  voiceFor = code;
  const v = await findVoice(code);
  if (voiceFor !== code) return;
  voiceOk = Boolean(v);
  const btn = $('listen');
  btn.setAttribute('aria-disabled', String(!voiceOk));
  btn.title = voiceOk ? `Speak in ${langName(code)}` : `No ${langName(code)} voice is installed on this device`;
}

/** Single place that changes languages, so the menu, swap button, chips and globe stay in sync. */
function setLanguages(next, { fly = false, selected = null } = {}) {
  let { from, to } = { from: ui.from, to: ui.to, ...next };
  if (from !== 'auto' && from === to) {
    // The side the user just touched wins; the other side takes this side's old value.
    if ('to' in next && !('from' in next)) from = ui.to;
    else if ('from' in next && !('to' in next)) to = ui.from === 'auto' ? (from === 'en' ? 'es' : 'en') : ui.from;
    if (from === to) to = to === 'en' ? 'es' : 'en';
  }
  const toChanged = to !== ui.to;
  ui.from = from; ui.to = to;
  ui.focusCountry = selected;
  if (ui.from !== 'auto') ui.detected = null;
  ui.showAll = false;
  renderRoute(); renderReadout(); renderChips(); syncGlobe(selected); savePrefs(); updateEngines();
  const target = ui.armed === 'from' && effFrom() ? effFrom() : ui.to;
  if (fly && (toChanged || ui.armed === 'from')) ui.globe?.flyToLanguage(target);
}

// ------------------------------------------------------------------ detection

let detectTimer = 0;
async function detect(text, { allowDownload = false } = {}) {
  const viaChrome = await deviceDetector.detect(text, KNOWN, { allowDownload });
  if (viaChrome) return viaChrome;
  return detectLanguage(text, { phrasebook, prefer: [ui.to === 'en' ? 'es' : 'en'] });
}

function showDetected(d) {
  const el = $('detected');
  el.replaceChildren();
  if (ui.from !== 'auto' || !d) return;
  const how = d.method === 'on-device' ? 'Chrome' : 'best guess';
  el.append('Detected ', Object.assign(document.createElement('b'), { textContent: langName(d.lang) }), ` · ${how}`);
}

function onInput() {
  const text = $('input').value;
  $('count').textContent = `${text.length} / ${MAX_INPUT_CHARS}`;
  clearTimeout(detectTimer);
  if (ui.from !== 'auto') return;
  if (text.trim().length < 2) { ui.detected = null; showDetected(null); renderRoute(); syncGlobe(ui.focusCountry); return; }
  detectTimer = setTimeout(async () => {
    const d = await detect(text.trim());
    if ($('input').value.trim() !== text.trim()) return;
    ui.detected = d; showDetected(d); renderRoute(); renderChips(); syncGlobe(ui.focusCountry); updateEngines();
  }, 320);
}

// ------------------------------------------------------------------ translating

const STAGE_LABEL = {
  [ENGINES.DEVICE]: 'Translating on your device…',
  [ENGINES.MYMEMORY]: 'Asking MyMemory…',
  [ENGINES.PHRASEBOOK]: 'Checking the phrasebook…',
};

function setBusy(on) {
  ui.busy = on;
  const go = $('go');
  go.setAttribute('aria-busy', String(on));
  go.firstChild.textContent = on ? 'Translating… ' : 'Translate ';
  $('result').setAttribute('aria-busy', String(on));
  if (!on) $('progress').hidden = true;
}

function showMessage(text, { suggest = false } = {}) {
  $('result-card').hidden = true;
  const box = $('result-empty');
  box.hidden = false;
  box.replaceChildren();
  const p = document.createElement('p'); p.className = 'mono'; p.textContent = text; p.setAttribute('role', 'alert');
  box.append(p);
  if (suggest) {
    const b = Object.assign(document.createElement('button'), { type: 'button', className: 'link', textContent: `See the ${langName(ui.to)} essentials below` });
    b.addEventListener('click', () => $('chips').scrollIntoView({ block: 'center', behavior: reducedMotion.matches ? 'auto' : 'smooth' }));
    box.append(b);
  }
}

function showResult(r, { xp = 0 } = {}) {
  $('result-empty').hidden = true;
  const card = $('result-card'); card.hidden = false;
  // restart the entrance animation
  card.style.animation = 'none'; void card.offsetWidth; card.style.animation = '';
  $('result-route').textContent = `${r.from.toUpperCase()} → ${r.to.toUpperCase()}${xp ? `  ·  +${xp} XP` : ''}`;
  const stamp = $('stamp');
  stamp.dataset.engine = r.engine;
  stamp.textContent = r.cached ? `${r.engine} · saved` : r.engine;
  stamp.style.animation = 'none'; void stamp.offsetWidth; stamp.style.animation = '';
  const txt = $('result-text');
  txt.textContent = r.text; txt.lang = r.to; txt.dir = BY_CODE[r.to].rtl ? 'rtl' : 'auto';
  txt.classList.toggle('is-long', r.text.length > 110);
  const notes = $('result-notes'); notes.replaceChildren();
  for (const n of r.notes) {
    const li = document.createElement('li'); li.textContent = n;
    if (/not confident|unchanged|differed/.test(n)) li.className = 'warn';
    notes.append(li);
  }
  if (r.cached) { const li = document.createElement('li'); li.textContent = `Saved from an earlier ${r.engine} answer. No request was made.`; notes.append(li); }
  ui.last = r;
  refreshListen();
  if (!reducedMotion.matches) card.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); else card.scrollIntoView({ block: 'nearest' });
}

async function run(override = null) {
  if (ui.busy) return;
  const input = $('input');
  const text = (override?.text ?? input.value).trim();
  if (!text) { input.focus(); haptic('error'); showMessage('Type something first, or tap one of the essentials below.', { suggest: true }); return; }

  let from = override?.from ?? ui.from;
  setBusy(true);
  try {
    if (from === 'auto') {
      const d = await detect(text, { allowDownload: true });
      if (!d) { haptic('error'); showMessage('I could not tell which language that is. Pick the source language and try again.'); return; }
      ui.detected = d; showDetected(d); from = d.lang;
      renderRoute(); syncGlobe(ui.focusCountry);
    }
    const to = ui.to;
    if (from === to) { haptic('error'); showMessage(`That already looks like ${langName(to)}. Pick a different target language.`); return; }

    let slow = setTimeout(() => { $('progress').hidden = false; $('progress-label').textContent = 'Working…'; $('progress-bar').removeAttribute('value'); }, 280);
    const deps = {
      cache, phrasebook, meter, myMemory, onDevice: onDevice.supported() ? onDevice : null, online: () => navigator.onLine,
      onStage: (e) => { $('progress-label').textContent = STAGE_LABEL[e]; if (e !== ENGINES.DEVICE) $('progress-bar').removeAttribute('value'); },
      onProgress: (f) => { $('progress').hidden = false; $('progress-label').textContent = `Downloading the ${from.toUpperCase()}→${to.toUpperCase()} model, once · ${Math.round(f * 100)}%`; $('progress-bar').value = f; },
    };

    let r;
    try {
      r = override?.phrase
        ? { from, to, text: override.phrase.text, engine: ENGINES.PHRASEBOOK, cached: false, notes: [] }
        : await translate({ text, from, to }, deps);
    } catch (err) {
      clearTimeout(slow);
      haptic('error');
      showMessage(err.message || 'Something went wrong.', { suggest: err.kind === 'no-engine' || err.kind === 'network' || err.kind === 'quota' });
      updateEngines();
      return;
    }
    clearTimeout(slow);

    const before = rankFor(state.xp);
    const rec = recordTranslation(state, { from, to, text, result: r.text, engine: r.engine });
    state = rec.state; saveState(storage, state);
    showResult(r, { xp: rec.xp });
    renderHud();
    haptic(rec.newStamp ? 'stamp' : 'success');
    ui.globe?.arc(from, to);
    announceRewards(rec, before, to);
    updateEngines();
  } finally {
    setBusy(false);
  }
}

function announceRewards(rec, rankBefore, to) {
  const l = BY_CODE[to];
  if (rec.newStamp) toast({ stamp: to.toUpperCase(), title: `New stamp: ${l.home}`, sub: `${l.name} added to your passport · +20 XP` });
  if (rec.goalMet) toast({ title: `Daily goal done · ${rec.streak.count}-day streak`, sub: `${DAILY_GOAL} translations today`, plain: true });
  for (const m of rec.milestones) toast({ title: `Milestone: ${m.label}`, sub: m.hint, plain: true });
  const after = rankFor(state.xp);
  if (after.index > rankBefore.index) toast({ title: `New rank: ${after.name}`, sub: `${state.xp} XP`, plain: true });
}

// ------------------------------------------------------------------ passport + HUD

function renderHud() {
  const s = streakInfo(state);
  $('hud-streak').textContent = s.count;
  $('hud-xp').textContent = state.xp.toLocaleString();
  $('hud-rank').textContent = rankFor(state.xp).name;
  $('open-passport').classList.toggle('has-streak', s.count > 0);
  $('open-passport').setAttribute('aria-label', `Open passport. ${s.count}-day streak, ${state.xp} XP, rank ${rankFor(state.xp).name}`);
}

function renderPassport() {
  const name = $('pp-name'); if (document.activeElement !== name) name.value = state.name;
  const rank = rankFor(state.xp);
  $('pp-rank').textContent = rank.name;
  $('pp-xp').textContent = `${state.xp.toLocaleString()} XP`;
  $('pp-meter-fill').style.width = `${Math.round(rank.progress * 100)}%`;
  $('pp-meter').setAttribute('aria-valuenow', String(Math.round(rank.progress * 100)));
  $('pp-next').textContent = rank.next ? `${rank.toNext} XP to ${rank.next}` : 'Top rank reached.';

  const s = streakInfo(state);
  $('pp-streak').textContent = s.count;
  $('pp-goal').textContent = `goal ${DAILY_GOAL}/day`;
  $('pp-streak-sub').textContent = s.todayDone ? 'days in a row · today done' : s.atRisk ? `days · ${DAILY_GOAL - s.today} more today keeps it` : `days · ${DAILY_GOAL - s.today} more today starts one`;
  const days = $('pp-days'); days.replaceChildren();
  for (let i = 13; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i);
    const n = state.days[dayKey(d)] ?? 0;
    const li = document.createElement('li');
    li.dataset.state = n >= DAILY_GOAL ? 'done' : n > 0 ? 'part' : 'none';
    li.dataset.today = String(i === 0);
    li.title = `${d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}: ${n} translation${n === 1 ? '' : 's'}`;
    li.append(Object.assign(document.createElement('span'), { className: 'sr', textContent: li.title }));
    days.append(li);
  }

  const stamps = $('pp-stamps'); stamps.replaceChildren();
  LANGUAGES.forEach((l, i) => {
    const got = state.stamps[l.code];
    const li = document.createElement('li');
    li.dataset.earned = String(Boolean(got));
    li.style.setProperty('--rot', `${((i * 37) % 7) - 3}deg`);
    const code = Object.assign(document.createElement('span'), { className: 'st-code', textContent: l.code.toUpperCase() });
    const nm = Object.assign(document.createElement('span'), { className: 'st-name', textContent: l.native, lang: l.code });
    const dt = Object.assign(document.createElement('span'), { className: 'st-date mono', textContent: got ? `${got.date} · ×${got.count}` : 'Not yet visited' });
    li.append(code, nm, dt);
    li.setAttribute('aria-label', `${l.name}: ${got ? `stamped ${got.date}` : 'not yet visited'}`);
    stamps.append(li);
  });
  $('pp-stamp-count').textContent = `${Object.keys(state.stamps).length} of ${LANGUAGES.length}`;

  const miles = $('pp-miles'); miles.replaceChildren();
  for (const m of MILESTONES) {
    const v = Math.min(m.goal, m.value(state, new Date()));
    const done = Boolean(state.milestones[m.id]);
    const li = document.createElement('li'); li.dataset.done = String(done);
    li.innerHTML = '<span><span class="m-label"></span> <span class="m-hint"></span></span><span class="m-state"></span><div class="meter" role="presentation"><i></i></div>';
    li.querySelector('.m-label').textContent = m.label;
    li.querySelector('.m-hint').textContent = m.hint;
    li.querySelector('.m-state').textContent = done ? 'Done' : `${v.toLocaleString()} / ${m.goal.toLocaleString()}`;
    li.querySelector('i').style.width = `${Math.round((v / m.goal) * 100)}%`;
    miles.append(li);
  }

  const log = $('pp-log'); log.replaceChildren();
  state.log.slice(0, 15).forEach((e, i) => {
    const li = document.createElement('li');
    const b = document.createElement('button'); b.type = 'button'; b.dataset.i = i;
    b.innerHTML = '<span class="l-route mono"></span><span class="l-text"></span><span class="l-eng mono"></span>';
    b.querySelector('.l-route').textContent = `${e.from.toUpperCase()}→${e.to.toUpperCase()}`;
    const lt = b.querySelector('.l-text'); lt.textContent = e.text; const sp = document.createElement('span'); sp.textContent = `  ${e.result}`; lt.append(sp);
    b.querySelector('.l-eng').textContent = e.engine;
    li.append(b); log.append(li);
  });
  $('pp-log-empty').hidden = state.log.length > 0;

  const hap = $('pp-haptics');
  const can = 'vibrate' in navigator;
  hap.checked = can && state.haptics; hap.disabled = !can;
  $('pp-haptics-note').textContent = can ? '' : '· not supported on this device';
  const m = meter.state();
  $('pp-quota').textContent = `MyMemory today: about ${m.chars.toLocaleString()} of ${MM_DAILY_CHARS.toLocaleString()} free characters used${m.blocked ? ' (limit reached)' : ''}. Estimate; MyMemory limits by network address. Saved translations: ${cache.size()}.`;
}

// ------------------------------------------------------------------ globe wiring

function layout(W, H) {
  const hud = parseFloat(getComputedStyle(root).getPropertyValue('--hud-h')) || 64;
  const deck = $('translator');
  let out;
  if (W > 900) {
    const left = deck.getBoundingClientRect().right + 24;
    const w = Math.max(240, W - left - 24);
    out = { cx: left + w / 2, cy: H * 0.5 + hud * 0.15, radius: Math.min(H * 0.4, w * 0.47) };
  } else {
    const maxH = parseFloat(getComputedStyle(deck).maxHeight) || H * 0.57; // stable: do not jitter as results appear
    const top = hud + 44; const bottom = H - maxH;
    out = { cx: W / 2, cy: (top + bottom) / 2, radius: Math.max(70, Math.min((bottom - top) / 2 * 0.97, W * 0.44)) };
  }
  root.style.setProperty('--gcx', `${out.cx}px`); root.style.setProperty('--gcy', `${out.cy}px`); root.style.setProperty('--gr', `${out.radius}px`);
  return out;
}

const tip = $('tip'); let tipTimer = 0;
function showTip(h, x, y) {
  clearTimeout(tipTimer);
  if (!h || !h.country) { tip.hidden = true; return; }
  tip.replaceChildren();
  const b = document.createElement('b'); b.textContent = h.country;
  tip.append(b);
  if (h.lang) {
    const l = BY_CODE[h.lang];
    tip.append(Object.assign(document.createElement('span'), { className: 'tip-lang', textContent: `${l.name} · ${l.native}` }));
    tip.append(Object.assign(document.createElement('span'), { className: 'tip-act', textContent: `Click to ${ui.armed === 'to' ? 'translate into' : 'translate from'} ${l.name}` }));
  } else {
    tip.append(Object.assign(document.createElement('span'), { className: 'tip-none', textContent: 'No language pack yet' }));
  }
  tip.hidden = false;
  const r = tip.getBoundingClientRect();
  tip.style.left = `${Math.min(innerWidth - r.width - 8, Math.max(8, x + 16))}px`;
  tip.style.top = `${Math.min(innerHeight - r.height - 8, Math.max(8, y + 18))}px`;
  if (matchMedia('(hover: none)').matches) tipTimer = setTimeout(() => { tip.hidden = true; }, 2400);
}

function onPick(h) {
  if (!h?.country) return;
  if (!h.lang) {
    haptic('error');
    showTip(h, innerWidth / 2 - 80, innerHeight * 0.3);
    toast({ title: `No language pack for ${h.country} yet`, sub: 'Pick a highlighted country', plain: true });
    return;
  }
  haptic('tick');
  const side = ui.armed;
  setLanguages(side === 'to' ? { to: h.lang } : { from: h.lang }, { selected: h.country });
  ui.globe?.flyToCountry(h.country, { zoom: 1.18 });
  tip.hidden = true;
  const l = BY_CODE[h.lang];
  $('detected').textContent = '';
  announce(`${side === 'to' ? 'Translating into' : 'Translating from'} ${l.name}, ${h.country}`);
}

function announce(msg) {
  const el = $('detected');
  el.textContent = msg;
  clearTimeout(announce.t);
  announce.t = setTimeout(() => { if (el.textContent === msg) showDetected(ui.detected); }, 2800);
}

async function startGlobe() {
  try {
    const g = await createGlobe({
      canvas: $('globe'), worldUrl: 'src/data/countries-110m.json', layout,
      onHover: showTip, onPick,
      onView: (lat, lon) => { $('coords').textContent = `LAT ${Math.abs(lat).toFixed(1).padStart(4, '0')} ${lat >= 0 ? 'N' : 'S'} · LON ${Math.abs(lon).toFixed(1).padStart(5, '0')} ${lon >= 0 ? 'E' : 'W'}`; },
      onReady: () => { $('stage').classList.add('ready'); },
      reducedMotion: reducedMotion.matches,
    });
    ui.globe = g;
    window.__globe = g; // handy for debugging in devtools
    if (g.kind === 'flat') { $('stage').classList.add('flat', 'ready'); $('webgl-note').hidden = false; }
    syncGlobe(ui.focusCountry);
    g.flyToLanguage(ui.to, { duration: 1 });
    renderReadout();
    reducedMotion.addEventListener('change', () => g.setReducedMotion(reducedMotion.matches));
  } catch (err) {
    console.warn('Globe unavailable, translator still works.', err);
    $('stage').classList.add('flat');
  }
}

// ------------------------------------------------------------------ events

async function copyResult() {
  if (!ui.last) return;
  const b = $('copy');
  try {
    await navigator.clipboard.writeText(ui.last.text);
  } catch {
    const ta = Object.assign(document.createElement('textarea'), { value: ui.last.text });
    ta.style.cssText = 'position:fixed;opacity:0'; document.body.append(ta); ta.select();
    try { document.execCommand('copy'); } catch { /* nothing else to try */ }
    ta.remove();
  }
  haptic('tap');
  b.textContent = 'Copied';
  setTimeout(() => { b.textContent = 'Copy'; }, 1300);
}

let speaking = false;
async function listen() {
  if (!ui.last) return;
  if (speaking) { stopSpeaking(); speaking = false; $('listen').textContent = 'Listen'; return; }
  if (!voiceOk) { toast({ title: `No ${langName(ui.last.to)} voice on this device`, sub: 'Install one in your system speech settings.', plain: true }); haptic('error'); return; }
  speaking = true; $('listen').textContent = 'Stop';
  const r = await speak(ui.last.text, ui.last.to);
  speaking = false; $('listen').textContent = 'Listen';
  if (!r.ok) toast({ title: 'Could not play audio', sub: r.reason ?? '', plain: true });
}

function bind() {
  $('form').addEventListener('submit', (e) => { e.preventDefault(); run(); });
  $('input').addEventListener('input', onInput);
  $('input').addEventListener('keydown', (e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); run(); } });
  $('clear').addEventListener('click', () => {
    $('input').value = ''; ui.detected = null; showDetected(null); onInput(); renderRoute(); renderChips();
    $('result-card').hidden = true; const box = $('result-empty'); box.hidden = false; resetEmpty(); $('input').focus(); haptic('tap');
  });
  $('from-lang').addEventListener('change', (e) => { haptic('tick'); ui.armed = 'from'; setLanguages({ from: e.target.value }, { fly: e.target.value !== 'auto' }); });
  $('to-lang').addEventListener('change', (e) => { haptic('tick'); ui.armed = 'to'; setLanguages({ to: e.target.value }, { fly: true }); });
  $('swap').addEventListener('click', () => {
    const f = effFrom();
    if (!f) { haptic('error'); toast({ title: 'Type something first', sub: 'Then I can swap the detected language', plain: true }); return; }
    if (f === ui.to) { haptic('error'); return; }
    const out = ui.last && ui.last.to === ui.to && ui.last.from === f ? ui.last.text : null;
    haptic('tap');
    const prevTo = ui.to;
    ui.detected = null;
    setLanguages({ from: prevTo, to: f }, { fly: true });
    if (out) { $('input').value = out; onInput(); }
  });
  for (const side of ['from', 'to']) {
    $(`${side}-code`).addEventListener('click', () => { ui.armed = side; haptic('tick'); renderRoute(); renderReadout(); });
  }
  $('chips').addEventListener('click', (e) => {
    if (e.target.closest('#chip-more')) { ui.showAll = !ui.showAll; renderChips(); $('chip-more')?.focus(); return; }
    const b = e.target.closest('.chip'); if (!b) return;
    const src = b.dataset.src; const idx = Number(b.dataset.index);
    const phrase = { text: PHRASEBOOK[ui.to][idx] };
    $('input').value = PHRASEBOOK[src][idx];
    $('count').textContent = `${$('input').value.length} / ${MAX_INPUT_CHARS}`;
    if (ui.from === 'auto') { ui.detected = { lang: src, confidence: 1, method: 'phrasebook' }; showDetected(ui.detected); renderRoute(); }
    haptic('tap');
    run({ text: PHRASEBOOK[src][idx], from: src, phrase });
  });
  $('try-example').addEventListener('click', () => {
    $('input').value = 'Where is the train station?'; onInput(); run();
  });
  $('copy').addEventListener('click', copyResult);
  $('listen').addEventListener('click', listen);

  const dlg = $('passport');
  $('open-passport').addEventListener('click', () => { renderPassport(); dlg.showModal(); haptic('tap'); });
  dlg.addEventListener('click', (e) => { if (e.target === dlg) dlg.close(); });
  dlg.addEventListener('close', () => { stopSpeaking(); $('open-passport').focus(); });
  let nameTimer = 0;
  $('pp-name').addEventListener('input', (e) => { clearTimeout(nameTimer); nameTimer = setTimeout(() => { state.name = e.target.value.trim().slice(0, 20); saveState(storage, state); }, 250); });
  $('pp-haptics').addEventListener('change', (e) => { state.haptics = e.target.checked; saveState(storage, state); haptic('success'); });
  $('pp-clear-cache').addEventListener('click', () => { cache.clear(); renderPassport(); toast({ title: 'Saved translations cleared', plain: true }); });
  $('pp-reset').addEventListener('click', () => {
    if (!confirm('Reset your passport? XP, streak and stamps will be erased.')) return;
    state = loadState(null); saveState(storage, state);
    try { storage?.removeItem('globalLingoState'); } catch { /* ignore */ }
    renderPassport(); renderHud(); toast({ title: 'Passport reset', plain: true });
  });
  $('pp-log').addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    const entry = state.log[Number(b.dataset.i)]; if (!entry) return;
    dlg.close();
    ui.armed = 'to';
    setLanguages({ from: entry.from, to: entry.to }, { fly: true });
    $('input').value = entry.text; onInput(); run();
  });

  addEventListener('online', updateEngines);
  addEventListener('offline', updateEngines);
  document.addEventListener('keydown', (e) => {
    if (e.key === '/' && !/input|textarea|select/i.test(document.activeElement?.tagName ?? '') && !$('passport').open) { e.preventDefault(); $('input').focus(); }
  });
  self.speechSynthesis?.addEventListener?.('voiceschanged', refreshListen);
}

function resetEmpty() {
  const box = $('result-empty');
  box.replaceChildren();
  const p = Object.assign(document.createElement('p'), { className: 'mono', textContent: 'Your translation lands here, stamped with the engine that wrote it.' });
  const b = Object.assign(document.createElement('button'), { type: 'button', className: 'link', id: 'try-example', textContent: 'Try “Where is the train station?”' });
  b.addEventListener('click', () => { $('input').value = 'Where is the train station?'; onInput(); run(); });
  box.append(p, b);
}

// ------------------------------------------------------------------ boot

fillSelects();
bind();
renderRoute(); renderReadout(); renderChips(); renderHud(); updateEngines();
layout(innerWidth, innerHeight);
if (params.get('q')) { $('input').value = params.get('q'); onInput(); }
addEventListener('resize', () => { layout(innerWidth, innerHeight); });
requestAnimationFrame(() => setTimeout(startGlobe, 0));
