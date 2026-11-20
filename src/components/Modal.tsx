import { useEffect, useRef, type ReactNode, type RefObject } from 'react';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  id?: string;
  ariaLabelledBy: string;
  ariaDescribedBy?: string;
  maxWidthClass?: string;
  panelClassName?: string;
  initialFocusRef?: RefObject<HTMLElement | null>;
  children: ReactNode;
}

const FOCUSABLE_SELECTOR =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function Modal({
  open,
  onClose,
  id,
  ariaLabelledBy,
  ariaDescribedBy,
  maxWidthClass = 'max-w-md',
  panelClassName = '',
  initialFocusRef,
  children,
}: ModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  const initialFocusRefLatest = useRef(initialFocusRef);

  onCloseRef.current = onClose;
  initialFocusRefLatest.current = initialFocusRef;

  useEffect(() => {
    if (!open) return;

    const focusTimer = requestAnimationFrame(() => {
      const target = initialFocusRefLatest.current?.current;
      if (target) {
        target.focus();
        return;
      }
      const firstFocusable = panelRef.current?.querySelector<HTMLElement>(FOCUSABLE_SELECTOR);
      firstFocusable?.focus();
    });

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onCloseRef.current();
        return;
      }

      if (e.key !== 'Tab' || !panelRef.current) return;
      const focusables = Array.from(
        panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
      ).filter(el => el.offsetParent !== null);
      if (focusables.length === 0) return;

      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement as HTMLElement | null;

      if (e.shiftKey) {
        if (active === first || !panelRef.current.contains(active)) {
          e.preventDefault();
          last.focus();
        }
      } else if (active === last || !panelRef.current.contains(active)) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown, true);
    return () => {
      cancelAnimationFrame(focusTimer);
      document.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [open]);

  if (!open) return null;

  return (
    <div
      id={id}
      role="dialog"
      aria-modal="true"
      aria-labelledby={ariaLabelledBy}
      aria-describedby={ariaDescribedBy}
      onClick={e => {
        if (e.target === e.currentTarget) onCloseRef.current();
      }}
      className="fixed inset-0 z-50 bg-slate-900/55 dark:bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-4"
    >
      <div
        ref={panelRef}
        className={`w-full ${maxWidthClass} rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-2xl ${panelClassName}`}
      >
        {children}
      </div>
    </div>
  );
}
