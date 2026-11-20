import type {
  BookId,
  BunpouPattern,
  QuizMode,
  QuizSessionRecord,
} from '../types/bunpou';

export const MAX_QUIZ_HISTORY_PER_BOOK = 60;
const MAX_PATTERN_LIST_PER_SESSION = 15;

const SESSION_ID_REGEX = /^[A-Za-z0-9_-]{4,64}$/;
const ISO_TIMESTAMP_REGEX = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?Z$/;

const PATTERN_ID_REGEX_BY_BOOK: Record<BookId, RegExp> = {
  n5: /^n5-bab-([1-9]|1[0-9]|2[0-5])-p([1-9]|[1-2][0-9])$/,
  n4: /^n4-bab-(2[6-9]|3[0-9]|4[0-9]|50)-p([1-9]|[1-2][0-9])$/,
};

const CHAPTER_RANGE_BY_BOOK: Record<BookId, { min: number; max: number }> = {
  n5: { min: 1, max: 25 },
  n4: { min: 26, max: 50 },
};

function isValidMode(mode: unknown): mode is QuizMode {
  return mode === 'meaning' || mode === 'cloze' || mode === 'pattern';
}

function sanitizePatternIdArray(raw: unknown, bookId: BookId): string[] {
  if (!Array.isArray(raw)) return [];
  const regex = PATTERN_ID_REGEX_BY_BOOK[bookId];
  const seen = new Set<string>();
  const out: string[] = [];

  for (const item of raw) {
    if (typeof item !== 'string') continue;
    if (!regex.test(item)) continue;
    if (seen.has(item)) continue;
    seen.add(item);
    out.push(item);
    if (out.length >= MAX_PATTERN_LIST_PER_SESSION) break;
  }

  return out;
}

export function sanitizeQuizSessionRecord(
  raw: unknown,
  expectedBookId: BookId
): QuizSessionRecord | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;

  if (typeof r.id !== 'string' || !SESSION_ID_REGEX.test(r.id)) return null;
  if (r.bookId !== expectedBookId) return null;
  if (!isValidMode(r.mode)) return null;
  if (typeof r.completedAt !== 'string' || !ISO_TIMESTAMP_REGEX.test(r.completedAt)) return null;

  const { min, max } = CHAPTER_RANGE_BY_BOOK[expectedBookId];
  const fromChapter = typeof r.fromChapter === 'number' ? Math.floor(r.fromChapter) : NaN;
  const toChapter = typeof r.toChapter === 'number' ? Math.floor(r.toChapter) : NaN;
  const totalQuestions = typeof r.totalQuestions === 'number' ? Math.floor(r.totalQuestions) : NaN;
  const correctCount = typeof r.correctCount === 'number' ? Math.floor(r.correctCount) : NaN;

  if (!Number.isFinite(fromChapter) || fromChapter < min || fromChapter > max) return null;
  if (!Number.isFinite(toChapter) || toChapter < fromChapter || toChapter > max) return null;
  if (!Number.isFinite(totalQuestions) || totalQuestions < 1 || totalQuestions > 15) return null;
  if (!Number.isFinite(correctCount) || correctCount < 0 || correctCount > totalQuestions) return null;

  const wrongPatternIds = sanitizePatternIdArray(r.wrongPatternIds, expectedBookId);
  const correctPatternIds = sanitizePatternIdArray(r.correctPatternIds, expectedBookId);

  return {
    id: r.id,
    bookId: expectedBookId,
    mode: r.mode,
    fromChapter,
    toChapter,
    totalQuestions,
    correctCount,
    wrongPatternIds,
    correctPatternIds,
    completedAt: r.completedAt,
  };
}

export function sanitizeQuizHistory(raw: unknown, bookId: BookId): QuizSessionRecord[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const list: QuizSessionRecord[] = [];

  for (const item of raw) {
    const clean = sanitizeQuizSessionRecord(item, bookId);
    if (!clean || seen.has(clean.id)) continue;
    seen.add(clean.id);
    list.push(clean);
  }

  return list
    .sort((a, b) => b.completedAt.localeCompare(a.completedAt))
    .slice(0, MAX_QUIZ_HISTORY_PER_BOOK);
}

