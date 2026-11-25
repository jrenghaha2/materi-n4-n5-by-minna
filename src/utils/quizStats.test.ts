import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { N4_BOOK_DATA, N5_BOOK_DATA } from '../data/minnaDataset.ts';
import {
  computeLiveQuizWrongCount,
  computeQuizOverviewStats,
  decodeLiveQuizAnswers,
  encodeLiveQuizAnswers,
  mergeQuizHistory,
  reconstructLiveQuizQuestion,
  reconstructSessionReview,
  sanitizeQuizSessionRecord,
} from './quizStats.ts';

test('sanitizeQuizSessionRecord validates N5 (Bab 1-25) and N4 (Bab 26-50) bounds strictly', () => {
  const validN5 = sanitizeQuizSessionRecord(
    {
      id: 'qz_valid_n5',
      bookId: 'n5',
      mode: 'meaning',
      fromChapter: 1,
      toChapter: 25,
      totalQuestions: 10,
      correctCount: 8,
      wrongPatternIds: ['n5-bab-14-p1', 'n4-bab-26-p1'], // foreign n4 ID must be stripped
      correctPatternIds: ['n5-bab-1-p1'],
      completedAt: '2026-05-03T12:00:00.000Z',
    },
    'n5'
  );
  assert.ok(validN5 !== null);
  assert.deepEqual(validN5!.wrongPatternIds, ['n5-bab-14-p1']);

  // N5 cannot accept Bab 26
  const invalidChapter = sanitizeQuizSessionRecord(
    {
      id: 'qz_bad_ch',
      bookId: 'n5',
      mode: 'meaning',
      fromChapter: 1,
      toChapter: 26,
      totalQuestions: 5,
      correctCount: 5,
      wrongPatternIds: [],
      correctPatternIds: [],
      completedAt: '2026-05-03T12:00:00.000Z',
    },
    'n5'
  );
  assert.equal(invalidChapter, null);

  // N4 accepts Bab 26..50
  const validN4 = sanitizeQuizSessionRecord(
    {
      id: 'qz_valid_n4',
      bookId: 'n4',
      mode: 'pattern',
      fromChapter: 26,
      toChapter: 50,
      totalQuestions: 15,
      correctCount: 12,
      wrongPatternIds: ['n4-bab-49-p3'],
      correctPatternIds: ['n4-bab-26-p1'],
      completedAt: '2026-05-03T13:00:00.000Z',
    },
    'n4'
  );
  assert.ok(validN4 !== null);
});

test('mergeQuizHistory deduplicates by ID, prefers richer V2 detailed answers, and computes weak stats', () => {
  const s1Legacy = sanitizeQuizSessionRecord(
    {
      id: 'qz_m1',
      bookId: 'n5',
      mode: 'meaning',
      fromChapter: 1,
      toChapter: 5,
      totalQuestions: 5,
      correctCount: 3,
      wrongPatternIds: ['n5-bab-4-p1', 'n5-bab-4-p2'],
      correctPatternIds: ['n5-bab-1-p1', 'n5-bab-2-p1', 'n5-bab-3-p1'],
      completedAt: '2026-05-01T10:00:00.000Z',
    },
    'n5'
  )!;
  const s1Detailed = sanitizeQuizSessionRecord(
    {
      ...s1Legacy,
      answers: [
        {
          questionNo: 1,
          mode: 'meaning',
          patternId: 'n5-bab-4-p1',
          selectedPatternId: 'n5-bab-3-p1',
          isCorrect: false,
          exampleIndex: 2,
        },
      ],
    },
    'n5'
  )!;
  const s2 = sanitizeQuizSessionRecord(
    {
      id: 'qz_m2',
      bookId: 'n5',
      mode: 'cloze',
      fromChapter: 1,
      toChapter: 5,
      totalQuestions: 5,
      correctCount: 4,
      wrongPatternIds: ['n5-bab-4-p1'],
      correctPatternIds: ['n5-bab-1-p1', 'n5-bab-2-p1', 'n5-bab-3-p1', 'n5-bab-5-p1'],
      completedAt: '2026-05-02T10:00:00.000Z',
    },
    'n5'
  )!;

  const merged = mergeQuizHistory([s1Legacy], [s1Detailed, s2], 'n5');
  assert.equal(merged.length, 2);
  assert.equal(merged[0].id, 'qz_m2');
  assert.equal(merged[1].id, 'qz_m1');
  assert.equal(merged[1].answers?.length, 1);
  assert.equal(merged[1].answers?.[0].selectedPatternId, 'n5-bab-3-p1');

  const stats = computeQuizOverviewStats(merged, N5_BOOK_DATA.patterns);
  assert.equal(stats.totalSessions, 2);
  assert.equal(stats.averageAccuracy, 70);
  assert.equal(stats.bestAccuracy, 80);
  assert.equal(stats.weakPatterns[0].pattern.id, 'n5-bab-4-p1');
  assert.equal(stats.weakPatterns[0].wrongCount, 2);
  assert.equal(stats.weakChapters[0].chapter, 4);
  assert.ok(N4_BOOK_DATA.patterns.length > 0);
});

