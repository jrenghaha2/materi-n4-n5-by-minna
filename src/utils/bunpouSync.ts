import type { BookId, QuizSessionRecord } from '../types/bunpou';
import { ALL_MINNA_PATTERNS, BOOKS_BY_ID } from '../data/minnaDataset';
import { MAX_QUIZ_HISTORY_PER_BOOK, sanitizeQuizHistory } from './quizStats';

export const BOOK_IDS: BookId[] = ['n5', 'n4'];

export const DISPLAY_NAME_MAX_LENGTH = 50;
export const AVATAR_URL_MAX_LENGTH = 20000;

const VALID_IDS_BY_BOOK: Record<BookId, Set<string>> = {
  n5: new Set(BOOKS_BY_ID.n5.patterns.map(p => p.id)),
  n4: new Set(BOOKS_BY_ID.n4.patterns.map(p => p.id)),
};

export const ALL_VALID_PATTERN_IDS = new Set(ALL_MINNA_PATTERNS.map(p => p.id));

export function isValidBookId(value: unknown): value is BookId {
  return value === 'n5' || value === 'n4';
}

export function getBookIdFromPatternId(id: string): BookId | null {
  if (id.startsWith('n5-bab-')) return 'n5';
  if (id.startsWith('n4-bab-')) return 'n4';
  return null;
}

export function sanitizePatternIds(raw: unknown, bookId: BookId): string[] {
  if (!Array.isArray(raw)) return [];
  const validSet = VALID_IDS_BY_BOOK[bookId];
  const seen = new Set<string>();
  const out: string[] = [];

  for (const item of raw) {
    if (typeof item !== 'string') continue;
    if (!validSet.has(item)) continue;
    if (seen.has(item)) continue;
    seen.add(item);
    out.push(item);
  }

  return out;
}

export function mergePatternSets(local: Iterable<string>, remote: Iterable<string>, bookId: BookId): Set<string> {
  const validSet = VALID_IDS_BY_BOOK[bookId];
  const merged = new Set<string>();
  for (const id of local) {
    if (validSet.has(id)) merged.add(id);
  }
  for (const id of remote) {
    if (validSet.has(id)) merged.add(id);
  }
  return merged;
}

export function sanitizeDisplayName(raw: unknown, fallback = 'Pengguna'): string {
  if (typeof raw !== 'string') return fallback;
  const cleaned = raw.trim().slice(0, DISPLAY_NAME_MAX_LENGTH);
  return cleaned.length > 0 ? cleaned : fallback;
}

export function isValidAvatarUrl(value: string): boolean {
  if (!value) return true;
  if (value.length > AVATAR_URL_MAX_LENGTH) return false;
  if (value.startsWith('https://')) {
    return /^https:\/\/[^\s]+$/.test(value);
  }
  if (value.startsWith('data:image/')) {
    return /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(value);
  }
  return false;
}

export function sanitizeAvatarUrl(raw: unknown): string {
  if (typeof raw !== 'string') return '';
  const trimmed = raw.trim();
  return isValidAvatarUrl(trimmed) ? trimmed : '';
}

export function sanitizeQuizHistoryForBook(raw: unknown, bookId: BookId): QuizSessionRecord[] {
  return sanitizeQuizHistory(raw, bookId).slice(0, MAX_QUIZ_HISTORY_PER_BOOK);
}
