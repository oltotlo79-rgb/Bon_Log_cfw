// @vitest-environment node
 
import { vi } from 'vitest'
export {};

// Prisma mock
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

// Logger mock
vi.mock('@/lib/logger', () => ({
  __esModule: true,
  default: {
    log: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}))

describe('Fulltext Search Module', async () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
    delete process.env.SEARCH_MODE
  })

  describe('getSearchMode', async () => {
    it('デフォルトはlike', async () => {
      const { getSearchMode } = await import('@/lib/search/fulltext')
      expect(getSearchMode()).toBe('like')
    })

    it('SEARCH_MODE=bigmでbigmを返す', async () => {
      process.env.SEARCH_MODE = 'bigm'
      const { getSearchMode } = await import('@/lib/search/fulltext')
      expect(getSearchMode()).toBe('bigm')
    })

    it('SEARCH_MODE=trgmでtrgmを返す', async () => {
      process.env.SEARCH_MODE = 'trgm'
      const { getSearchMode } = await import('@/lib/search/fulltext')
      expect(getSearchMode()).toBe('trgm')
    })

    it('SEARCH_MODE=BIGMでも大文字小文字を無視する', async () => {
      process.env.SEARCH_MODE = 'BIGM'
      const { getSearchMode } = await import('@/lib/search/fulltext')
      expect(getSearchMode()).toBe('bigm')
    })

    it('無効な値はlikeにフォールバック', async () => {
      process.env.SEARCH_MODE = 'invalid'
      const { getSearchMode } = await import('@/lib/search/fulltext')
      expect(getSearchMode()).toBe('like')
    })
  })

  describe('checkExtensionAvailable', async () => {
    it('拡張機能が利用可能な場合はtrueを返す', async () => {
      mockQueryRaw.mockResolvedValueOnce([{ available: true }])

      const { checkExtensionAvailable } = await import('@/lib/search/fulltext')
      const result = await checkExtensionAvailable('pg_bigm')

      expect(result).toBe(true)
    })

    it('拡張機能が利用不可の場合はfalseを返す', async () => {
      mockQueryRaw.mockResolvedValueOnce([{ available: false }])

      const { checkExtensionAvailable } = await import('@/lib/search/fulltext')
      const result = await checkExtensionAvailable('pg_trgm')

      expect(result).toBe(false)
    })

    it('エラー時はfalseを返す', async () => {
      mockQueryRaw.mockRejectedValueOnce(new Error('DB error'))

      const { checkExtensionAvailable } = await import('@/lib/search/fulltext')
      const result = await checkExtensionAvailable('pg_bigm')

      expect(result).toBe(false)
    })

    it('結果が空の場合はfalseを返す', async () => {
      mockQueryRaw.mockResolvedValueOnce([])

      const { checkExtensionAvailable } = await import('@/lib/search/fulltext')
      const result = await checkExtensionAvailable('pg_bigm')

      expect(result).toBe(false)
    })
  })

  describe('enableExtension', async () => {
    // $executeRawUnsafe ではなく $executeRaw (tagged template) を使うため、
    // mockExecuteRaw を検証する。タグ付きテンプレートでは最初の引数に
    // 生の文字列配列 (TemplateStringsArray) が渡される。
    it('拡張機能を有効化できる', async () => {
      mockExecuteRaw.mockResolvedValueOnce(undefined)

      const { enableExtension } = await import('@/lib/search/fulltext')
      const result = await enableExtension('pg_bigm')

      expect(result).toBe(true)
      expect(mockExecuteRaw).toHaveBeenCalled()
      const firstCallArg = mockExecuteRaw.mock.calls[0]?.[0]
      expect(firstCallArg).toEqual(
        expect.arrayContaining(['CREATE EXTENSION IF NOT EXISTS "pg_bigm"']),
      )
    })

    it('pg_trgmを有効化できる', async () => {
      mockExecuteRaw.mockResolvedValueOnce(undefined)

      const { enableExtension } = await import('@/lib/search/fulltext')
      const result = await enableExtension('pg_trgm')

      expect(result).toBe(true)
      expect(mockExecuteRaw).toHaveBeenCalled()
      const firstCallArg = mockExecuteRaw.mock.calls[0]?.[0]
      expect(firstCallArg).toEqual(
        expect.arrayContaining(['CREATE EXTENSION IF NOT EXISTS "pg_trgm"']),
      )
    })

    it('エラー時はfalseを返す', async () => {
      mockExecuteRaw.mockRejectedValueOnce(new Error('Permission denied'))

      const { enableExtension } = await import('@/lib/search/fulltext')
      const result = await enableExtension('pg_bigm')

      expect(result).toBe(false)
    })
  })

  describe('createSearchIndexes', async () => {
    beforeEach(() => {
      mockExecuteRaw.mockClear()
    })

    it('likeモードではインデックスを作成しない', async () => {
      process.env.SEARCH_MODE = 'like'

      const { createSearchIndexes } = await import('@/lib/search/fulltext')
      const result = await createSearchIndexes()

      expect(result.success).toBe(true)
      expect(result.message).toContain('LIKE検索モード')
      expect(mockExecuteRaw).not.toHaveBeenCalled()
    })

    it('bigmモードでインデックスを作成する', async () => {
      process.env.SEARCH_MODE = 'bigm'
      mockExecuteRaw.mockResolvedValue(undefined)

      const { createSearchIndexes } = await import('@/lib/search/fulltext')
      const result = await createSearchIndexes()

      expect(result.success).toBe(true)
      expect(result.message).toContain('pg_bigm')
      // 12テーブル×1インデックス = 12回の$executeRaw呼び出し
      expect(mockExecuteRaw).toHaveBeenCalledTimes(12)
    })

    it('trgmモードでインデックスを作成する', async () => {
      process.env.SEARCH_MODE = 'trgm'
      mockExecuteRaw.mockResolvedValue(undefined)

      const { createSearchIndexes } = await import('@/lib/search/fulltext')
      const result = await createSearchIndexes()

      expect(result.success).toBe(true)
      expect(result.message).toContain('pg_trgm')
      // 12テーブル×1インデックス = 12回の$executeRaw呼び出し
      expect(mockExecuteRaw).toHaveBeenCalledTimes(12)
    })

    it('エラー時は失敗を返す', async () => {
      process.env.SEARCH_MODE = 'bigm'
      mockExecuteRaw.mockRejectedValueOnce(new Error('Index creation failed'))

      const { createSearchIndexes } = await import('@/lib/search/fulltext')
      const result = await createSearchIndexes()

      expect(result.success).toBe(false)
      expect(result.message).toContain('失敗')
    })
  })

  describe('fulltextSearchPosts', async () => {
    it('空のクエリは空配列を返す', async () => {
      const { fulltextSearchPosts } = await import('@/lib/search/fulltext')
      const result = await fulltextSearchPosts('')

      expect(result).toEqual([])
    })

    it('空白のみのクエリは空配列を返す', async () => {
      const { fulltextSearchPosts } = await import('@/lib/search/fulltext')
      const result = await fulltextSearchPosts('   ')

      expect(result).toEqual([])
    })

    it('likeモードで検索を実行する', async () => {
      process.env.SEARCH_MODE = 'like'
      mockQueryRaw.mockResolvedValueOnce([{ id: 'post-1' }, { id: 'post-2' }])

      const { fulltextSearchPosts } = await import('@/lib/search/fulltext')
      const result = await fulltextSearchPosts('盆栽')

      expect(result).toEqual(['post-1', 'post-2'])
    })

    it('bigmモードで検索を実行する', async () => {
      process.env.SEARCH_MODE = 'bigm'
      mockQueryRaw.mockResolvedValueOnce([{ id: 'post-1' }])

      const { fulltextSearchPosts } = await import('@/lib/search/fulltext')
      const result = await fulltextSearchPosts('黒松')

      expect(result).toEqual(['post-1'])
    })

    it('trgmモードで検索を実行する', async () => {
      process.env.SEARCH_MODE = 'trgm'
      mockQueryRaw.mockResolvedValueOnce([{ id: 'post-1' }])

      const { fulltextSearchPosts } = await import('@/lib/search/fulltext')
      const result = await fulltextSearchPosts('真柏')

      expect(result).toEqual(['post-1'])
    })

    it('エラー時はLIKE検索にフォールバックする', async () => {
      process.env.SEARCH_MODE = 'bigm'
      // 最初のクエリ（bigm）は失敗
      mockQueryRaw.mockRejectedValueOnce(new Error('Extension not found'))
      // フォールバック（like）は成功
      mockQueryRaw.mockResolvedValueOnce([{ id: 'post-1' }])

      const { fulltextSearchPosts } = await import('@/lib/search/fulltext')
      const result = await fulltextSearchPosts('盆栽')

      expect(result).toEqual(['post-1'])
    })

    it('オプションでlimitを指定できる', async () => {
      mockQueryRaw.mockResolvedValueOnce([{ id: 'post-1' }])

      const { fulltextSearchPosts } = await import('@/lib/search/fulltext')
      await fulltextSearchPosts('盆栽', { limit: 10 })

      expect(mockQueryRaw).toHaveBeenCalled()
    })

    it('シングルクォートをエスケープする', async () => {
      mockQueryRaw.mockResolvedValueOnce([])

      const { fulltextSearchPosts } = await import('@/lib/search/fulltext')
      await fulltextSearchPosts("test'query")

      // SQL実行時にエラーが発生しないことを確認
      expect(mockQueryRaw).toHaveBeenCalled()
    })

    it('bigmモードでdateFromフィルタを適用する', async () => {
      process.env.SEARCH_MODE = 'bigm'
      mockQueryRaw.mockResolvedValueOnce([{ id: 'post-1' }])

      const { fulltextSearchPosts } = await import('@/lib/search/fulltext')
      await fulltextSearchPosts('盆栽', {
        filters: { dateFrom: '2024-01-01' },
      })

      expect(mockQueryRaw).toHaveBeenCalled()
    })

    it('bigmモードでdateToフィルタを適用する', async () => {
      process.env.SEARCH_MODE = 'bigm'
      mockQueryRaw.mockResolvedValueOnce([{ id: 'post-1' }])

      const { fulltextSearchPosts } = await import('@/lib/search/fulltext')
      await fulltextSearchPosts('盆栽', {
        filters: { dateTo: '2024-12-31' },
      })

      expect(mockQueryRaw).toHaveBeenCalled()
    })

    it('bigmモードでmediaType=imagesフィルタを適用する', async () => {
      process.env.SEARCH_MODE = 'bigm'
      mockQueryRaw.mockResolvedValueOnce([{ id: 'post-1' }])

      const { fulltextSearchPosts } = await import('@/lib/search/fulltext')
      await fulltextSearchPosts('盆栽', {
        filters: { mediaType: 'images' },
      })

      expect(mockQueryRaw).toHaveBeenCalled()
    })

    it('bigmモードでmediaType=videosフィルタを適用する', async () => {
      process.env.SEARCH_MODE = 'bigm'
      mockQueryRaw.mockResolvedValueOnce([{ id: 'post-1' }])

      const { fulltextSearchPosts } = await import('@/lib/search/fulltext')
      await fulltextSearchPosts('盆栽', {
        filters: { mediaType: 'videos' },
      })

      expect(mockQueryRaw).toHaveBeenCalled()
    })

    it('bigmモードでmediaType=textフィルタを適用する', async () => {
      process.env.SEARCH_MODE = 'bigm'
      mockQueryRaw.mockResolvedValueOnce([{ id: 'post-1' }])

      const { fulltextSearchPosts } = await import('@/lib/search/fulltext')
      await fulltextSearchPosts('盆栽', {
        filters: { mediaType: 'text' },
      })

      expect(mockQueryRaw).toHaveBeenCalled()
    })

    it('bigmモードでminLikesフィルタを適用する', async () => {
      process.env.SEARCH_MODE = 'bigm'
      mockQueryRaw.mockResolvedValueOnce([{ id: 'post-1' }])

      const { fulltextSearchPosts } = await import('@/lib/search/fulltext')
      await fulltextSearchPosts('盆栽', {
        filters: { minLikes: 5 },
      })

      expect(mockQueryRaw).toHaveBeenCalled()
    })

    it('bigmモードで複数フィルタを組み合わせて適用する', async () => {
      process.env.SEARCH_MODE = 'bigm'
      mockQueryRaw.mockResolvedValueOnce([{ id: 'post-1' }])

      const { fulltextSearchPosts } = await import('@/lib/search/fulltext')
      await fulltextSearchPosts('盆栽', {
        filters: {
          dateFrom: '2024-01-01',
          dateTo: '2024-12-31',
          mediaType: 'images',
          minLikes: 10,
        },
      })

      expect(mockQueryRaw).toHaveBeenCalled()
    })
  })

  describe('fulltextSearchUsers', async () => {
    it('空のクエリは空配列を返す', async () => {
      const { fulltextSearchUsers } = await import('@/lib/search/fulltext')
      const result = await fulltextSearchUsers('')

      expect(result).toEqual([])
    })

    it('likeモードで検索を実行する', async () => {
      process.env.SEARCH_MODE = 'like'
      mockQueryRaw.mockResolvedValueOnce([{ id: 'user-1' }])

      const { fulltextSearchUsers } = await import('@/lib/search/fulltext')
      const result = await fulltextSearchUsers('盆栽好き')

      expect(result).toEqual(['user-1'])
    })

    it('bigmモードで検索を実行する', async () => {
      process.env.SEARCH_MODE = 'bigm'
      mockQueryRaw.mockResolvedValueOnce([{ id: 'user-1' }])

      const { fulltextSearchUsers } = await import('@/lib/search/fulltext')
      const result = await fulltextSearchUsers('ユーザー')

      expect(result).toEqual(['user-1'])
    })

    it('excludedUserIdsでユーザーを除外できる', async () => {
      mockQueryRaw.mockResolvedValueOnce([{ id: 'user-2' }])

      const { fulltextSearchUsers } = await import('@/lib/search/fulltext')
      const result = await fulltextSearchUsers('テスト', { excludedUserIds: ['user-1'] })

      expect(result).toEqual(['user-2'])
    })
  })

  describe('getSearchStatus', async () => {
    it('現在の検索モードと拡張機能の状態を返す', async () => {
      process.env.SEARCH_MODE = 'like'
      // checkExtensionAvailable for pg_bigm
      mockQueryRaw.mockResolvedValueOnce([])
      // checkExtensionAvailable for pg_trgm
      mockQueryRaw.mockResolvedValueOnce([])

      const { getSearchStatus } = await import('@/lib/search/fulltext')
      const result = await getSearchStatus()

      expect(result.mode).toBe('like')
      expect(result.bigmAvailable).toBe(false)
      expect(result.trgmAvailable).toBe(false)
    })

    it('拡張機能が利用可能な場合はtrueを返す', async () => {
      process.env.SEARCH_MODE = 'bigm'
      // checkExtensionAvailable for pg_bigm
      mockQueryRaw.mockResolvedValueOnce([{ available: true }])
      // checkExtensionAvailable for pg_trgm
      mockQueryRaw.mockResolvedValueOnce([{ available: true }])

      const { getSearchStatus } = await import('@/lib/search/fulltext')
      const result = await getSearchStatus()

      expect(result.mode).toBe('bigm')
      expect(result.bigmAvailable).toBe(true)
      expect(result.trgmAvailable).toBe(true)
    })
  })

  describe('setupFulltextSearch', async () => {
    beforeEach(() => {
      mockExecuteRawUnsafe.mockClear()
      mockExecuteRaw.mockClear()
    })

    it('pg_trgm拡張とインデックスを正常にセットアップする', async () => {
      process.env.SEARCH_MODE = 'trgm'
      // 1 回目: enableExtension 内の $executeRaw (CREATE EXTENSION)
      // 2 回目以降: createSearchIndexes 内の $executeRaw (CREATE INDEX)
      mockExecuteRaw.mockResolvedValue(undefined)

      const { setupFulltextSearch } = await import('@/lib/search/fulltext')
      const result = await setupFulltextSearch()

      expect(result.success).toBe(true)
      expect(result.steps).toHaveLength(2)
      expect(result.steps[0]!.step).toBe('pg_trgm拡張の有効化')
      expect(result.steps[0]!.success).toBe(true)
      expect(result.steps[1]!.step).toBe('GINインデックスの作成')
    })

    it('pg_trgm拡張の有効化に失敗した場合は早期リターン', async () => {
      // enableExtension 内の $executeRaw (CREATE EXTENSION) で失敗させる
      mockExecuteRaw.mockRejectedValueOnce(new Error('Permission denied'))

      const { setupFulltextSearch } = await import('@/lib/search/fulltext')
      const result = await setupFulltextSearch()

      expect(result.success).toBe(false)
      expect(result.steps).toHaveLength(1)
      expect(result.steps[0]!.success).toBe(false)
    })
  })

  describe('getSearchIndexes', async () => {
    it('存在するインデックスのリストを返す', async () => {
      mockQueryRaw.mockResolvedValue([{ exists: true }])

      const { getSearchIndexes } = await import('@/lib/search/fulltext')
      const result = await getSearchIndexes()

      expect(Array.isArray(result)).toBe(true)
      expect(mockQueryRaw).toHaveBeenCalled()
    })

    it('インデックスが存在しない場合は空配列を返す', async () => {
      mockQueryRaw.mockResolvedValue([{ exists: false }])

      const { getSearchIndexes } = await import('@/lib/search/fulltext')
      const result = await getSearchIndexes()

      expect(result).toEqual([])
    })

    it('エラー時は空配列を返す', async () => {
      mockQueryRaw.mockRejectedValueOnce(new Error('DB error'))

      const { getSearchIndexes } = await import('@/lib/search/fulltext')
      const result = await getSearchIndexes()

      expect(result).toEqual([])
    })
  })

  describe('fulltextSearchShops', async () => {
    it('空のクエリは空配列を返す', async () => {
      const { fulltextSearchShops } = await import('@/lib/search/fulltext')
      const result = await fulltextSearchShops('')

      expect(result).toEqual([])
    })

    it('likeモードで盆栽園を検索する', async () => {
      process.env.SEARCH_MODE = 'like'
      mockQueryRaw.mockResolvedValueOnce([{ id: 'shop-1' }, { id: 'shop-2' }])

      const { fulltextSearchShops } = await import('@/lib/search/fulltext')
      const result = await fulltextSearchShops('盆栽園')

      expect(result).toEqual(['shop-1', 'shop-2'])
    })

    it('bigmモードで盆栽園を検索する', async () => {
      process.env.SEARCH_MODE = 'bigm'
      mockQueryRaw.mockResolvedValueOnce([{ id: 'shop-1' }])

      const { fulltextSearchShops } = await import('@/lib/search/fulltext')
      const result = await fulltextSearchShops('盆栽園')

      expect(result).toEqual(['shop-1'])
    })

    it('trgmモードで盆栽園を検索する', async () => {
      process.env.SEARCH_MODE = 'trgm'
      mockQueryRaw.mockResolvedValueOnce([{ id: 'shop-1' }])

      const { fulltextSearchShops } = await import('@/lib/search/fulltext')
      const result = await fulltextSearchShops('盆栽園')

      expect(result).toEqual(['shop-1'])
    })

    it('都道府県フィルタを適用できる', async () => {
      mockQueryRaw.mockResolvedValueOnce([{ id: 'shop-1' }])

      const { fulltextSearchShops } = await import('@/lib/search/fulltext')
      const result = await fulltextSearchShops('盆栽園', { prefecture: '東京都' })

      expect(result).toEqual(['shop-1'])
    })

    it('エラー時はLIKE検索にフォールバックする', async () => {
      process.env.SEARCH_MODE = 'bigm'
      mockQueryRaw.mockRejectedValueOnce(new Error('Extension not found'))
      mockQueryRaw.mockResolvedValueOnce([{ id: 'shop-1' }])

      const { fulltextSearchShops } = await import('@/lib/search/fulltext')
      const result = await fulltextSearchShops('盆栽園')

      expect(result).toEqual(['shop-1'])
    })
  })

  describe('fulltextSearchEvents', async () => {
    it('空のクエリは空配列を返す', async () => {
      const { fulltextSearchEvents } = await import('@/lib/search/fulltext')
      const result = await fulltextSearchEvents('')

      expect(result).toEqual([])
    })

    it('likeモードでイベントを検索する', async () => {
      process.env.SEARCH_MODE = 'like'
      mockQueryRaw.mockResolvedValueOnce([{ id: 'event-1' }])

      const { fulltextSearchEvents } = await import('@/lib/search/fulltext')
      const result = await fulltextSearchEvents('展示会')

      expect(result).toEqual(['event-1'])
    })

    it('bigmモードでイベントを検索する', async () => {
      process.env.SEARCH_MODE = 'bigm'
      mockQueryRaw.mockResolvedValueOnce([{ id: 'event-1' }])

      const { fulltextSearchEvents } = await import('@/lib/search/fulltext')
      const result = await fulltextSearchEvents('展示会')

      expect(result).toEqual(['event-1'])
    })

    it('trgmモードでイベントを検索する', async () => {
      process.env.SEARCH_MODE = 'trgm'
      mockQueryRaw.mockResolvedValueOnce([{ id: 'event-1' }])

      const { fulltextSearchEvents } = await import('@/lib/search/fulltext')
      const result = await fulltextSearchEvents('展示会')

      expect(result).toEqual(['event-1'])
    })

    it('終了イベントを含める設定ができる', async () => {
      mockQueryRaw.mockResolvedValueOnce([{ id: 'event-1' }])

      const { fulltextSearchEvents } = await import('@/lib/search/fulltext')
      const result = await fulltextSearchEvents('展示会', { includeExpired: true })

      expect(result).toEqual(['event-1'])
    })

    it('都道府県フィルタを適用できる', async () => {
      mockQueryRaw.mockResolvedValueOnce([{ id: 'event-1' }])

      const { fulltextSearchEvents } = await import('@/lib/search/fulltext')
      const result = await fulltextSearchEvents('展示会', { prefecture: '東京都' })

      expect(result).toEqual(['event-1'])
    })

    it('エラー時はLIKE検索にフォールバックする', async () => {
      process.env.SEARCH_MODE = 'bigm'
      mockQueryRaw.mockRejectedValueOnce(new Error('Extension not found'))
      mockQueryRaw.mockResolvedValueOnce([{ id: 'event-1' }])

      const { fulltextSearchEvents } = await import('@/lib/search/fulltext')
      const result = await fulltextSearchEvents('展示会')

      expect(result).toEqual(['event-1'])
    })
  })

  describe('fulltextSearchBonsais', async () => {
    it('空のクエリは空配列を返す', async () => {
      const { fulltextSearchBonsais } = await import('@/lib/search/fulltext')
      const result = await fulltextSearchBonsais('', { userId: 'user-1' })

      expect(result).toEqual([])
    })

    it('likeモードで盆栽を検索する', async () => {
      process.env.SEARCH_MODE = 'like'
      mockQueryRaw.mockResolvedValueOnce([{ id: 'bonsai-1' }])

      const { fulltextSearchBonsais } = await import('@/lib/search/fulltext')
      const result = await fulltextSearchBonsais('黒松', { userId: 'user-1' })

      expect(result).toEqual(['bonsai-1'])
    })

    it('bigmモードで盆栽を検索する', async () => {
      process.env.SEARCH_MODE = 'bigm'
      mockQueryRaw.mockResolvedValueOnce([{ id: 'bonsai-1' }])

      const { fulltextSearchBonsais } = await import('@/lib/search/fulltext')
      const result = await fulltextSearchBonsais('黒松', { userId: 'user-1' })

      expect(result).toEqual(['bonsai-1'])
    })

    it('trgmモードで盆栽を検索する', async () => {
      process.env.SEARCH_MODE = 'trgm'
      mockQueryRaw.mockResolvedValueOnce([{ id: 'bonsai-1' }])

      const { fulltextSearchBonsais } = await import('@/lib/search/fulltext')
      const result = await fulltextSearchBonsais('黒松', { userId: 'user-1' })

      expect(result).toEqual(['bonsai-1'])
    })

    it('ユーザーIDフィルタを適用できる', async () => {
      mockQueryRaw.mockResolvedValueOnce([{ id: 'bonsai-1' }])

      const { fulltextSearchBonsais } = await import('@/lib/search/fulltext')
      const result = await fulltextSearchBonsais('黒松', { userId: 'user-1' })

      expect(result).toEqual(['bonsai-1'])
    })

    it('エラー時はLIKE検索にフォールバックする', async () => {
      process.env.SEARCH_MODE = 'bigm'
      mockQueryRaw.mockRejectedValueOnce(new Error('Extension not found'))
      mockQueryRaw.mockResolvedValueOnce([{ id: 'bonsai-1' }])

      const { fulltextSearchBonsais } = await import('@/lib/search/fulltext')
      const result = await fulltextSearchBonsais('黒松', { userId: 'user-1' })

      expect(result).toEqual(['bonsai-1'])
    })
  })

  describe('fulltextSearchGlobal', async () => {
    it('空のクエリは全ての結果が空配列', async () => {
      const { fulltextSearchGlobal } = await import('@/lib/search/fulltext')
      const result = await fulltextSearchGlobal('')

      expect(result).toEqual({
        postIds: [],
        userIds: [],
        shopIds: [],
        eventIds: [],
        bonsaiIds: [],
      })
    })

    it('空白のみのクエリは全ての結果が空配列', async () => {
      const { fulltextSearchGlobal } = await import('@/lib/search/fulltext')
      const result = await fulltextSearchGlobal('   ')

      expect(result).toEqual({
        postIds: [],
        userIds: [],
        shopIds: [],
        eventIds: [],
        bonsaiIds: [],
      })
    })

    it('複数エンティティを横断して検索する', async () => {
      // 5回のクエリ（posts, users, shops, events, bonsais）
      mockQueryRaw
        .mockResolvedValueOnce([{ id: 'post-1' }])
        .mockResolvedValueOnce([{ id: 'user-1' }])
        .mockResolvedValueOnce([{ id: 'shop-1' }])
        .mockResolvedValueOnce([{ id: 'event-1' }])
        .mockResolvedValueOnce([{ id: 'bonsai-1' }])

      const { fulltextSearchGlobal } = await import('@/lib/search/fulltext')
      // 盆栽は所有者専用のため currentUserId が必要
      const result = await fulltextSearchGlobal('盆栽', { currentUserId: 'user-1' })

      expect(result.postIds).toEqual(['post-1'])
      expect(result.userIds).toEqual(['user-1'])
      expect(result.shopIds).toEqual(['shop-1'])
      expect(result.eventIds).toEqual(['event-1'])
      expect(result.bonsaiIds).toEqual(['bonsai-1'])
    })

    it('excludedUserIdsを各検索に渡す', async () => {
      mockQueryRaw
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])

      const { fulltextSearchGlobal } = await import('@/lib/search/fulltext')
      await fulltextSearchGlobal('盆栽', {
        excludedUserIds: ['blocked-user'],
        currentUserId: 'current-user',
        limit: 10,
      })

      expect(mockQueryRaw).toHaveBeenCalled()
    })
  })
})
