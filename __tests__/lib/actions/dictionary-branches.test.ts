// @vitest-environment node
/**
 * lib/actions/dictionary.ts の分岐カバレッジを補完するテスト。
 *
 * 既存の dictionary.test.ts / dictionary-extended.test.ts は Error インスタンスの
 * throw のみを検証しており、`error instanceof Error ? error.message : String(error)`
 * の else 分岐（Error 以外の値が throw される場合）が getTermBySlug / getAdjacentTerms /
 * getRelatedTerms では未検証だった（getTerms のみテスト済み）。
 */
import { vi, describe, it, expect, beforeEach } from 'vitest'

const mockPrisma: Record<string, any> = {
  bonsaiTerm: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
  },
}

vi.mock('@/lib/db', () => ({ prisma: mockPrisma }))

const mockLoggerError = vi.fn()
vi.mock('@/lib/logger', () => ({
  __esModule: true,
  default: {
    log: vi.fn(),
    warn: vi.fn(),
    error: (...args: unknown[]) => mockLoggerError(...args),
    debug: vi.fn(),
  },
}))

describe('dictionary: Error 以外の throw 値のハンドリング', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('getTermBySlug: 文字列 throw でも { term: null } を返し、String(error) をログに残す', async () => {
    mockPrisma.bonsaiTerm.findUnique.mockRejectedValueOnce('connection reset')

    const { getTermBySlug } = await import('@/lib/actions/dictionary')
    const result = await getTermBySlug('any-slug')

    expect(result).toEqual({ term: null })
    expect(mockLoggerError).toHaveBeenCalledWith(
      'getTermBySlug failed',
      expect.objectContaining({ error: 'connection reset' }),
    )
  })

  it('getAdjacentTerms: 文字列 throw でも { prev: null, next: null } を返す', async () => {
    mockPrisma.bonsaiTerm.findMany.mockRejectedValueOnce('pool exhausted')

    const { getAdjacentTerms } = await import('@/lib/actions/dictionary')
    const result = await getAdjacentTerms('slug', 'category')

    expect(result).toEqual({ prev: null, next: null })
    expect(mockLoggerError).toHaveBeenCalledWith(
      'getAdjacentTerms failed',
      expect.objectContaining({ error: 'pool exhausted' }),
    )
  })

  it('getRelatedTerms: 文字列 throw でも { terms: [] } を返す', async () => {
    mockPrisma.bonsaiTerm.findMany.mockRejectedValueOnce('query timeout')

    const { getRelatedTerms } = await import('@/lib/actions/dictionary')
    const result = await getRelatedTerms('slug', 'category')

    expect(result).toEqual({ terms: [] })
    expect(mockLoggerError).toHaveBeenCalledWith(
      'getRelatedTerms failed',
      expect.objectContaining({ error: 'query timeout' }),
    )
  })
})
