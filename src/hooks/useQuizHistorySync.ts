import { useCallback, useEffect, useRef, useState } from 'react';
import type { User } from 'firebase/auth';
import type { AllBooksQuizHistory, BookId, QuizSessionRecord } from '../types/bunpou';
import {
  fetchQuizHistoryDoc,
  saveQuizHistoryDoc,
  subscribeQuizHistoryDoc,
} from '../services/cloudSyncService';
import { BOOK_IDS } from '../utils/bunpouSync';
import { MAX_QUIZ_HISTORY_PER_BOOK, mergeQuizHistory } from '../utils/quizStats';
import { loadAllQuizHistory, saveAllQuizHistoryToLocal } from '../utils/storage';
import { getFirestoreUpgradeUrl, isFirestoreQuotaError } from '../firebase';
import type { ToastTone } from './useToast';

interface UseQuizHistorySyncOptions {
  user: User | null;
  isVerified: boolean;
  profileReady: boolean;
  showToast: (
    message: string,
    tone?: ToastTone,
    options?: { durationMs?: number; actionLabel?: string; actionHref?: string }
  ) => void;
}

function quizSig(list: QuizSessionRecord[]): string {
  return list
    .slice(0, 30)
    .map(s => `${s.id}:${s.answers?.length ?? 0}`)
    .join(',');
}

