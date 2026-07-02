/**
 * 農薬データの入力境界値。
 *
 * Why: Prisma スキーマ (`schema.prisma model Pesticide`) の VarChar/Text 制限と
 * 1:1 で対応させ、Action 層の Zod バリデーションで早期に弾けるようにする。
 *
 * @module lib/constants/limits/pesticide
 */

/** 農薬名の最大文字数 (schema: VarChar(200)) */
export const MAX_PESTICIDE_NAME_LENGTH = 200

/** 農薬登録番号の最大文字数 (schema: VarChar(20)) */
export const MAX_PESTICIDE_REGISTRATION_NUMBER_LENGTH = 20

/**
 * 農薬説明文の最大文字数。
 * schema は `@db.Text` で無制限だが、UI 表示と DB 転送量の観点で 2000 文字に制限する
 * (お問い合わせメッセージ MAX_CONTACT_MESSAGE_LENGTH と同水準)。
 */
export const MAX_PESTICIDE_DESCRIPTION_LENGTH = 2000

/**
 * 散布ガイド (`/pesticides/spray-guide`) で表示する希釈計算テーブルの軸。
 * UI ロジックではなく薬剤散布のドメイン定数として扱う。
 *
 * - SPRAY_DILUTION_RATIOS: 希釈倍率の代表値 (500/1000/1500/2000 倍)
 * - SPRAY_WATER_VOLUMES_ML: 水量の代表値 (500/1000/2000/5000 mL)
 */
export const SPRAY_DILUTION_RATIOS = [500, 1000, 1500, 2000] as const
export const SPRAY_WATER_VOLUMES_ML = [500, 1000, 2000, 5000] as const

/**
 * 希釈計算機 UI のプリセット。スプレー散布の標準値より範囲が広く、
 * 教育目的 (薬剤希釈の感覚値を視覚化) で 3000 倍 / 10L まで含む。
 */
export const DILUTION_CALCULATOR_RATIO_PRESETS = [
  { label: '500倍', value: 500 },
  { label: '1000倍', value: 1000 },
  { label: '1500倍', value: 1500 },
  { label: '2000倍', value: 2000 },
  { label: '3000倍', value: 3000 },
] as const

export const DILUTION_CALCULATOR_WATER_PRESETS = [
  { label: '500mL', value: 500 },
  { label: '1L', value: 1000 },
  { label: '2L', value: 2000 },
  { label: '5L', value: 5000 },
  { label: '10L', value: 10000 },
] as const

/**
 * 混用適否シミュレーター向けに全件取得する pesticideIncompatibility ペアの上限。
 * 農薬間の非適合ペアはマスタデータ（少数）だが、500 製品フル登録時の最大ペア数
 * (500 × 499 / 2 ≈ 125,000) を上回る可能性は実運用上ないため 2000 で十分吸収できる。
 */
export const MAX_PESTICIDE_INCOMPATIBILITY_LIMIT = 2000

/** 1mL あたりの滴数 (一般的な水溶液の粗い目安値)。 */
export const DROPS_PER_ML = 20

/** 家庭用計量器具で正確に計量できる最小量 (mL)。これ未満は滴数換算に切り替える。 */
export const MIN_MEASURABLE_ML = 0.1
