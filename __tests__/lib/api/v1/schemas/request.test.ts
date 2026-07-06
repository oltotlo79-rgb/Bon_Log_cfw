// @vitest-environment node
/**
 * lib/api/v1/schemas/request の geocodeQuerySchema ユニットテスト。
 *
 * GET /api/v1/geocode のクエリパラメータスキーマ。必須欠落・型不正・長さ境界値を検証する。
 * route レベルの正常系/一部エラー系は __tests__/app/api/v1/geocode/route.test.ts で担保済みのため、
 * ここではスキーマ自体の境界値網羅（min(1) / max(MAX_ADDRESS_LENGTH)）に焦点を当てる。
 */
import { describe, it, expect } from 'vitest'
import { geocodeQuerySchema } from '@/lib/api/v1/schemas/request'
import { MAX_ADDRESS_LENGTH } from '@/lib/constants/limits'

describe('geocodeQuerySchema', () => {
  it('正常系: 1 文字以上 MAX_ADDRESS_LENGTH 以内の address を受け付ける', () => {
    const result = geocodeQuerySchema.safeParse({ address: '東京都渋谷区' })

    expect(result.success).toBe(true)
    if (result.success) expect(result.data.address).toBe('東京都渋谷区')
  })

  it('address が空文字の場合は失敗する（min(1) 違反）', () => {
    const result = geocodeQuerySchema.safeParse({ address: '' })

    expect(result.success).toBe(false)
  })

  it('address が未指定（フィールド自体が無い）場合は失敗する', () => {
    const result = geocodeQuerySchema.safeParse({})

    expect(result.success).toBe(false)
  })

  it('address が数値など文字列以外の場合は失敗する（型不正）', () => {
    const result = geocodeQuerySchema.safeParse({ address: 12345 })

    expect(result.success).toBe(false)
  })

  it('address がちょうど MAX_ADDRESS_LENGTH 文字のときは成功する（境界値）', () => {
    const result = geocodeQuerySchema.safeParse({ address: 'あ'.repeat(MAX_ADDRESS_LENGTH) })

    expect(result.success).toBe(true)
  })

  it('address が MAX_ADDRESS_LENGTH を 1 文字超えると失敗する（境界値）', () => {
    const result = geocodeQuerySchema.safeParse({ address: 'あ'.repeat(MAX_ADDRESS_LENGTH + 1) })

    expect(result.success).toBe(false)
  })
})
