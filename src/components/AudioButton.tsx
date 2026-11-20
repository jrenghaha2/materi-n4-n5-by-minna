import { useEffect, useState } from 'react';
import { Volume2, VolumeX } from 'lucide-react';
import { isSpeechSupported, speakJapanese, stopJapaneseSpeech } from '../utils/speech';

interface AudioButtonProps {
  text: string;
  label?: string;
  size?: 'sm' | 'md';
  className?: string;
}

export function AudioButton({
  text,
  label = 'Putar audio bahasa Jepang',
  size = 'sm',
  className = '',
}: AudioButtonProps) {
  const [speaking, setSpeaking] = useState(false);
  const supported = isSpeechSupported();

  useEffect(() => {
    return () => {
      if (speaking) stopJapaneseSpeech();
    };
  }, [speaking]);

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!supported) return;
    if (speaking) {
      stopJapaneseSpeech();
      setSpeaking(false);
      return;
    }

    speakJapanese(text, {
      onStart: () => setSpeaking(true),
      onEnd: () => setSpeaking(false),
      onError: () => setSpeaking(false),
    });
  };

  const dims = size === 'md' ? 'w-9 h-9' : 'w-8 h-8';
  const iconDims = size === 'md' ? 'w-4 h-4' : 'w-3.5 h-3.5';

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={!supported}
      aria-label={speaking ? 'Hentikan audio' : label}
      title={supported ? (speaking ? 'Hentikan audio' : label) : 'Audio TTS tidak didukung browser'}
      className={`${dims} rounded-lg border inline-flex items-center justify-center shrink-0 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline-2 focus-visible:outline-indigo-500 ${
        speaking
          ? 'bg-indigo-600 border-indigo-600 text-white'
          : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-indigo-50 dark:hover:bg-indigo-950/60 hover:text-indigo-700 dark:hover:text-indigo-300 hover:border-indigo-300 dark:hover:border-indigo-700'
      } ${className}`}
    >
      {supported ? (
        <Volume2 className={iconDims} aria-hidden="true" />
      ) : (
        <VolumeX className={iconDims} aria-hidden="true" />
      )}
    </button>
  );
}
