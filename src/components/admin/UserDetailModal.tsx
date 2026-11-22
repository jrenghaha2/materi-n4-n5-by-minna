import { useEffect, useMemo, useState } from 'react';
import { BookMarked, BookOpen, Eye, Flame, GraduationCap, Loader2, X } from 'lucide-react';
import { BOOKS_BY_ID } from '../../data/minnaDataset';
import { N4_KOTOBA_WORDS, N5_KOTOBA_WORDS } from '../../data/minnaKotobaData';
import type {
  AdminMonitoredUserRow,
  QuizSessionRecord,
  UserDetailReport,
} from '../../types/bunpou';
import { reconstructSessionReview } from '../../utils/quizStats';
import { formatRelativeTimeId, getRoleLabel } from '../../utils/rbac';
import { QuizAnswerHistoryModal } from '../quiz/QuizAnswerHistoryModal';
import { QUIZ_MODE_INFO } from '../quiz/quizHelpers';

interface UserDetailModalProps {
  open: boolean;
  userRow: AdminMonitoredUserRow | null;
  detail: UserDetailReport | null;
  loading: boolean;
  showFurigana: boolean;
  onClose: () => void;
}

const TOTAL_BUNPOU_N5 = BOOKS_BY_ID.n5.totalPatterns;
const TOTAL_BUNPOU_N4 = BOOKS_BY_ID.n4.totalPatterns;
const TOTAL_KOTOBA_N5 = N5_KOTOBA_WORDS.length;
const TOTAL_KOTOBA_N4 = N4_KOTOBA_WORDS.length;

