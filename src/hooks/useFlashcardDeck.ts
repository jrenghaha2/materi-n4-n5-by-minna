import { useCallback, useEffect, useMemo, useState } from 'react';
import type { BookId, BunpouPattern, FilterMode } from '../types/bunpou';
import { shuffleArray } from '../utils/quizGenerator';
import { stopJapaneseSpeech } from '../utils/speech';

interface UseFlashcardDeckOptions {
  bookId: BookId;
  allPatterns: BunpouPattern[];
  selectedChapter: number | 'all';
  filterMode: FilterMode;
  masteredSet: Set<string>;
  difficultSet: Set<string>;
}

export function useFlashcardDeck({
  bookId,
  allPatterns,
  selectedChapter,
  filterMode,
  masteredSet,
  difficultSet,
}: UseFlashcardDeckOptions) {
  const [shuffledIds, setShuffledIds] = useState<string[] | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);

  // Filter patterns based on active chapter and filter mode
  const filteredPatterns = useMemo(() => {
    return allPatterns.filter(p => {
      if (selectedChapter !== 'all' && p.chapter !== selectedChapter) return false;
      if (filterMode === 'unmastered' && masteredSet.has(p.id)) return false;
      if (filterMode === 'difficult' && !difficultSet.has(p.id)) return false;
      return true;
    });
  }, [allPatterns, selectedChapter, filterMode, masteredSet, difficultSet]);

  const deck = useMemo(() => {
    if (!shuffledIds) return filteredPatterns;
    const byId = new Map(filteredPatterns.map(p => [p.id, p]));
    const ordered: BunpouPattern[] = [];
    for (const id of shuffledIds) {
      const found = byId.get(id);
      if (found) {
        ordered.push(found);
        byId.delete(id);
      }
    }
    for (const remaining of byId.values()) {
      ordered.push(remaining);
    }
    return ordered;
  }, [filteredPatterns, shuffledIds]);

  // Reset shuffle and card index when book, chapter, or filter changes
  useEffect(() => {
    setShuffledIds(null);
    setCurrentIndex(0);
    setIsFlipped(false);
    stopJapaneseSpeech();
  }, [bookId, selectedChapter, filterMode]);

  // Clamp index if deck shrinks (e.g., marking mastered while in 'unmastered' filter)
  useEffect(() => {
    if (deck.length === 0) {
      setCurrentIndex(0);
      setIsFlipped(false);
    } else if (currentIndex >= deck.length) {
      setCurrentIndex(deck.length - 1);
      setIsFlipped(false);
    }
  }, [deck.length, currentIndex]);

  const safeIndex = deck.length > 0 ? Math.min(currentIndex, deck.length - 1) : 0;
  const currentCard = deck[safeIndex] ?? null;

  const flipCard = useCallback(() => {
    setIsFlipped(prev => !prev);
  }, []);

  const goNext = useCallback(() => {
    if (deck.length <= 1) return;
    stopJapaneseSpeech();
    setIsFlipped(false);
    setCurrentIndex(prev => (prev + 1) % deck.length);
  }, [deck.length]);

  const goPrev = useCallback(() => {
    if (deck.length <= 1) return;
    stopJapaneseSpeech();
    setIsFlipped(false);
    setCurrentIndex(prev => (prev - 1 + deck.length) % deck.length);
  }, [deck.length]);

  const toggleShuffle = useCallback(() => {
    stopJapaneseSpeech();
    setIsFlipped(false);
    setCurrentIndex(0);
    setShuffledIds(prev => (prev ? null : shuffleArray(filteredPatterns.map(p => p.id))));
  }, [filteredPatterns]);

  const jumpToPattern = useCallback(
    (patternId: string) => {
      const idx = deck.findIndex(p => p.id === patternId);
      if (idx !== -1) {
        stopJapaneseSpeech();
        setIsFlipped(false);
        setCurrentIndex(idx);
      }
    },
    [deck]
  );

  return {
    deck,
    currentCard,
    currentIndex: safeIndex,
    isFlipped,
    isShuffled: shuffledIds !== null,
    flipCard,
    goNext,
    goPrev,
    toggleShuffle,
    jumpToPattern,
  };
}
