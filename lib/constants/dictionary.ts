/**
 * @module lib/constants/dictionary
 * 盆栽用語辞典の runtime 仕様値。
 *
 * Why seed と分離するか:
 *   元は `prisma/seed/dictionary/seed-dictionary.ts` に同居していたが、
 *   client component (`DictionarySearch`) や page が seed module を import すると
 *   bundle / tree shake / 保守境界が崩れる。runtime はここを参照し、
 *   seed 側はここを import してデータを作る側に回す。
 */

export const DICTIONARY_CATEGORIES = [
  '樹形',
  '技術・作業',
  '管理・育成',
  '道具・用品',
  '盆器・鉢',
  '用土・肥料',
  '展示・鑑賞',
] as const

export type DictionaryCategory = (typeof DICTIONARY_CATEGORIES)[number]

export function isDictionaryCategory(value: unknown): value is DictionaryCategory {
  if (typeof value !== 'string') return false
  return (DICTIONARY_CATEGORIES as readonly string[]).includes(value)
}

export const KANA_ROW_LABELS = [
  'あ行',
  'か行',
  'さ行',
  'た行',
  'な行',
  'は行',
  'ま行',
  'や行',
  'ら行',
  'わ行',
] as const

export type KanaRowLabel = (typeof KANA_ROW_LABELS)[number]

export function isKanaRowLabel(value: unknown): value is KanaRowLabel {
  if (typeof value !== 'string') return false
  return (KANA_ROW_LABELS as readonly string[]).includes(value)
}

/**
 * 五十音行のラベルと、その行に属する読みかな先頭文字パターン。
 * 濁音 / 半濁音も同じ行に含めるためレンジ表記を使う。
 */
export const KANA_ROWS: ReadonlyArray<{ label: KanaRowLabel; pattern: RegExp }> = [
  { label: 'あ行', pattern: /^[あいうえお]/ },
  { label: 'か行', pattern: /^[かきくけこが-ご]/ },
  { label: 'さ行', pattern: /^[さしすせそざ-ぞ]/ },
  { label: 'た行', pattern: /^[たちつてとだ-ど]/ },
  { label: 'な行', pattern: /^[なにぬねの]/ },
  { label: 'は行', pattern: /^[はひふへほば-ぼぱ-ぽ]/ },
  { label: 'ま行', pattern: /^[まみむめも]/ },
  { label: 'や行', pattern: /^[やゆよ]/ },
  { label: 'ら行', pattern: /^[らりるれろ]/ },
  { label: 'わ行', pattern: /^[わをん]/ },
]
