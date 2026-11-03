// Pure translation logic: no DOM, no globals except fetch/localStorage-style objects passed in.
// This file is imported by the browser app AND by `node --test test/core.test.js`.
//
// Tiers, in order:  cache -> on-device (Chrome Translator) -> MyMemory -> offline phrasebook
// Every answer says which engine produced it.

export class TranslateError extends Error {
  constructor(kind, message, extra = {}) {
    super(message);
    this.name = 'TranslateError';
    this.kind = kind; // empty | same | quota | network | rejected | unsupported | empty-result | no-engine
    Object.assign(this, extra);
  }
}

export const ENGINES = Object.freeze({
  DEVICE: 'on-device',
  MYMEMORY: 'MyMemory',
  PHRASEBOOK: 'phrasebook',
});

export const MM_URL = 'https://api.mymemory.translated.net/get';
export const MM_MAX_BYTES = 450; // API limit is 500 bytes per request; keep headroom.
export const MM_DAILY_CHARS = 5000; // anonymous quota (documented by MyMemory)
export const MAX_INPUT_CHARS = 1200;

// ---------------------------------------------------------------- text helpers

/** Lowercase, unify quotes/spaces, drop sentence punctuation. Keeps letters and apostrophes. */
export function normalize(s) {
  return String(s ?? '')
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[‘’`´]/g, "'")
    .replace(/[\s  ]+/g, ' ')
    .replace(/[.,!?;:¿¡。！？、，…؟،"“”«»()[\]{}]/g, '')
    .trim();
}

/** normalize + strip combining marks so "ou est la gare" matches "où est la gare". */
export function fold(s) {
  return normalize(s).normalize('NFD').replace(/\p{M}+/gu, '').normalize('NFC');
}

const NAMED = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
export function decodeEntities(s) {
  return String(s).replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e) => {
    if (e[0] === '#') {
      const n = e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(n) && n > 0 && n < 0x110000 ? String.fromCodePoint(n) : m;
    }
    return NAMED[e.toLowerCase()] ?? m;
  });
}

const utf8Len = (s) => new TextEncoder().encode(s).length;

/** Split long text into pieces under maxBytes, preferring sentence, then clause, then word breaks. */
export function chunkText(text, maxBytes = MM_MAX_BYTES) {
  const src = String(text).trim();
  if (!src) return [];
  if (utf8Len(src) <= maxBytes) return [src];

  const pieces = src.match(/[^.!?。！？\n]+[.!?。！？]*\s*/g) ?? [src];
  const out = [];
  let cur = '';
  const flush = () => { if (cur.trim()) out.push(cur.trim()); cur = ''; };

  const pushOversized = (piece) => {
    // break on commas/spaces, finally on code points
    const words = piece.split(/(?<=[,;、，\s])/);
    for (const w of words) {
      if (utf8Len(w) > maxBytes) {
        flush();
        let buf = '';
        for (const ch of w) {
          if (utf8Len(buf + ch) > maxBytes) { out.push(buf); buf = ''; }
          buf += ch;
        }
        cur = buf;
      } else if (utf8Len(cur + w) > maxBytes) {
        flush();
        cur = w;
      } else {
        cur += w;
      }
    }
  };

  for (const p of pieces) {
    if (utf8Len(p) > maxBytes) pushOversized(p);
    else if (utf8Len(cur + p) > maxBytes) { flush(); cur = p; }
    else cur += p;
  }
  flush();
  return out;
}

// ---------------------------------------------------------------- phrasebook

export function createPhrasebook(table, ids) {
  const index = {};
  for (const [lang, rows] of Object.entries(table)) {
    const m = new Map();
    rows.forEach((t, i) => {
      if (!t) return;
      const k = fold(t);
      if (!m.has(k)) m.set(k, i);
    });
    index[lang] = m;
  }
  const has = (lang) => Boolean(table[lang]);
  return {
    ids,
    has,
    /** Exact (case/punctuation/accent-insensitive) phrase lookup. Returns null when unsure. */
    lookup(text, from, to) {
      const i = index[from]?.get(fold(text));
      if (i == null) return null;
      const out = table[to]?.[i];
      return out ? { text: out, id: ids[i], index: i } : null;
    },
    /** Which languages contain this exact phrase? */
    languagesFor(text) {
      const k = fold(text);
      return Object.keys(index).filter((l) => index[l].has(k));
    },
    /** List of {id, source, text} for a language pair, skipping phrases missing on either side. */
    list(from, to) {
      const a = table[from]; const b = table[to];
      if (!a || !b) return [];
      return ids.map((id, i) => ({ id, source: a[i], text: b[i], index: i })).filter((r) => r.source && r.text);
    },
    coverage(lang) {
      return table[lang] ? table[lang].filter(Boolean).length : 0;
    },
  };
}

// ---------------------------------------------------------------- language detection (offline heuristic)

const SCRIPTS = [
  ['ko', /[가-힯ᄀ-ᇿ㄰-㆏]/g],
  ['ja', /[぀-ヿ]/g],
  ['zh', /[一-鿿]/g],
  ['ar', /[؀-ۿ]/g],
  ['he', /[֐-׿]/g],
  ['hi', /[ऀ-ॿ]/g],
  ['th', /[฀-๿]/g],
  ['el', /[Ͱ-Ͽ]/g],
  ['ru', /[Ѐ-ӿ]/g],
];

const STOP = {
  en: 'the and is are you to of where what how do i my this that with for in it please thank hello',
  es: 'el la los las de que y es un una por para con no mi cómo como dónde donde está estoy gracias hola yo',
  fr: 'le la les des du est et un une je tu vous pour avec pas où ou comment merci bonjour ne ça',
  de: 'der die das und ist ich nicht ein eine mit zu wo wie bitte danke sie du hallo',
  it: 'il lo gli che di è e un una per con non io dove come grazie ciao mi sono',
  pt: 'o os as que é um uma para com não eu onde como obrigado olá você está',
  nl: 'de het een en is ik je niet van waar hoe dank hallo u mijn',
  sv: 'och det att är jag inte du var hur tack hej ett på',
  pl: 'nie jest to się co jak gdzie dziękuję cześć ja proszę',
  tr: 'bir ve bu ne nerede değil merhaba teşekkür ben için',
  id: 'yang dan di ini saya tidak apa terima kasih dimana halo anda',
};
const STOPSETS = Object.fromEntries(Object.entries(STOP).map(([k, v]) => [k, new Set(v.split(' '))]));

/**
 * Offline best-effort detection. Returns { lang, confidence, method } or null.
 * Order: script -> exact phrasebook phrase -> stop-word vote. Honest about being a guess.
 */
export function detectLanguage(text, { phrasebook = null, prefer = [] } = {}) {
  const t = String(text ?? '').trim();
  if (!t) return null;

  const counts = SCRIPTS.map(([lang, re]) => [lang, (t.match(re) ?? []).length]);
  const kana = counts.find(([l]) => l === 'ja')[1];
  const hangul = counts.find(([l]) => l === 'ko')[1];
  if (kana) return { lang: 'ja', confidence: 0.92, method: 'script' };
  if (hangul) return { lang: 'ko', confidence: 0.92, method: 'script' };
  const top = counts.filter(([, n]) => n > 0).sort((a, b) => b[1] - a[1])[0];
  if (top) {
    let lang = top[0];
    if (lang === 'ru' && /[іїєґ]/i.test(t)) lang = 'uk';
    return { lang, confidence: 0.9, method: 'script' };
  }

  if (phrasebook) {
    const hits = phrasebook.languagesFor(t);
    const pick = hits.find((l) => prefer.includes(l)) ?? (hits.length === 1 ? hits[0] : null);
    if (pick) return { lang: pick, confidence: hits.length === 1 ? 0.85 : 0.6, method: 'phrasebook' };
    if (hits.length > 1) return null; // e.g. "No" is a word in several languages: do not guess
  }

  const words = fold(t).split(/[^\p{L}']+/u).filter(Boolean);
  if (!words.length) return null;
  const scores = Object.entries(STOPSETS)
    .map(([lang, set]) => [lang, words.filter((w) => set.has(w) || set.has(w.normalize('NFD').replace(/\p{M}+/gu, ''))).length])
    .filter(([, n]) => n > 0)
    .sort((a, b) => b[1] - a[1]);
  if (!scores.length) return null;
  if (scores[1] && scores[1][1] === scores[0][1]) {
    const tied = scores.filter(([, n]) => n === scores[0][1]).map(([l]) => l);
    const p = tied.find((l) => prefer.includes(l));
    if (!p) return null;
    return { lang: p, confidence: 0.45, method: 'stopwords' };
  }
  return { lang: scores[0][0], confidence: Math.min(0.8, 0.35 + 0.15 * scores[0][1]), method: 'stopwords' };
}

// ---------------------------------------------------------------- cache

const DAY = 86_400_000;

/** Tiny persistent cache over any {getItem,setItem,removeItem} (localStorage-shaped). */
export function createCache(storage, { key = 'gl2:cache', max = 250, ttl = 30 * DAY, now = () => Date.now() } = {}) {
  const load = () => {
    try { return JSON.parse(storage?.getItem(key) ?? '{}') || {}; } catch { return {}; }
  };
  const save = (obj) => {
    try { storage?.setItem(key, JSON.stringify(obj)); } catch { /* quota or private mode: stay in-memory-less */ }
  };
  return {
    keyFor: (from, to, text) => `${from}>${to}:${normalize(text)}`,
    get(from, to, text) {
      const db = load();
      const k = `${from}>${to}:${normalize(text)}`;
      const hit = db[k];
      if (!hit) return null;
      if (now() - hit.t > ttl) { delete db[k]; save(db); return null; }
      return hit;
    },
    set(from, to, text, value) {
      const db = load();
      db[`${from}>${to}:${normalize(text)}`] = { ...value, t: now() };
      const keys = Object.keys(db);
      if (keys.length > max) {
        keys.sort((a, b) => db[a].t - db[b].t).slice(0, keys.length - max).forEach((k) => delete db[k]);
      }
      save(db);
    },
    size: () => Object.keys(load()).length,
    clear() { try { storage?.removeItem(key); } catch { /* ignore */ } },
  };
}

/** Counts characters sent to MyMemory per day (an estimate of the anonymous quota) + quota-hit flag. */
export function createQuotaMeter(storage, { key = 'gl2:mm', now = () => new Date() } = {}) {
  const day = () => {
    const d = now();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };
  const read = () => {
    try {
      const v = JSON.parse(storage?.getItem(key) ?? 'null');
      if (v && v.day === day()) return v;
    } catch { /* ignore */ }
    return { day: day(), chars: 0, blocked: false };
  };
  const write = (v) => { try { storage?.setItem(key, JSON.stringify(v)); } catch { /* ignore */ } };
  return {
    state: read,
    add(n) { const v = read(); v.chars += n; write(v); return v; },
    block() { const v = read(); v.blocked = true; write(v); return v; },
    isBlocked: () => read().blocked,
    remaining: () => Math.max(0, MM_DAILY_CHARS - read().chars),
  };
}

// ---------------------------------------------------------------- MyMemory

/** Interpret one MyMemory JSON body. Throws TranslateError for quota/invalid/empty. */
export function parseMyMemory(json, sourceText = '') {
  const status = Number(json?.responseStatus);
  const raw = json?.responseData?.translatedText;
  const details = String(json?.responseDetails ?? '');
  const blob = `${raw ?? ''} ${details}`;

  if (json?.quotaFinished === true || status === 429 || /MYMEMORY WARNING|USED ALL AVAILABLE FREE TRANSLATIONS/i.test(blob)) {
    throw new TranslateError('quota', 'MyMemory’s free daily limit is used up. It resets within 24 hours.');
  }
  if (/INVALID (SOURCE|TARGET) LANGUAGE|IS AN INVALID TARGET LANGUAGE|PLEASE SELECT TWO DISTINCT/i.test(blob)) {
    throw new TranslateError('unsupported', 'MyMemory does not support this language pair.');
  }
  if (status && status !== 200) {
    throw new TranslateError('rejected', details ? `MyMemory said: ${details}` : `MyMemory returned status ${status}.`);
  }
  const text = decodeEntities(raw ?? '').trim();
  if (!text) throw new TranslateError('empty-result', 'MyMemory returned an empty answer.');
  const match = Number(json?.responseData?.match);
  return {
    text,
    match: Number.isFinite(match) ? match : null,
    echoed: sourceText ? normalize(text) === normalize(sourceText) : false,
  };
}

/**
 * MyMemory client. `fetchImpl` and `codes` are injected so the logic is testable offline.
 * Long text is split into <=450 byte requests (the API's per-request limit is 500 bytes).
 */
export function createMyMemory({ fetchImpl, codes = (c) => c, meter = null, timeoutMs = 9000 } = {}) {
  return {
    async translate(text, from, to, { signal } = {}) {
      const chunks = chunkText(text);
      const parts = [];
      let worst = 1;
      let echoed = false;
      for (const chunk of chunks) {
        const url = `${MM_URL}?q=${encodeURIComponent(chunk)}&langpair=${encodeURIComponent(codes(from))}%7C${encodeURIComponent(codes(to))}`;
        const ctl = new AbortController();
        const timer = setTimeout(() => ctl.abort(), timeoutMs);
        const onAbort = () => ctl.abort();
        signal?.addEventListener('abort', onAbort, { once: true });
        let res;
        try {
          res = await fetchImpl(url, { signal: ctl.signal, headers: { Accept: 'application/json' } });
        } catch (err) {
          if (signal?.aborted) throw err;
          throw new TranslateError('network', ctl.signal.aborted ? 'MyMemory took too long to answer.' : 'Could not reach MyMemory. Are you offline?');
        } finally {
          clearTimeout(timer);
          signal?.removeEventListener('abort', onAbort);
        }
        if (res.status === 429) {
          meter?.block();
          throw new TranslateError('quota', 'MyMemory’s free daily limit is used up. It resets within 24 hours.');
        }
        let json;
        try { json = await res.json(); } catch { throw new TranslateError('rejected', 'MyMemory sent a reply we could not read.'); }
        let parsed;
        try { parsed = parseMyMemory(json, chunk); } catch (err) {
          if (err.kind === 'quota') meter?.block();
          throw err;
        }
        meter?.add(chunk.length);
        parts.push(parsed.text);
        if (parsed.match != null) worst = Math.min(worst, parsed.match);
        echoed ||= parsed.echoed;
      }
      return { text: parts.join(' '), match: worst, echoed };
    },
  };
}

// ---------------------------------------------------------------- the tiered pipeline

/**
 * translate({ text, from, to }, deps) -> { text, engine, cached, notes[], from, to }
 *
 * deps:
 *   cache        createCache()
 *   phrasebook   createPhrasebook()
 *   onDevice     { availability(from,to) -> string, translate(text,from,to,onProgress) } | null
 *   myMemory     createMyMemory() | null
 *   meter        createQuotaMeter() | null
 *   online       () => boolean
 *   onProgress   (fraction) => void       model download progress
 *   onStage      (engineName) => void     which tier is working right now
 */
export async function translate({ text, from, to }, deps) {
  const { cache, phrasebook, onDevice = null, myMemory = null, meter = null, online = () => true, onProgress, onStage } = deps;
  const src = String(text ?? '').trim();
  if (!src) throw new TranslateError('empty', 'Type something to translate first.');
  if (src.length > MAX_INPUT_CHARS) throw new TranslateError('rejected', `Please keep it under ${MAX_INPUT_CHARS} characters.`);
  if (from === to) throw new TranslateError('same', 'Pick two different languages.');

  const notes = [];
  const done = (r) => ({ from, to, cached: false, notes, ...r });

  const hit = cache?.get(from, to, src);
  if (hit) return done({ text: hit.text, engine: hit.engine, cached: true, lowConfidence: hit.lowConfidence ?? false });

  const exact = phrasebook?.lookup(src, from, to) ?? null;

  // Tier 1: Chrome on-device Translator
  if (onDevice) {
    try {
      const avail = await onDevice.availability(from, to);
      if (avail && avail !== 'unavailable') {
        onStage?.(ENGINES.DEVICE);
        const out = String(await onDevice.translate(src, from, to, onProgress)).trim();
        if (out) {
          cache?.set(from, to, src, { text: out, engine: ENGINES.DEVICE });
          return done({ text: out, engine: ENGINES.DEVICE });
        }
        notes.push('The on-device translator returned nothing.');
      } else {
        notes.push('Chrome has no on-device model for this pair.');
      }
    } catch (err) {
      notes.push(`On-device translation failed (${err?.message || err?.name || 'unknown'}).`);
    }
  }

  // Tier 2: MyMemory (skipped when offline or the daily quota is known to be gone)
  let mmFailure = null;
  if (myMemory) {
    if (!online()) {
      notes.push('You appear to be offline, so MyMemory was skipped.');
    } else if (meter?.isBlocked()) {
      mmFailure = new TranslateError('quota', 'MyMemory’s free daily limit is used up. It resets within 24 hours.');
      notes.push(mmFailure.message);
    } else {
      try {
        onStage?.(ENGINES.MYMEMORY);
        const r = await myMemory.translate(src, from, to);
        // MyMemory is a crowd-sourced translation memory; its "match" score can be high for wrong answers.
        // A curated phrasebook entry for the exact same phrase is more trustworthy, so prefer it when they disagree.
        if (exact && fold(exact.text) !== fold(r.text)) {
          notes.push('MyMemory’s answer differed from the curated phrasebook, so the phrasebook answer is shown.');
          return done({ text: exact.text, engine: ENGINES.PHRASEBOOK });
        }
        const low = r.echoed || (r.match != null && r.match < 0.5);
        if (r.echoed) notes.push('MyMemory returned the text unchanged — it may not have understood it.');
        else if (low) notes.push('MyMemory is not confident about this one. Double-check before relying on it.');
        cache?.set(from, to, src, { text: r.text, engine: ENGINES.MYMEMORY, lowConfidence: low });
        return done({ text: r.text, engine: ENGINES.MYMEMORY, lowConfidence: low });
      } catch (err) {
        if (err.name === 'AbortError') throw err;
        mmFailure = err;
        notes.push(err.message);
      }
    }
  }

  // Tier 3: offline phrasebook
  if (exact) {
    onStage?.(ENGINES.PHRASEBOOK);
    return done({ text: exact.text, engine: ENGINES.PHRASEBOOK });
  }

  const why = mmFailure ? ` ${mmFailure.message}` : !online() ? ' You appear to be offline.' : '';
  throw new TranslateError(
    mmFailure?.kind === 'quota' ? 'quota' : mmFailure?.kind === 'network' || !online() ? 'network' : 'no-engine',
    `No engine could translate that right now.${why} The offline phrasebook only covers common travel phrases.`,
    { notes },
  );
}
