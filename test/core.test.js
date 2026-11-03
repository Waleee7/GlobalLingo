// Run with:  node --test test/
// Pure logic only (tiers, cache, phrasebook, chunking, rewards). No install, no network.
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  ENGINES, TranslateError, normalize, fold, decodeEntities, chunkText, createPhrasebook, createCache,
  createQuotaMeter, createMyMemory, parseMyMemory, detectLanguage, translate, MM_MAX_BYTES,
} from '../src/js/translate-core.js';
import { PHRASEBOOK, PHRASE_IDS } from '../src/js/phrasebook.js';
import { LANGUAGES, COUNTRY_LANG } from '../src/js/languages.js';
import { recordTranslation, freshState, streakInfo, rankFor, dayKey, DAILY_GOAL } from '../src/js/rewards.js';

const memoryStorage = () => {
  const m = new Map();
  return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) };
};
const book = createPhrasebook(PHRASEBOOK, PHRASE_IDS);
const mmJson = (text, extra = {}) => ({ responseData: { translatedText: text, match: 0.9 }, responseStatus: 200, quotaFinished: false, ...extra });
const mmClient = (bodyFn, meter) => createMyMemory({
  fetchImpl: async (url) => ({ status: 200, ok: true, json: async () => bodyFn(new URL(url)) }),
  meter,
});

function deps(overrides = {}) {
  const storage = memoryStorage();
  return {
    cache: createCache(storage), phrasebook: book, meter: createQuotaMeter(storage), online: () => true,
    onDevice: null, myMemory: null, ...overrides,
  };
}

// ------------------------------------------------------------------ phrasebook integrity

test('phrasebook: every supported language has a table of the right shape', () => {
  for (const l of LANGUAGES) {
    assert.ok(PHRASEBOOK[l.code], `missing phrasebook for ${l.code}`);
    assert.equal(PHRASEBOOK[l.code].length, PHRASE_IDS.length, `${l.code} length`);
    assert.ok(book.coverage(l.code) >= 10, `${l.code} should cover at least 10 phrases`);
  }
  for (const code of Object.keys(PHRASEBOOK)) assert.ok(LANGUAGES.some((l) => l.code === code), `${code} not a supported language`);
});

test('phrasebook: no entry is blank or left as untranslated English', () => {
  for (const [lang, rows] of Object.entries(PHRASEBOOK)) {
    rows.forEach((t, i) => {
      if (t == null) return;
      assert.equal(typeof t, 'string');
      assert.ok(t.trim().length > 0, `${lang}[${i}] blank`);
      // True cognates that really are spelled the same; anything else matching English is a copy-paste bug.
      const sameOnPurpose = ['es.no', 'it.no', 'nl.help'];
      if (lang !== 'en' && fold(t) === fold(PHRASEBOOK.en[i])) assert.ok(sameOnPurpose.includes(`${lang}.${PHRASE_IDS[i]}`), `${lang}.${PHRASE_IDS[i]} looks untranslated: ${t}`);
    });
  }
});

test('phrasebook: lookup ignores case, punctuation and accents', () => {
  assert.equal(book.lookup('where is the bathroom', 'en', 'es').text, '¿Dónde está el baño?');
  assert.equal(book.lookup('  THANK YOU!! ', 'en', 'de').text, 'Danke');
  assert.equal(book.lookup('ou est la gare', 'fr', 'ja').text, '駅はどこですか？');
  assert.equal(book.lookup('Gracias', 'es', 'en').text, 'Thank you');
});

test('phrasebook: unknown phrases return null instead of guessing', () => {
  assert.equal(book.lookup('The cat is on the roof', 'en', 'es'), null);
  assert.equal(book.lookup('Hello', 'en', 'xx'), null);
});

test('every mapped country resolves to a supported language', () => {
  const codes = new Set(LANGUAGES.map((l) => l.code));
  for (const [, code] of COUNTRY_LANG) assert.ok(codes.has(code));
  for (const l of LANGUAGES) assert.ok(l.countries.includes(l.home), `${l.code} home must be one of its countries`);
});

// ------------------------------------------------------------------ helpers

test('normalize / decodeEntities / chunkText', () => {
  assert.equal(normalize('  Où   est… la gare ?! '), 'où est la gare');
  assert.equal(normalize('You’re welcome.'), "you're welcome");
  assert.equal(decodeEntities('l&#39;eau &amp; &quot;vin&quot; &#x41;'), 'l\'eau & "vin" A');
  assert.deepEqual(chunkText('  '), []);
  assert.deepEqual(chunkText('Short one.'), ['Short one.']);

  const long = Array.from({ length: 40 }, (_, i) => `Sentence number ${i} is here.`).join(' ');
  const parts = chunkText(long);
  assert.ok(parts.length > 1);
  for (const p of parts) assert.ok(new TextEncoder().encode(p).length <= MM_MAX_BYTES);
  assert.equal(parts.join(' ').replace(/\s+/g, ' '), long);

  const cjk = '你好。'.repeat(300);
  for (const p of chunkText(cjk)) assert.ok(new TextEncoder().encode(p).length <= MM_MAX_BYTES);
  const noBreaks = 'a'.repeat(1200);
  assert.equal(chunkText(noBreaks).join(''), noBreaks);
});

