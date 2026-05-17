/**
 * 季節判定ユーティリティ
 *
 * 現在の日付から日本の四季を判定し、対応する画像パスや表示名を返す。
 * 気象庁の区分（春3-5月、夏6-8月、秋9-11月、冬12-2月）に準拠。
 */

export type Season = 'spring' | 'summer' | 'autumn' | 'winter'

export interface SeasonInfo {
  id: Season
  label: string
  description: string
  months: number[]
}

/**
 * 1 要素目を `[SeasonInfo, ...SeasonInfo[]]` の non-empty tuple として宣言することで、
 * `SEASONS[0]` が `SeasonInfo | undefined` ではなく確定型になるようにする。
 */
const SEASONS: readonly [SeasonInfo, ...SeasonInfo[]] = [
  { id: 'spring', label: '春', description: '新緑の季節', months: [3, 4, 5] },
  { id: 'summer', label: '夏', description: '深緑の季節', months: [6, 7, 8] },
  { id: 'autumn', label: '秋', description: '紅葉の季節', months: [9, 10, 11] },
  { id: 'winter', label: '冬', description: '枯山水の季節', months: [12, 1, 2] },
]

const DEFAULT_SEASON: SeasonInfo = SEASONS[0]

/**
 * 現在の季節を取得する
 */
export function getCurrentSeason(): Season {
  const month = new Date().getMonth() + 1 // 0-indexed → 1-indexed
  const season = SEASONS.find(s => s.months.includes(month))
  return season?.id ?? 'spring'
}

/**
 * 季節の情報を取得する
 */
export function getSeasonInfo(season?: Season): SeasonInfo {
  const id = season ?? getCurrentSeason()
  return SEASONS.find(s => s.id === id) ?? DEFAULT_SEASON
}

/**
 * 季節バナー画像のパスを返す
 */
export function getSeasonImagePath(
  season: Season,
  variant: 'desktop' | 'mobile' | 'desktop-dark' | 'mobile-dark'
): string {
  const base = `/images/generated/seasons/season-${season}`
  switch (variant) {
    case 'desktop':
      return `${base}.webp`
    case 'desktop-dark':
      return `${base}-dark.webp`
    case 'mobile':
      return `${base}-mobile.webp`
    case 'mobile-dark':
      return `${base}-dark-mobile.webp`
  }
}
