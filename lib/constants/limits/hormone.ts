/** 植物ホルモンガイドの制限値 */

/** ホルモン一覧取得時の最大件数 */
export const MAX_HORMONE_LIST_LIMIT = 50

/** ホルモン効果取得時の最大件数 */
export const MAX_HORMONE_EFFECT_LIMIT = 100

/** ホルモン相互作用取得時の最大件数 */
export const MAX_HORMONE_INTERACTION_LIMIT = 100

/** ホルモンコラム取得時の最大件数 */
export const MAX_HORMONE_COLUMN_LIMIT = 100

/** 月別ホルモン活性の月数 */
export const HORMONE_SEASONAL_MONTHS = 12

/** ホルモン技法マッピング取得時の最大件数 */
export const MAX_HORMONE_TECHNIQUE_LIMIT = 200

/** 盆栽技法の数 */
export const HORMONE_TECHNIQUE_COUNT = 9

/**
 * シミュレーターデータ向けに全件取得する hormoneSeasonalLevel の上限。
 * 12 か月 × MAX_HORMONE_LIST_LIMIT (50 ホルモン) = 600 が理論的最大値。
 * 余裕を持たせるため 1000 に設定する。
 */
export const MAX_HORMONE_SEASONAL_LEVEL_LIMIT = 1000
