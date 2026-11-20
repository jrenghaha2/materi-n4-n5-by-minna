import assert from 'node:assert/strict';
import test from 'node:test';
import {
  BACKUP_APP_ID,
  buildBackupPayload,
  createEmptyAllBooksProgress,
  createEmptyAllQuizHistory,
  parseBackupJson,
} from './storage.ts';

test('buildBackupPayload and parseBackupJson round-trip N5/N4 progress and quiz history safely', () => {
  const progress = createEmptyAllBooksProgress();
  progress.n5.mastered.add('n5-bab-1-p1');
  progress.n5.difficult.add('n5-bab-14-p1');
  progress.n4.mastered.add('n4-bab-26-p1');
  progress.n4.mastered.add('n4-bab-50-p3');

  const history = createEmptyAllQuizHistory();
  history.n5.push({
    id: 'qz_test_001',
    bookId: 'n5',
    mode: 'cloze',
    fromChapter: 1,
    toChapter: 10,
    totalQuestions: 5,
    correctCount: 4,
    wrongPatternIds: ['n5-bab-4-p1'],
    correctPatternIds: ['n5-bab-1-p1', 'n5-bab-2-p1', 'n5-bab-3-p1', 'n5-bab-5-p1'],
    completedAt: '2026-05-03T10:00:00.000Z',
  });

  const payload = buildBackupPayload(progress, history);
  assert.equal(payload.app, BACKUP_APP_ID);

  const parsed = parseBackupJson(JSON.stringify(payload));
  assert.equal(parsed.totalMastered, 3);
  assert.equal(parsed.totalDifficult, 1);
  assert.equal(parsed.totalQuizSessions, 1);
  assert.ok(parsed.progress.n5.mastered.has('n5-bab-1-p1'));
  assert.ok(parsed.progress.n4.mastered.has('n4-bab-50-p3'));
});

test('parseBackupJson rejects foreign app backups and invalid JSON', () => {
  assert.throws(() => parseBackupJson('not json'), /JSON/);
  assert.throws(
    () => parseBackupJson(JSON.stringify({ app: 'other-app', books: {} })),
    /Minna Bunpou/
  );
});
