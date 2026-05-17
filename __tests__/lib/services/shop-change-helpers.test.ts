import { describe, it, expect } from 'vitest'
import { parseShopChangeRequestedChanges } from '@/lib/services/shop-change-helpers'

describe('parseShopChangeRequestedChanges', () => {
  it('有効なオブジェクトをそのまま返す', () => {
    const input = { name: '新名称', address: '新住所' }
    expect(parseShopChangeRequestedChanges(input)).toEqual(input)
  })

  it('未知のフィールドは strip される', () => {
    const input = { name: '新名称', unknownField: 'value' }
    expect(parseShopChangeRequestedChanges(input)).toEqual({ name: '新名称' })
  })

  it('null / undefined / 配列 / プリミティブは空オブジェクトを返す', () => {
    expect(parseShopChangeRequestedChanges(null)).toEqual({})
    expect(parseShopChangeRequestedChanges(undefined)).toEqual({})
    expect(parseShopChangeRequestedChanges([])).toEqual({})
    expect(parseShopChangeRequestedChanges('str')).toEqual({})
    expect(parseShopChangeRequestedChanges(42)).toEqual({})
  })

  it('型が一致しないフィールドが混ざっている場合は安全に空オブジェクトを返す', () => {
    // Zod strip + safeParse のため、型違反があれば全体が無効扱い
    const input = { name: 123 }
    expect(parseShopChangeRequestedChanges(input)).toEqual({})
  })

  it('空オブジェクトはそのまま空オブジェクト', () => {
    expect(parseShopChangeRequestedChanges({})).toEqual({})
  })

  it('全フィールドを含むオブジェクトを受け入れる', () => {
    const input = {
      name: '盆栽園',
      address: '住所',
      phone: '03-1234-5678',
      website: 'https://example.com',
      businessHours: '9-18',
      closedDays: '月',
    }
    expect(parseShopChangeRequestedChanges(input)).toEqual(input)
  })
})
