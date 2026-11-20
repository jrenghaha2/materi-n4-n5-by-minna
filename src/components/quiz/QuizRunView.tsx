import { useEffect } from 'react';
import { ArrowRight, CheckCircle2, X, XCircle } from 'lucide-react';
import type { QuizQuestion } from '../../types/bunpou';
import { AudioButton } from '../AudioButton';
import { JapaneseText } from '../JapaneseText';

interface QuizRunViewProps {
  questions: QuizQuestion[];
  currentIndex: number;
  selectedChoiceId: string | null;
  showFurigana: boolean;
  onSelectChoice: (choiceId: string) => void;
  onNextQuestion: () => void;
  onAbortQuiz: () => void;
}

export function QuizRunView({
  questions,
  currentIndex,
  selectedChoiceId,
  showFurigana,
  onSelectChoice,
  onNextQuestion,
  onAbortQuiz,
}: QuizRunViewProps) {
  const question = questions[currentIndex];
  const answered = selectedChoiceId !== null;
  const isCorrect = answered && selectedChoiceId === question?.correctChoiceId;
  const isLast = currentIndex === questions.length - 1;

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (!question) return;
      if (!answered && ['1', '2', '3', '4'].includes(e.key)) {
        const idx = Number(e.key) - 1;
        const choice = question.choices[idx];
        if (choice) {
          e.preventDefault();
          onSelectChoice(choice.id);
        }
      } else if (answered && e.key === 'Enter') {
        e.preventDefault();
        onNextQuestion();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [question, answered, onSelectChoice, onNextQuestion]);

  if (!question) return null;

  const progressPct = Math.round(((currentIndex + (answered ? 1 : 0)) / questions.length) * 100);

  return (
    <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 sm:p-6 space-y-5 shadow-2xs">
      {/* Progress bar & abort */}
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2 text-xs">
          <span className="font-mono-num font-bold text-slate-700 dark:text-slate-200">
            Soal {currentIndex + 1} / {questions.length} · Bab {question.chapter}
          </span>
          <button
            type="button"
            onClick={onAbortQuiz}
            className="text-slate-500 dark:text-slate-400 hover:text-rose-700 dark:hover:text-rose-400 inline-flex items-center gap-1 font-semibold cursor-pointer"
          >
            <X className="w-3.5 h-3.5" aria-hidden="true" />
            Keluar Kuis
          </button>
        </div>
        <div className="h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
          <div
            className="h-full rounded-full bg-indigo-600 dark:bg-indigo-400 transition-all duration-300"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>

      {/* Question Prompt */}
      <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/75 dark:bg-slate-800/45 p-5 space-y-2.5">
        <div className="flex items-start justify-between gap-3">
          <p className="text-xs font-bold uppercase tracking-wider text-indigo-700 dark:text-indigo-300">
            {question.mode === 'meaning'
              ? 'Pilih arti yang tepat untuk pola berikut:'
              : question.mode === 'cloze'
              ? 'Pilih pola bunpou yang melengkapi kalimat berikut:'
              : 'Pilih pola bahasa Jepang yang sesuai arti berikut:'}
          </p>
          {question.mode !== 'pattern' ? (
            <AudioButton text={question.prompt} label="Putar pengucapan soal" />
          ) : null}
        </div>

        <div className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-slate-50">
          {question.mode === 'pattern' ? (
            <span>{question.prompt}</span>
          ) : (
            <JapaneseText text={question.prompt} showFurigana={showFurigana} />
          )}
        </div>

        {question.promptSub ? (
          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 font-jp">
            {question.promptSub}
          </p>
        ) : null}
      </div>

      {/* 4 Choices */}
      <div className="grid grid-cols-1 gap-2.5">
        {question.choices.map((choice, idx) => {
          const isPicked = selectedChoiceId === choice.id;
          const isRightChoice = choice.id === question.correctChoiceId;

          let stateStyle =
            'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800';
          if (answered) {
            if (isRightChoice) {
              stateStyle =
                'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-500 text-emerald-950 dark:text-emerald-100';
            } else if (isPicked && !isRightChoice) {
              stateStyle =
                'bg-rose-50 dark:bg-rose-950/60 border-rose-500 text-rose-950 dark:text-rose-100';
            } else {
              stateStyle =
                'bg-slate-50/50 dark:bg-slate-900/50 border-slate-200/70 dark:border-slate-800 text-slate-400 dark:text-slate-500';
            }
          }

          return (
            <button
              key={choice.id}
              type="button"
              id={`quizChoice-${idx}`}
              disabled={answered}
              onClick={() => onSelectChoice(choice.id)}
              className={`w-full text-left rounded-xl border px-4 py-3 transition-colors flex items-center justify-between gap-3 ${
                answered ? 'cursor-default' : 'cursor-pointer'
              } ${stateStyle}`}
            >
              <div className="flex items-start gap-3 min-w-0">
                <span className="w-6 h-6 rounded-lg border border-current/25 text-xs font-mono-num font-bold inline-flex items-center justify-center shrink-0 mt-0.5">
                  {idx + 1}
                </span>
                <div className="min-w-0">
                  <div className="text-sm sm:text-base font-semibold">
                    {choice.isJapanese ? (
                      <JapaneseText text={choice.label} showFurigana={showFurigana} />
                    ) : (
                      <span>{choice.label}</span>
                    )}
                  </div>
                  {choice.subLabel && answered ? (
                    <p className="text-xs opacity-80 font-jp mt-0.5">{choice.subLabel}</p>
                  ) : null}
                </div>
              </div>

              {answered && isRightChoice ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" aria-hidden="true" />
              ) : answered && isPicked && !isRightChoice ? (
                <XCircle className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0" aria-hidden="true" />
              ) : null}
            </button>
          );
        })}
      </div>

      {/* Feedback & Next */}
      {answered ? (
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 p-4 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <p
              className={`text-sm font-bold ${
                isCorrect
                  ? 'text-emerald-700 dark:text-emerald-300'
                  : 'text-rose-700 dark:text-rose-300'
              }`}
            >
              {isCorrect ? 'Benar!' : 'Kurang tepat.'} {question.explanation}
            </p>
            {question.exampleJapanese ? (
              <AudioButton text={question.exampleJapanese} label="Putar contoh kalimat lengkap" />
            ) : null}
          </div>

          {question.exampleJapanese ? (
            <div className="text-xs sm:text-sm text-slate-700 dark:text-slate-200 space-y-0.5">
              <div>
                <JapaneseText text={question.exampleJapanese} showFurigana={showFurigana} />
              </div>
              {question.exampleIndonesian ? (
                <p className="text-slate-500 dark:text-slate-400">{question.exampleIndonesian}</p>
              ) : null}
            </div>
          ) : null}

          <div className="flex justify-end">
            <button
              type="button"
              id="btnQuizNext"
              onClick={onNextQuestion}
              className="min-h-[40px] px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold inline-flex items-center gap-1.5 cursor-pointer"
            >
              <span>{isLast ? 'Lihat Hasil Kuis' : 'Soal Berikutnya'}</span>
              <ArrowRight className="w-4 h-4" aria-hidden="true" />
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
