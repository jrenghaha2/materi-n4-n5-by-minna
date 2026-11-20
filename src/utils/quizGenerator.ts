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

/**
 * Pure Japanese spoiler-free quiz labels for patterns whose study title contains
 * Indonesian descriptive words (e.g., "Cara membentuk...", "Bentuk negatif...",
 * "Pasif...", "Kausatif...", "Kata tanya...").
 */
const PURE_JAPANESE_QUIZ_LABELS: Record<string, string> = {
  'n5-bab-4-p3': '〜{時|じ}に / 〜{曜日|ようび}に',
  'n5-bab-5-p1': '〜へ {行|い}きます / {来|き}ます / {帰|かえ}ります',
  'n5-bab-5-p3': '〜で ({行|い}きます / {来|き}ます / {帰|かえ}ります)',
  'n5-bab-5-p4': '〜と (〜ます)',
  'n5-bab-6-p1': 'KB を + KK',
  'n5-bab-7-p1': 'KB で + KK',
  'n5-bab-8-p1': '〜は [KS-い / KS-な] です',
  'n5-bab-8-p2': '〜くないです / 〜じゃありません',
  'n5-bab-10-p2': '〜に 〜が あります／います',
  'n5-bab-10-p3': '〜は 〜に あります／います',
  'n5-bab-10-p4': '{位置|いち}の {言葉|ことば}',
  'n5-bab-11-p2': 'KB を + [数量] + KK',
  'n5-bab-11-p4': '〜に 〜{回|かい}',
  'n5-bab-12-p1': '〜でした / 〜かったです',
  'n5-bab-14-p1': 'て{形|けい}',
  'n5-bab-16-p2': '〜くて / 〜で',
  'n5-bab-17-p1': 'ない{形|けい}',
  'n5-bab-18-p1': '{辞書形|じしょけい}',
  'n5-bab-19-p1': 'た{形|けい}',
  'n5-bab-20-p1': '〜ます → {普通形|ふつうけい} (KK)',
  'n5-bab-20-p2': '〜です → だ / じゃない / だった',
  'n5-bab-20-p3': '{普通体|ふつうたい}の {会話|かいわ}',
  'n5-bab-22-p1': '[F.Biasa] + KB',
  'n5-bab-22-p2': '[F.Biasa + KB] は／を／が／に',
  'n5-bab-23-p2': 'F.Kamus とき vs F.た とき',
  'n4-bab-26-p3': 'どう / どこ / いつ + 〜たら いいですか',
  'n4-bab-27-p1': '{可能形|かのうけい}',
  'n4-bab-27-p4': '〜しか + 〜ません / 〜ない',
  'n4-bab-29-p1': 'KB が KK-ています',
  'n4-bab-29-p2': '{他動詞|たどうし}・{自動詞|じどうし}',
  'n4-bab-30-p3': 'まだ + 〜ます / 〜ています',
  'n4-bab-31-p1': '{意向形|いこうけい} 〜(よ)う',
  'n4-bab-33-p1': '{命令形|めいれいけい}・{禁止形|きんしけい}',
  'n4-bab-34-p3': 'KK1-て + KK2',
  'n4-bab-35-p1': '〜ば ({条件形|じょうけんけい})',
  'n4-bab-35-p2': 'どう / どこ / だれ + 〜ば いいですか',
  'n4-bab-37-p1': '{受身形|うけみけい} (〜れます / 〜られます)',
  'n4-bab-37-p2': '{迷惑|めいわく}の {受身|うけみ}',
  'n4-bab-37-p3': '〜によって + {受身形|うけみけい}',
  'n4-bab-40-p1': 'いつ / どこ / だれ + 〜か',
  'n4-bab-42-p3': '[数量] + は / も',
  'n4-bab-48-p1': '{使役形|しえきけい} (〜せます / 〜させます)',
  'n4-bab-48-p2': '〜を / 〜に + {使役形|しえきけい}',
  'n4-bab-49-p1': '〜れます / 〜られます ({尊敬語|そんけいご})',
  'n4-bab-49-p3': '{特別|とくべつ}な {尊敬語|そんけいご}',
  'n4-bab-50-p2': '{特別|とくべつ}な {謙譲語|けんじょうご}',
};

/**
 * Strips Indonesian parenthetical clues/spoilers (e.g. "(tujuan / agar)",
 * "(katanya / dari informasi)", "(pengandaian)") so quiz prompts and choices
 * never give away the answer before the learner selects.
 */
