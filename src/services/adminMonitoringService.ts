import {
  collection,
  doc,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  type Unsubscribe,
} from 'firebase/firestore';
import { db, logFirestoreError, OperationType } from '../firebase';
import type {
  ActiveTab,
  ActivityEventDoc,
  ActivityEventType,
  AdminUserRecord,
  BookId,
  HydratedUserStats,
  LiveActivityDoc,
  LiveActivityStatus,
  LiveQuizAnswerCorrect,
  QuizMode,
  QuizSavedAnswer,
  UserDetailReport,
  UserRole,
} from '../types/bunpou';
import { sanitizeAvatarUrl, sanitizeDisplayName } from '../utils/bunpouSync';
import { calculateCurrentStreak, formatLocalDateKey } from '../utils/dailyProgress';
import {
  decodeLiveQuizAnswers,
  encodeLiveQuizAnswers,
  isValidAnyBunpouPatternId,
} from '../utils/quizStats';
import { normalizeEmail, sanitizeUserRole } from '../utils/rbac';
import {
  fetchBookProgressDoc,
  fetchDailyTrackerDoc,
  fetchKotobaProgressDoc,
  fetchQuizHistoryDoc,
  subscribeBookProgressDoc,
  subscribeDailyTrackerDoc,
  subscribeKotobaProgressDoc,
  subscribeQuizHistoryDoc,
  type BookProgressPayload,
} from './cloudSyncService';
import type { DailyTrackerState, QuizSessionRecord } from '../types/bunpou';

function toMillis(value: unknown): number | null {
  if (value instanceof Timestamp) return value.toMillis();
  if (value && typeof value === 'object' && 'toMillis' in value) {
    try {
      const ms = (value as { toMillis: () => number }).toMillis();
      return Number.isFinite(ms) ? ms : null;
    } catch {
      return null;
    }
  }
  return null;
}

function sanitizeTab(raw: unknown): ActiveTab {
  if (
    raw === 'flashcard' ||
    raw === 'kotoba' ||
    raw === 'list' ||
    raw === 'quiz' ||
    raw === 'info' ||
    raw === 'admin'
  ) {
    return raw;
  }
  return 'flashcard';
}

function sanitizeStatus(raw: unknown): LiveActivityStatus {
  if (raw === 'browsing' || raw === 'studying' || raw === 'quizzing' || raw === 'idle') {
    return raw;
  }
  return 'browsing';
}

function sanitizeQuizModeOrEmpty(raw: unknown): QuizMode | '' {
  if (raw === 'meaning' || raw === 'cloze' || raw === 'pattern') return raw;
  return '';
}

function sanitizeBookIdOrEmpty(raw: unknown): BookId | '' {
  if (raw === 'n5' || raw === 'n4') return raw;
  return '';
}

function clampInt(raw: unknown, min: number, max: number, fallback = 0): number {
  if (typeof raw !== 'number' || !Number.isFinite(raw)) return fallback;
  return Math.max(min, Math.min(max, Math.floor(raw)));
}

function sanitizeOptionalPatternId(raw: unknown): string {
  return isValidAnyBunpouPatternId(raw) ? raw : '';
}

function sanitizeChoiceIds(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const item of raw) {
    if (!isValidAnyBunpouPatternId(item) || seen.has(item)) continue;
    seen.add(item);
    out.push(item);
    if (out.length >= 4) break;
  }
  return out;
}

function sanitizeAnswerCorrect(raw: unknown): LiveQuizAnswerCorrect {
  if (raw === 0 || raw === 1 || raw === -1) return raw;
  return -1;
}

export interface UpsertLiveActivityPayload {
  displayName: string;
  email: string;
  avatarUrl: string;
  role: UserRole;
  status: LiveActivityStatus;
  activeTab: ActiveTab;
  activeBookId: BookId;
  moduleLabel: string;
  quizInProgress: boolean;
  quizMode: QuizMode | '';
  quizBookId: BookId | '';
  quizCurrentQuestion: number;
  quizTotalQuestions: number;
  quizCorrectCount: number;
  quizFromChapter: number;
  quizToChapter: number;
  quizPatternId: string;
  quizExampleIndex: number;
  quizChoiceIds: string[];
  quizSelectedChoiceId: string;
  quizAnswerCorrect: LiveQuizAnswerCorrect;
  quizLiveAnswers: QuizSavedAnswer[];
  totalMasteredBunpou: number;
  totalMasteredKotoba: number;
  totalMastered: number;
  totalQuizSessions: number;
  lastQuizScore: number;
  lastQuizSummary: string;
  currentStreak: number;
}

