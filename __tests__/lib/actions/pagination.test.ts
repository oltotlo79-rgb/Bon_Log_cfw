import { buildCursorPagination } from '@/lib/actions/pagination'
import { DEFAULT_PAGE_LIMIT } from '@/lib/constants/limits'

describe('buildCursorPagination', () => {
  it('カーソルなしの場合はtakeのみ返す', () => {
    const result = buildCursorPagination()
    expect(result).toEqual({ take: DEFAULT_PAGE_LIMIT })
    expect(result).not.toHaveProperty('cursor')
    expect(result).not.toHaveProperty('skip')
  })

  it('カーソルありの場合はcursorとskipを含める', () => {
    const result = buildCursorPagination('abc123')
    expect(result).toEqual({
      take: DEFAULT_PAGE_LIMIT,
      cursor: { id: 'abc123' },
      skip: 1,
    })
  })

  it('カーソルがundefinedの場合はtakeのみ返す', () => {
    const result = buildCursorPagination(undefined)
    expect(result).toEqual({ take: DEFAULT_PAGE_LIMIT })
    expect(result).not.toHaveProperty('cursor')
    expect(result).not.toHaveProperty('skip')
  })

  it('カーソルが空文字の場合はtakeのみ返す', () => {
    const result = buildCursorPagination('')
    expect(result).toEqual({ take: DEFAULT_PAGE_LIMIT })
    expect(result).not.toHaveProperty('cursor')
    expect(result).not.toHaveProperty('skip')
  })

  it('デフォルトlimitはDEFAULT_PAGE_LIMITを使用する', () => {
    const result = buildCursorPagination()
    expect(result.take).toBe(DEFAULT_PAGE_LIMIT)
  })

  it('カスタムlimitを指定できる', () => {
    const result = buildCursorPagination(undefined, 10)
    expect(result.take).toBe(10)
  })

  it('カーソルありでカスタムlimitを指定できる', () => {
    const result = buildCursorPagination('cursor-id', 5)
    expect(result).toEqual({
      take: 5,
      cursor: { id: 'cursor-id' },
      skip: 1,
    })
  })

  it('limit=1でも正しく動作する', () => {
    const result = buildCursorPagination('some-id', 1)
    expect(result).toEqual({
      take: 1,
      cursor: { id: 'some-id' },
      skip: 1,
    })
  })

  it('skipは常に1である（カーソル自体をスキップ）', () => {
    const result = buildCursorPagination('any-cursor', 50)
    expect(result.skip).toBe(1)
  })
})
