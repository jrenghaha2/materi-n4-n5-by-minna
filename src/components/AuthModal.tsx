import { useEffect, useRef, useState } from 'react';
import { Github, KeyRound, Mail, UserPlus, X } from 'lucide-react';
import { Modal } from './Modal';

type AuthTab = 'login' | 'register' | 'reset';

interface AuthModalProps {
  open: boolean;
  isSwitchMode: boolean;
  busy: boolean;
  onClose: () => void;
  onGoogleLogin: () => Promise<boolean>;
  onGithubLogin: () => Promise<boolean>;
  onEmailLogin: (email: string, password: string) => Promise<boolean>;
  onEmailRegister: (name: string, email: string, password: string) => Promise<boolean>;
  onPasswordReset: (email: string) => Promise<boolean>;
}

export function AuthModal({
  open,
  isSwitchMode,
  busy,
  onClose,
  onGoogleLogin,
  onGithubLogin,
  onEmailLogin,
  onEmailRegister,
  onPasswordReset,
}: AuthModalProps) {
  const [tab, setTab] = useState<AuthTab>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);
  const emailRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setTab('login');
      setPassword('');
      setLocalError(null);
    }
  }, [open]);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);

    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setLocalError('Masukkan alamat email Anda.');
      return;
    }

    if (tab === 'reset') {
      const ok = await onPasswordReset(trimmedEmail);
      if (ok) setTab('login');
      return;
    }

    if (password.length < 6) {
      setLocalError('Kata sandi minimal 6 karakter.');
      return;
    }

    if (tab === 'register') {
      if (!name.trim()) {
        setLocalError('Masukkan nama tampilan Anda.');
        return;
      }
      const ok = await onEmailRegister(name.trim(), trimmedEmail, password);
      if (ok) onClose();
    } else {
      const ok = await onEmailLogin(trimmedEmail, password);
      if (ok) onClose();
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      id="authModalOverlay"
      ariaLabelledBy="authModalTitle"
      initialFocusRef={emailRef}
      panelClassName="overflow-hidden"
    >
      <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3">
        <div>
          <h2 id="authModalTitle" className="text-base font-bold text-slate-900 dark:text-slate-50">
            {isSwitchMode ? 'Ganti Akun Sinkronisasi' : 'Masuk & Sinkronisasi Cloud'}
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Simpan progres N5 &amp; N4 serta riwayat kuis di semua perangkat.
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Tutup jendela login"
          className="w-9 h-9 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-300 inline-flex items-center justify-center cursor-pointer"
        >
          <X className="w-4 h-4" aria-hidden="true" />
        </button>
      </div>

      <div className="p-5 space-y-4">
        {/* Social Providers */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          <button
            type="button"
            id="btnGoogleAuth"
            disabled={busy}
            onClick={async () => {
              const ok = await onGoogleLogin();
              if (ok) onClose();
            }}
            className="min-h-[42px] px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-100 text-sm font-semibold inline-flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
          >
            <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
              <path
                fill="#4285F4"
                d="M23.49 12.27c0-.79-.07-1.54-.2-2.27H12v4.3h6.44a5.5 5.5 0 0 1-2.39 3.61v3h3.87c2.26-2.08 3.57-5.15 3.57-8.64z"
              />
              <path
                fill="#34A853"
                d="M12 24c3.24 0 5.96-1.07 7.95-2.91l-3.87-3c-1.07.72-2.45 1.15-4.08 1.15-3.14 0-5.8-2.12-6.75-4.97H1.25v3.1A12 12 0 0 0 12 24z"
              />
              <path
                fill="#FBBC05"
                d="M5.25 14.27a7.2 7.2 0 0 1 0-4.54v-3.1H1.25a12 12 0 0 0 0 10.74l4-3.1z"
              />
              <path
                fill="#EA4335"
                d="M12 4.76c1.76 0 3.34.61 4.58 1.8l3.44-3.44C17.95 1.19 15.24 0 12 0A12 12 0 0 0 1.25 6.63l4 3.1C6.2 6.88 8.86 4.76 12 4.76z"
              />
            </svg>
            <span>Google</span>
          </button>

          <button
            type="button"
            id="btnGithubAuth"
            disabled={busy}
            onClick={async () => {
              const ok = await onGithubLogin();
              if (ok) onClose();
            }}
            className="min-h-[42px] px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-100 text-sm font-semibold inline-flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
          >
            <Github className="w-4 h-4 shrink-0" aria-hidden="true" />
            <span>GitHub</span>
          </button>
        </div>

        <div className="relative flex items-center justify-center">
          <div className="border-t border-slate-200 dark:border-slate-800 w-full" />
          <span className="bg-white dark:bg-slate-900 px-2.5 text-[11px] font-medium text-slate-400 dark:text-slate-500 whitespace-nowrap">
            atau dengan email
          </span>
          <div className="border-t border-slate-200 dark:border-slate-800 w-full" />
        </div>

        {/* Email Mode Tabs */}
        <div className="grid grid-cols-3 gap-1 rounded-xl bg-slate-100 dark:bg-slate-800/80 p-1">
          <button
            type="button"
            onClick={() => {
              setTab('login');
              setLocalError(null);
            }}
            className={`py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
              tab === 'login'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-50 shadow-2xs'
                : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            Masuk
          </button>
          <button
            type="button"
            onClick={() => {
              setTab('register');
              setLocalError(null);
            }}
            className={`py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
              tab === 'register'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-50 shadow-2xs'
                : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            Daftar
          </button>
          <button
            type="button"
            onClick={() => {
              setTab('reset');
              setLocalError(null);
            }}
            className={`py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
              tab === 'reset'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-50 shadow-2xs'
                : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            Reset Sandi
          </button>
        </div>

        <form onSubmit={e => void handleSubmit(e)} className="space-y-3">
          {tab === 'register' ? (
            <div>
              <label
                htmlFor="authNameInput"
                className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1"
              >
                Nama Tampilan
              </label>
              <input
                id="authNameInput"
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Contoh: Budi Santoso"
                maxLength={50}
                className="w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm text-slate-900 dark:text-slate-100 focus:outline-2 focus:outline-indigo-500"
              />
            </div>
          ) : null}

          <div>
            <label
              htmlFor="authEmailInput"
              className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1"
            >
              Email
            </label>
            <input
              ref={emailRef}
              id="authEmailInput"
              type="email"
              required
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="nama@email.com"
              className="w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm text-slate-900 dark:text-slate-100 focus:outline-2 focus:outline-indigo-500"
            />
          </div>

          {tab !== 'reset' ? (
            <div>
              <label
                htmlFor="authPasswordInput"
                className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1"
              >
                Kata Sandi
              </label>
              <input
                id="authPasswordInput"
                type="password"
                required
                minLength={6}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Minimal 6 karakter"
                className="w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm text-slate-900 dark:text-slate-100 focus:outline-2 focus:outline-indigo-500"
              />
            </div>
          ) : null}

          {localError ? (
            <p
              role="alert"
              className="rounded-xl border border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/50 px-3 py-2 text-xs font-medium text-rose-800 dark:text-rose-200"
            >
              {localError}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={busy}
            className="w-full min-h-[42px] px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold inline-flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
          >
            {tab === 'login' ? (
              <>
                <Mail className="w-4 h-4" aria-hidden="true" />
                <span>{busy ? 'Memproses...' : 'Masuk dengan Email'}</span>
              </>
            ) : tab === 'register' ? (
              <>
                <UserPlus className="w-4 h-4" aria-hidden="true" />
                <span>{busy ? 'Mendaftar...' : 'Buat Akun Baru'}</span>
              </>
            ) : (
              <>
                <KeyRound className="w-4 h-4" aria-hidden="true" />
                <span>{busy ? 'Mengirim...' : 'Kirim Tautan Reset'}</span>
              </>
            )}
          </button>
        </form>
      </div>
    </Modal>
  );
}
