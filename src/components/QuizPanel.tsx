import { useEffect, useMemo, useState } from 'react';
import type {
  BookData,
  QuizAnswerEntry,
  QuizMode,
  QuizQuestion,
  QuizSessionRecord,
} from '../types/bunpou';
import { filterQuizPool, generateQuizQuestions } from '../utils/quizGenerator';
import { createQuizSessionId } from '../utils/quizStats';
import { stopJapaneseSpeech } from '../utils/speech';
import { QuizAnswerHistoryModal } from './quiz/QuizAnswerHistoryModal';
import { QuizResultView } from './quiz/QuizResultView';
import { QuizRunView } from './quiz/QuizRunView';
import { QuizSetupView } from './quiz/QuizSetupView';

interface QuizPanelProps {
  book: BookData;
  showFurigana: boolean;
  masteredSet: Set<string>;
  difficultSet: Set<string>;
  sessions: QuizSessionRecord[];
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

  // Reset quiz range and state whenever book switches (N5 <-> N4)
  useEffect(() => {
    stopJapaneseSpeech();
    setPhase('setup');
    setFromChapter(minCh);
    setToChapter(maxCh);
    setQuestions([]);
    setAnswers([]);
    setCurrentIndex(0);
    setSelectedChoiceId(null);
    setHistoryModalOpen(false);
  }, [book.id, minCh, maxCh]);

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
    setPhase('running');
  };

  const handleSelectChoice = (choiceId: string) => {
    if (selectedChoiceId !== null) return;
    const current = questions[currentIndex];
    if (!current) return;
    setSelectedChoiceId(choiceId);
    setAnswers(prev => [
      ...prev,
      {
        question: current,
        selectedChoiceId: choiceId,
        isCorrect: choiceId === current.correctChoiceId,
      },
    ]);
  };

  const handleNextQuestion = () => {
    stopJapaneseSpeech();
    if (currentIndex + 1 < questions.length) {
      setCurrentIndex(prev => prev + 1);
      setSelectedChoiceId(null);
      return;
    }

    // Complete session
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
      completedAt: new Date().toISOString(),
    };

    onCompleteSession(record);
    setPhase('result');
  };

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
            setPhase('setup');
          }}
        />
      ) : (
        <QuizResultView
          answers={answers}
          onRetrySame={() => startQuizWithRange(fromChapter, toChapter)}
          onBackToSetup={() => setPhase('setup')}
          onOpenHistoryModal={() => setHistoryModalOpen(true)}
          onMarkWrongDifficult={ids => onMarkPatternsDifficult(ids)}
        />
      )}

      <QuizAnswerHistoryModal
        open={historyModalOpen}
        answers={answers}
        showFurigana={showFurigana}
        onClose={() => setHistoryModalOpen(false)}
      />
    </>
  );
}
