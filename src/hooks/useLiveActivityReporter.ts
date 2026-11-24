import { useCallback, useEffect, useRef } from 'react';
import type { User } from 'firebase/auth';
import {
  logActivityEvent,
  upsertLiveActivityDoc,
  type UpsertLiveActivityPayload,
} from '../services/adminMonitoringService';
import type {
  ActiveTab,
  AllBooksProgress,
  AllBooksQuizHistory,
  BookId,
  LiveActivityStatus,
  LiveQuizAnswerCorrect,
  LiveQuizState,
  QuizMode,
  QuizSavedAnswer,
  QuizSessionRecord,
  UserProfileDoc,
  UserRole,
} from '../types/bunpou';
import { normalizeEmail } from '../utils/rbac';

const DEBOUNCE_MS = 250;
const HEARTBEAT_MS = 45_000;

function formatQuizModeLabel(mode: QuizMode | ''): string {
  if (mode === 'cloze') return 'Lengkapi Kalimat';
  if (mode === 'pattern') return 'Tebak Pola';
  if (mode === 'meaning') return 'Tebak Arti';
  return 'Kuis';
}

function buildModuleLabel(
  activeTab: ActiveTab,
  activeBookId: BookId,
  liveQuiz: LiveQuizState
): string {
  const bookLabel = activeBookId.toUpperCase();
  if (liveQuiz.inProgress && liveQuiz.bookId) {
    const qBook = liveQuiz.bookId.toUpperCase();
    return `Kuis ${qBook} · ${formatQuizModeLabel(liveQuiz.mode)}`;
  }
  switch (activeTab) {
    case 'flashcard':
      return `Flashcard Bunpou · ${bookLabel}`;
    case 'kotoba':
      return `Flashcard Kotoba · ${bookLabel}`;
    case 'list':
      return `Daftar Bunpou · ${bookLabel}`;
    case 'quiz':
      return `Menu Kuis · ${bookLabel}`;
    case 'info':
      return 'Singkatan & Info';
    case 'admin':
      return 'Panel Pemantauan';
    default:
      return `Belajar · ${bookLabel}`;
  }
}

function resolveActivityStatus(activeTab: ActiveTab, liveQuiz: LiveQuizState): LiveActivityStatus {
  if (liveQuiz.inProgress) return 'quizzing';
  if (activeTab === 'flashcard' || activeTab === 'kotoba' || activeTab === 'list') {
    return 'studying';
  }
  return 'browsing';
}

function computeLatestQuizMeta(quizHistory: AllBooksQuizHistory): {
  totalQuizSessions: number;
  lastQuizScore: number;
  lastQuizSummary: string;
} {
  const all = [...quizHistory.n5, ...quizHistory.n4].sort((a, b) =>
    b.completedAt.localeCompare(a.completedAt)
  );
  const latest = all[0];
  if (!latest) {
    return {
      totalQuizSessions: 0,
      lastQuizScore: -1,
      lastQuizSummary: '',
    };
  }
  const pct =
    latest.totalQuestions > 0
      ? Math.round((latest.correctCount / latest.totalQuestions) * 100)
      : 0;
  return {
    totalQuizSessions: all.length,
    lastQuizScore: pct,
    lastQuizSummary: `${latest.bookId.toUpperCase()} · ${formatQuizModeLabel(latest.mode)} · ${
      latest.correctCount
    }/${latest.totalQuestions} (${pct}%)`,
  };
}

const EMPTY_LIVE_QUIZ: LiveQuizState = {
  inProgress: false,
  bookId: '',
  mode: '',
  fromChapter: 0,
  toChapter: 0,
  currentQuestion: 0,
  totalQuestions: 0,
  correctCount: 0,
  patternId: '',
  exampleIndex: 0,
  choiceIds: [],
  selectedChoiceId: '',
  answerCorrect: -1,
  liveAnswers: [],
};