const liveActivityInFlight = new Map<string, Promise<void>>();
const liveActivityPending = new Map<string, UpsertLiveActivityPayload>();
const LIVE_WRITE_TIMEOUT_MS = 8_000;

function buildLiveActivityFirestoreRecord(
  uid: string,
  payload: UpsertLiveActivityPayload,
  includeLiveAnswers = true
) {
  const activeQuiz = Boolean(payload.quizInProgress);
  return {
    uid,
    displayName: sanitizeDisplayName(payload.displayName, 'Pengguna'),
    email: normalizeEmail(payload.email),
    avatarUrl: sanitizeAvatarUrl(payload.avatarUrl),
    role: sanitizeUserRole(payload.role),
    status: sanitizeStatus(payload.status),
    activeTab: sanitizeTab(payload.activeTab),
    activeBookId: payload.activeBookId === 'n4' ? 'n4' : 'n5',
    moduleLabel: String(payload.moduleLabel || '').trim().slice(0, 80),
    quizInProgress: activeQuiz,
    quizMode: activeQuiz ? sanitizeQuizModeOrEmpty(payload.quizMode) : '',
    quizBookId: activeQuiz ? sanitizeBookIdOrEmpty(payload.quizBookId) : '',
    quizCurrentQuestion: activeQuiz ? clampInt(payload.quizCurrentQuestion, 0, 50, 0) : 0,
    quizTotalQuestions: activeQuiz ? clampInt(payload.quizTotalQuestions, 0, 50, 0) : 0,
    quizCorrectCount: activeQuiz ? clampInt(payload.quizCorrectCount, 0, 50, 0) : 0,
    quizFromChapter: activeQuiz ? clampInt(payload.quizFromChapter, 0, 50, 0) : 0,
    quizToChapter: activeQuiz ? clampInt(payload.quizToChapter, 0, 50, 0) : 0,
    quizPatternId: activeQuiz ? sanitizeOptionalPatternId(payload.quizPatternId) : '',
    quizExampleIndex: activeQuiz ? clampInt(payload.quizExampleIndex, 0, 3, 0) : 0,
    quizChoiceIds: activeQuiz ? sanitizeChoiceIds(payload.quizChoiceIds) : [],
    quizSelectedChoiceId: activeQuiz
      ? sanitizeOptionalPatternId(payload.quizSelectedChoiceId)
      : '',
    quizAnswerCorrect: activeQuiz ? sanitizeAnswerCorrect(payload.quizAnswerCorrect) : -1,
    quizLiveAnswers:
      activeQuiz && includeLiveAnswers ? encodeLiveQuizAnswers(payload.quizLiveAnswers) : [],
    totalMasteredBunpou: clampInt(payload.totalMasteredBunpou, 0, 300, 0),
    totalMasteredKotoba: clampInt(payload.totalMasteredKotoba, 0, 2000, 0),
    totalMastered: clampInt(payload.totalMastered, 0, 2300, 0),
    totalQuizSessions: clampInt(payload.totalQuizSessions, 0, 5000, 0),
    lastQuizScore: clampInt(payload.lastQuizScore, -1, 100, -1),
    lastQuizSummary: String(payload.lastQuizSummary || '').trim().slice(0, 120),
    currentStreak: clampInt(payload.currentStreak, 0, 999, 0),
    updatedAt: serverTimestamp(),
  };
}

function raceWithTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timerId = setTimeout(() => {
      reject(new Error(`Live activity write timed out after ${timeoutMs}ms`));
    }, timeoutMs);
    promise.then(
      val => {
        clearTimeout(timerId);
        resolve(val);
      },
      err => {
        clearTimeout(timerId);
        reject(err);
      }
    );
  });
}

