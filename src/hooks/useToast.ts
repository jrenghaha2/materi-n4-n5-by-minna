import { useCallback, useEffect, useRef, useState } from 'react';

export type ToastTone = 'info' | 'success' | 'error';

export interface ToastState {
  message: string;
  tone: ToastTone;
  actionLabel?: string;
  actionHref?: string;
}

export function useToast() {
  const [toast, setToast] = useState<ToastState | null>(null);
  const timerRef = useRef<number | null>(null);

  const dismissToast = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setToast(null);
  }, []);

  const showToast = useCallback(
    (
      message: string,
      tone: ToastTone = 'info',
      options?: { durationMs?: number; actionLabel?: string; actionHref?: string }
    ) => {
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
      }
      setToast({
        message,
        tone,
        actionLabel: options?.actionLabel,
        actionHref: options?.actionHref,
      });
      const duration = options?.durationMs ?? (tone === 'error' ? 5200 : 3400);
      timerRef.current = window.setTimeout(() => {
        setToast(null);
        timerRef.current = null;
      }, duration);
    },
    []
  );

  useEffect(() => {
    return () => {
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
      }
    };
  }, []);

  return { toast, showToast, dismissToast };
}
