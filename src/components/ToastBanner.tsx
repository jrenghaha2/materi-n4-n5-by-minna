import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react';
import type { ToastState } from '../hooks/useToast';

interface ToastBannerProps {
  toast: ToastState | null;
  onDismiss: () => void;
}

export function ToastBanner({ toast, onDismiss }: ToastBannerProps) {
  if (!toast) return null;

  const toneStyles =
    toast.tone === 'success'
      ? 'bg-emerald-50 dark:bg-emerald-950/90 border-emerald-300 dark:border-emerald-700 text-emerald-950 dark:text-emerald-100'
      : toast.tone === 'error'
      ? 'bg-rose-50 dark:bg-rose-950/90 border-rose-300 dark:border-rose-700 text-rose-950 dark:text-rose-100'
      : 'bg-slate-900 dark:bg-slate-800 border-slate-700 dark:border-slate-600 text-white';

  const Icon =
    toast.tone === 'success'
      ? CheckCircle2
      : toast.tone === 'error'
      ? AlertCircle
      : Info;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-4 right-4 left-4 sm:left-auto sm:max-w-md z-50 pointer-events-none flex justify-end"
    >
      <div
        className={`pointer-events-auto w-full sm:w-auto rounded-xl border shadow-lg px-3.5 py-2.5 flex items-center gap-2.5 text-sm ${toneStyles}`}
      >
        <Icon className="w-4 h-4 shrink-0" aria-hidden="true" />
        <span className="flex-1 font-medium leading-snug">{toast.message}</span>
        {toast.actionLabel && toast.actionHref ? (
          <a
            href={toast.actionHref}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs font-bold underline underline-offset-2 shrink-0"
          >
            {toast.actionLabel}
          </a>
        ) : null}
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Tutup notifikasi"
          className="p-1 rounded-lg opacity-75 hover:opacity-100 cursor-pointer shrink-0"
        >
          <X className="w-3.5 h-3.5" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
