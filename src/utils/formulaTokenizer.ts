export type FormulaTokenKind = 'pos' | 'form' | 'particle' | 'operator' | 'plain';

export interface FormulaToken {
  text: string;
  kind: FormulaTokenKind;
}

const PARTICLE_TOKENS = [
  'いただけませんか',
  'なければなりません',
  'なくてもいいです',
  'かもしれません',
  'てしまいました',
  'ようになりました',
  'ようにしています',
  'ようにしてください',
  'ことができます',
  'ことがあります',
  'てはいけません',
  'てもいいです',
  'ないでください',
  'てください',
  'ください',
  'てあげます',
  'てもらいます',
  'てくれます',
  'てくださいます',
  'ていただきました',
  'てやります',
  'てあります',
  'ておきます',
  'てきます',
  'てみます',
  'ています',
  'ていません',
  'でしょう',
  'はずです',
  'ようです',
  'そうです',
  'つもりです',
  '予定です',
  'ばかりです',
  'ところです',
  'ございます',
  'いらっしゃいます',
  '召し上がります',
  'おっしゃいます',
  'なさいます',
  'ご覧になります',
  'ご存じです',
  'まいります',
  'おります',
  'いただきます',
  '申します',
  '拝見します',
  'いたします',
  'お目にかかります',
  'くださいます',
  'あげます',
  'もらいます',
  'くれます',
  'やります',
  'じゃ\\s*ありません',
  'では\\s*ありません',
  'じゃありません',
  'ありません',
  'あります',
  'います',
  'いいです',
  'いけません',
  'なりません',
  'すぎます',
  'やすいです',
  'にくいです',
  'くなります',
  'になります',
  'く\\s*します',
  'に\\s*します',
  'ませんか',
  'ましょうか',
  'ましょう',
  'たいです',
  'ほしいです',
  'ながら',
  'とおりに',
  'あとで',
  'まえに',
  'までに',
  '途中で',
  '場合は',
  'かどうか',
  'という',
  'について',
  'によって',
  'によると',
  'より',
  'から',
  'まで',
  'ので',
  'のに',
  'たら',
  'ても',
  'でも',
  'なら',
  'しか',
  'など',
  'だけ',
  'とき',
  'ほど',
  'くらい',
  'ぐらい',
  'です',
  'は',
  'が',
  'を',
  'に',
  'へ',
  'で',
  'と',
  'も',
  'の',
  'や',
  'か',
  'し',
  'ば',
  'ね',
  'よ',
  'だ',
].sort((a, b) => b.replace(/\\s\*/g, ' ').length - a.replace(/\\s\*/g, ' ').length);

const MULTI_CHAR_PARTICLES = PARTICLE_TOKENS.filter(t => t.length > 1);
const SINGLE_CHAR_PARTICLES = PARTICLE_TOKENS.filter(t => t.length === 1);

const TOKEN_PATTERN = new RegExp(
  [
    // Grammar form & group badges (Minna notation)
    '(?:F\\.(?:ます|て|ない|Kamus|た|Biasa|Potensial|Niat|Perintah|Larangan|ば|Pasif|Kausatif|ている)|G[123]|(?:KK|KB|KS)[12]?(?:-[いな])?|Kalimat(?:\\s+(?:Alasan|Hasil|Positif|Negatif|1|2))?|Klausa|Kata\\s+tanya|Tempat[12]?|Waktu[12]?|Orang(?:\\s+Lain)?|Atasan|Bawahan|Hewan|Anak|Teman|Keluarga|Kendaraan|Alat|Bahasa|Periode|Jumlah|Angka|Kelompok|Sumber|Benda|Tumbuhan|Objek|Pelaku|Pencipta|Aksi\\s+Berikutnya|Hasil\\s+Pasti|Info|Saran|Usaha|Akibat|Umum)',
    // Operators & delimiters
    '(?:\\s*[+＋→⇔｜|／/]\\s*)',
    // Multi-character Japanese grammar particles & endings (longest match first)
    `(?:${MULTI_CHAR_PARTICLES.join('|')})`,
    // Single-character particles only when not embedded inside a hiragana word (e.g., avoid か inside かきます)
    `(?<![\\u3040-\\u309f])(?:${SINGLE_CHAR_PARTICLES.join('|')})(?![\\u3040-\\u309f])`,
  ].join('|'),
  'g'
);

const POS_REGEX =
  /^(?:(?:KK|KB|KS)[12]?(?:-[いな])?|Kalimat(?:\s+(?:Alasan|Hasil|Positif|Negatif|1|2))?|Klausa|Kata\s+tanya|Tempat[12]?|Waktu[12]?|Orang(?:\s+Lain)?|Atasan|Bawahan|Hewan|Anak|Teman|Keluarga|Kendaraan|Alat|Bahasa|Periode|Jumlah|Angka|Kelompok|Sumber|Benda|Tumbuhan|Objek|Pelaku|Pencipta|Aksi\s+Berikutnya|Hasil\s+Pasti|Info|Saran|Usaha|Akibat|Umum)$/;

const FORM_REGEX =
  /^(?:F\.(?:ます|て|ない|Kamus|た|Biasa|Potensial|Niat|Perintah|Larangan|ば|Pasif|Kausatif|ている)|G[123])$/;

const OPERATOR_REGEX = /^\s*[+＋→⇔｜|／/]\s*$/;

export function tokenizeFormula(formula: string): FormulaToken[] {
  if (!formula) return [];

  const tokens: FormulaToken[] = [];
  let lastIndex = 0;
  TOKEN_PATTERN.lastIndex = 0;

  let match: RegExpExecArray | null;
  while ((match = TOKEN_PATTERN.exec(formula)) !== null) {
    if (match.index > lastIndex) {
      tokens.push({
        text: formula.slice(lastIndex, match.index),
        kind: 'plain',
      });
    }
    const text = match[0];
    let kind: FormulaTokenKind = 'particle';
    if (OPERATOR_REGEX.test(text)) {
      kind = 'operator';
    } else if (FORM_REGEX.test(text)) {
      kind = 'form';
    } else if (POS_REGEX.test(text)) {
      kind = 'pos';
    }
    tokens.push({ text, kind });
    lastIndex = match.index + text.length;
  }

  if (lastIndex < formula.length) {
    tokens.push({
      text: formula.slice(lastIndex),
      kind: 'plain',
    });
  }

  return tokens;
}
