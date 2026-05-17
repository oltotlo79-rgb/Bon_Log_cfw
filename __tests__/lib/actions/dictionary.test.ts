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

describe('getTerms', async () => {
  const { getTerms } = await import('@/lib/actions/dictionary')

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns all terms with no options', async () => {
    const mockTerms = [
      { id: '1', slug: 'shohin', term: '小品', reading: 'しょうひん', category: '樹形', description: '小さな盆栽' },
      { id: '2', slug: 'moyogi', term: '模様木', reading: 'もようぎ', category: '樹形', description: '曲がった幹' },
    ]
    mockPrisma.bonsaiTerm.findMany.mockResolvedValue(mockTerms)

    const result = await getTerms()
    expect(result).toEqual({ terms: mockTerms })
    expect(mockPrisma.bonsaiTerm.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: [{ reading: 'asc' }, { sortOrder: 'asc' }],
      })
    )
  })

  it('returns empty terms array when no terms exist', async () => {
    mockPrisma.bonsaiTerm.findMany.mockResolvedValue([])

    const result = await getTerms()
    expect(result).toEqual({ terms: [] })
  })

  it('filters by category', async () => {
    const mockTerms = [
      { id: '1', slug: 'shohin', term: '小品', reading: 'しょうひん', category: '樹形', description: '小さな盆栽' },
    ]
    mockPrisma.bonsaiTerm.findMany.mockResolvedValue(mockTerms)

    const result = await getTerms({ category: '樹形' })
    expect(result).toEqual({ terms: mockTerms })
    expect(mockPrisma.bonsaiTerm.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ category: '樹形' }),
      })
    )
  })

  it('searches by term text', async () => {
    const mockTerms = [
      { id: '1', slug: 'shohin', term: '小品', reading: 'しょうひん', category: '樹形', description: '小さな盆栽' },
    ]
    mockPrisma.bonsaiTerm.findMany.mockResolvedValue(mockTerms)

    await getTerms({ search: '小品' })
    expect(mockPrisma.bonsaiTerm.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: expect.arrayContaining([
            { term: { contains: '小品' } },
            { reading: { contains: '小品' } },
            { description: { contains: '小品' } },
          ]),
        }),
      })
    )
  })

  it('combines category and search filters', async () => {
    mockPrisma.bonsaiTerm.findMany.mockResolvedValue([])

    await getTerms({ category: '樹形', search: '木' })
    expect(mockPrisma.bonsaiTerm.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          category: '樹形',
          OR: expect.any(Array),
        }),
      })
    )
  })

  it('does not include category filter when category is not provided', async () => {
    mockPrisma.bonsaiTerm.findMany.mockResolvedValue([])

    await getTerms({ search: '木' })
    const callArgs = mockPrisma.bonsaiTerm.findMany.mock.calls[0][0]
    expect(callArgs.where).not.toHaveProperty('category')
  })

  it('does not include OR filter when search is not provided', async () => {
    mockPrisma.bonsaiTerm.findMany.mockResolvedValue([])

    await getTerms({ category: '用具' })
    const callArgs = mockPrisma.bonsaiTerm.findMany.mock.calls[0][0]
    expect(callArgs.where).not.toHaveProperty('OR')
  })

  it('selects required fields', async () => {
    mockPrisma.bonsaiTerm.findMany.mockResolvedValue([])

    await getTerms()
    expect(mockPrisma.bonsaiTerm.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        select: {
          id: true,
          slug: true,
          term: true,
          reading: true,
          category: true,
          description: true,
        },
      })
    )
  })
})

describe('getTermBySlug', async () => {
  const { getTermBySlug } = await import('@/lib/actions/dictionary')

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns term when found', async () => {
    const mockTerm = {
      id: '1',
      slug: 'shohin',
      term: '小品',
      reading: 'しょうひん',
      description: '小さな盆栽',
      category: '樹形',
      sortOrder: 1,
    }
    mockPrisma.bonsaiTerm.findUnique.mockResolvedValue(mockTerm)

    const result = await getTermBySlug('shohin')
    expect(result).toEqual({ term: mockTerm })
    expect(mockPrisma.bonsaiTerm.findUnique).toHaveBeenCalledWith({
      where: { slug: 'shohin' },
      select: {
        id: true,
        slug: true,
        term: true,
        reading: true,
        description: true,
        category: true,
        sortOrder: true,
      },
    })
  })

  it('returns null when term not found', async () => {
    mockPrisma.bonsaiTerm.findUnique.mockResolvedValue(null)

    const result = await getTermBySlug('nonexistent-slug')
    expect(result).toEqual({ term: null })
  })

  it('includes sortOrder in the selection', async () => {
    mockPrisma.bonsaiTerm.findUnique.mockResolvedValue(null)

    await getTermBySlug('test-slug')
    const callArgs = mockPrisma.bonsaiTerm.findUnique.mock.calls[0][0]
    expect(callArgs.select).toHaveProperty('sortOrder', true)
  })
})

