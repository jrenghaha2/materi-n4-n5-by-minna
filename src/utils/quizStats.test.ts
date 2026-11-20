import assert from 'node:assert/strict';
import test from 'node:test';
import { N4_BOOK_DATA, N5_BOOK_DATA } from '../data/minnaDataset.ts';
import {
  computeQuizOverviewStats,
  mergeQuizHistory,
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

test('mergeQuizHistory deduplicates by ID and computes weak pattern/chapter stats', () => {
  const s1 = sanitizeQuizSessionRecord(
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

  const merged = mergeQuizHistory([s1], [s1, s2], 'n5');
  assert.equal(merged.length, 2);
  assert.equal(merged[0].id, 'qz_m2');

  const stats = computeQuizOverviewStats(merged, N5_BOOK_DATA.patterns);
  assert.equal(stats.totalSessions, 2);
  assert.equal(stats.averageAccuracy, 70);
  assert.equal(stats.bestAccuracy, 80);
  assert.equal(stats.weakPatterns[0].pattern.id, 'n5-bab-4-p1');
  assert.equal(stats.weakPatterns[0].wrongCount, 2);
  assert.equal(stats.weakChapters[0].chapter, 4);
  assert.ok(N4_BOOK_DATA.patterns.length > 0);
});
