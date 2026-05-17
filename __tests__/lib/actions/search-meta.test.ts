// @vitest-environment node
/**
 * search-meta.ts - 検索補助データの内部モジュール
 *
 * 'use server' を付けない内部 helper のため Server Action 規約は適用されない。
 * 各関数の正常系 + 例外時のフェイルセーフ動作を検証する。
 */

import { vi, describe, it, expect, beforeEach } from 'vitest'

const mockGetCachedGenres = vi.fn()
const mockGetCachedPopularTags = vi.fn()
const mockGetSearchMode = vi.fn()

vi.mock('@/lib/cache', () => ({
  getCachedGenres: () => mockGetCachedGenres(),
  getCachedPopularTags: (limit: number) => mockGetCachedPopularTags(limit),
}))

vi.mock('@/lib/search/fulltext', () => ({
  getSearchMode: () => mockGetSearchMode(),
}))

const mockLoggerError = vi.fn()
vi.mock('@/lib/logger', () => ({
  __esModule: true,
  default: { error: mockLoggerError, warn: vi.fn(), info: vi.fn() },
  logger: { error: mockLoggerError, warn: vi.fn(), info: vi.fn() },
}))

describe('search-meta', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
  })

  describe('getPopularTags', () => {
    it('正常時はキャッシュから tags を返す', async () => {
      mockGetCachedPopularTags.mockResolvedValueOnce({ tags: [{ name: '盆栽', count: 10 }] })
      const { getPopularTags } = await import('@/lib/actions/search-meta')
      const result = await getPopularTags(5)
      expect(result).toEqual({ tags: [{ name: '盆栽', count: 10 }] })
      expect(mockGetCachedPopularTags).toHaveBeenCalledWith(5)
    })

    it('limit 引数を省略すると POPULAR_TAGS_LIMIT が使われる', async () => {
      const { POPULAR_TAGS_LIMIT } = await import('@/lib/constants/limits')
      mockGetCachedPopularTags.mockResolvedValueOnce({ tags: [] })
      const { getPopularTags } = await import('@/lib/actions/search-meta')
      await getPopularTags()
      expect(mockGetCachedPopularTags).toHaveBeenCalledWith(POPULAR_TAGS_LIMIT)
    })

    it('例外時は空配列にフェイルセーフし logger.error にメッセージを残す', async () => {
      mockGetCachedPopularTags.mockRejectedValueOnce(new Error('redis down'))
      const { getPopularTags } = await import('@/lib/actions/search-meta')
      const result = await getPopularTags()
      expect(result).toEqual({ tags: [] })
      expect(mockLoggerError).toHaveBeenCalledWith('getPopularTags failed', expect.objectContaining({ error: 'redis down' }))
    })

    it('Error 以外（文字列）が throw されても安全にフェイルバックする', async () => {
      mockGetCachedPopularTags.mockRejectedValueOnce('non-error')
      const { getPopularTags } = await import('@/lib/actions/search-meta')
      const result = await getPopularTags()
      expect(result).toEqual({ tags: [] })
      // error フィールドは String() 化されている
      expect(mockLoggerError).toHaveBeenCalledWith('getPopularTags failed', { error: 'non-error' })
    })
  })

  describe('getAllGenres', () => {
    it('正常時はジャンル辞書を返す', async () => {
      mockGetCachedGenres.mockResolvedValueOnce({ genres: { 松柏類: [{ id: 'g1', name: '黒松' }] } })
      const { getAllGenres } = await import('@/lib/actions/search-meta')
      const result = await getAllGenres()
      expect(result).toEqual({ genres: { 松柏類: [{ id: 'g1', name: '黒松' }] } })
    })

    it('例外時は空オブジェクトを返す', async () => {
      mockGetCachedGenres.mockRejectedValueOnce(new Error('cache miss'))
      const { getAllGenres } = await import('@/lib/actions/search-meta')
      const result = await getAllGenres()
      expect(result).toEqual({ genres: {} })
      expect(mockLoggerError).toHaveBeenCalledWith('getAllGenres failed', expect.objectContaining({ error: 'cache miss' }))
    })
  })

  describe('getSearchModeInfo', () => {
    it('現在の検索モードを返す', async () => {
      mockGetSearchMode.mockReturnValueOnce('bigm')
      const { getSearchModeInfo } = await import('@/lib/actions/search-meta')
      expect(await getSearchModeInfo()).toEqual({ mode: 'bigm' })
    })

    it('like モード時も同様に返す（フォールバック検索）', async () => {
      mockGetSearchMode.mockReturnValueOnce('like')
      const { getSearchModeInfo } = await import('@/lib/actions/search-meta')
      expect(await getSearchModeInfo()).toEqual({ mode: 'like' })
    })
  })
})
