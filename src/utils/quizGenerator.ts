import type {
  BookId,
  BunpouPattern,
  QuizChoice,
  QuizMode,
  QuizQuestion,
} from '../types/bunpou';
import { buildRubySegments, stripFuriganaMarkup } from './furiganaConverter';

export interface QuizFilterOptions {
  bookId: BookId;
  mode: QuizMode;
  fromChapter: number;
  toChapter: number;
  questionCount: number;
  onlyDifficult: boolean;
  onlyUnmastered: boolean;
  masteredSet: Set<string>;
  difficultSet: Set<string>;
}

export function shuffleArray<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/**
 * Extracts clean Japanese grammar fragments from Minna titles & formulas for cloze matching.
 */
export function extractGrammarTargets(pattern: BunpouPattern): string[] {
  const rawCandidates: string[] = [
    stripFuriganaMarkup(pattern.title),
    ...pattern.formulas,
  ];

  const targets: string[] = [];
  const seen = new Set<string>();

  for (const raw of rawCandidates) {
    // Strip Indonesian grammar placeholders & Minna abbreviations
    const cleaned = raw
      .replace(/（[^）]*）/g, ' ')
      .replace(/\([^)]*\)/g, ' ')
      .replace(
        /\b(?:KB|KK|KS)[12]?(?:-[いな])?\b|\bG[123]\b|\bF\.(?:ます|て|ない|Kamus|た|Biasa|Potensial|Niat|Perintah|Larangan|ば|Pasif|Kausatif|ている)\b/g,
        ' '
      )
      .replace(
        /\b(?:Kalimat|Klausa|Kata\s+tanya|Tempat[12]?|Waktu[12]?|Orang(?:\s+Lain)?|Atasan|Bawahan|Hewan|Anak|Teman|Keluarga|Kendaraan|Alat|Bahasa|Periode|Jumlah|Angka|Kelompok|Sumber|Benda|Tumbuhan|Objek|Pelaku|Pencipta|Aksi|Hasil|Info|Saran|Usaha|Akibat|Umum|Negatif|Positif|Alasan|Berikutnya|Pasti|Cara|Bentuk|Lawan|Menyambung|Percakapan|Kasual|Transitif|Intransitif|Pasif|Kausatif|Hormat|Khusus|sopan|biasa|dari|dan|atau|untuk|di|ke|yang|dengan|tanpa|buang|ganti|bunyi|sama|seperti|pakai|oleh|pada)\b/gi,
        ' '
      )
      .replace(/[A-Za-z0-9・〜~＋+→⇔｜|／/「」『』\[\]：:。、？！?!]/g, ' ');

    const pieces = cleaned
      .split(/\s+/)
      .map(s => s.trim())
      .filter(s => s.length >= 1 && /[\u3040-\u309f\u30a0-\u30ff\u4e00-\u9faf]/.test(s));

    for (const p of pieces) {
      if (!seen.has(p)) {
        seen.add(p);
        targets.push(p);
      }
    }
  }

  // Prefer longer, more distinctive grammar fragments first
  return targets.sort((a, b) => b.length - a.length);
}

/**
 * Replaces a target substring inside a `{漢字|かな}` ruby-marked sentence with `（　　）`
 * WITHOUT breaking `{漢字|かな}` tags.
 */
export function buildRubySafeCloze(
  rubySentence: string,
  plainTarget: string
): { clozeMarkup: string; matchedText: string } | null {
  if (!plainTarget) return null;
  const plainSentence = stripFuriganaMarkup(rubySentence);
  const matchIdx = plainSentence.indexOf(plainTarget);
  if (matchIdx === -1) return null;

  const matchEnd = matchIdx + plainTarget.length;
  const segments = buildRubySegments(rubySentence);

  let cursor = 0;
  let result = '';
  let blankInserted = false;

  for (const seg of segments) {
    const segStart = cursor;
    const segEnd = cursor + seg.text.length;
    cursor = segEnd;

    const overlaps = segStart < matchEnd && segEnd > matchIdx;
    if (!overlaps) {
      result += seg.reading ? `{${seg.text}|${seg.reading}}` : seg.text;
      continue;
    }

    // Segment overlaps target range
    if (!seg.reading) {
      const beforeLen = Math.max(0, matchIdx - segStart);
      const afterStart = Math.max(0, matchEnd - segStart);
      if (beforeLen > 0) result += seg.text.slice(0, beforeLen);
      if (!blankInserted) {
        result += '（　　）';
        blankInserted = true;
      }
      if (afterStart < seg.text.length) result += seg.text.slice(afterStart);
    } else {
      // Ruby segment partially or wholly overlapped -> replace entire ruby atom cleanly
      if (!blankInserted) {
        result += '（　　）';
        blankInserted = true;
      }
    }
  }

  if (!blankInserted) return null;
  return {
    clozeMarkup: result,
    matchedText: plainTarget,
  };
}

export function filterQuizPool(
  patterns: BunpouPattern[],
  options: Pick<
    QuizFilterOptions,
    'fromChapter' | 'toChapter' | 'onlyDifficult' | 'onlyUnmastered' | 'masteredSet' | 'difficultSet'
  >
): BunpouPattern[] {
  const minCh = Math.min(options.fromChapter, options.toChapter);
  const maxCh = Math.max(options.fromChapter, options.toChapter);

  return patterns.filter(p => {
    if (p.chapter < minCh || p.chapter > maxCh) return false;
    if (options.onlyDifficult && !options.difficultSet.has(p.id)) return false;
    if (options.onlyUnmastered && options.masteredSet.has(p.id)) return false;
    return true;
  });
}

