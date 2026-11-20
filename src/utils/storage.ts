import type {
  AllBooksProgress,
  AllBooksQuizHistory,
  BackupPayload,
  BookId,
  QuizSessionRecord,
} from '../types/bunpou';
import { BOOK_IDS, isValidBookId, sanitizePatternIds } from './bunpouSync';
import { MAX_QUIZ_HISTORY_PER_BOOK, sanitizeQuizHistory } from './quizStats';

export const STORAGE_KEYS = {
  n5Mastered: 'minna_bunpou_n5_mastered_v1',
  n5Difficult: 'minna_bunpou_n5_difficult_v1',
  n4Mastered: 'minna_bunpou_n4_mastered_v1',
  n4Difficult: 'minna_bunpou_n4_difficult_v1',
  quizHistory: 'minna_bunpou_quiz_history_v1',
  activeBook: 'minna_bunpou_active_book_v1',
  furigana: 'minna_bunpou_furigana_v1',
  translation: 'minna_bunpou_translation_v1',
  theme: 'minna_bunpou_theme_v1',
} as const;

export const BACKUP_APP_ID = 'minna-bunpou';

function getBookStorageKeys(bookId: BookId): { masteredKey: string; difficultKey: string } {
  return bookId === 'n5'
    ? { masteredKey: STORAGE_KEYS.n5Mastered, difficultKey: STORAGE_KEYS.n5Difficult }
    : { masteredKey: STORAGE_KEYS.n4Mastered, difficultKey: STORAGE_KEYS.n4Difficult };
}

function safeGetItem(key: string): string | null {
  try {
    return typeof localStorage !== 'undefined' ? localStorage.getItem(key) : null;
  } catch {
    return null;
  }
}

function safeSetItem(key: string, value: string): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(key, value);
    }
  } catch {
    // Ignore storage quota or private-mode errors
  }
}

export function createEmptyAllBooksProgress(): AllBooksProgress {
  return {
    n5: { mastered: new Set<string>(), difficult: new Set<string>() },
    n4: { mastered: new Set<string>(), difficult: new Set<string>() },
  };
}

export function createEmptyAllQuizHistory(): AllBooksQuizHistory {
  return {
    n5: [],
    n4: [],
  };
}

export function loadAllBooksProgress(): AllBooksProgress {
  const result = createEmptyAllBooksProgress();
  for (const bookId of BOOK_IDS) {
    const { masteredKey, difficultKey } = getBookStorageKeys(bookId);
    try {
      const rawMastered = safeGetItem(masteredKey);
      const rawDifficult = safeGetItem(difficultKey);
      const masteredArr = rawMastered ? sanitizePatternIds(JSON.parse(rawMastered), bookId) : [];
      const difficultArr = rawDifficult ? sanitizePatternIds(JSON.parse(rawDifficult), bookId) : [];
      result[bookId] = {
        mastered: new Set(masteredArr),
        difficult: new Set(difficultArr),
      };
    } catch {
      result[bookId] = { mastered: new Set(), difficult: new Set() };
    }
  }
  return result;
}

export function saveBookProgressToLocal(
  bookId: BookId,
  mastered: Set<string>,
  difficult: Set<string>
): void {
  const { masteredKey, difficultKey } = getBookStorageKeys(bookId);
  safeSetItem(masteredKey, JSON.stringify(Array.from(mastered)));
  safeSetItem(difficultKey, JSON.stringify(Array.from(difficult)));
}

export function loadAllQuizHistory(): AllBooksQuizHistory {
  const empty = createEmptyAllQuizHistory();
  const raw = safeGetItem(STORAGE_KEYS.quizHistory);
  if (!raw) return empty;

  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    return {
      n5: sanitizeQuizHistory(parsed?.n5, 'n5').slice(0, MAX_QUIZ_HISTORY_PER_BOOK),
      n4: sanitizeQuizHistory(parsed?.n4, 'n4').slice(0, MAX_QUIZ_HISTORY_PER_BOOK),
    };
  } catch {
    return empty;
  }
}

