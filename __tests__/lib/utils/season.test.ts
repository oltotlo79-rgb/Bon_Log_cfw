import { vi, describe, it, expect, afterEach } from 'vitest'
import {
  getCurrentSeason,
  getSeasonInfo,
  getSeasonImagePath,
  type Season,
} from '@/lib/utils/season'

describe('lib/utils/season', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('getCurrentSeason', () => {
    const cases: [number, Season][] = [
      [0, 'winter'],  // 1月
      [1, 'winter'],  // 2月
      [2, 'spring'],  // 3月
      [3, 'spring'],  // 4月
      [4, 'spring'],  // 5月
      [5, 'summer'],  // 6月
      [6, 'summer'],  // 7月
      [7, 'summer'],  // 8月
      [8, 'autumn'],  // 9月
      [9, 'autumn'],  // 10月
      [10, 'autumn'], // 11月
      [11, 'winter'], // 12月
    ]

    it.each(cases)('月インデックス %i の場合 %s を返す', (monthIndex, expected) => {
      vi.spyOn(Date.prototype, 'getMonth').mockReturnValue(monthIndex)
      expect(getCurrentSeason()).toBe(expected)
    })

    it('現在の日付で有効な季節を返す', () => {
      const result = getCurrentSeason()
      expect(['spring', 'summer', 'autumn', 'winter']).toContain(result)
    })

    it('どの季節にも一致しない月の場合はspringにフォールバックする', () => {
      // getMonth()が12を返す場合(実際にはありえないが、コード上のフォールバック分岐)
      // month = 13 となり、どのSEASONS.months にも含まれない
      vi.spyOn(Date.prototype, 'getMonth').mockReturnValue(12)
      expect(getCurrentSeason()).toBe('spring')
    })
  })

  describe('getSeasonInfo', () => {
    it('引数なしで現在の季節情報を返す', () => {
      const info = getSeasonInfo()
      expect(info).toHaveProperty('id')
      expect(info).toHaveProperty('label')
      expect(info).toHaveProperty('description')
      expect(info).toHaveProperty('months')
    })

    it('春の情報を返す', () => {
      const info = getSeasonInfo('spring')
      expect(info.id).toBe('spring')
      expect(info.label).toBe('春')
      expect(info.months).toEqual([3, 4, 5])
    })

    it('夏の情報を返す', () => {
      const info = getSeasonInfo('summer')
      expect(info.id).toBe('summer')
      expect(info.label).toBe('夏')
      expect(info.months).toEqual([6, 7, 8])
    })

    it('秋の情報を返す', () => {
      const info = getSeasonInfo('autumn')
      expect(info.id).toBe('autumn')
      expect(info.label).toBe('秋')
      expect(info.months).toEqual([9, 10, 11])
    })

    it('冬の情報を返す', () => {
      const info = getSeasonInfo('winter')
      expect(info.id).toBe('winter')
      expect(info.label).toBe('冬')
      expect(info.months).toEqual([12, 1, 2])
    })

    it('存在しない季節IDの場合はSEASONS[0](春)にフォールバックする', () => {
      // 型を強制的にバイパスして不正な値を渡す
      const info = getSeasonInfo('invalid_season' as Season)
      expect(info.id).toBe('spring')
      expect(info.label).toBe('春')
    })
  })

  describe('getSeasonImagePath', () => {
    it('デスクトップライト画像パスを返す', () => {
      expect(getSeasonImagePath('spring', 'desktop')).toBe('/images/generated/seasons/season-spring.webp')
    })

    it('デスクトップダーク画像パスを返す', () => {
      expect(getSeasonImagePath('summer', 'desktop-dark')).toBe('/images/generated/seasons/season-summer-dark.webp')
    })

    it('モバイルライト画像パスを返す', () => {
      expect(getSeasonImagePath('autumn', 'mobile')).toBe('/images/generated/seasons/season-autumn-mobile.webp')
    })

    it('モバイルダーク画像パスを返す', () => {
      expect(getSeasonImagePath('winter', 'mobile-dark')).toBe('/images/generated/seasons/season-winter-dark-mobile.webp')
    })

    it('全季節×全バリアントの組み合わせが正しい形式', () => {
      const seasons: Season[] = ['spring', 'summer', 'autumn', 'winter']
      const variants = ['desktop', 'desktop-dark', 'mobile', 'mobile-dark'] as const

      for (const season of seasons) {
        for (const variant of variants) {
          const path = getSeasonImagePath(season, variant)
          expect(path).toMatch(/^\/images\/generated\/seasons\/season-/)
          expect(path).toMatch(/\.webp$/)
        }
      }
    })
  })
})
