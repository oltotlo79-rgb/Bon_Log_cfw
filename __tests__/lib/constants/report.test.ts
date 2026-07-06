// @vitest-environment node

import {
  REPORT_REASONS,
  REPORT_REASON_VALUES,
  REPORT_TARGET_TYPES,
  AUTO_HIDE_THRESHOLD,
  TARGET_TYPE_LABELS,
  CONTENT_TYPE_LABELS,
  CONTENT_TYPE_COLORS,
  isReportReason,
  isReportTargetType,
  type ReportTargetType,
  type ContentType,
} from '@/lib/constants/report'

describe('Report Constants', () => {
  describe('REPORT_REASONS', () => {
    it('重複するvalueがない', () => {
      const values = REPORT_REASONS.map((r) => r.value)
      expect(new Set(values).size).toBe(values.length)
    })

    it('空のvalue・labelが含まれていない', () => {
      REPORT_REASONS.forEach((reason) => {
        expect(reason.value.length).toBeGreaterThan(0)
        expect(reason.label.length).toBeGreaterThan(0)
      })
    })

    it('otherが最後に配置されている（UIでの表示順）', () => {
      expect(REPORT_REASONS[REPORT_REASONS.length - 1]!.value).toBe('other')
    })
  })

  describe('AUTO_HIDE_THRESHOLD', () => {
    it('正の整数で適切な範囲（1〜100）である', () => {
      expect(Number.isInteger(AUTO_HIDE_THRESHOLD)).toBe(true)
      expect(AUTO_HIDE_THRESHOLD).toBeGreaterThanOrEqual(1)
      expect(AUTO_HIDE_THRESHOLD).toBeLessThanOrEqual(100)
    })
  })

  describe('マッピングの整合性', () => {
    const allTargetTypes: ReportTargetType[] = ['post', 'comment', 'event', 'shop', 'review', 'user']
    const allContentTypes: ContentType[] = ['post', 'comment', 'event', 'shop', 'review']

    it('TARGET_TYPE_LABELSが全ReportTargetTypeをカバーしている', () => {
      expect(Object.keys(TARGET_TYPE_LABELS).sort()).toEqual([...allTargetTypes].sort())
    })

    it('CONTENT_TYPE_LABELSがReportTargetTypeからuserを除いたものと一致する', () => {
      expect(Object.keys(CONTENT_TYPE_LABELS).sort()).toEqual([...allContentTypes].sort())
      expect('user' in CONTENT_TYPE_LABELS).toBe(false)
    })

    it('CONTENT_TYPE_COLORSのキーがCONTENT_TYPE_LABELSと一致する', () => {
      expect(Object.keys(CONTENT_TYPE_COLORS).sort()).toEqual(Object.keys(CONTENT_TYPE_LABELS).sort())
    })

    it.each(allContentTypes)(
      '%s のラベルがTARGET_TYPE_LABELSとCONTENT_TYPE_LABELSで一致する',
      (type) => {
        expect(CONTENT_TYPE_LABELS[type]).toBe(TARGET_TYPE_LABELS[type])
      },
    )

    it('TARGET_TYPE_LABELSの全ラベルが日本語を含む', () => {
      Object.values(TARGET_TYPE_LABELS).forEach((label) => {
        expect(label).toMatch(/[\u3040-\u309f\u30a0-\u30ff\u4e00-\u9faf]/)
      })
    })
  })

  describe('isReportReason', () => {
    it.each(REPORT_REASON_VALUES)('%s は有効な通報理由と判定される', (value) => {
      expect(isReportReason(value)).toBe(true)
    })

    it('未定義の値はfalseと判定される', () => {
      expect(isReportReason('invalid_reason')).toBe(false)
    })

    it('空文字はfalseと判定される', () => {
      expect(isReportReason('')).toBe(false)
    })
  })

  describe('isReportTargetType', () => {
    it.each(REPORT_TARGET_TYPES)('%s は有効な通報対象種別と判定される', (value) => {
      expect(isReportTargetType(value)).toBe(true)
    })

    it('未定義の値はfalseと判定される', () => {
      expect(isReportTargetType('invalid_target')).toBe(false)
    })

    it('空文字はfalseと判定される', () => {
      expect(isReportTargetType('')).toBe(false)
    })
  })

  describe('CONTENT_TYPE_COLORS', () => {
    it('全カラーがTailwind CSSのbg-*-100 text-*-800形式である', () => {
      Object.values(CONTENT_TYPE_COLORS).forEach((color) => {
        expect(color).toMatch(/^bg-\w+-100 text-\w+-800$/)
      })
    })

    it('各タイプで異なる色が使用されている', () => {
      const colors = Object.values(CONTENT_TYPE_COLORS)
      expect(new Set(colors).size).toBe(colors.length)
    })
  })
})
