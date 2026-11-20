import { BookOpen, Flame, GraduationCap, Info } from 'lucide-react';
import { MINNA_ABBREVIATIONS, MINNA_BOOKS } from '../data/minnaDataset';
import type { AllBooksProgress } from '../types/bunpou';

interface AbbreviationsViewProps {
  booksProgress: AllBooksProgress;
  currentStreak: number;
  todayMasteredCount: number;
  dailyGoal: number;
}

export function AbbreviationsView({
  booksProgress,
  currentStreak,
  todayMasteredCount,
  dailyGoal,
}: AbbreviationsViewProps) {
  const totalPatterns = MINNA_BOOKS.reduce((sum, b) => sum + b.totalPatterns, 0);
  const totalReibun = MINNA_BOOKS.reduce(
    (sum, b) => sum + b.patterns.reduce((s, p) => s + p.examples.length, 0),
    0
  );
  const totalMastered =
    booksProgress.n5.mastered.size + booksProgress.n4.mastered.size;

  return (
    <div className="space-y-5">
      {/* Overview summary */}
      <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4">
        <div className="flex items-start gap-3">
          <GraduationCap
            className="w-5 h-5 text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5"
            aria-hidden="true"
          />
          <div>
            <h2 className="text-base font-extrabold text-slate-900 dark:text-slate-50">
              Tentang Materi N4 N5 by Minna (JLPT N5 &amp; N4)
            </h2>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
              Aplikasi ini menyusun seluruh materi tata bahasa (Bunpou) dari seri{' '}
              <strong>Minna no Nihongo I (Bab 1–25 · JLPT N5)</strong> dan{' '}
              <strong>Minna no Nihongo II (Bab 26–50 · JLPT N4)</strong> lengkap dengan
              rumus berwarna, catatan penting, peringatan kesalahan umum, serta{' '}
              <strong className="font-mono-num">{totalReibun}</strong> contoh kalimat (reibun)
              ber-Furigana dan audio pengucapan bahasa Jepang.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/75 dark:bg-slate-800/50 p-3.5">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 dark:text-slate-400">
              <BookOpen className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" aria-hidden="true" />
              Total Penguasaan N5 + N4
            </div>
            <p className="mt-1 text-xl font-extrabold font-mono-num text-slate-900 dark:text-slate-50">
              {totalMastered} / {totalPatterns}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              N5: {booksProgress.n5.mastered.size}/{MINNA_BOOKS[0].totalPatterns} · N4:{' '}
              {booksProgress.n4.mastered.size}/{MINNA_BOOKS[1].totalPatterns}
            </p>
          </div>

          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/75 dark:bg-slate-800/50 p-3.5">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 dark:text-slate-400">
              <Flame className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" aria-hidden="true" />
              Konsistensi Harian
            </div>
            <p className="mt-1 text-xl font-extrabold font-mono-num text-slate-900 dark:text-slate-50">
              {currentStreak} hari
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Hari ini: {todayMasteredCount}/{dailyGoal} pola hafal
            </p>
          </div>

          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/75 dark:bg-slate-800/50 p-3.5">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 dark:text-slate-400">
              <Info className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" aria-hidden="true" />
              Bank Contoh Kalimat
            </div>
            <p className="mt-1 text-xl font-extrabold font-mono-num text-slate-900 dark:text-slate-50">
              {totalReibun} reibun
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              4 variasi konteks di setiap pola bunpou
            </p>
          </div>
        </div>
      </section>

      {/* Abbreviations & Conjugation Glossary */}
      <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800">
          <h2 className="text-base font-extrabold text-slate-900 dark:text-slate-50">
            Panduan Singkatan &amp; Bentuk Konjugasi
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Daftar simbol kelas kata dan bentuk perubahan kata kerja yang digunakan pada rumus tata bahasa.
          </p>
        </div>

        <div className="divide-y divide-slate-100 dark:divide-slate-800">
          {MINNA_ABBREVIATIONS.map(item => (
            <div
              key={item.code}
              className="px-5 py-3.5 grid grid-cols-1 md:grid-cols-12 gap-1.5 md:gap-4 items-baseline"
            >
              <div className="md:col-span-3">
                <span className="inline-block px-2 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-950/70 border border-indigo-200/80 dark:border-indigo-800/80 text-indigo-800 dark:text-indigo-200 font-bold text-xs font-jp">
                  {item.code}
                </span>
              </div>
              <div className="md:col-span-4 text-sm font-semibold text-slate-900 dark:text-slate-100">
                {item.meaning}
              </div>
              <div className="md:col-span-5 text-xs sm:text-sm font-jp text-slate-600 dark:text-slate-300">
                {item.example}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
