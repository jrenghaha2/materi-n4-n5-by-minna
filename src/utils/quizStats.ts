import type {
  BookId,
  BunpouPattern,
  QuizAnswerEntry,
  QuizChoice,
  QuizMode,
  QuizQuestion,
  QuizSavedAnswer,
  QuizSessionRecord,
} from '../types/bunpou';
import { stripFuriganaMarkup } from './furiganaConverter';
import { buildClozeForExample, getQuizPatternLabel } from './quizGenerator';

export const MAX_QUIZ_HISTORY_PER_BOOK = 60;
export const MAX_CLOUD_QUIZ_HISTORY_PER_BOOK = 30;
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

function sanitizeSavedAnswers(
  raw: unknown,
  bookId: BookId,
  fallbackMode: QuizMode
): QuizSavedAnswer[] | undefined {
  if (!Array.isArray(raw) || raw.length === 0) return undefined;
  const regex = PATTERN_ID_REGEX_BY_BOOK[bookId];
  const out: QuizSavedAnswer[] = [];

  for (let i = 0; i < raw.length && out.length < MAX_PATTERN_LIST_PER_SESSION; i += 1) {
    const item = raw[i];
    if (!item || typeof item !== 'object') continue;
    const obj = item as Record<string, unknown>;
    const patternId = typeof obj.patternId === 'string' && regex.test(obj.patternId) ? obj.patternId : null;
    if (!patternId) continue;

    const selectedPatternId =
      typeof obj.selectedPatternId === 'string' && regex.test(obj.selectedPatternId)
        ? obj.selectedPatternId
        : patternId;
    const isCorrect = Boolean(obj.isCorrect);
    const questionNo =
      typeof obj.questionNo === 'number' && Number.isFinite(obj.questionNo) && obj.questionNo >= 1
        ? Math.floor(obj.questionNo)
        : out.length + 1;
    const mode = isValidMode(obj.mode) ? obj.mode : fallbackMode;
    const exampleIndex =
      typeof obj.exampleIndex === 'number' && Number.isFinite(obj.exampleIndex)
        ? Math.max(0, Math.min(3, Math.floor(obj.exampleIndex)))
        : 0;

    out.push({
      questionNo,
      mode,
      patternId,
      selectedPatternId: isCorrect ? patternId : selectedPatternId,
      isCorrect,
      exampleIndex,
    });
  }

  return out.length > 0 ? out : undefined;
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
  const answers = sanitizeSavedAnswers(r.answers, expectedBookId, r.mode);

  const record: QuizSessionRecord = {
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

  if (answers) {
    record.answers = answers;
  }

  return record;
}

export function sanitizeQuizHistory(raw: unknown, bookId: BookId): QuizSessionRecord[] {
  if (!Array.isArray(raw)) return [];
  const byId = new Map<string, QuizSessionRecord>();

  for (const item of raw) {
    const clean = sanitizeQuizSessionRecord(item, bookId);
    if (!clean) continue;
    const prev = byId.get(clean.id);
    if (!prev) {
      byId.set(clean.id, clean);
    } else if ((clean.answers?.length ?? 0) > (prev.answers?.length ?? 0)) {
      // Prefer the richer V2 record when merging local & cloud duplicates
      byId.set(clean.id, clean);
    }
  }

  return Array.from(byId.values())
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

/**
 * Reconstructs full question-by-question QuizAnswerEntry items for any saved
 * QuizSessionRecord (supports both detailed V2 records and legacy V1 records).
 */
export function reconstructSessionReview(
  session: QuizSessionRecord,
  patterns: BunpouPattern[]
): QuizAnswerEntry[] {
  const patternById = new Map(patterns.map(p => [p.id, p]));

  const savedItems: QuizSavedAnswer[] =
    session.answers && session.answers.length > 0
      ? session.answers
      : [
          ...session.correctPatternIds.map((pid, idx) => ({
            questionNo: idx + 1,
            mode: session.mode,
            patternId: pid,
            selectedPatternId: pid,
            isCorrect: true,
            exampleIndex: 0,
          })),
          ...session.wrongPatternIds.map((pid, idx) => ({
            questionNo: session.correctPatternIds.length + idx + 1,
            mode: session.mode,
            patternId: pid,
            selectedPatternId: pid, // V1 legacy didn't record which wrong option was picked
            isCorrect: false,
            exampleIndex: 0,
          })),
        ];

  const entries: QuizAnswerEntry[] = [];

  for (let i = 0; i < savedItems.length; i += 1) {
    const item = savedItems[i];
    const targetPattern = patternById.get(item.patternId);
    if (!targetPattern) continue;

    const selectedPattern =
      !item.isCorrect && item.selectedPatternId !== item.patternId
        ? patternById.get(item.selectedPatternId)
        : undefined;

    const ex = targetPattern.examples[item.exampleIndex] ?? targetPattern.examples[0];
    const targetLabel = getQuizPatternLabel(targetPattern);
    const mode = item.mode;

    const isJapaneseChoice = mode !== 'meaning';
    const correctChoice: QuizChoice = {
      id: targetPattern.id,
      label: isJapaneseChoice ? targetLabel : targetPattern.meaning,
      subLabel: targetPattern.formulas.join(' / '),
      isJapanese: isJapaneseChoice,
    };

    const choices: QuizChoice[] = [correctChoice];
    let selectedChoiceId = targetPattern.id;

    if (!item.isCorrect && selectedPattern) {
      selectedChoiceId = selectedPattern.id;
      choices.push({
        id: selectedPattern.id,
        label: isJapaneseChoice ? getQuizPatternLabel(selectedPattern) : selectedPattern.meaning,
        subLabel: selectedPattern.formulas.join(' / '),
        isJapanese: isJapaneseChoice,
      });
    } else if (!item.isCorrect) {
      selectedChoiceId = '__legacy_wrong__';
    }

    let prompt = targetLabel;
    let promptSub = ex?.japanese;
    if (mode === 'pattern') {
      prompt = targetPattern.meaning;
      promptSub = ex?.indonesian;
    } else if (mode === 'cloze' && ex) {
      const cloze = buildClozeForExample(targetPattern, ex.japanese);
      prompt = cloze ? cloze.clozeMarkup : ex.japanese;
      promptSub = ex.indonesian;
    }

    entries.push({
      question: {
        id: `${session.id}-q${item.questionNo}-${i}`,
        patternId: targetPattern.id,
        chapter: targetPattern.chapter,
        mode,
        prompt,
        promptSub,
        formulas: targetPattern.formulas,
        exampleIndex: item.exampleIndex,
        exampleJapanese: ex?.japanese,
        exampleIndonesian: ex?.indonesian,
        choices,
        correctChoiceId: targetPattern.id,
        explanation: `${stripFuriganaMarkup(targetLabel)} — ${targetPattern.meaning}`,
      },
      selectedChoiceId,
      isCorrect: item.isCorrect,
    });
  }

  return entries;
}

const ANY_BUNPOU_PATTERN_ID_REGEX =
  /^(n5-bab-([1-9]|1[0-9]|2[0-5])|n4-bab-(2[6-9]|[34][0-9]|50))-p[1-9][0-9]?$/;

const MODE_TO_CODE: Record<QuizMode, number> = {
  meaning: 0,
  cloze: 1,
  pattern: 2,
};

const CODE_TO_MODE: Record<number, QuizMode> = {
  0: 'meaning',
  1: 'cloze',
  2: 'pattern',
};

export function isValidAnyBunpouPatternId(value: unknown): value is string {
  return typeof value === 'string' && ANY_BUNPOU_PATTERN_ID_REGEX.test(value);
}

/**
 * Encodes a single answered quiz item into a compact pure-ASCII token
 * matching firestore.rules `isValidLiveQuizAnswers`:
 * `questionNo:modeCode:patternId:isCorrectBit:selectedPatternId:exampleIndex`
 */
export function encodeLiveQuizAnswerToken(answer: QuizSavedAnswer): string | null {
  if (!isValidAnyBunpouPatternId(answer.patternId)) return null;
  const selectedId = isValidAnyBunpouPatternId(answer.selectedPatternId)
    ? answer.selectedPatternId
    : answer.patternId;
  const qNo = Math.max(1, Math.min(50, Math.floor(answer.questionNo)));
  const modeCode = MODE_TO_CODE[answer.mode] ?? 0;
  const okBit = answer.isCorrect ? 1 : 0;
  const exIdx = Math.max(0, Math.min(3, Math.floor(answer.exampleIndex)));
  return `${qNo}:${modeCode}:${answer.patternId}:${okBit}:${selectedId}:${exIdx}`;
}

export function decodeLiveQuizAnswerToken(token: string): QuizSavedAnswer | null {
  if (typeof token !== 'string' || token.length < 25 || token.length > 80) return null;
  const parts = token.split(':');
  if (parts.length !== 6) return null;
  const questionNo = Number(parts[0]);
  const modeCode = Number(parts[1]);
  const patternId = parts[2];
  const okBit = parts[3];
  const selectedPatternId = parts[4];
  const exampleIndex = Number(parts[5]);

  if (!Number.isInteger(questionNo) || questionNo < 1 || questionNo > 50) return null;
  const mode = CODE_TO_MODE[modeCode];
  if (!mode) return null;
  if (!isValidAnyBunpouPatternId(patternId)) return null;
  if (okBit !== '0' && okBit !== '1') return null;
  if (!isValidAnyBunpouPatternId(selectedPatternId)) return null;
  if (!Number.isInteger(exampleIndex) || exampleIndex < 0 || exampleIndex > 3) return null;

  return {
    questionNo,
    mode,
    patternId,
    selectedPatternId,
    isCorrect: okBit === '1',
    exampleIndex,
  };
}

export function encodeLiveQuizAnswers(answers: QuizSavedAnswer[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const item of answers) {
    const token = encodeLiveQuizAnswerToken(item);
    if (!token || seen.has(token)) continue;
    seen.add(token);
    out.push(token);
    if (out.length >= 50) break;
  }
  return out;
}

export function decodeLiveQuizAnswers(raw: unknown): QuizSavedAnswer[] {
  if (!Array.isArray(raw)) return [];
  const out: QuizSavedAnswer[] = [];
  for (const entry of raw) {
    if (typeof entry !== 'string') continue;
    const parsed = decodeLiveQuizAnswerToken(entry);
    if (parsed) out.push(parsed);
    if (out.length >= 50) break;
  }
  return out.sort((a, b) => a.questionNo - b.questionNo);
}

/**
 * Computes the running wrong answer count for an active live quiz session,
 * preferring exact recorded live answers with a safe fallback calculation.
 */
export function computeLiveQuizWrongCount(
  liveAnswers: QuizSavedAnswer[],
  currentQuestion: number,
  correctCount: number,
  answerCorrect: -1 | 0 | 1
): number {
  if (liveAnswers.length > 0) {
    return liveAnswers.reduce((acc, a) => acc + (a.isCorrect ? 0 : 1), 0);
  }
  const answeredCount = Math.max(0, currentQuestion - 1) + (answerCorrect !== -1 ? 1 : 0);
  return Math.max(0, answeredCount - Math.max(0, correctCount));
}

/**
 * Deterministically reconstructs the exact live QuizQuestion currently shown to a learner,
 * preserving the exact 4-option order (`choiceIds`), prompt, context sentence, and explanation.
 */
export function reconstructLiveQuizQuestion(options: {
  mode: QuizMode;
  patternId: string;
  exampleIndex: number;
  choiceIds: string[];
  patterns: BunpouPattern[];
  questionId?: string;
}): QuizQuestion | null {
  const { mode, patternId, exampleIndex, choiceIds, patterns, questionId = 'live-q' } = options;
  const patternById = new Map(patterns.map(p => [p.id, p]));
  const targetPattern = patternById.get(patternId);
  if (!targetPattern) return null;

  const safeExIdx = Math.max(
    0,
    Math.min(Math.max(0, targetPattern.examples.length - 1), Math.floor(exampleIndex))
  );
  const ex = targetPattern.examples[safeExIdx] ?? targetPattern.examples[0];
  const targetLabel = getQuizPatternLabel(targetPattern);
  const isJapaneseChoice = mode !== 'meaning';

  const resolvedChoiceIds = choiceIds.length > 0 ? choiceIds : [targetPattern.id];
  const choices: QuizChoice[] = [];
  const seen = new Set<string>();

  for (const cid of resolvedChoiceIds) {
    if (seen.has(cid)) continue;
    const p = patternById.get(cid);
    if (!p) continue;
    seen.add(cid);
    choices.push({
      id: p.id,
      label: isJapaneseChoice ? getQuizPatternLabel(p) : p.meaning,
      subLabel: isJapaneseChoice ? p.formulas.join(' / ') : undefined,
      isJapanese: isJapaneseChoice,
    });
  }

  if (!seen.has(targetPattern.id)) {
    choices.unshift({
      id: targetPattern.id,
      label: isJapaneseChoice ? targetLabel : targetPattern.meaning,
      subLabel: isJapaneseChoice ? targetPattern.formulas.join(' / ') : undefined,
      isJapanese: isJapaneseChoice,
    });
  }

  let prompt = targetLabel;
  let promptSub = ex?.japanese;
  let explanation = `${stripFuriganaMarkup(targetLabel)} — ${targetPattern.meaning}`;

  if (mode === 'pattern') {
    prompt = targetPattern.meaning;
    promptSub = ex?.indonesian;
    explanation = `${stripFuriganaMarkup(targetLabel)} (${targetPattern.formulas.join(' / ')})`;
  } else if (mode === 'cloze' && ex) {
    const cloze = buildClozeForExample(targetPattern, ex.japanese);
    prompt = cloze ? cloze.clozeMarkup : ex.japanese;
    promptSub = ex.indonesian;
  }

  return {
    id: questionId,
    patternId: targetPattern.id,
    chapter: targetPattern.chapter,
    mode,
    prompt,
    promptSub,
    formulas: targetPattern.formulas,
    exampleIndex: safeExIdx,
    exampleJapanese: ex?.japanese,
    exampleIndonesian: ex?.indonesian,
    choices,
    correctChoiceId: targetPattern.id,
    explanation,
  };
}

/**
 * Reconstructs answered questions so far in an active live quiz session for real-time review.
 */
export function reconstructLiveAnswersReview(
  answers: QuizSavedAnswer[],
  bookId: BookId,
  patterns: BunpouPattern[]
): QuizAnswerEntry[] {
  if (answers.length === 0) return [];
  const dummySession: QuizSessionRecord = {
    id: 'live_session',
    bookId,
    mode: answers[0].mode,
    fromChapter: bookId === 'n5' ? 1 : 26,
    toChapter: bookId === 'n5' ? 25 : 50,
    totalQuestions: answers.length,
    correctCount: answers.filter(a => a.isCorrect).length,
    wrongPatternIds: [],
    correctPatternIds: [],
    answers,
    completedAt: new Date().toISOString(),
  };
  return reconstructSessionReview(dummySession, patterns);
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