interface UseLiveActivityReporterOptions {
  user: User | null;
  isVerified: boolean;
  profileReady: boolean;
  profile: UserProfileDoc | null;
  role: UserRole;
  activeTab: ActiveTab;
  activeBookId: BookId;
  booksProgress: AllBooksProgress;
  kotobaProgress: AllBooksProgress;
  quizHistory: AllBooksQuizHistory;
  currentStreak: number;
}

export function useLiveActivityReporter({
  user,
  isVerified,
  profileReady,
  profile,
  role,
  activeTab,
  activeBookId,
  booksProgress,
  kotobaProgress,
  quizHistory,
  currentStreak,
}: UseLiveActivityReporterOptions) {
  const liveQuizRef = useRef<LiveQuizState>(EMPTY_LIVE_QUIZ);
  const debounceTimerRef = useRef<number | null>(null);
  const latestSnapshotRef = useRef<{
    uid: string;
    payload: UpsertLiveActivityPayload;
  } | null>(null);

  const canReport = Boolean(user && isVerified && profileReady);

  const displayName =
    profile?.displayName ||
    user?.displayName ||
    user?.email?.split('@')[0] ||
    'Pengguna';
  const email = normalizeEmail(user?.email || profile?.email || '');
  const avatarUrl = profile?.avatarUrl || user?.photoURL || '';

  const totalMasteredBunpou =
    booksProgress.n5.mastered.size + booksProgress.n4.mastered.size;
  const totalMasteredKotoba =
    kotobaProgress.n5.mastered.size + kotobaProgress.n4.mastered.size;
  const totalMastered = totalMasteredBunpou + totalMasteredKotoba;
  const { totalQuizSessions, lastQuizScore, lastQuizSummary } =
    computeLatestQuizMeta(quizHistory);

  const buildPayload = useCallback(
    (quizOverride?: LiveQuizState): UpsertLiveActivityPayload => {
      const q = quizOverride ?? liveQuizRef.current;
      return {
        displayName,
        email,
        avatarUrl,
        role,
        status: resolveActivityStatus(activeTab, q),
        activeTab,
        activeBookId,
        moduleLabel: buildModuleLabel(activeTab, activeBookId, q),
        quizInProgress: q.inProgress,
        quizMode: q.inProgress ? q.mode : '',
        quizBookId: q.inProgress ? q.bookId : '',
        quizCurrentQuestion: q.inProgress ? q.currentQuestion : 0,
        quizTotalQuestions: q.inProgress ? q.totalQuestions : 0,
        quizCorrectCount: q.inProgress ? q.correctCount : 0,
        quizFromChapter: q.inProgress ? q.fromChapter : 0,
        quizToChapter: q.inProgress ? q.toChapter : 0,
        quizPatternId: q.inProgress ? q.patternId : '',
        quizExampleIndex: q.inProgress ? q.exampleIndex : 0,
        quizChoiceIds: q.inProgress ? q.choiceIds : [],
        quizSelectedChoiceId: q.inProgress ? q.selectedChoiceId : '',
        quizAnswerCorrect: q.inProgress ? q.answerCorrect : -1,
        quizLiveAnswers: q.inProgress ? q.liveAnswers : [],
        totalMasteredBunpou,
        totalMasteredKotoba,
        totalMastered,
        totalQuizSessions,
        lastQuizScore,
        lastQuizSummary,
        currentStreak,
      };
    },
    [
      displayName,
      email,
      avatarUrl,
      role,
      activeTab,
      activeBookId,
      totalMasteredBunpou,
      totalMasteredKotoba,
      totalMastered,
      totalQuizSessions,
      lastQuizScore,
      lastQuizSummary,
      currentStreak,
    ]
  );

  const flushNow = useCallback(
    (quizOverride?: LiveQuizState) => {
      if (!canReport || !user) return;
      if (debounceTimerRef.current !== null) {
        window.clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }
      const payload = buildPayload(quizOverride);
      latestSnapshotRef.current = { uid: user.uid, payload };
      void upsertLiveActivityDoc(user.uid, payload).catch(() => {
        // Non-blocking telemetry: ignore transient offline or quota errors
      });
    },
    [canReport, user, buildPayload]
  );

  // Debounced sync whenever tab, book, progress, or profile updates
  useEffect(() => {
    if (!canReport || !user) return;
    latestSnapshotRef.current = { uid: user.uid, payload: buildPayload() };

    if (debounceTimerRef.current !== null) {
      window.clearTimeout(debounceTimerRef.current);
    }
    debounceTimerRef.current = window.setTimeout(() => {
      debounceTimerRef.current = null;
      const freshPayload = buildPayload();
      latestSnapshotRef.current = { uid: user.uid, payload: freshPayload };
      void upsertLiveActivityDoc(user.uid, freshPayload).catch(() => {});
    }, DEBOUNCE_MS);

    return () => {
      if (debounceTimerRef.current !== null) {
        window.clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }
    };
  }, [canReport, user, buildPayload]);

  // Lightweight heartbeat so online status (<= 2 min) & active quizzes stay fresh
  useEffect(() => {
    if (!canReport || !user) return;

    const sendHeartbeat = () => {
      const hidden = typeof document !== 'undefined' && document.visibilityState === 'hidden';
      // Keep heartbeat running during an active quiz even if learner briefly switches browser tabs
      if (hidden && !liveQuizRef.current.inProgress) return;
      const snap = latestSnapshotRef.current;
      if (!snap || snap.uid !== user.uid) return;
      void upsertLiveActivityDoc(snap.uid, snap.payload).catch(() => {});
    };

    const intervalId = window.setInterval(sendHeartbeat, HEARTBEAT_MS);
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        sendHeartbeat();
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [canReport, user]);

  const reportQuizStarted = useCallback(
    (info: {
      bookId: BookId;
      mode: QuizMode;
      fromChapter: number;
      toChapter: number;
      totalQuestions: number;
      patternId: string;
      exampleIndex: number;
      choiceIds: string[];
    }) => {
      const nextQuiz: LiveQuizState = {
        inProgress: true,
        bookId: info.bookId,
        mode: info.mode,
        fromChapter: info.fromChapter,
        toChapter: info.toChapter,
        currentQuestion: 1,
        totalQuestions: info.totalQuestions,
        correctCount: 0,
        patternId: info.patternId,
        exampleIndex: info.exampleIndex,
        choiceIds: info.choiceIds,
        selectedChoiceId: '',
        answerCorrect: -1,
        liveAnswers: [],
      };
      liveQuizRef.current = nextQuiz;
      flushNow(nextQuiz);

      if (!canReport || !user) return;
      const scope =
        info.fromChapter === info.toChapter
          ? `Bab ${info.fromChapter}`
          : `Bab ${info.fromChapter}–${info.toChapter}`;
      void logActivityEvent({
        uid: user.uid,
        displayName,
        email,
        type: 'quiz_started',
        bookId: info.bookId,
        title: `Mulai Kuis ${info.bookId.toUpperCase()} · ${formatQuizModeLabel(info.mode)}`,
        detail: `${scope} · ${info.totalQuestions} soal`,
        score: -1,
        correctCount: 0,
        totalQuestions: info.totalQuestions,
      }).catch(() => {});
    },
    [canReport, user, displayName, email, flushNow]
  );

  const reportQuizProgress = useCallback(
    (info: {
      bookId: BookId;
      mode: QuizMode;
      fromChapter: number;
      toChapter: number;
      currentQuestion: number;
      totalQuestions: number;
      correctCount: number;
      patternId: string;
      exampleIndex: number;
      choiceIds: string[];
      selectedChoiceId: string;
      answerCorrect: LiveQuizAnswerCorrect;
      liveAnswers: QuizSavedAnswer[];
    }) => {
      const nextQuiz: LiveQuizState = {
        inProgress: true,
        bookId: info.bookId,
        mode: info.mode,
        fromChapter: info.fromChapter,
        toChapter: info.toChapter,
        currentQuestion: info.currentQuestion,
        totalQuestions: info.totalQuestions,
        correctCount: info.correctCount,
        patternId: info.patternId,
        exampleIndex: info.exampleIndex,
        choiceIds: info.choiceIds,
        selectedChoiceId: info.selectedChoiceId,
        answerCorrect: info.answerCorrect,
        liveAnswers: info.liveAnswers,
      };
      liveQuizRef.current = nextQuiz;
      flushNow(nextQuiz);
    },
    [flushNow]
  );

  const reportQuizAborted = useCallback(() => {
    if (!liveQuizRef.current.inProgress) return;
    liveQuizRef.current = EMPTY_LIVE_QUIZ;
    flushNow(EMPTY_LIVE_QUIZ);
  }, [flushNow]);

  const reportQuizCompleted = useCallback(
    (record: QuizSessionRecord) => {
      liveQuizRef.current = EMPTY_LIVE_QUIZ;

      const pct =
        record.totalQuestions > 0
          ? Math.round((record.correctCount / record.totalQuestions) * 100)
          : 0;
      const scope =
        record.fromChapter === record.toChapter
          ? `Bab ${record.fromChapter}`
          : `Bab ${record.fromChapter}–${record.toChapter}`;

      if (!canReport || !user) return;
      if (debounceTimerRef.current !== null) {
        window.clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }

      const nextPayload: UpsertLiveActivityPayload = {
        ...buildPayload(EMPTY_LIVE_QUIZ),
        totalQuizSessions: totalQuizSessions + 1,
        lastQuizScore: pct,
        lastQuizSummary: `${record.bookId.toUpperCase()} · ${formatQuizModeLabel(
          record.mode
        )} · ${record.correctCount}/${record.totalQuestions} (${pct}%)`,
      };
      latestSnapshotRef.current = { uid: user.uid, payload: nextPayload };
      void upsertLiveActivityDoc(user.uid, nextPayload).catch(() => {});

      void logActivityEvent({
        uid: user.uid,
        displayName,
        email,
        type: 'quiz_completed',
        bookId: record.bookId,
        title: `Selesai Kuis ${record.bookId.toUpperCase()} · ${formatQuizModeLabel(record.mode)}`,
        detail: `${scope} · Skor ${record.correctCount}/${record.totalQuestions} (${pct}%)`,
        score: pct,
        correctCount: record.correctCount,
        totalQuestions: record.totalQuestions,
      }).catch(() => {});
    },
    [canReport, user, displayName, email, buildPayload, totalQuizSessions]
  );

  const reportProgressMilestone = useCallback(
    (bookId: BookId, category: 'bunpou' | 'kotoba', nextBookCount: number) => {
      if (!canReport || !user) return;
      // Record first mastery and every 5th mastered item per category/book to keep feed meaningful
      if (nextBookCount !== 1 && nextBookCount % 5 !== 0) return;

      const label = category === 'bunpou' ? 'Bunpou' : 'Kotoba';
      void logActivityEvent({
        uid: user.uid,
        displayName,
        email,
        type: 'progress_milestone',
        bookId,
        title: `Pencapaian ${label} ${bookId.toUpperCase()}`,
        detail: `Menguasai ${nextBookCount} ${
          category === 'bunpou' ? 'pola tata bahasa' : 'kosakata'
        } ${bookId.toUpperCase()}`,
        score: -1,
        correctCount: 0,
        totalQuestions: 0,
      }).catch(() => {});
    },
    [canReport, user, displayName, email]
  );

  return {
    reportQuizStarted,
    reportQuizProgress,
    reportQuizAborted,
    reportQuizCompleted,
    reportProgressMilestone,
  };
}