// ------------------------------------------------------------------ detection

test('detectLanguage: scripts, phrasebook, stop words, and honest nulls', () => {
  assert.equal(detectLanguage('こんにちは世界').lang, 'ja');
  assert.equal(detectLanguage('안녕하세요').lang, 'ko');
  assert.equal(detectLanguage('你好吗').lang, 'zh');
  assert.equal(detectLanguage('Привіт, як справи? Їжа').lang, 'uk');
  assert.equal(detectLanguage('Добрый день').lang, 'ru');
  assert.equal(detectLanguage('שלום').lang, 'he');
  assert.equal(detectLanguage('¿Dónde está el baño?', { phrasebook: book }).lang, 'es');
  assert.equal(detectLanguage('Ich habe keine Ahnung, wo das ist und ich bin müde').lang, 'de');
  assert.equal(detectLanguage('Où est la gare').lang, 'fr');
  assert.equal(detectLanguage('xqzv', { phrasebook: book }), null);
  assert.equal(detectLanguage('   '), null);
  // "No" is a real word in several languages: only the user's preferred ones may win.
  assert.equal(detectLanguage('No', { phrasebook: book })?.lang ?? null, null);
  assert.equal(detectLanguage('No', { phrasebook: book, prefer: ['es'] }).lang, 'es');
});

// ------------------------------------------------------------------ cache

test('cache: stores, normalises keys, expires, and evicts oldest', () => {
  let t = 1000;
  const cache = createCache(memoryStorage(), { max: 3, ttl: 100, now: () => t });
  cache.set('en', 'es', 'Hello!', { text: 'Hola', engine: ENGINES.MYMEMORY });
  assert.equal(cache.get('en', 'es', ' hello ').text, 'Hola');
  assert.equal(cache.get('en', 'fr', 'hello'), null);
  t += 101;
  assert.equal(cache.get('en', 'es', 'hello'), null, 'expired');

  t = 2000;
  for (const w of ['a', 'b', 'c', 'd']) { cache.set('en', 'es', w, { text: w, engine: ENGINES.DEVICE }); t += 1; }
  assert.equal(cache.size(), 3);
  assert.equal(cache.get('en', 'es', 'a'), null, 'oldest evicted');
  assert.equal(cache.get('en', 'es', 'd').text, 'd');
});

test('cache survives corrupt storage', () => {
  const s = memoryStorage(); s.setItem('gl2:cache', '{nope');
  const cache = createCache(s);
  assert.equal(cache.get('en', 'es', 'x'), null);
  cache.set('en', 'es', 'x', { text: 'y', engine: ENGINES.DEVICE });
  assert.equal(cache.get('en', 'es', 'x').text, 'y');
});

// ------------------------------------------------------------------ MyMemory parsing

test('parseMyMemory: ok, entities, quota, invalid pair, empty', () => {
  assert.equal(parseMyMemory(mmJson('L&#39;eau')).text, "L'eau");
  assert.throws(() => parseMyMemory(mmJson('MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY.', { responseStatus: 200 })), { kind: 'quota' });
  assert.throws(() => parseMyMemory(mmJson('x', { quotaFinished: true })), { kind: 'quota' });
  assert.throws(() => parseMyMemory(mmJson('', { responseStatus: 429 })), { kind: 'quota' });
  assert.throws(() => parseMyMemory(mmJson("'xx' IS AN INVALID TARGET LANGUAGE", { responseStatus: 403 })), { kind: 'unsupported' });
  assert.throws(() => parseMyMemory(mmJson('x', { responseStatus: '500', responseDetails: 'boom' })), { kind: 'rejected' });
  assert.throws(() => parseMyMemory(mmJson('  ')), { kind: 'empty-result' });
  assert.equal(parseMyMemory(mmJson('hola'), 'Hola').echoed, true);
});

test('MyMemory client: chunks long text, sends the right langpair, counts characters', async () => {
  const storage = memoryStorage();
  const meter = createQuotaMeter(storage);
  const seen = [];
  const client = mmClient((u) => { seen.push(u); return mmJson(`T:${u.searchParams.get('q').length}`); }, meter);
  const long = Array.from({ length: 30 }, (_, i) => `This is sentence ${i}.`).join(' ');
  const r = await client.translate(long, 'en', 'zh');
  assert.ok(seen.length > 1);
  assert.equal(seen[0].searchParams.get('langpair'), 'en|zh');
  assert.ok(r.text.startsWith('T:'));
  assert.equal(meter.state().chars, long.length - (seen.length - 1)); // joining spaces are dropped between chunks
});

