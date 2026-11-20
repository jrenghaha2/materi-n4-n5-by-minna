import { FolderOpen, GitMerge, Replace, X } from 'lucide-react';
import type { ParsedBackupResult } from '../utils/storage';
import { Modal } from './Modal';

interface RestoreModalProps {
  pending: ParsedBackupResult | null;
  restoring: boolean;
  onConfirm: (mode: 'merge' | 'replace') => void;
  onCancel: () => void;
}

export function RestoreModal({
  pending,
  restoring,
  onConfirm,
  onCancel,
}: RestoreModalProps) {
  if (!pending) return null;

  return (
    <Modal
      open={Boolean(pending)}
      onClose={onCancel}
      id="restoreModalOverlay"
      ariaLabelledBy="restoreModalTitle"
      panelClassName="overflow-hidden"
    >
      <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <FolderOpen className="w-5 h-5 text-indigo-600 dark:text-indigo-400" aria-hidden="true" />
          <h2 id="restoreModalTitle" className="text-base font-bold text-slate-900 dark:text-slate-50">
            Pulihkan Data Backup
          </h2>
        </div>
        <button
          type="button"
          onClick={onCancel}
          aria-label="Tutup dialog restore"
          className="w-9 h-9 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-300 inline-flex items-center justify-center cursor-pointer"
        >
          <X className="w-4 h-4" aria-hidden="true" />
        </button>
      </div>

      <div className="p-5 space-y-4">
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 p-3.5 space-y-1.5 text-sm">
          <p className="font-semibold text-slate-900 dark:text-slate-100">
            Ringkasan Isi File Backup:
          </p>
          <p className="text-xs text-slate-600 dark:text-slate-300 font-mono-num">
            Total Hafal: <strong>{pending.totalMastered}</strong> (N5: {pending.progress.n5.mastered.size} · N4: {pending.progress.n4.mastered.size})
          </p>
          <p className="text-xs text-slate-600 dark:text-slate-300 font-mono-num">
            Total Sulit: <strong>{pending.totalDifficult}</strong> · Riwayat Kuis: <strong>{pending.totalQuizSessions}</strong> sesi
          </p>
          {pending.exportedAt ? (
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Diekspor pada: {new Date(pending.exportedAt).toLocaleString('id-ID')}
            </p>
          ) : null}
        </div>

        <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
          Pilih <strong>Gabungkan</strong> untuk menambahkan data backup ke progres yang sudah ada, atau <strong>Timpa Semua</strong> untuk mengganti seluruh progres saat ini.
        </p>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
          <button
            type="button"
            disabled={restoring}
            onClick={onCancel}
            className="min-h-[40px] px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-sm font-semibold cursor-pointer"
          >
            Batal
          </button>
          <button
            type="button"
            disabled={restoring}
            onClick={() => onConfirm('replace')}
            className="min-h-[40px] px-3.5 py-2 rounded-xl border border-rose-300 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/50 hover:bg-rose-100 dark:hover:bg-rose-900/50 text-rose-800 dark:text-rose-200 text-sm font-semibold inline-flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            <Replace className="w-4 h-4" aria-hidden="true" />
            <span>Timpa Semua</span>
          </button>
          <button
            type="button"
            disabled={restoring}
            onClick={() => onConfirm('merge')}
            className="min-h-[40px] px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold inline-flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            <GitMerge className="w-4 h-4" aria-hidden="true" />
            <span>{restoring ? 'Memproses...' : 'Gabungkan'}</span>
          </button>
        </div>
      </div>
    </Modal>
  );
}
