import { useCallback, useEffect, useRef, useState } from 'react';
import type { User } from 'firebase/auth';
import type { AllBooksProgress, BookId } from '../types/bunpou';
import {
  fetchKotobaProgressDoc,
  saveKotobaProgressDoc,
  subscribeKotobaProgressDoc,
} from '../services/cloudSyncService';
import { BOOK_IDS, mergeKotobaSets, sanitizeKotobaIds } from '../utils/bunpouSync';
import { getFirestoreUpgradeUrl, isFirestoreQuotaError } from '../firebase';
import type { ToastTone } from './useToast';

const KOTOBA_STORAGE_KEYS: Record<BookId, { mastered: string; difficult: string }> = {
  n5: {
    mastered: 'minna_kotoba_n5_mastered_v1',
    difficult: 'minna_kotoba_n5_difficult_v1',
  },
  n4: {
    mastered: 'minna_kotoba_n4_mastered_v1',
    difficult: 'minna_kotoba_n4_difficult_v1',
  },
};

function readIdSet(key: string, bookId: BookId): Set<string> {
  try {
    if (typeof localStorage === 'undefined') return new Set();
    const raw = localStorage.getItem(key);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    return new Set(sanitizeKotobaIds(parsed, bookId));
  } catch {
    return new Set();
  }
}

function writeIdSet(key: string, values: Set<string>): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(key, JSON.stringify(Array.from(values)));
    }
  } catch {
    // Ignore storage quota or private-mode errors
  }
}

function areSetsEqual(a: Set<string>, b: Iterable<string>): boolean {
  const bArr = Array.isArray(b) ? b : Array.from(b);
  if (a.size !== bArr.length) return false;
  for (const item of bArr) {
    if (!a.has(item)) return false;
  }
  return true;
}

function loadInitialKotobaProgress(): AllBooksProgress {
  const n5Mastered = readIdSet(KOTOBA_STORAGE_KEYS.n5.mastered, 'n5');
  const n5Difficult = new Set(
    Array.from(readIdSet(KOTOBA_STORAGE_KEYS.n5.difficult, 'n5')).filter(id => !n5Mastered.has(id))
  );
  const n4Mastered = readIdSet(KOTOBA_STORAGE_KEYS.n4.mastered, 'n4');
  const n4Difficult = new Set(
    Array.from(readIdSet(KOTOBA_STORAGE_KEYS.n4.difficult, 'n4')).filter(id => !n4Mastered.has(id))
  );

  return {
    n5: {
      mastered: n5Mastered,
      difficult: n5Difficult,
    },
    n4: {
      mastered: n4Mastered,
      difficult: n4Difficult,
    },
  };
}

interface UseKotobaProgressOptions {
  user: User | null;
  isVerified: boolean;
  profileReady: boolean;
  onMasteredToggled?: (wordId: string, isNowMastered: boolean) => void;
  showToast: (
    message: string,
    tone?: ToastTone,
    options?: { durationMs?: number; actionLabel?: string; actionHref?: string }
  ) => void;
}

