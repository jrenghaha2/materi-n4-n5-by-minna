export interface RubySegment {
  text: string;
  reading?: string;
}

const RUBY_MARKUP_REGEX = /\{([^{}|]+)\|([^{}|]+)\}/g;
const KANJI_CHAR_REGEX = /[\u4e00-\u9faf\u3400-\u4dbf々〆ヶ]/;
const KANJI_SPLIT_REGEX = /([\u4e00-\u9faf\u3400-\u4dbf々〆ヶ]+)/g;

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function kataToHira(str: string): string {
  return str.replace(/[\u30a1-\u30f6]/g, ch =>
    String.fromCharCode(ch.charCodeAt(0) - 0x60)
  );
}

function stripSpacesAndBrackets(str: string): string {
  return str.replace(/[\s\u3000[\]［］]/g, '');
}

/**
 * Aligns a Japanese surface string containing kanji + okurigana (e.g. `探します`, `間に合います`,
 * `勉強します`, `お休み`, `て形`) with its kana reading (`さがします`, `まにあいます`,
 * `べんきょうします`, `おやすみ`, `てけい`) so `<ruby><rt>` is placed strictly over kanji runs
 * and NEVER over okurigana or kana characters.
 */
export function alignKanjiReading(surface: string, rawReading: string): RubySegment[] {
  if (!surface) return [];
  if (!rawReading || !KANJI_CHAR_REGEX.test(surface)) {
    return [{ text: surface }];
  }

  // Handle trailing parenthetical notes on surface (e.g. "撮ります（写真を）" with reading "とります")
  const parenMatch = surface.match(/^([^（(]+)([（(][^）)]+[）)])$/);
  if (parenMatch && !/[（(]/.test(rawReading)) {
    const mainSegments = alignKanjiReading(parenMatch[1], rawReading);
    return [...mainSegments, { text: parenMatch[2] }];
  }

  // Split surface into alternating kanji runs and non-kanji (okurigana/kana/symbol) runs
  const rawParts = surface.split(KANJI_SPLIT_REGEX).filter(Boolean);
  const parts = rawParts.map(part => ({
    text: part,
    isKanji: KANJI_CHAR_REGEX.test(part),
  }));

  // If the entire surface is purely kanji, attach the clean reading directly
  if (parts.length === 1 && parts[0].isKanji) {
    const cleaned = stripSpacesAndBrackets(rawReading.replace(/[（(][^）)]*[）)]/g, ''));
    return [{ text: surface, reading: cleaned || rawReading.trim() }];
  }

  // Build candidate readings to match against (ordered from cleanest match to broadest)
  const candidates: string[] = [];
  const pushCandidate = (c: string) => {
    const normalized = stripSpacesAndBrackets(c).replace(/[？?！!。．]+$/g, '');
    if (normalized && !candidates.includes(normalized)) {
      candidates.push(normalized);
    }
  };

  // 1. Reading without parenthetical alternatives (e.g. "〜かい（〜がい）" -> "〜かい")
  const noParen = rawReading.replace(/[（(][^）)]*[）)]/g, '');

  // 2. If reading has optional bracketed marker like "しずか[な]", try removing bracketed text FIRST
  //    (e.g. "しずか"), AND try keeping its inner text (e.g. "いい [お]てんきですね" -> "いいおてんきですね")
  const withoutBracketBlocks = noParen.replace(/\[[^\]]*\]/g, '').trim();
  const withBracketInner = noParen.replace(/\[|\]/g, '').trim();

  // 3. Space-delimited suffixes (useful when reading has prefix like "〜から きました" or "〜を みせてください")
  for (const baseForm of [withoutBracketBlocks, withBracketInner]) {
    const tokens = baseForm.split(/[\s\u3000]+/).filter(Boolean);
    if (tokens.length > 1 && /[〜～]/.test(tokens[0])) {
      for (let start = 1; start < tokens.length; start++) {
        pushCandidate(tokens.slice(start).join(''));
      }
    }
  }

  pushCandidate(withoutBracketBlocks);
  pushCandidate(withBracketInner);

  // 4. Long bracketed phrases like "どうぞ よろしく [おねがいします]" -> "おねがいします"
  const bracketMatches = noParen.match(/\[([^\]]+)\]/g);
  if (bracketMatches) {
    for (const bm of bracketMatches) {
      const inner = bm.slice(1, -1).trim();
      if (inner.length >= 2) {
        pushCandidate(inner);
      }
    }
  }

  // 5. Remaining space-delimited suffixes (e.g. "これから おせわに なります" -> "おせわになります")
  for (const baseForm of [withBracketInner, withoutBracketBlocks]) {
    const tokens = baseForm.split(/[\s\u3000]+/).filter(Boolean);
    for (let start = 1; start < tokens.length; start++) {
      pushCandidate(tokens.slice(start).join(''));
    }
  }

  // Build regex pattern from surface parts (kanji -> kana-only capture group, okurigana -> literal anchor)
  const lastKanjiIdx = parts.reduce((acc, p, idx) => (p.isKanji ? idx : acc), -1);
  let patternStr = '^';
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    if (part.isKanji) {
      patternStr += i === lastKanjiIdx ? '([^〜～…・/／]+)' : '([^〜～…・/／]+?)';
    } else {
      const anchor = kataToHira(stripSpacesAndBrackets(part.text));
      patternStr += escapeRegex(anchor);
    }
  }
  patternStr += '$';

  const alignRegex = new RegExp(patternStr);

  for (const candidate of candidates) {
    const hiraCandidate = kataToHira(candidate);
    const match = alignRegex.exec(hiraCandidate);
    if (match) {
      // Slice readings from the original candidate preserving exact characters
      const segments: RubySegment[] = [];
      let cursor = 0;
      let groupIdx = 1;

      for (const part of parts) {
        if (part.isKanji) {
          const capturedHira = match[groupIdx++] ?? '';
          const capturedOrig = candidate.slice(cursor, cursor + capturedHira.length);
          cursor += capturedHira.length;
          segments.push({ text: part.text, reading: capturedOrig || capturedHira });
        } else {
          const anchorLen = stripSpacesAndBrackets(part.text).length;
          cursor += anchorLen;
          segments.push({ text: part.text });
        }
      }

      return segments;
    }
  }

  // Fallback: strip leading/trailing common kana between surface and primary candidate
  const primary = candidates[0] ?? stripSpacesAndBrackets(rawReading);
  const hiraSurface = kataToHira(surface);
  const hiraPrimary = kataToHira(primary);

  let prefixLen = 0;
  while (
    prefixLen < surface.length &&
    prefixLen < primary.length &&
    !KANJI_CHAR_REGEX.test(surface[prefixLen]) &&
    hiraSurface[prefixLen] === hiraPrimary[prefixLen]
  ) {
    prefixLen++;
  }

  let suffixLen = 0;
  while (
    suffixLen < surface.length - prefixLen &&
    suffixLen < primary.length - prefixLen &&
    !KANJI_CHAR_REGEX.test(surface[surface.length - 1 - suffixLen]) &&
    hiraSurface[surface.length - 1 - suffixLen] ===
      hiraPrimary[primary.length - 1 - suffixLen]
  ) {
    suffixLen++;
  }

  const midSurface = surface.slice(prefixLen, surface.length - suffixLen);
  const midReading = primary.slice(prefixLen, primary.length - suffixLen);

  const fallbackSegments: RubySegment[] = [];
  if (prefixLen > 0) fallbackSegments.push({ text: surface.slice(0, prefixLen) });
  if (midSurface) {
    if (KANJI_CHAR_REGEX.test(midSurface) && midReading) {
      fallbackSegments.push({ text: midSurface, reading: midReading });
    } else {
      fallbackSegments.push({ text: midSurface });
    }
  }
  if (suffixLen > 0) {
    fallbackSegments.push({ text: surface.slice(surface.length - suffixLen) });
  }
  return fallbackSegments;
}