export function saveAllQuizHistoryToLocal(history: AllBooksQuizHistory): void {
  const payload: Record<BookId, QuizSessionRecord[]> = {
    n5: history.n5.slice(0, MAX_QUIZ_HISTORY_PER_BOOK),
    n4: history.n4.slice(0, MAX_QUIZ_HISTORY_PER_BOOK),
  };
  safeSetItem(STORAGE_KEYS.quizHistory, JSON.stringify(payload));
}

export function loadActiveBookId(): BookId {
  const raw = safeGetItem(STORAGE_KEYS.activeBook);
  return isValidBookId(raw) ? raw : 'n5';
}

export function saveActiveBookId(bookId: BookId): void {
  safeSetItem(STORAGE_KEYS.activeBook, bookId);
}

export function loadBooleanSetting(key: string, defaultValue: boolean): boolean {
  const raw = safeGetItem(key);
  if (raw === 'true') return true;
  if (raw === 'false') return false;
  return defaultValue;
}

export function saveBooleanSetting(key: string, value: boolean): void {
  safeSetItem(key, value ? 'true' : 'false');
}

export function buildBackupPayload(
  progress: AllBooksProgress,
  quizHistory: AllBooksQuizHistory
): BackupPayload {
  return {
    app: BACKUP_APP_ID,
    version: 1,
    exportedAt: new Date().toISOString(),
    books: {
      n5: {
        mastered: Array.from(progress.n5.mastered),
        difficult: Array.from(progress.n5.difficult),
      },
      n4: {
        mastered: Array.from(progress.n4.mastered),
        difficult: Array.from(progress.n4.difficult),
      },
    },
    quizHistory: {
      n5: quizHistory.n5.slice(0, MAX_QUIZ_HISTORY_PER_BOOK),
      n4: quizHistory.n4.slice(0, MAX_QUIZ_HISTORY_PER_BOOK),
    },
  };
}

export function downloadBackupJson(payload: BackupPayload): void {
  const json = JSON.stringify(payload, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const datePart = new Date().toISOString().slice(0, 10);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `minna-bunpou-backup-${datePart}.json`;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

export interface ParsedBackupResult {
  progress: AllBooksProgress;
  quizHistory: AllBooksQuizHistory;
  totalMastered: number;
  totalDifficult: number;
  totalQuizSessions: number;
  exportedAt: string | null;
}

export function parseBackupJson(rawText: string): ParsedBackupResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawText);
  } catch {
    throw new Error('File tidak dapat dibaca sebagai format JSON yang valid.');
  }

  if (!parsed || typeof parsed !== 'object') {
    throw new Error('Struktur file backup tidak valid.');
  }

  const record = parsed as Record<string, unknown>;
  if (record.app !== BACKUP_APP_ID) {
    throw new Error('File ini bukan file backup resmi dari Minna Bunpou.');
  }

  const booksRaw = record.books as Record<string, Record<string, unknown>> | undefined;
  if (!booksRaw || typeof booksRaw !== 'object') {
    throw new Error('Data progres buku tidak ditemukan di dalam file backup.');
  }

  const progress = createEmptyAllBooksProgress();
  for (const bookId of BOOK_IDS) {
    const bucket = booksRaw[bookId];
    const mastered = sanitizePatternIds(bucket?.mastered, bookId);
    const difficult = sanitizePatternIds(bucket?.difficult, bookId);
    progress[bookId] = {
      mastered: new Set(mastered),
      difficult: new Set(difficult),
    };
  }

  const quizRaw = (record.quizHistory ?? {}) as Record<string, unknown>;
  const quizHistory: AllBooksQuizHistory = {
    n5: sanitizeQuizHistory(quizRaw.n5, 'n5').slice(0, MAX_QUIZ_HISTORY_PER_BOOK),
    n4: sanitizeQuizHistory(quizRaw.n4, 'n4').slice(0, MAX_QUIZ_HISTORY_PER_BOOK),
  };

  const totalMastered = progress.n5.mastered.size + progress.n4.mastered.size;
  const totalDifficult = progress.n5.difficult.size + progress.n4.difficult.size;
  const totalQuizSessions = quizHistory.n5.length + quizHistory.n4.length;

  return {
    progress,
    quizHistory,
    totalMastered,
    totalDifficult,
    totalQuizSessions,
    exportedAt: typeof record.exportedAt === 'string' ? record.exportedAt : null,
  };
}