function pickDistractors(
  correct: BunpouPattern,
  allBookPatterns: BunpouPattern[],
  count: number
): BunpouPattern[] {
  const sameLevel = allBookPatterns.filter(p => p.id !== correct.id);
  const nearby = sameLevel.filter(p => Math.abs(p.chapter - correct.chapter) <= 5);
  const pool = nearby.length >= count + 2 ? nearby : sameLevel;

  const picked: BunpouPattern[] = [];
  const usedLabels = new Set<string>([
    stripFuriganaMarkup(correct.title),
    correct.meaning.toLowerCase(),
  ]);

  for (const candidate of shuffleArray(pool)) {
    const cleanTitle = stripFuriganaMarkup(candidate.title);
    const cleanMeaning = candidate.meaning.toLowerCase();
    if (usedLabels.has(cleanTitle) || usedLabels.has(cleanMeaning)) continue;
    usedLabels.add(cleanTitle);
    usedLabels.add(cleanMeaning);
    picked.push(candidate);
    if (picked.length === count) break;
  }

  if (picked.length < count) {
    for (const candidate of shuffleArray(sameLevel)) {
      if (picked.some(item => item.id === candidate.id)) continue;
      picked.push(candidate);
      if (picked.length === count) break;
    }
  }

  return picked;
}

export function generateQuizQuestions(
  allBookPatterns: BunpouPattern[],
  options: QuizFilterOptions
): QuizQuestion[] {
  const pool = filterQuizPool(allBookPatterns, options);
  if (pool.length === 0) return [];

  const selected = shuffleArray(pool).slice(0, Math.min(options.questionCount, pool.length));
  const questions: QuizQuestion[] = [];

  for (let i = 0; i < selected.length; i += 1) {
    const pattern = selected[i];
    const distractors = pickDistractors(pattern, allBookPatterns, 3);
    const example =
      pattern.examples[Math.floor(Math.random() * pattern.examples.length)] ??
      pattern.examples[0];

    if (options.mode === 'meaning') {
      const choices: QuizChoice[] = shuffleArray([pattern, ...distractors]).map(p => ({
        id: p.id,
        label: p.meaning,
        isJapanese: false,
      }));
      questions.push({
        id: `q-${i + 1}-${pattern.id}`,
        patternId: pattern.id,
        chapter: pattern.chapter,
        mode: 'meaning',
        prompt: pattern.title,
        promptSub: pattern.formulas[0],
        exampleJapanese: example?.japanese,
        exampleIndonesian: example?.indonesian,
        choices,
        correctChoiceId: pattern.id,
        explanation: `${stripFuriganaMarkup(pattern.title)} — ${pattern.meaning}`,
      });
    } else if (options.mode === 'pattern') {
      const choices: QuizChoice[] = shuffleArray([pattern, ...distractors]).map(p => ({
        id: p.id,
        label: p.title,
        subLabel: p.formulas[0],
        isJapanese: true,
      }));
      questions.push({
        id: `q-${i + 1}-${pattern.id}`,
        patternId: pattern.id,
        chapter: pattern.chapter,
        mode: 'pattern',
        prompt: pattern.meaning,
        promptSub: example?.indonesian,
        exampleJapanese: example?.japanese,
        exampleIndonesian: example?.indonesian,
        choices,
        correctChoiceId: pattern.id,
        explanation: `${stripFuriganaMarkup(pattern.title)} (${pattern.formulas[0]})`,
      });
    } else {
      // Cloze mode: blank out grammar target in one of the 4 examples
      const targets = extractGrammarTargets(pattern);
      let clozeResult: { clozeMarkup: string; matchedText: string; ex: typeof example } | null =
        null;

      for (const candidateEx of shuffleArray(pattern.examples)) {
        for (const t of targets) {
          if (t.length < 2 && targets.some(other => other.length >= 2)) continue;
          const res = buildRubySafeCloze(candidateEx.japanese, t);
          if (res) {
            clozeResult = { ...res, ex: candidateEx };
            break;
          }
        }
        if (clozeResult) break;
      }

      // Fallback single-char particle match if needed
      if (!clozeResult) {
        for (const candidateEx of shuffleArray(pattern.examples)) {
          for (const t of targets) {
            const res = buildRubySafeCloze(candidateEx.japanese, t);
            if (res) {
              clozeResult = { ...res, ex: candidateEx };
              break;
            }
          }
          if (clozeResult) break;
        }
      }

      const choices: QuizChoice[] = shuffleArray([pattern, ...distractors]).map(p => ({
        id: p.id,
        label: p.title,
        isJapanese: true,
      }));

      questions.push({
        id: `q-${i + 1}-${pattern.id}`,
        patternId: pattern.id,
        chapter: pattern.chapter,
        mode: 'cloze',
        prompt: clozeResult ? clozeResult.clozeMarkup : example.japanese,
        promptSub: clozeResult ? clozeResult.ex.indonesian : example.indonesian,
        exampleJapanese: clozeResult ? clozeResult.ex.japanese : example.japanese,
        exampleIndonesian: clozeResult ? clozeResult.ex.indonesian : example.indonesian,
        choices,
        correctChoiceId: pattern.id,
        explanation: `${stripFuriganaMarkup(pattern.title)} — ${pattern.meaning}`,
      });
    }
  }

  return questions;
}
