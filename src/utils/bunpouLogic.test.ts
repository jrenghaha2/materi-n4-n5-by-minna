import assert from 'node:assert/strict';
import test from 'node:test';
import {
  ALL_MINNA_PATTERNS,
  MINNA_ABBREVIATIONS,
  MINNA_BOOKS,
  N4_BOOK_DATA,
  N5_BOOK_DATA,
} from '../data/minnaDataset.ts';
import {
  ALL_KOTOBA_WORDS,
  N4_KOTOBA_CHAPTERS,
  N4_KOTOBA_WORDS,
  N5_KOTOBA_CHAPTERS,
  N5_KOTOBA_WORDS,
} from '../data/minnaKotobaData.ts';
import {
  buildRecent7Days,
  calculateCurrentStreak,
  createEmptyDailyTrackerState,
  recordMasteredToggleForDay,
  recordQuizSessionForDay,
} from './dailyProgress.ts';
import { tokenizeFormula } from './formulaTokenizer.ts';
import {
  alignKanjiReading,
  buildKotobaRubySegments,
  buildRubySegments,
  stripFuriganaMarkup,
  toKanaReading,
} from './furiganaConverter.ts';
import { buildRubySafeCloze, extractGrammarTargets, generateQuizQuestions } from './quizGenerator.ts';
import { mergePatternSets, sanitizePatternIds } from './bunpouSync.ts';

const BARE_KANJI_REGEX = /[\u4e00-\u9faf\u3400-\u4dbf々]/;
const KATAKANA_ONLY_RUBY_REGEX = /\{([\u30a0-\u30ffー・]+)\|[^}]+\}/;

test('dataset contains 2 separate books (N5 Bab 1-25 and N4 Bab 26-50) with 4 varied reibun per pattern', () => {
  assert.equal(MINNA_BOOKS.length, 2);
  assert.equal(N5_BOOK_DATA.id, 'n5');
  assert.equal(N4_BOOK_DATA.id, 'n4');
  assert.equal(N5_BOOK_DATA.chapters.length, 25);
  assert.equal(N4_BOOK_DATA.chapters.length, 25);
  assert.equal(N5_BOOK_DATA.chapters[0].chapter, 1);
  assert.equal(N5_BOOK_DATA.chapters[24].chapter, 25);
  assert.equal(N4_BOOK_DATA.chapters[0].chapter, 26);
  assert.equal(N4_BOOK_DATA.chapters[24].chapter, 50);

  assert.ok(N5_BOOK_DATA.totalPatterns === 101, `Expected 101 N5 patterns, got ${N5_BOOK_DATA.totalPatterns}`);
  assert.ok(N4_BOOK_DATA.totalPatterns === 84, `Expected 84 N4 patterns, got ${N4_BOOK_DATA.totalPatterns}`);
  assert.equal(ALL_MINNA_PATTERNS.length, 185);
  assert.ok(MINNA_ABBREVIATIONS.length >= 16);

  const seenIds = new Set<string>();
  for (const p of ALL_MINNA_PATTERNS) {
    assert.ok(!seenIds.has(p.id), `Duplicate pattern ID: ${p.id}`);
    seenIds.add(p.id);
    assert.ok(p.formulas.length >= 1, `Missing formula for ${p.id}`);
    assert.ok(p.examples.length >= 4, `Pattern ${p.id} has fewer than 4 reibun (${p.examples.length})`);

    for (const ex of p.examples) {
      assert.ok(ex.japanese.trim().length > 0, `Empty Japanese example in ${p.id}`);
      assert.ok(ex.indonesian.trim().length > 0, `Empty Indonesian translation in ${p.id}`);
    }
  }
});

test('all example sentences and pattern titles have zero bare kanji outside ruby markup and zero katakana-only ruby', () => {
  const bareKanjiViolations: string[] = [];
  const katakanaRubyViolations: string[] = [];

  for (const p of ALL_MINNA_PATTERNS) {
    const checkField = (label: string, text: string) => {
      if (KATAKANA_ONLY_RUBY_REGEX.test(text)) {
        katakanaRubyViolations.push(`${label}: ${text}`);
      }
      const segments = buildRubySegments(text);
      for (const seg of segments) {
        if (!seg.reading && BARE_KANJI_REGEX.test(seg.text)) {
          bareKanjiViolations.push(`${label} -> "${seg.text}" in "${text}"`);
        }
      }
    };

    checkField(`${p.id} [title]`, p.title);
    p.examples.forEach((ex, idx) => {
      checkField(`${p.id} [ex ${idx + 1}]`, ex.japanese);
    });
  }

  assert.deepEqual(katakanaRubyViolations, [], `Katakana-only ruby found:\n${katakanaRubyViolations.join('\n')}`);
  assert.deepEqual(bareKanjiViolations, [], `Bare kanji outside ruby found:\n${bareKanjiViolations.slice(0, 20).join('\n')}`);
});

