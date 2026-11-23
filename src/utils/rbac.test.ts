import assert from 'node:assert/strict';
import test from 'node:test';
import type { AdminUserRecord, HydratedUserStats, LiveActivityDoc } from '../types/bunpou.ts';
import { shouldFlipOnCardClick } from './cardFlipGuard.ts';
import {
  BOOTSTRAP_SUPERADMIN_EMAIL,
  canModifyTargetRole,
  computeAdminKpis,
  filterAndSortMonitoredUsers,
  formatProgressPercent,
  getPresenceStatus,
  getRoleLabel,
  isAdminOrAboveRole,
  isBootstrapSuperAdminEmail,
  isSuperAdminRole,
  mergeUserMonitoringRow,
  resolveEffectiveRole,
} from './rbac.ts';

test('3-tier RBAC resolves bootstrap superadmin only when email is verified', () => {
  assert.equal(BOOTSTRAP_SUPERADMIN_EMAIL, 'jrenghaha2@gmail.com');
  assert.equal(isBootstrapSuperAdminEmail('JRENGHAHA2@GMAIL.COM'), true);
  assert.equal(isBootstrapSuperAdminEmail('other@gmail.com'), false);

  // Verified bootstrap email always resolves to superadmin
  assert.equal(resolveEffectiveRole('user', 'jrenghaha2@gmail.com', true), 'superadmin');
  assert.equal(resolveEffectiveRole(undefined, 'JRENGHAHA2@gmail.com', true), 'superadmin');

  // Unverified bootstrap email MUST NOT gain superadmin privileges
  assert.equal(resolveEffectiveRole('user', 'jrenghaha2@gmail.com', false), 'user');

  // Stored roles for other users
  assert.equal(resolveEffectiveRole('admin', 'admin@example.com', true), 'admin');
  assert.equal(resolveEffectiveRole('superadmin', 'co@example.com', true), 'superadmin');
  assert.equal(resolveEffectiveRole('invalid-role', 'learner@example.com', true), 'user');

  assert.equal(isSuperAdminRole('superadmin'), true);
  assert.equal(isSuperAdminRole('admin'), false);
  assert.equal(isAdminOrAboveRole('superadmin'), true);
  assert.equal(isAdminOrAboveRole('admin'), true);
  assert.equal(isAdminOrAboveRole('user'), false);

  assert.equal(getRoleLabel('superadmin'), 'Superadmin');
  assert.equal(getRoleLabel('admin'), 'Admin (Pantau)');
  assert.equal(getRoleLabel('user'), 'Pembelajar');
});

test('canModifyTargetRole permanently protects bootstrap superadmin, blocks self-edit, and blocks regular admins', () => {
  const bootstrapTarget = {
    uid: 'uid-bootstrap',
    email: 'jrenghaha2@gmail.com',
    role: 'superadmin' as const,
  };
  const learnerTarget = {
    uid: 'uid-learner',
    email: 'siswa@example.com',
    role: 'user' as const,
  };
  const adminTarget = {
    uid: 'uid-admin',
    email: 'pantau@example.com',
    role: 'admin' as const,
  };

  // Regular user & Admin cannot modify any role
  assert.equal(canModifyTargetRole('uid-user', 'user', learnerTarget).allowed, false);
  assert.equal(canModifyTargetRole('uid-admin', 'admin', learnerTarget).allowed, false);

  // Superadmin cannot edit self
  assert.equal(canModifyTargetRole('uid-bootstrap', 'superadmin', bootstrapTarget).allowed, false);
  assert.equal(
    canModifyTargetRole('uid-co-super', 'superadmin', {
      uid: 'uid-co-super',
      email: 'co@example.com',
      role: 'superadmin',
    }).allowed,
    false
  );

  // Another Superadmin CANNOT modify/demote Bootstrap Superadmin (jrenghaha2@gmail.com)
  const bootstrapGuard = canModifyTargetRole('uid-co-super', 'superadmin', bootstrapTarget);
  assert.equal(bootstrapGuard.allowed, false);
  assert.ok(bootstrapGuard.reason?.includes('Superadmin Utama'));

  // Superadmin CAN promote/demote other users & admins
  assert.equal(canModifyTargetRole('uid-bootstrap', 'superadmin', learnerTarget).allowed, true);
  assert.equal(canModifyTargetRole('uid-bootstrap', 'superadmin', adminTarget).allowed, true);
});

