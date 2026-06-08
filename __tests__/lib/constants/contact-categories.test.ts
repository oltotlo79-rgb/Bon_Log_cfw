import { describe, it, expect } from 'vitest'
import {
  CONTACT_CATEGORIES,
  CONTACT_CATEGORY_VALUES,
  CONTACT_CATEGORY_LABELS,
} from '@/lib/constants/contact-categories'

describe('contact-categories（お問い合わせ分類の単一の真実）', () => {
  it('「不適切なコンテンツの報告」(report) を含む', () => {
    expect(CONTACT_CATEGORY_VALUES).toContain('report')
    expect(CONTACT_CATEGORY_LABELS.report).toBe('不適切なコンテンツの報告')
  })

  it('VALUES は CATEGORIES の value から導出される（重複定義を作らない）', () => {
    expect(CONTACT_CATEGORY_VALUES).toEqual(CONTACT_CATEGORIES.map((c) => c.value))
  })

  it('LABELS は全 value を value→label で網羅する', () => {
    for (const { value, label } of CONTACT_CATEGORIES) {
      expect(CONTACT_CATEGORY_LABELS[value]).toBe(label)
    }
    expect(Object.keys(CONTACT_CATEGORY_LABELS)).toHaveLength(CONTACT_CATEGORIES.length)
  })
})
