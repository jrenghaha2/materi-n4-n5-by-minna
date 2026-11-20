import { stripFuriganaMarkup } from './furiganaConverter';

export function isSpeechSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.speechSynthesis !== 'undefined' &&
    typeof SpeechSynthesisUtterance !== 'undefined'
  );
}

let cachedJaVoice: SpeechSynthesisVoice | null = null;

function pickJapaneseVoice(): SpeechSynthesisVoice | null {
  if (!isSpeechSupported()) return null;
  const voices = window.speechSynthesis.getVoices();
  if (!voices.length) return cachedJaVoice;

  const exact = voices.find(v => v.lang.toLowerCase() === 'ja-jp' && v.localService);
  const anyJaJp = voices.find(v => v.lang.toLowerCase() === 'ja-jp');
  const anyJa = voices.find(v => v.lang.toLowerCase().startsWith('ja'));
  cachedJaVoice = exact ?? anyJaJp ?? anyJa ?? null;
  return cachedJaVoice;
}

if (typeof window !== 'undefined' && typeof window.speechSynthesis !== 'undefined') {
  window.speechSynthesis.onvoiceschanged = () => {
    cachedJaVoice = null;
    pickJapaneseVoice();
  };
}

export function stopJapaneseSpeech(): void {
  if (!isSpeechSupported()) return;
  try {
    window.speechSynthesis.cancel();
  } catch {
    // Ignore browser speech synthesis cancel errors
  }
}

export interface SpeakOptions {
  rate?: number;
  onStart?: () => void;
  onEnd?: () => void;
  onError?: () => void;
}

export function speakJapanese(rawText: string, options: SpeakOptions = {}): boolean {
  if (!isSpeechSupported()) {
    options.onError?.();
    return false;
  }

  const cleaned = stripFuriganaMarkup(rawText)
    .replace(/[／/]/g, '、')
    .replace(/…/g, '、')
    .replace(/\s+/g, '')
    .trim();

  if (!cleaned) {
    options.onError?.();
    return false;
  }

  try {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(cleaned);
    utterance.lang = 'ja-JP';
    utterance.rate = options.rate ?? 0.92;
    utterance.pitch = 1;

    const voice = pickJapaneseVoice();
    if (voice) utterance.voice = voice;

    utterance.onstart = () => options.onStart?.();
    utterance.onend = () => options.onEnd?.();
    utterance.onerror = () => options.onError?.();

    window.speechSynthesis.speak(utterance);
    return true;
  } catch {
    options.onError?.();
    return false;
  }
}
