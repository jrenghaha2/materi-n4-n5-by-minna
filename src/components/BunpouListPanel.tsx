import { useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  Flag,
  Info,
  Layers,
  Search,
} from 'lucide-react';
import type { BunpouPattern } from '../types/bunpou';
import { stripFuriganaMarkup, toKanaReading } from '../utils/furiganaConverter';
import { AudioButton } from './AudioButton';
import { FormulaDisplay } from './FormulaDisplay';
import { JapaneseText } from './JapaneseText';

interface BunpouListPanelProps {
  patterns: BunpouPattern[];
  showFurigana: boolean;
  showTranslation: boolean;
  masteredSet: Set<string>;
  difficultSet: Set<string>;
  onToggleMastered: (patternId: string) => void;
  onToggleDifficult: (patternId: string) => void;
  onOpenInFlashcard: (pattern: BunpouPattern) => void;
}

export function BunpouListPanel({
  patterns,
  showFurigana,
  showTranslation,
  masteredSet,
  difficultSet,
  onToggleMastered,
  onToggleDifficult,
  onOpenInFlashcard,
}: BunpouListPanelProps) {
  const [query, setQuery] = useState('');
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() =>
    patterns[0] ? new Set([patterns[0].id]) : new Set()
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return patterns;
    return patterns.filter(p => {
      const plainTitle = stripFuriganaMarkup(p.title).toLowerCase();
      const kanaTitle = toKanaReading(p.title).toLowerCase();
      if (
        plainTitle.includes(q) ||
        kanaTitle.includes(q) ||
        p.meaning.toLowerCase().includes(q) ||
        p.chapterTitle.toLowerCase().includes(q) ||
        `bab ${p.chapter}`.includes(q) ||
        p.formulas.some(f => f.toLowerCase().includes(q)) ||
        (p.notes && p.notes.toLowerCase().includes(q))
      ) {
        return true;
      }
      return p.examples.some(
        ex =>
          stripFuriganaMarkup(ex.japanese).toLowerCase().includes(q) ||
          toKanaReading(ex.japanese).toLowerCase().includes(q) ||
          ex.indonesian.toLowerCase().includes(q)
      );
    });
  }, [patterns, query]);

  const toggleExpand = (id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const expandAll = () => setExpandedIds(new Set(filtered.map(p => p.id)));
  const collapseAll = () => setExpandedIds(new Set());

  return (
    <div className="space-y-3.5">
      {/* Search & bulk expand controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
        <div className="relative flex-1">
          <Search
            className="w-4 h-4 text-slate-400 dark:text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
            aria-hidden="true"
          />
          <input
            id="bunpouSearchInput"
            type="search"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Cari pola, arti Indonesia, rumus, atau contoh kalimat (Kanji/Kana)..."
            aria-label="Cari pola tata bahasa"
            className="w-full h-10 pl-10 pr-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-2 focus:outline-indigo-500"
          />
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <span className="text-xs font-mono-num text-slate-500 dark:text-slate-400">
            {filtered.length} pola
          </span>
          <button
            type="button"
            onClick={expandAll}
            className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 cursor-pointer"
          >
            Buka Semua
          </button>
          <button
            type="button"
            onClick={collapseAll}
            className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 cursor-pointer"
          >
            Tutup Semua
          </button>
        </div>
      </div>

      {/* Pattern cards */}
      <div className="space-y-2.5">
        {filtered.map(pattern => {
          const isOpen = expandedIds.has(pattern.id);
          const isMastered = masteredSet.has(pattern.id);
          const isDifficult = difficultSet.has(pattern.id);

          return (
            <article
              key={pattern.id}
              className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden shadow-2xs"
            >
              <div className="p-4 flex items-start justify-between gap-3">
                <button
                  type="button"
                  onClick={() => toggleExpand(pattern.id)}
                  aria-expanded={isOpen}
                  className="flex-1 min-w-0 text-left cursor-pointer group"
                >
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-slate-500 dark:text-slate-400">
                    <span className="font-mono-num font-bold text-indigo-700 dark:text-indigo-300">
                      Bab {pattern.chapter}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span>Hari {pattern.dayNumber}</span>
                    <span aria-hidden="true">·</span>
                    <span className="font-mono-num">{pattern.examples.length} reibun</span>
                    {isMastered ? (
                      <>
                        <span aria-hidden="true">·</span>
                        <span className="font-semibold text-emerald-700 dark:text-emerald-400">
                          Hafal
                        </span>
                      </>
                    ) : null}
                    {isDifficult ? (
                      <>
                        <span aria-hidden="true">·</span>
                        <span className="font-semibold text-amber-700 dark:text-amber-400">
                          Sulit
                        </span>
                      </>
                    ) : null}
                  </div>

                  <h3 className="mt-1 text-base sm:text-lg font-extrabold text-slate-900 dark:text-slate-50 group-hover:text-indigo-700 dark:group-hover:text-indigo-300 transition-colors">
                    <JapaneseText text={pattern.title} showFurigana={showFurigana} />
                  </h3>

                  <p className="mt-0.5 text-sm text-slate-600 dark:text-slate-300">
                    {pattern.meaning}
                  </p>
                </button>

                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    aria-pressed={isMastered}
                    onClick={() => onToggleMastered(pattern.id)}
                    aria-label={isMastered ? 'Batalkan status hafal' : 'Tandai sebagai hafal'}
                    title={isMastered ? 'Sudah hafal' : 'Tandai hafal'}
                    className={`w-9 h-9 rounded-xl border inline-flex items-center justify-center transition-colors cursor-pointer ${
                      isMastered
                        ? 'bg-emerald-600 border-emerald-600 text-white'
                        : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:text-emerald-700 dark:hover:text-emerald-400'
                    }`}
                  >
                    <CheckCircle2 className="w-4 h-4" aria-hidden="true" />
                  </button>

                  <button
                    type="button"
                    aria-pressed={isDifficult}
                    onClick={() => onToggleDifficult(pattern.id)}
                    aria-label={isDifficult ? 'Hapus tanda sulit' : 'Tandai sebagai sulit'}
                    title={isDifficult ? 'Ditandai sulit' : 'Tandai sulit'}
                    className={`w-9 h-9 rounded-xl border inline-flex items-center justify-center transition-colors cursor-pointer ${
                      isDifficult
                        ? 'bg-amber-600 border-amber-600 text-white'
                        : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:text-amber-700 dark:hover:text-amber-400'
                    }`}
                  >
                    <Flag className="w-4 h-4" aria-hidden="true" />
                  </button>

                  <button
                    type="button"
                    onClick={() => toggleExpand(pattern.id)}
                    aria-label={isOpen ? 'Tutup detail' : 'Buka detail'}
                    className="w-9 h-9 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 inline-flex items-center justify-center cursor-pointer"
                  >
                    <ChevronDown
                      className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                      aria-hidden="true"
                    />
                  </button>
                </div>
              </div>

              {isOpen ? (
                <div className="px-4 pb-4 pt-2 border-t border-slate-100 dark:border-slate-800 space-y-3.5">
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-1.5">
                      Rumus Pembentukan
                    </p>
                    <FormulaDisplay formulas={pattern.formulas} compact />
                  </div>

                  {pattern.notes ? (
                    <div className="rounded-xl border border-indigo-200/80 dark:border-indigo-800/70 bg-indigo-50/55 dark:bg-indigo-950/40 px-3.5 py-2.5 flex items-start gap-2 text-xs sm:text-sm text-indigo-950 dark:text-indigo-100">
                      <Info className="w-4 h-4 shrink-0 mt-0.5 text-indigo-600 dark:text-indigo-400" aria-hidden="true" />
                      <p className="leading-relaxed">
                        <strong className="font-bold">Catatan: </strong>
                        {pattern.notes}
                      </p>
                    </div>
                  ) : null}

                  {pattern.warnings ? (
                    <div className="rounded-xl border border-amber-200 dark:border-amber-800/80 bg-amber-50/75 dark:bg-amber-950/40 px-3.5 py-2.5 flex items-start gap-2 text-xs sm:text-sm text-amber-950 dark:text-amber-100">
                      <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" aria-hidden="true" />
                      <p className="leading-relaxed">
                        <strong className="font-bold">Perhatian: </strong>
                        {pattern.warnings}
                      </p>
                    </div>
                  ) : null}

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                        Contoh Kalimat / Reibun ({pattern.examples.length})
                      </p>
                      <button
                        type="button"
                        onClick={() => onOpenInFlashcard(pattern)}
                        className="text-xs font-semibold text-indigo-700 dark:text-indigo-300 hover:underline inline-flex items-center gap-1 cursor-pointer"
                      >
                        <Layers className="w-3.5 h-3.5" aria-hidden="true" />
                        Latih di Flashcard
                      </button>
                    </div>

                    <div className="grid grid-cols-1 gap-2">
                      {pattern.examples.map((ex, idx) => (
                        <div
                          key={idx}
                          className="rounded-xl border border-slate-200/85 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/45 px-3.5 py-2.5 flex items-start justify-between gap-3"
                        >
                          <div className="min-w-0 flex-1">
                            <div className="text-sm sm:text-[15px] font-medium text-slate-900 dark:text-slate-50">
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
                            label={`Putar reibun ${idx + 1}`}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : null}
            </article>
          );
        })}

        {filtered.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-8 text-center text-sm text-slate-500 dark:text-slate-400">
            Tidak ada pola yang cocok dengan kata kunci &ldquo;{query}&rdquo;.
          </div>
        ) : null}
      </div>
    </div>
  );
}