test('reconstructSessionReview restores exact wrong choice, exampleIndex, and formulas for V2 sessions and handles V1 legacy sessions', () => {
  const v2Session = sanitizeQuizSessionRecord(
    {
      id: 'qz_v2_n4',
      bookId: 'n4',
      mode: 'meaning',
      fromChapter: 26,
      toChapter: 50,
      totalQuestions: 2,
      correctCount: 1,
      correctPatternIds: ['n4-bab-31-p3'],
      wrongPatternIds: ['n4-bab-36-p1'],
      answers: [
        {
          questionNo: 1,
          mode: 'meaning',
          patternId: 'n4-bab-31-p3',
          selectedPatternId: 'n4-bab-31-p3',
          isCorrect: true,
          exampleIndex: 1,
        },
        {
          questionNo: 2,
          mode: 'meaning',
          patternId: 'n4-bab-36-p1',
          selectedPatternId: 'n4-bab-36-p2',
          isCorrect: false,
          exampleIndex: 2,
        },
      ],
      completedAt: '2026-11-20T08:00:00.000Z',
    },
    'n4'
  )!;

  const review = reconstructSessionReview(v2Session, N4_BOOK_DATA.patterns);
  assert.equal(review.length, 2);
  assert.equal(review[0].isCorrect, true);
  assert.equal(review[0].question.patternId, 'n4-bab-31-p3');
  assert.equal(review[0].question.exampleIndex, 1);
  assert.ok(review[0].question.formulas && review[0].question.formulas.length >= 2);

  assert.equal(review[1].isCorrect, false);
  assert.equal(review[1].question.patternId, 'n4-bab-36-p1');
  assert.equal(review[1].selectedChoiceId, 'n4-bab-36-p2');
  assert.equal(review[1].question.exampleIndex, 2);
  assert.ok(review[1].question.choices.some(c => c.id === 'n4-bab-36-p2'));

  // Verify V2 cloud token string strictly matches firestore.rules N4 & N5 token regexes
  const rulesText = fs.readFileSync(new URL('../../firestore.rules', import.meta.url), 'utf8');
  const n5RegexMatch = rulesText.match(/function isValidN5QuizToken\(val\) \{[\s\S]*?val\.matches\('([^']+)'\)/);
  const n4RegexMatch = rulesText.match(/function isValidN4QuizToken\(val\) \{[\s\S]*?val\.matches\('([^']+)'\)/);
  assert.ok(n5RegexMatch && n4RegexMatch, 'Could not locate N5/N4 token regexes in firestore.rules');
  const n5RuleRegex = new RegExp(n5RegexMatch[1].replace(/\\\\/g, '\\'));
  const n4RuleRegex = new RegExp(n4RegexMatch[1].replace(/\\\\/g, '\\'));

  const n4PackedToken =
    'qz_v2_n4|2026-11-20T08:00:00.000Z|function|1|2|50|all|1:2:n4-bab-31-p3:1:n4-bab-31-p3:1;2:2:n4-bab-36-p1:0:n4-bab-36-p2:2';
  const n5PackedToken =
    'qz_v2_n5|2026-11-20T08:00:00.000Z|cloze|2|2|100|1.25|1:0:n5-bab-19-p2:1:n5-bab-19-p2:0;2:0:n5-bab-22-p3:1:n5-bab-22-p3:3';

  assert.ok(n4RuleRegex.test(n4PackedToken), `N4 V2 token rejected by firestore.rules: ${n4PackedToken}`);
  assert.ok(n5RuleRegex.test(n5PackedToken), `N5 V2 token rejected by firestore.rules: ${n5PackedToken}`);
  // Cross-book tokens must be rejected
  assert.equal(n4RuleRegex.test(n5PackedToken), false);
  assert.equal(n5RuleRegex.test(n4PackedToken), false);

  // Legacy V1 session without answers array still reconstructs cleanly
  const v1Session = sanitizeQuizSessionRecord(
    {
      id: 'qz_v1_n4',
      bookId: 'n4',
      mode: 'cloze',
      fromChapter: 26,
      toChapter: 35,
      totalQuestions: 2,
      correctCount: 1,
      correctPatternIds: ['n4-bab-26-p1'],
      wrongPatternIds: ['n4-bab-27-p1'],
      completedAt: '2026-11-19T08:00:00.000Z',
    },
    'n4'
  )!;
  const legacyReview = reconstructSessionReview(v1Session, N4_BOOK_DATA.patterns);
  assert.equal(legacyReview.length, 2);
  assert.equal(legacyReview[1].selectedChoiceId, '__legacy_wrong__');
});

test('reconstructLiveQuizQuestion restores exact 4-option order across meaning, cloze, and pattern modes and matches firestore.rules live token regex', () => {
  const choiceIds = ['n4-bab-36-p2', 'n4-bab-36-p1', 'n4-bab-36-p3', 'n4-bab-35-p1'];

  const meaningQ = reconstructLiveQuizQuestion({
    mode: 'meaning',
    patternId: 'n4-bab-36-p1',
    exampleIndex: 1,
    choiceIds,
    patterns: N4_BOOK_DATA.patterns,
  });
  assert.ok(meaningQ);
  assert.deepEqual(
    meaningQ!.choices.map(c => c.id),
    choiceIds
  );
  assert.equal(meaningQ!.correctChoiceId, 'n4-bab-36-p1');
  assert.equal(meaningQ!.choices[0].isJapanese, false);

  const clozeQ = reconstructLiveQuizQuestion({
    mode: 'cloze',
    patternId: 'n4-bab-36-p1',
    exampleIndex: 0,
    choiceIds,
    patterns: N4_BOOK_DATA.patterns,
  });
  assert.ok(clozeQ);
  assert.ok(clozeQ!.prompt.includes('（　　）'), 'Cloze live question should contain blank marker');
  assert.equal(clozeQ!.choices[1].isJapanese, true);

  const patternQ = reconstructLiveQuizQuestion({
    mode: 'pattern',
    patternId: 'n4-bab-36-p1',
    exampleIndex: 2,
    choiceIds,
    patterns: N4_BOOK_DATA.patterns,
  });
  assert.ok(patternQ);
  assert.equal(patternQ!.exampleIndex, 2);
  assert.equal(patternQ!.choices.length, 4);

  // Encode/decode roundtrip + strict verification against firestore.rules regex
  const encoded = encodeLiveQuizAnswers([
    {
      questionNo: 1,
      mode: 'meaning',
      patternId: 'n4-bab-36-p1',
      selectedPatternId: 'n4-bab-36-p2',
      isCorrect: false,
      exampleIndex: 1,
    },
    {
      questionNo: 2,
      mode: 'cloze',
      patternId: 'n4-bab-35-p1',
      selectedPatternId: 'n4-bab-35-p1',
      isCorrect: true,
      exampleIndex: 0,
    },
  ]);
  assert.equal(encoded.length, 2);

  const decoded = decodeLiveQuizAnswers(encoded);
  assert.equal(decoded.length, 2);
  assert.equal(decoded[0].selectedPatternId, 'n4-bab-36-p2');
  assert.equal(decoded[0].isCorrect, false);
  assert.equal(decoded[1].isCorrect, true);

  const rulesText = fs.readFileSync(new URL('../../firestore.rules', import.meta.url), 'utf8');
  const liveMatch = rulesText.match(
    /function isValidLiveQuizAnswers\(arr\) \{[\s\S]*?arr\.join\(';'\)\.matches\('([^']+)'\)/
  );
  assert.ok(liveMatch, 'Could not locate isValidLiveQuizAnswers regex in firestore.rules');
  const liveTokenRegex = new RegExp(liveMatch[1].replace(/\\\\/g, '\\'));
  assert.ok(
    liveTokenRegex.test(encoded.join(';')),
    `Live quiz answers rejected by firestore.rules: ${encoded.join(';')}`
  );
  for (const token of encoded) {
    assert.ok(token.length >= 25 && token.length <= 80, `Live token length out of bounds: ${token}`);
    assert.ok(liveTokenRegex.test(token), `Live quiz answer token rejected by firestore.rules: ${token}`);
  }

  // Wrong count computation matches both exact liveAnswers and fallback progress math
  assert.equal(computeLiveQuizWrongCount(decoded, 3, 1, -1), 1);
  assert.equal(computeLiveQuizWrongCount([], 9, 7, -1), 1);
  assert.equal(computeLiveQuizWrongCount([], 1, 0, 0), 1);
  assert.equal(computeLiveQuizWrongCount([], 1, 1, 1), 0);
  assert.equal(computeLiveQuizWrongCount([], 1, 0, -1), 0);
});