test('MyMemory client: HTTP 429 blocks the meter; network failure is a clean error', async () => {
  const meter = createQuotaMeter(memoryStorage());
  const limited = createMyMemory({ fetchImpl: async () => ({ status: 429, json: async () => ({}) }), meter });
  await assert.rejects(limited.translate('hi', 'en', 'es'), { kind: 'quota' });
  assert.equal(meter.isBlocked(), true);

  const down = createMyMemory({ fetchImpl: async () => { throw new TypeError('Failed to fetch'); } });
  await assert.rejects(down.translate('hi', 'en', 'es'), { kind: 'network' });
});

// ------------------------------------------------------------------ the tiers

test('tier order: on-device wins when it can, and the engine says so', async () => {
  let mmCalls = 0;
  const d = deps({
    onDevice: { availability: async () => 'available', translate: async (t) => `[device] ${t}` },
    myMemory: { translate: async () => { mmCalls++; return { text: 'mm', match: 1 }; } },
  });
  const r = await translate({ text: 'Good evening', from: 'en', to: 'es' }, d);
  assert.deepEqual([r.engine, r.text, r.cached, mmCalls], [ENGINES.DEVICE, '[device] Good evening', false, 0]);
});

test('tier order: unavailable on-device pair falls through to MyMemory', async () => {
  const d = deps({
    onDevice: { availability: async () => 'unavailable', translate: async () => { throw new Error('should not run'); } },
    myMemory: { translate: async () => ({ text: 'Buenas noches', match: 0.9 }) },
  });
  const r = await translate({ text: 'Good evening', from: 'en', to: 'es' }, d);
  assert.equal(r.engine, ENGINES.MYMEMORY);
  assert.ok(r.notes.some((n) => /no on-device model/i.test(n)));
});

test('tier order: on-device throwing falls through, and passes download progress through', async () => {
  const progress = [];
  const d = deps({
    onProgress: (f) => progress.push(f),
    onDevice: { availability: async () => 'downloadable', translate: async (t, f, to, p) => { p(0.5); throw new Error('NotAllowedError'); } },
    myMemory: { translate: async () => ({ text: 'ok', match: 0.9 }) },
  });
  const r = await translate({ text: 'Something new here', from: 'en', to: 'fr' }, d);
  assert.equal(r.engine, ENGINES.MYMEMORY);
  assert.deepEqual(progress, [0.5]);
  assert.ok(r.notes.some((n) => /On-device translation failed/.test(n)));
});

test('MyMemory results are cached and replayed with the original engine', async () => {
  let calls = 0;
  const d = deps({ myMemory: { translate: async () => { calls++; return { text: 'Hola mundo', match: 0.9 }; } } });
  const a = await translate({ text: 'Hello world', from: 'en', to: 'es' }, d);
  const b = await translate({ text: ' hello world! ', from: 'en', to: 'es' }, d);
  assert.deepEqual([a.cached, b.cached, b.engine, b.text, calls], [false, true, ENGINES.MYMEMORY, 'Hola mundo', 1]);
});

test('quota hit: falls back to the phrasebook when it knows the phrase, and stops calling MyMemory', async () => {
  const storage = memoryStorage();
  const meter = createQuotaMeter(storage);
  const client = mmClient(() => mmJson('MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY'), meter);
  const d = deps({ myMemory: client, meter, cache: createCache(storage) });
  const r = await translate({ text: 'Thank you', from: 'en', to: 'ja' }, d);
  assert.equal(r.engine, ENGINES.PHRASEBOOK);
  assert.equal(r.text, 'ありがとうございます');
  assert.ok(r.notes.some((n) => /daily limit/i.test(n)));
  assert.equal(meter.isBlocked(), true);

  let hits = 0;
  const spy = { translate: async () => { hits++; return { text: 'x', match: 1 }; } };
  await assert.rejects(translate({ text: 'A brand new sentence', from: 'en', to: 'ja' }, { ...d, myMemory: spy }), { kind: 'quota' });
  assert.equal(hits, 0, 'blocked meter must skip MyMemory');
});

