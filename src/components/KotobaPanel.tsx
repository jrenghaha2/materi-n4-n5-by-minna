import { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeftRight,
  BookOpen,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Eye,
  EyeOff,
  Flag,
  Layers,
  RotateCw,
  Search,
  Shuffle,
} from 'lucide-react';
import type { BookData, FilterMode, KotobaChapter, KotobaWord } from '../types/bunpou';
import { useCardFlipHandlers } from '../utils/cardFlipGuard';
import { buildKotobaRubySegments } from '../utils/furiganaConverter';
import { formatProgressPercent } from '../utils/rbac';
import { AudioButton } from './AudioButton';
import { RubySegmentsView } from './JapaneseText';

interface KotobaPanelProps {
  book: BookData;
  chapters: KotobaChapter[];
  selectedChapter: number | 'all';
  showFurigana: boolean;
  showTranslation: boolean;
  masteredSet: Set<string>;
  difficultSet: Set<string>;
  onToggleMastered: (wordId: string) => void;
  onToggleDifficult: (wordId: string) => void;
  onResetChapter: () => void;
}

type KotobaSubView = 'flashcard' | 'list';
type CardDirection = 'jp-to-id' | 'id-to-jp';

function shuffleArray<T>(items: T[]): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function splitExample(example?: string): { jp: string; id: string } | null {
  if (!example) return null;
  const idx = example.indexOf('=');
  if (idx === -1) return { jp: example.trim(), id: '' };
  return {
    jp: example.slice(0, idx).trim(),
    id: example.slice(idx + 1).trim(),
  };
}

