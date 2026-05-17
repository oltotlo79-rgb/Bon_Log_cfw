/**
 * 盆栽手入れログ関連の定数テスト。
 *
 * 定数の齟齬（追加漏れ・値の重複）が UI/Actions/DB の不整合を引き起こすため、
 * 下記の不変条件をテストで保証する:
 *   - enum と BONSAI_CARE_TYPES 配列の内容一致
 *   - ラベル・色クラスが全種別を網羅
 *   - カレンダーモードの月数定義が網羅的
 *   - anchor の正規表現が妥当な値を受け付ける
 */

import { BonsaiCareType } from '@prisma/client'
import {
  ALL_CARE_TYPE_COUNT,
  BONSAI_CALENDAR_ANCHOR_PATTERN,
  BONSAI_CALENDAR_ANCHOR_PARAM,
  BONSAI_CALENDAR_MODE_PARAM,
  BONSAI_CARE_COLOR_CLASS,
  BONSAI_CARE_LABELS,
  BONSAI_CARE_TYPES,
  BONSAI_VIEWS,
  BONSAI_VIEW_CALENDAR,
  BONSAI_VIEW_PARAM,
  BONSAI_VIEW_TIMELINE,
  CALENDAR_MODES,
  CALENDAR_MODE_HALF_YEAR,
  CALENDAR_MODE_LABELS,
  CALENDAR_MODE_MONTH,
  CALENDAR_MODE_MONTH_COUNT,
  CALENDAR_MODE_YEAR,
} from '@/lib/constants/bonsai-care'

describe('bonsai-care ドメイン定数', () => {
  describe('BONSAI_CARE_TYPES', () => {
    it('Prisma enum BonsaiCareType の全値を含む（追加漏れ防止）', () => {
      const enumValues = Object.values(BonsaiCareType)
      expect([...BONSAI_CARE_TYPES].sort()).toEqual([...enumValues].sort())
    })

    it('ALL_CARE_TYPE_COUNT は配列長と一致する', () => {
      expect(ALL_CARE_TYPE_COUNT).toBe(BONSAI_CARE_TYPES.length)
    })

    it('重複がない', () => {
      expect(new Set(BONSAI_CARE_TYPES).size).toBe(BONSAI_CARE_TYPES.length)
    })

    it('現在 8 種別を持つ（仕様変更時の警告ライン）', () => {
      expect(BONSAI_CARE_TYPES).toHaveLength(8)
    })
  })

  describe('BONSAI_CARE_LABELS', () => {
    it('すべての種別にラベルが定義されている', () => {
      for (const type of BONSAI_CARE_TYPES) {
        expect(BONSAI_CARE_LABELS[type]).toBeTruthy()
        expect(typeof BONSAI_CARE_LABELS[type]).toBe('string')
      }
    })

    it('ラベルに重複がない（UI 上で区別できる）', () => {
      const labels = Object.values(BONSAI_CARE_LABELS)
      expect(new Set(labels).size).toBe(labels.length)
    })

    it('全ラベルが 1 文字以上 10 文字以下（UI レイアウト保護）', () => {
      for (const label of Object.values(BONSAI_CARE_LABELS)) {
        expect(label.length).toBeGreaterThanOrEqual(1)
        expect(label.length).toBeLessThanOrEqual(10)
      }
    })
  })

  describe('BONSAI_CARE_COLOR_CLASS', () => {
    it('すべての種別に Tailwind 色クラスが定義されている', () => {
      for (const type of BONSAI_CARE_TYPES) {
        expect(BONSAI_CARE_COLOR_CLASS[type]).toMatch(/^bg-/)
      }
    })
  })

  describe('カレンダーモード', () => {
    it('CALENDAR_MODES は 3 つのモードを持つ', () => {
      expect(CALENDAR_MODES).toEqual([
        CALENDAR_MODE_MONTH,
        CALENDAR_MODE_HALF_YEAR,
        CALENDAR_MODE_YEAR,
      ])
    })

    it('CALENDAR_MODE_MONTH_COUNT は想定通りの月数', () => {
      expect(CALENDAR_MODE_MONTH_COUNT[CALENDAR_MODE_MONTH]).toBe(1)
      expect(CALENDAR_MODE_MONTH_COUNT[CALENDAR_MODE_HALF_YEAR]).toBe(6)
      expect(CALENDAR_MODE_MONTH_COUNT[CALENDAR_MODE_YEAR]).toBe(12)
    })

    it('すべてのモードにラベルが存在する', () => {
      for (const mode of CALENDAR_MODES) {
        expect(CALENDAR_MODE_LABELS[mode]).toBeTruthy()
      }
    })

    it('モードラベルに重複がない', () => {
      const labels = Object.values(CALENDAR_MODE_LABELS)
      expect(new Set(labels).size).toBe(labels.length)
    })
  })

  describe('BONSAI_VIEWS', () => {
    it('timeline と calendar の 2 値を持つ', () => {
      expect(BONSAI_VIEWS).toEqual([BONSAI_VIEW_TIMELINE, BONSAI_VIEW_CALENDAR])
    })

    it('既知の文字列値である（破壊的変更検知）', () => {
      expect(BONSAI_VIEW_TIMELINE).toBe('timeline')
      expect(BONSAI_VIEW_CALENDAR).toBe('calendar')
    })
  })

  describe('URL パラメータ名', () => {
    it('view / mode / anchor が定義されている', () => {
      expect(BONSAI_VIEW_PARAM).toBe('view')
      expect(BONSAI_CALENDAR_MODE_PARAM).toBe('mode')
      expect(BONSAI_CALENDAR_ANCHOR_PARAM).toBe('anchor')
    })
  })

  describe('BONSAI_CALENDAR_ANCHOR_PATTERN', () => {
    it.each([
      '2026-01',
      '2026-12',
      '1900-06',
      '9999-11',
    ])('妥当な anchor `%s` を受け付ける', (s) => {
      expect(BONSAI_CALENDAR_ANCHOR_PATTERN.test(s)).toBe(true)
    })

    it.each([
      '2026-00', // 00 月は無効
      '2026-13', // 13 月は無効
      '2026-1',  // ゼロパディングなし
      '26-01',   // 2桁年は無効
      '2026/01', // 区切り文字違い
      '',
      'abcd-ef',
      '2026-01 ', // 末尾空白
      ' 2026-01', // 先頭空白
    ])('不正な anchor `%s` を拒否する', (s) => {
      expect(BONSAI_CALENDAR_ANCHOR_PATTERN.test(s)).toBe(false)
    })
  })
})
