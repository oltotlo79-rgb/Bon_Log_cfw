// @vitest-environment node
/**
 * lib/services/dictionary-read-service のユニットテスト
 *
 * listDictionaryTerms の row フィルタ（in-memory ロジック）・カーソル・
 * 並び（reading ASC）・エラーハンドリング、
 * getDictionaryTermBySlug の正常系・不存在・prev/next/related を検証する。
 */
import { vi, describe, it, expect, beforeEach } from 'vitest'

vi.mock('server-only', () => ({}))

const mockBonsaiTermFindMany = vi.fn()
const mockBonsaiTermFindUnique = vi.fn()

vi.mock('@/lib/db', () => ({
  prisma: {
    bonsaiTerm: {
      findMany: (...args: unknown[]) => mockBonsaiTermFindMany(...args),
      findUnique: (...args: unknown[]) => mockBonsaiTermFindUnique(...args),
    },
  },
}))

const mockLoggerError = vi.fn()
vi.mock('@/lib/logger', () => ({
  default: {
    error: (...args: unknown[]) => mockLoggerError(...args),
  },
}))

const makeTerms = (overrides: Array<{ id: string; slug: string; term: string; reading: string; category: string }>) =>
  overrides.map((t) => ({ ...t }))

describe('listDictionaryTerms', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('row フィルタなし: DB から取得した items をそのまま返す', async () => {
    const dbTerms = makeTerms([
      { id: 't1', slug: 'bunjingi', term: '文人木', reading: 'ぶんじんぎ', category: '樹形' },
      { id: 't2', slug: 'chokkan', term: '直幹', reading: 'ちょっかん', category: '樹形' },
    ])
    mockBonsaiTermFindMany.mockResolvedValue(dbTerms)

    const { listDictionaryTerms } = await import('@/lib/services/dictionary-read-service')
    const result = await listDictionaryTerms({ limit: 20 })

    expect(result.items).toHaveLength(2)
    expect(result.nextCursor).toBeNull()
  })

  it('limit+1 件返ったとき nextCursor を設定する', async () => {
    const dbTerms = makeTerms(
      Array.from({ length: 21 }, (_, i) => ({
        id: `t${i}`,
        slug: `term-${i}`,
        term: `用語${i}`,
        reading: `ようご${i}`,
        category: '樹形',
      })),
    )
    mockBonsaiTermFindMany.mockResolvedValue(dbTerms)

    const { listDictionaryTerms } = await import('@/lib/services/dictionary-read-service')
    const result = await listDictionaryTerms({ limit: 20 })

    expect(result.items).toHaveLength(20)
    expect(result.nextCursor).toBe('term-19')
  })

  it('row=あ行 フィルタで reading が「あ行」の items のみ返す', async () => {
    const dbTerms = makeTerms([
      { id: 't1', slug: 'amikin', term: '網金', reading: 'あみきん', category: '技術・作業' },
      { id: 't2', slug: 'chokkan', term: '直幹', reading: 'ちょっかん', category: '樹形' },
      { id: 't3', slug: 'edakin', term: '枝金', reading: 'えだきん', category: '技術・作業' },
    ])
    mockBonsaiTermFindMany.mockResolvedValue(dbTerms)

    const { listDictionaryTerms } = await import('@/lib/services/dictionary-read-service')
    const result = await listDictionaryTerms({ limit: 20, row: 'あ行' })

    expect(result.items.every((item) => /^[あいうえお]/.test(item.reading))).toBe(true)
    expect(result.items).toHaveLength(2)
  })

  it('row=か行 フィルタで reading が「か行」の items のみ返す（濁音含む）', async () => {
    const dbTerms = makeTerms([
      { id: 't1', slug: 'kanuma', term: '鹿沼土', reading: 'かぬまつち', category: '用土・肥料' },
      { id: 't2', slug: 'chokkan', term: '直幹', reading: 'ちょっかん', category: '樹形' },
      { id: 't3', slug: 'ginza', term: '銀座', reading: 'ぎんざ', category: '展示・鑑賞' },
    ])
    mockBonsaiTermFindMany.mockResolvedValue(dbTerms)

    const { listDictionaryTerms } = await import('@/lib/services/dictionary-read-service')
    const result = await listDictionaryTerms({ limit: 20, row: 'か行' })

    expect(result.items).toHaveLength(2)
    expect(result.items.every((item) => /^[かきくけこが-ご]/.test(item.reading))).toBe(true)
  })

  it('row フィルタ結果が limit を超えるとき nextCursor を設定する', async () => {
    const dbTerms = makeTerms(
      Array.from({ length: 25 }, (_, i) => ({
        id: `t${i}`,
        slug: `term-${i}`,
        term: `用語${i}`,
        reading: `あ${i}`,
        category: '樹形',
      })),
    )
    mockBonsaiTermFindMany.mockResolvedValue(dbTerms)

    const { listDictionaryTerms } = await import('@/lib/services/dictionary-read-service')
    const result = await listDictionaryTerms({ limit: 20, row: 'あ行' })

    expect(result.items).toHaveLength(20)
    expect(result.nextCursor).not.toBeNull()
  })

  it('search パラメータが DB クエリに渡される', async () => {
    mockBonsaiTermFindMany.mockResolvedValue([])

    const { listDictionaryTerms } = await import('@/lib/services/dictionary-read-service')
    await listDictionaryTerms({ limit: 20, search: '松' })

    expect(mockBonsaiTermFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ OR: expect.any(Array) }),
      }),
    )
  })

  it('category パラメータが DB クエリに渡される', async () => {
    mockBonsaiTermFindMany.mockResolvedValue([])

    const { listDictionaryTerms } = await import('@/lib/services/dictionary-read-service')
    await listDictionaryTerms({ limit: 20, category: '樹形' })

    expect(mockBonsaiTermFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ category: '樹形' }),
      }),
    )
  })

  it('DB エラー時は { items: [], nextCursor: null } を返す', async () => {
    mockBonsaiTermFindMany.mockRejectedValue(new Error('DB connection failed'))

    const { listDictionaryTerms } = await import('@/lib/services/dictionary-read-service')
    const result = await listDictionaryTerms({ limit: 20 })

    expect(result.items).toHaveLength(0)
    expect(result.nextCursor).toBeNull()
    expect(mockLoggerError).toHaveBeenCalled()
  })

  it('orderBy が [{ reading: asc }, { sortOrder: asc }] で呼ばれる', async () => {
    mockBonsaiTermFindMany.mockResolvedValue([])

    const { listDictionaryTerms } = await import('@/lib/services/dictionary-read-service')
    await listDictionaryTerms({ limit: 20 })

    expect(mockBonsaiTermFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: [{ reading: 'asc' }, { sortOrder: 'asc' }],
      }),
    )
  })

  it('cursor 指定時（row なし）は cursor/skip:1 を付与してカーソルページネーションする', async () => {
    mockBonsaiTermFindMany.mockResolvedValue([])

    const { listDictionaryTerms } = await import('@/lib/services/dictionary-read-service')
    await listDictionaryTerms({ limit: 20, cursor: 'term-19' })

    expect(mockBonsaiTermFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        cursor: { slug: 'term-19' },
        skip: 1,
      }),
    )
  })

  it('row 指定時は cursor があってもカーソル方式を使わない（in-memory 全件フィルタのため）', async () => {
    mockBonsaiTermFindMany.mockResolvedValue([])

    const { listDictionaryTerms } = await import('@/lib/services/dictionary-read-service')
    await listDictionaryTerms({ limit: 20, cursor: 'term-19', row: 'あ行' })

    const callArgs = mockBonsaiTermFindMany.mock.calls[0]?.[0] as { cursor?: unknown; skip?: unknown }
    expect(callArgs.cursor).toBeUndefined()
    expect(callArgs.skip).toBeUndefined()
  })
})

