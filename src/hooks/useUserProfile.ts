import { useCallback, useEffect, useRef, useState } from 'react';
import type { User } from 'firebase/auth';
import {
  autoHealUserProfileDoc,
  createUserProfileDoc,
  subscribeUserProfileDoc,
  updateUserProfileDoc,
} from '../services/cloudSyncService';
import type { UserProfileDoc, UserRole } from '../types/bunpou';
import { sanitizeAvatarUrl, sanitizeDisplayName } from '../utils/bunpouSync';
import {
  isAdminOrAboveRole,
  isBootstrapSuperAdminEmail,
  isSuperAdminRole,
  normalizeEmail,
  resolveEffectiveRole,
} from '../utils/rbac';
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
  const initializedUidRef = useRef<string | null>(null);
  const healAttemptedUidRef = useRef<string | null>(null);

  useEffect(() => {
    if (!user || !isVerified) {
      setProfile(null);
      setProfileReady(false);
      initializedUidRef.current = null;
      healAttemptedUidRef.current = null;
      return;
    }

    let cancelled = false;
    const authEmail = normalizeEmail(user.email);
    const isBootstrap = isBootstrapSuperAdminEmail(authEmail);
    const fallbackName = sanitizeDisplayName(
      user.displayName || authEmail.split('@')[0],
      'Pengguna'
    );
    const fallbackAvatar = sanitizeAvatarUrl(user.photoURL);
    const fallbackRole: UserRole = isBootstrap ? 'superadmin' : 'user';

    const unsub = subscribeUserProfileDoc(
      user.uid,
      snapshot => {
        if (cancelled) return;

        if (!snapshot.exists) {
          if (initializedUidRef.current === user.uid) return;
          initializedUidRef.current = user.uid;
          const initial: UserProfileDoc & { role: UserRole } = {
            displayName: fallbackName,
            email: authEmail,
            avatarUrl: fallbackAvatar,
            role: fallbackRole,
          };
          void createUserProfileDoc(user.uid, initial)
            .then(() => {
              if (cancelled) return;
              setProfile(initial);
              setProfileReady(true);
            })
            .catch(error => {
              if (cancelled) return;
              initializedUidRef.current = null;
              setProfile(initial);
              setProfileReady(false);
              if (isFirestoreQuotaError(error)) {
                showToast('Kuota Firestore tercapai. Profil dimuat secara lokal.', 'error', {
                  actionLabel: 'Lihat Kuota',
                  actionHref: getFirestoreUpgradeUrl(),
                });
              }
            });
          return;
        }

        const remote = snapshot.profile!;
        const effectiveRole = resolveEffectiveRole(remote.role, authEmail, isVerified);
        const mergedProfile: UserProfileDoc = {
          displayName: snapshot.hasDisplayNameField ? remote.displayName : fallbackName,
          email: snapshot.hasEmailField ? remote.email : authEmail,
          avatarUrl: snapshot.hasAvatarField ? remote.avatarUrl : fallbackAvatar,
          role: effectiveRole,
        };

        setProfile(mergedProfile);
        setProfileReady(true);

        // Auto-heal legacy user docs missing email, displayName, avatarUrl, or role
        // without overwriting existing roles (except ensuring Bootstrap Superadmin is always superadmin)
        if (healAttemptedUidRef.current !== user.uid) {
          const healPatch: {
            displayName?: string;
            email?: string;
            avatarUrl?: string;
            role?: UserRole;
          } = {};

          if (!snapshot.hasEmailField && authEmail) {
            healPatch.email = authEmail;
          }
          if (!snapshot.hasDisplayNameField && fallbackName) {
            healPatch.displayName = fallbackName;
          }
          if (!snapshot.hasAvatarField && fallbackAvatar) {
            healPatch.avatarUrl = fallbackAvatar;
          }
          if (isBootstrap && remote.role !== 'superadmin') {
            healPatch.role = 'superadmin';
          } else if (!snapshot.hasRoleField) {
            healPatch.role = 'user';
          }

          if (Object.keys(healPatch).length > 0) {
            healAttemptedUidRef.current = user.uid;
            void autoHealUserProfileDoc(user.uid, healPatch).catch(() => {
              // Keep working cleanly even if background auto-heal hits transient network/quota error
            });
          } else {
            healAttemptedUidRef.current = user.uid;
          }
        }
      },
      error => {
        if (cancelled) return;
        setProfile({
          displayName: fallbackName,
          email: authEmail,
          avatarUrl: fallbackAvatar,
          role: fallbackRole,
        });
        setProfileReady(false);
        if (isFirestoreQuotaError(error)) {
          showToast('Kuota Firestore tercapai. Profil dimuat secara lokal.', 'error', {
            actionLabel: 'Lihat Kuota',
            actionHref: getFirestoreUpgradeUrl(),
          });
        }
      }
    );

    return () => {
      cancelled = true;
      unsub();
    };
  }, [user, isVerified, showToast]);

  const effectiveRole: UserRole =
    user && isVerified
      ? resolveEffectiveRole(profile?.role, user.email, isVerified)
      : 'user';

  const saveProfile = useCallback(
    async (displayName: string, avatarUrl: string): Promise<boolean> => {
      if (!user || !isVerified) {
        showToast('Verifikasi email terlebih dahulu untuk menyimpan profil ke cloud.', 'info');
        return false;
      }

      const authEmail = normalizeEmail(user.email);
      const next: UserProfileDoc & { role: UserRole } = {
        displayName: sanitizeDisplayName(displayName, 'Pengguna'),
        email: authEmail,
        avatarUrl: sanitizeAvatarUrl(avatarUrl),
        role: effectiveRole,
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
    [user, isVerified, profileReady, effectiveRole, showToast]
  );

  return {
    profile,
    profileReady,
    savingProfile,
    role: effectiveRole,
    isAdminOrAbove: isAdminOrAboveRole(effectiveRole),
    isSuperAdmin: isSuperAdminRole(effectiveRole),
    saveProfile,
  };
}
