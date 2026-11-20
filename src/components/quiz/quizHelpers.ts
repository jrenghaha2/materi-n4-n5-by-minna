import type { BookId, QuizMode } from '../../types/bunpou';

export interface ChapterPreset {
  label: string;
  from: number;
  to: number;
}

export const CHAPTER_PRESETS_BY_BOOK: Record<BookId, ChapterPreset[]> = {
  n5: [
    { label: 'Semua (1–25)', from: 1, to: 25 },
    { label: 'Bab 1–8', from: 1, to: 8 },
    { label: 'Bab 9–17', from: 9, to: 17 },
    { label: 'Bab 18–25', from: 18, to: 25 },
  ],
  n4: [
    { label: 'Semua (26–50)', from: 26, to: 50 },
    { label: 'Bab 26–33', from: 26, to: 33 },
    { label: 'Bab 34–42', from: 34, to: 42 },
    { label: 'Bab 43–50', from: 43, to: 50 },
  ],
};

export const QUIZ_MODE_INFO: Record<
  QuizMode,
  { title: string; subtitle: string; badge: string }
> = {
  meaning: {
    title: 'Tebak Arti',
    subtitle: 'Diberi pola tata bahasa Jepang, pilih arti Indonesia yang tepat.',
    badge: 'Pola → Arti',
  },
  cloze: {
    title: 'Lengkapi Kalimat',
    subtitle: 'Lengkapi bagian rumpang (　　) pada contoh kalimat reibun.',
    badge: 'Cloze Reibun',
  },
  pattern: {
    title: 'Tebak Pola',
    subtitle: 'Diberi arti Indonesia, pilih pola bunpou Jepang yang sesuai.',
    badge: 'Arti → Pola',
  },
};

export function getScoreFeedback(accuracy: number): { title: string; toneClass: string } {
  if (accuracy >= 90) {
    return {
      title: 'Luar Biasa! Penguasaan Sangat Kuat',
      toneClass: 'text-emerald-700 dark:text-emerald-300',
    };
  }
  if (accuracy >= 70) {
    return {
      title: 'Bagus! Terus Pertahankan Ritme Belajar',
      toneClass: 'text-indigo-700 dark:text-indigo-300',
    };
  }
  return {
    title: 'Perlu Latihan Lagi — Tinjau Pola yang Salah',
    toneClass: 'text-amber-700 dark:text-amber-300',
  };
}
