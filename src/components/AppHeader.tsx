import { useEffect, useRef, useState } from 'react';
import type { User } from 'firebase/auth';
import {
  AlertCircle,
  Camera,
  ChevronDown,
  Cloud,
  Download,
  FolderOpen,
  Languages,
  LogIn,
  LogOut,
  Menu,
  Moon,
  RefreshCw,
  Shield,
  ShieldCheck,
  Sun,
  Users,
} from 'lucide-react';
import type { BookData, UserProfileDoc, UserRole } from '../types/bunpou';
import { getRoleLabel, isBootstrapSuperAdminEmail } from '../utils/rbac';
import { BrandLogo } from './BrandLogo';

interface AppHeaderProps {
  activeBook: BookData;
  showFurigana: boolean;
  showTranslation: boolean;
  isDark: boolean;
  user: User | null;
  profile: UserProfileDoc | null;
  role: UserRole;
  isAdminOrAbove: boolean;
  isSuperAdmin: boolean;
  isVerified: boolean;
  authBusy: boolean;
  syncing: boolean;
  onToggleFurigana: () => void;
  onToggleTranslation: () => void;
  onToggleTheme: () => void;
  onToggleMobileSidebar: () => void;
  onOpenAuthModal: (isSwitch?: boolean) => void;
  onOpenProfileModal: () => void;
  onOpenAdminPanel: () => void;
  onManualSync: () => void;
  onResendVerification: () => void;
  onRefreshVerification: () => void;
  onSignOut: () => void;
  onExport: () => void;
  onTriggerImport: () => void;
}

function getProviderLabel(user: User): string {
  const providerId = user.providerData[0]?.providerId ?? '';
  if (providerId === 'google.com') return 'Google';
  if (providerId === 'github.com') return 'GitHub';
  return 'Email';
}

