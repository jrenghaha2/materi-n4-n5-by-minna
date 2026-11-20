import { doc, getDoc, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';
import { db, logFirestoreError, OperationType } from '../firebase';
import type { BookId, QuizMode, QuizSessionRecord, UserProfileDoc } from '../types/bunpou';
import {
  sanitizeAvatarUrl,
  sanitizeDisplayName,
  sanitizePatternIds,
  sanitizeQuizHistoryForBook,
} from '../utils/bunpouSync';

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
  let no = 1;
  for (const pid of session.correctPatternIds) {
    packedItems.push(`${no}:${typeCode}:${pid}:1`);
    no += 1;
  }
  for (const pid of session.wrongPatternIds) {
    packedItems.push(`${no}:${typeCode}:${pid}:0`);
    no += 1;
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
  if (answersPacked) {
    for (const entry of answersPacked.split(';')) {
      const segs = entry.split(':');
      if (segs.length !== 4) continue;
      const pid = segs[2];
      const bit = segs[3];
      if (bit === '1') correctPatternIds.push(pid);
      else if (bit === '0') wrongPatternIds.push(pid);
    }
  }

  return {
    id,
    bookId,
    mode: focusToMode(focus),
    fromChapter,
    toChapter,
    totalQuestions: Number(totalStr),
    correctCount: Number(correctStr),
    correctPatternIds,
    wrongPatternIds,
    completedAt,
  };
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
  const clean = sanitizeQuizHistoryForBook(sessions, bookId).slice(0, 15);
  const tokens = Array.from(new Set(clean.map(encodeQuizSessionToken))).slice(0, 15);

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
