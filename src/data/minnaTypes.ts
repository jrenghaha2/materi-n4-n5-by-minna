import type {
  BookData,
  BookId,
  BunpouPattern,
  ChapterData,
  ExampleSentence,
} from '../types/bunpou';

export interface RawPatternDef {
  title: string;
  formulas: string[];
  meaning: string;
  notes?: string;
  warnings?: string;
  examples: ExampleSentence[];
}

export interface RawChapterDef {
  chapter: number;
  dayNumber: number;
  chapterTitle: string;
  patterns: RawPatternDef[];
}

export interface MinnaBookMeta {
  id: BookId;
  shortTitle: string;
  fullTitle: string;
  japaneseSubtitle: string;
  level: string;
  badgeLabel: string;
}

export function buildMinnaBook(
  meta: MinnaBookMeta,
  rawChapters: RawChapterDef[]
): BookData {
  const chapters: ChapterData[] = rawChapters.map(ch => {
    const patterns: BunpouPattern[] = ch.patterns.map((p, idx) => ({
      id: `${meta.id}-bab-${ch.chapter}-p${idx + 1}`,
      bookId: meta.id,
      chapter: ch.chapter,
      dayNumber: ch.dayNumber,
      chapterTitle: ch.chapterTitle,
      title: p.title,
      formulas: [...p.formulas],
      meaning: p.meaning,
      notes: p.notes,
      warnings: p.warnings,
      examples: p.examples.map(ex => ({
        japanese: ex.japanese,
        indonesian: ex.indonesian,
      })),
    }));

    return {
      chapter: ch.chapter,
      dayNumber: ch.dayNumber,
      chapterTitle: ch.chapterTitle,
      patterns,
    };
  });

  const allPatterns = chapters.flatMap(c => c.patterns);

  return {
    id: meta.id,
    shortTitle: meta.shortTitle,
    fullTitle: meta.fullTitle,
    japaneseSubtitle: meta.japaneseSubtitle,
    level: meta.level,
    badgeLabel: meta.badgeLabel,
    chapters,
    patterns: allPatterns,
    totalPatterns: allPatterns.length,
  };
}