export function mergeQuizHistory(
  local: QuizSessionRecord[],
  remote: QuizSessionRecord[],
  bookId: BookId
): QuizSessionRecord[] {
  return sanitizeQuizHistory([...local, ...remote], bookId);
}

export function createQuizSessionId(): string {
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 8);
  return `qz_${ts}_${rand}`;
}

export interface QuizOverviewStats {
  totalSessions: number;
  totalQuestions: number;
  totalCorrect: number;
  averageAccuracy: number;
  bestAccuracy: number;
  weakPatterns: { pattern: BunpouPattern; wrongCount: number; attempts: number }[];
  weakChapters: { chapter: number; wrongCount: number; totalCount: number; accuracy: number }[];
}

export function computeQuizOverviewStats(
  sessions: QuizSessionRecord[],
  patterns: BunpouPattern[]
): QuizOverviewStats {
  const patternById = new Map(patterns.map(p => [p.id, p]));
  let totalQuestions = 0;
  let totalCorrect = 0;
  let bestAccuracy = 0;

  const patternStats = new Map<string, { wrong: number; correct: number }>();
  const chapterStats = new Map<number, { wrong: number; total: number }>();

  for (const s of sessions) {
    totalQuestions += s.totalQuestions;
    totalCorrect += s.correctCount;
    const acc = s.totalQuestions > 0 ? Math.round((s.correctCount / s.totalQuestions) * 100) : 0;
    if (acc > bestAccuracy) bestAccuracy = acc;

    for (const pid of s.wrongPatternIds) {
      const st = patternStats.get(pid) ?? { wrong: 0, correct: 0 };
      st.wrong += 1;
      patternStats.set(pid, st);

      const pat = patternById.get(pid);
      if (pat) {
        const cst = chapterStats.get(pat.chapter) ?? { wrong: 0, total: 0 };
        cst.wrong += 1;
        cst.total += 1;
        chapterStats.set(pat.chapter, cst);
      }
    }

    for (const pid of s.correctPatternIds) {
      const st = patternStats.get(pid) ?? { wrong: 0, correct: 0 };
      st.correct += 1;
      patternStats.set(pid, st);

      const pat = patternById.get(pid);
      if (pat) {
        const cst = chapterStats.get(pat.chapter) ?? { wrong: 0, total: 0 };
        cst.total += 1;
        chapterStats.set(pat.chapter, cst);
      }
    }
  }

  const weakPatterns = Array.from(patternStats.entries())
    .filter(([, st]) => st.wrong > 0)
    .map(([pid, st]) => ({
      pattern: patternById.get(pid),
      wrongCount: st.wrong,
      attempts: st.wrong + st.correct,
    }))
    .filter((x): x is { pattern: BunpouPattern; wrongCount: number; attempts: number } => Boolean(x.pattern))
    .sort((a, b) => b.wrongCount - a.wrongCount)
    .slice(0, 6);

  const weakChapters = Array.from(chapterStats.entries())
    .filter(([, st]) => st.wrong > 0)
    .map(([chapter, st]) => ({
      chapter,
      wrongCount: st.wrong,
      totalCount: st.total,
      accuracy: st.total > 0 ? Math.round(((st.total - st.wrong) / st.total) * 100) : 0,
    }))
    .sort((a, b) => a.accuracy - b.accuracy || b.wrongCount - a.wrongCount)
    .slice(0, 5);

  return {
    totalSessions: sessions.length,
    totalQuestions,
    totalCorrect,
    averageAccuracy: totalQuestions > 0 ? Math.round((totalCorrect / totalQuestions) * 100) : 0,
    bestAccuracy,
    weakPatterns,
    weakChapters,
  };
}
