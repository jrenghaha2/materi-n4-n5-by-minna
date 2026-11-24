import { useEffect } from 'react';
import { Eye, GraduationCap, X } from 'lucide-react';
import { BOOKS_BY_ID } from '../../data/minnaDataset';
import type { AdminMonitoredUserRow } from '../../types/bunpou';
import { formatRelativeTimeId } from '../../utils/rbac';
import { QUIZ_MODE_INFO } from '../quiz/quizHelpers';
import { LiveQuizInlineCard } from './LiveQuizInlineCard';

interface LiveQuizMonitorModalProps {
  open: boolean;
  userRow: AdminMonitoredUserRow | null;
  nowMs: number;
  showFurigana: boolean;
  showAnswerKey: boolean;
  onToggleAnswerKey: () => void;
  onClose: () => void;
  onOpenFullDetail?: (row: AdminMonitoredUserRow) => void;
}

export function LiveQuizMonitorModal({
  open,
  userRow,
  nowMs,
  showFurigana,
  showAnswerKey,
  onToggleAnswerKey,
  onClose,
  onOpenFullDetail,
}: LiveQuizMonitorModalProps) {
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  if (!open || !userRow) return null;

  const initial = userRow.displayName.trim().charAt(0).toUpperCase() || 'U';
  const activeBook = userRow.quizBookId ? BOOKS_BY_ID[userRow.quizBookId] ?? null : null;
  const modeInfo = userRow.quizMode ? QUIZ_MODE_INFO[userRow.quizMode] : null;
  const scopeLabel =
    userRow.quizFromChapter > 0 && userRow.quizToChapter > 0
      ? userRow.quizFromChapter === userRow.quizToChapter
        ? `Bab ${userRow.quizFromChapter}`
        : `Bab ${userRow.quizFromChapter}–${userRow.quizToChapter}`
      : '';

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="liveQuizMonitorTitle"
      className="fixed inset-0 z-50 bg-slate-950/65 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5"
      onClick={e => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-3xl max-h-[90vh] flex flex-col rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden">
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
              <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                <h2
                  id="liveQuizMonitorTitle"
                  className="text-base font-bold text-slate-900 dark:text-slate-50 truncate"
                >
                  Pantau Kuis Live · {userRow.displayName}
                </h2>
                {userRow.quizInProgress ? (
                  <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 dark:text-emerald-400 shrink-0">
                    <span
                      className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"
                      aria-hidden="true"
                    />
                    Live
                  </span>
                ) : (
                  <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 shrink-0">
                    Sesi Berakhir
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                {userRow.quizInProgress && activeBook && modeInfo
                  ? `${activeBook.level} · ${modeInfo.title}${scopeLabel ? ` · ${scopeLabel}` : ''} · Diperbarui ${formatRelativeTimeId(
                      userRow.lastActiveMs,
                      nowMs
                    )}`
                  : `${userRow.email || 'Pengguna'} · Diperbarui ${formatRelativeTimeId(
                      userRow.lastActiveMs,
                      nowMs
                    )}`}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup pemantau kuis live"
            className="w-9 h-9 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 inline-flex items-center justify-center shrink-0 cursor-pointer"
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5">
          {!userRow.quizInProgress ? (
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/40 p-6 text-center space-y-3">
              <GraduationCap
                className="w-9 h-9 text-indigo-600 dark:text-indigo-400 mx-auto"
                aria-hidden="true"
              />
              <div className="space-y-1">
                <h3 className="text-base font-bold text-slate-900 dark:text-slate-50">
                  Sesi Kuis Telah Selesai atau Dihentikan
                </h3>
                <p className="text-sm text-slate-600 dark:text-slate-300">
                  {userRow.lastQuizSummary
                    ? `Ringkasan kuis terakhir: ${userRow.lastQuizSummary}`
                    : 'Pembelajar sudah keluar dari layar pengerjaan kuis.'}
                </p>
              </div>
              {onOpenFullDetail ? (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenFullDetail(userRow);
                  }}
                  className="min-h-[40px] px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs sm:text-sm font-semibold inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <Eye className="w-4 h-4" aria-hidden="true" />
                  <span>Buka Detail &amp; Riwayat Kuis</span>
                </button>
              ) : null}
            </div>
          ) : (
            <LiveQuizInlineCard
              userRow={userRow}
              showFurigana={showFurigana}
              showAnswerKey={showAnswerKey}
              onToggleAnswerKey={onToggleAnswerKey}
            />
          )}
        </div>
      </div>
    </div>
  );
}