export function getQuizPatternLabel(pattern: BunpouPattern): string {
  const override = PURE_JAPANESE_QUIZ_LABELS[pattern.id];
  if (override) return override;

  // Strip any parenthetical block containing Latin letters (Indonesian explanation hints)
  return pattern.title
    .replace(/\s*[（(][^）)]*[A-Za-z][^）)]*[）)]/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

export function shuffleArray<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

const CLOZE_GENERIC_STOPWORDS = new Set([
  'わたしは',
  'わたしに',
  'わたし',
  'です',
  'ます',
  'ません',
  'ました',
  'します',
  'ない',
  'いる',
  'ある',
  'なる',
  'する',
]);

/**
 * Explicit cloze grammar targets for patterns whose title is a category/form name
 * or whose examples conjugate the target suffix (e.g. passive past られました,
 * causative せました, keigo verbs, relative clauses, etc.).
 */
const EXTRA_CLOZE_TARGETS: Record<string, string[]> = {
  'n5-bab-1-p1': ['です'],
  'n5-bab-1-p4': ['も'],
  'n5-bab-2-p3': ['のです', 'の'],
  'n5-bab-4-p2': ['ませんでした', 'ました', 'ません', 'ます'],
  'n5-bab-8-p1': ['です'],
  'n5-bab-8-p2': ['くありません', 'くないです', 'じゃありません'],
  'n5-bab-8-p3': ['な'],
  'n5-bab-10-p4': ['の上', 'の下', 'の前', 'の後ろ', 'の中', 'の外', 'の隣', 'の近く', 'の間'],
  'n5-bab-11-p1': ['ひとつ', 'ふたつ', 'みっつ', 'よっつ', 'いつつ', '人', '枚', '台', '本', '冊'],
  'n5-bab-11-p2': ['ひとつ', 'ふたつ', 'みっつ', '2枚', '3本', '4台', '5人', '2個', '3個'],
  'n5-bab-12-p1': ['じゃありませんでした', 'くなかったです', 'かったです', 'でした'],
  'n5-bab-14-p1': ['書いて', '飲んで', '食べて', '行って', '見て', '来て', 'して', 'て'],
  'n5-bab-16-p2': ['くて', 'で'],
  'n5-bab-17-p1': ['かない', 'まない', 'べない', 'しない', 'こない', 'ない'],
  'n5-bab-18-p1': ['泳ぐ', '弾く', '食べる', '行く', '読む', '書く', '作る', 'する', 'くる'],
  'n5-bab-19-p1': ['書いた', '飲んだ', '食べた', '行った', '見た', '来た', 'した', 'た'],
  'n5-bab-20-p1': ['行く', '行かない', '行った', '行かなかった', '食べる', '食べない', '食べた', '見る', '飲む'],
  'n5-bab-20-p2': ['だった', 'じゃない', '高かった', '高くない', 'だ'],
  'n5-bab-22-p1': ['買った', '住んでいる', '作った', '撮った', '着ている', 'もらった', '読む'],
  'n5-bab-22-p2': ['買った', '作った', '住んでいる', '撮った', '着ている', 'もらった'],
  'n5-bab-24-p1': ['くれました', 'くれます'],
  'n5-bab-24-p3': ['てもらいました', 'てもらいます', 'でもらいました'],
  'n5-bab-24-p4': ['てくれました', 'てくれます', 'でくれました'],
  'n4-bab-27-p1': ['話せます', '読めます', '食べられます', '行けます', '作れます', 'できます', 'こられます'],
  'n4-bab-29-p1': ['開いています', '閉まっています', '壊れています', '汚れています', '割れています', 'ついています', '消えています'],
  'n4-bab-29-p2': ['開いています', '閉まっています', '壊れています', 'ついています', '開けます', '閉めます', 'つけます', '消します'],
  'n4-bab-32-p3': ['かもしれません', 'かも しれません'],
  'n4-bab-33-p1': ['急げ', '食べろ', 'しろ', 'こい', '入るな', '触るな', '止まれ', '頑張れ', 'な'],
  'n4-bab-33-p4': ['と言っていました', 'と言って いました'],
  'n4-bab-33-p5': ['と伝えていただけませんか', 'と伝えて いただけませんか'],
  'n4-bab-35-p1': ['行けば', '安ければ', 'なければ', '食べれば', '読めば', '見れば', 'あれば', 'すれば', 'ば'],
  'n4-bab-37-p1': ['ほめられました', '叱られました', '誘われました', '頼まれました', '呼ばれました', 'られました', 'れました'],
  'n4-bab-37-p2': ['踏まれました', '降られました', '壊されました', '盗まれました', '読まれました', 'られました', 'れました'],
  'n4-bab-37-p3': ['によって', '開かれます', '建てられました', '使われています', '発明されました', '書かれました', 'られました', 'れました'],
  'n4-bab-41-p1': ['くださいました', 'くださいます', 'いただきました', 'いただきます', 'やりました', 'やります'],
  'n4-bab-41-p2': ['てくださいました', 'てくださいます', 'てくれました', 'てくれます', 'でくださいました'],
  'n4-bab-44-p3': ['くします', 'くしました', 'にします', 'にしました'],
  'n4-bab-44-p4': ['にします', 'にしました'],
  'n4-bab-48-p1': ['行かせます', '行かせました', '食べさせます', '留学させました', '待たせました', 'させます', 'させました', 'せます', 'せました'],
  'n4-bab-49-p1': ['読まれます', '行かれます', '帰られました', '書かれました', '来られました', 'られます', 'られました', 'れます', 'れました'],
  'n4-bab-49-p2': ['になります', 'になりました', 'に なります', 'に なりました'],
  'n4-bab-49-p3': ['いらっしゃいます', 'いらっしゃいました', '召し上がります', '召し上がりました', 'おっしゃいます', 'おっしゃいました', 'なさいます', 'ご覧になります', 'ご存じです'],
  'n4-bab-50-p1': ['お持ちします', 'お送りします', 'ご案内します', 'ご説明します', 'お電話します', 'お手伝いします'],
  'n4-bab-50-p2': ['まいります', 'まいりました', 'おります', 'いただきます', 'いただきました', '申します', '拝見します', '拝見しました', 'いたします', 'お目にかかります'],
};

