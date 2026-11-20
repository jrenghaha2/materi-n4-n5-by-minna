import { AVATAR_URL_MAX_LENGTH } from './bunpouSync';

export interface PresetAvatar {
  id: string;
  kanji: string;
  label: string;
  bgFrom: string;
  bgTo: string;
}

export const PRESET_AVATARS: PresetAvatar[] = [
  { id: 'bun', kanji: '文', label: 'Tata Bahasa (Bun)', bgFrom: '#4f46e5', bgTo: '#3730a3' },
  { id: 'manabu', kanji: '学', label: 'Belajar (Gaku)', bgFrom: '#0d9488', bgTo: '#115e59' },
  { id: 'sakura', kanji: '桜', label: 'Sakura', bgFrom: '#e11d48', bgTo: '#9f1239' },
  { id: 'michi', kanji: '道', label: 'Jalan Belajar (Michi)', bgFrom: '#d97706', bgTo: '#92400e' },
  { id: 'kokoro', kanji: '心', label: 'Semangat (Kokoro)', bgFrom: '#7c3aed', bgTo: '#5b21b6' },
  { id: 'hikari', kanji: '光', label: 'Cahaya (Hikari)', bgFrom: '#0284c7', bgTo: '#075985' },
];

export function renderPresetKanjiAvatar(preset: PresetAvatar): string {
  const size = 160;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Browser tidak mendukung pembuatan gambar avatar.');
  }

  const grad = ctx.createLinearGradient(0, 0, size, size);
  grad.addColorStop(0, preset.bgFrom);
  grad.addColorStop(1, preset.bgTo);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);

  ctx.fillStyle = '#ffffff';
  ctx.font = '700 84px "Noto Sans JP", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(preset.kanji, size / 2, size / 2 + 4);

  const dataUrl = canvas.toDataURL('image/png');
  if (dataUrl.length > AVATAR_URL_MAX_LENGTH) {
    throw new Error('Ukuran avatar melebihi batas yang diizinkan.');
  }
  return dataUrl;
}

export async function compressAvatarFile(file: File): Promise<string> {
  if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
    throw new Error('Gunakan file gambar berformat PNG, JPG, atau WebP.');
  }
  if (file.size > 5 * 1024 * 1024) {
    throw new Error('Ukuran file gambar maksimal 5 MB.');
  }

  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Gagal membaca file gambar.'));
    };
    image.src = objectUrl;
  });

  const targetSize = 144;
  const canvas = document.createElement('canvas');
  canvas.width = targetSize;
  canvas.height = targetSize;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Browser tidak mendukung kompresi gambar.');
  }

  const minDim = Math.min(img.width, img.height);
  const sx = (img.width - minDim) / 2;
  const sy = (img.height - minDim) / 2;
  ctx.drawImage(img, sx, sy, minDim, minDim, 0, 0, targetSize, targetSize);

  const qualities = [0.82, 0.68, 0.55, 0.42];
  for (const q of qualities) {
    const dataUrl = canvas.toDataURL('image/webp', q);
    if (dataUrl.startsWith('data:image/webp') && dataUrl.length <= AVATAR_URL_MAX_LENGTH) {
      return dataUrl;
    }
    const jpegUrl = canvas.toDataURL('image/jpeg', q);
    if (jpegUrl.length <= AVATAR_URL_MAX_LENGTH) {
      return jpegUrl;
    }
  }

  throw new Error('Gambar terlalu besar setelah dikompres. Coba gambar lain.');
}
