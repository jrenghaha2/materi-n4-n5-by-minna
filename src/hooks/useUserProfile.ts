import { useCallback, useEffect, useState } from 'react';
import type { User } from 'firebase/auth';
import {
  createUserProfileDoc,
  fetchUserProfileDoc,
  updateUserProfileDoc,
} from '../services/cloudSyncService';
import type { UserProfileDoc } from '../types/bunpou';
import { sanitizeAvatarUrl, sanitizeDisplayName } from '../utils/bunpouSync';
import { getFirestoreUpgradeUrl, isFirestoreQuotaError } from '../firebase';
import type { ToastTone } from './useToast';

interface UseUserProfileOptions {
  user: User | null;
  isVerified: boolean;
  showToast: (
    message: string,
    tone?: ToastTone,
    options?: { durationMs?: number; actionLabel?: string; actionHref?: string }
  ) => void;
}

export function useUserProfile({ user, isVerified, showToast }: UseUserProfileOptions) {
  const [profile, setProfile] = useState<UserProfileDoc | null>(null);
  const [profileReady, setProfileReady] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!user || !isVerified) {
      setProfile(null);
      setProfileReady(false);
      return;
    }

    const fallbackName = sanitizeDisplayName(
      user.displayName || user.email?.split('@')[0],
      'Pengguna'
    );
    const fallbackAvatar = sanitizeAvatarUrl(user.photoURL);

    (async () => {
      try {
        const remote = await fetchUserProfileDoc(user.uid);
        if (cancelled) return;
        if (remote) {
          setProfile(remote);
          setProfileReady(true);
        } else {
          const initial: UserProfileDoc = {
            displayName: fallbackName,
            avatarUrl: fallbackAvatar,
          };
          await createUserProfileDoc(user.uid, initial);
          if (cancelled) return;
          setProfile(initial);
          setProfileReady(true);
        }
      } catch (error) {
        if (cancelled) return;
        setProfile({ displayName: fallbackName, avatarUrl: fallbackAvatar });
        setProfileReady(false);
        if (isFirestoreQuotaError(error)) {
          showToast('Kuota Firestore tercapai. Profil dimuat secara lokal.', 'error', {
            actionLabel: 'Lihat Kuota',
            actionHref: getFirestoreUpgradeUrl(),
          });
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user, isVerified, showToast]);

  const saveProfile = useCallback(
    async (displayName: string, avatarUrl: string): Promise<boolean> => {
      if (!user || !isVerified) {
        showToast('Verifikasi email terlebih dahulu untuk menyimpan profil ke cloud.', 'info');
        return false;
      }

      const next: UserProfileDoc = {
        displayName: sanitizeDisplayName(displayName, 'Pengguna'),
        avatarUrl: sanitizeAvatarUrl(avatarUrl),
      };

      setSavingProfile(true);
      try {
        if (profileReady) {
          await updateUserProfileDoc(user.uid, next);
        } else {
          await createUserProfileDoc(user.uid, next);
          setProfileReady(true);
        }
        setProfile(next);
        showToast('Profil berhasil diperbarui.', 'success');
        return true;
      } catch (error) {
        if (isFirestoreQuotaError(error)) {
          showToast('Gagal menyimpan profil: kuota Firestore tercapai.', 'error', {
            actionLabel: 'Lihat Kuota',
            actionHref: getFirestoreUpgradeUrl(),
          });
        } else {
          showToast('Gagal menyimpan profil ke cloud. Coba lagi sebentar lagi.', 'error');
        }
        return false;
      } finally {
        setSavingProfile(false);
      }
    },
    [user, isVerified, profileReady, showToast]
  );

  return {
    profile,
    profileReady,
    savingProfile,
    saveProfile,
  };
}