async function writeLiveActivityDocNow(
  uid: string,
  payload: UpsertLiveActivityPayload
): Promise<void> {
  const path = `liveActivity/${uid}`;
  const docRef = doc(db, 'liveActivity', uid);
  const fullRecord = buildLiveActivityFirestoreRecord(uid, payload, true);
  try {
    await raceWithTimeout(setDoc(docRef, fullRecord), LIVE_WRITE_TIMEOUT_MS);
  } catch (error) {
    logFirestoreError(error, OperationType.WRITE, path);
    // Fallback: if an active quiz update with non-empty quizLiveAnswers fails,
    // immediately retry with quizLiveAnswers: [] so live question/choice/answer sync never freezes.
    if (fullRecord.quizInProgress && fullRecord.quizLiveAnswers.length > 0) {
      try {
        const fallbackRecord = buildLiveActivityFirestoreRecord(uid, payload, false);
        await raceWithTimeout(setDoc(docRef, fallbackRecord), LIVE_WRITE_TIMEOUT_MS);
        return;
      } catch (fallbackError) {
        logFirestoreError(fallbackError, OperationType.WRITE, path);
        throw fallbackError;
      }
    }
    throw error;
  }
}

export function upsertLiveActivityDoc(
  uid: string,
  payload: UpsertLiveActivityPayload
): Promise<void> {
  liveActivityPending.set(uid, payload);

  const existing = liveActivityInFlight.get(uid);
  if (existing) {
    return existing;
  }

  const run = (async () => {
    let lastError: unknown = null;
    try {
      while (liveActivityPending.has(uid)) {
        const nextPayload = liveActivityPending.get(uid)!;
        liveActivityPending.delete(uid);
        try {
          await writeLiveActivityDocNow(uid, nextPayload);
          lastError = null;
        } catch (err) {
          lastError = err;
        }
      }
    } finally {
      liveActivityInFlight.delete(uid);
    }
    if (lastError !== null) {
      throw lastError;
    }
  })();

  liveActivityInFlight.set(uid, run);
  return run;
}

export interface CreateActivityEventPayload {
  uid: string;
  displayName: string;
  email: string;
  type: ActivityEventType;
  bookId: BookId;
  title: string;
  detail: string;
  score: number;
  correctCount: number;
  totalQuestions: number;
}

