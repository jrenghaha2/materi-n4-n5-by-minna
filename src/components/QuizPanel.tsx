import { useEffect, useMemo, useRef, useState } from 'react';
import type {
  BookData,
  LiveQuizAnswerCorrect,
  QuizAnswerEntry,
  QuizMode,
  QuizQuestion,
  QuizSavedAnswer,
  QuizSessionRecord,
} from '../types/bunpou';
import { filterQuizPool, generateQuizQuestions } from '../utils/quizGenerator';
import { createQuizSessionId, reconstructSessionReview } from '../utils/quizStats';
import { stopJapaneseSpeech } from '../utils/speech';
import { QuizAnswerHistoryModal } from './quiz/QuizAnswerHistoryModal';
import { QUIZ_MODE_INFO } from './quiz/quizHelpers';
import { QuizResultView } from './quiz/QuizResultView';
import { QuizRunView } from './quiz/QuizRunView';
import { QuizSetupView } from './quiz/QuizSetupView';

function toSavedAnswers(entries: QuizAnswerEntry[]): QuizSavedAnswer[] {
  return entries.map((a, idx) => ({
    questionNo: idx + 1,
    mode: a.question.mode,
    patternId: a.question.patternId,
    selectedPatternId: a.isCorrect ? a.question.patternId : a.selectedChoiceId,
    isCorrect: a.isCorrect,
    exampleIndex: a.question.exampleIndex,
  }));
}

interface QuizPanelProps {
  book: BookData;
  showFurigana: boolean;
  masteredSet: Set<string>;
  difficultSet: Set<string>;
  sessions: QuizSessionRecord[];
  isCloudSynced?: boolean;
  syncingQuiz?: boolean;
  onQuizStarted?: (info: {
    bookId: BookData['id'];
    mode: QuizMode;
    fromChapter: number;
    toChapter: number;
    totalQuestions: number;
    patternId: string;
    exampleIndex: number;
    choiceIds: string[];
  }) => void;
  onQuizProgress?: (info: {
    bookId: BookData['id'];
    mode: QuizMode;
    fromChapter: number;
    toChapter: number;
    currentQuestion: number;
    totalQuestions: number;
    correctCount: number;
    patternId: string;
    exampleIndex: number;
    choiceIds: string[];
    selectedChoiceId: string;
    answerCorrect: LiveQuizAnswerCorrect;
    liveAnswers: QuizSavedAnswer[];
  }) => void;
  onQuizAborted?: () => void;
  onCompleteSession: (record: QuizSessionRecord) => void;
  onClearHistory: () => void;
  onMarkPatternsDifficult: (patternIds: string[]) => void;
}

type QuizPhase = 'setup' | 'running' | 'result';

