import { useCallback, useRef, useState } from 'react';
import type { AllBooksProgress, BookId } from '../types/bunpou';

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

function readIdSet(key: string): Set<string> {
  try {
    if (typeof localStorage === 'undefined') return new Set();
    const raw = localStorage.getItem(key);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.filter((v): v is string => typeof v === 'string' && v.length > 0));
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
  return {
    n5: {
      mastered: readIdSet(KOTOBA_STORAGE_KEYS.n5.mastered),
      difficult: readIdSet(KOTOBA_STORAGE_KEYS.n5.difficult),
    },
    n4: {
      mastered: readIdSet(KOTOBA_STORAGE_KEYS.n4.mastered),
      difficult: readIdSet(KOTOBA_STORAGE_KEYS.n4.difficult),
    },
  };
}

interface UseKotobaProgressOptions {
  onMasteredToggled?: (wordId: string, isNowMastered: boolean) => void;
}

export function useKotobaProgress({ onMasteredToggled }: UseKotobaProgressOptions = {}) {
  const [kotobaProgress, setKotobaProgress] = useState<AllBooksProgress>(() =>
    loadInitialKotobaProgress()
  );

  const progressRef = useRef(kotobaProgress);
  progressRef.current = kotobaProgress;

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

        return {
          ...prev,
          [bookId]: { mastered: nextMastered, difficult: nextDifficult },
        };
      });

      onMasteredToggled?.(wordId, isNowMastered);
    },
    [onMasteredToggled]
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

        return {
          ...prev,
          [bookId]: { mastered: nextMastered, difficult: nextDifficult },
        };
      });

      if (willBeDifficult && wasMastered) {
        onMasteredToggled?.(wordId, false);
      }
    },
    [onMasteredToggled]
  );

  return {
    kotobaProgress,
    toggleKotobaMastered,
    toggleKotobaDifficult,
  };
}
