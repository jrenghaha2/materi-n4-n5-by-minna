import { useCallback, useEffect, useRef, useState } from 'react';
import type { User } from 'firebase/auth';
import type { AllBooksProgress, BookId } from '../types/bunpou';
import {
  fetchKotobaProgressDoc,
  saveKotobaProgressDoc,
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

  const pushKotobaBookToCloud = useCallback(
    async (uid: string, bookId: BookId, mastered: Set<string>, difficult: Set<string>) => {
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
      }
    },
    [showToast]
  );

  const syncKotobaWithCloud = useCallback(
    async (silent = false) => {
      if (!user || !isVerified || !profileReady) return;
      setSyncingKotoba(true);
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
          const remote = await fetchKotobaProgressDoc(user.uid, bookId);
          const mergedMastered = mergeKotobaSets(
            next[bookId].mastered,
            remote?.mastered ?? [],
            bookId
          );
          const rawMergedDifficult = mergeKotobaSets(
            next[bookId].difficult,
            remote?.difficult ?? [],
            bookId
          );
          const mergedDifficult = new Set(
            Array.from(rawMergedDifficult).filter(id => !mergedMastered.has(id))
          );

          next[bookId] = {
            mastered: mergedMastered,
            difficult: mergedDifficult,
          };
          writeIdSet(KOTOBA_STORAGE_KEYS[bookId].mastered, mergedMastered);
          writeIdSet(KOTOBA_STORAGE_KEYS[bookId].difficult, mergedDifficult);

          const remoteMasteredCount = remote?.mastered.length ?? 0;
          const remoteDifficultCount = remote?.difficult.length ?? 0;
          if (
            !remote ||
            mergedMastered.size !== remoteMasteredCount ||
            mergedDifficult.size !== remoteDifficultCount
          ) {
            await saveKotobaProgressDoc(user.uid, bookId, {
              mastered: Array.from(mergedMastered),
              difficult: Array.from(mergedDifficult),
            });
          }
        }

        setKotobaProgress(next);
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
    [user, isVerified, profileReady, showToast]
  );

  useEffect(() => {
    if (user && isVerified && profileReady) {
      void syncKotobaWithCloud(true);
    }
  }, [user, isVerified, profileReady, syncKotobaWithCloud]);

  const toggleKotobaMastered = useCallback(
    (bookId: BookId, wordId: string) => {
      const wasMastered = progressRef.current[bookId].mastered.has(wordId);
      const isNowMastered = !wasMastered;

      setKotobaProgress(prev => {
        const bucket = prev[bookId];
        const nextMastered = new Set(bucket.mastered);
        const nextDifficult = new Set(bucket.difficult);
        if (isNowMastered) {
          nextMastered.add(wordId);
          nextDifficult.delete(wordId);
        } else {
          nextMastered.delete(wordId);
        }

        writeIdSet(KOTOBA_STORAGE_KEYS[bookId].mastered, nextMastered);
        writeIdSet(KOTOBA_STORAGE_KEYS[bookId].difficult, nextDifficult);
        if (user && isVerified && profileReady) {
          void pushKotobaBookToCloud(user.uid, bookId, nextMastered, nextDifficult);
        }

        return {
          ...prev,
          [bookId]: { mastered: nextMastered, difficult: nextDifficult },
        };
      });

      onMasteredToggled?.(wordId, isNowMastered);
    },
    [user, isVerified, profileReady, pushKotobaBookToCloud, onMasteredToggled]
  );

  const toggleKotobaDifficult = useCallback(
    (bookId: BookId, wordId: string) => {
      const wasMastered = progressRef.current[bookId].mastered.has(wordId);
      const willBeDifficult = !progressRef.current[bookId].difficult.has(wordId);

      setKotobaProgress(prev => {
        const bucket = prev[bookId];
        const nextMastered = new Set(bucket.mastered);
        const nextDifficult = new Set(bucket.difficult);
        if (willBeDifficult) {
          nextDifficult.add(wordId);
          nextMastered.delete(wordId);
        } else {
          nextDifficult.delete(wordId);
        }

        writeIdSet(KOTOBA_STORAGE_KEYS[bookId].mastered, nextMastered);
        writeIdSet(KOTOBA_STORAGE_KEYS[bookId].difficult, nextDifficult);
        if (user && isVerified && profileReady) {
          void pushKotobaBookToCloud(user.uid, bookId, nextMastered, nextDifficult);
        }

        return {
          ...prev,
          [bookId]: { mastered: nextMastered, difficult: nextDifficult },
        };
      });

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

