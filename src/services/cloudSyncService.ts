import { doc, getDoc, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';
import { db, logFirestoreError, OperationType } from '../firebase';
import type {
  BookId,
  DailyTrackerState,
  QuizMode,
  QuizSavedAnswer,
  QuizSessionRecord,
  UserProfileDoc,
} from '../types/bunpou';
import {
  sanitizeAvatarUrl,
  sanitizeDisplayName,
  sanitizeKotobaIds,
  sanitizePatternIds,
  sanitizeQuizHistoryForBook,
} from '../utils/bunpouSync';
import {
  DAILY_GOAL_OPTIONS,
  decodeDailyTrackerDays,
  DEFAULT_DAILY_GOAL,
  encodeDailyTrackerDays,
} from '../utils/dailyProgress';
import { MAX_CLOUD_QUIZ_HISTORY_PER_BOOK } from '../utils/quizStats';

export async function fetchUserProfileDoc(uid: string): Promise<UserProfileDoc | null> {
  const path = `users/${uid}`;
  try {
    const snap = await getDoc(doc(db, 'users', uid));
    if (!snap.exists()) return null;
    const data = snap.data() as Record<string, unknown>;
    return {
      displayName: sanitizeDisplayName(data.displayName, 'Pengguna'),
      avatarUrl: sanitizeAvatarUrl(data.avatarUrl),
    };
  } catch (error) {
    logFirestoreError(error, OperationType.GET, path);
    throw error;
  }
}

export async function createUserProfileDoc(
  uid: string,
  profile: UserProfileDoc
): Promise<void> {
  const path = `users/${uid}`;
  try {
    await setDoc(doc(db, 'users', uid), {
      uid,
      displayName: sanitizeDisplayName(profile.displayName, 'Pengguna'),
      avatarUrl: sanitizeAvatarUrl(profile.avatarUrl),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    logFirestoreError(error, OperationType.CREATE, path);
    throw error;
  }
}

export async function updateUserProfileDoc(
  uid: string,
  profile: UserProfileDoc
): Promise<void> {
  const path = `users/${uid}`;
  try {
    await updateDoc(doc(db, 'users', uid), {
      displayName: sanitizeDisplayName(profile.displayName, 'Pengguna'),
      avatarUrl: sanitizeAvatarUrl(profile.avatarUrl),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    logFirestoreError(error, OperationType.UPDATE, path);
    throw error;
  }
}

export interface BookProgressPayload {
  mastered: string[];
  difficult: string[];
}

export async function fetchBookProgressDoc(
  uid: string,
  bookId: BookId
): Promise<BookProgressPayload | null> {
  const path = `users/${uid}/bunpouProgress/${bookId}`;
  try {
    const snap = await getDoc(doc(db, 'users', uid, 'bunpouProgress', bookId));
    if (!snap.exists()) return null;
    const data = snap.data() as Record<string, unknown>;
    const mastered = sanitizePatternIds(data.mastered, bookId);
    const masteredSet = new Set(mastered);
    const hard = sanitizePatternIds(data.hard, bookId).filter(id => !masteredSet.has(id));
    return {
      mastered,
      difficult: hard,
    };
  } catch (error) {
    logFirestoreError(error, OperationType.GET, path);
    throw error;
  }
}

export async function saveBookProgressDoc(
  uid: string,
  bookId: BookId,
  payload: BookProgressPayload
): Promise<void> {
  const path = `users/${uid}/bunpouProgress/${bookId}`;
  const ref = doc(db, 'users', uid, 'bunpouProgress', bookId);
  const mastered = sanitizePatternIds(payload.mastered, bookId);
  const masteredSet = new Set(mastered);
  // Firestore rules enforce mutual exclusion between mastered and hard
  const hard = sanitizePatternIds(payload.difficult, bookId).filter(id => !masteredSet.has(id));

  try {
    const existing = await getDoc(ref);
    if (existing.exists()) {
      await updateDoc(ref, {
        mastered,
        hard,
        updatedAt: serverTimestamp(),
      });
    } else {
      await setDoc(ref, {
        uid,
        bookId,
        mastered,
        hard,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    logFirestoreError(error, OperationType.WRITE, path);
    throw error;
  }
}

export async function fetchKotobaProgressDoc(
  uid: string,
  bookId: BookId
): Promise<BookProgressPayload | null> {
  const path = `users/${uid}/kotobaProgress/${bookId}`;
  try {
    const snap = await getDoc(doc(db, 'users', uid, 'kotobaProgress', bookId));
    if (!snap.exists()) return null;
    const data = snap.data() as Record<string, unknown>;
    const mastered = sanitizeKotobaIds(data.mastered, bookId);
    const masteredSet = new Set(mastered);
    const hard = sanitizeKotobaIds(data.hard, bookId).filter(id => !masteredSet.has(id));
    return {
      mastered,
      difficult: hard,
    };
  } catch (error) {
    logFirestoreError(error, OperationType.GET, path);
    throw error;
  }
}

export async function saveKotobaProgressDoc(
  uid: string,
  bookId: BookId,
  payload: BookProgressPayload
): Promise<void> {
  const path = `users/${uid}/kotobaProgress/${bookId}`;
  const ref = doc(db, 'users', uid, 'kotobaProgress', bookId);
  const mastered = sanitizeKotobaIds(payload.mastered, bookId);
  const masteredSet = new Set(mastered);
  // Firestore rules enforce mutual exclusion between mastered and hard
  const hard = sanitizeKotobaIds(payload.difficult, bookId).filter(id => !masteredSet.has(id));

  try {
    const existing = await getDoc(ref);
    if (existing.exists()) {
      await updateDoc(ref, {
        mastered,
        hard,
        updatedAt: serverTimestamp(),
      });
    } else {
      await setDoc(ref, {
        uid,
        bookId,
        mastered,
        hard,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    logFirestoreError(error, OperationType.WRITE, path);
    throw error;
  }
}

export async function fetchDailyTrackerDoc(uid: string): Promise<DailyTrackerState | null> {
  const path = `users/${uid}/dailyTracker/state`;
  try {
    const snap = await getDoc(doc(db, 'users', uid, 'dailyTracker', 'state'));
    if (!snap.exists()) return null;
    const data = snap.data() as Record<string, unknown>;
    const rawGoal = typeof data.dailyGoal === 'number' ? data.dailyGoal : DEFAULT_DAILY_GOAL;
    const dailyGoal = (DAILY_GOAL_OPTIONS as readonly number[]).includes(rawGoal)
      ? rawGoal
      : DEFAULT_DAILY_GOAL;
    return {
      dailyGoal,
      days: decodeDailyTrackerDays(data.days),
    };
  } catch (error) {
    logFirestoreError(error, OperationType.GET, path);
    throw error;
  }
}

export async function saveDailyTrackerDoc(
  uid: string,
  state: DailyTrackerState
): Promise<void> {
  const path = `users/${uid}/dailyTracker/state`;
  const ref = doc(db, 'users', uid, 'dailyTracker', 'state');
  const dailyGoal = (DAILY_GOAL_OPTIONS as readonly number[]).includes(state.dailyGoal)
    ? state.dailyGoal
    : DEFAULT_DAILY_GOAL;
  const days = encodeDailyTrackerDays(state.days);

  try {
    const existing = await getDoc(ref);
    if (existing.exists()) {
      await updateDoc(ref, {
        dailyGoal,
        days,
        updatedAt: serverTimestamp(),
      });
    } else {
      await setDoc(ref, {
        uid,
        dailyGoal,
        days,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    logFirestoreError(error, OperationType.WRITE, path);
    throw error;
  }
}

// Compact pure-ASCII quiz session token codec aligned 1:1 with firestore.rules
function modeToFocus(mode: QuizMode): 'cloze' | 'formula' | 'function' {
  if (mode === 'cloze') return 'cloze';
  if (mode === 'pattern') return 'formula';
  return 'function';
}

function focusToMode(focus: string): QuizMode {
  if (focus === 'cloze') return 'cloze';
  if (focus === 'formula') return 'pattern';
  return 'meaning';
}

function modeToTypeCode(mode: QuizMode): number {
  if (mode === 'cloze') return 0;
  if (mode === 'pattern') return 1;
  return 2;
}

function typeCodeToMode(code: string, fallback: QuizMode): QuizMode {
  if (code === '0') return 'cloze';
  if (code === '1') return 'pattern';
  if (code === '2') return 'meaning';
  return fallback;
}

export function encodeQuizSessionToken(session: QuizSessionRecord): string {
  const focus = modeToFocus(session.mode);
  const typeCode = modeToTypeCode(session.mode);
  const score =
    session.totalQuestions > 0
      ? Math.min(100, Math.round((session.correctCount / session.totalQuestions) * 100))
      : 0;

  const minBound = session.bookId === 'n5' ? 1 : 26;
  const maxBound = session.bookId === 'n5' ? 25 : 50;
  const scopeCode =
    session.fromChapter === minBound && session.toChapter === maxBound
      ? 'all'
      : session.fromChapter === session.toChapter
      ? String(session.fromChapter)
      : `${session.fromChapter}.${session.toChapter}`;

  const packedItems: string[] = [];
  if (session.answers && session.answers.length > 0) {
    // V2 detailed format: no:typeCode:patternId:isCorrectBit:selectedPatternId:exampleIndex
    for (let i = 0; i < session.answers.length && i < 15; i += 1) {
      const a = session.answers[i];
      const no = i + 1;
      const itemType = modeToTypeCode(a.mode);
      const bit = a.isCorrect ? '1' : '0';
      const selectedPid = a.isCorrect ? a.patternId : a.selectedPatternId || a.patternId;
      const exIdx = Math.max(0, Math.min(3, Math.floor(a.exampleIndex || 0)));
      packedItems.push(`${no}:${itemType}:${a.patternId}:${bit}:${selectedPid}:${exIdx}`);
    }
  } else {
    // Legacy V1 fallback
    let no = 1;
    for (const pid of session.correctPatternIds) {
      packedItems.push(`${no}:${typeCode}:${pid}:1`);
      no += 1;
    }
    for (const pid of session.wrongPatternIds) {
      packedItems.push(`${no}:${typeCode}:${pid}:0`);
      no += 1;
    }
  }

  return [
    session.id,
    session.completedAt,
    focus,
    String(session.correctCount),
    String(session.totalQuestions),
    String(score),
    scopeCode,
    packedItems.join(';'),
  ].join('|');
}

export function decodeQuizSessionToken(
  token: string,
  bookId: BookId
): QuizSessionRecord | null {
  if (typeof token !== 'string') return null;
  const parts = token.split('|');
  if (parts.length !== 8) return null;

  const [id, completedAt, focus, correctStr, totalStr, , scopeCode, answersPacked] = parts;
  const minBound = bookId === 'n5' ? 1 : 26;
  const maxBound = bookId === 'n5' ? 25 : 50;
  const sessionMode = focusToMode(focus);

  let fromChapter = minBound;
  let toChapter = maxBound;
  if (scopeCode !== 'all') {
    const nums = scopeCode
      .split('.')
      .map(Number)
      .filter(n => Number.isFinite(n) && n >= minBound && n <= maxBound);
    if (nums.length >= 1) {
      fromChapter = Math.min(...nums);
      toChapter = Math.max(...nums);
    }
  }

  const correctPatternIds: string[] = [];
  const wrongPatternIds: string[] = [];
  const answers: QuizSavedAnswer[] = [];

  if (answersPacked) {
    for (const entry of answersPacked.split(';')) {
      const segs = entry.split(':');
      if (segs.length !== 4 && segs.length !== 6) continue;
      const questionNo = Number(segs[0]) || answers.length + 1;
      const itemMode = typeCodeToMode(segs[1], sessionMode);
      const pid = segs[2];
      const bit = segs[3];
      const isCorrect = bit === '1';

      if (isCorrect) correctPatternIds.push(pid);
      else if (bit === '0') wrongPatternIds.push(pid);

      if (segs.length === 6) {
        const selectedPatternId = segs[4] || pid;
        const exampleIndex = Math.max(0, Math.min(3, Number(segs[5]) || 0));
        answers.push({
          questionNo,
          mode: itemMode,
          patternId: pid,
          selectedPatternId: isCorrect ? pid : selectedPatternId,
          isCorrect,
          exampleIndex,
        });
      }
    }
  }

  const record: QuizSessionRecord = {
    id,
    bookId,
    mode: sessionMode,
    fromChapter,
    toChapter,
    totalQuestions: Number(totalStr),
    correctCount: Number(correctStr),
    correctPatternIds,
    wrongPatternIds,
    completedAt,
  };

  if (answers.length > 0) {
    record.answers = answers;
  }

  return record;
}

export async function fetchQuizHistoryDoc(
  uid: string,
  bookId: BookId
): Promise<QuizSessionRecord[] | null> {
  const path = `users/${uid}/quizHistory/${bookId}`;
  try {
    const snap = await getDoc(doc(db, 'users', uid, 'quizHistory', bookId));
    if (!snap.exists()) return null;
    const data = snap.data() as Record<string, unknown>;
    const rawTokens = Array.isArray(data.sessions) ? data.sessions : [];
    const decoded = rawTokens
      .map(t => (typeof t === 'string' ? decodeQuizSessionToken(t, bookId) : null))
      .filter((x): x is QuizSessionRecord => x !== null);
    return sanitizeQuizHistoryForBook(decoded, bookId);
  } catch (error) {
    logFirestoreError(error, OperationType.GET, path);
    throw error;
  }
}

export async function saveQuizHistoryDoc(
  uid: string,
  bookId: BookId,
  sessions: QuizSessionRecord[]
): Promise<void> {
  const path = `users/${uid}/quizHistory/${bookId}`;
  const ref = doc(db, 'users', uid, 'quizHistory', bookId);
  const clean = sanitizeQuizHistoryForBook(sessions, bookId).slice(0, MAX_CLOUD_QUIZ_HISTORY_PER_BOOK);
  const tokens = Array.from(new Set(clean.map(encodeQuizSessionToken))).slice(
    0,
    MAX_CLOUD_QUIZ_HISTORY_PER_BOOK
  );

  try {
    const existing = await getDoc(ref);
    if (existing.exists()) {
      await updateDoc(ref, {
        sessions: tokens,
        updatedAt: serverTimestamp(),
      });
    } else {
      await setDoc(ref, {
        uid,
        bookId,
        sessions: tokens,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    logFirestoreError(error, OperationType.WRITE, path);
    throw error;
  }
}
