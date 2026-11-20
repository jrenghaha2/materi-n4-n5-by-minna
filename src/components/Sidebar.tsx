import { useMemo, useState } from 'react';
import { BookMarked, Check, Flag, Layers, Search, X } from 'lucide-react';
import type { BookData, FilterMode } from '../types/bunpou';

interface SidebarProps {
  book: BookData;
  selectedChapter: number | 'all';
  filterMode: FilterMode;
  masteredSet: Set<string>;
  difficultSet: Set<string>;
  mobileOpen: boolean;
  onSelectChapter: (chapter: number | 'all') => void;
  onChangeFilter: (mode: FilterMode) => void;
  onCloseMobile: () => void;
}

export function Sidebar({
  book,
  selectedChapter,
  filterMode,
  masteredSet,
  difficultSet,
  mobileOpen,
  onSelectChapter,
  onChangeFilter,
  onCloseMobile,
}: SidebarProps) {
  const [chapterQuery, setChapterQuery] = useState('');

  const chapterStats = useMemo(() => {
    const map = new Map<number, { total: number; mastered: number; difficult: number }>();
    for (const ch of book.chapters) {
      map.set(ch.chapter, { total: 0, mastered: 0, difficult: 0 });
    }
    for (const p of book.patterns) {
      const st = map.get(p.chapter);
      if (!st) continue;
      st.total += 1;
      if (masteredSet.has(p.id)) st.mastered += 1;
      if (difficultSet.has(p.id)) st.difficult += 1;
    }
    return map;
  }, [book, masteredSet, difficultSet]);

  const filteredChapters = useMemo(() => {
    const q = chapterQuery.trim().toLowerCase();
    if (!q) return book.chapters;
    return book.chapters.filter(
      ch =>
        String(ch.chapter).includes(q) ||
        `bab ${ch.chapter}`.includes(q) ||
        `hari ${ch.dayNumber}`.includes(q) ||
        ch.chapterTitle.toLowerCase().includes(q)
    );
  }, [book.chapters, chapterQuery]);

  const totalMastered = masteredSet.size;
  const totalDifficult = difficultSet.size;
  const totalUnmastered = Math.max(0, book.totalPatterns - totalMastered);

  const handleSelect = (chapter: number | 'all') => {
    onSelectChapter(chapter);
    onCloseMobile();
  };

  const sidebarContent = (
    <div className="flex flex-col h-full bg-white dark:bg-slate-900 lg:border lg:border-slate-200 dark:lg:border-slate-800 lg:rounded-2xl overflow-hidden">
      <div className="p-3.5 border-b border-slate-100 dark:border-slate-800 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-bold text-slate-900 dark:text-slate-50">
              Filter &amp; Daftar Bab
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {book.chapters.length} bab · {book.totalPatterns} pola tata bahasa
            </p>
          </div>
          <button
            type="button"
            onClick={onCloseMobile}
            aria-label="Tutup daftar bab"
            className="lg:hidden w-9 h-9 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-300 inline-flex items-center justify-center cursor-pointer"
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>

        {/* Status filter */}
        <div className="grid grid-cols-3 gap-1.5" role="group" aria-label="Filter status hafalan">
          <button
            type="button"
            id="btnFilterAll"
            aria-pressed={filterMode === 'all'}
            onClick={() => onChangeFilter('all')}
            className={`px-2 py-1.5 rounded-xl border text-xs font-semibold transition-colors cursor-pointer ${
              filterMode === 'all'
                ? 'bg-indigo-600 border-indigo-600 text-white'
                : 'bg-slate-50 dark:bg-slate-800/70 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            Semua ({book.totalPatterns})
          </button>
          <button
            type="button"
            id="btnFilterUnmastered"
            aria-pressed={filterMode === 'unmastered'}
            onClick={() => onChangeFilter('unmastered')}
            className={`px-2 py-1.5 rounded-xl border text-xs font-semibold transition-colors cursor-pointer ${
              filterMode === 'unmastered'
                ? 'bg-indigo-600 border-indigo-600 text-white'
                : 'bg-slate-50 dark:bg-slate-800/70 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            Belum ({totalUnmastered})
          </button>
          <button
            type="button"
            id="btnFilterDifficult"
            aria-pressed={filterMode === 'difficult'}
            onClick={() => onChangeFilter('difficult')}
            className={`px-2 py-1.5 rounded-xl border text-xs font-semibold transition-colors cursor-pointer ${
              filterMode === 'difficult'
                ? 'bg-amber-600 border-amber-600 text-white'
                : 'bg-slate-50 dark:bg-slate-800/70 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            Sulit ({totalDifficult})
          </button>
        </div>

        {/* Chapter quick search */}
        <div className="relative">
          <Search
            className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
            aria-hidden="true"
          />
          <input
            type="search"
            value={chapterQuery}
            onChange={e => setChapterQuery(e.target.value)}
            placeholder="Cari bab atau topik..."
            aria-label="Cari bab"
            className="w-full h-9 pl-8 pr-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-xs text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-2 focus:outline-indigo-500"
          />
        </div>
      </div>

      {/* Scrollable chapter list */}
      <nav aria-label="Navigasi bab" className="flex-1 overflow-y-auto p-2 space-y-1 max-h-[68vh] lg:max-h-[70vh]">
        <button
          type="button"
          id="btnChapterAll"
          aria-current={selectedChapter === 'all' ? 'true' : undefined}
          onClick={() => handleSelect('all')}
          className={`w-full text-left px-3 py-2.5 rounded-xl border transition-colors cursor-pointer flex items-center justify-between gap-2 ${
            selectedChapter === 'all'
              ? 'bg-indigo-50 dark:bg-indigo-950/60 border-indigo-300 dark:border-indigo-700 text-indigo-950 dark:text-indigo-50 font-bold'
              : 'bg-transparent border-transparent text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/70'
          }`}
        >
          <span className="inline-flex items-center gap-2 text-xs sm:text-sm truncate">
            <Layers className="w-4 h-4 shrink-0 text-indigo-600 dark:text-indigo-400" aria-hidden="true" />
            <span>Semua Bab ({book.chapters[0]?.chapter}–{book.chapters[book.chapters.length - 1]?.chapter})</span>
          </span>
          <span className="text-xs font-mono-num text-slate-500 dark:text-slate-400 shrink-0">
            {totalMastered}/{book.totalPatterns}
          </span>
        </button>

        {filteredChapters.map(ch => {
          const st = chapterStats.get(ch.chapter) ?? { total: 0, mastered: 0, difficult: 0 };
          const isActive = selectedChapter === ch.chapter;
          const isDone = st.total > 0 && st.mastered === st.total;

          return (
            <button
              key={ch.chapter}
              type="button"
              id={`btnChapter-${ch.chapter}`}
              aria-current={isActive ? 'true' : undefined}
              onClick={() => handleSelect(ch.chapter)}
              className={`w-full text-left px-3 py-2 rounded-xl border transition-colors cursor-pointer ${
                isActive
                  ? 'bg-indigo-50 dark:bg-indigo-950/60 border-indigo-300 dark:border-indigo-700 text-indigo-950 dark:text-indigo-50'
                  : 'bg-transparent border-transparent text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/70'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="text-xs font-mono-num font-bold text-indigo-700 dark:text-indigo-300 shrink-0">
                    Bab {ch.chapter}
                  </span>
                  <span className="text-[11px] text-slate-400 dark:text-slate-500 shrink-0">
                    · Hari {ch.dayNumber}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  {st.difficult > 0 ? (
                    <span
                      className="inline-flex items-center gap-0.5 text-[11px] font-mono-num font-semibold text-amber-700 dark:text-amber-300"
                      title={`${st.difficult} pola sulit`}
                    >
                      <Flag className="w-3 h-3" aria-hidden="true" />
                      {st.difficult}
                    </span>
                  ) : null}
                  <span
                    className={`text-[11px] font-mono-num font-semibold inline-flex items-center gap-0.5 ${
                      isDone
                        ? 'text-emerald-700 dark:text-emerald-400'
                        : 'text-slate-500 dark:text-slate-400'
                    }`}
                  >
                    {isDone ? <Check className="w-3 h-3" aria-hidden="true" /> : null}
                    {st.mastered}/{st.total}
                  </span>
                </div>
              </div>
              <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-300 font-jp truncate">
                {ch.chapterTitle}
              </p>
            </button>
          );
        })}

        {filteredChapters.length === 0 ? (
          <div className="py-8 text-center text-xs text-slate-500 dark:text-slate-400 space-y-1">
            <BookMarked className="w-5 h-5 mx-auto opacity-50" aria-hidden="true" />
            <p>Bab tidak ditemukan.</p>
          </div>
        ) : null}
      </nav>
    </div>
  );

  return (
    <>
      <aside className="hidden lg:block w-72 xl:w-80 shrink-0">{sidebarContent}</aside>

      {mobileOpen ? (
        <div
          className="fixed inset-0 z-40 lg:hidden bg-slate-900/50 backdrop-blur-xs flex"
          onClick={e => {
            if (e.target === e.currentTarget) onCloseMobile();
          }}
        >
          <div className="w-80 max-w-[88vw] h-full shadow-2xl">{sidebarContent}</div>
        </div>
      ) : null}
    </>
  );
}