function expandConjugationVariants(token: string): string[] {
  const variants = [token];
  if (token.endsWith('ます') && token.length >= 3) {
    const stem = token.slice(0, -2);
    variants.push(`${stem}ました`, `${stem}ません`, `${stem}ませんでした`, `${stem}ましょう`, `${stem}ますか`);
  }
  if (token.endsWith('です') && token.length >= 3) {
    const stem = token.slice(0, -2);
    variants.push(`${stem}でした`, `${stem}ですか`, `${stem}ですよ`);
  }
  if (token.startsWith('て') && token.length >= 3) {
    variants.push(`で${token.slice(1)}`);
  }
  return variants;
}

/**
 * Extracts clean Japanese grammar fragments from Minna titles & formulas for cloze matching.
 */
export function extractGrammarTargets(pattern: BunpouPattern): string[] {
  const extras = EXTRA_CLOZE_TARGETS[pattern.id] ?? [];
  const rawCandidates: string[] = [
    stripFuriganaMarkup(getQuizPatternLabel(pattern)),
    stripFuriganaMarkup(pattern.title),
    ...pattern.formulas,
  ];

  const targets: string[] = [];
  const seen = new Set<string>();

  const pushCandidate = (piece: string) => {
    const compact = piece.replace(/\s+/g, '');
    if (!compact || !/[\u3040-\u309f\u30a0-\u30ff\u4e00-\u9faf]/.test(compact)) return;
    for (const v of expandConjugationVariants(compact)) {
      if (!seen.has(v)) {
        seen.add(v);
        targets.push(v);
      }
    }
  };

  // Prioritize explicit pattern-specific targets first
  for (const e of extras) {
    pushCandidate(e);
  }

  for (const raw of rawCandidates) {
    const cleaned = raw
      .replace(/（[^）]*）/g, ' ')
      .replace(/\([^)]*\)/g, ' ')
      .replace(
        /\b(?:KB|KK|KS)[12]?(?:-[いな])?\b|\bG[123]\b|\bF\.(?:ます|て|ない|Kamus|た|Biasa|Potensial|Niat|Perintah|Larangan|ば|Pasif|Kausatif|ている)\b/g,
        ' '
      )
      .replace(
        /\b(?:Kalimat|Klausa|Kata\s+tanya|Tempat[12]?|Waktu[12]?|Orang(?:\s+Lain)?|Atasan|Bawahan|Hewan|Anak|Teman|Keluarga|Kendaraan|Alat|Bahasa|Periode|Jumlah|Angka|Kelompok|Sumber|Benda|Tumbuhan|Objek|Pelaku|Pencipta|Aksi|Hasil|Info|Saran|Usaha|Akibat|Umum|Negatif|Positif|Alasan|Berikutnya|Pasti|Cara|Bentuk|Lawan|Menyambung|Percakapan|Kasual|Transitif|Intransitif|Pasif|Kausatif|Hormat|Khusus|sopan|biasa|dari|dan|atau|untuk|di|ke|yang|dengan|tanpa|buang|ganti|bunyi|sama|seperti|pakai|oleh|pada|Bagian|Yang|Ditekankan|Penjelasan|Ucapan|Teks|Kutipan|Langsung|Kesimpulan|Non-volitional|Potensial)\b/gi,
        ' '
      )
      .replace(/[A-Za-z0-9・〜~＋+→⇔｜|／/「」『』\[\]：:。、？！?!]/g, ' ');

    // Also try joining adjacent Japanese chunks separated only by spaces (e.g. "に なります" -> "になります")
    const joinedChunks = cleaned
      .split(/\s{2,}/)
      .map(s => s.replace(/\s+/g, '').trim())
      .filter(s => s.length >= 2);
    for (const jc of joinedChunks) {
      if (!CLOZE_GENERIC_STOPWORDS.has(jc)) pushCandidate(jc);
    }

    const pieces = cleaned
      .split(/\s+/)
      .map(s => s.trim())
      .filter(s => s.length >= 1 && /[\u3040-\u309f\u30a0-\u30ff\u4e00-\u9faf]/.test(s));

    for (const p of pieces) {
      if (CLOZE_GENERIC_STOPWORDS.has(p) && extras.length > 0) continue;
      pushCandidate(p);
    }
  }

  // Keep explicit targets ahead when equal length, otherwise prefer longer distinctive fragments
  const extraSet = new Set(extras.map(e => e.replace(/\s+/g, '')));
  return targets.sort((a, b) => {
    const aStop = CLOZE_GENERIC_STOPWORDS.has(a) && !extraSet.has(a) ? 1 : 0;
    const bStop = CLOZE_GENERIC_STOPWORDS.has(b) && !extraSet.has(b) ? 1 : 0;
    if (aStop !== bStop) return aStop - bStop;
    const aExtra = extraSet.has(a) ? 1 : 0;
    const bExtra = extraSet.has(b) ? 1 : 0;
    if (aExtra !== bExtra) return bExtra - aExtra;
    return b.length - a.length;
  });
}

