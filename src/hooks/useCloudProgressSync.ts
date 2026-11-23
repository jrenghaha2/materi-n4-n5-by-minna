import { useCallback, useEffect, useRef, useState } from 'react';
import type { User } from 'firebase/auth';
import type { AllBooksProgress, BookId } from '../types/bunpou';
import {
  fetchBookProgressDoc,
  saveBookProgressDoc,
  subscribeBookProgressDoc,
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

function areSetsEqual(a: Set<string>, b: Iterable<string>): boolean {
  const bArr = Array.isArray(b) ? b : Array.from(b);
  if (a.size !== bArr.length) return false;
  for (const item of bArr) {
    if (!a.has(item)) return false;
  }
  return true;
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

  // Track in-flight local writes per book so stale remote snapshots never clobber rapid clicks
  const pendingWritesRef = useRef<Record<BookId, number>>({ n5: 0, n4: 0 });

  const pushBookToCloud = useCallback(
    async (uid: string, bookId: BookId, mastered: Set<string>, difficult: Set<string>) => {
      pendingWritesRef.current[bookId] += 1;
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
      } finally {
        pendingWritesRef.current[bookId] = Math.max(0, pendingWritesRef.current[bookId] - 1);
      }
    },
    [showToast]
  );

  // Real-time onSnapshot subscription for both N5 & N4 Bunpou progress
  useEffect(() => {
    if (!user || !isVerified || !profileReady) return;

    const uid = user.uid;
    const initialized: Record<BookId, boolean> = { n5: false, n4: false };
    let disposed = false;

    const unsubs = BOOK_IDS.map(bookId =>
      subscribeBookProgressDoc(
        uid,
        bookId,
        remote => {
          if (disposed) return;

          const isFirst = !initialized[bookId];
          initialized[bookId] = true;

          // Ignore transient remote snapshots while a local write for this book is still settling
          if (!isFirst && pendingWritesRef.current[bookId] > 0) return;

          const currentBucket = progressRef.current[bookId];

          if (isFirst) {
            const mergedMastered = mergePatternSets(
              currentBucket.mastered,
              remote?.mastered ?? [],
              bookId
            );
            const rawDifficult = mergePatternSets(
              currentBucket.difficult,
              remote?.difficult ?? [],
              bookId
            );
            const mergedDifficult = new Set(
              Array.from(rawDifficult).filter(id => !mergedMastered.has(id))
            );

            saveBookProgressToLocal(bookId, mergedMastered, mergedDifficult);
            const nextAll: AllBooksProgress = {
              ...progressRef.current,
              [bookId]: { mastered: mergedMastered, difficult: mergedDifficult },
            };
            progressRef.current = nextAll;
            setBooksProgress(nextAll);

            const needsPush =
              !remote ||
              !areSetsEqual(mergedMastered, remote.mastered) ||
              !areSetsEqual(mergedDifficult, remote.difficult);
            if (needsPush) {
              void pushBookToCloud(uid, bookId, mergedMastered, mergedDifficult);
            }
            return;
          }

          if (!remote) return;

          const nextMastered = new Set(remote.mastered);
          const nextDifficult = new Set(
            remote.difficult.filter(id => !nextMastered.has(id))
          );

          if (
            areSetsEqual(currentBucket.mastered, nextMastered) &&
            areSetsEqual(currentBucket.difficult, nextDifficult)
          ) {
            return;
          }

          saveBookProgressToLocal(bookId, nextMastered, nextDifficult);
          const nextAll: AllBooksProgress = {
            ...progressRef.current,
            [bookId]: { mastered: nextMastered, difficult: nextDifficult },
          };
          progressRef.current = nextAll;
          setBooksProgress(nextAll);
        },
        error => {
          if (isFirestoreQuotaError(error)) {
            showToast('Kuota Firestore tercapai saat menyinkronkan Bunpou.', 'error', {
              actionLabel: 'Lihat Kuota',
              actionHref: getFirestoreUpgradeUrl(),
            });
          }
        }
      )
    );

    return () => {
      disposed = true;
      for (const unsub of unsubs) unsub();
    };
  }, [user, isVerified, profileReady, pushBookToCloud, showToast]);

  const syncAllBooksWithCloud = useCallback(
    async (silent = false) => {
      if (!user || !isVerified || !profileReady) return;
      setSyncingProgress(true);
      try {
        for (const bookId of BOOK_IDS) {
          const remote = await fetchBookProgressDoc(user.uid, bookId);
          // Always merge against the LATEST local ref after await so rapid clicks are never lost
          const latestBucket = progressRef.current[bookId];
          const mergedMastered = mergePatternSets(
            latestBucket.mastered,
            remote?.mastered ?? [],
            bookId
          );
          const rawDifficult = mergePatternSets(
            latestBucket.difficult,
            remote?.difficult ?? [],
            bookId
          );
          const mergedDifficult = new Set(
            Array.from(rawDifficult).filter(id => !mergedMastered.has(id))
          );

          saveBookProgressToLocal(bookId, mergedMastered, mergedDifficult);
          const nextAll: AllBooksProgress = {
            ...progressRef.current,
            [bookId]: { mastered: mergedMastered, difficult: mergedDifficult },
          };
          progressRef.current = nextAll;
          setBooksProgress(nextAll);

          if (
            !remote ||
            !areSetsEqual(mergedMastered, remote.mastered) ||
            !areSetsEqual(mergedDifficult, remote.difficult)
          ) {
            await pushBookToCloud(user.uid, bookId, mergedMastered, mergedDifficult);
          }
        }

        if (!silent) {
          showToast(
            'Semua progres (Bunpou, Kotoba, Streak & Kuis) berhasil disinkronkan ke cloud.',
            'success'
          );
        }
      } catch (error) {
        if (isFirestoreQuotaError(error)) {
          showToast('Sinkronisasi cloud gagal: kuota Firestore tercapai.', 'error', {
            actionLabel: 'Lihat Kuota',
            actionHref: getFirestoreUpgradeUrl(),
          });
        } else if (!silent) {
          showToast(
            'Gagal menyinkronkan progres ke cloud. Progres tetap aman di lokal.',
            'error'
          );
        }
      } finally {
        setSyncingProgress(false);
      }
    },
    [user, isVerified, profileReady, pushBookToCloud, showToast]
  );

  const toggleMastered = useCallback(
    (bookId: BookId, patternId: string) => {
      const prev = progressRef.current;
      const bucket = prev[bookId];
      const isNowMastered = !bucket.mastered.has(patternId);
      const nextMastered = new Set(bucket.mastered);
      const nextDifficult = new Set(bucket.difficult);

      if (isNowMastered) {
        nextMastered.add(patternId);
        nextDifficult.delete(patternId);
      } else {
        nextMastered.delete(patternId);
      }

      const nextAll: AllBooksProgress = {
        ...prev,
        [bookId]: { mastered: nextMastered, difficult: nextDifficult },
      };
      progressRef.current = nextAll;
      setBooksProgress(nextAll);
      saveBookProgressToLocal(bookId, nextMastered, nextDifficult);

      if (user && isVerified && profileReady) {
        void pushBookToCloud(user.uid, bookId, nextMastered, nextDifficult);
      }

      onMasteredToggled?.(patternId, isNowMastered);
    },
    [user, isVerified, profileReady, pushBookToCloud, onMasteredToggled]
  );

  const toggleDifficult = useCallback(
    (bookId: BookId, patternId: string) => {
      const prev = progressRef.current;
      const bucket = prev[bookId];
      const wasMastered = bucket.mastered.has(patternId);
      const willBeDifficult = !bucket.difficult.has(patternId);
      const nextMastered = new Set(bucket.mastered);
      const nextDifficult = new Set(bucket.difficult);

      if (willBeDifficult) {
        nextDifficult.add(patternId);
        nextMastered.delete(patternId);
      } else {
        nextDifficult.delete(patternId);
      }

      const nextAll: AllBooksProgress = {
        ...prev,
        [bookId]: { mastered: nextMastered, difficult: nextDifficult },
      };
      progressRef.current = nextAll;
      setBooksProgress(nextAll);
      saveBookProgressToLocal(bookId, nextMastered, nextDifficult);

      if (user && isVerified && profileReady) {
        void pushBookToCloud(user.uid, bookId, nextMastered, nextDifficult);
      }

      if (willBeDifficult && wasMastered) {
        onMasteredToggled?.(patternId, false);
      }
    },
    [user, isVerified, profileReady, pushBookToCloud, onMasteredToggled]
  );

  const markPatternsDifficult = useCallback(
    (bookId: BookId, patternIds: string[]) => {
      if (patternIds.length === 0) return;
      const prev = progressRef.current;
      const bucket = prev[bookId];
      const nextMastered = new Set(bucket.mastered);
      const nextDifficult = new Set(bucket.difficult);
      const demotedMasteredIds: string[] = [];
      let changed = false;

      for (const id of patternIds) {
        if (!nextDifficult.has(id)) {
          if (nextMastered.has(id)) {
            demotedMasteredIds.push(id);
          }
          nextDifficult.add(id);
          nextMastered.delete(id);
          changed = true;
        }
      }
      if (!changed) return;

      const nextAll: AllBooksProgress = {
        ...prev,
        [bookId]: { mastered: nextMastered, difficult: nextDifficult },
      };
      progressRef.current = nextAll;
      setBooksProgress(nextAll);
      saveBookProgressToLocal(bookId, nextMastered, nextDifficult);

      if (user && isVerified && profileReady) {
        void pushBookToCloud(user.uid, bookId, nextMastered, nextDifficult);
      }

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
      progressRef.current = next;
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
