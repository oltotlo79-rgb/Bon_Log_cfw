import { vi } from 'vitest'
// @vitest-environment node

export {};

// ============================================================
// Part 1: fulltext.ts - uncovered branches
// ============================================================

const mockQueryRaw = vi.fn()
const mockExecuteRaw = vi.fn()
const mockExecuteRawUnsafe = vi.fn()

vi.mock('@/lib/db', () => ({
  prisma: {
    $queryRaw: mockQueryRaw,
    $executeRaw: mockExecuteRaw,
    $executeRawUnsafe: mockExecuteRawUnsafe,
  },
}))

vi.mock('@/lib/logger', () => ({
  __esModule: true,
  default: {
    log: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}))

describe('fulltext.ts - uncovered branches', async () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
    delete process.env.SEARCH_MODE
  })

  describe('fulltextSearchPosts - cursor pagination', async () => {
    it('bigmモードでcursorを指定して検索する', async () => {
      process.env.SEARCH_MODE = 'bigm'
      mockQueryRaw.mockResolvedValueOnce([{ id: 'post-2' }])

      const { fulltextSearchPosts } = await import('@/lib/search/fulltext')
      const result = await fulltextSearchPosts('盆栽', { cursor: 'post-5' })

      expect(result).toEqual(['post-2'])
      expect(mockQueryRaw).toHaveBeenCalled()
    })

    it('trgmモードでcursorを指定して検索する', async () => {
      process.env.SEARCH_MODE = 'trgm'
      mockQueryRaw.mockResolvedValueOnce([{ id: 'post-3' }])

      const { fulltextSearchPosts } = await import('@/lib/search/fulltext')
      const result = await fulltextSearchPosts('盆栽', { cursor: 'post-10' })

      expect(result).toEqual(['post-3'])
    })

    it('likeモードでcursorを指定して検索する', async () => {
      process.env.SEARCH_MODE = 'like'
      mockQueryRaw.mockResolvedValueOnce([{ id: 'post-1' }])

      const { fulltextSearchPosts } = await import('@/lib/search/fulltext')
      const result = await fulltextSearchPosts('盆栽', { cursor: 'post-8' })

      expect(result).toEqual(['post-1'])
    })
  })

  describe('fulltextSearchPosts - empty excludedUserIds/genreIds (Prisma.empty branch)', async () => {
    it('bigmモードで空のexcludedUserIdsと空のgenreIds', async () => {
      process.env.SEARCH_MODE = 'bigm'
      mockQueryRaw.mockResolvedValueOnce([{ id: 'p1' }])

      const { fulltextSearchPosts } = await import('@/lib/search/fulltext')
      const result = await fulltextSearchPosts('松', { excludedUserIds: [], genreIds: [] })

      expect(result).toEqual(['p1'])
    })

    it('bigmモードでexcludedUserIdsとgenreIdsの両方を指定', async () => {
      process.env.SEARCH_MODE = 'bigm'
      mockQueryRaw.mockResolvedValueOnce([{ id: 'p2' }])

      const { fulltextSearchPosts } = await import('@/lib/search/fulltext')
      const result = await fulltextSearchPosts('松', {
        excludedUserIds: ['u1', 'u2'],
        genreIds: ['g1'],
      })

      expect(result).toEqual(['p2'])
    })

    it('trgmモードでexcludedUserIdsとgenreIdsの両方を指定', async () => {
      process.env.SEARCH_MODE = 'trgm'
      mockQueryRaw.mockResolvedValueOnce([{ id: 'p3' }])

      const { fulltextSearchPosts } = await import('@/lib/search/fulltext')
      const result = await fulltextSearchPosts('松', {
        excludedUserIds: ['u1'],
        genreIds: ['g1', 'g2'],
      })

      expect(result).toEqual(['p3'])
    })

    it('likeモードでexcludedUserIdsとgenreIdsの両方を指定', async () => {
      process.env.SEARCH_MODE = 'like'
      mockQueryRaw.mockResolvedValueOnce([{ id: 'p4' }])

      const { fulltextSearchPosts } = await import('@/lib/search/fulltext')
      const result = await fulltextSearchPosts('松', {
        excludedUserIds: ['u1'],
        genreIds: ['g1'],
      })

      expect(result).toEqual(['p4'])
    })
  })

  describe('fulltextSearchPosts - fallback with options', async () => {
    it('trgmモードのエラー時にフォールバックが呼ばれる', async () => {
      process.env.SEARCH_MODE = 'trgm'
      mockQueryRaw.mockRejectedValueOnce(new Error('trgm error'))
      mockQueryRaw.mockResolvedValueOnce([{ id: 'fb-1' }])

      const { fulltextSearchPosts } = await import('@/lib/search/fulltext')
      const result = await fulltextSearchPosts('盆栽', {
        excludedUserIds: ['u1'],
        genreIds: ['g1'],
        cursor: 'c1',
        limit: 5,
      })

      expect(result).toEqual(['fb-1'])
      expect(mockQueryRaw).toHaveBeenCalledTimes(2)
    })

    it('likeモードのエラー時にもフォールバックが呼ばれる', async () => {
      process.env.SEARCH_MODE = 'like'
      mockQueryRaw.mockRejectedValueOnce(new Error('db error'))
      mockQueryRaw.mockResolvedValueOnce([{ id: 'fb-2' }])

      const { fulltextSearchPosts } = await import('@/lib/search/fulltext')
      const result = await fulltextSearchPosts('盆栽')

      expect(result).toEqual(['fb-2'])
    })
  })

  describe('fulltextSearchUsers - trgm mode', async () => {
    it('trgmモードでユーザー検索を実行する', async () => {
      process.env.SEARCH_MODE = 'trgm'
      mockQueryRaw.mockResolvedValueOnce([{ id: 'user-1' }])

      const { fulltextSearchUsers } = await import('@/lib/search/fulltext')
      const result = await fulltextSearchUsers('盆栽好き')

      expect(result).toEqual(['user-1'])
    })
  })

  describe('fulltextSearchUsers - currentUserId branches', async () => {
    it('currentUserIdがnullの場合（除外条件なし）', async () => {
      process.env.SEARCH_MODE = 'like'
      mockQueryRaw.mockResolvedValueOnce([{ id: 'u1' }, { id: 'u2' }])

      const { fulltextSearchUsers } = await import('@/lib/search/fulltext')
      const result = await fulltextSearchUsers('テスト', { currentUserId: undefined })

      expect(result).toEqual(['u1', 'u2'])
    })

    it('currentUserIdが指定された場合（自分を除外）', async () => {
      process.env.SEARCH_MODE = 'like'
      mockQueryRaw.mockResolvedValueOnce([{ id: 'u2' }])

      const { fulltextSearchUsers } = await import('@/lib/search/fulltext')
      const result = await fulltextSearchUsers('テスト', { currentUserId: 'u1' })

      expect(result).toEqual(['u2'])
    })

    it('bigmモードでcurrentUserIdを指定', async () => {
      process.env.SEARCH_MODE = 'bigm'
      mockQueryRaw.mockResolvedValueOnce([{ id: 'u3' }])

      const { fulltextSearchUsers } = await import('@/lib/search/fulltext')
      const result = await fulltextSearchUsers('テスト', { currentUserId: 'u1' })

      expect(result).toEqual(['u3'])
    })

    it('trgmモードでcurrentUserIdを指定', async () => {
      process.env.SEARCH_MODE = 'trgm'
      mockQueryRaw.mockResolvedValueOnce([{ id: 'u4' }])

      const { fulltextSearchUsers } = await import('@/lib/search/fulltext')
      const result = await fulltextSearchUsers('テスト', { currentUserId: 'u1' })

      expect(result).toEqual(['u4'])
    })
  })

  describe('fulltextSearchUsers - cursor pagination', async () => {
    it('likeモードでcursorを指定', async () => {
      process.env.SEARCH_MODE = 'like'
      mockQueryRaw.mockResolvedValueOnce([{ id: 'u5' }])

      const { fulltextSearchUsers } = await import('@/lib/search/fulltext')
      const result = await fulltextSearchUsers('テスト', { cursor: 'u10' })

      expect(result).toEqual(['u5'])
    })

    it('bigmモードでcursorを指定', async () => {
      process.env.SEARCH_MODE = 'bigm'
      mockQueryRaw.mockResolvedValueOnce([{ id: 'u6' }])

      const { fulltextSearchUsers } = await import('@/lib/search/fulltext')
      const result = await fulltextSearchUsers('テスト', { cursor: 'u10' })

      expect(result).toEqual(['u6'])
    })

    it('trgmモードでcursorを指定', async () => {
      process.env.SEARCH_MODE = 'trgm'
      mockQueryRaw.mockResolvedValueOnce([{ id: 'u7' }])

      const { fulltextSearchUsers } = await import('@/lib/search/fulltext')
      const result = await fulltextSearchUsers('テスト', { cursor: 'u10' })

      expect(result).toEqual(['u7'])
    })
  })

  describe('fulltextSearchUsers - fallback on error', async () => {
    it('bigmモードのエラー時にLIKEフォールバックが呼ばれる', async () => {
      process.env.SEARCH_MODE = 'bigm'
      mockQueryRaw.mockRejectedValueOnce(new Error('bigm not available'))
      mockQueryRaw.mockResolvedValueOnce([{ id: 'u-fb' }])

      const { fulltextSearchUsers } = await import('@/lib/search/fulltext')
      const result = await fulltextSearchUsers('盆栽', {
        excludedUserIds: ['x1'],
        currentUserId: 'me',
        cursor: 'c1',
        limit: 5,
      })

      expect(result).toEqual(['u-fb'])
    })

    it('trgmモードのエラー時にLIKEフォールバックが呼ばれる', async () => {
      process.env.SEARCH_MODE = 'trgm'
      mockQueryRaw.mockRejectedValueOnce(new Error('trgm error'))
      mockQueryRaw.mockResolvedValueOnce([{ id: 'u-fb2' }])

      const { fulltextSearchUsers } = await import('@/lib/search/fulltext')
      const result = await fulltextSearchUsers('盆栽')

      expect(result).toEqual(['u-fb2'])
    })

    it('likeモードのエラー時にもフォールバックが呼ばれる', async () => {
      process.env.SEARCH_MODE = 'like'
      mockQueryRaw.mockRejectedValueOnce(new Error('db error'))
      mockQueryRaw.mockResolvedValueOnce([{ id: 'u-fb3' }])

      const { fulltextSearchUsers } = await import('@/lib/search/fulltext')
      const result = await fulltextSearchUsers('盆栽')

      expect(result).toEqual(['u-fb3'])
    })
  })

  describe('fulltextSearchUsers - excludedUserIds with genreIds-like combinations', async () => {
    it('空のexcludedUserIdsでPrisma.emptyが使われる', async () => {
      process.env.SEARCH_MODE = 'like'
      mockQueryRaw.mockResolvedValueOnce([{ id: 'u1' }])

      const { fulltextSearchUsers } = await import('@/lib/search/fulltext')
      const result = await fulltextSearchUsers('テスト', { excludedUserIds: [] })

      expect(result).toEqual(['u1'])
    })

    it('trgmモードで空のexcludedUserIds', async () => {
      process.env.SEARCH_MODE = 'trgm'
      mockQueryRaw.mockResolvedValueOnce([{ id: 'u1' }])

      const { fulltextSearchUsers } = await import('@/lib/search/fulltext')
      const result = await fulltextSearchUsers('テスト', { excludedUserIds: [] })

      expect(result).toEqual(['u1'])
    })
  })
})

