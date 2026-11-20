export type BookId = 'n5' | 'n4';

export type ActiveTab = 'flashcard' | 'kotoba' | 'list' | 'quiz' | 'info';

export type FilterMode = 'all' | 'unmastered' | 'difficult';

export type QuizMode = 'meaning' | 'cloze' | 'pattern';

export interface KotobaWord {
  id: string;
  bookId: BookId;
  chapter: number;
  dayNumber: number;
  reading: string;
  kanji?: string;
  meaning: string;
  example?: string;
}

export interface KotobaChapter {
  bookId: BookId;
  chapter: number;
  dayNumber: number;
  theme: string;
  sub: string;
  words: KotobaWord[];
}

export interface ExampleSentence {
  japanese: string;
  indonesian: string;
}

export interface BunpouPattern {
  id: string;
  bookId: BookId;
  chapter: number;
  dayNumber: number;
  chapterTitle: string;
  title: string;
  formulas: string[];
  meaning: string;
  notes?: string;
  warnings?: string;
  examples: ExampleSentence[];
}

export interface ChapterData {
  chapter: number;
  dayNumber: number;
  chapterTitle: string;
  patterns: BunpouPattern[];
}

export interface BookData {
  id: BookId;
  shortTitle: string;
  fullTitle: string;
  japaneseSubtitle: string;
  level: string;
  badgeLabel: string;
  chapters: ChapterData[];
  patterns: BunpouPattern[];
  totalPatterns: number;
}

export interface AbbreviationEntry {
  code: string;
  meaning: string;
  example: string;
}

export interface BookProgress {
  mastered: Set<string>;
  difficult: Set<string>;
}

export type AllBooksProgress = Record<BookId, BookProgress>;

export interface UserProfileDoc {
  displayName: string;
  avatarUrl: string;
}

export interface QuizChoice {
  id: string;
  label: string;
  subLabel?: string;
  isJapanese: boolean;
}

export interface QuizQuestion {
  id: string;
  patternId: string;
  chapter: number;
  mode: QuizMode;
  prompt: string;
  promptSub?: string;
  exampleJapanese?: string;
  exampleIndonesian?: string;
  choices: QuizChoice[];
  correctChoiceId: string;
  explanation: string;
}

export interface QuizAnswerEntry {
  question: QuizQuestion;
  selectedChoiceId: string;
  isCorrect: boolean;
}

export interface QuizSessionRecord {
  id: string;
  bookId: BookId;
  mode: QuizMode;
  fromChapter: number;
  toChapter: number;
  totalQuestions: number;
  correctCount: number;
  wrongPatternIds: string[];
  correctPatternIds: string[];
  completedAt: string;
}

export type AllBooksQuizHistory = Record<BookId, QuizSessionRecord[]>;

export interface BackupBookPayload {
  mastered: string[];
  difficult: string[];
}

export interface BackupPayload {
  app: string;
  version: number;
  exportedAt: string;
  books: Record<BookId, BackupBookPayload>;
  quizHistory: Record<BookId, QuizSessionRecord[]>;
}

export interface DailyActivityDay {
  date: string; // YYYY-MM-DD (local date)
  masteredIds: string[];
  quizSessions: number;
}

export interface DailyTrackerState {
  dailyGoal: number;
  days: Record<string, DailyActivityDay>;
}