export function KotobaPanel({
  book,
  chapters,
  selectedChapter,
  showFurigana,
  showTranslation,
  masteredSet,
  difficultSet,
  onToggleMastered,
  onToggleDifficult,
  onResetChapter,
}: KotobaPanelProps) {
  const [subView, setSubView] = useState<KotobaSubView>('flashcard');
  const [direction, setDirection] = useState<CardDirection>('jp-to-id');
  const [kotobaFilter, setKotobaFilter] = useState<FilterMode>('all');
  const [isShuffled, setIsShuffled] = useState(false);
  const [shuffleSeed, setShuffleSeed] = useState(0);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);

  const kotobaFlipHandlers = useCardFlipHandlers(() => setIsFlipped(v => !v));

  // List / Veil mode states
  const [searchQuery, setSearchQuery] = useState('');
  const [veilMode, setVeilMode] = useState(false);
  const [revealedIds, setRevealedIds] = useState<Set<string>>(() => new Set());

  const activeChapterObj = useMemo(() => {
    if (selectedChapter === 'all') return null;
    return chapters.find(ch => ch.chapter === selectedChapter) ?? null;
  }, [chapters, selectedChapter]);

  const scopedWords = useMemo<KotobaWord[]>(() => {
    if (selectedChapter === 'all') {
      return chapters.flatMap(ch => ch.words);
    }
    return activeChapterObj?.words ?? [];
  }, [chapters, selectedChapter, activeChapterObj]);

  const totalScoped = scopedWords.length;
  const masteredInScope = useMemo(
    () => scopedWords.filter(w => masteredSet.has(w.id)).length,
    [scopedWords, masteredSet]
  );
  const difficultInScope = useMemo(
    () => scopedWords.filter(w => difficultSet.has(w.id)).length,
    [scopedWords, difficultSet]
  );
  const unmasteredInScope = totalScoped - masteredInScope;

  const filteredWords = useMemo(() => {
    return scopedWords.filter(word => {
      if (kotobaFilter === 'unmastered' && masteredSet.has(word.id)) return false;
      if (kotobaFilter === 'difficult' && !difficultSet.has(word.id)) return false;
      return true;
    });
  }, [scopedWords, kotobaFilter, masteredSet, difficultSet]);

  const deck = useMemo(() => {
    void shuffleSeed;
    return isShuffled ? shuffleArray(filteredWords) : filteredWords;
  }, [filteredWords, isShuffled, shuffleSeed]);

  const searchedListWords = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return filteredWords;
    return filteredWords.filter(
      w =>
        w.reading.toLowerCase().includes(q) ||
        (w.kanji && w.kanji.toLowerCase().includes(q)) ||
        w.meaning.toLowerCase().includes(q) ||
        (w.example && w.example.toLowerCase().includes(q))
    );
  }, [filteredWords, searchQuery]);

  // Reset card position when book, chapter, or filter changes
  useEffect(() => {
    setCurrentIndex(0);
    setIsFlipped(false);
    setRevealedIds(new Set());
  }, [book.id, selectedChapter, kotobaFilter, isShuffled, shuffleSeed]);

  const safeIndex = deck.length > 0 ? Math.min(currentIndex, deck.length - 1) : 0;
  const currentCard = deck[safeIndex] ?? null;

  const goPrev = () => {
    if (deck.length <= 1) return;
    setIsFlipped(false);
    setCurrentIndex(prev => (prev - 1 + deck.length) % deck.length);
  };

  const goNext = () => {
    if (deck.length <= 1) return;
    setIsFlipped(false);
    setCurrentIndex(prev => (prev + 1) % deck.length);
  };

  const handleToggleShuffle = () => {
    setIsShuffled(prev => !prev);
    setShuffleSeed(s => s + 1);
  };

  const handleJumpToWord = (wordId: string) => {
    setSubView('flashcard');
    setIsShuffled(false);
    const idx = filteredWords.findIndex(w => w.id === wordId);
    if (idx >= 0) {
      setCurrentIndex(idx);
      setIsFlipped(false);
    }
  };

  const toggleRevealWord = (wordId: string) => {
    setRevealedIds(prev => {
      const next = new Set(prev);
      if (next.has(wordId)) next.delete(wordId);
      else next.add(wordId);
      return next;
    });
  };

  // Keyboard shortcuts when Flashcard sub-view is active
  useEffect(() => {
    if (subView !== 'flashcard') return;
    const handleKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable)
      ) {
        return;
      }
      if (document.querySelector('[role="dialog"]')) return;
      if (!currentCard) return;

      if (e.code === 'Space') {
        e.preventDefault();
        setIsFlipped(v => !v);
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        setIsFlipped(false);
        setCurrentIndex(prev => (prev + 1) % deck.length);
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        setIsFlipped(false);
        setCurrentIndex(prev => (prev - 1 + deck.length) % deck.length);
      } else if (e.key === 'h' || e.key === 'H') {
        onToggleMastered(currentCard.id);
      } else if (e.key === 's' || e.key === 'S') {
        onToggleDifficult(currentCard.id);
      }
    };

    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [subView, currentCard, deck.length, onToggleMastered, onToggleDifficult]);

  const parsedExample = currentCard ? splitExample(currentCard.example) : null;
  const isMastered = currentCard ? masteredSet.has(currentCard.id) : false;
  const isDifficult = currentCard ? difficultSet.has(currentCard.id) : false;
  const { label: scopePctLabel, barWidthPct: scopeBarWidthPct } = formatProgressPercent(
    masteredInScope,
    totalScoped
  );

  return (
    <div className="space-y-4">
      {/* Top Kotoba Control Bar */}
      <section
        aria-label="Ringkasan dan kontrol Flashcard Kotoba"
        className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-2xs space-y-3"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
              <h2 className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-slate-50">
                Kotoba {book.level}
                {selectedChapter === 'all'
                  ? ` · Semua Bab (${book.chapters[0]?.chapter}–${book.chapters[book.chapters.length - 1]?.chapter})`
                  : ` · Bab ${selectedChapter}`}
              </h2>
              <span className="text-slate-300 dark:text-slate-700" aria-hidden="true">
                ·
              </span>
              <span className="text-xs sm:text-sm font-mono-num font-semibold text-emerald-700 dark:text-emerald-400">
                {masteredInScope}/{totalScoped} hafal ({scopePctLabel})
              </span>
            </div>
            {activeChapterObj?.theme ? (
              <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400 font-jp truncate">
                Tema bab: {activeChapterObj.theme}
              </p>
            ) : (
              <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                Pilih bab di sidebar kiri untuk memfokuskan latihan kosakata per bab.
              </p>
            )}
          </div>

          {/* Sub-view switcher: Flashcard vs Daftar */}
          <div
            role="group"
            aria-label="Mode tampilan Kotoba"
            className="inline-flex items-center p-1 rounded-xl bg-slate-100 dark:bg-slate-800 gap-1 shrink-0"
          >
            <button
              type="button"
              id="btnKotobaSubFlashcard"
              aria-pressed={subView === 'flashcard'}
              onClick={() => setSubView('flashcard')}
              className={`min-h-[34px] px-3 py-1 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 transition-colors whitespace-nowrap cursor-pointer ${
                subView === 'flashcard'
                  ? 'bg-white dark:bg-slate-900 text-indigo-700 dark:text-indigo-300 shadow-2xs'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-slate-100'
              }`}
            >
              <Layers className="w-3.5 h-3.5" aria-hidden="true" />
              Flashcard
            </button>
            <button
              type="button"
              id="btnKotobaSubList"
              aria-pressed={subView === 'list'}
              onClick={() => setSubView('list')}
              className={`min-h-[34px] px-3 py-1 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 transition-colors whitespace-nowrap cursor-pointer ${
                subView === 'list'
                  ? 'bg-white dark:bg-slate-900 text-indigo-700 dark:text-indigo-300 shadow-2xs'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-slate-100'
              }`}
            >
              <BookOpen className="w-3.5 h-3.5" aria-hidden="true" />
              Daftar ({totalScoped})
            </button>
          </div>
        </div>

        {/* Progress Bar + Status Filters */}
        <div className="space-y-2.5">
          <div className="h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
            <div
              className="h-full rounded-full bg-emerald-600 dark:bg-emerald-400 transition-all duration-300"
              style={{ width: `${scopeBarWidthPct}%` }}
            />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <div role="group" aria-label="Filter status kosakata" className="flex flex-wrap items-center gap-1.5">
              {(
                [
                  { id: 'all', label: `Semua (${totalScoped})` },
                  { id: 'unmastered', label: `Belum (${unmasteredInScope})` },
                  { id: 'difficult', label: `Sulit (${difficultInScope})` },
                ] as { id: FilterMode; label: string }[]
              ).map(btn => (
                <button
                  key={btn.id}
                  type="button"
                  aria-pressed={kotobaFilter === btn.id}
                  onClick={() => setKotobaFilter(btn.id)}
                  className={`min-h-[32px] px-3 py-1 rounded-lg border text-xs font-semibold font-mono-num transition-colors whitespace-nowrap cursor-pointer ${
                    kotobaFilter === btn.id
                      ? 'bg-indigo-600 border-indigo-600 text-white'
                      : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700'
                  }`}
                >
                  {btn.label}
                </button>
              ))}
            </div>

            {subView === 'flashcard' ? (
              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  id="btnKotobaDirection"
                  onClick={() => {
                    setDirection(d => (d === 'jp-to-id' ? 'id-to-jp' : 'jp-to-id'));
                    setIsFlipped(false);
                  }}
                  className="min-h-[32px] px-3 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 inline-flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
                >
                  <ArrowLeftRight className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" aria-hidden="true" />
                  <span>{direction === 'jp-to-id' ? 'Jepang → Indonesia' : 'Indonesia → Jepang'}</span>
                </button>

                <button
                  type="button"
                  id="btnKotobaShuffle"
                  aria-pressed={isShuffled}
                  onClick={handleToggleShuffle}
                  className={`min-h-[32px] px-3 py-1 rounded-lg border text-xs font-semibold inline-flex items-center gap-1.5 transition-colors whitespace-nowrap cursor-pointer ${
                    isShuffled
                      ? 'bg-indigo-50 dark:bg-indigo-950/70 border-indigo-300 dark:border-indigo-700 text-indigo-800 dark:text-indigo-200'
                      : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700'
                  }`}
                >
                  <Shuffle className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>{isShuffled ? 'Acak Aktif' : 'Acak'}</span>
                </button>
              </div>
            ) : (
              <button
                type="button"
                id="btnKotobaVeilMode"
                aria-pressed={veilMode}
                onClick={() => {
                  setVeilMode(v => !v);
                  setRevealedIds(new Set());
                }}
                className={`min-h-[32px] px-3 py-1 rounded-lg border text-xs font-semibold inline-flex items-center gap-1.5 transition-colors whitespace-nowrap cursor-pointer ${
                  veilMode
                    ? 'bg-indigo-50 dark:bg-indigo-950/70 border-indigo-300 dark:border-indigo-700 text-indigo-800 dark:text-indigo-200'
                    : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700'
                }`}
              >
                {veilMode ? (
                  <EyeOff className="w-3.5 h-3.5" aria-hidden="true" />
                ) : (
                  <Eye className="w-3.5 h-3.5" aria-hidden="true" />
                )}
                <span>{veilMode ? 'Mode Hafalan: Aktif' : 'Mode Hafalan (Tutup Arti)'}</span>
              </button>
            )}
          </div>
        </div>
      </section>

      {/* SUB-VIEW 1: FLASHCARD KOTOBA 3D */}
      {subView === 'flashcard' ? (
        !currentCard ? (
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-8 text-center space-y-3">
            <p className="text-base font-bold text-slate-900 dark:text-slate-50">
              Tidak ada kosakata pada filter ini.
            </p>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Semua kosakata pada pilihan saat ini mungkin sudah dihafal atau belum ada yang ditandai sulit.
            </p>
            <button
              type="button"
              onClick={() => {
                setKotobaFilter('all');
                onResetChapter();
              }}
              className="min-h-[40px] px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold cursor-pointer"
            >
              Tampilkan Semua Kosakata
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Deck counter */}
            <div className="flex items-center justify-between gap-2 text-xs sm:text-sm text-slate-600 dark:text-slate-300">
              <div className="flex items-center gap-2">
                <span className="font-mono-num font-bold text-slate-900 dark:text-slate-50">
                  Kartu {safeIndex + 1} / {deck.length}
                </span>
                <span className="text-slate-300 dark:text-slate-700" aria-hidden="true">
                  ·
                </span>
                <span>
                  Bab {currentCard.chapter} (Hari {currentCard.dayNumber})
                </span>
              </div>
              <span className="text-xs text-slate-500 dark:text-slate-400">
                {direction === 'jp-to-id' ? 'Tebak arti bahasa Indonesia' : 'Tebak kosakata Jepang'}
              </span>
            </div>

            {/* 3D Flip Card */}
            <div className="perspective-1200">
              <div
                id="kotobaFlashcardContainer"
                className={`card-flip-inner grid w-full ${isFlipped ? 'is-flipped' : ''}`}
              >
                {/* FRONT FACE */}
                <div
                  {...kotobaFlipHandlers}
                  role="button"
                  tabIndex={isFlipped ? -1 : 0}
                  aria-label="Balik kartu flashcard kotoba"
                  className={`card-face col-start-1 row-start-1 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm p-5 sm:p-7 min-h-[300px] flex flex-col justify-between cursor-pointer select-text ${
                    isFlipped ? 'pointer-events-none' : ''
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                      Kosakata · Bab {currentCard.chapter} · Hari {currentCard.dayNumber}
                    </div>
                    {direction === 'jp-to-id' ? (
                      <AudioButton
                        text={currentCard.kanji || currentCard.reading}
                        label="Putar pengucapan kosakata"
                        size="md"
                      />
                    ) : null}
                  </div>

                  <div className="py-8 text-center space-y-3 my-auto">
                    {direction === 'jp-to-id' ? (
                      <div className="text-3xl sm:text-4xl font-extrabold text-slate-900 dark:text-slate-50 tracking-tight">
                        <RubySegmentsView
                          segments={buildKotobaRubySegments(
                            currentCard.kanji,
                            currentCard.reading
                          )}
                          showFurigana={showFurigana}
                        />
                      </div>
                    ) : (
                      <p className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-slate-50 max-w-xl mx-auto text-balance">
                        {currentCard.meaning}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-slate-800 text-xs text-slate-500 dark:text-slate-400">
                    <span>
                      {isMastered ? 'Status: Sudah Hafal' : 'Status: Belum Hafal'}
                      {isDifficult ? ' · Ditandai Sulit' : ''}
                    </span>
                    <span className="inline-flex items-center gap-1.5 font-semibold text-indigo-700 dark:text-indigo-300">
                      <RotateCw className="w-3.5 h-3.5" aria-hidden="true" />
                      Klik kartu atau tekan Spasi
                    </span>
                  </div>
                </div>

                {/* BACK FACE */}
                <div
                  {...kotobaFlipHandlers}
                  role="button"
                  tabIndex={isFlipped ? 0 : -1}
                  aria-label="Klik kartu untuk kembali ke sisi depan flashcard kotoba"
                  className={`card-face card-face-back col-start-1 row-start-1 rounded-2xl border border-indigo-200 dark:border-indigo-800/80 bg-white dark:bg-slate-900 shadow-sm p-5 sm:p-7 min-h-[300px] flex flex-col justify-between gap-4 cursor-pointer select-text ${
                    !isFlipped ? 'pointer-events-none max-h-[300px] overflow-hidden' : ''
                  }`}
                >
                  <div className="flex items-start justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-3">
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-indigo-700 dark:text-indigo-300">
                        Jawaban &amp; Contoh Penggunaan · Bab {currentCard.chapter}
                      </p>
                      <div className="mt-1 flex flex-wrap items-baseline gap-2.5">
                        <h3 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-slate-50">
                          <RubySegmentsView
                            segments={buildKotobaRubySegments(
                              currentCard.kanji,
                              currentCard.reading
                            )}
                            showFurigana={showFurigana}
                          />
                        </h3>
                        {currentCard.kanji &&
                        (/[\/／\[\]（(…・]/.test(currentCard.reading) || !showFurigana) ? (
                          <span
                            lang="ja"
                            className="text-xs sm:text-sm font-jp font-medium text-slate-500 dark:text-slate-400"
                          >
                            {currentCard.reading}
                          </span>
                        ) : null}
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <AudioButton
                        text={currentCard.kanji || currentCard.reading}
                        label="Putar pengucapan kosakata"
                      />
                      <button
                        type="button"
                        onClick={e => {
                          e.stopPropagation();
                          setIsFlipped(false);
                        }}
                        className="min-h-[34px] px-3 py-1 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 inline-flex items-center gap-1.5 cursor-pointer"
                      >
                        <RotateCw className="w-3.5 h-3.5" aria-hidden="true" />
                        Depan
                      </button>
                    </div>
                  </div>

                  <div className="space-y-4 my-auto">
                    <div>
                      <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                        Arti Bahasa Indonesia
                      </p>
                      <p className="mt-1 text-lg sm:text-xl font-bold text-slate-900 dark:text-slate-50">
                        {currentCard.meaning}
                      </p>
                    </div>

                    {parsedExample ? (
                      <div className="rounded-xl border border-slate-200/90 dark:border-slate-800 bg-slate-50/75 dark:bg-slate-800/50 px-3.5 py-3 flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">
                            Contoh Penggunaan
                          </p>
                          <p
                            lang="ja"
                            className="text-sm sm:text-base font-jp font-semibold text-slate-900 dark:text-slate-50"
                          >
                            {parsedExample.jp}
                          </p>
                          {showTranslation && parsedExample.id ? (
                            <p className="mt-1 text-xs sm:text-sm text-slate-600 dark:text-slate-300">
                              {parsedExample.id}
                            </p>
                          ) : null}
                        </div>
                        <AudioButton
                          text={parsedExample.jp}
                          label="Putar contoh kalimat kosakata"
                        />
                      </div>
                    ) : null}
                  </div>

                  <div className="flex items-center justify-end pt-3 border-t border-slate-100 dark:border-slate-800 text-xs text-slate-500 dark:text-slate-400">
                    <span className="inline-flex items-center gap-1.5 font-semibold text-indigo-700 dark:text-indigo-300">
                      <RotateCw className="w-3.5 h-3.5" aria-hidden="true" />
                      Klik kartu atau tekan Spasi untuk balik ke depan
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Flashcard Actions */}
            <div className="flex flex-wrap items-center justify-between gap-2.5">
              <button
                type="button"
                id="btnKotobaPrev"
                onClick={goPrev}
                disabled={deck.length <= 1}
                className="min-h-[42px] px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 text-sm font-semibold inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-40"
              >
                <ChevronLeft className="w-4 h-4" aria-hidden="true" />
                <span>Sebelumnya</span>
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  id="btnKotobaToggleMastered"
                  aria-pressed={isMastered}
                  onClick={() => onToggleMastered(currentCard.id)}
                  className={`min-h-[42px] px-4 py-2 rounded-xl border text-sm font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer ${
                    isMastered
                      ? 'bg-emerald-600 border-emerald-600 text-white hover:bg-emerald-700'
                      : 'bg-white dark:bg-slate-900 border-emerald-300 dark:border-emerald-700 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/60'
                  }`}
                >
                  <CheckCircle2 className="w-4 h-4" aria-hidden="true" />
                  <span>{isMastered ? 'Sudah Hafal' : 'Tandai Hafal'}</span>
                </button>

                <button
                  type="button"
                  id="btnKotobaToggleDifficult"
                  aria-pressed={isDifficult}
                  onClick={() => onToggleDifficult(currentCard.id)}
                  className={`min-h-[42px] px-4 py-2 rounded-xl border text-sm font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer ${
                    isDifficult
                      ? 'bg-amber-600 border-amber-600 text-white hover:bg-amber-700'
                      : 'bg-white dark:bg-slate-900 border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-300 hover:bg-amber-50 dark:hover:bg-amber-950/60'
                  }`}
                >
                  <Flag className="w-4 h-4" aria-hidden="true" />
                  <span>{isDifficult ? 'Ditandai Sulit' : 'Tandai Sulit'}</span>
                </button>
              </div>

              <button
                type="button"
                id="btnKotobaNext"
                onClick={goNext}
                disabled={deck.length <= 1}
                className="min-h-[42px] px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 text-sm font-semibold inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-40"
              >
                <span>Berikutnya</span>
                <ChevronRight className="w-4 h-4" aria-hidden="true" />
              </button>
            </div>

            <p className="hidden sm:block text-center text-[11px] text-slate-400 dark:text-slate-500">
              Pintasan keyboard: Spasi (balik kartu) · ← / → (pindah kartu) · H (tandai hafal) · S (tandai sulit)
            </p>
          </div>
        )
      ) : (
        /* SUB-VIEW 2: DAFTAR KOTOBA + MODE HAFALAN (VEIL) */
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[220px]">
              <Search
                className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                aria-hidden="true"
              />
              <input
                type="search"
                id="kotobaSearchInput"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Cari kosakata Jepang, kanji, atau arti..."
                aria-label="Cari kosakata"
                className="w-full h-10 pl-9 pr-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:border-indigo-500"
              />
            </div>
            <span className="text-xs font-mono-num text-slate-500 dark:text-slate-400">
              Menampilkan {searchedListWords.length} kosakata
            </span>
          </div>

          {veilMode ? (
            <p className="text-xs text-indigo-700 dark:text-indigo-300">
              Mode Hafalan aktif — arti disembunyikan. Klik kartu mana saja untuk mengintip jawabannya.
            </p>
          ) : null}

          {searchedListWords.length === 0 ? (
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-8 text-center text-sm text-slate-500 dark:text-slate-400">
              Tidak ada kosakata yang cocok dengan pencarian Anda.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
              {searchedListWords.map(word => {
                const wMastered = masteredSet.has(word.id);
                const wDifficult = difficultSet.has(word.id);
                const isHidden = veilMode && !revealedIds.has(word.id);
                const exParts = splitExample(word.example);

                return (
                  <article
                    key={word.id}
                    onClick={() => {
                      if (!veilMode) return;
                      if (window.getSelection()?.toString().trim()) return;
                      toggleRevealWord(word.id);
                    }}
                    className={`rounded-2xl border bg-white dark:bg-slate-900 p-4 flex flex-col justify-between gap-2.5 transition-colors ${
                      veilMode ? 'cursor-pointer hover:border-indigo-300 dark:hover:border-indigo-700' : ''
                    } ${
                      wMastered
                        ? 'border-emerald-200 dark:border-emerald-900/70'
                        : wDifficult
                        ? 'border-amber-200 dark:border-amber-900/70'
                        : 'border-slate-200 dark:border-slate-800'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="text-[11px] font-medium text-slate-400 dark:text-slate-500">
                          Bab {word.chapter} · Hari {word.dayNumber}
                        </div>
                        <div className="mt-0.5 flex flex-wrap items-baseline gap-2">
                          <span className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-slate-50">
                            <RubySegmentsView
                              segments={buildKotobaRubySegments(word.kanji, word.reading)}
                              showFurigana={showFurigana}
                            />
                          </span>
                          {word.kanji && /[\/／…\[]/.test(word.reading) ? (
                            <span
                              lang="ja"
                              className="text-xs font-jp text-slate-400 dark:text-slate-500"
                            >
                              {word.reading}
                            </span>
                          ) : null}
                        </div>
                      </div>

                      <div
                        className="flex items-center gap-1 shrink-0"
                        onClick={e => e.stopPropagation()}
                      >
                        <AudioButton
                          text={word.kanji || word.reading}
                          label={`Putar ${word.reading}`}
                        />
                        <button
                          type="button"
                          aria-pressed={wMastered}
                          aria-label={wMastered ? 'Batalkan status hafal' : 'Tandai hafal'}
                          title={wMastered ? 'Sudah Hafal' : 'Tandai Hafal'}
                          onClick={() => onToggleMastered(word.id)}
                          className={`min-h-[34px] min-w-[34px] rounded-xl border inline-flex items-center justify-center transition-colors cursor-pointer ${
                            wMastered
                              ? 'bg-emerald-600 border-emerald-600 text-white'
                              : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400'
                          }`}
                        >
                          <CheckCircle2 className="w-4 h-4" aria-hidden="true" />
                        </button>
                        <button
                          type="button"
                          aria-pressed={wDifficult}
                          aria-label={wDifficult ? 'Hapus tanda sulit' : 'Tandai sulit'}
                          title={wDifficult ? 'Ditandai Sulit' : 'Tandai Sulit'}
                          onClick={() => onToggleDifficult(word.id)}
                          className={`min-h-[34px] min-w-[34px] rounded-xl border inline-flex items-center justify-center transition-colors cursor-pointer ${
                            wDifficult
                              ? 'bg-amber-600 border-amber-600 text-white'
                              : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:text-amber-600 dark:hover:text-amber-400'
                          }`}
                        >
                          <Flag className="w-4 h-4" aria-hidden="true" />
                        </button>
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      {isHidden ? (
                        <p className="text-xs italic text-slate-400 dark:text-slate-500 select-none">
                          Ketuk kartu untuk melihat arti...
                        </p>
                      ) : (
                        <>
                          <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
                            {word.meaning}
                          </p>
                          {exParts ? (
                            <p className="text-xs text-slate-500 dark:text-slate-400 font-jp leading-relaxed">
                              {exParts.jp}
                              {showTranslation && exParts.id ? ` — ${exParts.id}` : ''}
                            </p>
                          ) : null}
                        </>
                      )}
                    </div>

                    <div
                      className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px]"
                      onClick={e => e.stopPropagation()}
                    >
                      <span className="text-slate-400 dark:text-slate-500">
                        {wMastered ? 'Sudah Hafal' : wDifficult ? 'Perlu Diulang' : 'Belum Hafal'}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleJumpToWord(word.id)}
                        className="font-semibold text-indigo-700 dark:text-indigo-300 hover:underline cursor-pointer"
                      >
                        Latih di Flashcard
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
