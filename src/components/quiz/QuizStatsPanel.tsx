import { useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, ChevronUp, Cloud, CloudOff, Trash2 } from 'lucide-react';
import type { BookData, QuizMode, QuizSessionRecord } from '../../types/bunpou';
import { computeQuizOverviewStats, MAX_CLOUD_QUIZ_HISTORY_PER_BOOK } from '../../utils/quizStats';
import { stripFuriganaMarkup } from '../../utils/furiganaConverter';
import { QUIZ_MODE_INFO } from './quizHelpers';

interface QuizStatsPanelProps {
  book: BookData;
  sessions: QuizSessionRecord[];
  isCloudSynced?: boolean;
  syncingQuiz?: boolean;
  onQuickPracticeChapter: (chapter: number) => void;
  onInspectSession: (session: QuizSessionRecord) => void;
  onClearHistory: () => void;
}

const DEFAULT_VISIBLE_SESSIONS = 8;

export function QuizStatsPanel({
  book,
  sessions,
  isCloudSynced = false,
  syncingQuiz = false,
  onQuickPracticeChapter,
  onInspectSession,
  onClearHistory,
}: QuizStatsPanelProps) {
  const [modeFilter, setModeFilter] = useState<'all' | QuizMode>('all');
  const [showAllSessions, setShowAllSessions] = useState(false);

  const stats = useMemo(
    () => computeQuizOverviewStats(sessions, book.patterns),
    [sessions, book.patterns]
  );

  const filteredSessions = useMemo(() => {
    if (modeFilter === 'all') return sessions;
    return sessions.filter(s => s.mode === modeFilter);
  }, [sessions, modeFilter]);

  const visibleSessions = showAllSessions
    ? filteredSessions
    : filteredSessions.slice(0, DEFAULT_VISIBLE_SESSIONS);

  if (sessions.length === 0) {
    return (
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-2.5 text-sm text-slate-500 dark:text-slate-400">
        <p>
          Belum ada riwayat kuis untuk {book.shortTitle}. Selesaikan satu sesi kuis untuk melihat
          statistik akurasi dan review detail jawaban Anda.
        </p>
        <p className="text-xs inline-flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
          {isCloudSynced ? (
            <>
              <Cloud className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
              <span>
                Riwayat jawaban detail otomatis tersimpan di Cloud (hingga{' '}
                {MAX_CLOUD_QUIZ_HISTORY_PER_BOOK} sesi per buku).
              </span>
            </>
          ) : (
            <>
              <CloudOff className="w-3.5 h-3.5 text-slate-400" aria-hidden="true" />
              <span>Tersimpan di perangkat ini · Masuk akun untuk sinkron Cloud otomatis.</span>
            </>
          )}
        </p>
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

      {/* Full clickable sessions history */}
      <div className="space-y-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Semua Riwayat Jawaban ({sessions.length})
            </p>
            <span className="text-[11px] inline-flex items-center gap-1 text-slate-500 dark:text-slate-400">
              {syncingQuiz ? (
                <>
                  <Cloud className="w-3.5 h-3.5 text-indigo-500 animate-pulse" aria-hidden="true" />
                  <span>Menyinkronkan...</span>
                </>
              ) : isCloudSynced ? (
                <>
                  <Cloud className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
                  <span className="text-emerald-700 dark:text-emerald-300 font-medium">
                    Tersinkron Cloud
                  </span>
                </>
              ) : (
                <>
                  <CloudOff className="w-3.5 h-3.5 text-slate-400" aria-hidden="true" />
                  <span>Lokal · Masuk untuk simpan Cloud</span>
                </>
              )}
            </span>
          </div>
          <button
            type="button"
            onClick={onClearHistory}
            className="text-xs font-semibold text-rose-700 dark:text-rose-400 hover:underline inline-flex items-center gap-1 cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
            Reset Riwayat
          </button>
        </div>

        {/* Mode Filter */}
        <div className="flex flex-wrap items-center gap-1.5">
          {(['all', 'meaning', 'cloze', 'pattern'] as const).map(f => {
            const count =
              f === 'all' ? sessions.length : sessions.filter(s => s.mode === f).length;
            if (f !== 'all' && count === 0) return null;
            const active = modeFilter === f;
            return (
              <button
                key={f}
                type="button"
                onClick={() => setModeFilter(f)}
                className={`px-2.5 py-1 rounded-lg border text-xs font-semibold transition-colors cursor-pointer ${
                  active
                    ? 'bg-indigo-600 border-indigo-600 text-white'
                    : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700'
                }`}
              >
                {f === 'all' ? `Semua (${count})` : `${QUIZ_MODE_INFO[f].title} (${count})`}
              </button>
            );
          })}
        </div>

        <p className="text-[11px] text-slate-500 dark:text-slate-400">
          Klik sesi mana saja untuk membuka detail soal, pilihan jawaban Anda, rumus, dan contoh kalimatnya.
        </p>

        <div className="divide-y divide-slate-100 dark:divide-slate-800 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
          {visibleSessions.map((s, idx) => {
            const pct =
              s.totalQuestions > 0 ? Math.round((s.correctCount / s.totalQuestions) * 100) : 0;
            const chapterRange =
              s.fromChapter === s.toChapter
                ? `Bab ${s.fromChapter}`
                : `Bab ${s.fromChapter}–${s.toChapter}`;
            const scoreColor =
              pct >= 80
                ? 'text-emerald-700 dark:text-emerald-300'
                : pct >= 60
                ? 'text-amber-700 dark:text-amber-300'
                : 'text-rose-700 dark:text-rose-300';

            return (
              <button
                key={s.id}
                type="button"
                id={`quizHistoryRow-${idx}`}
                onClick={() => onInspectSession(s)}
                className="w-full text-left px-3.5 py-3 flex flex-wrap items-center justify-between gap-2 text-xs hover:bg-indigo-50/50 dark:hover:bg-slate-800/70 transition-colors cursor-pointer group"
              >
                <div className="space-y-0.5 min-w-0">
                  <div className="text-slate-800 dark:text-slate-100 font-medium">
                    <strong className="font-bold">{QUIZ_MODE_INFO[s.mode].title}</strong> ·{' '}
                    {chapterRange}
                  </div>
                  <div className="text-[11px] text-slate-400 dark:text-slate-500 font-mono-num">
                    {new Date(s.completedAt).toLocaleString('id-ID', {
                      day: '2-digit',
                      month: 'short',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </div>
                </div>

                <div className="flex items-center gap-3 font-mono-num shrink-0">
                  <span className={`font-bold ${scoreColor}`}>
                    {s.correctCount}/{s.totalQuestions} ({pct}%)
                  </span>
                  <span className="inline-flex items-center gap-0.5 font-sans font-semibold text-indigo-700 dark:text-indigo-300 group-hover:underline">
                    <span>Detail</span>
                    <ChevronRight className="w-3.5 h-3.5" aria-hidden="true" />
                  </span>
                </div>
              </button>
            );
          })}
        </div>

        {filteredSessions.length > DEFAULT_VISIBLE_SESSIONS ? (
          <div className="flex justify-center pt-1">
            <button
              type="button"
              onClick={() => setShowAllSessions(v => !v)}
              className="px-3.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/70 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-200 inline-flex items-center gap-1.5 cursor-pointer"
            >
              {showAllSessions ? (
                <>
                  <ChevronUp className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Tampilkan Lebih Sedikit</span>
                </>
              ) : (
                <>
                  <ChevronDown className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Lihat Semua Riwayat ({filteredSessions.length} sesi)</span>
                </>
              )}
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
