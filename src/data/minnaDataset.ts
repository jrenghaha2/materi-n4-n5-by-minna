import type { AbbreviationEntry, BookData, BookId, BunpouPattern } from '../types/bunpou';
import { buildMinnaBook } from './minnaTypes';
import { MINNA_N5_CHAPTERS_PART_1 } from './minnaN5Part1';
import { MINNA_N5_CHAPTERS_PART_2 } from './minnaN5Part2';
import { MINNA_N4_CHAPTERS_PART_1 } from './minnaN4Part1';
import { MINNA_N4_CHAPTERS_PART_2 } from './minnaN4Part2';

export const N5_BOOK_DATA: BookData = buildMinnaBook(
  {
    id: 'n5',
    shortTitle: 'Minna N5 (Buku I)',
    fullTitle: 'Minna no Nihongo I — JLPT N5',
    japaneseSubtitle: 'みんなの日本語 初級 I（第1課〜第25課）',
    level: 'JLPT N5',
    badgeLabel: 'Bab 1–25 · Dasar',
  },
  [...MINNA_N5_CHAPTERS_PART_1, ...MINNA_N5_CHAPTERS_PART_2]
);

export const N4_BOOK_DATA: BookData = buildMinnaBook(
  {
    id: 'n4',
    shortTitle: 'Minna N4 (Buku II)',
    fullTitle: 'Minna no Nihongo II — JLPT N4',
    japaneseSubtitle: 'みんなの日本語 初級 II（第26課〜第50課）',
    level: 'JLPT N4',
    badgeLabel: 'Bab 26–50 · Menengah Awal',
  },
  [...MINNA_N4_CHAPTERS_PART_1, ...MINNA_N4_CHAPTERS_PART_2]
);

export const MINNA_BOOKS: BookData[] = [N5_BOOK_DATA, N4_BOOK_DATA];

export const BOOKS_BY_ID: Record<BookId, BookData> = {
  n5: N5_BOOK_DATA,
  n4: N4_BOOK_DATA,
};

export const ALL_MINNA_PATTERNS: BunpouPattern[] = MINNA_BOOKS.flatMap(book => book.patterns);

export function getBookData(bookId: BookId): BookData {
  return BOOKS_BY_ID[bookId] ?? N5_BOOK_DATA;
}

export const MINNA_ABBREVIATIONS: AbbreviationEntry[] = [
  {
    code: 'KB',
    meaning: 'Kata Benda (名詞 / Meishi)',
    example: '本 (buku), 学生 (pelajar), 日本語 (bahasa Jepang)',
  },
  {
    code: 'KK',
    meaning: 'Kata Kerja (動詞 / Doushi)',
    example: '行きます (pergi), 食べます (makan), 勉強します (belajar)',
  },
  {
    code: 'KS-い',
    meaning: 'Kata Sifat berakhiran い (い形容詞)',
    example: '高い (tinggi/mahal), おいしい (enak), いい (bagus)',
  },
  {
    code: 'KS-な',
    meaning: 'Kata Sifat な (な形容詞)',
    example: 'きれい[な] (indah), 静か[な] (tenang), 親切[な] (ramah)',
  },
  {
    code: 'G1 / G2 / G3',
    meaning: '3 Kelompok Kata Kerja Jepang (Grup 1, 2, 3)',
    example: 'G1: 書きます・飲みます | G2: 食べます・見ます | G3: します・来ます',
  },
  {
    code: 'F.ます',
    meaning: 'Bentuk Sopan Kata Kerja (ます形)',
    example: '行きます (pergi), 食べます (makan), 勉強します (belajar)',
  },
  {
    code: 'F.て',
    meaning: 'Bentuk て (て形 — sambung, permintaan, izin)',
    example: '書いて, 飲んで, 食べて, 行って (Bab 14)',
  },
  {
    code: 'F.ない',
    meaning: 'Bentuk Negatif Kasual (ない形)',
    example: '書かない, 買わない, 食べない, しない, こない (Bab 17)',
  },
  {
    code: 'F.Kamus',
    meaning: 'Bentuk Kamus / Dasar (辞書形)',
    example: '書く, 飲む, 食べる, する, くる (Bab 18)',
  },
  {
    code: 'F.た',
    meaning: 'Bentuk Lampau Kasual (た形)',
    example: '書いた, 飲んだ, 食べた, した, きた (Bab 19)',
  },
  {
    code: 'F.Biasa',
    meaning: 'Bentuk Biasa / Kasual (普通形)',
    example: '行く・行かない・行った・高かった・雨だ (Bab 20)',
  },
  {
    code: 'F.Potensial',
    meaning: 'Bentuk "Bisa" (可能形)',
    example: '話せます, 食べられます, できます, こられます (Bab 27)',
  },
  {
    code: 'F.Niat',
    meaning: 'Bentuk Niat / Ajakan Kasual (意向形)',
    example: '行こう, 食べよう, しよう, こよう (Bab 31)',
  },
  {
    code: 'F.Perintah / Larangan',
    meaning: 'Bentuk Perintah (命令形) & Larangan (禁止形)',
    example: '急げ! / 食べろ! / 入るな! (Bab 33)',
  },
  {
    code: 'F.ば',
    meaning: 'Bentuk Pengandaian Bersyarat (条件形)',
    example: '行けば, 食べれば, 安ければ, なければ (Bab 35)',
  },
  {
    code: 'F.Pasif',
    meaning: 'Bentuk Pasif "di-..." (受身形)',
    example: 'ほめられました, 踏まれました, 読まれています (Bab 37)',
  },
  {
    code: 'F.Kausatif',
    meaning: 'Bentuk Kausatif "menyuruh/membiarkan" (使役形)',
    example: '書かせます, 食べさせます, 留学させます (Bab 48)',
  },
  {
    code: '尊敬語 / 謙譲語',
    meaning: 'Bahasa Hormat Meninggikan Lawan vs Merendahkan Diri',
    example: 'いらっしゃいます・召し上がります (Bab 49) vs まいります・申します (Bab 50)',
  },
];
