import { useCallback, useEffect, useRef, useState } from 'react';
import type { User } from 'firebase/auth';
import type { AllBooksQuizHistory, BookId, QuizSessionRecord } from '../types/bunpou';
import {
  fetchQuizHistoryDoc,
  saveQuizHistoryDoc,
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

  const pushQuizHistory = useCallback(
    async (uid: string, bookId: BookId, sessions: QuizSessionRecord[]) => {
      try {
        await saveQuizHistoryDoc(uid, bookId, sessions);
      } catch (error) {
        if (isFirestoreQuotaError(error)) {
          showToast('Riwayat kuis tersimpan lokal (kuota Firestore tercapai).', 'error', {
            actionLabel: 'Lihat Kuota',
            actionHref: getFirestoreUpgradeUrl(),
          });
        }
      }
    },
    [showToast]
  );

  const syncQuizHistoryWithCloud = useCallback(async () => {
    if (!user || !isVerified || !profileReady) return;
    setSyncingQuiz(true);
    try {
      const current = historyRef.current;
      const next: AllBooksQuizHistory = {
        n5: [...current.n5],
        n4: [...current.n4],
      };

      for (const bookId of BOOK_IDS) {
        const remote = await fetchQuizHistoryDoc(user.uid, bookId);
        const merged = mergeQuizHistory(next[bookId], remote ?? [], bookId);
        next[bookId] = merged;
        if (!remote || merged.length !== remote.length) {
          await saveQuizHistoryDoc(user.uid, bookId, merged);
        }
      }

      saveAllQuizHistoryToLocal(next);
      setQuizHistory(next);
    } catch {
      // Keep local quiz history safely
    } finally {
      setSyncingQuiz(false);
    }
  }, [user, isVerified, profileReady]);

  useEffect(() => {
    if (user && isVerified && profileReady) {
      void syncQuizHistoryWithCloud();
    }
  }, [user, isVerified, profileReady, syncQuizHistoryWithCloud]);

  const recordQuizSession = useCallback(
    (session: QuizSessionRecord) => {
      setQuizHistory(prev => {
        const merged = mergeQuizHistory([session], prev[session.bookId], session.bookId).slice(
          0,
          MAX_QUIZ_HISTORY_PER_BOOK
        );
        const next: AllBooksQuizHistory = {
          ...prev,
          [session.bookId]: merged,
        };
        saveAllQuizHistoryToLocal(next);
        if (user && isVerified && profileReady) {
          void pushQuizHistory(user.uid, session.bookId, merged);
        }
        return next;
      });
    },
    [user, isVerified, profileReady, pushQuizHistory]
  );

  const clearBookQuizHistory = useCallback(
    (bookId: BookId) => {
      setQuizHistory(prev => {
        const next: AllBooksQuizHistory = {
          ...prev,
          [bookId]: [],
        };
        saveAllQuizHistoryToLocal(next);
        if (user && isVerified && profileReady) {
          void pushQuizHistory(user.uid, bookId, []);
        }
        return next;
      });
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
