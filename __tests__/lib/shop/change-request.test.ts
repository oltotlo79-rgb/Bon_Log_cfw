import { describe, it, expect } from 'vitest'
import {
  parseShopChangeRequestedChanges,
  hasMeaningfulChanges,
  shopChangeRequestInputSchema,
} from '@/lib/shop/change-request'
import {
  MAX_SHOP_NAME_LENGTH,
  MAX_SHOP_URL_LENGTH,
} from '@/lib/constants/limits'

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

describe('hasMeaningfulChanges', () => {
  it('非空の文字列フィールドが1つでもあればtrue', () => {
    expect(hasMeaningfulChanges({ name: '新名称' })).toBe(true)
  })

  it('全フィールドが空文字ならfalse', () => {
    expect(hasMeaningfulChanges({ name: '', address: '' })).toBe(false)
  })

  it('空オブジェクトはfalse', () => {
    expect(hasMeaningfulChanges({})).toBe(false)
  })

  it('undefinedのみのフィールドはfalse', () => {
    expect(hasMeaningfulChanges({ name: undefined, phone: undefined })).toBe(false)
  })

  it('複数フィールドが非空ならtrue', () => {
    expect(
      hasMeaningfulChanges({ name: '盆栽園', address: '東京都', website: '' })
    ).toBe(true)
  })
})

describe('shopChangeRequestInputSchema', () => {
  it('全フィールドが正しい形式なら成功する', () => {
    const result = shopChangeRequestInputSchema.safeParse({
      name: '盆栽園',
      address: '東京都',
      phone: '03-1234-5678',
      website: 'https://example.com',
      businessHours: '9-18',
      closedDays: '月',
    })
    expect(result.success).toBe(true)
  })

  it('空オブジェクト（全フィールドoptional）は成功する', () => {
    const result = shopChangeRequestInputSchema.safeParse({})
    expect(result.success).toBe(true)
  })

  it('未知のキーはstrictにより拒否される', () => {
    const result = shopChangeRequestInputSchema.safeParse({ unknownField: 'x' })
    expect(result.success).toBe(false)
  })

  it('nameが上限文字数を超えると失敗する', () => {
    const result = shopChangeRequestInputSchema.safeParse({
      name: 'a'.repeat(MAX_SHOP_NAME_LENGTH + 1),
    })
    expect(result.success).toBe(false)
  })

  it('nameが空文字（trim後）だと失敗する（min(1)）', () => {
    const result = shopChangeRequestInputSchema.safeParse({ name: '   ' })
    expect(result.success).toBe(false)
  })

  it('websiteがhttp(s)以外のスキームだと失敗する', () => {
    const result = shopChangeRequestInputSchema.safeParse({
      website: 'javascript:alert(1)',
    })
    expect(result.success).toBe(false)
  })

  it('websiteが空文字なら許容される（refineの早期OK分岐）', () => {
    const result = shopChangeRequestInputSchema.safeParse({ website: '' })
    expect(result.success).toBe(true)
  })

  it('websiteがhttps://で始まれば成功する', () => {
    const result = shopChangeRequestInputSchema.safeParse({ website: 'https://bon-log.com' })
    expect(result.success).toBe(true)
  })

  it('websiteがhttp://で始まれば成功する', () => {
    const result = shopChangeRequestInputSchema.safeParse({ website: 'http://bon-log.com' })
    expect(result.success).toBe(true)
  })

  it('websiteが上限文字数を超えると失敗する', () => {
    const result = shopChangeRequestInputSchema.safeParse({
      website: 'https://' + 'a'.repeat(MAX_SHOP_URL_LENGTH),
    })
    expect(result.success).toBe(false)
  })
})
