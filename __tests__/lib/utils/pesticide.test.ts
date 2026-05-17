// @vitest-environment node

import { describe, it, expect } from 'vitest'
import {
  getMaffUrl,
  getResistanceRiskLabel,
  RESISTANCE_RISK_LABELS,
  RESISTANCE_RISK_ORDER,
  normalizePesticideType,
  VALID_PESTICIDE_TYPES,
} from '@/lib/utils/pesticide'

describe('getMaffUrl', () => {
  const base = 'https://pesticide.maff.go.jp/agricultural-chemicals/details'

  it('登録番号からMAFF詳細URLを生成する', () => {
    expect(getMaffUrl('19842')).toBe(`${base}/19842`)
  })

  it('5桁の登録番号で正しいURLを返す', () => {
    expect(getMaffUrl('22506')).toBe(`${base}/22506`)
  })

  it('4桁の登録番号でも正しいURLを返す', () => {
    expect(getMaffUrl('8086')).toBe(`${base}/8086`)
  })

  it('空文字の場合はパス末尾が/になる', () => {
    expect(getMaffUrl('')).toBe(`${base}/`)
  })
})

describe('getResistanceRiskLabel', () => {
  it('lowのとき「つきにくい」を返す', () => {
    expect(getResistanceRiskLabel('low')).toBe('つきにくい')
  })

  it('mediumのとき「ややつきやすい」を返す', () => {
    expect(getResistanceRiskLabel('medium')).toBe('ややつきやすい')
  })

  it('highのとき「つきやすい」を返す', () => {
    expect(getResistanceRiskLabel('high')).toBe('つきやすい')
  })

  it('nullのときnullを返す', () => {
    expect(getResistanceRiskLabel(null)).toBeNull()
  })

  it('undefinedのときnullを返す', () => {
    expect(getResistanceRiskLabel(undefined)).toBeNull()
  })

  it('不正な文字列のときnullを返す', () => {
    expect(getResistanceRiskLabel('unknown' as never)).toBeNull()
  })
})

describe('RESISTANCE_RISK_LABELS', () => {
  it('3つのリスクレベルのラベルが正確に定義されている', () => {
    expect(RESISTANCE_RISK_LABELS).toEqual({
      low: 'つきにくい',
      medium: 'ややつきやすい',
      high: 'つきやすい',
    })
  })

  it('キーが3つ（low, medium, high）のみ', () => {
    expect(Object.keys(RESISTANCE_RISK_LABELS)).toEqual(['low', 'medium', 'high'])
  })
})

describe('RESISTANCE_RISK_ORDER', () => {
  it('high > medium > lowの順序が保証されている', () => {
    expect(RESISTANCE_RISK_ORDER.high).toBeGreaterThan(RESISTANCE_RISK_ORDER.medium)
    expect(RESISTANCE_RISK_ORDER.medium).toBeGreaterThan(RESISTANCE_RISK_ORDER.low)
  })

  it('具体的な数値が正しい', () => {
    expect(RESISTANCE_RISK_ORDER).toEqual({ high: 3, medium: 2, low: 1 })
  })
})

describe('normalizePesticideType', () => {
  it('有効なタイプはそのまま返す', () => {
    expect(normalizePesticideType('fungicide')).toBe('fungicide')
    expect(normalizePesticideType('insecticide')).toBe('insecticide')
    expect(normalizePesticideType('acaricide')).toBe('acaricide')
    expect(normalizePesticideType('compound')).toBe('compound')
    expect(normalizePesticideType('other')).toBe('other')
  })

  it('herbicideはotherに正規化する', () => {
    expect(normalizePesticideType('herbicide')).toBe('other')
  })

  it('undefinedはundefinedを返す', () => {
    expect(normalizePesticideType(undefined)).toBeUndefined()
  })

  it('空文字はundefinedを返す', () => {
    expect(normalizePesticideType('')).toBeUndefined()
  })

  it('不正なタイプはundefinedを返す', () => {
    expect(normalizePesticideType('invalid')).toBeUndefined()
    expect(normalizePesticideType('FUNGICIDE')).toBeUndefined()
  })
})

describe('VALID_PESTICIDE_TYPES', () => {
  it('5つのタイプが定義されている', () => {
    expect(VALID_PESTICIDE_TYPES).toEqual([
      'fungicide', 'insecticide', 'acaricide', 'compound', 'other',
    ])
  })
})