export function useQuizHistorySync({
  user,
  isVerified,
  profileReady,
  showToast,
}: UseQuizHistorySyncOptions) {
  const [quizHistory, setQuizHistory] = useState<AllBooksQuizHistory>(() =>
    loadAllQuizHistory()
  );
  const [syncingQuiz, setSyncingQuiz] = useState(false);

  const historyRef = useRef(quizHistory);
  historyRef.current = quizHistory;

  const pendingWritesRef = useRef<Record<BookId, number>>({ n5: 0, n4: 0 });

  const pushQuizHistory = useCallback(
    async (uid: string, bookId: BookId, sessions: QuizSessionRecord[]) => {
      pendingWritesRef.current[bookId] += 1;
      try {
        await saveQuizHistoryDoc(uid, bookId, sessions);
      } catch (error) {
        if (isFirestoreQuotaError(error)) {
          showToast('Riwayat kuis tersimpan lokal (kuota Firestore tercapai).', 'error', {
            actionLabel: 'Lihat Kuota',
            actionHref: getFirestoreUpgradeUrl(),
          });
        }
      } finally {
        pendingWritesRef.current[bookId] = Math.max(0, pendingWritesRef.current[bookId] - 1);
      }
    },
    [showToast]
  );

  // Real-time onSnapshot subscription for both N5 & N4 quiz histories
  useEffect(() => {
    if (!user || !isVerified || !profileReady) return;

    const uid = user.uid;
    const initialized: Record<BookId, boolean> = { n5: false, n4: false };
    let disposed = false;

    const unsubs = BOOK_IDS.map(bookId =>
      subscribeQuizHistoryDoc(
        uid,
        bookId,
        remote => {
          if (disposed) return;

          const isFirst = !initialized[bookId];
          initialized[bookId] = true;

          if (!isFirst && pendingWritesRef.current[bookId] > 0) return;

          const currentList = historyRef.current[bookId];

          if (isFirst) {
            const merged = mergeQuizHistory(currentList, remote ?? [], bookId);
            const nextAll: AllBooksQuizHistory = {
              ...historyRef.current,
              [bookId]: merged,
            };
            historyRef.current = nextAll;
            saveAllQuizHistoryToLocal(nextAll);
            setQuizHistory(nextAll);

            if (!remote || quizSig(merged) !== quizSig(remote)) {
              void pushQuizHistory(uid, bookId, merged);
            }
            return;
          }

          if (!remote) return;
          if (quizSig(currentList) === quizSig(remote)) return;

          const nextAll: AllBooksQuizHistory = {
            ...historyRef.current,
            [bookId]: remote,
          };
          historyRef.current = nextAll;
          saveAllQuizHistoryToLocal(nextAll);
          setQuizHistory(nextAll);
        }
      )
    );

    return () => {
      disposed = true;
      for (const unsub of unsubs) unsub();
    };
  }, [user, isVerified, profileReady, pushQuizHistory]);

  const syncQuizHistoryWithCloud = useCallback(async () => {
    if (!user || !isVerified || !profileReady) return;
    setSyncingQuiz(true);
    try {
      for (const bookId of BOOK_IDS) {
        const remote = await fetchQuizHistoryDoc(user.uid, bookId);
        const latestLocal = historyRef.current[bookId];
        const merged = mergeQuizHistory(latestLocal, remote ?? [], bookId);
        const nextAll: AllBooksQuizHistory = {
          ...historyRef.current,
          [bookId]: merged,
        };
        historyRef.current = nextAll;
        saveAllQuizHistoryToLocal(nextAll);
        setQuizHistory(nextAll);

        if (!remote || quizSig(merged) !== quizSig(remote)) {
          await pushQuizHistory(user.uid, bookId, merged);
        }
      }
    } catch {
      // Keep local quiz history safely
    } finally {
      setSyncingQuiz(false);
    }
  }, [user, isVerified, profileReady, pushQuizHistory]);

  const recordQuizSession = useCallback(
    (session: QuizSessionRecord) => {
      const prev = historyRef.current;
      const merged = mergeQuizHistory([session], prev[session.bookId], session.bookId).slice(
        0,
        MAX_QUIZ_HISTORY_PER_BOOK
      );
      const next: AllBooksQuizHistory = {
        ...prev,
        [session.bookId]: merged,
      };
      historyRef.current = next;
      setQuizHistory(next);
      saveAllQuizHistoryToLocal(next);
      if (user && isVerified && profileReady) {
        void pushQuizHistory(user.uid, session.bookId, merged);
      }
    },
    [user, isVerified, profileReady, pushQuizHistory]
  );

  const clearBookQuizHistory = useCallback(
    (bookId: BookId) => {
      const prev = historyRef.current;
      const next: AllBooksQuizHistory = {
        ...prev,
        [bookId]: [],
      };
      historyRef.current = next;
      setQuizHistory(next);
      saveAllQuizHistoryToLocal(next);
      if (user && isVerified && profileReady) {
        void pushQuizHistory(user.uid, bookId, []);
      }
      showToast(`Riwayat kuis buku ${bookId.toUpperCase()} telah direset.`, 'info');
    },
    [user, isVerified, profileReady, pushQuizHistory, showToast]
  );

  const applyRestoredQuizHistory = useCallback(
    async (incoming: AllBooksQuizHistory, mode: 'merge' | 'replace') => {
      const current = historyRef.current;
      const next: AllBooksQuizHistory = {
        n5:
          mode === 'merge'
            ? mergeQuizHistory(current.n5, incoming.n5, 'n5')
            : incoming.n5.slice(0, MAX_QUIZ_HISTORY_PER_BOOK),
        n4:
          mode === 'merge'
            ? mergeQuizHistory(current.n4, incoming.n4, 'n4')
            : incoming.n4.slice(0, MAX_QUIZ_HISTORY_PER_BOOK),
      };
      historyRef.current = next;
      saveAllQuizHistoryToLocal(next);
      setQuizHistory(next);

      if (user && isVerified && profileReady) {
        for (const bookId of BOOK_IDS) {
          await pushQuizHistory(user.uid, bookId, next[bookId]);
        }
      }
    },
    [user, isVerified, profileReady, pushQuizHistory]
  );

  return {
    quizHistory,
    syncingQuiz,
    recordQuizSession,
    clearBookQuizHistory,
    syncQuizHistoryWithCloud,
    applyRestoredQuizHistory,
  };
}
