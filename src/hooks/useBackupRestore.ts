import { useCallback, useRef, useState } from 'react';
import type { AllBooksProgress, AllBooksQuizHistory } from '../types/bunpou';
import {
  buildBackupPayload,
  downloadBackupJson,
  parseBackupJson,
  type ParsedBackupResult,
} from '../utils/storage';
import type { ToastTone } from './useToast';

interface UseBackupRestoreOptions {
  booksProgress: AllBooksProgress;
  quizHistory: AllBooksQuizHistory;
  onApplyProgress: (incoming: AllBooksProgress, mode: 'merge' | 'replace') => Promise<void>;
  onApplyQuizHistory: (incoming: AllBooksQuizHistory, mode: 'merge' | 'replace') => Promise<void>;
  showToast: (message: string, tone?: ToastTone) => void;
}

export function useBackupRestore({
  booksProgress,
  quizHistory,
  onApplyProgress,
  onApplyQuizHistory,
  showToast,
}: UseBackupRestoreOptions) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pendingRestore, setPendingRestore] = useState<ParsedBackupResult | null>(null);
  const [restoring, setRestoring] = useState(false);

  const handleExport = useCallback(() => {
    const payload = buildBackupPayload(booksProgress, quizHistory);
    downloadBackupJson(payload);
    showToast('File backup progres (.json) berhasil diunduh.', 'success');
  }, [booksProgress, quizHistory, showToast]);

  const handleTriggerImport = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileSelected = useCallback(
    async (file: File) => {
      try {
        const text = await file.text();
        const parsed = parseBackupJson(text);
        setPendingRestore(parsed);
      } catch (err) {
        showToast(
          err instanceof Error ? err.message : 'Gagal membaca file backup.',
          'error'
        );
      }
    },
    [showToast]
  );

  const handleConfirmRestore = useCallback(
    async (mode: 'merge' | 'replace') => {
      if (!pendingRestore) return;
      setRestoring(true);
      try {
        await onApplyProgress(pendingRestore.progress, mode);
        await onApplyQuizHistory(pendingRestore.quizHistory, mode);
        setPendingRestore(null);
        showToast(
          mode === 'merge'
            ? 'Progres backup berhasil digabungkan.'
            : 'Progres berhasil dipulihkan dari file backup.',
          'success'
        );
      } catch {
        showToast('Gagal memulihkan data backup.', 'error');
      } finally {
        setRestoring(false);
      }
    },
    [pendingRestore, onApplyProgress, onApplyQuizHistory, showToast]
  );

  const handleCancelRestore = useCallback(() => {
    setPendingRestore(null);
  }, []);

  return {
    fileInputRef,
    pendingRestore,
    restoring,
    handleExport,
    handleTriggerImport,
    handleFileSelected,
    handleConfirmRestore,
    handleCancelRestore,
  };
}