export function AppHeader({
  activeBook,
  showFurigana,
  showTranslation,
  isDark,
  user,
  profile,
  role,
  isAdminOrAbove,
  isSuperAdmin,
  isVerified,
  authBusy,
  syncing,
  onToggleFurigana,
  onToggleTranslation,
  onToggleTheme,
  onToggleMobileSidebar,
  onOpenAuthModal,
  onOpenProfileModal,
  onOpenAdminPanel,
  onManualSync,
  onResendVerification,
  onRefreshVerification,
  onSignOut,
  onExport,
  onTriggerImport,
}: AppHeaderProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [avatarBroken, setAvatarBroken] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuBtnRef = useRef<HTMLButtonElement>(null);

  const resolvedName =
    profile?.displayName ||
    user?.displayName ||
    user?.email?.split('@')[0] ||
    'Pengguna';
  const resolvedAvatar = profile?.avatarUrl || user?.photoURL || '';
  const initial = resolvedName.trim().charAt(0).toUpperCase() || 'M';

  useEffect(() => {
    setAvatarBroken(false);
  }, [resolvedAvatar]);

  useEffect(() => {
    if (!menuOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setMenuOpen(false);
        menuBtnRef.current?.focus();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEsc);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEsc);
    };
  }, [menuOpen]);

  return (
    <header className="sticky top-0 z-30 bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm border-b border-slate-200 dark:border-slate-800">
      <div className="max-w-7xl mx-auto px-3 sm:px-5 h-16 flex items-center justify-between gap-2 sm:gap-4">
        <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
          <button
            type="button"
            id="btnMobileSidebar"
            onClick={onToggleMobileSidebar}
            aria-label="Buka daftar bab"
            className="lg:hidden w-9 h-9 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 inline-flex items-center justify-center shrink-0 cursor-pointer"
          >
            <Menu className="w-4 h-4 sm:w-5 sm:h-5" aria-hidden="true" />
          </button>

          <BrandLogo className="w-8 h-8 sm:w-9 sm:h-9 shrink-0" />

          <div className="min-w-0">
            <h1 className="text-[12.5px] leading-[1.15] sm:text-base sm:leading-tight font-extrabold tracking-tight text-slate-900 dark:text-slate-50 line-clamp-2 sm:truncate">
              Materi N4 N5 by Minna
            </h1>
            <p className="hidden sm:block text-xs text-slate-500 dark:text-slate-400 truncate">
              {activeBook.shortTitle} · {activeBook.level}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1 sm:gap-2 shrink-0">
          <button
            type="button"
            id="btnToggleFurigana"
            aria-pressed={showFurigana}
            onClick={onToggleFurigana}
            title="Tampilkan atau sembunyikan cara baca Furigana"
            className={`w-8 h-8 sm:w-auto sm:min-h-[38px] sm:px-3 sm:py-1.5 rounded-xl border text-xs font-semibold inline-flex items-center justify-center gap-1.5 transition-colors cursor-pointer shrink-0 ${
              showFurigana
                ? 'bg-indigo-50 dark:bg-indigo-950/70 border-indigo-300 dark:border-indigo-700 text-indigo-800 dark:text-indigo-200'
                : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700'
            }`}
          >
            <span className="font-jp font-bold text-xs">ふ</span>
            <span className="hidden sm:inline">Furigana</span>
          </button>

          <button
            type="button"
            id="btnToggleTranslation"
            aria-pressed={showTranslation}
            onClick={onToggleTranslation}
            title="Tampilkan atau sembunyikan terjemahan bahasa Indonesia"
            className={`w-8 h-8 sm:w-auto sm:min-h-[38px] sm:px-3 sm:py-1.5 rounded-xl border text-xs font-semibold inline-flex items-center justify-center gap-1.5 transition-colors cursor-pointer shrink-0 ${
              showTranslation
                ? 'bg-teal-50 dark:bg-teal-950/70 border-teal-300 dark:border-teal-700 text-teal-800 dark:text-teal-200'
                : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700'
            }`}
          >
            <Languages className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
            <span className="hidden md:inline">Terjemahan</span>
          </button>

          <button
            type="button"
            id="btnToggleTheme"
            aria-pressed={isDark}
            onClick={onToggleTheme}
            aria-label={isDark ? 'Ganti ke mode terang' : 'Ganti ke mode gelap'}
            title={isDark ? 'Mode terang' : 'Mode gelap'}
            className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 inline-flex items-center justify-center transition-colors cursor-pointer shrink-0"
          >
            {isDark ? (
              <Sun className="w-4 h-4" aria-hidden="true" />
            ) : (
              <Moon className="w-4 h-4" aria-hidden="true" />
            )}
          </button>

          {!user ? (
            <>
              <button
                type="button"
                id="btnHeaderExport"
                onClick={onExport}
                aria-label="Backup progres ke file JSON"
                title="Backup progres (.json)"
                className="hidden sm:inline-flex w-10 h-10 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 items-center justify-center transition-colors cursor-pointer shrink-0"
              >
                <Download className="w-4 h-4" aria-hidden="true" />
              </button>
              <button
                type="button"
                id="btnHeaderImport"
                onClick={onTriggerImport}
                aria-label="Restore progres dari file JSON"
                title="Restore progres (.json)"
                className="hidden sm:inline-flex w-10 h-10 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 items-center justify-center transition-colors cursor-pointer shrink-0"
              >
                <FolderOpen className="w-4 h-4" aria-hidden="true" />
              </button>
            </>
          ) : null}

          {user ? (
            <div ref={menuRef} className="relative">
              <button
                ref={menuBtnRef}
                type="button"
                id="btnAccountMenu"
                aria-haspopup="menu"
                aria-expanded={menuOpen}
                aria-label={`Menu akun ${resolvedName}`}
                onClick={() => setMenuOpen(o => !o)}
                className="min-h-[40px] px-2 sm:px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-100 inline-flex items-center gap-2 transition-colors cursor-pointer"
              >
                <span className="relative shrink-0">
                  {resolvedAvatar && !avatarBroken ? (
                    <img
                      src={resolvedAvatar}
                      alt={resolvedName}
                      referrerPolicy="no-referrer"
                      onError={() => setAvatarBroken(true)}
                      className="w-7 h-7 rounded-full border border-slate-200 dark:border-slate-700 object-cover bg-slate-100 dark:bg-slate-700"
                    />
                  ) : (
                    <span
                      aria-hidden="true"
                      className="w-7 h-7 rounded-full border border-indigo-200 dark:border-indigo-700 bg-indigo-50 dark:bg-indigo-950/70 text-indigo-700 dark:text-indigo-200 font-bold text-xs inline-flex items-center justify-center"
                    >
                      {initial}
                    </span>
                  )}
                </span>

                <span className="hidden md:inline text-xs sm:text-sm font-semibold text-slate-800 dark:text-slate-100 max-w-[120px] truncate">
                  {resolvedName}
                </span>

                <ChevronDown
                  className={`w-3.5 h-3.5 text-slate-500 dark:text-slate-400 transition-transform shrink-0 ${
                    menuOpen ? 'rotate-180' : ''
                  }`}
                  aria-hidden="true"
                />
              </button>

              {menuOpen ? (
                <div
                  id="accountMenuDropdown"
                  role="menu"
                  aria-labelledby="btnAccountMenu"
                  className="absolute right-0 mt-2 w-72 sm:w-80 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-xl py-2 z-40"
                >
                  <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800 flex items-start gap-3">
                    {resolvedAvatar && !avatarBroken ? (
                      <img
                        src={resolvedAvatar}
                        alt={resolvedName}
                        referrerPolicy="no-referrer"
                        onError={() => setAvatarBroken(true)}
                        className="w-10 h-10 rounded-full border border-slate-200 dark:border-slate-700 object-cover shrink-0 bg-slate-100 dark:bg-slate-800"
                      />
                    ) : (
                      <span
                        aria-hidden="true"
                        className="w-10 h-10 rounded-full border border-indigo-200 dark:border-indigo-700 bg-indigo-50 dark:bg-indigo-950/70 text-indigo-700 dark:text-indigo-200 font-bold text-sm inline-flex items-center justify-center shrink-0"
                      >
                        {initial}
                      </span>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold text-slate-900 dark:text-slate-50 truncate">
                        {resolvedName}
                      </p>
                      {user.email ? (
                        <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                          {user.email}
                        </p>
                      ) : null}
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 flex flex-wrap items-center gap-1.5">
                        <span
                          className={`font-semibold ${
                            role === 'superadmin'
                              ? 'text-indigo-700 dark:text-indigo-300'
                              : role === 'admin'
                              ? 'text-teal-700 dark:text-teal-300'
                              : 'text-slate-600 dark:text-slate-300'
                          }`}
                        >
                          {isBootstrapSuperAdminEmail(user.email)
                            ? 'Superadmin Utama'
                            : getRoleLabel(role)}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span>{getProviderLabel(user)}</span>
                        <span aria-hidden="true">·</span>
                        {isVerified ? (
                          <span className="text-emerald-700 dark:text-emerald-400 font-medium inline-flex items-center gap-1">
                            <Cloud className="w-3 h-3 shrink-0" aria-hidden="true" />
                            {syncing ? 'Menyinkronkan...' : 'Cloud aktif'}
                          </span>
                        ) : (
                          <span className="text-amber-700 dark:text-amber-400 font-medium inline-flex items-center gap-1">
                            <AlertCircle className="w-3 h-3 shrink-0" aria-hidden="true" />
                            Belum verifikasi email
                          </span>
                        )}
                      </p>
                    </div>
                  </div>

                  {!isVerified ? (
                    <div className="mx-3 my-2 rounded-xl bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800/80 p-2.5 space-y-2">
                      <p className="text-[11px] text-amber-900 dark:text-amber-200 leading-relaxed">
                        Verifikasi email Anda agar progres tersinkronisasi ke cloud.
                      </p>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={onResendVerification}
                          disabled={authBusy}
                          className="px-2.5 py-1 rounded-lg bg-white dark:bg-slate-800 border border-amber-300 dark:border-amber-700 text-[11px] font-semibold text-amber-900 dark:text-amber-200 hover:bg-amber-100 dark:hover:bg-amber-900/50 cursor-pointer"
                        >
                          Kirim Ulang
                        </button>
                        <button
                          type="button"
                          onClick={onRefreshVerification}
                          disabled={authBusy}
                          className="px-2.5 py-1 rounded-lg bg-amber-600 text-[11px] font-semibold text-white hover:bg-amber-700 cursor-pointer"
                        >
                          Cek Status
                        </button>
                      </div>
                    </div>
                  ) : null}

                  <div className="py-1">
                    {isAdminOrAbove && isVerified ? (
                      <button
                        type="button"
                        role="menuitem"
                        id="menuOpenAdminPanel"
                        onClick={() => {
                          setMenuOpen(false);
                          onOpenAdminPanel();
                        }}
                        className="w-full px-4 py-2.5 text-left text-sm font-semibold text-indigo-700 dark:text-indigo-300 hover:bg-indigo-50/70 dark:hover:bg-indigo-950/50 flex items-center gap-2.5 transition-colors cursor-pointer"
                      >
                        {isSuperAdmin ? (
                          <ShieldCheck className="w-4 h-4 shrink-0" aria-hidden="true" />
                        ) : (
                          <Shield className="w-4 h-4 shrink-0" aria-hidden="true" />
                        )}
                        <span>{isSuperAdmin ? 'Panel Superadmin' : 'Panel Admin'}</span>
                      </button>
                    ) : null}

                    <button
                      type="button"
                      role="menuitem"
                      id="menuEditProfile"
                      onClick={() => {
                        setMenuOpen(false);
                        onOpenProfileModal();
                      }}
                      className="w-full px-4 py-2.5 text-left text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-2.5 transition-colors cursor-pointer"
                    >
                      <Camera className="w-4 h-4 shrink-0 text-slate-500 dark:text-slate-400" aria-hidden="true" />
                      <span>Ubah Nama &amp; Foto Profil</span>
                    </button>

                    <button
                      type="button"
                      role="menuitem"
                      id="menuSwitchAccount"
                      onClick={() => {
                        setMenuOpen(false);
                        onOpenAuthModal(true);
                      }}
                      className="w-full px-4 py-2.5 text-left text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-2.5 transition-colors cursor-pointer"
                    >
                      <Users className="w-4 h-4 shrink-0 text-slate-500 dark:text-slate-400" aria-hidden="true" />
                      <span>Ganti Akun</span>
                    </button>

                    <button
                      type="button"
                      role="menuitem"
                      id="menuSyncNow"
                      disabled={!isVerified || syncing}
                      onClick={() => {
                        setMenuOpen(false);
                        onManualSync();
                      }}
                      className="w-full px-4 py-2.5 text-left text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-2.5 transition-colors cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed"
                    >
                      <RefreshCw
                        className={`w-4 h-4 shrink-0 text-slate-500 dark:text-slate-400 ${
                          syncing ? 'animate-spin' : ''
                        }`}
                        aria-hidden="true"
                      />
                      <span>Sinkronkan Progres Sekarang</span>
                    </button>
                  </div>

                  <div className="my-1 border-t border-slate-100 dark:border-slate-800" />

                  <div className="py-1">
                    <button
                      type="button"
                      role="menuitem"
                      id="menuExportBackup"
                      onClick={() => {
                        setMenuOpen(false);
                        onExport();
                      }}
                      className="w-full px-4 py-2.5 text-left text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-2.5 transition-colors cursor-pointer"
                    >
                      <Download className="w-4 h-4 shrink-0 text-slate-500 dark:text-slate-400" aria-hidden="true" />
                      <span>Backup Progres (.json)</span>
                    </button>

                    <button
                      type="button"
                      role="menuitem"
                      id="menuImportBackup"
                      onClick={() => {
                        setMenuOpen(false);
                        onTriggerImport();
                      }}
                      className="w-full px-4 py-2.5 text-left text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-2.5 transition-colors cursor-pointer"
                    >
                      <FolderOpen className="w-4 h-4 shrink-0 text-slate-500 dark:text-slate-400" aria-hidden="true" />
                      <span>Restore dari File (.json)</span>
                    </button>
                  </div>

                  <div className="my-1 border-t border-slate-100 dark:border-slate-800" />

                  <button
                    type="button"
                    role="menuitem"
                    id="btnSignOut"
                    disabled={authBusy}
                    onClick={() => {
                      setMenuOpen(false);
                      onSignOut();
                    }}
                    className="w-full px-4 py-2.5 text-left text-sm font-semibold text-rose-700 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/50 flex items-center gap-2.5 transition-colors cursor-pointer disabled:opacity-50"
                  >
                    <LogOut className="w-4 h-4 shrink-0" aria-hidden="true" />
                    <span>Keluar</span>
                  </button>
                </div>
              ) : null}
            </div>
          ) : (
            <button
              type="button"
              id="btnOpenAuthModal"
              onClick={() => onOpenAuthModal(false)}
              disabled={authBusy}
              className="min-h-[38px] px-3 sm:px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs sm:text-sm font-semibold inline-flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-50"
            >
              <LogIn className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span>Masuk</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
