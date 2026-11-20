import { useMemo } from 'react';
import { Trash2 } from 'lucide-react';
import type { BookData, QuizSessionRecord } from '../../types/bunpou';
import { computeQuizOverviewStats } from '../../utils/quizStats';
import { stripFuriganaMarkup } from '../../utils/furiganaConverter';
import { QUIZ_MODE_INFO } from './quizHelpers';

interface QuizStatsPanelProps {
  book: BookData;
  sessions: QuizSessionRecord[];
  onQuickPracticeChapter: (chapter: number) => void;
  onClearHistory: () => void;
}

export function QuizStatsPanel({
  book,
  sessions,
  onQuickPracticeChapter,
  onClearHistory,
}: QuizStatsPanelProps) {
  const stats = useMemo(
    () => computeQuizOverviewStats(sessions, book.patterns),
    [sessions, book.patterns]
  );

  if (sessions.length === 0) {
    return (
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 text-sm text-slate-500 dark:text-slate-400">
        Belum ada riwayat kuis untuk {book.shortTitle}. Selesaikan satu sesi kuis untuk melihat statistik akurasi dan analisis pola yang masih lemah.
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4 shadow-2xs">
      {/* KPI Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/75 dark:bg-slate-800/50 p-3">
          <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">Total Sesi</div>
          <div className="text-lg font-extrabold font-mono-num text-slate-900 dark:text-slate-50">
            {stats.totalSessions}
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/75 dark:bg-slate-800/50 p-3">
          <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">Total Soal</div>
          <div className="text-lg font-extrabold font-mono-num text-slate-900 dark:text-slate-50">
            {stats.totalQuestions}
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/75 dark:bg-slate-800/50 p-3">
          <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">Rata-rata Akurasi</div>
          <div className="text-lg font-extrabold font-mono-num text-indigo-700 dark:text-indigo-300">
            {stats.averageAccuracy}%
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/75 dark:bg-slate-800/50 p-3">
          <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">Skor Terbaik</div>
          <div className="text-lg font-extrabold font-mono-num text-emerald-700 dark:text-emerald-300">
            {stats.bestAccuracy}%
          </div>
        </div>
      </div>

      {/* Weak patterns & weak chapters */}
      {stats.weakChapters.length > 0 || stats.weakPatterns.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {stats.weakChapters.length > 0 ? (
            <div className="space-y-2">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Bab Perlu Diulang
              </p>
              <div className="space-y-1.5">
                {stats.weakChapters.map(wc => (
                  <div
                    key={wc.chapter}
                    className="rounded-xl border border-slate-200 dark:border-slate-800 px-3 py-2 flex items-center justify-between gap-2 text-xs"
                  >
                    <span className="font-semibold text-slate-800 dark:text-slate-200">
                      Bab {wc.chapter} · akurasi{' '}
                      <span className="font-mono-num text-rose-700 dark:text-rose-400">
                        {wc.accuracy}%
                      </span>
                    </span>
                    <button
                      type="button"
                      onClick={() => onQuickPracticeChapter(wc.chapter)}
                      className="text-indigo-700 dark:text-indigo-300 font-semibold hover:underline cursor-pointer"
                    >
                      Latih Bab Ini
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {stats.weakPatterns.length > 0 ? (
            <div className="space-y-2">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Pola Paling Sering Salah
              </p>
              <div className="space-y-1.5">
                {stats.weakPatterns.map(wp => (
                  <div
                    key={wp.pattern.id}
                    className="rounded-xl border border-slate-200 dark:border-slate-800 px-3 py-2 flex items-center justify-between gap-2 text-xs"
                  >
                    <span className="font-jp font-semibold text-slate-800 dark:text-slate-200 truncate">
                      Bab {wp.pattern.chapter}: {stripFuriganaMarkup(wp.pattern.title)}
                    </span>
                    <span className="font-mono-num text-rose-700 dark:text-rose-400 shrink-0">
                      {wp.wrongCount}x salah
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      {/* Recent sessions list */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Riwayat Terbaru
          </p>
          <button
            type="button"
            onClick={onClearHistory}
            className="text-xs font-semibold text-rose-700 dark:text-rose-400 hover:underline inline-flex items-center gap-1 cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
            Reset Riwayat
          </button>
        </div>

        <div className="divide-y divide-slate-100 dark:divide-slate-800 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
          {sessions.slice(0, 6).map(s => {
            const pct = s.totalQuestions > 0 ? Math.round((s.correctCount / s.totalQuestions) * 100) : 0;
            return (
              <div
                key={s.id}
                className="px-3.5 py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs"
              >
                <div className="text-slate-700 dark:text-slate-200 font-medium">
                  <strong>{QUIZ_MODE_INFO[s.mode].title}</strong> · Bab {s.fromChapter}–{s.toChapter}
                </div>
                <div className="flex items-center gap-3 font-mono-num">
                  <span className="font-bold text-slate-900 dark:text-slate-50">
                    {s.correctCount}/{s.totalQuestions} ({pct}%)
                  </span>
                  <span className="text-slate-400 dark:text-slate-500">
                    {new Date(s.completedAt).toLocaleDateString('id-ID', {
                      day: '2-digit',
                      month: 'short',
                    })}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
