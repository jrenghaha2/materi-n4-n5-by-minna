import { useMemo, useState } from 'react';
import {
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  Eye,
  EyeOff,
  Radio,
  XCircle,
} from 'lucide-react';
import { BOOKS_BY_ID } from '../../data/minnaDataset';
import type { AdminMonitoredUserRow } from '../../types/bunpou';
import {
  reconstructLiveAnswersReview,
  reconstructLiveQuizQuestion,
} from '../../utils/quizStats';
import { AudioButton } from '../AudioButton';
import { JapaneseText } from '../JapaneseText';
import { QUIZ_MODE_INFO } from '../quiz/quizHelpers';

const CHOICE_LETTERS = ['A', 'B', 'C', 'D'] as const;

interface LiveQuizInlineCardProps {
  userRow: AdminMonitoredUserRow;
  showFurigana: boolean;
  showAnswerKey: boolean;
  onToggleAnswerKey: () => void;
}

export function LiveQuizInlineCard({
  userRow,
  showFurigana,
  showAnswerKey,
  onToggleAnswerKey,
}: LiveQuizInlineCardProps) {
  const [historyOpen, setHistoryOpen] = useState(false);

  const activeBook = useMemo(() => {
    if (!userRow.quizBookId) return null;
    return BOOKS_BY_ID[userRow.quizBookId] ?? null;
  }, [userRow.quizBookId]);

  const liveQuestion = useMemo(() => {
    if (!userRow.quizInProgress || !activeBook || !userRow.quizMode || !userRow.quizPatternId) {
      return null;
    }
    return reconstructLiveQuizQuestion({
      mode: userRow.quizMode,
      patternId: userRow.quizPatternId,
      exampleIndex: userRow.quizExampleIndex,
      choiceIds: userRow.quizChoiceIds,
      patterns: activeBook.patterns,
      questionId: `live-${userRow.uid}-q${userRow.quizCurrentQuestion}`,
    });
  }, [userRow, activeBook]);

  const runningHistory = useMemo(() => {
    if (!activeBook || userRow.quizLiveAnswers.length === 0) return [];
    return reconstructLiveAnswersReview(
      userRow.quizLiveAnswers,
      activeBook.id,
      activeBook.patterns
    );
  }, [userRow.quizLiveAnswers, activeBook]);

  const scopeLabel = useMemo(() => {
    if (userRow.quizFromChapter <= 0 || userRow.quizToChapter <= 0) return '';
    const minCh = activeBook?.chapters[0]?.chapter;
    const maxCh = activeBook?.chapters[activeBook.chapters.length - 1]?.chapter;
    if (
      minCh !== undefined &&
      maxCh !== undefined &&
      userRow.quizFromChapter === minCh &&
      userRow.quizToChapter === maxCh
    ) {
      return 'Semua Bab';
    }
    if (userRow.quizFromChapter === userRow.quizToChapter) {
      return `Bab ${userRow.quizFromChapter}`;
    }
    return `Bab ${userRow.quizFromChapter}–${userRow.quizToChapter}`;
  }, [activeBook, userRow.quizFromChapter, userRow.quizToChapter]);

  const modeInfo = userRow.quizMode ? QUIZ_MODE_INFO[userRow.quizMode] : null;
  const isAnswered = Boolean(userRow.quizSelectedChoiceId) && userRow.quizAnswerCorrect !== -1;
  const isAnswerCorrect = userRow.quizAnswerCorrect === 1;

  return (
    <div className="rounded-2xl border border-amber-300/80 dark:border-amber-700/60 bg-amber-50/45 dark:bg-amber-950/20 p-3.5 sm:p-4 space-y-3">
      {/* Header Row */}
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 min-w-0">
          <span
            className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse shrink-0"
            aria-hidden="true"
          />
          <span className="text-xs sm:text-sm font-bold text-slate-900 dark:text-slate-50">
            Pantauan Soal Kuis Real-Time
          </span>
          {scopeLabel ? (
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
              · {scopeLabel}
            </span>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          {/* Answer Key Toggle (OFF / Mati by default) */}
          <button
            type="button"
            aria-pressed={showAnswerKey}
            onClick={onToggleAnswerKey}
            className={`min-h-[32px] px-2.5 py-1 rounded-lg border text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap ${
              showAnswerKey
                ? 'border-emerald-300 dark:border-emerald-700/80 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300'
                : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
            }`}
          >
            {showAnswerKey ? (
              <Eye className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
            ) : (
              <EyeOff className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
            )}
            <span>Kunci Jawaban: {showAnswerKey ? 'Aktif' : 'Mati'}</span>
          </button>

          <div className="flex items-center gap-2 text-xs font-mono tabular-nums">
            <span className="font-bold text-slate-800 dark:text-slate-100">
              Soal {userRow.quizCurrentQuestion}/{userRow.quizTotalQuestions}
            </span>
            <span className="text-slate-300 dark:text-slate-700" aria-hidden="true">
              ·
            </span>
            <span className="font-bold text-emerald-700 dark:text-emerald-400">
              {userRow.quizCorrectCount} benar
            </span>
          </div>
        </div>
      </div>

      {/* Inner Live Question Card */}
      {liveQuestion ? (
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3.5 sm:p-4 space-y-3.5 shadow-2xs">
          {/* Question Meta + Live Status */}
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-indigo-700 dark:text-indigo-300 font-semibold">
              <Radio className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
              <span className="font-mono font-bold">Soal #{userRow.quizCurrentQuestion}</span>
              {modeInfo ? (
                <>
                  <span className="text-slate-300 dark:text-slate-700" aria-hidden="true">
                    ·
                  </span>
                  <span>{modeInfo.title}</span>
                </>
              ) : null}
              <span className="text-slate-300 dark:text-slate-700" aria-hidden="true">
                ·
              </span>
              <span className="font-mono text-slate-600 dark:text-slate-300">
                Bab {liveQuestion.chapter}
              </span>
              {(liveQuestion.mode === 'meaning' || liveQuestion.exampleJapanese) ? (
                <AudioButton
                  text={
                    liveQuestion.mode === 'meaning'
                      ? liveQuestion.prompt
                      : liveQuestion.exampleJapanese || liveQuestion.prompt
                  }
                  label="Putar audio soal"
                />
              ) : null}
            </div>

            {!isAnswered ? (
              <span className="inline-flex items-center gap-1.5 font-semibold text-amber-700 dark:text-amber-400">
                <Clock className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                <span>Menunggu pilihan jawaban...</span>
              </span>
            ) : isAnswerCorrect ? (
              <span className="inline-flex items-center gap-1.5 font-bold text-emerald-700 dark:text-emerald-400">
                <CheckCircle2 className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                <span>Dijawab Benar</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 font-bold text-rose-700 dark:text-rose-400">
                <XCircle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                <span>Dijawab Salah</span>
              </span>
            )}
          </div>

          {/* Question Prompt Box */}
          <div className="rounded-xl border border-slate-200/90 dark:border-slate-800 bg-slate-50/75 dark:bg-slate-950/50 px-4 py-3.5 space-y-1.5">
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
              {liveQuestion.mode === 'meaning'
                ? 'Pilih arti yang tepat untuk pola berikut:'
                : liveQuestion.mode === 'pattern'
                ? 'Pilih pola tata bahasa yang artinya:'
                : 'Lengkapi kalimat berikut dengan pola yang tepat:'}
            </p>

            {liveQuestion.mode === 'pattern' ? (
              <p className="text-lg sm:text-xl font-extrabold text-slate-900 dark:text-slate-50 leading-snug">
                {liveQuestion.prompt}
              </p>
            ) : (
              <div className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-slate-50 leading-relaxed">
                <JapaneseText text={liveQuestion.prompt} showFurigana={showFurigana} />
              </div>
            )}

            {liveQuestion.promptSub ? (
              liveQuestion.mode === 'meaning' ? (
                <div className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed pt-0.5">
                  <JapaneseText text={liveQuestion.promptSub} showFurigana={showFurigana} />
                </div>
              ) : (
                <p className="text-sm text-slate-600 dark:text-slate-300 pt-0.5">
                  {liveQuestion.promptSub}
                </p>
              )
            ) : null}
          </div>

          {/* 2x2 Choices Grid (A, B, C, D) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {liveQuestion.choices.map((choice, idx) => {
              const letter = CHOICE_LETTERS[idx] ?? String(idx + 1);
              const isCorrectChoice = choice.id === liveQuestion.correctChoiceId;
              const isSelectedChoice =
                isAnswered && choice.id === userRow.quizSelectedChoiceId;

              let cardClasses =
                'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900';
              let badgeClasses =
                'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200';
              let statusEl: React.ReactNode = null;

              if (isAnswered) {
                if (isSelectedChoice && isCorrectChoice) {
                  cardClasses =
                    'border-emerald-400 dark:border-emerald-600/80 bg-emerald-50/75 dark:bg-emerald-950/35';
                  badgeClasses =
                    'bg-emerald-100 dark:bg-emerald-900/70 text-emerald-800 dark:text-emerald-200';
                  statusEl = (
                    <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 dark:text-emerald-400 whitespace-nowrap shrink-0">
                      <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
                      Benar
                    </span>
                  );
                } else if (isSelectedChoice && !isCorrectChoice) {
                  cardClasses =
                    'border-rose-400 dark:border-rose-600/80 bg-rose-50/75 dark:bg-rose-950/35';
                  badgeClasses =
                    'bg-rose-100 dark:bg-rose-900/70 text-rose-800 dark:text-rose-200';
                  statusEl = (
                    <span className="inline-flex items-center gap-1 text-xs font-bold text-rose-700 dark:text-rose-400 whitespace-nowrap shrink-0">
                      <XCircle className="w-3.5 h-3.5" aria-hidden="true" />
                      Dipilih · Salah
                    </span>
                  );
                } else if (isCorrectChoice && showAnswerKey) {
                  cardClasses =
                    'border-emerald-400 dark:border-emerald-600/80 bg-emerald-50/60 dark:bg-emerald-950/30';
                  badgeClasses =
                    'bg-emerald-100 dark:bg-emerald-900/70 text-emerald-800 dark:text-emerald-200';
                  statusEl = (
                    <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400 whitespace-nowrap shrink-0">
                      Kunci
                    </span>
                  );
                } else {
                  cardClasses =
                    'border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-slate-900 opacity-65';
                }
              } else if (showAnswerKey && isCorrectChoice) {
                cardClasses =
                  'border-emerald-400 dark:border-emerald-600/80 bg-emerald-50/60 dark:bg-emerald-950/30';
                badgeClasses =
                  'bg-emerald-100 dark:bg-emerald-900/70 text-emerald-800 dark:text-emerald-200';
                statusEl = (
                  <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400 whitespace-nowrap shrink-0">
                    Kunci
                  </span>
                );
              }

              return (
                <div
                  key={choice.id}
                  className={`rounded-xl border px-3.5 py-3 flex items-center justify-between gap-2.5 transition-colors ${cardClasses}`}
                >
                  <div className="flex items-start gap-2.5 min-w-0 flex-1">
                    <span
                      className={`w-7 h-7 rounded-lg font-mono text-xs font-bold inline-flex items-center justify-center shrink-0 ${badgeClasses}`}
                    >
                      {letter}
                    </span>
                    <div className="min-w-0 flex-1 pt-0.5">
                      {choice.isJapanese ? (
                        <div className="text-sm sm:text-base font-bold text-slate-900 dark:text-slate-50 leading-snug">
                          <JapaneseText text={choice.label} showFurigana={showFurigana} />
                        </div>
                      ) : (
                        <p className="text-sm font-semibold text-slate-900 dark:text-slate-100 leading-snug">
                          {choice.label}
                        </p>
                      )}
                      {choice.subLabel ? (
                        <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400 font-jp truncate">
                          {choice.subLabel}
                        </p>
                      ) : null}
                    </div>
                  </div>
                  {statusEl}
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-amber-300 dark:border-amber-800/70 bg-white/80 dark:bg-slate-900/70 p-4 text-center space-y-1">
          <p className="text-xs sm:text-sm font-semibold text-slate-800 dark:text-slate-100">
            Menunggu data soal aktif dari perangkat pembelajar...
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Soal dan 4 pilihan jawaban akan tampil otomatis begitu soal dimuat.
          </p>
        </div>
      )}

      {/* Collapsible Running Answer History for This Ongoing Quiz */}
      {runningHistory.length > 0 ? (
        <div className="rounded-xl border border-slate-200/90 dark:border-slate-800 bg-white/90 dark:bg-slate-900/80 overflow-hidden">
          <button
            type="button"
            onClick={() => setHistoryOpen(v => !v)}
            className="w-full px-3.5 py-2.5 flex items-center justify-between gap-2 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors cursor-pointer"
          >
            <span>Riwayat Jawaban Sesi Berjalan ({runningHistory.length} terjawab)</span>
            {historyOpen ? (
              <ChevronUp className="w-4 h-4 text-slate-400 shrink-0" aria-hidden="true" />
            ) : (
              <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" aria-hidden="true" />
            )}
          </button>

          {historyOpen ? (
            <div className="border-t border-slate-200 dark:border-slate-800 divide-y divide-slate-100 dark:divide-slate-800/80 max-h-64 overflow-y-auto">
              {[...runningHistory].reverse().map((entry, revIdx) => {
                const qNumber = runningHistory.length - revIdx;
                const chosen = entry.question.choices.find(
                  c => c.id === entry.selectedChoiceId
                );
                const correct = entry.question.choices.find(
                  c => c.id === entry.question.correctChoiceId
                );

                return (
                  <div
                    key={`${entry.question.id}-${qNumber}`}
                    className="px-3.5 py-2.5 text-xs space-y-1"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono font-bold text-slate-700 dark:text-slate-200">
                        Soal #{qNumber} · Bab {entry.question.chapter}
                      </span>
                      {entry.isCorrect ? (
                        <span className="inline-flex items-center gap-1 font-bold text-emerald-700 dark:text-emerald-400">
                          <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
                          Benar
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 font-bold text-rose-700 dark:text-rose-400">
                          <XCircle className="w-3.5 h-3.5" aria-hidden="true" />
                          Salah
                        </span>
                      )}
                    </div>

                    <div className="font-semibold text-slate-900 dark:text-slate-100">
                      {entry.question.mode === 'pattern' ? (
                        entry.question.prompt
                      ) : (
                        <JapaneseText
                          text={entry.question.prompt}
                          showFurigana={showFurigana}
                        />
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-x-4 gap-y-0.5 text-slate-600 dark:text-slate-300">
                      <span>
                        Dipilih:{' '}
                        <strong
                          className={
                            entry.isCorrect
                              ? 'text-emerald-700 dark:text-emerald-400'
                              : 'text-rose-700 dark:text-rose-400'
                          }
                        >
                          {chosen ? (
                            chosen.isJapanese ? (
                              <JapaneseText
                                text={chosen.label}
                                showFurigana={showFurigana}
                              />
                            ) : (
                              chosen.label
                            )
                          ) : (
                            '—'
                          )}
                        </strong>
                      </span>

                      {!entry.isCorrect && showAnswerKey && correct ? (
                        <span>
                          Kunci:{' '}
                          <strong className="text-emerald-700 dark:text-emerald-400">
                            {correct.isJapanese ? (
                              <JapaneseText
                                text={correct.label}
                                showFurigana={showFurigana}
                              />
                            ) : (
                              correct.label
                            )}
                          </strong>
                        </span>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
