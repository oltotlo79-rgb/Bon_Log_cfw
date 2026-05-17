/**
 * normalizeCursorPagination の境界値テスト (P1-5 回帰)。
 */
import { describe, it, expect } from 'vitest'
import { normalizeCursorPagination } from '@/lib/actions/pagination'
import { DEFAULT_PAGE_LIMIT, MAX_PAGE_LIMIT } from '@/lib/constants/limits'

describe('normalizeCursorPagination', () => {
  it('limit 未指定なら DEFAULT_PAGE_LIMIT', () => {
    expect(normalizeCursorPagination({}).limit).toBe(DEFAULT_PAGE_LIMIT)
  })

  it('limit が MAX_PAGE_LIMIT を超えるなら clamp', () => {
    expect(normalizeCursorPagination({ limit: 99999 }).limit).toBe(MAX_PAGE_LIMIT)
  })

  it('limit が 0 以下なら DEFAULT_PAGE_LIMIT に戻る', () => {
    expect(normalizeCursorPagination({ limit: 0 }).limit).toBe(DEFAULT_PAGE_LIMIT)
    expect(normalizeCursorPagination({ limit: -5 }).limit).toBe(DEFAULT_PAGE_LIMIT)
  })

  it('limit が NaN なら DEFAULT_PAGE_LIMIT', () => {
    expect(normalizeCursorPagination({ limit: NaN }).limit).toBe(DEFAULT_PAGE_LIMIT)
  })

  it('cursor が空文字なら undefined', () => {
    expect(normalizeCursorPagination({ cursor: '' }).cursor).toBeUndefined()
  })

  it('cursor が許可外文字を含むなら undefined (注入対策)', () => {
    expect(normalizeCursorPagination({ cursor: 'abc;DROP' }).cursor).toBeUndefined()
    expect(normalizeCursorPagination({ cursor: '/etc/passwd' }).cursor).toBeUndefined()
    expect(normalizeCursorPagination({ cursor: 'a b' }).cursor).toBeUndefined()
  })

  it('cursor が cuid 風文字列ならそのまま通す', () => {
    expect(
      normalizeCursorPagination({ cursor: 'cln9f8s7x0000abc123' }).cursor,
    ).toBe('cln9f8s7x0000abc123')
  })

  it('cursor が長すぎるなら undefined', () => {
    expect(normalizeCursorPagination({ cursor: 'a'.repeat(65) }).cursor).toBeUndefined()
  })
})