/**
 * Replaces a target substring inside a `{漢字|かな}` ruby-marked sentence with `（　　）`
 * WITHOUT breaking `{漢字|かな}` tags, matching cleanly even across spaces in Japanese text
 * (e.g., target "かもしれません" matches "かも しれません").
 */
export function buildRubySafeCloze(
  rubySentence: string,
  plainTarget: string
): { clozeMarkup: string; matchedText: string } | null {
  const cleanTarget = plainTarget.replace(/\s+/g, '');
  if (!cleanTarget) return null;

  const plainSentence = stripFuriganaMarkup(rubySentence);

  // Build index map from whitespace-stripped sentence back to original plainSentence indices
  const compactChars: string[] = [];
  const compactToPlainIdx: number[] = [];
  for (let i = 0; i < plainSentence.length; i += 1) {
    const ch = plainSentence[i];
    if (ch === ' ' || ch === '\u3000') continue;
    compactChars.push(ch);
    compactToPlainIdx.push(i);
  }
  const compactSentence = compactChars.join('');

  const compactIdx = compactSentence.indexOf(cleanTarget);
  if (compactIdx === -1) return null;

  const matchIdx = compactToPlainIdx[compactIdx];
  const matchEnd = compactToPlainIdx[compactIdx + cleanTarget.length - 1] + 1;
  const matchedText = plainSentence.slice(matchIdx, matchEnd);

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
    matchedText,
  };
}

/**
 * Finds the best cloze blanking for a given pattern and example sentence.
 */
