export function getAuthErrorMessage(error: unknown): string {
  const code =
    error && typeof error === 'object' && 'code' in error
      ? String((error as { code?: unknown }).code)
      : '';

  switch (code) {
    case 'auth/popup-closed-by-user':
      return 'Jendela login ditutup sebelum proses selesai.';
    case 'auth/popup-blocked':
      return 'Popup login diblokir browser. Izinkan popup untuk situs ini lalu coba lagi.';
    case 'auth/cancelled-popup-request':
      return 'Permintaan login dibatalkan karena ada jendela login lain yang terbuka.';
    case 'auth/invalid-email':
      return 'Format alamat email tidak valid.';
    case 'auth/user-not-found':
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
      return 'Email atau kata sandi salah. Periksa kembali lalu coba lagi.';
    case 'auth/email-already-in-use':
      return 'Email ini sudah terdaftar. Silakan masuk atau gunakan email lain.';
    case 'auth/weak-password':
      return 'Kata sandi terlalu lemah. Gunakan minimal 6 karakter.';
    case 'auth/too-many-requests':
      return 'Terlalu banyak percobaan. Tunggu beberapa menit lalu coba lagi.';
    case 'auth/network-request-failed':
      return 'Koneksi internet bermasalah. Periksa jaringan Anda lalu coba lagi.';
    case 'auth/account-exists-with-different-credential':
      return 'Akun dengan email ini sudah terdaftar menggunakan metode masuk lain (misal Google/Email).';
    case 'auth/operation-not-allowed':
      return 'Metode masuk ini belum diaktifkan di Firebase Console (Authentication → Sign-in method).';
    case 'auth/unauthorized-domain':
      return 'Domain ini belum terdaftar di Authorized Domains Firebase Authentication.';
    default:
      return error instanceof Error && error.message
        ? `Gagal autentikasi: ${error.message}`
        : 'Terjadi kesalahan saat proses autentikasi.';
  }
}
