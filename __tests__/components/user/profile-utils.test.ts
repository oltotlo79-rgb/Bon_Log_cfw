import { vi, describe, it, expect, afterEach } from 'vitest'
import { formatBirthDate, calculateBonsaiExperience } from '@/components/user/profile-utils'

describe('profile-utils', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('formatBirthDate', () => {
    it('nullの場合はnullを返す', () => {
      expect(formatBirthDate(null)).toBeNull()
    })

    it('Date型をフォーマットする', () => {
      expect(formatBirthDate(new Date('1990-05-15'))).toBe('1990年5月15日')
    })

    it('文字列型をフォーマットする', () => {
      expect(formatBirthDate('2000-12-25')).toBe('2000年12月25日')
    })

    it('1月1日を正しくフォーマットする', () => {
      expect(formatBirthDate('2026-01-01')).toBe('2026年1月1日')
    })
  })

  describe('calculateBonsaiExperience', () => {
    it('startYearがnullの場合はnullを返す', () => {
      expect(calculateBonsaiExperience(null, null)).toBeNull()
    })

    it('startYearが0の場合はnullを返す', () => {
      expect(calculateBonsaiExperience(0, null)).toBeNull()
    })

    it('未来の年の場合はnullを返す', () => {
      expect(calculateBonsaiExperience(2099, 1)).toBeNull()
    })

    it('startMonthがnullの場合は1月として計算する', () => {
      const result = calculateBonsaiExperience(2020, null)
      expect(result).not.toBeNull()
      expect(result).toMatch(/年|ヶ月/)
    })

    it('年数のみの場合は「X年」形式', () => {
      vi.spyOn(Date.prototype, 'getFullYear').mockReturnValue(2026)
      vi.spyOn(Date.prototype, 'getMonth').mockReturnValue(0) // 1月
      expect(calculateBonsaiExperience(2023, 1)).toBe('3年')
    })

    it('月数のみの場合は「Xヶ月」形式', () => {
      vi.spyOn(Date.prototype, 'getFullYear').mockReturnValue(2026)
      vi.spyOn(Date.prototype, 'getMonth').mockReturnValue(5) // 6月
      expect(calculateBonsaiExperience(2026, 1)).toBe('5ヶ月')
    })

    it('年月両方の場合は「X年Yヶ月」形式', () => {
      vi.spyOn(Date.prototype, 'getFullYear').mockReturnValue(2026)
      vi.spyOn(Date.prototype, 'getMonth').mockReturnValue(2) // 3月
      expect(calculateBonsaiExperience(2023, 6)).toBe('2年9ヶ月')
    })

    it('開始直後は「1ヶ月未満」', () => {
      vi.spyOn(Date.prototype, 'getFullYear').mockReturnValue(2026)
      vi.spyOn(Date.prototype, 'getMonth').mockReturnValue(2) // 3月
      expect(calculateBonsaiExperience(2026, 3)).toBe('1ヶ月未満')
    })
  })
})