test('presence, legacy hydration merge, KPI calculation, and 5-mode sorting work accurately', () => {
  const now = 1_700_000_000_000;

  assert.equal(getPresenceStatus(now - 30_000, now), 'online');
  assert.equal(getPresenceStatus(now - 120_000, now), 'online');
  assert.equal(getPresenceStatus(now - 5 * 60_000, now), 'recent');
  assert.equal(getPresenceStatus(now - 20 * 60_000, now), 'offline');
  assert.equal(getPresenceStatus(null, now), 'offline');

  const users: AdminUserRecord[] = [
    {
      uid: 'u1',
      displayName: 'Budi Santoso',
      email: 'budi@example.com',
      avatarUrl: '',
      role: 'user',
      createdAtMs: now - 10_000_000,
      updatedAtMs: now - 30_000,
    },
    {
      uid: 'u2',
      displayName: 'Ayu Lestari',
      email: 'ayu@example.com',
      avatarUrl: '',
      role: 'admin',
      createdAtMs: now - 20_000_000,
      updatedAtMs: now - 500_000,
    },
    {
      uid: 'u3',
      displayName: 'Citra Wijaya',
      email: 'citra@example.com',
      avatarUrl: '',
      role: 'user',
      createdAtMs: now - 30_000_000,
      updatedAtMs: now - 5_000_000,
    },
  ];

  const liveU1: LiveActivityDoc = {
    uid: 'u1',
    displayName: 'Budi Santoso',
    email: 'budi@example.com',
    avatarUrl: '',
    role: 'user',
    status: 'quizzing',
    activeTab: 'quiz',
    activeBookId: 'n5',
    moduleLabel: 'Kuis N5 · Tebak Arti',
    quizInProgress: true,
    quizMode: 'meaning',
    quizBookId: 'n5',
    quizCurrentQuestion: 4,
    quizTotalQuestions: 10,
    quizCorrectCount: 3,
    quizFromChapter: 1,
    quizToChapter: 25,
    quizPatternId: 'n5-bab-14-p1',
    quizExampleIndex: 1,
    quizChoiceIds: ['n5-bab-14-p1', 'n5-bab-15-p1', 'n5-bab-16-p1', 'n5-bab-17-p1'],
    quizSelectedChoiceId: 'n5-bab-14-p1',
    quizAnswerCorrect: 1,
    quizLiveAnswers: [
      {
        questionNo: 1,
        mode: 'meaning',
        patternId: 'n5-bab-1-p1',
        selectedPatternId: 'n5-bab-1-p1',
        isCorrect: true,
        exampleIndex: 0,
      },
    ],
    totalMasteredBunpou: 20,
    totalMasteredKotoba: 50,
    totalMastered: 70,
    totalQuizSessions: 6,
    lastQuizScore: 90,
    lastQuizSummary: 'N5 · Tebak Arti · 9/10 (90%)',
    currentStreak: 4,
    updatedAtMs: now - 25_000, // Online
  };

  // Legacy user u3 has NO liveActivity doc, only hydrated stats
  const hydratedU3: HydratedUserStats = {
    uid: 'u3',
    totalMasteredBunpou: 45,
    totalMasteredKotoba: 120,
    totalMastered: 165,
    totalQuizSessions: 14,
    lastQuizScore: 80,
    lastQuizSummary: 'N4 · Lengkapi Kalimat · 8/10 (80%)',
    currentStreak: 2,
    lastActivityMs: now - 2_000_000,
  };

  const rows = [
    mergeUserMonitoringRow(users[0], liveU1, undefined, now),
    mergeUserMonitoringRow(users[1], undefined, undefined, now),
    mergeUserMonitoringRow(users[2], undefined, hydratedU3, now),
  ];

  // Live quiz detail passthrough check
  assert.equal(rows[0].quizPatternId, 'n5-bab-14-p1');
  assert.deepEqual(rows[0].quizChoiceIds, [
    'n5-bab-14-p1',
    'n5-bab-15-p1',
    'n5-bab-16-p1',
    'n5-bab-17-p1',
  ]);
  assert.equal(rows[0].quizSelectedChoiceId, 'n5-bab-14-p1');
  assert.equal(rows[0].quizAnswerCorrect, 1);
  assert.equal(rows[0].quizLiveAnswers.length, 1);

  // Legacy hydration check
  assert.equal(rows[2].hydratedFromLegacy, true);
  assert.equal(rows[2].totalMastered, 165);
  assert.equal(rows[2].totalQuizSessions, 14);

  // KPI check: accumulates live + hydrated legacy quiz sessions
  const kpis = computeAdminKpis(rows);
  assert.equal(kpis.onlineCount, 1);
  assert.equal(kpis.quizzingCount, 1);
  assert.equal(kpis.totalUsers, 3);
  assert.equal(kpis.totalQuizSessions, 20); // 6 (live u1) + 0 (u2) + 14 (legacy u3)

  // All 5 sort options
  assert.deepEqual(
    filterAndSortMonitoredUsers(rows, { sortBy: 'latest' }).map(r => r.uid),
    ['u1', 'u2', 'u3']
  );
  assert.deepEqual(
    filterAndSortMonitoredUsers(rows, { sortBy: 'name_asc' }).map(r => r.uid),
    ['u2', 'u1', 'u3']
  );
  assert.deepEqual(
    filterAndSortMonitoredUsers(rows, { sortBy: 'name_desc' }).map(r => r.uid),
    ['u3', 'u1', 'u2']
  );
  assert.deepEqual(
    filterAndSortMonitoredUsers(rows, { sortBy: 'progress_desc' }).map(r => r.uid),
    ['u3', 'u1', 'u2']
  );
  assert.deepEqual(
    filterAndSortMonitoredUsers(rows, { sortBy: 'quiz_desc' }).map(r => r.uid),
    ['u3', 'u1', 'u2']
  );

  // Search & role/presence filters
  assert.deepEqual(
    filterAndSortMonitoredUsers(rows, { search: 'citra', sortBy: 'latest' }).map(r => r.uid),
    ['u3']
  );
  assert.deepEqual(
    filterAndSortMonitoredUsers(rows, { roleFilter: 'admin', sortBy: 'latest' }).map(r => r.uid),
    ['u2']
  );
  assert.deepEqual(
    filterAndSortMonitoredUsers(rows, { presenceFilter: 'quizzing', sortBy: 'latest' }).map(
      r => r.uid
    ),
    ['u1']
  );
});