describe('dictionaryListQuerySchema', () => {
  it('row が未指定（undefined）なら成功する', async () => {
    const { dictionaryListQuerySchema } = await import('@/lib/services/dictionary-read-service')
    const result = dictionaryListQuerySchema.safeParse({ limit: 20 })
    expect(result.success).toBe(true)
  })

  it('row が有効なかな行ラベルなら成功する', async () => {
    const { dictionaryListQuerySchema } = await import('@/lib/services/dictionary-read-service')
    const result = dictionaryListQuerySchema.safeParse({ row: 'あ行' })
    expect(result.success).toBe(true)
  })

  it('row が無効な値なら失敗する', async () => {
    const { dictionaryListQuerySchema } = await import('@/lib/services/dictionary-read-service')
    const result = dictionaryListQuerySchema.safeParse({ row: '無効な行' })
    expect(result.success).toBe(false)
  })

  it('limit を省略すると DEFAULT_PAGE_LIMIT が適用される', async () => {
    const { dictionaryListQuerySchema } = await import('@/lib/services/dictionary-read-service')
    const result = dictionaryListQuerySchema.safeParse({})
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.limit).toBeGreaterThan(0)
    }
  })
})

describe('dictionarySlugSchema', () => {
  it('有効な slug は成功する', async () => {
    const { dictionarySlugSchema } = await import('@/lib/services/dictionary-read-service')
    expect(dictionarySlugSchema.safeParse('chokkan').success).toBe(true)
  })

  it('空文字は失敗する', async () => {
    const { dictionarySlugSchema } = await import('@/lib/services/dictionary-read-service')
    expect(dictionarySlugSchema.safeParse('').success).toBe(false)
  })
})