export function QuizPanel({
  book,
  showFurigana,
  masteredSet,
  difficultSet,
  sessions,
  isCloudSynced = false,
  syncingQuiz = false,
  onQuizStarted,
  onQuizProgress,
  onQuizAborted,
  onCompleteSession,
  onClearHistory,
  onMarkPatternsDifficult,
}: QuizPanelProps) {
  const minCh = book.chapters[0]?.chapter ?? 1;
  const maxCh = book.chapters[book.chapters.length - 1]?.chapter ?? 25;

  const [phase, setPhase] = useState<QuizPhase>('setup');
  const [mode, setMode] = useState<QuizMode>('meaning');
  const [fromChapter, setFromChapter] = useState<number>(minCh);
  const [toChapter, setToChapter] = useState<number>(maxCh);
  const [questionCount, setQuestionCount] = useState<number>(10);
  const [onlyDifficult, setOnlyDifficult] = useState<boolean>(false);
  const [onlyUnmastered, setOnlyUnmastered] = useState<boolean>(false);

  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [selectedChoiceId, setSelectedChoiceId] = useState<string | null>(null);
  const [answers, setAnswers] = useState<QuizAnswerEntry[]>([]);
  const [historyModalOpen, setHistoryModalOpen] = useState<boolean>(false);
  const [inspectedSession, setInspectedSession] = useState<QuizSessionRecord | null>(null);

  const onQuizAbortedRef = useRef(onQuizAborted);
  onQuizAbortedRef.current = onQuizAborted;
  const prevBookIdRef = useRef(book.id);

  // Reset quiz range and state ONLY when book actually switches (N5 <-> N4)
  useEffect(() => {
    if (prevBookIdRef.current === book.id) return;
    prevBookIdRef.current = book.id;
    stopJapaneseSpeech();
    onQuizAbortedRef.current?.();
    setPhase('setup');
    setFromChapter(minCh);
    setToChapter(maxCh);
    setQuestions([]);
    setAnswers([]);
    setCurrentIndex(0);
    setSelectedChoiceId(null);
    setHistoryModalOpen(false);
    setInspectedSession(null);
  }, [book.id, minCh, maxCh]);

  // Cleanly end live quiz status if learner navigates away from the Quiz tab
  useEffect(() => {
    return () => {
      onQuizAbortedRef.current?.();
    };
  }, []);

  const availableCount = useMemo(
    () =>
      filterQuizPool(book.patterns, {
        fromChapter,
        toChapter,
        onlyDifficult,
        onlyUnmastered,
        masteredSet,
        difficultSet,
      }).length,
    [book.patterns, fromChapter, toChapter, onlyDifficult, onlyUnmastered, masteredSet, difficultSet]
  );

  const inspectedAnswers = useMemo(() => {
    if (!inspectedSession) return null;
    return reconstructSessionReview(inspectedSession, book.patterns);
  }, [inspectedSession, book.patterns]);

  const inspectedMeta = useMemo(() => {
    if (!inspectedSession) return undefined;
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
      title: `Detail Riwayat · ${QUIZ_MODE_INFO[inspectedSession.mode].title}`,
      subtitle: `${chapterRange} · ${dateLabel}`,
      isLegacy: !inspectedSession.answers || inspectedSession.answers.length === 0,
    };
  }, [inspectedSession]);

  const startQuizWithRange = (
    startCh: number,
    endCh: number,
    overrideDifficult = onlyDifficult,
    overrideUnmastered = onlyUnmastered
  ) => {
    stopJapaneseSpeech();
    const generated = generateQuizQuestions(book.patterns, {
      bookId: book.id,
      mode,
      fromChapter: startCh,
      toChapter: endCh,
      questionCount,
      onlyDifficult: overrideDifficult,
      onlyUnmastered: overrideUnmastered,
      masteredSet,
      difficultSet,
    });
    if (generated.length === 0) return;
    setFromChapter(startCh);
    setToChapter(endCh);
    setQuestions(generated);
    setCurrentIndex(0);
    setSelectedChoiceId(null);
    setAnswers([]);
    setInspectedSession(null);
    setPhase('running');
    const firstQ = generated[0];
    onQuizStarted?.({
      bookId: book.id,
      mode,
      fromChapter: startCh,
      toChapter: endCh,
      totalQuestions: generated.length,
      patternId: firstQ.patternId,
      exampleIndex: firstQ.exampleIndex,
      choiceIds: firstQ.choices.map(c => c.id),
    });
  };

  const handleSelectChoice = (choiceId: string) => {
    if (selectedChoiceId !== null) return;
    const current = questions[currentIndex];
    if (!current) return;
    const isCorrect = choiceId === current.correctChoiceId;
    const nextAnswers: QuizAnswerEntry[] = [
      ...answers,
      {
        question: current,
        selectedChoiceId: choiceId,
        isCorrect,
      },
    ];
    const nextCorrectCount = nextAnswers.reduce((acc, a) => acc + (a.isCorrect ? 1 : 0), 0);

    setSelectedChoiceId(choiceId);
    setAnswers(nextAnswers);

    onQuizProgress?.({
      bookId: book.id,
      mode,
      fromChapter,
      toChapter,
      currentQuestion: currentIndex + 1,
      totalQuestions: questions.length,
      correctCount: nextCorrectCount,
      patternId: current.patternId,
      exampleIndex: current.exampleIndex,
      choiceIds: current.choices.map(c => c.id),
      selectedChoiceId: choiceId,
      answerCorrect: isCorrect ? 1 : 0,
      liveAnswers: toSavedAnswers(nextAnswers),
    });
  };

  const handleNextQuestion = () => {
    stopJapaneseSpeech();
    if (currentIndex + 1 < questions.length) {
      const nextIdx = currentIndex + 1;
      const nextQ = questions[nextIdx];
      setCurrentIndex(nextIdx);
      setSelectedChoiceId(null);
      if (nextQ) {
        onQuizProgress?.({
          bookId: book.id,
          mode,
          fromChapter,
          toChapter,
          currentQuestion: nextIdx + 1,
          totalQuestions: questions.length,
          correctCount: answers.reduce((acc, a) => acc + (a.isCorrect ? 1 : 0), 0),
          patternId: nextQ.patternId,
          exampleIndex: nextQ.exampleIndex,
          choiceIds: nextQ.choices.map(c => c.id),
          selectedChoiceId: '',
          answerCorrect: -1,
          liveAnswers: toSavedAnswers(answers),
        });
      }
      return;
    }

    // Complete session with detailed per-question V2 answer records
    const correctIds: string[] = [];
    const wrongIds: string[] = [];
    for (const a of answers) {
      if (a.isCorrect) correctIds.push(a.question.patternId);
      else wrongIds.push(a.question.patternId);
    }

    const record: QuizSessionRecord = {
      id: createQuizSessionId(),
      bookId: book.id,
      mode,
      fromChapter,
      toChapter,
      totalQuestions: answers.length,
      correctCount: correctIds.length,
      wrongPatternIds: Array.from(new Set(wrongIds)),
      correctPatternIds: Array.from(new Set(correctIds)),
      answers: toSavedAnswers(answers),
      completedAt: new Date().toISOString(),
    };

    onCompleteSession(record);
    setPhase('result');
  };

  const modalAnswers = inspectedAnswers ?? answers;

  return (
    <>
      {phase === 'setup' ? (
        <QuizSetupView
          book={book}
          mode={mode}
          fromChapter={fromChapter}
          toChapter={toChapter}
          questionCount={questionCount}
          onlyDifficult={onlyDifficult}
          onlyUnmastered={onlyUnmastered}
          availableCount={availableCount}
          sessions={sessions}
          isCloudSynced={isCloudSynced}
          syncingQuiz={syncingQuiz}
          onChangeMode={setMode}
          onChangeRange={(f, t) => {
            setFromChapter(f);
            setToChapter(t);
          }}
          onChangeCount={setQuestionCount}
          onToggleDifficult={() => setOnlyDifficult(v => !v)}
          onToggleUnmastered={() => setOnlyUnmastered(v => !v)}
          onStartQuiz={() => startQuizWithRange(fromChapter, toChapter)}
          onQuickStartChapter={ch => startQuizWithRange(ch, ch, false, false)}
          onInspectSession={session => {
            setInspectedSession(session);
            setHistoryModalOpen(true);
          }}
          onClearHistory={onClearHistory}
        />
      ) : phase === 'running' ? (
        <QuizRunView
          questions={questions}
          currentIndex={currentIndex}
          selectedChoiceId={selectedChoiceId}
          showFurigana={showFurigana}
          onSelectChoice={handleSelectChoice}
          onNextQuestion={handleNextQuestion}
          onAbortQuiz={() => {
            stopJapaneseSpeech();
            onQuizAborted?.();
            setPhase('setup');
          }}
        />
      ) : (
        <QuizResultView
          answers={answers}
          onRetrySame={() => startQuizWithRange(fromChapter, toChapter)}
          onBackToSetup={() => setPhase('setup')}
          onOpenHistoryModal={() => {
            setInspectedSession(null);
            setHistoryModalOpen(true);
          }}
          onMarkWrongDifficult={ids => onMarkPatternsDifficult(ids)}
        />
      )}

      <QuizAnswerHistoryModal
        open={historyModalOpen}
        answers={modalAnswers}
        showFurigana={showFurigana}
        sessionMeta={inspectedMeta}
        onClose={() => {
          setHistoryModalOpen(false);
          setInspectedSession(null);
        }}
      />
    </>
  );
}
