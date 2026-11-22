export type BookId = 'n5' | 'n4';

export type ActiveTab = 'flashcard' | 'kotoba' | 'list' | 'quiz' | 'info' | 'admin';

export type UserRole = 'user' | 'admin' | 'superadmin';

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
  email?: string;
  role?: UserRole;
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
  formulas?: string[];
  exampleIndex: number;
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

export interface QuizSavedAnswer {
  questionNo: number;
  mode: QuizMode;
  patternId: string;
  selectedPatternId: string;
  isCorrect: boolean;
  exampleIndex: number;
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
  answers?: QuizSavedAnswer[];
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

export type PresenceStatus = 'online' | 'recent' | 'offline';

export type LiveActivityStatus = 'browsing' | 'studying' | 'quizzing' | 'idle';

export type ActivityEventType = 'quiz_started' | 'quiz_completed' | 'progress_milestone';

export type AdminSortOption =
  | 'latest'
  | 'name_asc'
  | 'name_desc'
  | 'progress_desc'
  | 'quiz_desc';

export interface LiveQuizState {
  inProgress: boolean;
  bookId: BookId | '';
  mode: QuizMode | '';
  fromChapter: number;
  toChapter: number;
  currentQuestion: number;
  totalQuestions: number;
  correctCount: number;
}

export interface AdminUserRecord {
  uid: string;
  displayName: string;
  email: string;
  avatarUrl: string;
  role: UserRole;
  createdAtMs: number | null;
  updatedAtMs: number | null;
}

export interface LiveActivityDoc {
  uid: string;
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
  totalMasteredBunpou: number;
  totalMasteredKotoba: number;
  totalMastered: number;
  totalQuizSessions: number;
  lastQuizScore: number; // 0..100 or -1 if none
  lastQuizSummary: string;
  currentStreak: number;
  updatedAtMs: number | null;
}

export interface ActivityEventDoc {
  id: string;
  uid: string;
  displayName: string;
  email: string;
  type: ActivityEventType;
  bookId: BookId;
  title: string;
  detail: string;
  score: number; // 0..100 or -1
  correctCount: number;
  totalQuestions: number;
  createdAtMs: number | null;
}

export interface HydratedUserStats {
  uid: string;
  totalMasteredBunpou: number;
  totalMasteredKotoba: number;
  totalMastered: number;
  totalQuizSessions: number;
  lastQuizScore: number;
  lastQuizSummary: string;
  currentStreak: number;
  lastActivityMs: number | null;
}

export interface AdminMonitoredUserRow {
  uid: string;
  displayName: string;
  email: string;
  avatarUrl: string;
  role: UserRole;
  isBootstrapSuperAdmin: boolean;
  presence: PresenceStatus;
  status: LiveActivityStatus;
  moduleLabel: string;
  quizInProgress: boolean;
  quizMode: QuizMode | '';
  quizBookId: BookId | '';
  quizCurrentQuestion: number;
  quizTotalQuestions: number;
  quizCorrectCount: number;
  totalMasteredBunpou: number;
  totalMasteredKotoba: number;
  totalMastered: number;
  totalQuizSessions: number;
  lastQuizScore: number;
  lastQuizSummary: string;
  currentStreak: number;
  lastActiveMs: number | null;
  createdAtMs: number | null;
  hasLiveActivity: boolean;
  hydratedFromLegacy: boolean;
}

export interface UserDetailReport {
  uid: string;
  bunpouN5Mastered: number;
  bunpouN5Difficult: number;
  bunpouN4Mastered: number;
  bunpouN4Difficult: number;
  kotobaN5Mastered: number;
  kotobaN5Difficult: number;
  kotobaN4Mastered: number;
  kotobaN4Difficult: number;
  dailyGoal: number;
  currentStreak: number;
  todayMasteredCount: number;
  quizSessionsN5: QuizSessionRecord[];
  quizSessionsN4: QuizSessionRecord[];
}