describe('getDictionaryTermBySlug', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('正常系: term, prev, next, related を返す', async () => {
    const mockTerm = {
      id: 't2',
      slug: 'chokkan',
      term: '直幹',
      reading: 'ちょっかん',
      description: '真っ直ぐに立ち上がる幹の形式',
      category: '樹形',
      sortOrder: 2,
    }
    const mockCategory = [
      { id: 't1', slug: 'amikin', term: '網金', reading: 'あみきん', category: '樹形' },
      { id: 't2', slug: 'chokkan', term: '直幹', reading: 'ちょっかん', category: '樹形' },
      { id: 't3', slug: 'hankan', term: '半幹', reading: 'はんかん', category: '樹形' },
    ]
    const mockRelated = [
      { id: 't1', slug: 'amikin', term: '網金', reading: 'あみきん', category: '樹形' },
    ]

    mockBonsaiTermFindUnique.mockResolvedValueOnce(mockTerm)
    mockBonsaiTermFindMany
      .mockResolvedValueOnce(mockCategory)
      .mockResolvedValueOnce(mockRelated)

    const { getDictionaryTermBySlug } = await import('@/lib/services/dictionary-read-service')
    const result = await getDictionaryTermBySlug('chokkan')

    expect(result.term).not.toBeNull()
    expect(result.term?.slug).toBe('chokkan')
    expect(result.term?.description).toBe('真っ直ぐに立ち上がる幹の形式')
    expect(result.prev?.slug).toBe('amikin')
    expect(result.next?.slug).toBe('hankan')
    expect(result.related).toHaveLength(1)
  })

  it('term が先頭のとき prev が null', async () => {
    const mockTerm = {
      id: 't1',
      slug: 'amikin',
      term: '網金',
      reading: 'あみきん',
      description: '針金',
      category: '技術・作業',
      sortOrder: 1,
    }
    const mockCategory = [
      { id: 't1', slug: 'amikin', term: '網金', reading: 'あみきん', category: '技術・作業' },
      { id: 't2', slug: 'edakin', term: '枝金', reading: 'えだきん', category: '技術・作業' },
    ]

    mockBonsaiTermFindUnique.mockResolvedValueOnce(mockTerm)
    mockBonsaiTermFindMany
      .mockResolvedValueOnce(mockCategory)
      .mockResolvedValueOnce([])

    const { getDictionaryTermBySlug } = await import('@/lib/services/dictionary-read-service')
    const result = await getDictionaryTermBySlug('amikin')

    expect(result.prev).toBeNull()
    expect(result.next?.slug).toBe('edakin')
  })

  it('term が末尾のとき next が null', async () => {
    const mockTerm = {
      id: 't3',
      slug: 'hankan',
      term: '半幹',
      reading: 'はんかん',
      description: '半ば曲がった幹',
      category: '樹形',
      sortOrder: 3,
    }
    const mockCategory = [
      { id: 't1', slug: 'amikin', term: '網金', reading: 'あみきん', category: '樹形' },
      { id: 't2', slug: 'chokkan', term: '直幹', reading: 'ちょっかん', category: '樹形' },
      { id: 't3', slug: 'hankan', term: '半幹', reading: 'はんかん', category: '樹形' },
    ]

    mockBonsaiTermFindUnique.mockResolvedValueOnce(mockTerm)
    mockBonsaiTermFindMany
      .mockResolvedValueOnce(mockCategory)
      .mockResolvedValueOnce([])

    const { getDictionaryTermBySlug } = await import('@/lib/services/dictionary-read-service')
    const result = await getDictionaryTermBySlug('hankan')

    expect(result.next).toBeNull()
    expect(result.prev?.slug).toBe('chokkan')
  })

  it('不存在 slug → { term: null, prev: null, next: null, related: [] }', async () => {
    mockBonsaiTermFindUnique.mockResolvedValueOnce(null)

    const { getDictionaryTermBySlug } = await import('@/lib/services/dictionary-read-service')
    const result = await getDictionaryTermBySlug('no-such-slug')

    expect(result.term).toBeNull()
    expect(result.prev).toBeNull()
    expect(result.next).toBeNull()
    expect(result.related).toHaveLength(0)
  })

  it('DB エラー時は { term: null, prev: null, next: null, related: [] } を返す', async () => {
    mockBonsaiTermFindUnique.mockRejectedValue(new Error('DB error'))

    const { getDictionaryTermBySlug } = await import('@/lib/services/dictionary-read-service')
    const result = await getDictionaryTermBySlug('bunjingi')

    expect(result.term).toBeNull()
    expect(mockLoggerError).toHaveBeenCalled()
  })
})