export async function logActivityEvent(payload: CreateActivityEventPayload): Promise<void> {
  const randomSuffix = Math.random().toString(36).slice(2, 8);
  const eventId = `evt_${Date.now()}_${randomSuffix}`;
  const path = `activityEvents/${eventId}`;

  try {
    await setDoc(doc(db, 'activityEvents', eventId), {
      uid: payload.uid,
      displayName: sanitizeDisplayName(payload.displayName, 'Pengguna'),
      email: normalizeEmail(payload.email),
      type: payload.type,
      bookId: payload.bookId === 'n4' ? 'n4' : 'n5',
      title: String(payload.title || 'Aktivitas Belajar').trim().slice(0, 120) || 'Aktivitas Belajar',
      detail: String(payload.detail || '').trim().slice(0, 240),
      score: clampInt(payload.score, -1, 100, -1),
      correctCount: clampInt(payload.correctCount, 0, 50, 0),
      totalQuestions: clampInt(payload.totalQuestions, 0, 50, 0),
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    logFirestoreError(error, OperationType.CREATE, path);
    throw error;
  }
}

export function subscribeAllUsers(
  onData: (users: AdminUserRecord[]) => void,
  onError: (error: unknown) => void
): Unsubscribe {
  const path = 'users';
  return onSnapshot(
    collection(db, 'users'),
    snap => {
      const list: AdminUserRecord[] = [];
      snap.forEach(docSnap => {
        const data = docSnap.data() as Record<string, unknown>;
        list.push({
          uid: docSnap.id,
          displayName: sanitizeDisplayName(data.displayName, 'Pengguna'),
          email: normalizeEmail(typeof data.email === 'string' ? data.email : ''),
          avatarUrl: sanitizeAvatarUrl(data.avatarUrl),
          role: sanitizeUserRole(data.role),
          createdAtMs: toMillis(data.createdAt),
          updatedAtMs: toMillis(data.updatedAt),
        });
      });
      onData(list);
    },
    error => {
      logFirestoreError(error, OperationType.LIST, path);
      onError(error);
    }
  );
}

export function subscribeLiveActivities(
  onData: (activities: Map<string, LiveActivityDoc>) => void,
  onError: (error: unknown) => void
): Unsubscribe {
  const path = 'liveActivity';
  return onSnapshot(
    collection(db, 'liveActivity'),
    snap => {
      const map = new Map<string, LiveActivityDoc>();
      snap.forEach(docSnap => {
        const data = docSnap.data() as Record<string, unknown>;
        map.set(docSnap.id, {
          uid: docSnap.id,
          displayName: sanitizeDisplayName(data.displayName, 'Pengguna'),
          email: normalizeEmail(typeof data.email === 'string' ? data.email : ''),
          avatarUrl: sanitizeAvatarUrl(data.avatarUrl),
          role: sanitizeUserRole(data.role),
          status: sanitizeStatus(data.status),
          activeTab: sanitizeTab(data.activeTab),
          activeBookId: data.activeBookId === 'n4' ? 'n4' : 'n5',
          moduleLabel: typeof data.moduleLabel === 'string' ? data.moduleLabel.slice(0, 80) : '',
          quizInProgress: Boolean(data.quizInProgress),
          quizMode: sanitizeQuizModeOrEmpty(data.quizMode),
          quizBookId: sanitizeBookIdOrEmpty(data.quizBookId),
          quizCurrentQuestion: clampInt(data.quizCurrentQuestion, 0, 50, 0),
          quizTotalQuestions: clampInt(data.quizTotalQuestions, 0, 50, 0),
          quizCorrectCount: clampInt(data.quizCorrectCount, 0, 50, 0),
          quizFromChapter: clampInt(data.quizFromChapter, 0, 50, 0),
          quizToChapter: clampInt(data.quizToChapter, 0, 50, 0),
          quizPatternId: sanitizeOptionalPatternId(data.quizPatternId),
          quizExampleIndex: clampInt(data.quizExampleIndex, 0, 3, 0),
          quizChoiceIds: sanitizeChoiceIds(data.quizChoiceIds),
          quizSelectedChoiceId: sanitizeOptionalPatternId(data.quizSelectedChoiceId),
          quizAnswerCorrect: sanitizeAnswerCorrect(data.quizAnswerCorrect),
          quizLiveAnswers: decodeLiveQuizAnswers(data.quizLiveAnswers),
          totalMasteredBunpou: clampInt(data.totalMasteredBunpou, 0, 300, 0),
          totalMasteredKotoba: clampInt(data.totalMasteredKotoba, 0, 2000, 0),
          totalMastered: clampInt(data.totalMastered, 0, 2300, 0),
          totalQuizSessions: clampInt(data.totalQuizSessions, 0, 5000, 0),
          lastQuizScore: clampInt(data.lastQuizScore, -1, 100, -1),
          lastQuizSummary:
            typeof data.lastQuizSummary === 'string' ? data.lastQuizSummary.slice(0, 120) : '',
          currentStreak: clampInt(data.currentStreak, 0, 999, 0),
          updatedAtMs:
            toMillis(data.updatedAt) ??
            (docSnap.metadata.hasPendingWrites ? Date.now() : null),
        });
      });
      onData(map);
    },
    error => {
      logFirestoreError(error, OperationType.LIST, path);
      onError(error);
    }
  );
}

export function subscribeActivityEvents(
  limitCount: number,
  onData: (events: ActivityEventDoc[]) => void,
  onError: (error: unknown) => void
): Unsubscribe {
  const path = 'activityEvents';
  const q = query(
    collection(db, 'activityEvents'),
    orderBy('createdAt', 'desc'),
    limit(Math.max(10, Math.min(100, limitCount)))
  );
  return onSnapshot(
    q,
    snap => {
      const list: ActivityEventDoc[] = [];
      snap.forEach(docSnap => {
        const data = docSnap.data() as Record<string, unknown>;
        const rawType = data.type;
        const type: ActivityEventType =
          rawType === 'quiz_started' ||
          rawType === 'quiz_completed' ||
          rawType === 'progress_milestone'
            ? rawType
            : 'progress_milestone';
        list.push({
          id: docSnap.id,
          uid: typeof data.uid === 'string' ? data.uid : '',
          displayName: sanitizeDisplayName(data.displayName, 'Pengguna'),
          email: normalizeEmail(typeof data.email === 'string' ? data.email : ''),
          type,
          bookId: data.bookId === 'n4' ? 'n4' : 'n5',
          title: typeof data.title === 'string' ? data.title.slice(0, 120) : '',
          detail: typeof data.detail === 'string' ? data.detail.slice(0, 240) : '',
          score: clampInt(data.score, -1, 100, -1),
          correctCount: clampInt(data.correctCount, 0, 50, 0),
          totalQuestions: clampInt(data.totalQuestions, 0, 50, 0),
          createdAtMs: toMillis(data.createdAt),
        });
      });
      onData(list);
    },
    error => {
      logFirestoreError(error, OperationType.LIST, path);
      onError(error);
    }
  );
}

export async function updateTargetUserRole(
  targetUid: string,
  nextRole: UserRole
): Promise<void> {
  const path = `users/${targetUid}`;
  try {
    await updateDoc(doc(db, 'users', targetUid), {
      role: sanitizeUserRole(nextRole),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    logFirestoreError(error, OperationType.UPDATE, path);
    throw error;
  }
}

function formatModeShort(mode: QuizMode): string {
  if (mode === 'cloze') return 'Lengkapi Kalimat';
  if (mode === 'pattern') return 'Tebak Pola';
  return 'Tebak Arti';
}

function buildUserDetailReport(
  uid: string,
  bunpouN5: BookProgressPayload | null,
  bunpouN4: BookProgressPayload | null,
  kotobaN5: BookProgressPayload | null,
  kotobaN4: BookProgressPayload | null,
  quizN5: QuizSessionRecord[] | null,
  quizN4: QuizSessionRecord[] | null,
  daily: DailyTrackerState | null
): UserDetailReport {
  const todayKey = formatLocalDateKey();
  const currentStreak = daily ? calculateCurrentStreak(daily, todayKey) : 0;
  const todayMasteredCount = daily?.days[todayKey]?.masteredIds.length ?? 0;

  return {
    uid,
    bunpouN5Mastered: bunpouN5?.mastered.length ?? 0,
    bunpouN5Difficult: bunpouN5?.difficult.length ?? 0,
    bunpouN4Mastered: bunpouN4?.mastered.length ?? 0,
    bunpouN4Difficult: bunpouN4?.difficult.length ?? 0,
    kotobaN5Mastered: kotobaN5?.mastered.length ?? 0,
    kotobaN5Difficult: kotobaN5?.difficult.length ?? 0,
    kotobaN4Mastered: kotobaN4?.mastered.length ?? 0,
    kotobaN4Difficult: kotobaN4?.difficult.length ?? 0,
    dailyGoal: daily?.dailyGoal ?? 5,
    currentStreak,
    todayMasteredCount,
    quizSessionsN5: quizN5 ?? [],
    quizSessionsN4: quizN4 ?? [],
  };
}

export async function fetchUserFullDetail(uid: string): Promise<UserDetailReport> {
  const [bunpouN5, bunpouN4, kotobaN5, kotobaN4, quizN5, quizN4, daily] = await Promise.all([
    fetchBookProgressDoc(uid, 'n5').catch(() => null),
    fetchBookProgressDoc(uid, 'n4').catch(() => null),
    fetchKotobaProgressDoc(uid, 'n5').catch(() => null),
    fetchKotobaProgressDoc(uid, 'n4').catch(() => null),
    fetchQuizHistoryDoc(uid, 'n5').catch(() => null),
    fetchQuizHistoryDoc(uid, 'n4').catch(() => null),
    fetchDailyTrackerDoc(uid).catch(() => null),
  ]);

  return buildUserDetailReport(
    uid,
    bunpouN5,
    bunpouN4,
    kotobaN5,
    kotobaN4,
    quizN5,
    quizN4,
    daily
  );
}

/**
 * Attaches real-time onSnapshot listeners to all 7 learner progress/history docs
 * so the Admin/Superadmin Detail modal reflects every single mastery toggle & quiz live.
 */
export function subscribeUserFullDetail(
  uid: string,
  onUpdate: (detail: UserDetailReport) => void,
  onError?: (error: unknown) => void
): Unsubscribe {
  let bunpouN5: BookProgressPayload | null = null;
  let bunpouN4: BookProgressPayload | null = null;
  let kotobaN5: BookProgressPayload | null = null;
  let kotobaN4: BookProgressPayload | null = null;
  let quizN5: QuizSessionRecord[] | null = null;
  let quizN4: QuizSessionRecord[] | null = null;
  let daily: DailyTrackerState | null = null;

  const ready = {
    bunpouN5: false,
    bunpouN4: false,
    kotobaN5: false,
    kotobaN4: false,
    quizN5: false,
    quizN4: false,
    daily: false,
  };
  let emittedOnce = false;
  let disposed = false;

  const emit = () => {
    if (disposed) return;
    const allReady =
      ready.bunpouN5 &&
      ready.bunpouN4 &&
      ready.kotobaN5 &&
      ready.kotobaN4 &&
      ready.quizN5 &&
      ready.quizN4 &&
      ready.daily;
    if (!allReady && !emittedOnce) return;
    emittedOnce = true;
    onUpdate(
      buildUserDetailReport(uid, bunpouN5, bunpouN4, kotobaN5, kotobaN4, quizN5, quizN4, daily)
    );
  };

  const handleErr = (key: keyof typeof ready) => (error: unknown) => {
    ready[key] = true;
    emit();
    onError?.(error);
  };

  const unsubs = [
    subscribeBookProgressDoc(
      uid,
      'n5',
      val => {
        bunpouN5 = val;
        ready.bunpouN5 = true;
        emit();
      },
      handleErr('bunpouN5')
    ),
    subscribeBookProgressDoc(
      uid,
      'n4',
      val => {
        bunpouN4 = val;
        ready.bunpouN4 = true;
        emit();
      },
      handleErr('bunpouN4')
    ),
    subscribeKotobaProgressDoc(
      uid,
      'n5',
      val => {
        kotobaN5 = val;
        ready.kotobaN5 = true;
        emit();
      },
      handleErr('kotobaN5')
    ),
    subscribeKotobaProgressDoc(
      uid,
      'n4',
      val => {
        kotobaN4 = val;
        ready.kotobaN4 = true;
        emit();
      },
      handleErr('kotobaN4')
    ),
    subscribeQuizHistoryDoc(
      uid,
      'n5',
      val => {
        quizN5 = val;
        ready.quizN5 = true;
        emit();
      },
      handleErr('quizN5')
    ),
    subscribeQuizHistoryDoc(
      uid,
      'n4',
      val => {
        quizN4 = val;
        ready.quizN4 = true;
        emit();
      },
      handleErr('quizN4')
    ),
    subscribeDailyTrackerDoc(
      uid,
      val => {
        daily = val;
        ready.daily = true;
        emit();
      },
      handleErr('daily')
    ),
  ];

  return () => {
    disposed = true;
    for (const u of unsubs) u();
  };
}

export async function hydrateUserSummaryStats(uid: string): Promise<HydratedUserStats> {
  const detail = await fetchUserFullDetail(uid);
  const allSessions = [...detail.quizSessionsN5, ...detail.quizSessionsN4].sort((a, b) =>
    b.completedAt.localeCompare(a.completedAt)
  );
  const latestSession = allSessions[0];
  let lastQuizScore = -1;
  let lastQuizSummary = '';
  let lastActivityMs: number | null = null;

  if (latestSession) {
    const pct =
      latestSession.totalQuestions > 0
        ? Math.round((latestSession.correctCount / latestSession.totalQuestions) * 100)
        : 0;
    lastQuizScore = pct;
    lastQuizSummary = `${latestSession.bookId.toUpperCase()} · ${formatModeShort(
      latestSession.mode
    )} · ${latestSession.correctCount}/${latestSession.totalQuestions} (${pct}%)`;
    const parsed = Date.parse(latestSession.completedAt);
    if (Number.isFinite(parsed)) lastActivityMs = parsed;
  }

  const totalMasteredBunpou = detail.bunpouN5Mastered + detail.bunpouN4Mastered;
  const totalMasteredKotoba = detail.kotobaN5Mastered + detail.kotobaN4Mastered;

  return {
    uid,
    totalMasteredBunpou,
    totalMasteredKotoba,
    totalMastered: totalMasteredBunpou + totalMasteredKotoba,
    totalQuizSessions: allSessions.length,
    lastQuizScore,
    lastQuizSummary,
    currentStreak: detail.currentStreak,
    lastActivityMs,
  };
}
