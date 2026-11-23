import { useEffect, useMemo } from 'react';
import {
  CheckCircle2,
  Clock,
  Eye,
  GraduationCap,
  Radio,
  X,
  XCircle,
} from 'lucide-react';
import { BOOKS_BY_ID } from '../../data/minnaDataset';
import type { AdminMonitoredUserRow } from '../../types/bunpou';
import {
  reconstructLiveAnswersReview,
  reconstructLiveQuizQuestion,
} from '../../utils/quizStats';
import { formatRelativeTimeId } from '../../utils/rbac';
import { AudioButton } from '../AudioButton';
import { JapaneseText } from '../JapaneseText';
import { QUIZ_MODE_INFO } from '../quiz/quizHelpers';

interface LiveQuizMonitorModalProps {
  open: boolean;
  userRow: AdminMonitoredUserRow | null;
  nowMs: number;
  showFurigana: boolean;
  onClose: () => void;
  onOpenFullDetail?: (row: AdminMonitoredUserRow) => void;
}

export function LiveQuizMonitorModal({
  open,
  userRow,
  nowMs,
  showFurigana,
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

  const activeBook = useMemo(() => {
    if (!userRow || !userRow.quizBookId) return null;
    return BOOKS_BY_ID[userRow.quizBookId] ?? null;
  }, [userRow]);

  const liveQuestion = useMemo(() => {
    if (
      !userRow ||
      !userRow.quizInProgress ||
      !activeBook ||
      !userRow.quizMode ||
      !userRow.quizPatternId
    ) {
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
    if (!userRow || !activeBook || userRow.quizLiveAnswers.length === 0) return [];
    return reconstructLiveAnswersReview(
      userRow.quizLiveAnswers,
      activeBook.id,
      activeBook.patterns
    );
  }, [userRow, activeBook]);

  if (!open || !userRow) return null;

  const initial = userRow.displayName.trim().charAt(0).toUpperCase() || 'U';
  const modeInfo = userRow.quizMode ? QUIZ_MODE_INFO[userRow.quizMode] : null;
  const scopeLabel =
    userRow.quizFromChapter > 0 && userRow.quizToChapter > 0
      ? userRow.quizFromChapter === userRow.quizToChapter
        ? `Bab ${userRow.quizFromChapter}`
        : `Bab ${userRow.quizFromChapter}–${userRow.quizToChapter}`
      : '';

  const isAnswered = Boolean(userRow.quizSelectedChoiceId) && userRow.quizAnswerCorrect !== -1;
  const isAnswerCorrect = userRow.quizAnswerCorrect === 1;
  const answeredCount = userRow.quizLiveAnswers.length;
  const wrongCount = Math.max(0, answeredCount - userRow.quizCorrectCount);
  const progressPct =
    userRow.quizTotalQuestions > 0
      ? Math.min(100, Math.round((userRow.quizCurrentQuestion / userRow.quizTotalQuestions) * 100))
      : 0;

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
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" aria-hidden="true" />
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
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
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
            <>
              {/* Live Session Progress Header */}
              <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-950/40 p-4 space-y-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs sm:text-sm">
                  <span className="font-bold font-mono tabular-nums text-slate-900 dark:text-slate-50">
                    Soal {userRow.quizCurrentQuestion} / {userRow.quizTotalQuestions}
                  </span>
                  <div className="flex items-center gap-3 font-mono tabular-nums text-xs">
                    <span className="font-semibold text-emerald-700 dark:text-emerald-400">
                      Benar: {userRow.quizCorrectCount}
                    </span>
                    <span className="font-semibold text-rose-700 dark:text-rose-400">
                      Salah: {wrongCount}
                    </span>
                    <span className="text-slate-500 dark:text-slate-400">
                      Terjawab: {answeredCount}/{userRow.quizTotalQuestions}
                    </span>
                  </div>
                </div>
                <div className="h-2 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-indigo-600 dark:bg-indigo-400 transition-all duration-300"
                    style={{ width: `${progressPct}%` }}
                  />
                </div>
              </div>

              {/* Current Active Question & Choices */}
              {liveQuestion ? (
                <div className="space-y-3.5">
                  {/* Live Answer Status Banner */}
                  <div
                    className={`rounded-xl border px-4 py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs sm:text-sm font-semibold ${
                      !isAnswered
                        ? 'border-indigo-200 dark:border-indigo-800/80 bg-indigo-50/70 dark:bg-indigo-950/40 text-indigo-800 dark:text-indigo-200'
                        : isAnswerCorrect
                        ? 'border-emerald-200 dark:border-emerald-800/80 bg-emerald-50/80 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-200'
                        : 'border-rose-200 dark:border-rose-800/80 bg-rose-50/80 dark:bg-rose-950/40 text-rose-800 dark:text-rose-200'
                    }`}
                  >
                    <span className="inline-flex items-center gap-2">
                      {!isAnswered ? (
                        <Clock className="w-4 h-4 shrink-0" aria-hidden="true" />
                      ) : isAnswerCorrect ? (
                        <CheckCircle2 className="w-4 h-4 shrink-0" aria-hidden="true" />
                      ) : (
                        <XCircle className="w-4 h-4 shrink-0" aria-hidden="true" />
                      )}
                      <span>
                        {!isAnswered
                          ? 'Pembelajar sedang membaca soal dan memilih jawaban...'
                          : isAnswerCorrect
                          ? 'Jawaban yang dipilih pembelajar: BENAR'
                          : 'Jawaban yang dipilih pembelajar: SALAH'}
                      </span>
                    </span>
                    <span className="text-xs font-mono opacity-80">Bab {liveQuestion.chapter}</span>
                  </div>

                  {/* Question Prompt Card */}
                  <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-5 space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-xs font-bold uppercase tracking-wider text-indigo-700 dark:text-indigo-300">
                        {liveQuestion.mode === 'meaning'
                          ? 'Soal: Pilih arti yang tepat untuk pola berikut'
                          : liveQuestion.mode === 'pattern'
                          ? 'Soal: Pilih pola tata bahasa yang tepat'
                          : 'Soal: Lengkapi kalimat berikut dengan pola yang tepat'}
                      </p>
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

                    <div className="space-y-1.5">
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
                          <div className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                            <JapaneseText
                              text={liveQuestion.promptSub}
                              showFurigana={showFurigana}
                            />
                          </div>
                        ) : (
                          <p className="text-sm text-slate-600 dark:text-slate-300">
                            {liveQuestion.promptSub}
                          </p>
                        )
                      ) : null}
                    </div>

                    {/* Exact 4 Choices Shown to Learner */}
                    <div className="pt-2 space-y-2">
                      <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                        Pilihan Jawaban yang Ditampilkan ({liveQuestion.choices.length})
                      </p>

                      <div className="space-y-2">
                        {liveQuestion.choices.map((choice, idx) => {
                          const isCorrectChoice = choice.id === liveQuestion.correctChoiceId;
                          const isSelectedChoice =
                            isAnswered && choice.id === userRow.quizSelectedChoiceId;

                          let boxStyle =
                            'border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/30';
                          if (isAnswered) {
                            if (isCorrectChoice) {
                              boxStyle =
                                'border-emerald-400 dark:border-emerald-700 bg-emerald-50/80 dark:bg-emerald-950/40';
                            } else if (isSelectedChoice) {
                              boxStyle =
                                'border-rose-400 dark:border-rose-700 bg-rose-50/80 dark:bg-rose-950/40';
                            } else {
                              boxStyle =
                                'border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-slate-900 opacity-65';
                            }
                          } else if (isCorrectChoice) {
                            boxStyle =
                              'border-indigo-300 dark:border-indigo-800 bg-indigo-50/40 dark:bg-indigo-950/25';
                          }

                          return (
                            <div
                              key={choice.id}
                              className={`rounded-xl border px-3.5 py-2.5 flex items-start justify-between gap-3 transition-colors ${boxStyle}`}
                            >
                              <div className="flex items-start gap-2.5 min-w-0 flex-1">
                                <span className="w-6 h-6 rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-xs font-mono font-bold text-slate-700 dark:text-slate-200 inline-flex items-center justify-center shrink-0 mt-0.5">
                                  {idx + 1}
                                </span>
                                <div className="min-w-0 flex-1">
                                  {choice.isJapanese ? (
                                    <div className="text-sm sm:text-base font-bold text-slate-900 dark:text-slate-50">
                                      <JapaneseText
                                        text={choice.label}
                                        showFurigana={showFurigana}
                                      />
                                    </div>
                                  ) : (
                                    <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                                      {choice.label}
                                    </p>
                                  )}
                                  {choice.subLabel ? (
                                    <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400 font-jp">
                                      {choice.subLabel}
                                    </p>
                                  ) : null}
                                </div>
                              </div>

                              <div className="shrink-0 text-right">
                                {isSelectedChoice && isCorrectChoice ? (
                                  <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 dark:text-emerald-400 whitespace-nowrap">
                                    <CheckCircle2 className="w-4 h-4" aria-hidden="true" />
                                    Dipilih · Benar
                                  </span>
                                ) : isSelectedChoice && !isCorrectChoice ? (
                                  <span className="inline-flex items-center gap-1 text-xs font-bold text-rose-700 dark:text-rose-400 whitespace-nowrap">
                                    <XCircle className="w-4 h-4" aria-hidden="true" />
                                    Dipilih · Salah
                                  </span>
                                ) : isAnswered && isCorrectChoice ? (
                                  <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 dark:text-emerald-400 whitespace-nowrap">
                                    <CheckCircle2 className="w-4 h-4" aria-hidden="true" />
                                    Jawaban Benar
                                  </span>
                                ) : !isAnswered && isCorrectChoice ? (
                                  <span className="text-xs font-semibold text-indigo-700 dark:text-indigo-300 whitespace-nowrap">
                                    Kunci Jawaban
                                  </span>
                                ) : null}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Full Example Reference */}
                    {liveQuestion.exampleJapanese ? (
                      <div className="pt-2 border-t border-slate-100 dark:border-slate-800 text-xs space-y-0.5">
                        <p className="font-semibold text-slate-500 dark:text-slate-400">
                          Kalimat Lengkap &amp; Penjelasan:
                        </p>
                        <div className="text-sm font-medium text-slate-800 dark:text-slate-100">
                          <JapaneseText
                            text={liveQuestion.exampleJapanese}
                            showFurigana={showFurigana}
                          />
                        </div>
                        {liveQuestion.exampleIndonesian ? (
                          <p className="text-slate-600 dark:text-slate-300">
                            {liveQuestion.exampleIndonesian}
                          </p>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                </div>
              ) : (
                <div className="rounded-xl border border-dashed border-slate-200 dark:border-slate-800 p-5 text-center space-y-1.5">
                  <Radio className="w-5 h-5 text-indigo-600 dark:text-indigo-400 mx-auto" aria-hidden="true" />
                  <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                    Menunggu detail soal berikutnya dari perangkat pembelajar...
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Jika pembelajar memulai kuis sebelum pembaruan terbaru, soal detail akan tampil begitu soal baru dimuat.
                  </p>
                </div>
              )}

              {/* Running History of Answered Questions in This Live Session */}
              {runningHistory.length > 0 ? (
                <div className="space-y-2.5 pt-2 border-t border-slate-200 dark:border-slate-800">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-sm font-bold text-slate-900 dark:text-slate-50">
                      Riwayat Jawaban Sesi Berjalan ({runningHistory.length})
                    </h3>
                    <span className="text-xs text-slate-500 dark:text-slate-400">
                      Diperbarui otomatis setiap jawaban dipilih
                    </span>
                  </div>

                  <div className="space-y-2">
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
                          className={`rounded-xl border px-3.5 py-2.5 space-y-1 text-xs ${
                            entry.isCorrect
                              ? 'border-emerald-200/90 dark:border-emerald-900/70 bg-emerald-50/40 dark:bg-emerald-950/20'
                              : 'border-rose-200/90 dark:border-rose-900/70 bg-rose-50/40 dark:bg-rose-950/20'
                          }`}
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

                          <div className="text-sm font-bold text-slate-900 dark:text-slate-50">
                            {entry.question.mode === 'pattern' ? (
                              entry.question.prompt
                            ) : (
                              <JapaneseText
                                text={entry.question.prompt}
                                showFurigana={showFurigana}
                              />
                            )}
                          </div>

                          <div className="flex flex-col sm:flex-row sm:items-center gap-x-4 gap-y-0.5 text-slate-600 dark:text-slate-300">
                            <span>
                              Pilihan pembelajar:{' '}
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
                            {!entry.isCorrect && correct ? (
                              <span>
                                Jawaban benar:{' '}
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
                </div>
              ) : null}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
