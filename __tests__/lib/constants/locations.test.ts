// @vitest-environment node

import { LOCATION_GROUPS, ALL_LOCATIONS } from '@/lib/constants/locations'

describe('Location Constants', () => {
  // ============================================================
  // LOCATION_GROUPS 構造
  // ============================================================

  describe('LOCATION_GROUPS 構造', () => {
    const EXPECTED_GROUPS = [
      '日本の地方',
      '都道府県',
      '国・地域',
      '大陸・地域',
      'その他',
    ] as const

    it('期待するグループが正しい順序で定義されている', () => {
      const labels = LOCATION_GROUPS.map((g) => g.label)
      expect(labels).toEqual(EXPECTED_GROUPS)
    })

    it('すべてのグループに1つ以上のオプションがある', () => {
      LOCATION_GROUPS.forEach((group) => {
        expect(group.options.length).toBeGreaterThan(0)
      })
    })

    it('すべてのオプションのvalueとlabelが空でない文字列である', () => {
      LOCATION_GROUPS.forEach((group) => {
        group.options.forEach((option) => {
          expect(option.value).toBeTruthy()
          expect(option.label).toBeTruthy()
          expect(typeof option.value).toBe('string')
          expect(typeof option.label).toBe('string')
        })
      })
    })
  })

  // ============================================================
  // 都道府県グループ
  // ============================================================

  describe('都道府県グループ', () => {
    const prefectureGroup = LOCATION_GROUPS.find((g) => g.label === '都道府県')!

    it('47都道府県が含まれている', () => {
      expect(prefectureGroup.options).toHaveLength(47)
    })

    it('すべての都道府県が「県」「都」「府」「道」のいずれかで終わる', () => {
      prefectureGroup.options.forEach((option) => {
        expect(option.value).toMatch(/(県|都|府|道)$/)
      })
    })

    it('都道府県のvalueとlabelが一致する', () => {
      prefectureGroup.options.forEach((option) => {
        expect(option.value).toBe(option.label)
      })
    })

    it('都(1)・道(1)・府(2)・県(43)の内訳が正しい', () => {
      const suffixCounts = { 都: 0, 道: 0, 府: 0, 県: 0 }
      prefectureGroup.options.forEach((option) => {
        const suffix = option.value.slice(-1) as keyof typeof suffixCounts
        suffixCounts[suffix]++
      })
      expect(suffixCounts).toEqual({ 都: 1, 道: 1, 府: 2, 県: 43 })
    })
  })

  // ============================================================
  // 地方グループ
  // ============================================================

  describe('日本の地方グループ', () => {
    const regionGroup = LOCATION_GROUPS.find((g) => g.label === '日本の地方')!

    it('11の地方が含まれている', () => {
      expect(regionGroup.options).toHaveLength(11)
    })
  })

  // ============================================================
  // ALL_LOCATIONS
  // ============================================================

  describe('ALL_LOCATIONS', () => {
    it('LOCATION_GROUPSの全オプション数と一致する', () => {
      const expectedCount = LOCATION_GROUPS.reduce(
        (sum, group) => sum + group.options.length,
        0
      )
      expect(ALL_LOCATIONS).toHaveLength(expectedCount)
    })

    it('ネストしたoptionsプロパティを持たないフラット配列である', () => {
      ALL_LOCATIONS.forEach((location) => {
        expect(location).not.toHaveProperty('options')
      })
    })
  })

  // ============================================================
  // データ整合性
  // ============================================================

  describe('データ整合性', () => {
    it('グループラベルに重複がない', () => {
      const labels = LOCATION_GROUPS.map((g) => g.label)
      expect(new Set(labels).size).toBe(labels.length)
    })

    it('各グループ内でvalueの重複がない', () => {
      LOCATION_GROUPS.forEach((group) => {
        const values = group.options.map((o) => o.value)
        expect(new Set(values).size).toBe(values.length)
      })
    })

    it.each([
      ['非公開', 'その他'],
      ['海外', 'その他'],
    ])('"%s"が"%s"グループに存在する', (value, groupLabel) => {
      const group = LOCATION_GROUPS.find((g) => g.label === groupLabel)
      expect(group?.options.some((o) => o.value === value)).toBe(true)
    })
  })

  // ============================================================
  // バリデーション用途
  // ============================================================

  describe('バリデーション用途', () => {
    it('ALL_LOCATIONSで有効な地域の存在判定ができる', () => {
      const isValid = (v: string) => ALL_LOCATIONS.some((loc) => loc.value === v)
      expect(isValid('東京都')).toBe(true)
      expect(isValid('アメリカ')).toBe(true)
      expect(isValid('無効な値')).toBe(false)
    })
  })
})
