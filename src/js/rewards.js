// Passport, streaks and XP. Pure functions over a plain state object so they are testable.
//
//  * A day "counts" for the streak once you complete DAILY_GOAL translations.
//  * XP: 5 per translation (10 for 4+ words). The same phrase and pair repeated on the same day earns nothing.
//  * A new language you translate INTO earns a passport stamp and +20 XP, once.

export const DAILY_GOAL = 2;
export const STAMP_XP = 20;
export const LOG_MAX = 40;

export const RANKS = [
  { name: 'Tourist', xp: 0 },
  { name: 'Wanderer', xp: 100 },
  { name: 'Local', xp: 300 },
  { name: 'Navigator', xp: 700 },
  { name: 'Polyglot', xp: 1500 },
];

export const MILESTONES = [
  { id: 'first', label: 'First departure', hint: 'Make a translation', goal: 1, value: (s) => s.total },
  { id: 'stamps3', label: 'Three countries', hint: 'Collect 3 stamps', goal: 3, value: (s) => Object.keys(s.stamps).length },
  { id: 'streak3', label: 'Getting the habit', hint: '3-day streak', goal: 3, value: (s, now) => streakInfo(s, now).best },
  { id: 'xp500', label: 'Frequent flyer', hint: 'Earn 500 XP', goal: 500, value: (s) => s.xp },
  { id: 'stamps10', label: 'Ten stamps', hint: 'Collect 10 stamps', goal: 10, value: (s) => Object.keys(s.stamps).length },
  { id: 'streak7', label: 'A week abroad', hint: '7-day streak', goal: 7, value: (s, now) => streakInfo(s, now).best },
  { id: 'xp1000', label: 'Thousand-mile club', hint: 'Earn 1,000 XP', goal: 1000, value: (s) => s.xp },
];

export function freshState() {
  return { v: 2, name: '', xp: 0, total: 0, days: {}, stamps: {}, log: [], seen: {}, milestones: {}, haptics: true, bestStreak: 0 };
}

export const dayKey = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const shift = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };

export function rankFor(xp) {
  let i = 0;
  RANKS.forEach((r, k) => { if (xp >= r.xp) i = k; });
  const cur = RANKS[i]; const next = RANKS[i + 1] ?? null;
  return { name: cur.name, index: i, next: next?.name ?? null, toNext: next ? next.xp - xp : 0, progress: next ? (xp - cur.xp) / (next.xp - cur.xp) : 1 };
}

/** Current streak = consecutive days with the goal met, ending today or (still alive) yesterday. */
export function streakInfo(state, now = new Date()) {
  const met = (d) => (state.days[dayKey(d)] ?? 0) >= DAILY_GOAL;
  const todayDone = met(now);
  let cursor = todayDone ? now : shift(now, -1);
  let count = 0;
  while (met(cursor)) { count++; cursor = shift(cursor, -1); }
  // best ever, scanned from stored days
  const keys = Object.keys(state.days).filter((k) => state.days[k] >= DAILY_GOAL).sort();
  let best = 0; let run = 0; let prev = null;
  for (const k of keys) {
    const d = new Date(`${k}T12:00:00`);
    run = prev && dayKey(shift(prev, 1)) === k ? run + 1 : 1;
    best = Math.max(best, run); prev = d;
  }
  return { count, todayDone, atRisk: count > 0 && !todayDone, today: state.days[dayKey(now)] ?? 0, best: Math.max(best, state.bestStreak ?? 0) };
}

const wordCount = (t) => String(t).trim().split(/\s+/).filter(Boolean).length;

/**
 * Apply one finished translation. Returns { state, xp, newStamp, milestones[], goalMet, repeat }.
 * Never mutates the input state.
 */
export function recordTranslation(prev, { from, to, text, result, engine }, now = new Date()) {
  const s = structuredClone(prev);
  const today = dayKey(now);
  const wasDone = (s.days[today] ?? 0) >= DAILY_GOAL;
  const before = new Set(Object.keys(s.milestones));

  const seenKey = `${today}|${from}>${to}|${text.trim().toLowerCase()}`;
  const seenToday = Object.fromEntries(Object.entries(s.seen).filter(([k]) => k.startsWith(today)));
  const repeat = Boolean(seenToday[seenKey]);
  s.seen = { ...seenToday, [seenKey]: 1 };

  let xp = 0;
  if (!repeat) {
    xp += wordCount(text) >= 4 ? 10 : 5;
    s.days[today] = (s.days[today] ?? 0) + 1;
  }
  const newStamp = !s.stamps[to];
  if (newStamp) { s.stamps[to] = { date: today, count: 0 }; xp += STAMP_XP; }
  s.stamps[to].count++;
  s.xp += xp;
  s.total++;

  s.log.unshift({ t: now.getTime(), from, to, text, result, engine });
  s.log.length = Math.min(s.log.length, LOG_MAX);

  const info = streakInfo(s, now);
  s.bestStreak = Math.max(s.bestStreak ?? 0, info.best);
  for (const m of MILESTONES) if (!s.milestones[m.id] && m.value(s, now) >= m.goal) s.milestones[m.id] = today;
  const milestones = MILESTONES.filter((m) => s.milestones[m.id] && !before.has(m.id));

  // prune old day counters (keep a year)
  const cutoff = dayKey(shift(now, -365));
  for (const k of Object.keys(s.days)) if (k < cutoff) delete s.days[k];

  return { state: s, xp, newStamp, milestones, repeat, goalMet: !wasDone && (s.days[today] ?? 0) >= DAILY_GOAL, streak: info };
}

export function loadState(storage, key = 'gl2:state') {
  try {
    const raw = storage?.getItem(key);
    if (raw) return { ...freshState(), ...JSON.parse(raw) };
  } catch { /* fall through */ }
  return migrateV1(storage) ?? freshState();
}

export function saveState(storage, state, key = 'gl2:state') {
  try { storage?.setItem(key, JSON.stringify(state)); } catch { /* private mode / quota */ }
}

/** Carry over name and XP from the original app's 'globalLingoState', if present. */
function migrateV1(storage) {
  try {
    const old = JSON.parse(storage?.getItem('globalLingoState') ?? 'null');
    if (!old) return null;
    const s = freshState();
    s.xp = Number(old.xp) || 0;
    s.name = String(old.profile?.name ?? '').replace(/^Translator$/, '').slice(0, 20);
    return s;
  } catch { return null; }
}
