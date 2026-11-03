// Browser-only adapters: Chrome's on-device Translator + LanguageDetector, and speech synthesis.
// Nothing here is required: every function degrades to "not available".

import { BY_CODE } from './languages.js';

const tag = (code) => BY_CODE[code]?.chrome ?? code;

// ------------------------------------------------------------ Translator API

const STALL_MS = 20000;
/** Some builds leave availability() pending forever; never let that block the UI. */
const within = (promise, ms, fallback) => Promise.race([promise, new Promise((r) => setTimeout(() => r(fallback), ms))]);
const translators = new Map(); // "en>es" -> Promise<Translator>, one per language pair

export const onDevice = {
  supported: () => typeof self !== 'undefined' && 'Translator' in self,

  /** 'unavailable' | 'downloadable' | 'downloading' | 'available' */
  async availability(from, to) {
    if (!this.supported()) return 'unavailable';
    try {
      return await within(self.Translator.availability({ sourceLanguage: tag(from), targetLanguage: tag(to) }), 1500, 'unavailable');
    } catch {
      return 'unavailable';
    }
  },

  /**
   * create() may need a user gesture when a model must be downloaded; callers invoke this from a click.
   * If nothing happens (no progress event, no result) for STALL_MS the promise rejects so the next tier can answer.
   */
  async translate(text, from, to, onProgress) {
    const key = `${from}>${to}`;
    let stallTimer = 0; let rejectStall;
    const stalled = new Promise((_, rej) => { rejectStall = rej; });
    const arm = () => { clearTimeout(stallTimer); stallTimer = setTimeout(() => rejectStall(new Error('on-device translator stalled')), STALL_MS); };
    arm();
    try {
      let pending = translators.get(key);
      if (!pending) {
        pending = self.Translator.create({
          sourceLanguage: tag(from),
          targetLanguage: tag(to),
          monitor(m) {
            m.addEventListener('downloadprogress', (e) => { arm(); onProgress?.(e.loaded); });
          },
        });
        translators.set(key, pending);
        pending.catch(() => translators.delete(key)); // let the next click retry
      }
      return await Promise.race([pending.then((t) => t.translate(text)), stalled]);
    } finally {
      clearTimeout(stallTimer);
    }
  },
};

// ------------------------------------------------------------ LanguageDetector API

let detectorPromise = null;

export const deviceDetector = {
  supported: () => typeof self !== 'undefined' && 'LanguageDetector' in self,

  /** Returns { lang, confidence } mapped onto our language codes, or null. */
  async detect(text, known, { allowDownload = false } = {}) {
    if (!this.supported()) return null;
    try {
      detectorPromise ??= (async () => {
        const avail = await within(self.LanguageDetector.availability(), 1500, 'unavailable');
        if (avail === 'unavailable') return null;
        if (avail !== 'available' && !allowDownload) return undefined; // would need a user gesture
        return self.LanguageDetector.create();
      })();
      const detector = await Promise.race([detectorPromise, new Promise((r) => setTimeout(() => r(null), 4000))]);
      if (detector === undefined) { detectorPromise = null; return null; }
      if (!detector) return null;
      const results = await detector.detect(text);
      const top = results.find((r) => known.includes(r.detectedLanguage.split('-')[0]) && r.detectedLanguage !== 'und');
      if (!top || top.confidence < 0.4) return null;
      return { lang: top.detectedLanguage.split('-')[0], confidence: top.confidence, method: 'on-device' };
    } catch {
      detectorPromise = null;
      return null;
    }
  },
};

// ------------------------------------------------------------ Speech

let voicesReady = null;
function voices() {
  if (!('speechSynthesis' in self)) return Promise.resolve([]);
  voicesReady ??= new Promise((resolve) => {
    const now = speechSynthesis.getVoices();
    if (now.length) return resolve(now);
    const done = () => resolve(speechSynthesis.getVoices());
    speechSynthesis.addEventListener('voiceschanged', done, { once: true });
    setTimeout(done, 1200);
  });
  return voicesReady;
}

/** Best voice for a language code, or null. Never falls back to a voice in another language. */
export async function findVoice(code) {
  const want = (BY_CODE[code]?.speech ?? code).toLowerCase();
  const base = want.split('-')[0];
  const list = await voices();
  const lang = (v) => v.lang.toLowerCase().replace('_', '-');
  const pool = list.filter((v) => lang(v) === want || lang(v).split('-')[0] === base || (base === 'no' && lang(v).startsWith('nb')));
  if (!pool.length) return null;
  return pool.find((v) => lang(v) === want && v.localService) ?? pool.find((v) => lang(v) === want) ?? pool.find((v) => v.localService) ?? pool[0];
}

export async function speak(text, code) {
  if (!('speechSynthesis' in self)) return { ok: false, reason: 'unsupported' };
  const voice = await findVoice(code);
  if (!voice) return { ok: false, reason: 'no-voice' };
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.voice = voice;
  u.lang = voice.lang;
  u.rate = 0.95;
  return new Promise((resolve) => {
    u.onend = () => resolve({ ok: true });
    u.onerror = (e) => resolve({ ok: e.error === 'canceled' || e.error === 'interrupted', reason: e.error });
    speechSynthesis.speak(u);
  });
}

export const stopSpeaking = () => { if ('speechSynthesis' in self) speechSynthesis.cancel(); };