test('furigana converter parses, strips, and converts to kana cleanly', () => {
  const sample = '{日本語|にほんご}を {勉強|べんきょう}します。';
  assert.equal(stripFuriganaMarkup(sample), '日本語を 勉強します。');
  assert.equal(toKanaReading(sample), 'にほんごを べんきょうします。');
  const segs = buildRubySegments(sample);
  assert.equal(segs[0].text, '日本語');
  assert.equal(segs[0].reading, 'にほんご');
});

test('formula tokenizer highlights Minna POS, forms, operators, and particles', () => {
  const tokens = tokenizeFormula('KB1 は KK (F.て) + ください');
  assert.ok(tokens.some(t => t.text === 'KB1' && t.kind === 'pos'));
  assert.ok(tokens.some(t => t.text === 'F.て' && t.kind === 'form'));
  assert.ok(tokens.some(t => t.text === 'ください' && t.kind === 'particle'));
  assert.ok(tokens.some(t => t.text.includes('+') && t.kind === 'operator'));

  const desuTokens = tokenizeFormula('KB1 は KB2 です');
  assert.ok(
    desuTokens.some(t => t.text === 'です' && t.kind === 'particle'),
    `Expected です as single particle token, got: ${JSON.stringify(desuTokens)}`
  );
  assert.ok(!desuTokens.some(t => t.text === 'で'));
});

test('cloze builder masks grammar targets without breaking ruby markup', () => {
  const sentence = '{映画|えいが}を {見|み}たことが あります。';
  const res = buildRubySafeCloze(sentence, 'ことが あります');
  assert.ok(res !== null);
  assert.ok(res!.clozeMarkup.includes('{映画|えいが}'));
  assert.ok(res!.clozeMarkup.includes('（　　）'));
  assert.ok(!res!.clozeMarkup.includes('{|'));
});

test('quiz generator builds valid questions across all 3 modes for both N5 and N4', () => {
  for (const book of MINNA_BOOKS) {
    const minCh = book.chapters[0].chapter;
    const maxCh = book.chapters[book.chapters.length - 1].chapter;

    for (const mode of ['meaning', 'cloze', 'pattern'] as const) {
      const questions = generateQuizQuestions(book.patterns, {
        bookId: book.id,
        mode,
        fromChapter: minCh,
        toChapter: maxCh,
        questionCount: 10,
        onlyDifficult: false,
        onlyUnmastered: false,
        masteredSet: new Set(),
        difficultSet: new Set(),
      });
      assert.equal(questions.length, 10);
      for (const q of questions) {
        assert.equal(q.choices.length, 4);
        assert.ok(q.choices.some(c => c.id === q.correctChoiceId));
        assert.ok(extractGrammarTargets(book.patterns[0]).length > 0);
      }
    }
  }
});

test('daily memorization progress tracker calculates streak, daily count, and 7-day summary accurately', () => {
  let state = createEmptyDailyTrackerState(3);
  state = recordMasteredToggleForDay(state, 'n5-bab-1-p1', true, '2026-05-01');
  state = recordMasteredToggleForDay(state, 'n5-bab-1-p2', true, '2026-05-02');
  state = recordMasteredToggleForDay(state, 'n5-bab-1-p3', true, '2026-05-03');
  state = recordMasteredToggleForDay(state, 'n5-bab-1-p4', true, '2026-05-03');
  state = recordMasteredToggleForDay(state, 'n5-bab-1-p5', true, '2026-05-03');
  state = recordQuizSessionForDay(state, '2026-05-03');

  assert.equal(calculateCurrentStreak(state, '2026-05-03'), 3);
  const recent = buildRecent7Days(state, '2026-05-03');
  assert.equal(recent.length, 7);
  const today = recent[6];
  assert.equal(today.isToday, true);
  assert.equal(today.masteredCount, 3);
  assert.equal(today.quizSessions, 1);
  assert.equal(today.goalMet, true);

  // Toggling off removes it from today's count
  state = recordMasteredToggleForDay(state, 'n5-bab-1-p5', false, '2026-05-03');
  assert.equal(state.days['2026-05-03'].masteredIds.length, 2);
});

