import { Award, Flag, ListChecks, RotateCcw, SlidersHorizontal } from 'lucide-react';
import type { QuizAnswerEntry } from '../../types/bunpou';
import { getScoreFeedback } from './quizHelpers';

interface QuizResultViewProps {
  answers: QuizAnswerEntry[];
  onRetrySame: () => void;
  onBackToSetup: () => void;
  onOpenHistoryModal: () => void;
  onMarkWrongDifficult: (patternIds: string[]) => void;
}

export function QuizResultView({
  answers,
  onRetrySame,
  onBackToSetup,
  onOpenHistoryModal,
  onMarkWrongDifficult,
}: QuizResultViewProps) {
  const total = answers.length;
  const correctCount = answers.filter(a => a.isCorrect).length;
  const wrongEntries = answers.filter(a => !a.isCorrect);
  const accuracy = total > 0 ? Math.round((correctCount / total) * 100) : 0;
  const feedback = getScoreFeedback(accuracy);

  return (
    <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-5 shadow-2xs">
      <div className="text-center space-y-2">
        <Award className="w-10 h-10 mx-auto text-indigo-600 dark:text-indigo-400" aria-hidden="true" />
        <p className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          Kuis Selesai
        </p>
        <p
          id="quizResultScore"
          className="text-4xl font-extrabold font-mono-num text-slate-900 dark:text-slate-50"
        >
          {correctCount}/{total} <span className="text-xl text-indigo-600 dark:text-indigo-400">({accuracy}%)</span>
        </p>
        <p className={`text-sm font-bold ${feedback.toneClass}`}>{feedback.title}</p>
      </div>

      <div className="grid grid-cols-2 gap-3 max-w-sm mx-auto text-center">
        <div className="rounded-xl border border-emerald-200 dark:border-emerald-800/70 bg-emerald-50/70 dark:bg-emerald-950/40 p-3">
          <div className="text-xs text-emerald-800 dark:text-emerald-300 font-semibold">Benar</div>
          <div className="text-xl font-extrabold font-mono-num text-emerald-700 dark:text-emerald-200">
            {correctCount}
          </div>
        </div>
        <div className="rounded-xl border border-rose-200 dark:border-rose-800/70 bg-rose-50/70 dark:bg-rose-950/40 p-3">
          <div className="text-xs text-rose-800 dark:text-rose-300 font-semibold">Salah</div>
          <div className="text-xl font-extrabold font-mono-num text-rose-700 dark:text-rose-200">
            {wrongEntries.length}
          </div>
        </div>
      </div>

      {wrongEntries.length > 0 ? (
        <div className="rounded-xl border border-amber-200 dark:border-amber-800/80 bg-amber-50/70 dark:bg-amber-950/40 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <p className="text-xs sm:text-sm text-amber-950 dark:text-amber-100">
            Ada <strong className="font-mono-num">{wrongEntries.length}</strong> pola yang belum tepat. Tandai sebagai &ldquo;Sulit&rdquo; untuk dilatih ulang?
          </p>
          <button
            type="button"
            onClick={() =>
              onMarkWrongDifficult(wrongEntries.map(entry => entry.question.patternId))
            }
            className="min-h-[36px] px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold inline-flex items-center justify-center gap-1.5 shrink-0 cursor-pointer"
          >
            <Flag className="w-3.5 h-3.5" aria-hidden="true" />
            Tandai Semua Sulit
          </button>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center justify-center gap-2.5 pt-2 border-t border-slate-100 dark:border-slate-800">
        <button
          type="button"
          id="btnOpenQuizReviewModal"
          onClick={onOpenHistoryModal}
          className="min-h-[40px] px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-100 text-sm font-semibold inline-flex items-center gap-1.5 cursor-pointer"
        >
          <ListChecks className="w-4 h-4" aria-hidden="true" />
          Review Jawaban ({total})
        </button>

        <button
          type="button"
          onClick={onRetrySame}
          className="min-h-[40px] px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold inline-flex items-center gap-1.5 cursor-pointer"
        >
          <RotateCcw className="w-4 h-4" aria-hidden="true" />
          Ulangi Kuis
        </button>

        <button
          type="button"
          onClick={onBackToSetup}
          className="min-h-[40px] px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-sm font-semibold inline-flex items-center gap-1.5 cursor-pointer"
        >
          <SlidersHorizontal className="w-4 h-4" aria-hidden="true" />
          Atur Ulang
        </button>
      </div>
    </div>
  );
}