describe('getAdjacentTerms', async () => {
  const { getAdjacentTerms } = await import('@/lib/actions/dictionary')

  beforeEach(() => {
    vi.clearAllMocks()
  })

  const makeTerms = (slugs: string[]) =>
    slugs.map((slug, i) => ({
      id: String(i + 1),
      slug,
      term: `term-${slug}`,
      reading: `reading-${slug}`,
      category: '樹形',
      description: `description-${slug}`,
    }))

  it('returns prev and next when term is in middle', async () => {
    const terms = makeTerms(['alpha', 'beta', 'gamma'])
    mockPrisma.bonsaiTerm.findMany.mockResolvedValue(terms)

    const result = await getAdjacentTerms('beta', '樹形')
    expect(result.prev?.slug).toBe('alpha')
    expect(result.next?.slug).toBe('gamma')
  })

  it('returns null prev for first term', async () => {
    const terms = makeTerms(['alpha', 'beta', 'gamma'])
    mockPrisma.bonsaiTerm.findMany.mockResolvedValue(terms)

    const result = await getAdjacentTerms('alpha', '樹形')
    expect(result.prev).toBeNull()
    expect(result.next?.slug).toBe('beta')
  })

  it('returns null next for last term', async () => {
    const terms = makeTerms(['alpha', 'beta', 'gamma'])
    mockPrisma.bonsaiTerm.findMany.mockResolvedValue(terms)

    const result = await getAdjacentTerms('gamma', '樹形')
    expect(result.prev?.slug).toBe('beta')
    expect(result.next).toBeNull()
  })

  it('returns both null when slug not found in category', async () => {
    const terms = makeTerms(['alpha', 'beta'])
    mockPrisma.bonsaiTerm.findMany.mockResolvedValue(terms)

    const result = await getAdjacentTerms('nonexistent', '樹形')
    expect(result.prev).toBeNull()
    expect(result.next).toBeNull()
  })

  it('returns both null when category has only one term', async () => {
    const terms = makeTerms(['only'])
    mockPrisma.bonsaiTerm.findMany.mockResolvedValue(terms)

    const result = await getAdjacentTerms('only', '樹形')
    expect(result.prev).toBeNull()
    expect(result.next).toBeNull()
  })

  it('returns both null when category has no terms', async () => {
    mockPrisma.bonsaiTerm.findMany.mockResolvedValue([])

    const result = await getAdjacentTerms('any-slug', '用具')
    expect(result.prev).toBeNull()
    expect(result.next).toBeNull()
  })

  it('queries only the given category', async () => {
    mockPrisma.bonsaiTerm.findMany.mockResolvedValue([])

    await getAdjacentTerms('slug', '用具')
    expect(mockPrisma.bonsaiTerm.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { category: '用具' } })
    )
  })

  it('orders by reading then sortOrder', async () => {
    mockPrisma.bonsaiTerm.findMany.mockResolvedValue([])

    await getAdjacentTerms('slug', '樹形')
    expect(mockPrisma.bonsaiTerm.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: [{ reading: 'asc' }, { sortOrder: 'asc' }],
      })
    )
  })
})

// ============================================================
// エラーハンドリング（catch ブランチ）
// ============================================================

describe('dictionary - エラーハンドリング', async () => {
  const { getTerms, getTermBySlug, getAdjacentTerms } = await import('@/lib/actions/dictionary')

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('getTerms: Prisma が例外を投げたら空配列を返し logger.error が呼ばれる', async () => {
    mockPrisma.bonsaiTerm.findMany.mockRejectedValueOnce(new Error('DB connection lost'))

    const result = await getTerms()
    expect(result).toEqual({ terms: [] })
    expect(mockLoggerError).toHaveBeenCalledWith(
      'getTerms failed',
      expect.objectContaining({ error: 'DB connection lost' }),
    )
  })

  it('getTerms: Error 以外（文字列 throw）も catch して空配列を返す', async () => {
    mockPrisma.bonsaiTerm.findMany.mockRejectedValueOnce('raw string error')

    const result = await getTerms({ search: 'x' })
    expect(result).toEqual({ terms: [] })
    expect(mockLoggerError).toHaveBeenCalledWith(
      'getTerms failed',
      expect.objectContaining({ error: 'raw string error' }),
    )
  })

  it('getTermBySlug: 例外時は { term: null } を返す', async () => {
    mockPrisma.bonsaiTerm.findUnique.mockRejectedValueOnce(new Error('timeout'))

    const result = await getTermBySlug('any-slug')
    expect(result).toEqual({ term: null })
    expect(mockLoggerError).toHaveBeenCalledWith(
      'getTermBySlug failed',
      expect.objectContaining({ error: 'timeout' }),
    )
  })

  it('getAdjacentTerms: 例外時は { prev: null, next: null } を返す', async () => {
    mockPrisma.bonsaiTerm.findMany.mockRejectedValueOnce(new Error('boom'))

    const result = await getAdjacentTerms('s', 'c')
    expect(result).toEqual({ prev: null, next: null })
    expect(mockLoggerError).toHaveBeenCalledWith(
      'getAdjacentTerms failed',
      expect.objectContaining({ error: 'boom' }),
    )
  })
})
