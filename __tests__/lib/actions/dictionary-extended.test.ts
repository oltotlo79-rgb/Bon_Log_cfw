// @vitest-environment node

import { vi, describe, it, expect, beforeEach } from 'vitest'

const mockPrisma: Record<string, any> = {
  bonsaiTerm: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
  },
}

vi.mock('@/lib/db', () => ({ prisma: mockPrisma }))

describe('Dictionary Actions Extended', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ----------------------------------------------------------
  // getTerms — edge cases
  // ----------------------------------------------------------
  describe('getTerms', () => {
    it('検索語に特殊文字が含まれてもDB検索パラメータに渡される', async () => {
      const { getTerms } = await import('@/lib/actions/dictionary')
      mockPrisma.bonsaiTerm.findMany.mockResolvedValue([])

      await getTerms({ search: '松%柏_類' })
      expect(mockPrisma.bonsaiTerm.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: expect.arrayContaining([
              { term: { contains: '松%柏_類' } },
            ]),
          }),
        })
      )
    })

    it('検索語にSQLインジェクション風の文字列を渡してもそのまま渡す', async () => {
      const { getTerms } = await import('@/lib/actions/dictionary')
      mockPrisma.bonsaiTerm.findMany.mockResolvedValue([])

      const malicious = "'; DROP TABLE bonsai_terms; --"
      await getTerms({ search: malicious })
      expect(mockPrisma.bonsaiTerm.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: expect.arrayContaining([
              { term: { contains: malicious } },
            ]),
          }),
        })
      )
    })

    it('take制限がMAX_DICTIONARY_TERMS_LIMITで設定される', async () => {
      const { getTerms } = await import('@/lib/actions/dictionary')
      mockPrisma.bonsaiTerm.findMany.mockResolvedValue([])

      await getTerms()
      expect(mockPrisma.bonsaiTerm.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 500, // MAX_DICTIONARY_TERMS_LIMIT
        })
      )
    })

    it('空のオプションオブジェクトを渡してもフィルタなしで検索する', async () => {
      const { getTerms } = await import('@/lib/actions/dictionary')
      mockPrisma.bonsaiTerm.findMany.mockResolvedValue([])

      await getTerms({})
      const callArgs = mockPrisma.bonsaiTerm.findMany.mock.calls[0][0]
      expect(callArgs.where).not.toHaveProperty('category')
      expect(callArgs.where).not.toHaveProperty('OR')
    })

    it('大量のデータを返す場合も正しく返す', async () => {
      const { getTerms } = await import('@/lib/actions/dictionary')
      const manyTerms = Array.from({ length: 100 }, (_, i) => ({
        id: String(i),
        slug: `term-${i}`,
        term: `用語${i}`,
        reading: `ようご${i}`,
        category: '基本',
        description: `説明${i}`,
      }))
      mockPrisma.bonsaiTerm.findMany.mockResolvedValue(manyTerms)

      const result = await getTerms()
      expect(result.terms).toHaveLength(100)
    })

    it('日本語カテゴリでフィルタできる', async () => {
      const { getTerms } = await import('@/lib/actions/dictionary')
      mockPrisma.bonsaiTerm.findMany.mockResolvedValue([])

      await getTerms({ category: '管理・手入れ' })
      expect(mockPrisma.bonsaiTerm.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ category: '管理・手入れ' }),
        })
      )
    })
  })

  // ----------------------------------------------------------
  // getTermBySlug — edge cases
  // ----------------------------------------------------------
  describe('getTermBySlug', () => {
    it('ハイフン付きスラッグで検索できる', async () => {
      const { getTermBySlug } = await import('@/lib/actions/dictionary')
      mockPrisma.bonsaiTerm.findUnique.mockResolvedValue({
        id: '1',
        slug: 'sashi-ki',
        term: '挿し木',
        reading: 'さしき',
        description: '枝を切って土に挿す繁殖法',
        category: '管理・手入れ',
        sortOrder: 1,
      })

      const result = await getTermBySlug('sashi-ki')
      expect(result.term?.slug).toBe('sashi-ki')
      expect(mockPrisma.bonsaiTerm.findUnique).toHaveBeenCalledWith({
        where: { slug: 'sashi-ki' },
        select: expect.any(Object),
      })
    })

    it('空文字のスラッグで検索した場合はnullを返す', async () => {
      const { getTermBySlug } = await import('@/lib/actions/dictionary')
      mockPrisma.bonsaiTerm.findUnique.mockResolvedValue(null)

      const result = await getTermBySlug('')
      expect(result).toEqual({ term: null })
    })

    it('日本語スラッグで検索できる', async () => {
      const { getTermBySlug } = await import('@/lib/actions/dictionary')
      mockPrisma.bonsaiTerm.findUnique.mockResolvedValue({
        id: '1',
        slug: '盆栽',
        term: '盆栽',
        reading: 'ぼんさい',
        description: '鉢植えの樹木を育てる芸術',
        category: '基本',
        sortOrder: 1,
      })

      const result = await getTermBySlug('盆栽')
      expect(result.term?.term).toBe('盆栽')
    })

    it('正しいselectフィールドでクエリする', async () => {
      const { getTermBySlug } = await import('@/lib/actions/dictionary')
      mockPrisma.bonsaiTerm.findUnique.mockResolvedValue(null)

      await getTermBySlug('test')
      expect(mockPrisma.bonsaiTerm.findUnique).toHaveBeenCalledWith({
        where: { slug: 'test' },
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
  })

  // ----------------------------------------------------------
  // getAdjacentTerms — edge cases
  // ----------------------------------------------------------
  describe('getAdjacentTerms', () => {
    const makeTerms = (slugs: string[]) =>
      slugs.map((slug, i) => ({
        id: String(i + 1),
        slug,
        term: `term-${slug}`,
        reading: `reading-${slug}`,
        category: '樹形',
        description: `description-${slug}`,
      }))

    it('2つの用語の最初の用語の場合、prevはnull、nextは2番目', async () => {
      const { getAdjacentTerms } = await import('@/lib/actions/dictionary')
      const terms = makeTerms(['first', 'second'])
      mockPrisma.bonsaiTerm.findMany.mockResolvedValue(terms)

      const result = await getAdjacentTerms('first', '樹形')
      expect(result.prev).toBeNull()
      expect(result.next?.slug).toBe('second')
    })

    it('2つの用語の最後の用語の場合、prevは1番目、nextはnull', async () => {
      const { getAdjacentTerms } = await import('@/lib/actions/dictionary')
      const terms = makeTerms(['first', 'second'])
      mockPrisma.bonsaiTerm.findMany.mockResolvedValue(terms)

      const result = await getAdjacentTerms('second', '樹形')
      expect(result.prev?.slug).toBe('first')
      expect(result.next).toBeNull()
    })

    it('5つの用語の中央の用語のprev/nextを正しく返す', async () => {
      const { getAdjacentTerms } = await import('@/lib/actions/dictionary')
      const terms = makeTerms(['a', 'b', 'c', 'd', 'e'])
      mockPrisma.bonsaiTerm.findMany.mockResolvedValue(terms)

      const result = await getAdjacentTerms('c', '樹形')
      expect(result.prev?.slug).toBe('b')
      expect(result.next?.slug).toBe('d')
    })

    it('異なるカテゴリのslugが渡された場合は両方null', async () => {
      const { getAdjacentTerms } = await import('@/lib/actions/dictionary')
      // 「用具」カテゴリで検索するが、返される用語の中にslugが存在しない
      const terms = makeTerms(['scissors', 'wire'])
      mockPrisma.bonsaiTerm.findMany.mockResolvedValue(terms)

      const result = await getAdjacentTerms('nonexistent-in-category', '用具')
      expect(result.prev).toBeNull()
      expect(result.next).toBeNull()
    })

    it('take制限がMAX_DICTIONARY_TERMS_LIMITで設定される', async () => {
      const { getAdjacentTerms } = await import('@/lib/actions/dictionary')
      mockPrisma.bonsaiTerm.findMany.mockResolvedValue([])

      await getAdjacentTerms('slug', '樹形')
      expect(mockPrisma.bonsaiTerm.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 500,
        })
      )
    })

    it('selectフィールドにsortOrderが含まれない', async () => {
      const { getAdjacentTerms } = await import('@/lib/actions/dictionary')
      mockPrisma.bonsaiTerm.findMany.mockResolvedValue([])

      await getAdjacentTerms('slug', '樹形')
      const callArgs = mockPrisma.bonsaiTerm.findMany.mock.calls[0][0]
      expect(callArgs.select).not.toHaveProperty('sortOrder')
      expect(callArgs.select).toEqual({
        id: true,
        slug: true,
        term: true,
        reading: true,
        category: true,
        description: true,
      })
    })

    it('prevとnextの返却値はBonsaiTermSummary型の構造を持つ', async () => {
      const { getAdjacentTerms } = await import('@/lib/actions/dictionary')
      const terms = makeTerms(['alpha', 'beta', 'gamma'])
      mockPrisma.bonsaiTerm.findMany.mockResolvedValue(terms)

      const result = await getAdjacentTerms('beta', '樹形')

      expect(result.prev).toEqual({
        id: '1',
        slug: 'alpha',
        term: 'term-alpha',
        reading: 'reading-alpha',
        category: '樹形',
        description: 'description-alpha',
      })
      expect(result.next).toEqual({
        id: '3',
        slug: 'gamma',
        term: 'term-gamma',
        reading: 'reading-gamma',
        category: '樹形',
        description: 'description-gamma',
      })
    })
  })
})
