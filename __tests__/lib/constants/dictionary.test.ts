/**
 * lib/constants/dictionary.ts の境界テスト (P1: seed → runtime 分離回帰)。
 */
import { describe, it, expect } from 'vitest'
import {
  DICTIONARY_CATEGORIES,
  KANA_ROW_LABELS,
  KANA_ROWS,
  isDictionaryCategory,
  isKanaRowLabel,
} from '@/lib/constants/dictionary'

describe('isDictionaryCategory', () => {
  it('既知 category を narrow する', () => {
    for (const cat of DICTIONARY_CATEGORIES) {
      expect(isDictionaryCategory(cat)).toBe(true)
    }
  })

  it('未知文字列 / 非文字列は false', () => {
    expect(isDictionaryCategory('未定義')).toBe(false)
    expect(isDictionaryCategory(undefined)).toBe(false)
    expect(isDictionaryCategory(123)).toBe(false)
    expect(isDictionaryCategory(null)).toBe(false)
  })
})

describe('isKanaRowLabel', () => {
  it('既知 row を narrow する', () => {
    for (const label of KANA_ROW_LABELS) {
      expect(isKanaRowLabel(label)).toBe(true)
    }
  })

  it('未知 row は false', () => {
    expect(isKanaRowLabel('ま行未定義')).toBe(false)
    expect(isKanaRowLabel('')).toBe(false)
    expect(isKanaRowLabel(undefined)).toBe(false)
  })
})

describe('KANA_ROWS', () => {
  it('全 row が対応する pattern を持つ', () => {
    expect(KANA_ROWS).toHaveLength(KANA_ROW_LABELS.length)
    for (const { label, pattern } of KANA_ROWS) {
      expect(KANA_ROW_LABELS).toContain(label)
      expect(pattern).toBeInstanceOf(RegExp)
    }
  })

  it('ひらがな先頭文字を正しく行に分類する', () => {
    const aRow = KANA_ROWS.find((r) => r.label === 'あ行')!
    expect(aRow.pattern.test('あおき')).toBe(true)
    expect(aRow.pattern.test('くろまつ')).toBe(false)

    const kaRow = KANA_ROWS.find((r) => r.label === 'か行')!
    expect(kaRow.pattern.test('くろまつ')).toBe(true)
    expect(kaRow.pattern.test('ごぼう')).toBe(true)
  })
})

describe('seed → runtime 分離回帰', () => {
  it('prisma/seed/dictionary は lib/constants/dictionary から DICTIONARY_CATEGORIES を re-export する', async () => {
    const seed = await import('@/prisma/seed/dictionary/seed-dictionary')
    const runtime = await import('@/lib/constants/dictionary')
    expect(seed.DICTIONARY_CATEGORIES).toBe(runtime.DICTIONARY_CATEGORIES)
  })
})