test('pattern ID sanitization enforces strict book isolation', () => {
  const cleanN5 = sanitizePatternIds(['n5-bab-1-p1', 'n4-bab-26-p1', 'invalid-id'], 'n5');
  assert.deepEqual(cleanN5, ['n5-bab-1-p1']);

  const mergedN4 = mergePatternSets(['n4-bab-26-p1'], ['n4-bab-50-p1', 'n5-bab-1-p1'], 'n4');
  assert.deepEqual(Array.from(mergedN4).sort(), ['n4-bab-26-p1', 'n4-bab-50-p1']);
});

test('kotoba dataset contains all 50 chapters (N5 Bab 1-25 and N4 Bab 26-50) with 1,281 unique vocabulary cards', () => {
  assert.equal(N5_KOTOBA_CHAPTERS.length, 25);
  assert.equal(N4_KOTOBA_CHAPTERS.length, 25);
  assert.equal(N5_KOTOBA_WORDS.length, 851);
  assert.equal(N4_KOTOBA_WORDS.length, 430);
  assert.equal(ALL_KOTOBA_WORDS.length, 1281);

  const ids = new Set<string>();
  for (const w of ALL_KOTOBA_WORDS) {
    assert.ok(!ids.has(w.id), `Duplicate kotoba ID: ${w.id}`);
    ids.add(w.id);
    assert.ok(w.reading.length > 0);
    assert.ok(w.meaning.length > 0);
    if (w.bookId === 'n5') {
      assert.ok(w.chapter >= 1 && w.chapter <= 25);
    } else {
      assert.ok(w.chapter >= 26 && w.chapter <= 50);
    }
  }
});

test('furigana alignment places ruby strictly over kanji only and never over okurigana (します, ます, い, に, お, etc.)', () => {
  const KANA_CHAR_REGEX = /[\u3040-\u309f\u30a0-\u30ff]/;

  // Explicit okurigana regression checks
  assert.deepEqual(alignKanjiReading('勉強します', 'べんきょうします'), [
    { text: '勉強', reading: 'べんきょう' },
    { text: 'します' },
  ]);
  assert.deepEqual(alignKanjiReading('探します', 'さがします'), [
    { text: '探', reading: 'さが' },
    { text: 'します' },
  ]);
  assert.deepEqual(alignKanjiReading('間に合います', 'まにあいます'), [
    { text: '間', reading: 'ま' },
    { text: 'に' },
    { text: '合', reading: 'あ' },
    { text: 'います' },
  ]);
  assert.deepEqual(buildKotobaRubySegments('あの人・あの方', 'あのひと / あのかた'), [
    { text: 'あの' },
    { text: '人', reading: 'ひと' },
    { text: '・' },
    { text: 'あの' },
    { text: '方', reading: 'かた' },
  ]);
  assert.deepEqual(buildKotobaRubySegments('お手洗い', 'トイレ / おてあらい'), [
    { text: 'お' },
    { text: '手洗', reading: 'てあら' },
    { text: 'い' },
  ]);
  assert.deepEqual(buildRubySegments('{勉強します|べんきょうします}'), [
    { text: '勉強', reading: 'べんきょう' },
    { text: 'します' },
  ]);

  // Exhaustive check across ALL 1,281 Kotoba words: zero kana inside any ruby base
  for (const w of ALL_KOTOBA_WORDS) {
    if (!w.kanji) continue;
    const segs = buildKotobaRubySegments(w.kanji, w.reading);
    for (const seg of segs) {
      if (seg.reading) {
        assert.ok(
          !KANA_CHAR_REGEX.test(seg.text),
          `Okurigana/kana leaked into ruby base for ${w.id} (${w.kanji} <= ${w.reading}): ${JSON.stringify(segs)}`
        );
      }
    }
  }

  // Exhaustive check across ALL 185 Bunpou titles & 740 reibun: zero kana inside any ruby base
  for (const p of ALL_MINNA_PATTERNS) {
    for (const text of [p.title, ...p.examples.map(e => e.japanese)]) {
      const segs = buildRubySegments(text);
      for (const seg of segs) {
        if (seg.reading) {
          assert.ok(
            !KANA_CHAR_REGEX.test(seg.text),
            `Okurigana/kana leaked into Bunpou ruby base in ${p.id}: ${JSON.stringify(seg)} from "${text}"`
          );
        }
      }
    }
  }
});