export function useKotobaProgress({
  user,
  isVerified,
  profileReady,
  onMasteredToggled,
  showToast,
}: UseKotobaProgressOptions) {
  const [kotobaProgress, setKotobaProgress] = useState<AllBooksProgress>(() =>
    loadInitialKotobaProgress()
  );
  const [syncingKotoba, setSyncingKotoba] = useState(false);

  const progressRef = useRef(kotobaProgress);
  progressRef.current = kotobaProgress;

  const pendingWritesRef = useRef<Record<BookId, number>>({ n5: 0, n4: 0 });

  const pushKotobaBookToCloud = useCallback(
    async (uid: string, bookId: BookId, mastered: Set<string>, difficult: Set<string>) => {
      pendingWritesRef.current[bookId] += 1;
      try {
        await saveKotobaProgressDoc(uid, bookId, {
          mastered: Array.from(mastered),
          difficult: Array.from(difficult),
        });
      } catch (error) {
        if (isFirestoreQuotaError(error)) {
          showToast('Progres Kotoba tersimpan lokal (kuota Firestore tercapai).', 'error', {
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

  // Real-time onSnapshot subscription for both N5 & N4 Kotoba progress
  useEffect(() => {
    if (!user || !isVerified || !profileReady) return;

    const uid = user.uid;
    const initialized: Record<BookId, boolean> = { n5: false, n4: false };
    let disposed = false;

    const unsubs = BOOK_IDS.map(bookId =>
      subscribeKotobaProgressDoc(
        uid,
        bookId,
        remote => {
          if (disposed) return;

          const isFirst = !initialized[bookId];
          initialized[bookId] = true;

          if (!isFirst && pendingWritesRef.current[bookId] > 0) return;

          const currentBucket = progressRef.current[bookId];

          if (isFirst) {
            const mergedMastered = mergeKotobaSets(
              currentBucket.mastered,
              remote?.mastered ?? [],
              bookId
            );
            const rawMergedDifficult = mergeKotobaSets(
              currentBucket.difficult,
              remote?.difficult ?? [],
              bookId
            );
            const mergedDifficult = new Set(
              Array.from(rawMergedDifficult).filter(id => !mergedMastered.has(id))
            );

            writeIdSet(KOTOBA_STORAGE_KEYS[bookId].mastered, mergedMastered);
            writeIdSet(KOTOBA_STORAGE_KEYS[bookId].difficult, mergedDifficult);
            const nextAll: AllBooksProgress = {
              ...progressRef.current,
              [bookId]: { mastered: mergedMastered, difficult: mergedDifficult },
            };
            progressRef.current = nextAll;
            setKotobaProgress(nextAll);

            const needsPush =
              !remote ||
              !areSetsEqual(mergedMastered, remote.mastered) ||
              !areSetsEqual(mergedDifficult, remote.difficult);
            if (needsPush) {
              void pushKotobaBookToCloud(uid, bookId, mergedMastered, mergedDifficult);
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

          writeIdSet(KOTOBA_STORAGE_KEYS[bookId].mastered, nextMastered);
          writeIdSet(KOTOBA_STORAGE_KEYS[bookId].difficult, nextDifficult);
          const nextAll: AllBooksProgress = {
            ...progressRef.current,
            [bookId]: { mastered: nextMastered, difficult: nextDifficult },
          };
          progressRef.current = nextAll;
          setKotobaProgress(nextAll);
        },
        error => {
          if (isFirestoreQuotaError(error)) {
            showToast('Kuota Firestore tercapai saat menyinkronkan Kotoba.', 'error', {
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
  }, [user, isVerified, profileReady, pushKotobaBookToCloud, showToast]);

  const syncKotobaWithCloud = useCallback(
    async (silent = false) => {
      if (!user || !isVerified || !profileReady) return;
      setSyncingKotoba(true);
      try {
        for (const bookId of BOOK_IDS) {
          const remote = await fetchKotobaProgressDoc(user.uid, bookId);
          // Always merge against LATEST local ref after await so rapid clicks are never lost
          const latestBucket = progressRef.current[bookId];
          const mergedMastered = mergeKotobaSets(
            latestBucket.mastered,
            remote?.mastered ?? [],
            bookId
          );
          const rawMergedDifficult = mergeKotobaSets(
            latestBucket.difficult,
            remote?.difficult ?? [],
            bookId
          );
          const mergedDifficult = new Set(
            Array.from(rawMergedDifficult).filter(id => !mergedMastered.has(id))
          );

          writeIdSet(KOTOBA_STORAGE_KEYS[bookId].mastered, mergedMastered);
          writeIdSet(KOTOBA_STORAGE_KEYS[bookId].difficult, mergedDifficult);
          const nextAll: AllBooksProgress = {
            ...progressRef.current,
            [bookId]: { mastered: mergedMastered, difficult: mergedDifficult },
          };
          progressRef.current = nextAll;
          setKotobaProgress(nextAll);

          if (
            !remote ||
            !areSetsEqual(mergedMastered, remote.mastered) ||
            !areSetsEqual(mergedDifficult, remote.difficult)
          ) {
            await pushKotobaBookToCloud(user.uid, bookId, mergedMastered, mergedDifficult);
          }
        }

        if (!silent) {
          showToast('Progres Kotoba N5 & N4 berhasil disinkronkan ke cloud.', 'success');
        }
      } catch (error) {
        if (isFirestoreQuotaError(error)) {
          showToast('Sinkronisasi Kotoba gagal: kuota Firestore tercapai.', 'error', {
            actionLabel: 'Lihat Kuota',
            actionHref: getFirestoreUpgradeUrl(),
          });
        } else if (!silent) {
          showToast('Gagal menyinkronkan progres Kotoba ke cloud.', 'error');
        }
      } finally {
        setSyncingKotoba(false);
      }
    },
    [user, isVerified, profileReady, pushKotobaBookToCloud, showToast]
  );

  const toggleKotobaMastered = useCallback(
    (bookId: BookId, wordId: string) => {
      const prev = progressRef.current;
      const bucket = prev[bookId];
      const isNowMastered = !bucket.mastered.has(wordId);
      const nextMastered = new Set(bucket.mastered);
      const nextDifficult = new Set(bucket.difficult);

      if (isNowMastered) {
        nextMastered.add(wordId);
        nextDifficult.delete(wordId);
      } else {
        nextMastered.delete(wordId);
      }

      const nextAll: AllBooksProgress = {
        ...prev,
        [bookId]: { mastered: nextMastered, difficult: nextDifficult },
      };
      progressRef.current = nextAll;
      setKotobaProgress(nextAll);
      writeIdSet(KOTOBA_STORAGE_KEYS[bookId].mastered, nextMastered);
      writeIdSet(KOTOBA_STORAGE_KEYS[bookId].difficult, nextDifficult);

      if (user && isVerified && profileReady) {
        void pushKotobaBookToCloud(user.uid, bookId, nextMastered, nextDifficult);
      }

      onMasteredToggled?.(wordId, isNowMastered);
    },
    [user, isVerified, profileReady, pushKotobaBookToCloud, onMasteredToggled]
  );

  const toggleKotobaDifficult = useCallback(
    (bookId: BookId, wordId: string) => {
      const prev = progressRef.current;
      const bucket = prev[bookId];
      const wasMastered = bucket.mastered.has(wordId);
      const willBeDifficult = !bucket.difficult.has(wordId);
      const nextMastered = new Set(bucket.mastered);
      const nextDifficult = new Set(bucket.difficult);

      if (willBeDifficult) {
        nextDifficult.add(wordId);
        nextMastered.delete(wordId);
      } else {
        nextDifficult.delete(wordId);
      }

      const nextAll: AllBooksProgress = {
        ...prev,
        [bookId]: { mastered: nextMastered, difficult: nextDifficult },
      };
      progressRef.current = nextAll;
      setKotobaProgress(nextAll);
      writeIdSet(KOTOBA_STORAGE_KEYS[bookId].mastered, nextMastered);
      writeIdSet(KOTOBA_STORAGE_KEYS[bookId].difficult, nextDifficult);

      if (user && isVerified && profileReady) {
        void pushKotobaBookToCloud(user.uid, bookId, nextMastered, nextDifficult);
      }

      if (willBeDifficult && wasMastered) {
        onMasteredToggled?.(wordId, false);
      }
    },
    [user, isVerified, profileReady, pushKotobaBookToCloud, onMasteredToggled]
  );

  return {
    kotobaProgress,
    syncingKotoba,
    toggleKotobaMastered,
    toggleKotobaDifficult,
    syncKotobaWithCloud,
  };
}
