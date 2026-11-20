import { BarChart3, Play } from 'lucide-react';
import type { BookData, QuizMode, QuizSessionRecord } from '../../types/bunpou';
import { CHAPTER_PRESETS_BY_BOOK, QUIZ_MODE_INFO } from './quizHelpers';
import { QuizStatsPanel } from './QuizStatsPanel';

interface QuizSetupViewProps {
  book: BookData;
  mode: QuizMode;
  fromChapter: number;
  toChapter: number;
  questionCount: number;
  onlyDifficult: boolean;
  onlyUnmastered: boolean;
  availableCount: number;
  sessions: QuizSessionRecord[];
  onChangeMode: (mode: QuizMode) => void;
  onChangeRange: (from: number, to: number) => void;
  onChangeCount: (count: number) => void;
  onToggleDifficult: () => void;
  onToggleUnmastered: () => void;
  onStartQuiz: () => void;
  onQuickStartChapter: (chapter: number) => void;
  onClearHistory: () => void;
}

const COUNT_PRESETS = [5, 10, 15];

export function QuizSetupView({
  book,
  mode,
  fromChapter,
  toChapter,
  questionCount,
  onlyDifficult,
  onlyUnmastered,
  availableCount,
  sessions,
  onChangeMode,
  onChangeRange,
  onChangeCount,
  onToggleDifficult,
  onToggleUnmastered,
  onStartQuiz,
  onQuickStartChapter,
  onClearHistory,
}: QuizSetupViewProps) {
  const presets = CHAPTER_PRESETS_BY_BOOK[book.id];
  const minCh = book.chapters[0]?.chapter ?? 1;
  const maxCh = book.chapters[book.chapters.length - 1]?.chapter ?? 25;

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-5 shadow-2xs">
        <div>
          <h2 className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-slate-50">
            Pengaturan Kuis · {book.shortTitle}
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            Pilih mode latihan, rentang bab ({minCh}–{maxCh}), dan jumlah soal hingga 15 pertanyaan per sesi.
          </p>
        </div>

        {/* Mode selection */}
        <div className="space-y-2">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            1. Mode Kuis
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            {(['meaning', 'cloze', 'pattern'] as QuizMode[]).map(m => {
              const info = QUIZ_MODE_INFO[m];
              const active = m === mode;
              return (
                <button
                  key={m}
                  type="button"
                  id={`btnQuizMode-${m}`}
                  aria-pressed={active}
                  onClick={() => onChangeMode(m)}
                  className={`text-left rounded-xl border p-3.5 transition-colors cursor-pointer ${
                    active
                      ? 'bg-indigo-50 dark:bg-indigo-950/60 border-indigo-500 text-indigo-950 dark:text-indigo-50'
                      : 'bg-slate-50/70 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-100/80 dark:hover:bg-slate-800'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold text-sm">{info.title}</span>
                    <span className="text-[11px] font-semibold text-indigo-700 dark:text-indigo-300">
                      {info.badge}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                    {info.subtitle}
                  </p>
                </button>
              );
            })}
          </div>
        </div>

        {/* Chapter Range */}
        <div className="space-y-2.5">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            2. Rentang Bab ({minCh}–{maxCh})
          </p>
          <div className="flex flex-wrap gap-1.5">
            {presets.map(preset => {
              const isSelected = fromChapter === preset.from && toChapter === preset.to;
              return (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() => onChangeRange(preset.from, preset.to)}
                  className={`px-3 py-1.5 rounded-xl border text-xs font-semibold transition-colors cursor-pointer ${
                    isSelected
                      ? 'bg-indigo-600 border-indigo-600 text-white'
                      : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700'
                  }`}
                >
                  {preset.label}
                </button>
              );
            })}
          </div>

          <div className="grid grid-cols-2 gap-3 max-w-sm">
            <div>
              <label
                htmlFor="quizFromChapter"
                className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1"
              >
                Dari Bab
              </label>
              <select
                id="quizFromChapter"
                value={fromChapter}
                onChange={e => {
                  const val = Number(e.target.value);
                  onChangeRange(val, Math.max(val, toChapter));
                }}
                className="w-full h-9 px-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs font-semibold text-slate-900 dark:text-slate-100"
              >
                {book.chapters.map(ch => (
                  <option key={ch.chapter} value={ch.chapter}>
                    Bab {ch.chapter} (Hari {ch.dayNumber})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label
                htmlFor="quizToChapter"
                className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1"
              >
                Sampai Bab
              </label>
              <select
                id="quizToChapter"
                value={toChapter}
                onChange={e => {
                  const val = Number(e.target.value);
                  onChangeRange(Math.min(fromChapter, val), val);
                }}
                className="w-full h-9 px-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs font-semibold text-slate-900 dark:text-slate-100"
              >
                {book.chapters.map(ch => (
                  <option key={ch.chapter} value={ch.chapter}>
                    Bab {ch.chapter} (Hari {ch.dayNumber})
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Question Count & Filters */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              3. Jumlah Soal (Maks. 15)
            </p>
            <div className="flex flex-wrap items-center gap-2">
              {COUNT_PRESETS.map(cnt => (
                <button
                  key={cnt}
                  type="button"
                  onClick={() => onChangeCount(cnt)}
                  className={`px-3 py-1.5 rounded-xl border text-xs font-mono-num font-bold cursor-pointer ${
                    questionCount === cnt
                      ? 'bg-indigo-600 border-indigo-600 text-white'
                      : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200'
                  }`}
                >
                  {cnt} soal
                </button>
              ))}
              <label className="inline-flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300">
                <span>Custom:</span>
                <input
                  id="quizCustomCount"
                  type="number"
                  min={1}
                  max={15}
                  value={questionCount}
                  onChange={e => {
                    const n = Math.max(1, Math.min(15, Number(e.target.value) || 1));
                    onChangeCount(n);
                  }}
                  className="w-16 h-8 px-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 font-mono-num text-xs text-center text-slate-900 dark:text-slate-100"
                />
              </label>
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              4. Filter Soal
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                aria-pressed={onlyUnmastered}
                onClick={onToggleUnmastered}
                className={`px-3 py-1.5 rounded-xl border text-xs font-semibold cursor-pointer ${
                  onlyUnmastered
                    ? 'bg-indigo-50 dark:bg-indigo-950/70 border-indigo-400 text-indigo-900 dark:text-indigo-200'
                    : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200'
                }`}
              >
                Hanya Belum Hafal
              </button>
              <button
                type="button"
                aria-pressed={onlyDifficult}
                onClick={onToggleDifficult}
                className={`px-3 py-1.5 rounded-xl border text-xs font-semibold cursor-pointer ${
                  onlyDifficult
                    ? 'bg-amber-50 dark:bg-amber-950/70 border-amber-400 text-amber-900 dark:text-amber-200'
                    : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200'
                }`}
              >
                Hanya Pola Sulit
              </button>
            </div>
          </div>
        </div>

        {/* Start CTA */}
        <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-slate-600 dark:text-slate-300 font-mono-num">
            Tersedia <strong>{availableCount}</strong> pola cocok · Akan disajikan{' '}
            <strong>{Math.min(availableCount, questionCount)}</strong> soal.
          </p>
          <button
            type="button"
            id="btnStartQuiz"
            disabled={availableCount === 0}
            onClick={onStartQuiz}
            className="min-h-[42px] px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold inline-flex items-center gap-2 cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed"
          >
            <Play className="w-4 h-4" aria-hidden="true" />
            <span>Mulai Kuis</span>
          </button>
        </div>
      </section>

      {/* Quiz Analytics & History */}
      <section className="space-y-2.5">
        <div className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-slate-50">
          <BarChart3 className="w-4 h-4 text-indigo-600 dark:text-indigo-400" aria-hidden="true" />
          <h3>Statistik &amp; Riwayat Kuis ({book.shortTitle})</h3>
        </div>
        <QuizStatsPanel
          book={book}
          sessions={sessions}
          onQuickPracticeChapter={onQuickStartChapter}
          onClearHistory={onClearHistory}
        />
      </section>
    </div>
  );
}
