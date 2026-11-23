import { useEffect } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Flag,
  Info,
  RotateCw,
  Shuffle,
} from 'lucide-react';
import type { BunpouPattern } from '../types/bunpou';
import { useCardFlipHandlers } from '../utils/cardFlipGuard';
import { AudioButton } from './AudioButton';
import { FormulaDisplay } from './FormulaDisplay';
import { JapaneseText } from './JapaneseText';

interface FlashcardPanelProps {
  deck: BunpouPattern[];
  currentCard: BunpouPattern | null;
  currentIndex: number;
  isFlipped: boolean;
  isShuffled: boolean;
  showFurigana: boolean;
  showTranslation: boolean;
  masteredSet: Set<string>;
  difficultSet: Set<string>;
  onFlip: () => void;
  onPrev: () => void;
  onNext: () => void;
  onToggleShuffle: () => void;
  onToggleMastered: (patternId: string) => void;
  onToggleDifficult: (patternId: string) => void;
  onResetFilters: () => void;
}

export function FlashcardPanel({
  deck,
  currentCard,
  currentIndex,
  isFlipped,
  isShuffled,
  showFurigana,
  showTranslation,
  masteredSet,
  difficultSet,
  onFlip,
  onPrev,
  onNext,
  onToggleShuffle,
  onToggleMastered,
  onToggleDifficult,
  onResetFilters,
}: FlashcardPanelProps) {
  const cardFlipHandlers = useCardFlipHandlers(onFlip);

  // Keyboard shortcuts: Space/Enter flip, ArrowLeft/ArrowRight navigate, H hafal, S sulit
  useEffect(() => {
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
        onFlip();
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        onNext();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        onPrev();
      } else if (e.key === 'h' || e.key === 'H') {
        onToggleMastered(currentCard.id);
      } else if (e.key === 's' || e.key === 'S') {
        onToggleDifficult(currentCard.id);
      }
    };

    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [currentCard, onFlip, onNext, onPrev, onToggleMastered, onToggleDifficult]);

  if (!currentCard) {
    return (
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-8 text-center space-y-3">
        <p className="text-base font-bold text-slate-900 dark:text-slate-50">
          Tidak ada pola tata bahasa pada filter ini.
        </p>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Semua pola pada pilihan saat ini mungkin sudah dihafal atau belum ada yang ditandai sulit.
        </p>
        <button
          type="button"
          onClick={onResetFilters}
          className="min-h-[40px] px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold cursor-pointer"
        >
          Tampilkan Semua Pola
        </button>
      </div>
    );
  }

  const isMastered = masteredSet.has(currentCard.id);
  const isDifficult = difficultSet.has(currentCard.id);

  return (
    <div className="space-y-4">
      {/* Deck controls header */}
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs sm:text-sm">
        <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
          <span className="font-mono-num font-bold text-slate-900 dark:text-slate-50">
            Kartu {currentIndex + 1} / {deck.length}
          </span>
          <span className="text-slate-300 dark:text-slate-700" aria-hidden="true">
            ·
          </span>
          <span>
            Bab {currentCard.chapter} (Hari {currentCard.dayNumber})
          </span>
        </div>

        <button
          type="button"
          id="btnShuffleDeck"
          aria-pressed={isShuffled}
          onClick={onToggleShuffle}
          className={`min-h-[34px] px-3 py-1 rounded-xl border text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer ${
            isShuffled
              ? 'bg-indigo-50 dark:bg-indigo-950/70 border-indigo-300 dark:border-indigo-700 text-indigo-800 dark:text-indigo-200'
              : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700'
          }`}
        >
          <Shuffle className="w-3.5 h-3.5" aria-hidden="true" />
          <span>{isShuffled ? 'Acak Aktif' : 'Acak Kartu'}</span>
        </button>
      </div>

      {/* 3D Flip Card */}
      <div className="perspective-1200">
        <div
          id="flashcardContainer"
          className={`card-flip-inner grid w-full ${isFlipped ? 'is-flipped' : ''}`}
        >
          {/* FRONT FACE */}
          <div
            {...cardFlipHandlers}
            role="button"
            tabIndex={isFlipped ? -1 : 0}
            aria-label="Balik kartu flashcard untuk melihat arti dan contoh kalimat"
            className={`card-face col-start-1 row-start-1 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm p-5 sm:p-7 min-h-[340px] flex flex-col justify-between cursor-pointer select-text ${
              isFlipped ? 'pointer-events-none' : ''
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                Bab {currentCard.chapter} · Hari {currentCard.dayNumber} · {currentCard.chapterTitle}
              </div>
              <AudioButton
                text={currentCard.title}
                label="Putar pengucapan pola tata bahasa"
                size="md"
              />
            </div>

            <div className="py-8 text-center space-y-5 my-auto">
              <div className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-slate-50">
                <JapaneseText text={currentCard.title} showFurigana={showFurigana} />
              </div>

              <div className="max-w-xl mx-auto text-left">
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-1.5">
                  Pola Pembentukan
                </p>
                <FormulaDisplay formulas={currentCard.formulas} />
              </div>
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-slate-800 text-xs text-slate-500 dark:text-slate-400">
              <span>
                {isMastered ? 'Status: Sudah Hafal' : 'Status: Belum Hafal'}
                {isDifficult ? ' · Ditandai Sulit' : ''}
              </span>
              <span className="inline-flex items-center gap-1.5 font-semibold text-indigo-700 dark:text-indigo-300">
                <RotateCw className="w-3.5 h-3.5" aria-hidden="true" />
                Klik kartu atau tekan Spasi untuk balik
              </span>
            </div>
          </div>

          {/* BACK FACE */}
          <div
            {...cardFlipHandlers}
            role="button"
            tabIndex={isFlipped ? 0 : -1}
            aria-label="Klik kartu untuk kembali ke sisi depan flashcard"
            className={`card-face card-face-back col-start-1 row-start-1 rounded-2xl border border-indigo-200 dark:border-indigo-800/80 bg-white dark:bg-slate-900 shadow-sm p-5 sm:p-6 flex flex-col justify-between gap-4 cursor-pointer select-text ${
              !isFlipped ? 'pointer-events-none max-h-[340px] overflow-hidden' : ''
            }`}
          >
            <div className="space-y-4">
              <div className="flex items-start justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-3">
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-indigo-700 dark:text-indigo-300">
                    Arti &amp; Penjelasan · Bab {currentCard.chapter}
                  </p>
                  <h3 className="mt-1 text-lg sm:text-xl font-extrabold text-slate-900 dark:text-slate-50">
                    <JapaneseText text={currentCard.title} showFurigana={showFurigana} />
                  </h3>
                  <p className="mt-1 text-sm sm:text-base font-semibold text-slate-800 dark:text-slate-100">
                    {currentCard.meaning}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={e => {
                    e.stopPropagation();
                    onFlip();
                  }}
                  className="min-h-[34px] px-3 py-1 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 inline-flex items-center gap-1.5 shrink-0 cursor-pointer"
                >
                  <RotateCw className="w-3.5 h-3.5" aria-hidden="true" />
                  Depan
                </button>
              </div>

              {currentCard.notes ? (
                <div className="rounded-xl border border-indigo-200/80 dark:border-indigo-800/70 bg-indigo-50/60 dark:bg-indigo-950/40 px-3.5 py-2.5 flex items-start gap-2.5 text-xs sm:text-sm text-indigo-950 dark:text-indigo-100">
                  <Info className="w-4 h-4 shrink-0 mt-0.5 text-indigo-600 dark:text-indigo-400" aria-hidden="true" />
                  <p className="leading-relaxed">
                    <strong className="font-bold">Catatan: </strong>
                    {currentCard.notes}
                  </p>
                </div>
              ) : null}

              {currentCard.warnings ? (
                <div className="rounded-xl border border-amber-200 dark:border-amber-800/80 bg-amber-50/75 dark:bg-amber-950/40 px-3.5 py-2.5 flex items-start gap-2.5 text-xs sm:text-sm text-amber-950 dark:text-amber-100">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" aria-hidden="true" />
                  <p className="leading-relaxed">
                    <strong className="font-bold">Perhatian: </strong>
                    {currentCard.warnings}
                  </p>
                </div>
              ) : null}

              {/* 4 Varied Reibun */}
              <div className="space-y-2">
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                  Contoh Kalimat / Reibun ({currentCard.examples.length})
                </p>
                <div className="space-y-2">
                  {currentCard.examples.map((ex, idx) => (
                    <div
                      key={idx}
                      className="rounded-xl border border-slate-200/90 dark:border-slate-800 bg-slate-50/75 dark:bg-slate-800/50 px-3 py-2.5 flex items-start justify-between gap-3"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="text-sm sm:text-[15px] text-slate-900 dark:text-slate-50 font-medium">
                          <JapaneseText text={ex.japanese} showFurigana={showFurigana} />
                        </div>
                        {showTranslation ? (
                          <p className="mt-1 text-xs sm:text-sm text-slate-600 dark:text-slate-300">
                            {ex.indonesian}
                          </p>
                        ) : null}
                      </div>
                      <AudioButton
                        text={ex.japanese}
                        label={`Putar contoh kalimat ${idx + 1}`}
                      />
                    </div>
                  ))}
                </div>
              </div>
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

      {/* Action bar: Prev / Hafal / Sulit / Next */}
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        <button
          type="button"
          id="btnPrevCard"
          onClick={onPrev}
          disabled={deck.length <= 1}
          className="min-h-[42px] px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 text-sm font-semibold inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-40"
        >
          <ChevronLeft className="w-4 h-4" aria-hidden="true" />
          <span>Sebelumnya</span>
        </button>

        <div className="flex items-center gap-2">
          <button
            type="button"
            id="btnToggleMasteredCard"
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
            id="btnToggleDifficultCard"
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
          id="btnNextCard"
          onClick={onNext}
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
  );
}