export function buildClozeForExample(
  pattern: BunpouPattern,
  exampleJapanese: string
): { clozeMarkup: string; matchedText: string } | null {
  const targets = extractGrammarTargets(pattern);
  const hasMultiChar = targets.some(t => t.length >= 2);

  for (const t of targets) {
    if (t.length < 2 && hasMultiChar) continue;
    const res = buildRubySafeCloze(exampleJapanese, t);
    if (res) return res;
  }

  for (const t of targets) {
    const res = buildRubySafeCloze(exampleJapanese, t);
    if (res) return res;
  }

  return null;
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
  const nearby = sameLevel.filter(p => Math.abs(p.chapter - correct.chapter) <= 6);
  const pool = nearby.length >= count + 3 ? nearby : sameLevel;

  const picked: BunpouPattern[] = [];
  const usedLabels = new Set<string>([
    stripFuriganaMarkup(getQuizPatternLabel(correct)),
    stripFuriganaMarkup(correct.title),
    correct.meaning.toLowerCase(),
  ]);

  const tryAddFrom = (candidates: BunpouPattern[]) => {
    for (const candidate of shuffleArray(candidates)) {
      if (picked.some(item => item.id === candidate.id)) continue;
      const cleanQuizLabel = stripFuriganaMarkup(getQuizPatternLabel(candidate));
      const cleanTitle = stripFuriganaMarkup(candidate.title);
      const cleanMeaning = candidate.meaning.toLowerCase();
      if (
        usedLabels.has(cleanQuizLabel) ||
        usedLabels.has(cleanTitle) ||
        usedLabels.has(cleanMeaning)
      ) {
        continue;
      }
      usedLabels.add(cleanQuizLabel);
      usedLabels.add(cleanTitle);
      usedLabels.add(cleanMeaning);
      picked.push(candidate);
      if (picked.length === count) break;
    }
  };

  tryAddFrom(pool);
  if (picked.length < count) {
    tryAddFrom(sameLevel);
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
    const chosenExampleIdx =
      pattern.examples.length > 0 ? Math.floor(Math.random() * pattern.examples.length) : 0;
    const example = pattern.examples[chosenExampleIdx] ?? pattern.examples[0];
    const quizLabel = getQuizPatternLabel(pattern);

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
        // Pure Japanese pattern (no Indonesian clue!) + Japanese-only context sentence
        prompt: quizLabel,
        promptSub: example?.japanese,
        formulas: pattern.formulas,
        exampleIndex: chosenExampleIdx,
        exampleJapanese: example?.japanese,
        exampleIndonesian: example?.indonesian,
        choices,
        correctChoiceId: pattern.id,
        explanation: `${stripFuriganaMarkup(quizLabel)} — ${pattern.meaning}`,
      });
    } else if (options.mode === 'pattern') {
      const choices: QuizChoice[] = shuffleArray([pattern, ...distractors]).map(p => ({
        id: p.id,
        label: getQuizPatternLabel(p),
        subLabel: p.formulas.join(' / '),
        isJapanese: true,
      }));
      questions.push({
        id: `q-${i + 1}-${pattern.id}`,
        patternId: pattern.id,
        chapter: pattern.chapter,
        mode: 'pattern',
        prompt: pattern.meaning,
        promptSub: example?.indonesian,
        formulas: pattern.formulas,
        exampleIndex: chosenExampleIdx,
        exampleJapanese: example?.japanese,
        exampleIndonesian: example?.indonesian,
        choices,
        correctChoiceId: pattern.id,
        explanation: `${stripFuriganaMarkup(quizLabel)} (${pattern.formulas.join(' / ')})`,
      });
    } else {
      // Cloze mode: blank out grammar target in one of the 4 examples
      const shuffledIndices = shuffleArray(pattern.examples.map((_, idx) => idx));
      let clozeResult: { clozeMarkup: string; matchedText: string; exIdx: number } | null = null;

      for (const idx of shuffledIndices) {
        const candidateEx = pattern.examples[idx];
        const res = buildClozeForExample(pattern, candidateEx.japanese);
        if (res) {
          clozeResult = { ...res, exIdx: idx };
          break;
        }
      }

      const finalExIdx = clozeResult ? clozeResult.exIdx : chosenExampleIdx;
      const finalEx = pattern.examples[finalExIdx] ?? example;

      const choices: QuizChoice[] = shuffleArray([pattern, ...distractors]).map(p => ({
        id: p.id,
        label: getQuizPatternLabel(p),
        subLabel: p.formulas.join(' / '),
        isJapanese: true,
      }));

      questions.push({
        id: `q-${i + 1}-${pattern.id}`,
        patternId: pattern.id,
        chapter: pattern.chapter,
        mode: 'cloze',
        prompt: clozeResult ? clozeResult.clozeMarkup : finalEx.japanese,
        promptSub: finalEx.indonesian,
        formulas: pattern.formulas,
        exampleIndex: finalExIdx,
        exampleJapanese: finalEx.japanese,
        exampleIndonesian: finalEx.indonesian,
        choices,
        correctChoiceId: pattern.id,
        explanation: `${stripFuriganaMarkup(quizLabel)} — ${pattern.meaning}`,
      });
    }
  }

  return questions;
}