/**
 * Checks whether aligning `surface` with `reading` cleanly separates all okurigana
 * (i.e. every segment carrying a `reading` consists solely of kanji characters).
 */
function hasStrictKanjiOnlyRuby(segments: RubySegment[]): boolean {
  let hasAnyKanjiRuby = false;
  for (const seg of segments) {
    if (seg.reading) {
      hasAnyKanjiRuby = true;
      // Ensure no kana leaked into a ruby base segment
      if (/[\u3040-\u309f\u30a0-\u30ff]/.test(seg.text)) {
        return false;
      }
    }
  }
  return hasAnyKanjiRuby;
}

/**
 * Builds kanji-only Ruby segments for a Kotoba vocabulary card (`kanji` + `reading`),
 * properly handling `・` / `/` variants (e.g. `あの人・あの方` + `あのひと / あのかた`,
 * `お手洗い` + `トイレ / おてあらい`, `探します` + `さがします`, `間に合います` + `まにあいます`).
 */
export function buildKotobaRubySegments(
  kanji: string | undefined,
  reading: string
): RubySegment[] {
  if (!kanji || !KANJI_CHAR_REGEX.test(kanji)) {
    return [{ text: reading }];
  }

  const kanjiVariants = kanji
    .split('・')
    .map(v => v.trim())
    .filter(Boolean);
  const readingVariants = reading
    .split(/\s*[/／]\s*/)
    .map(v => v.trim())
    .filter(Boolean);

  // Case 1: Multiple kanji variants paired 1-to-1 with reading variants (e.g. あの人・あの方 <= あのひと / あのかた)
  if (kanjiVariants.length > 1 && kanjiVariants.length === readingVariants.length) {
    const out: RubySegment[] = [];
    kanjiVariants.forEach((kv, idx) => {
      if (idx > 0) out.push({ text: '・' });
      out.push(...alignKanjiReading(kv, readingVariants[idx]));
    });
    return out;
  }

  // Case 2: Multiple kanji variants sharing a single reading (e.g. 暑い・熱い <= あつい)
  if (kanjiVariants.length > 1 && readingVariants.length === 1) {
    const out: RubySegment[] = [];
    kanjiVariants.forEach((kv, idx) => {
      if (idx > 0) out.push({ text: '・' });
      out.push(...alignKanjiReading(kv, readingVariants[0]));
    });
    return out;
  }

  // Case 3: Single kanji word with multiple slash-separated readings (e.g. お手洗い <= トイレ / おてあらい, 牛乳 <= ぎゅうにゅう / ミルク)
  if (kanjiVariants.length === 1 && readingVariants.length > 1) {
    // Prefer a reading variant that aligns cleanly (strict kanji-only ruby) and contains hiragana
    let best: RubySegment[] | null = null;
    for (const rv of readingVariants) {
      const candidate = alignKanjiReading(kanjiVariants[0], rv);
      if (hasStrictKanjiOnlyRuby(candidate)) {
        const isPureKatakana = /^[\u30a0-\u30ffー・\s]+$/.test(rv);
        if (!isPureKatakana) {
          return candidate;
        }
        if (!best) best = candidate;
      }
    }
    if (best) return best;
    return alignKanjiReading(kanjiVariants[0], readingVariants[0]);
  }

  // Standard single-word / phrase case
  return alignKanjiReading(kanji, reading);
}

