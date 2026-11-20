import { BookOpen } from 'lucide-react';
import type { AllBooksProgress, BookData, BookId } from '../types/bunpou';

interface MinnaBookMenuProps {
  books: BookData[];
  activeBookId: BookId;
  booksProgress: AllBooksProgress;
  onSelectBook: (bookId: BookId) => void;
}

const BOOK_ACCENTS: Record<
  BookId,
  { levelText: string; activeRing: string; bar: string }
> = {
  n5: {
    levelText: 'text-indigo-700 dark:text-indigo-300',
    activeRing:
      'bg-indigo-50/75 dark:bg-indigo-950/55 border-indigo-500 dark:border-indigo-500/80 text-slate-900 dark:text-slate-50 shadow-xs',
    bar: 'bg-indigo-600 dark:bg-indigo-400',
  },
  n4: {
    levelText: 'text-teal-700 dark:text-teal-300',
    activeRing:
      'bg-teal-50/75 dark:bg-teal-950/55 border-teal-500 dark:border-teal-500/80 text-slate-900 dark:text-slate-50 shadow-xs',
    bar: 'bg-teal-600 dark:bg-teal-400',
  },
};

export function MinnaBookMenu({
  books,
  activeBookId,
  booksProgress,
  onSelectBook,
}: MinnaBookMenuProps) {
  return (
    <section
      aria-label="Pilih buku Minna no Nihongo"
      className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-2 sm:p-2.5 shadow-xs"
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        {books.map(book => {
          const isActive = book.id === activeBookId;
          const bucket = booksProgress[book.id];
          const masteredCount = bucket?.mastered.size ?? 0;
          const difficultCount = bucket?.difficult.size ?? 0;
          const total = book.totalPatterns;
          const pct = total > 0 ? Math.round((masteredCount / total) * 100) : 0;
          const accent = BOOK_ACCENTS[book.id];

          return (
            <button
              key={book.id}
              type="button"
              id={`btnBook-${book.id}`}
              aria-pressed={isActive}
              onClick={() => onSelectBook(book.id)}
              className={`w-full text-left rounded-xl border px-4 py-3 transition-all cursor-pointer focus-visible:outline-2 focus-visible:outline-indigo-500 ${
                isActive
                  ? accent.activeRing
                  : 'bg-slate-50/70 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-100/80 dark:hover:bg-slate-800/80'
              }`}
            >
              <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-0.5">
                <div className="flex items-center gap-2 shrink-0">
                  <BookOpen
                    className={`w-4 h-4 shrink-0 ${
                      isActive ? accent.levelText : 'text-slate-400 dark:text-slate-500'
                    }`}
                    aria-hidden="true"
                  />
                  <span className="font-bold text-sm sm:text-[15px]">
                    {book.shortTitle}
                  </span>
                </div>
                <span className={`text-[11px] sm:text-xs font-bold ${accent.levelText}`}>
                  {book.level} · {book.badgeLabel}
                </span>
              </div>

              <div className="mt-1 flex items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
                <span className="font-jp truncate">{book.japaneseSubtitle}</span>
                <span className="font-mono-num font-semibold shrink-0 text-slate-700 dark:text-slate-300">
                  {masteredCount}/{total} hafal ({pct}%)
                  {difficultCount > 0 ? ` · ${difficultCount} sulit` : ''}
                </span>
              </div>

              <div className="mt-2 h-1.5 rounded-full bg-slate-200/85 dark:bg-slate-700/80 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-300 ${accent.bar}`}
                  style={{ width: `${pct}%` }}
                />
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}
