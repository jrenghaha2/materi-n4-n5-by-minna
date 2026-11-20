import { useEffect, useRef, useState } from 'react';
import { Camera, RotateCcw, Upload, X } from 'lucide-react';
import { PRESET_AVATARS, compressAvatarFile, renderPresetKanjiAvatar } from '../utils/avatarImage';
import { DISPLAY_NAME_MAX_LENGTH, isValidAvatarUrl } from '../utils/bunpouSync';
import { Modal } from './Modal';

interface ProfileModalProps {
  open: boolean;
  initialName: string;
  initialAvatarUrl: string;
  fallbackAuthPhoto: string;
  saving: boolean;
  onSave: (displayName: string, avatarUrl: string) => Promise<boolean>;
  onClose: () => void;
}

export function ProfileModal({
  open,
  initialName,
  initialAvatarUrl,
  fallbackAuthPhoto,
  saving,
  onSave,
  onClose,
}: ProfileModalProps) {
  const [nameInput, setNameInput] = useState(initialName);
  const [avatarInput, setAvatarInput] = useState(initialAvatarUrl);
  const [urlInput, setUrlInput] = useState(
    initialAvatarUrl.startsWith('https://') ? initialAvatarUrl : ''
  );
  const [previewBroken, setPreviewBroken] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const wasOpenRef = useRef(false);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open && !wasOpenRef.current) {
      setNameInput(initialName);
      setAvatarInput(initialAvatarUrl);
      setUrlInput(initialAvatarUrl.startsWith('https://') ? initialAvatarUrl : '');
      setPreviewBroken(false);
      setErrorMsg(null);
    }
    wasOpenRef.current = open;
  }, [open, initialName, initialAvatarUrl]);

  if (!open) return null;

  const activePreview = avatarInput || fallbackAuthPhoto;
  const previewInitial = (nameInput.trim() || 'M').charAt(0).toUpperCase();

  const handleFileChange = async (file: File) => {
    setErrorMsg(null);
    try {
      const compressed = await compressAvatarFile(file);
      setAvatarInput(compressed);
      setUrlInput('');
      setPreviewBroken(false);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Gagal memproses gambar.');
    }
  };

  const handleApplyUrl = (nextUrl: string) => {
    setUrlInput(nextUrl);
    setErrorMsg(null);
    const trimmed = nextUrl.trim();
    if (!trimmed) {
      setAvatarInput('');
      setPreviewBroken(false);
      return;
    }
    if (!trimmed.startsWith('https://')) {
      setErrorMsg('URL foto harus diawali dengan https://');
      return;
    }
    if (!isValidAvatarUrl(trimmed)) {
      setErrorMsg('URL foto terlalu panjang atau tidak valid.');
      return;
    }
    setAvatarInput(trimmed);
    setPreviewBroken(false);
  };

  const handleSelectPreset = (index: number) => {
    setErrorMsg(null);
    try {
      const dataUrl = renderPresetKanjiAvatar(PRESET_AVATARS[index]);
      setAvatarInput(dataUrl);
      setUrlInput('');
      setPreviewBroken(false);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Gagal memilih avatar.');
    }
  };

  const handleResetDefault = () => {
    setErrorMsg(null);
    setAvatarInput('');
    setUrlInput('');
    setPreviewBroken(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    const trimmedName = nameInput.trim();
    if (!trimmedName) {
      setErrorMsg('Nama tampilan tidak boleh kosong.');
      return;
    }
    const trimmedUrl = urlInput.trim();
    if (trimmedUrl) {
      if (!trimmedUrl.startsWith('https://')) {
        setErrorMsg('URL foto harus menggunakan protokol https://');
        return;
      }
      if (!isValidAvatarUrl(trimmedUrl)) {
        setErrorMsg('URL foto tidak valid (pastikan tanpa spasi dan panjangnya wajar).');
        return;
      }
    }
    const finalAvatar = trimmedUrl || avatarInput;
    const ok = await onSave(trimmedName, finalAvatar);
    if (ok) onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      id="profileModalOverlay"
      ariaLabelledBy="profileModalTitle"
      initialFocusRef={nameInputRef}
      panelClassName="overflow-hidden"
    >
      <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3">
        <div>
          <h2 id="profileModalTitle" className="text-base font-bold text-slate-900 dark:text-slate-50">
            Ubah Nama &amp; Foto Profil
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Perubahan tersinkronisasi ke akun Anda.
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Tutup editor profil"
          className="w-9 h-9 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-300 inline-flex items-center justify-center cursor-pointer"
        >
          <X className="w-4 h-4" aria-hidden="true" />
        </button>
      </div>

      <form onSubmit={e => void handleSubmit(e)} className="p-5 space-y-4">
        <div className="flex items-center gap-4">
          <div className="relative shrink-0">
            {activePreview && !previewBroken ? (
              <img
                src={activePreview}
                alt="Pratinjau foto profil"
                referrerPolicy="no-referrer"
                onError={() => setPreviewBroken(true)}
                className="w-16 h-16 rounded-full border-2 border-indigo-100 dark:border-indigo-800 object-cover bg-slate-100 dark:bg-slate-800"
              />
            ) : (
              <div className="w-16 h-16 rounded-full border-2 border-indigo-200 dark:border-indigo-700 bg-indigo-50 dark:bg-indigo-950/70 text-indigo-700 dark:text-indigo-200 font-bold text-xl flex items-center justify-center">
                {previewInitial}
              </div>
            )}
            <span
              aria-hidden="true"
              className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-indigo-600 text-white flex items-center justify-center border-2 border-white dark:border-slate-900"
            >
              <Camera className="w-3 h-3" />
            </span>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="min-h-[36px] px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
            >
              <Upload className="w-3.5 h-3.5" aria-hidden="true" />
              Unggah Foto
            </button>

            {avatarInput ? (
              <button
                type="button"
                onClick={handleResetDefault}
                className="min-h-[36px] px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
                Bawaan Akun
              </button>
            ) : null}

            <input
              ref={fileRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="sr-only"
              aria-label="Pilih file foto profil"
              onChange={e => {
                const file = e.target.files?.[0];
                if (file) void handleFileChange(file);
                e.target.value = '';
              }}
            />
          </div>
        </div>

        <div>
          <p className="text-xs font-semibold text-slate-700 dark:text-slate-200 mb-2">
            Atau Pilih Avatar Kanji
          </p>
          <div className="grid grid-cols-6 gap-2">
            {PRESET_AVATARS.map((preset, idx) => (
              <button
                key={preset.id}
                type="button"
                onClick={() => handleSelectPreset(idx)}
                aria-label={`Pilih avatar ${preset.label}`}
                title={preset.label}
                style={{
                  background: `linear-gradient(135deg, ${preset.bgFrom}, ${preset.bgTo})`,
                }}
                className="aspect-square rounded-full text-white font-jp font-bold text-base flex items-center justify-center hover:scale-105 transition-transform cursor-pointer border-2 border-white dark:border-slate-800 shadow-xs"
              >
                {preset.kanji}
              </button>
            ))}
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-1">
            <label
              htmlFor="profileNameInput"
              className="text-xs font-semibold text-slate-700 dark:text-slate-200"
            >
              Nama Tampilan
            </label>
            <span className="text-[11px] text-slate-400 dark:text-slate-500 font-mono-num">
              {nameInput.length}/{DISPLAY_NAME_MAX_LENGTH}
            </span>
          </div>
          <input
            ref={nameInputRef}
            id="profileNameInput"
            type="text"
            required
            maxLength={DISPLAY_NAME_MAX_LENGTH}
            value={nameInput}
            onChange={e => setNameInput(e.target.value)}
            placeholder="Nama Anda"
            className="w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm text-slate-900 dark:text-slate-100 focus:outline-2 focus:outline-indigo-500"
          />
        </div>

        <div>
          <label
            htmlFor="profileUrlInput"
            className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1"
          >
            URL Foto Profil (opsional, HTTPS)
          </label>
          <input
            id="profileUrlInput"
            type="url"
            value={urlInput}
            onChange={e => handleApplyUrl(e.target.value)}
            placeholder="https://contoh.com/foto.jpg"
            className="w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm text-slate-900 dark:text-slate-100 focus:outline-2 focus:outline-indigo-500"
          />
        </div>

        {errorMsg ? (
          <div
            role="alert"
            className="rounded-xl border border-rose-200 dark:border-rose-800/80 bg-rose-50 dark:bg-rose-950/50 px-3 py-2 text-xs font-medium text-rose-800 dark:text-rose-200"
          >
            {errorMsg}
          </div>
        ) : null}

        <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
          <button
            type="button"
            onClick={onClose}
            className="min-h-[40px] px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-sm font-semibold cursor-pointer"
          >
            Batal
          </button>
          <button
            type="submit"
            disabled={saving}
            className="min-h-[40px] px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold cursor-pointer disabled:opacity-50"
          >
            {saving ? 'Menyimpan...' : 'Simpan Profil'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
