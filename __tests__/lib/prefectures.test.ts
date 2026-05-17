/**
 * 都道府県ユーティリティのテスト
 */

import {
  PREFECTURES,
  REGIONS,
  extractPrefecture,
  getRegionByPrefecture,
  getRegionById,
} from '@/lib/prefectures'

describe('prefectures', () => {
  // ============================================================
  // 定数のテスト
  // ============================================================

  describe('PREFECTURES', () => {
    it('47都道府県が定義されている', () => {
      expect(PREFECTURES).toHaveLength(47)
    })

    it('北海道が最初', () => {
      expect(PREFECTURES[0]).toBe('北海道')
    })

    it('沖縄県が最後', () => {
      expect(PREFECTURES[PREFECTURES.length - 1]).toBe('沖縄県')
    })

    it('東京都が含まれる', () => {
      expect(PREFECTURES).toContain('東京都')
    })

    it('大阪府が含まれる', () => {
      expect(PREFECTURES).toContain('大阪府')
    })

    it('京都府が含まれる', () => {
      expect(PREFECTURES).toContain('京都府')
    })
  })

  describe('REGIONS', () => {
    it('7つの地方が定義されている', () => {
      expect(REGIONS).toHaveLength(7)
    })

    it('各地方にはid、name、prefecturesがある', () => {
      REGIONS.forEach(region => {
        expect(region).toHaveProperty('id')
        expect(region).toHaveProperty('name')
        expect(region).toHaveProperty('prefectures')
        expect(Array.isArray(region.prefectures)).toBe(true)
        expect(region.prefectures.length).toBeGreaterThan(0)
      })
    })

    it('全都道府県がいずれかの地方に属している', () => {
      const allPrefecturesInRegions = REGIONS.flatMap(r => r.prefectures)
      PREFECTURES.forEach(pref => {
        expect(allPrefecturesInRegions).toContain(pref)
      })
    })

    it('北海道・東北地方が最初', () => {
      expect(REGIONS[0].id).toBe('hokkaido-tohoku')
      expect(REGIONS[0].name).toBe('北海道・東北')
    })

    it('九州・沖縄地方が最後', () => {
      expect(REGIONS[REGIONS.length - 1].id).toBe('kyushu-okinawa')
      expect(REGIONS[REGIONS.length - 1].name).toBe('九州・沖縄')
    })
  })

  // ============================================================
  // extractPrefecture
  // ============================================================

  describe('extractPrefecture', () => {
    it('住所から北海道を抽出する', () => {
      expect(extractPrefecture('北海道札幌市中央区')).toBe('北海道')
    })

    it('住所から東京都を抽出する', () => {
      expect(extractPrefecture('東京都渋谷区神南1-2-3')).toBe('東京都')
    })

    it('住所から大阪府を抽出する', () => {
      expect(extractPrefecture('大阪府大阪市北区梅田')).toBe('大阪府')
    })

    it('住所から京都府を抽出する', () => {
      expect(extractPrefecture('京都府京都市左京区')).toBe('京都府')
    })

    it('住所から神奈川県を抽出する', () => {
      expect(extractPrefecture('神奈川県横浜市中区')).toBe('神奈川県')
    })

    it('住所から沖縄県を抽出する', () => {
      expect(extractPrefecture('沖縄県那覇市')).toBe('沖縄県')
    })

    it('都道府県が含まれない住所はnullを返す', () => {
      expect(extractPrefecture('渋谷区神南1-2-3')).toBeNull()
    })

    it('空の住所はnullを返す', () => {
      expect(extractPrefecture('')).toBeNull()
    })

    it('住所の途中に都道府県名があっても先頭のみ検出する', () => {
      // 東京都で始まる住所
      expect(extractPrefecture('東京都北区東京都道')).toBe('東京都')
    })
  })

  // ============================================================
  // getRegionByPrefecture
  // ============================================================

  describe('getRegionByPrefecture', () => {
    it('北海道は北海道・東北地方', () => {
      const region = getRegionByPrefecture('北海道')
      expect(region).not.toBeNull()
      expect(region?.id).toBe('hokkaido-tohoku')
      expect(region?.name).toBe('北海道・東北')
    })

    it('青森県は北海道・東北地方', () => {
      const region = getRegionByPrefecture('青森県')
      expect(region?.id).toBe('hokkaido-tohoku')
    })

    it('東京都は関東地方', () => {
      const region = getRegionByPrefecture('東京都')
      expect(region).not.toBeNull()
      expect(region?.id).toBe('kanto')
      expect(region?.name).toBe('関東')
    })

    it('神奈川県は関東地方', () => {
      const region = getRegionByPrefecture('神奈川県')
      expect(region?.id).toBe('kanto')
    })

    it('愛知県は中部地方', () => {
      const region = getRegionByPrefecture('愛知県')
      expect(region).not.toBeNull()
      expect(region?.id).toBe('chubu')
      expect(region?.name).toBe('中部')
    })

    it('大阪府は近畿地方', () => {
      const region = getRegionByPrefecture('大阪府')
      expect(region).not.toBeNull()
      expect(region?.id).toBe('kinki')
      expect(region?.name).toBe('近畿')
    })

    it('広島県は中国地方', () => {
      const region = getRegionByPrefecture('広島県')
      expect(region).not.toBeNull()
      expect(region?.id).toBe('chugoku')
      expect(region?.name).toBe('中国')
    })

    it('香川県は四国地方', () => {
      const region = getRegionByPrefecture('香川県')
      expect(region).not.toBeNull()
      expect(region?.id).toBe('shikoku')
      expect(region?.name).toBe('四国')
    })

    it('福岡県は九州・沖縄地方', () => {
      const region = getRegionByPrefecture('福岡県')
      expect(region).not.toBeNull()
      expect(region?.id).toBe('kyushu-okinawa')
      expect(region?.name).toBe('九州・沖縄')
    })

    it('沖縄県は九州・沖縄地方', () => {
      const region = getRegionByPrefecture('沖縄県')
      expect(region?.id).toBe('kyushu-okinawa')
    })

    it('存在しない都道府県はnullを返す', () => {
      expect(getRegionByPrefecture('架空県')).toBeNull()
    })

    it('空文字列はnullを返す', () => {
      expect(getRegionByPrefecture('')).toBeNull()
    })
  })

  // ============================================================
  // getRegionById
  // ============================================================

  describe('getRegionById', () => {
    it('hokkaido-tohokuで北海道・東北地方を取得する', () => {
      const region = getRegionById('hokkaido-tohoku')
      expect(region).not.toBeNull()
      expect(region?.name).toBe('北海道・東北')
      expect(region?.prefectures).toContain('北海道')
      expect(region?.prefectures).toContain('福島県')
    })

    it('kantoで関東地方を取得する', () => {
      const region = getRegionById('kanto')
      expect(region).not.toBeNull()
      expect(region?.name).toBe('関東')
      expect(region?.prefectures).toContain('東京都')
    })

    it('chubuで中部地方を取得する', () => {
      const region = getRegionById('chubu')
      expect(region).not.toBeNull()
      expect(region?.name).toBe('中部')
      expect(region?.prefectures).toContain('愛知県')
    })

    it('kinkiで近畿地方を取得する', () => {
      const region = getRegionById('kinki')
      expect(region).not.toBeNull()
      expect(region?.name).toBe('近畿')
      expect(region?.prefectures).toContain('大阪府')
    })

    it('chugokuで中国地方を取得する', () => {
      const region = getRegionById('chugoku')
      expect(region).not.toBeNull()
      expect(region?.name).toBe('中国')
      expect(region?.prefectures).toContain('広島県')
    })

    it('shikokuで四国地方を取得する', () => {
      const region = getRegionById('shikoku')
      expect(region).not.toBeNull()
      expect(region?.name).toBe('四国')
      expect(region?.prefectures).toContain('香川県')
    })

    it('kyushu-okinawaで九州・沖縄地方を取得する', () => {
      const region = getRegionById('kyushu-okinawa')
      expect(region).not.toBeNull()
      expect(region?.name).toBe('九州・沖縄')
      expect(region?.prefectures).toContain('沖縄県')
    })

    it('存在しないIDはnullを返す', () => {
      expect(getRegionById('invalid-region')).toBeNull()
    })

    it('空文字列はnullを返す', () => {
      expect(getRegionById('')).toBeNull()
    })
  })
})
