/**
 * 都道府県・地方ブロック定数のテスト
 */

import {
  PREFECTURES,
  REGION_MAP as REGIONS,
  REGION_NAME_LIST as REGION_LIST,
  getPrefecturesByRegion,
  getRegionNameByPrefecture as getRegionByPrefecture,
  type Prefecture,
  type RegionName as Region,
} from '@/lib/prefectures'

describe('Prefectures Constants', () => {
  describe('PREFECTURES', () => {
    it('47都道府県が定義されている', () => {
      expect(PREFECTURES).toHaveLength(47)
    })

    it('北海道から始まり沖縄県で終わる', () => {
      expect(PREFECTURES[0]).toBe('北海道')
      expect(PREFECTURES[46]).toBe('沖縄県')
    })

    it('主要な都道府県が含まれている', () => {
      expect(PREFECTURES).toContain('東京都')
      expect(PREFECTURES).toContain('大阪府')
      expect(PREFECTURES).toContain('京都府')
      expect(PREFECTURES).toContain('愛知県')
      expect(PREFECTURES).toContain('福岡県')
    })

    it('重複がない', () => {
      const uniquePrefectures = new Set(PREFECTURES)
      expect(uniquePrefectures.size).toBe(47)
    })
  })

  describe('REGIONS', () => {
    it('8つの地方ブロックが定義されている', () => {
      expect(Object.keys(REGIONS)).toHaveLength(8)
    })

    it('すべての地方ブロックが正しく定義されている', () => {
      expect(REGIONS['北海道']).toEqual(['北海道'])
      expect(REGIONS['東北']).toHaveLength(6)
      expect(REGIONS['関東']).toHaveLength(7)
      expect(REGIONS['中部']).toHaveLength(9)
      expect(REGIONS['近畿']).toHaveLength(7)
      expect(REGIONS['中国']).toHaveLength(5)
      expect(REGIONS['四国']).toHaveLength(4)
      expect(REGIONS['九州・沖縄']).toHaveLength(8)
    })

    it('すべての都道府県がいずれかの地方に含まれている', () => {
      const allPrefecturesInRegions = Object.values(REGIONS).flat()
      expect(allPrefecturesInRegions).toHaveLength(47)

      for (const pref of PREFECTURES) {
        expect(allPrefecturesInRegions).toContain(pref)
      }
    })

    it('関東地方に正しい都道府県が含まれている', () => {
      expect(REGIONS['関東']).toContain('東京都')
      expect(REGIONS['関東']).toContain('神奈川県')
      expect(REGIONS['関東']).toContain('埼玉県')
      expect(REGIONS['関東']).toContain('千葉県')
    })
  })

  describe('REGION_LIST', () => {
    it('8つの地方名が配列として取得できる', () => {
      expect(REGION_LIST).toHaveLength(8)
    })

    it('すべての地方名が含まれている', () => {
      expect(REGION_LIST).toContain('北海道')
      expect(REGION_LIST).toContain('関東')
      expect(REGION_LIST).toContain('近畿')
      expect(REGION_LIST).toContain('九州・沖縄')
    })
  })

  describe('getPrefecturesByRegion', () => {
    it('関東地方の都道府県リストを取得できる', () => {
      const prefectures = getPrefecturesByRegion('関東')
      expect(prefectures).toHaveLength(7)
      expect(prefectures).toContain('東京都')
      expect(prefectures).toContain('神奈川県')
    })

    it('北海道地方は1つの都道府県を返す', () => {
      const prefectures = getPrefecturesByRegion('北海道')
      expect(prefectures).toEqual(['北海道'])
    })

    it('九州・沖縄地方は8つの都道府県を返す', () => {
      const prefectures = getPrefecturesByRegion('九州・沖縄')
      expect(prefectures).toHaveLength(8)
      expect(prefectures).toContain('沖縄県')
    })

    it('返された配列は元の配列のコピー', () => {
      const prefectures1 = getPrefecturesByRegion('関東')
      const prefectures2 = getPrefecturesByRegion('関東')
      expect(prefectures1).not.toBe(prefectures2)
      expect(prefectures1).toEqual(prefectures2)
    })
  })

  describe('getRegionByPrefecture', () => {
    it('東京都は関東地方', () => {
      expect(getRegionByPrefecture('東京都')).toBe('関東')
    })

    it('大阪府は近畿地方', () => {
      expect(getRegionByPrefecture('大阪府')).toBe('近畿')
    })

    it('北海道は北海道地方', () => {
      expect(getRegionByPrefecture('北海道')).toBe('北海道')
    })

    it('沖縄県は九州・沖縄地方', () => {
      expect(getRegionByPrefecture('沖縄県')).toBe('九州・沖縄')
    })

    it('広島県は中国地方', () => {
      expect(getRegionByPrefecture('広島県')).toBe('中国')
    })

    it('香川県は四国地方', () => {
      expect(getRegionByPrefecture('香川県')).toBe('四国')
    })

    it('新潟県は中部地方', () => {
      expect(getRegionByPrefecture('新潟県')).toBe('中部')
    })

    it('宮城県は東北地方', () => {
      expect(getRegionByPrefecture('宮城県')).toBe('東北')
    })

    it('存在しない都道府県はnullを返す', () => {
      expect(getRegionByPrefecture('不明県')).toBeNull()
      expect(getRegionByPrefecture('')).toBeNull()
      expect(getRegionByPrefecture('アメリカ')).toBeNull()
    })

    it('すべての都道府県に対して地方を取得できる', () => {
      for (const pref of PREFECTURES) {
        const region = getRegionByPrefecture(pref)
        expect(region).not.toBeNull()
        expect(REGION_LIST).toContain(region)
      }
    })
  })

  describe('型安全性', () => {
    it('Prefecture型は47都道府県のいずれかを受け入れる', () => {
      const tokyo: Prefecture = '東京都'
      const osaka: Prefecture = '大阪府'
      expect(tokyo).toBe('東京都')
      expect(osaka).toBe('大阪府')
    })

    it('Region型は8つの地方名のいずれかを受け入れる', () => {
      const kanto: Region = '関東'
      const kinki: Region = '近畿'
      expect(kanto).toBe('関東')
      expect(kinki).toBe('近畿')
    })
  })
})