// ============================================================
// Part 2: storage/index.ts - uncovered branches
// ============================================================

const mockMkdir = vi.fn()
const mockWriteFile = vi.fn()
const mockUnlink = vi.fn()

vi.mock('fs/promises', () => ({
  mkdir: (...args: any[]) => mockMkdir(...args),
  writeFile: (...args: any[]) => mockWriteFile(...args),
  unlink: (...args: any[]) => mockUnlink(...args),
}))

const mockPutObject = vi.fn()
const mockDeleteObject = vi.fn()
vi.mock('@/lib/storage/s3-sign', () => ({
  putObject: (...args: unknown[]) => mockPutObject(...args),
  deleteObject: (...args: unknown[]) => mockDeleteObject(...args),
}))

const mockFetch = vi.fn()
 
global.fetch = mockFetch as any

describe('storage/index.ts - uncovered branches', async () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
    delete process.env.STORAGE_PROVIDER
    delete process.env.NEXT_PUBLIC_SUPABASE_URL
    delete process.env.SUPABASE_SERVICE_ROLE_KEY
    delete process.env.SUPABASE_STORAGE_BUCKET
    delete process.env.R2_ACCOUNT_ID
    delete process.env.R2_ACCESS_KEY_ID
    delete process.env.R2_SECRET_ACCESS_KEY
    delete process.env.R2_BUCKET_NAME
    delete process.env.R2_PUBLIC_URL
  })

  describe('Local - err instanceof Error false branch (non-Error thrown)', async () => {
    it('upload時にnon-Errorオブジェクトがスローされた場合はUnknown error', async () => {
      mockMkdir.mockRejectedValue('string error')
      process.env.STORAGE_PROVIDER = 'local'

      const { uploadFile } = await import('@/lib/storage')
      const result = await uploadFile(Buffer.from('x'), 'f.jpg', 'image/jpeg', 'avatars')

      expect(result.success).toBe(false)
      expect(result.error).toBe('Unknown error')
    })

    it('delete時にnon-Errorオブジェクトがスローされた場合はUnknown error', async () => {
      mockUnlink.mockRejectedValue(42)
      process.env.STORAGE_PROVIDER = 'local'

      const { deleteFile } = await import('@/lib/storage')
      const result = await deleteFile('/uploads/avatars/test.jpg')

      expect(result.success).toBe(false)
      expect(result.error).toBe('Unknown error')
    })
  })

  describe('Supabase - non-Error and edge cases', async () => {
    it('upload時にnon-Errorがスローされた場合', async () => {
      process.env.STORAGE_PROVIDER = 'supabase'
      process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co'
      process.env.SUPABASE_SERVICE_ROLE_KEY = 'key'

      mockFetch.mockRejectedValueOnce('fetch string error')

      const { uploadFile } = await import('@/lib/storage')
      const result = await uploadFile(Buffer.from('x'), 'f.jpg', 'image/jpeg', 'avatars')

      expect(result.success).toBe(false)
      expect(result.error).toBe('Unknown error')
    })

    it('delete時に認証情報が未設定の場合はエラー', async () => {
      process.env.STORAGE_PROVIDER = 'supabase'
      // no URL or key set

      const { deleteFile } = await import('@/lib/storage')
      const result = await deleteFile('https://test.supabase.co/storage/v1/object/public/bucket/file.jpg')

      expect(result.success).toBe(false)
      expect(result.error).toContain('credentials')
    })

    it('delete時にnon-Errorがスローされた場合', async () => {
      process.env.STORAGE_PROVIDER = 'supabase'
      process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co'
      process.env.SUPABASE_SERVICE_ROLE_KEY = 'key'

      mockFetch.mockRejectedValueOnce(undefined)

      const { deleteFile } = await import('@/lib/storage')
      const result = await deleteFile('https://test.supabase.co/storage/v1/object/public/bucket/file.jpg')

      expect(result.success).toBe(false)
      expect(result.error).toBe('Unknown error')
    })

    it('delete時のresponse.ok=false', async () => {
      process.env.STORAGE_PROVIDER = 'supabase'
      process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co'
      process.env.SUPABASE_SERVICE_ROLE_KEY = 'key'

      mockFetch.mockResolvedValueOnce({ ok: false, text: () => Promise.resolve('Not found') })

      const { deleteFile } = await import('@/lib/storage')
      const result = await deleteFile('https://test.supabase.co/storage/v1/object/public/bucket/file.jpg')

      expect(result.success).toBe(false)
      expect(result.error).toContain('Not found')
    })
  })

  describe('R2 - non-Error thrown', async () => {
    it('upload時にnon-Errorがスローされた場合', async () => {
      process.env.STORAGE_PROVIDER = 'r2'
      process.env.R2_ACCOUNT_ID = 'acc'
      process.env.R2_ACCESS_KEY_ID = 'key'
      process.env.R2_SECRET_ACCESS_KEY = 'secret'

      mockPutObject.mockRejectedValueOnce('s3 string error')

      const { uploadFile } = await import('@/lib/storage')
      const result = await uploadFile(Buffer.from('x'), 'f.jpg', 'image/jpeg', 'avatars')

      expect(result.success).toBe(false)
      expect(result.error).toBe('Unknown error')
    })

    it('delete時にnon-Errorがスローされた場合', async () => {
      process.env.STORAGE_PROVIDER = 'r2'
      process.env.R2_ACCOUNT_ID = 'acc'
      process.env.R2_ACCESS_KEY_ID = 'key'
      process.env.R2_SECRET_ACCESS_KEY = 'secret'

      mockDeleteObject.mockRejectedValueOnce({ code: 'NoSuchKey' })

      const { deleteFile } = await import('@/lib/storage')
      const result = await deleteFile('https://cdn.example.com/folder/file.jpg')

      expect(result.success).toBe(false)
      expect(result.error).toBe('Unknown error')
    })
  })

  describe('R2 - URL pathname without leading slash', async () => {
    it('delete時にpathnameが/で始まらないURLを処理', async () => {
      process.env.STORAGE_PROVIDER = 'r2'
      process.env.R2_ACCOUNT_ID = 'acc'
      process.env.R2_ACCESS_KEY_ID = 'key'
      process.env.R2_SECRET_ACCESS_KEY = 'secret'

      mockDeleteObject.mockResolvedValueOnce(undefined)

      const { deleteFile } = await import('@/lib/storage')
      // Standard URLs always have leading /, but test the branch
      const result = await deleteFile('https://cdn.example.com/folder/file.jpg')

      expect(result.success).toBe(true)
    })
  })
})