function ProgressMetricRow({
  label,
  mastered,
  total,
  difficult,
  barColor,
}: {
  label: string;
  mastered: number;
  total: number;
  difficult: number;
  barColor: string;
}) {
  const pct = total > 0 ? Math.min(100, Math.round((mastered / total) * 100)) : 0;
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2 text-xs">
        <span className="font-semibold text-slate-800 dark:text-slate-100">{label}</span>
        <span className="font-mono tabular-nums text-slate-600 dark:text-slate-300">
          {mastered}/{total} ({pct}%)
          {difficult > 0 ? (
            <span className="text-amber-700 dark:text-amber-400"> · {difficult} sulit</span>
          ) : null}
        </span>
      </div>
      <div className="h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-300 ${barColor}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

export function UserDetailModal({
  open,
  userRow,
  detail,
  loading,
  showFurigana,
  onClose,
}: UserDetailModalProps) {
  const [inspectedSession, setInspectedSession] = useState<QuizSessionRecord | null>(null);

  useEffect(() => {
    if (!open) {
      setInspectedSession(null);
      return;
    }
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !inspectedSession) {
        onClose();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, inspectedSession, onClose]);

  const allSessions = useMemo(() => {
    if (!detail) return [];
    return [...detail.quizSessionsN5, ...detail.quizSessionsN4].sort((a, b) =>
      b.completedAt.localeCompare(a.completedAt)
    );
  }, [detail]);

  const avgScore = useMemo(() => {
    if (allSessions.length === 0) return null;
    const totalCorrect = allSessions.reduce((acc, s) => acc + s.correctCount, 0);
    const totalQs = allSessions.reduce((acc, s) => acc + s.totalQuestions, 0);
    return totalQs > 0 ? Math.round((totalCorrect / totalQs) * 100) : 0;
  }, [allSessions]);

  const inspectedAnswers = useMemo(() => {
    if (!inspectedSession) return [];
    const book = BOOKS_BY_ID[inspectedSession.bookId];
    return reconstructSessionReview(inspectedSession, book.patterns);
  }, [inspectedSession]);

  const inspectedMeta = useMemo(() => {
    if (!inspectedSession || !userRow) return undefined;
    const dateLabel = new Date(inspectedSession.completedAt).toLocaleString('id-ID', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
    const chapterRange =
      inspectedSession.fromChapter === inspectedSession.toChapter
        ? `Bab ${inspectedSession.fromChapter}`
        : `Bab ${inspectedSession.fromChapter}–${inspectedSession.toChapter}`;
    return {
      title: `${userRow.displayName} · ${QUIZ_MODE_INFO[inspectedSession.mode].title} (${inspectedSession.bookId.toUpperCase()})`,
      subtitle: `${chapterRange} · ${dateLabel}`,
      isLegacy: !inspectedSession.answers || inspectedSession.answers.length === 0,
    };
  }, [inspectedSession, userRow]);

  if (!open || !userRow) return null;

  const initial = userRow.displayName.trim().charAt(0).toUpperCase() || 'U';

  return (
    <>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="userDetailModalTitle"
        className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5"
        onClick={e => {
          if (e.target === e.currentTarget) onClose();
        }}
      >
        <div className="w-full max-w-3xl max-h-[88vh] flex flex-col rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden">
          {/* Header */}
          <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              {userRow.avatarUrl ? (
                <img
                  src={userRow.avatarUrl}
                  alt={userRow.displayName}
                  referrerPolicy="no-referrer"
                  className="w-10 h-10 rounded-full border border-slate-200 dark:border-slate-700 object-cover shrink-0"
                />
              ) : (
                <span className="w-10 h-10 rounded-full bg-indigo-50 dark:bg-indigo-950/70 border border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-200 font-bold text-sm inline-flex items-center justify-center shrink-0">
                  {initial}
                </span>
              )}
              <div className="min-w-0">
                <h2
                  id="userDetailModalTitle"
                  className="text-base font-bold text-slate-900 dark:text-slate-50 truncate"
                >
                  {userRow.displayName}
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                  {userRow.email || 'Email belum tercatat'} · {getRoleLabel(userRow.role)}
                  {userRow.isBootstrapSuperAdmin ? ' Utama' : ''} · Aktif{' '}
                  {formatRelativeTimeId(userRow.lastActiveMs)}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              aria-label="Tutup modal detail pengguna"
              className="w-9 h-9 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 inline-flex items-center justify-center shrink-0 cursor-pointer"
            >
              <X className="w-4 h-4" aria-hidden="true" />
            </button>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto p-5 space-y-6">
            {loading || !detail ? (
              <div className="py-12 flex flex-col items-center justify-center gap-3 text-slate-500 dark:text-slate-400">
                <Loader2 className="w-6 h-6 animate-spin text-indigo-600 dark:text-indigo-400" />
                <p className="text-sm font-medium">Memuat rincian progres &amp; riwayat kuis...</p>
              </div>
            ) : (
              <>
                {/* Top Summary Strip */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-3.5 bg-slate-50/70 dark:bg-slate-950/40">
                    <p className="text-xs text-slate-500 dark:text-slate-400">Total Hafalan</p>
                    <p className="text-xl font-bold font-mono tabular-nums text-slate-900 dark:text-slate-50 mt-1">
                      {detail.bunpouN5Mastered +
                        detail.bunpouN4Mastered +
                        detail.kotobaN5Mastered +
                        detail.kotobaN4Mastered}
                    </p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 tabular-nums">
                      {detail.bunpouN5Mastered + detail.bunpouN4Mastered} Bunpou ·{' '}
                      {detail.kotobaN5Mastered + detail.kotobaN4Mastered} Kotoba
                    </p>
                  </div>

                  <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-3.5 bg-slate-50/70 dark:bg-slate-950/40">
                    <p className="text-xs text-slate-500 dark:text-slate-400">Sesi Kuis</p>
                    <p className="text-xl font-bold font-mono tabular-nums text-slate-900 dark:text-slate-50 mt-1">
                      {allSessions.length}
                    </p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 tabular-nums">
                      N5: {detail.quizSessionsN5.length} · N4: {detail.quizSessionsN4.length}
                    </p>
                  </div>

                  <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-3.5 bg-slate-50/70 dark:bg-slate-950/40">
                    <p className="text-xs text-slate-500 dark:text-slate-400">Rata-rata Skor</p>
                    <p className="text-xl font-bold font-mono tabular-nums text-indigo-700 dark:text-indigo-300 mt-1">
                      {avgScore !== null ? `${avgScore}%` : '—'}
                    </p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                      {allSessions.length > 0 ? 'Akurasi keseluruhan' : 'Belum ada kuis'}
                    </p>
                  </div>

                  <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-3.5 bg-slate-50/70 dark:bg-slate-950/40">
                    <p className="text-xs text-slate-500 dark:text-slate-400 inline-flex items-center gap-1">
                      <Flame className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" aria-hidden="true" />
                      Streak &amp; Target
                    </p>
                    <p className="text-xl font-bold font-mono tabular-nums text-slate-900 dark:text-slate-50 mt-1">
                      {detail.currentStreak} hari
                    </p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 tabular-nums">
                      Hari ini: {detail.todayMasteredCount}/{detail.dailyGoal} item
                    </p>
                  </div>
                </div>

                {/* Progress Breakdown per Module */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-2 border-t border-slate-200 dark:border-slate-800">
                  <div className="space-y-3">
                    <h3 className="text-sm font-bold text-slate-900 dark:text-slate-50 inline-flex items-center gap-1.5">
                      <BookOpen className="w-4 h-4 text-indigo-600 dark:text-indigo-400" aria-hidden="true" />
                      Progres Bunpou (Tata Bahasa)
                    </h3>
                    <ProgressMetricRow
                      label="Minna N5 (Bab 1–25)"
                      mastered={detail.bunpouN5Mastered}
                      total={TOTAL_BUNPOU_N5}
                      difficult={detail.bunpouN5Difficult}
                      barColor="bg-indigo-600 dark:bg-indigo-500"
                    />
                    <ProgressMetricRow
                      label="Minna N4 (Bab 26–50)"
                      mastered={detail.bunpouN4Mastered}
                      total={TOTAL_BUNPOU_N4}
                      difficult={detail.bunpouN4Difficult}
                      barColor="bg-teal-600 dark:bg-teal-500"
                    />
                  </div>

                  <div className="space-y-3">
                    <h3 className="text-sm font-bold text-slate-900 dark:text-slate-50 inline-flex items-center gap-1.5">
                      <BookMarked className="w-4 h-4 text-teal-600 dark:text-teal-400" aria-hidden="true" />
                      Progres Kotoba (Kosakata)
                    </h3>
                    <ProgressMetricRow
                      label="Kotoba N5 (Bab 1–25)"
                      mastered={detail.kotobaN5Mastered}
                      total={TOTAL_KOTOBA_N5}
                      difficult={detail.kotobaN5Difficult}
                      barColor="bg-emerald-600 dark:bg-emerald-500"
                    />
                    <ProgressMetricRow
                      label="Kotoba N4 (Bab 26–50)"
                      mastered={detail.kotobaN4Mastered}
                      total={TOTAL_KOTOBA_N4}
                      difficult={detail.kotobaN4Difficult}
                      barColor="bg-sky-600 dark:bg-sky-500"
                    />
                  </div>
                </div>

                {/* Complete Quiz History */}
                <div className="space-y-3 pt-2 border-t border-slate-200 dark:border-slate-800">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-sm font-bold text-slate-900 dark:text-slate-50 inline-flex items-center gap-1.5">
                      <GraduationCap className="w-4 h-4 text-indigo-600 dark:text-indigo-400" aria-hidden="true" />
                      Riwayat Sesi Kuis ({allSessions.length})
                    </h3>
                    <span className="text-xs text-slate-500 dark:text-slate-400">
                      Klik sesi untuk melihat detail jawaban per soal
                    </span>
                  </div>

                  {allSessions.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-slate-200 dark:border-slate-800 p-6 text-center text-sm text-slate-500 dark:text-slate-400">
                      Pengguna ini belum memiliki riwayat kuis yang tersimpan di cloud.
                    </div>
                  ) : (
                    <div className="divide-y divide-slate-200 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
                      {allSessions.map(session => {
                        const pct =
                          session.totalQuestions > 0
                            ? Math.round((session.correctCount / session.totalQuestions) * 100)
                            : 0;
                        const scope =
                          session.fromChapter === session.toChapter
                            ? `Bab ${session.fromChapter}`
                            : `Bab ${session.fromChapter}–${session.toChapter}`;
                        const dateStr = new Date(session.completedAt).toLocaleString('id-ID', {
                          day: '2-digit',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit',
                        });
                        const scoreColor =
                          pct >= 80
                            ? 'text-emerald-700 dark:text-emerald-400'
                            : pct >= 60
                            ? 'text-amber-700 dark:text-amber-400'
                            : 'text-rose-700 dark:text-rose-400';

                        return (
                          <div
                            key={`${session.bookId}-${session.id}`}
                            className="px-4 py-3 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800/60 flex flex-wrap items-center justify-between gap-3 transition-colors"
                          >
                            <div className="min-w-0">
                              <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                                {session.bookId.toUpperCase()} · {QUIZ_MODE_INFO[session.mode].title}
                              </p>
                              <p className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                                {scope} · {dateStr}
                              </p>
                            </div>

                            <div className="flex items-center gap-3 shrink-0">
                              <span className={`text-sm font-bold font-mono tabular-nums ${scoreColor}`}>
                                {session.correctCount}/{session.totalQuestions} ({pct}%)
                              </span>
                              <button
                                type="button"
                                onClick={() => setInspectedSession(session)}
                                className="min-h-[34px] px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 inline-flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
                              >
                                <Eye className="w-3.5 h-3.5" aria-hidden="true" />
                                <span>Jawaban</span>
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {inspectedSession ? (
        <QuizAnswerHistoryModal
          open={Boolean(inspectedSession)}
          answers={inspectedAnswers}
          showFurigana={showFurigana}
          sessionMeta={inspectedMeta}
          onClose={() => setInspectedSession(null)}
        />
      ) : null}
    </>
  );
}