test('formatProgressPercent shows non-zero decimal percent and visible bar from the very first mastered item', () => {
  assert.deepEqual(formatProgressPercent(0, 851), { label: '0%', barWidthPct: 0 });

  const oneOf851 = formatProgressPercent(1, 851);
  assert.equal(oneOf851.label, '0.1%');
  assert.ok(oneOf851.barWidthPct >= 1.5);

  const fourOf851 = formatProgressPercent(4, 851);
  assert.equal(fourOf851.label, '0.5%');
  assert.ok(fourOf851.barWidthPct >= 1.5);

  const fourOf430 = formatProgressPercent(4, 430);
  assert.equal(fourOf430.label, '0.9%');
  assert.ok(fourOf430.barWidthPct >= 1.5);

  const tenOf851 = formatProgressPercent(10, 851);
  assert.equal(tenOf851.label, '1%');
  assert.ok(tenOf851.barWidthPct > 1);

  assert.deepEqual(formatProgressPercent(101, 101), { label: '100%', barWidthPct: 100 });
});

test('shouldFlipOnCardClick flips on clean click anywhere but never blocks text selection or interactive buttons', () => {
  // Clean single click anywhere on card
  assert.equal(
    shouldFlipOnCardClick({
      isInteractiveTarget: false,
      hadSelectionOnPointerDown: false,
      currentSelectionText: '',
      startPoint: { x: 120, y: 200 },
      endPoint: { x: 122, y: 201 },
    }),
    true
  );

  // Dragging across Japanese characters (> 6px) must NOT flip
  assert.equal(
    shouldFlipOnCardClick({
      isInteractiveTarget: false,
      hadSelectionOnPointerDown: false,
      currentSelectionText: '',
      startPoint: { x: 100, y: 200 },
      endPoint: { x: 145, y: 202 },
    }),
    false
  );

  // Active text selection must NOT flip
  assert.equal(
    shouldFlipOnCardClick({
      isInteractiveTarget: false,
      hadSelectionOnPointerDown: false,
      currentSelectionText: '〜ように',
      startPoint: { x: 100, y: 200 },
      endPoint: { x: 100, y: 200 },
    }),
    false
  );

  // Clicking to clear a previously highlighted selection must NOT flip on that click
  assert.equal(
    shouldFlipOnCardClick({
      isInteractiveTarget: false,
      hadSelectionOnPointerDown: true,
      currentSelectionText: '',
      startPoint: { x: 100, y: 200 },
      endPoint: { x: 100, y: 200 },
    }),
    false
  );

  // Double-clicking a word to select it must NOT flip
  assert.equal(
    shouldFlipOnCardClick({
      isInteractiveTarget: false,
      hadSelectionOnPointerDown: false,
      currentSelectionText: '',
      startPoint: { x: 100, y: 200 },
      endPoint: { x: 100, y: 200 },
      clickDetail: 2,
    }),
    false
  );

  // Clicking nested interactive controls (AudioButton / Depan button) must NOT double-flip
  assert.equal(
    shouldFlipOnCardClick({
      isInteractiveTarget: true,
      hadSelectionOnPointerDown: false,
      currentSelectionText: '',
      startPoint: { x: 100, y: 200 },
      endPoint: { x: 100, y: 200 },
    }),
    false
  );
});
