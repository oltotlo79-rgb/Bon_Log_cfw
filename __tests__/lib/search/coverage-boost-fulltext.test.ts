import { vi } from 'vitest'
// @vitest-environment node

export {} // TypeScriptモジュールとして扱うための空エクスポート

vi.unmock('@/lib/search/fulltext')

const mockPrisma: any = {
  $executeRawUnsafe: vi.fn(),
  $queryRawUnsafe: vi.fn(),
  $queryRaw: vi.fn(),
}
vi.mock('@/lib/db', () => ({ prisma: mockPrisma }))
vi.mock('@/lib/logger', () => ({
  __esModule: true,
  default: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn(), log: vi.fn() },
}))

beforeEach(() => {
  vi.clearAllMocks()
})

describe('fulltext coverage boost', async () => {
  describe('enableExtension - invalid extension name (lines 239-240)', async () => {
    it('should return false for invalid extension name', async () => {
      const { enableExtension } = await import('@/lib/search/fulltext')
      // Force-pass an invalid extension name at runtime (bypass TS type)
       
      const result = await enableExtension('pg_invalid' as any)
      expect(result).toBe(false)
    })
  })

  describe('getSearchIndexes - outer catch (lines 489-490)', async () => {
    it('should return empty array when $queryRaw throws', async () => {
      // Make $queryRaw throw to trigger the outer catch
      mockPrisma.$queryRaw.mockImplementation(() => {
        throw new Error('DB connection error')
      })

      const { getSearchIndexes } = await import('@/lib/search/fulltext')
      const result = await getSearchIndexes()
      expect(result).toEqual([])
    })
  })
})
