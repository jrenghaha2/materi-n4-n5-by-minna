import { useCallback, useEffect, useState } from 'react';
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  reload,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
  type User,
} from 'firebase/auth';
import { auth, githubProvider, googleProvider } from '../firebase';
import { getAuthErrorMessage } from '../utils/authErrors';
import type { ToastTone } from './useToast';

interface UseAuthActionsOptions {
  showToast: (message: string, tone?: ToastTone) => void;
}

export function useAuthActions({ showToast }: UseAuthActionsOptions) {
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [authBusy, setAuthBusy] = useState(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, current => {
      setUser(current);
      setAuthReady(true);
    });
    return () => unsub();
  }, []);

  const signInWithGoogle = useCallback(async (): Promise<boolean> => {
    setAuthBusy(true);
    try {
      await signInWithPopup(auth, googleProvider);
      showToast('Berhasil masuk dengan akun Google.', 'success');
      return true;
    } catch (error) {
      showToast(getAuthErrorMessage(error), 'error');
      return false;
    } finally {
      setAuthBusy(false);
    }
  }, [showToast]);

  const signInWithGithub = useCallback(async (): Promise<boolean> => {
    setAuthBusy(true);
    try {
      await signInWithPopup(auth, githubProvider);
      showToast('Berhasil masuk dengan akun GitHub.', 'success');
      return true;
    } catch (error) {
      showToast(getAuthErrorMessage(error), 'error');
      return false;
    } finally {
      setAuthBusy(false);
    }
  }, [showToast]);

  const signInWithEmail = useCallback(
    async (email: string, password: string): Promise<boolean> => {
      setAuthBusy(true);
      try {
        await signInWithEmailAndPassword(auth, email.trim(), password);
        showToast('Berhasil masuk ke akun Anda.', 'success');
        return true;
      } catch (error) {
        showToast(getAuthErrorMessage(error), 'error');
        return false;
      } finally {
        setAuthBusy(false);
      }
    },
    [showToast]
  );

  const registerWithEmail = useCallback(
    async (name: string, email: string, password: string): Promise<boolean> => {
      setAuthBusy(true);
      try {
        const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
        const trimmedName = name.trim();
        if (trimmedName) {
          await updateProfile(cred.user, { displayName: trimmedName });
        }
        try {
          await sendEmailVerification(cred.user);
        } catch {
          // Ignore verification email rate-limit during registration
        }
        showToast(
          'Akun berhasil dibuat! Cek email Anda untuk verifikasi agar cloud sync aktif.',
          'success'
        );
        return true;
      } catch (error) {
        showToast(getAuthErrorMessage(error), 'error');
        return false;
      } finally {
        setAuthBusy(false);
      }
    },
    [showToast]
  );

  const requestPasswordReset = useCallback(
    async (email: string): Promise<boolean> => {
      setAuthBusy(true);
      try {
        await sendPasswordResetEmail(auth, email.trim());
        showToast('Tautan reset kata sandi telah dikirim ke email Anda.', 'success');
        return true;
      } catch (error) {
        showToast(getAuthErrorMessage(error), 'error');
        return false;
      } finally {
        setAuthBusy(false);
      }
    },
    [showToast]
  );

  const resendVerificationEmail = useCallback(async (): Promise<void> => {
    if (!auth.currentUser) return;
    setAuthBusy(true);
    try {
      await sendEmailVerification(auth.currentUser);
      showToast('Email verifikasi baru telah dikirim. Periksa kotak masuk atau spam.', 'success');
    } catch (error) {
      showToast(getAuthErrorMessage(error), 'error');
    } finally {
      setAuthBusy(false);
    }
  }, [showToast]);

  const refreshVerificationStatus = useCallback(async (): Promise<void> => {
    if (!auth.currentUser) return;
    setAuthBusy(true);
    try {
      await reload(auth.currentUser);
      const updated = auth.currentUser;
      setUser(updated ? ({ ...updated } as User) : null);
      if (updated?.emailVerified) {
        showToast('Email terverifikasi! Sinkronisasi cloud kini aktif.', 'success');
      } else {
        showToast('Email belum terverifikasi. Klik tautan di inbox Anda lalu coba lagi.', 'info');
      }
    } catch (error) {
      showToast(getAuthErrorMessage(error), 'error');
    } finally {
      setAuthBusy(false);
    }
  }, [showToast]);

  const handleSignOut = useCallback(async (): Promise<void> => {
    setAuthBusy(true);
    try {
      await signOut(auth);
      showToast('Anda telah keluar. Progres lokal tetap tersimpan di browser.', 'info');
    } catch (error) {
      showToast(getAuthErrorMessage(error), 'error');
    } finally {
      setAuthBusy(false);
    }
  }, [showToast]);

  return {
    user,
    authReady,
    authBusy,
    isVerified: Boolean(user?.emailVerified),
    signInWithGoogle,
    signInWithGithub,
    signInWithEmail,
    registerWithEmail,
    requestPasswordReset,
    resendVerificationEmail,
    refreshVerificationStatus,
    handleSignOut,
  };
}