/**
 * Parses `{漢字|かな}` inline furigana markup into structured Ruby segments,
 * automatically stripping any okurigana out of `<ruby>` tags so furigana sits
 * strictly over kanji characters.
 */
export function buildRubySegments(input: string): RubySegment[] {
  if (!input) return [];

  const segments: RubySegment[] = [];
  let lastIndex = 0;
  RUBY_MARKUP_REGEX.lastIndex = 0;

  let match: RegExpExecArray | null;
  while ((match = RUBY_MARKUP_REGEX.exec(input)) !== null) {
    if (match.index > lastIndex) {
      segments.push({ text: input.slice(lastIndex, match.index) });
    }
    const base = match[1];
    const reading = match[2];
    if (base && reading) {
      segments.push(...alignKanjiReading(base, reading));
    } else if (base) {
      segments.push({ text: base });
    }
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < input.length) {
    segments.push({ text: input.slice(lastIndex) });
  }

  return segments;
}

/**
 * Removes `{漢字|かな}` markup leaving plain surface Japanese text (with kanji intact).
 */
export function stripFuriganaMarkup(input: string): string {
  if (!input) return '';
  return input.replace(RUBY_MARKUP_REGEX, '$1');
}

/**
 * Replaces `{漢字|かな}` markup with kana readings only (useful for kana search).
 */
export function toKanaReading(input: string): string {
  if (!input) return '';
  return input.replace(RUBY_MARKUP_REGEX, '$2');
}
