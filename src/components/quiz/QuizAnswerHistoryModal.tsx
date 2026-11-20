import { useEffect, useState } from 'react';
import { CheckCircle2, X, XCircle } from 'lucide-react';
import type { QuizAnswerEntry } from '../../types/bunpou';
import { AudioButton } from '../AudioButton';
import { JapaneseText } from '../JapaneseText';
import { Modal } from '../Modal';

interface QuizAnswerHistoryModalProps {
  open: boolean;
  answers: QuizAnswerEntry[];
  showFurigana: boolean;
  sessionMeta?: {
    title: string;
    subtitle: string;
    isLegacy?: boolean;
  };
  onClose: () => void;
}

export function QuizAnswerHistoryModal({
  open,
  answers,
  showFurigana,
  sessionMeta,
  onClose,
}: QuizAnswerHistoryModalProps) {
  const [filter, setFilter] = useState<'all' | 'wrong' | 'correct'>('all');

  useEffect(() => {
    if (open) setFilter('all');
  }, [open, answers]);

  if (!open) return null;

  const indexedAnswers = answers.map((entry, idx) => ({ entry, questionNo: idx + 1 }));
  const filtered = indexedAnswers.filter(({ entry }) => {
    if (filter === 'wrong') return !entry.isCorrect;
    if (filter === 'correct') return entry.isCorrect;
    return true;
  });

  const wrongCount = answers.filter(a => !a.isCorrect).length;
  const correctCount = answers.length - wrongCount;

  return (
    <Modal
      open={open}
      onClose={onClose}
      id="quizHistoryModalOverlay"
      ariaLabelledBy="quizHistoryModalTitle"
      maxWidthClass="max-w-2xl"
      panelClassName="overflow-hidden max-h-[85vh] flex flex-col"
    >
      <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3 shrink-0">
        <div>
          <h2 id="quizHistoryModalTitle" className="text-base font-bold text-slate-900 dark:text-slate-50">
            {sessionMeta ? sessionMeta.title : 'Review Jawaban Kuis'}
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 font-mono-num">
            {sessionMeta ? `${sessionMeta.subtitle} · ` : ''}
            {correctCount} benar · {wrongCount} salah dari {answers.length} soal
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Tutup review jawaban"
          className="w-9 h-9 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-300 inline-flex items-center justify-center cursor-pointer shrink-0"
        >
          <X className="w-4 h-4" aria-hidden="true" />
        </button>
      </div>

      <div className="px-5 py-2.5 border-b border-slate-100 dark:border-slate-800 flex flex-wrap items-center gap-2 shrink-0">
        {(['all', 'wrong', 'correct'] as const).map(f => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            className={`px-3 py-1 rounded-lg border text-xs font-semibold cursor-pointer ${
              filter === f
                ? 'bg-indigo-600 border-indigo-600 text-white'
                : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200'
            }`}
          >
            {f === 'all'
              ? `Semua (${answers.length})`
              : f === 'wrong'
              ? `Salah (${wrongCount})`
              : `Benar (${correctCount})`}
          </button>
        ))}
      </div>

      <div className="p-5 overflow-y-auto space-y-3 flex-1">
        {filtered.map(({ entry, questionNo }) => {
          const picked = entry.question.choices.find(c => c.id === entry.selectedChoiceId);
          const correct = entry.question.choices.find(c => c.id === entry.question.correctChoiceId);
          const isLegacyWrong = !entry.isCorrect && entry.selectedChoiceId === '__legacy_wrong__';

          return (
            <div
              key={entry.question.id}
              className={`rounded-xl border p-3.5 space-y-2 ${
                entry.isCorrect
                  ? 'border-emerald-200 dark:border-emerald-800/70 bg-emerald-50/40 dark:bg-emerald-950/25'
                  : 'border-rose-200 dark:border-rose-800/70 bg-rose-50/40 dark:bg-rose-950/25'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2 text-xs font-bold">
                  {entry.isCorrect ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" aria-hidden="true" />
                  ) : (
                    <XCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" aria-hidden="true" />
                  )}
                  <span className="text-slate-700 dark:text-slate-200">
                    Soal #{questionNo} · Bab {entry.question.chapter}
                  </span>
                </div>
                {entry.question.exampleJapanese ? (
                  <AudioButton text={entry.question.exampleJapanese} label="Putar contoh kalimat" />
                ) : null}
              </div>

              <div className="text-sm font-bold text-slate-900 dark:text-slate-50">
                {entry.question.mode === 'pattern' ? (
                  entry.question.prompt
                ) : (
                  <JapaneseText text={entry.question.prompt} showFurigana={showFurigana} />
                )}
              </div>

              <div className="text-xs space-y-1">
                {!entry.isCorrect && picked ? (
                  <p className="text-rose-700 dark:text-rose-300">
                    Jawaban Anda:{' '}
                    {picked.isJapanese ? (
                      <JapaneseText text={picked.label} showFurigana={showFurigana} />
                    ) : (
                      picked.label
                    )}
                  </p>
                ) : isLegacyWrong ? (
                  <p className="text-rose-700 dark:text-rose-300">
                    Jawaban Anda: Salah (sesi lama — detail pilihan belum tercatat)
                  </p>
                ) : null}
                {correct ? (
                  <p className="text-emerald-800 dark:text-emerald-300 font-semibold">
                    Jawaban Benar:{' '}
                    {correct.isJapanese ? (
                      <JapaneseText text={correct.label} showFurigana={showFurigana} />
                    ) : (
                      correct.label
                    )}
                  </p>
                ) : null}
              </div>

              {entry.question.formulas && entry.question.formulas.length > 0 ? (
                <p className="text-[11px] text-slate-600 dark:text-slate-300 font-jp">
                  <span className="font-sans font-semibold text-slate-500 dark:text-slate-400">
                    Rumus:{' '}
                  </span>
                  {entry.question.formulas.join(' / ')}
                </p>
              ) : null}

              {entry.question.exampleJapanese ? (
                <div className="pt-1.5 border-t border-slate-200/70 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-300">
                  <JapaneseText text={entry.question.exampleJapanese} showFurigana={showFurigana} />
                  {entry.question.exampleIndonesian ? (
                    <p className="mt-0.5 text-slate-500 dark:text-slate-400">
                      {entry.question.exampleIndonesian}
                    </p>
                  ) : null}
                </div>
              ) : null}
            </div>
          );
        })}

        {filtered.length === 0 ? (
          <p className="text-center text-sm text-slate-500 dark:text-slate-400 py-6">
            Tidak ada soal pada filter ini.
          </p>
        ) : null}
      </div>
    </Modal>
  );
}
