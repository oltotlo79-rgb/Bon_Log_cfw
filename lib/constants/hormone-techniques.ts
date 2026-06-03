/**
 * ホルモン×盆栽技法 関連定数
 *
 * 盆栽技法の定義、ホルモン効果の表示設定、
 * ダイアグラム・シミュレーター・カレンダーの共通定数を集約。
 *
 * @module lib/constants/hormone-techniques
 */

export const BONSAI_TECHNIQUES = [
  { slug: 'pinching', name: '摘芯（芽摘み）', nameEn: 'Pinching', description: '頂芽を摘むことでオーキシン源を除去し側芽の発生を促す' },
  { slug: 'pruning', name: '剪定', nameEn: 'Pruning', description: '不要な枝を切除し樹形を整える' },
  { slug: 'wiring', name: '針金掛け', nameEn: 'Wiring', description: '針金で枝に機械的ストレスを与え方向を矯正する' },
  { slug: 'repotting', name: '植替え', nameEn: 'Repotting', description: '根を整理し新しい用土に植え替える' },
  { slug: 'defoliation', name: '葉刈り', nameEn: 'Defoliation', description: '全葉を切除し小さな新葉の発生を促す' },
  { slug: 'air-layering', name: '取り木', nameEn: 'Air Layering', description: '幹の樹皮を環状に剥いで不定根を誘導する' },
  { slug: 'cuttings', name: '挿し木', nameEn: 'Cuttings', description: '切り枝を用土に挿して発根させ新個体を得る' },
  { slug: 'watering-management', name: '水やり管理', nameEn: 'Watering Management', description: '水分ストレスを調整して生育を制御する' },
  { slug: 'light-management', name: '日照管理', nameEn: 'Light Management', description: '日照条件を調整して成長方向や花芽形成を制御する' },
] as const

export type BonsaiTechniqueSlug = (typeof BONSAI_TECHNIQUES)[number]['slug']

/** effectType の日本語ラベル */
export const TECHNIQUE_EFFECT_TYPE_LABELS: Record<string, string> = {
  increase: '増加',
  decrease: '減少',
  redistribute: '再分配',
  combined: '複合効果',
}

/** effectType の Tailwind カラー設定 */
export const TECHNIQUE_EFFECT_TYPE_COLORS: Record<string, { text: string; bg: string; darkBg: string }> = {
  increase: { text: 'text-green-800', bg: 'bg-green-100', darkBg: 'dark:bg-green-900/30 dark:text-green-400' },
  decrease: { text: 'text-red-800', bg: 'bg-red-100', darkBg: 'dark:bg-red-900/30 dark:text-red-400' },
  redistribute: { text: 'text-blue-800', bg: 'bg-blue-100', darkBg: 'dark:bg-blue-900/30 dark:text-blue-400' },
}

/** magnitude の日本語ラベル */
export const TECHNIQUE_MAGNITUDE_LABELS: Record<string, string> = {
  strong: '強',
  moderate: '中',
  mild: '弱',
}

/** magnitude の Tailwind カラー設定 */
export const TECHNIQUE_MAGNITUDE_COLORS: Record<string, string> = {
  strong: 'bg-green-500',
  moderate: 'bg-yellow-500',
  mild: 'bg-gray-400',
}

export type HormoneActivityLevel = 'high' | 'moderate' | 'low' | 'minimal'

/** 活性レベル → 色・ラベル・数値 */
export const HORMONE_LEVEL_CONFIG: Record<HormoneActivityLevel, { color: string; label: string; numericValue: number }> = {
  high: { color: 'bg-green-500', label: '高', numericValue: 3 },
  moderate: { color: 'bg-yellow-500', label: '中', numericValue: 2 },
  low: { color: 'bg-orange-400', label: '低', numericValue: 1 },
  minimal: { color: 'bg-gray-300 dark:bg-gray-600', label: '微', numericValue: 0 },
}

/** value が `HormoneActivityLevel` か判定する。DB から来る不明値の narrowing に使う。 */
export function isHormoneActivityLevel(value: string): value is HormoneActivityLevel {
  return value === 'high' || value === 'moderate' || value === 'low' || value === 'minimal'
}

/** 月ラベル配列（1月〜12月） */
export const MONTH_LABELS = [
  '1月', '2月', '3月', '4月', '5月', '6月',
  '7月', '8月', '9月', '10月', '11月', '12月',
] as const

/** SVG ビューボックス */
export const DIAGRAM_SVG_WIDTH = 600
export const DIAGRAM_SVG_HEIGHT = 500

/** ノード半径（px） */
export const DIAGRAM_NODE_RADIUS = 28

/** ノードラベルのフォントサイズ（px） */
export const DIAGRAM_NODE_LABEL_FONT_SIZE = 11

/** この文字数を超えるノード名は省略表示する */
export const DIAGRAM_NODE_LABEL_MAX_LENGTH = 5

/** 省略時に残す先頭文字数（末尾に … を付与） */
export const DIAGRAM_NODE_LABEL_TRUNCATE_LENGTH = 4

/** インタラクションタイプ → エッジ色 */
export const INTERACTION_EDGE_COLORS: Record<string, string> = {
  synergistic: '#22c55e',   // green-500
  antagonistic: '#ef4444',  // red-500
  modulatory: '#eab308',    // yellow-500
}

/** インタラクションタイプ → 日本語ラベル */
export const INTERACTION_TYPE_LABELS: Record<string, string> = {
  synergistic: '相乗',
  antagonistic: '拮抗',
  modulatory: '調節',
}

/** magnitude → 数値変化量 */
export const SIMULATOR_MAGNITUDE_DELTA: Record<string, number> = {
  strong: 2,
  moderate: 1,
  mild: 0.5,
}

/** シミュレーターの最大レベル値 */
export const SIMULATOR_MAX_LEVEL = 4

/** シミュレーターの最小レベル値 */
export const SIMULATOR_MIN_LEVEL = 0

/** 数値 → レベルラベルの変換閾値 */
export const SIMULATOR_LEVEL_THRESHOLDS = [
  { min: 2.5, level: 'high' },
  { min: 1.5, level: 'moderate' },
  { min: 0.5, level: 'low' },
  { min: 0, level: 'minimal' },
] as const