test('offline: MyMemory is skipped, phrasebook answers, unknown text gives an honest error', async () => {
  let called = false;
  const d = deps({ online: () => false, myMemory: { translate: async () => { called = true; } } });
  const ok = await translate({ text: 'Where is the train station?', from: 'en', to: 'de' }, d);
  assert.equal(ok.engine, ENGINES.PHRASEBOOK);
  assert.equal(ok.text, 'Wo ist der Bahnhof?');
  assert.equal(called, false);
  await assert.rejects(translate({ text: 'My cousin lives near the lake', from: 'en', to: 'de' }, d), (e) => e.kind === 'network' && /phrasebook only covers/.test(e.message));
});

test('curated phrasebook beats a disagreeing MyMemory answer for the exact same phrase', async () => {
  // Real-world case: MyMemory returned a wrong sentence for "Where is the train station?" in Arabic.
  const d = deps({ myMemory: { translate: async () => ({ text: 'ركب قطاراً متجه إلى سكوتري', match: 0.99 }) } });
  const r = await translate({ text: 'Where is the train station?', from: 'en', to: 'ar' }, d);
  assert.equal(r.engine, ENGINES.PHRASEBOOK);
  assert.equal(r.text, 'أين محطة القطار؟');
  assert.ok(r.notes.some((n) => /differed/.test(n)));
});

test('low-confidence and echoed MyMemory answers are flagged, not hidden', async () => {
  const low = deps({ myMemory: { translate: async () => ({ text: 'hmm', match: 0.2, echoed: false }) } });
  const r = await translate({ text: 'Unusual sentence here', from: 'en', to: 'es' }, low);
  assert.equal(r.lowConfidence, true);
  assert.ok(r.notes.some((n) => /not confident/.test(n)));
  const echo = deps({ myMemory: { translate: async () => ({ text: 'Unusual sentence here', match: 1, echoed: true }) } });
  const e = await translate({ text: 'Unusual sentence here', from: 'en', to: 'es' }, echo);
  assert.equal(e.lowConfidence, true);
});

test('input validation', async () => {
  const d = deps();
  await assert.rejects(translate({ text: '   ', from: 'en', to: 'es' }, d), { kind: 'empty' });
  await assert.rejects(translate({ text: 'hi', from: 'es', to: 'es' }, d), { kind: 'same' });
  await assert.rejects(translate({ text: 'x'.repeat(5000), from: 'en', to: 'es' }, d), { kind: 'rejected' });
  assert.ok(new TranslateError('x', 'y') instanceof Error);
});

// ------------------------------------------------------------------ rewards

const at = (iso) => new Date(`${iso}T10:00:00`);
const run = (state, when, text = 'Good morning my friend', to = 'es') =>
  recordTranslation(state, { from: 'en', to, text, result: 'x', engine: ENGINES.DEVICE }, at(when));

test('rewards: XP, first stamp, repeats earn nothing', () => {
  let r = run(freshState(), '2026-03-02');
  assert.equal(r.xp, 10 + 20); // 4 words + new stamp
  assert.equal(r.newStamp, true);
  r = run(r.state, '2026-03-02');
  assert.equal(r.repeat, true);
  assert.equal(r.xp, 0);
  r = run(r.state, '2026-03-02', 'Thanks');
  assert.equal(r.xp, 5);
  assert.equal(r.newStamp, false);
});

test('rewards: streak needs the daily goal, survives until midnight, then breaks', () => {
  let s = freshState();
  for (const d of ['2026-03-02', '2026-03-03', '2026-03-04']) {
    s = run(s, d, 'one').state;
    const r = run(s, d, 'two');
    s = r.state;
    assert.equal(r.goalMet, true);
  }
  assert.equal(streakInfo(s, at('2026-03-04')).count, 3);
  const nextMorning = streakInfo(s, at('2026-03-05'));
  assert.deepEqual([nextMorning.count, nextMorning.atRisk], [3, true]);
  assert.equal(streakInfo(s, at('2026-03-06')).count, 0, 'a missed day breaks it');
  assert.equal(streakInfo(s, at('2026-03-06')).best, 3, 'but the best run is remembered');
  assert.equal(DAILY_GOAL, 2);
});

test('rewards: one translation is not enough for the day, milestones fire once', () => {
  const a = run(freshState(), '2026-03-02');
  assert.equal(streakInfo(a.state, at('2026-03-02')).count, 0);
  assert.deepEqual(a.milestones.map((m) => m.id), ['first']);
  const b = run(a.state, '2026-03-02', 'Thanks');
  assert.deepEqual(b.milestones, []);
});

test('rewards: ranks and state is not mutated', () => {
  assert.equal(rankFor(0).name, 'Tourist');
  assert.equal(rankFor(320).name, 'Local');
  assert.equal(rankFor(5000).next, null);
  const s = freshState(); const copy = JSON.stringify(s);
  run(s, '2026-03-02');
  assert.equal(JSON.stringify(s), copy);
  assert.equal(dayKey(at('2026-03-02')), '2026-03-02');
});
