import { useCallback, useEffect, useRef, useState } from 'react';
import type { User } from 'firebase/auth';
import type { AllBooksProgress, BookId } from '../types/bunpou';
import {
  fetchBookProgressDoc,
  saveBookProgressDoc,
} from '../services/cloudSyncService';
import { BOOK_IDS, mergePatternSets } from '../utils/bunpouSync';
import {
  loadAllBooksProgress,
  saveBookProgressToLocal,
} from '../utils/storage';
import { getFirestoreUpgradeUrl, isFirestoreQuotaError } from '../firebase';
import type { ToastTone } from './useToast';

interface UseCloudProgressSyncOptions {
  user: User | null;
  isVerified: boolean;
  profileReady: boolean;
  onMasteredToggled?: (patternId: string, isNowMastered: boolean) => void;
  showToast: (
    message: string,
    tone?: ToastTone,
    options?: { durationMs?: number; actionLabel?: string; actionHref?: string }
  ) => void;
}

export function useCloudProgressSync({
  user,
  isVerified,
  profileReady,
  onMasteredToggled,
  showToast,
}: UseCloudProgressSyncOptions) {
  const [booksProgress, setBooksProgress] = useState<AllBooksProgress>(() =>
    loadAllBooksProgress()
  );
  const [syncingProgress, setSyncingProgress] = useState(false);

  const progressRef = useRef(booksProgress);
  progressRef.current = booksProgress;

  const pushBookToCloud = useCallback(
    async (uid: string, bookId: BookId, mastered: Set<string>, difficult: Set<string>) => {
      try {
        await saveBookProgressDoc(uid, bookId, {
          mastered: Array.from(mastered),
          difficult: Array.from(difficult),
        });
      } catch (error) {
        if (isFirestoreQuotaError(error)) {
          showToast('Progres tersimpan lokal (kuota Firestore tercapai).', 'error', {
            actionLabel: 'Lihat Kuota',
            actionHref: getFirestoreUpgradeUrl(),
          });
        }
      }
    },
    [showToast]
  );

  const syncAllBooksWithCloud = useCallback(
    async (silent = false) => {
      if (!user || !isVerified || !profileReady) return;
      setSyncingProgress(true);
      try {
        const current = progressRef.current;
        const next: AllBooksProgress = {
          n5: {
            mastered: new Set(current.n5.mastered),
            difficult: new Set(current.n5.difficult),
          },
          n4: {
            mastered: new Set(current.n4.mastered),
            difficult: new Set(current.n4.difficult),
          },
        };

        for (const bookId of BOOK_IDS) {
          const remote = await fetchBookProgressDoc(user.uid, bookId);
          const mergedMastered = mergePatternSets(
            next[bookId].mastered,
            remote?.mastered ?? [],
            bookId
          );
          const mergedDifficult = mergePatternSets(
            next[bookId].difficult,
            remote?.difficult ?? [],
            bookId
          );
          next[bookId] = {
            mastered: mergedMastered,
            difficult: mergedDifficult,
          };
          saveBookProgressToLocal(bookId, mergedMastered, mergedDifficult);

          const remoteMasteredCount = remote?.mastered.length ?? 0;
          const remoteDifficultCount = remote?.difficult.length ?? 0;
          if (
            !remote ||
            mergedMastered.size !== remoteMasteredCount ||
            mergedDifficult.size !== remoteDifficultCount
          ) {
            await saveBookProgressDoc(user.uid, bookId, {
              mastered: Array.from(mergedMastered),
              difficult: Array.from(mergedDifficult),
            });
          }
        }

        setBooksProgress(next);
        if (!silent) {
          showToast('Semua progres (Bunpou, Kotoba, Streak & Kuis) berhasil disinkronkan ke cloud.', 'success');
        }
      } catch (error) {
        if (isFirestoreQuotaError(error)) {
          showToast('Sinkronisasi cloud gagal: kuota Firestore tercapai.', 'error', {
            actionLabel: 'Lihat Kuota',
            actionHref: getFirestoreUpgradeUrl(),
          });
        } else if (!silent) {
          showToast('Gagal menyinkronkan progres ke cloud. Progres tetap aman di lokal.', 'error');
        }
      } finally {
        setSyncingProgress(false);
      }
    },
    [user, isVerified, profileReady, showToast]
  );

  useEffect(() => {
    if (user && isVerified && profileReady) {
      void syncAllBooksWithCloud(true);
    }
  }, [user, isVerified, profileReady, syncAllBooksWithCloud]);

  const toggleMastered = useCallback(
    (bookId: BookId, patternId: string) => {
      const wasMastered = progressRef.current[bookId].mastered.has(patternId);
      const isNowMastered = !wasMastered;

      setBooksProgress(prev => {
        const bucket = prev[bookId];
        const nextMastered = new Set(bucket.mastered);
        const nextDifficult = new Set(bucket.difficult);
        if (isNowMastered) {
          nextMastered.add(patternId);
          nextDifficult.delete(patternId);
        } else {
          nextMastered.delete(patternId);
        }

        saveBookProgressToLocal(bookId, nextMastered, nextDifficult);
        if (user && isVerified && profileReady) {
          void pushBookToCloud(user.uid, bookId, nextMastered, nextDifficult);
        }

        return {
          ...prev,
          [bookId]: { mastered: nextMastered, difficult: nextDifficult },
        };
      });

      onMasteredToggled?.(patternId, isNowMastered);
    },
    [user, isVerified, profileReady, pushBookToCloud, onMasteredToggled]
  );

  const toggleDifficult = useCallback(
    (bookId: BookId, patternId: string) => {
      const wasMastered = progressRef.current[bookId].mastered.has(patternId);
      const willBeDifficult = !progressRef.current[bookId].difficult.has(patternId);

      setBooksProgress(prev => {
        const bucket = prev[bookId];
        const nextMastered = new Set(bucket.mastered);
        const nextDifficult = new Set(bucket.difficult);
        if (willBeDifficult) {
          nextDifficult.add(patternId);
          nextMastered.delete(patternId);
        } else {
          nextDifficult.delete(patternId);
        }

        saveBookProgressToLocal(bookId, nextMastered, nextDifficult);
        if (user && isVerified && profileReady) {
          void pushBookToCloud(user.uid, bookId, nextMastered, nextDifficult);
        }

        return {
          ...prev,
          [bookId]: { mastered: nextMastered, difficult: nextDifficult },
        };
      });

      if (willBeDifficult && wasMastered) {
        onMasteredToggled?.(patternId, false);
      }
    },
    [user, isVerified, profileReady, pushBookToCloud, onMasteredToggled]
  );

  const markPatternsDifficult = useCallback(
    (bookId: BookId, patternIds: string[]) => {
      if (patternIds.length === 0) return;
      const prevBucket = progressRef.current[bookId];
      const demotedMasteredIds = patternIds.filter(
        id => !prevBucket.difficult.has(id) && prevBucket.mastered.has(id)
      );

      setBooksProgress(prev => {
        const bucket = prev[bookId];
        const nextMastered = new Set(bucket.mastered);
        const nextDifficult = new Set(bucket.difficult);
        let changed = false;
        for (const id of patternIds) {
          if (!nextDifficult.has(id)) {
            nextDifficult.add(id);
            nextMastered.delete(id);
            changed = true;
          }
        }
        if (!changed) return prev;

        saveBookProgressToLocal(bookId, nextMastered, nextDifficult);
        if (user && isVerified && profileReady) {
          void pushBookToCloud(user.uid, bookId, nextMastered, nextDifficult);
        }

        return {
          ...prev,
          [bookId]: { mastered: nextMastered, difficult: nextDifficult },
        };
      });

      for (const id of demotedMasteredIds) {
        onMasteredToggled?.(id, false);
      }
    },
    [user, isVerified, profileReady, pushBookToCloud, onMasteredToggled]
  );

  const applyRestoredProgress = useCallback(
    async (incoming: AllBooksProgress, mode: 'merge' | 'replace') => {
      const current = progressRef.current;
      const next: AllBooksProgress = {
        n5: {
          mastered:
            mode === 'merge'
              ? mergePatternSets(current.n5.mastered, incoming.n5.mastered, 'n5')
              : new Set(incoming.n5.mastered),
          difficult:
            mode === 'merge'
              ? mergePatternSets(current.n5.difficult, incoming.n5.difficult, 'n5')
              : new Set(incoming.n5.difficult),
        },
        n4: {
          mastered:
            mode === 'merge'
              ? mergePatternSets(current.n4.mastered, incoming.n4.mastered, 'n4')
              : new Set(incoming.n4.mastered),
          difficult:
            mode === 'merge'
              ? mergePatternSets(current.n4.difficult, incoming.n4.difficult, 'n4')
              : new Set(incoming.n4.difficult),
        },
      };

      for (const bookId of BOOK_IDS) {
        saveBookProgressToLocal(bookId, next[bookId].mastered, next[bookId].difficult);
      }
      setBooksProgress(next);

      if (user && isVerified && profileReady) {
        for (const bookId of BOOK_IDS) {
          await pushBookToCloud(
            user.uid,
            bookId,
            next[bookId].mastered,
            next[bookId].difficult
          );
        }
      }
    },
    [user, isVerified, profileReady, pushBookToCloud]
  );

  return {
    booksProgress,
    syncingProgress,
    toggleMastered,
    toggleDifficult,
    markPatternsDifficult,
    syncAllBooksWithCloud,
    applyRestoredProgress,
  };
}
