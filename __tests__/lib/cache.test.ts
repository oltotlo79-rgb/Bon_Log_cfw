// @vitest-environment node

import { vi } from 'vitest'
import { createMockPrismaClient } from '../utils/test-utils'

// Prismaモック
const mockPrisma = createMockPrismaClient()
vi.mock('@/lib/db', () => ({
  prisma: mockPrisma,
}))

// テスト中は DB が利用可能と仮定 (本番 build 用のスキップ判定を無効化)
vi.mock('@/lib/build/db-availability', () => ({
  shouldSkipBuildTimeDbAccess: () => false,
}))

// Next.js cache mock
const mockRevalidateTag = vi.fn()
vi.mock('next/cache', () => ({ revalidatePath: vi.fn(), revalidateTag: mockRevalidateTag, unstable_cache: vi.fn((fn) => fn), cache: vi.fn((fn) => fn) }))

describe('Cache Module', async () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('CACHE_TAGS', async () => {
    it('キャッシュタグ定数が定義されている', async () => {
      const { CACHE_TAGS } = await import('@/lib/cache')

      expect(CACHE_TAGS.GENRES).toBe('genres')
      expect(CACHE_TAGS.TRENDING_GENRES).toBe('trending-genres')
      expect(CACHE_TAGS.POPULAR_TAGS).toBe('popular-tags')
    })
  })

  describe('getCachedGenres', async () => {
    it('ジャンル一覧をカテゴリごとにグループ化して返す', async () => {
      const mockGenres = [
        { id: '1', name: '黒松', category: '松柏類', sortOrder: 1 },
        { id: '2', name: '五葉松', category: '松柏類', sortOrder: 2 },
        { id: '3', name: 'もみじ', category: '雑木類', sortOrder: 10 },
        { id: '4', name: '用品', category: '用品・道具', sortOrder: 20 },
      ]
      mockPrisma.genre.findMany.mockResolvedValue(mockGenres)

      const { getCachedGenres } = await import('@/lib/cache')
      const result = await getCachedGenres()

      expect(result.genres['松柏類']).toHaveLength(2)
      expect(result.genres['雑木類']).toHaveLength(1)
      expect(result.genres['用品・道具']).toHaveLength(1)
      expect(result.allGenres).toHaveLength(4)
    })

    it('カテゴリ順序を正しく適用する', async () => {
      const mockGenres = [
        { id: '1', name: 'その他アイテム', category: 'その他', sortOrder: 100 },
        { id: '2', name: '黒松', category: '松柏類', sortOrder: 1 },
        { id: '3', name: '草もの', category: '草もの', sortOrder: 30 },
      ]
      mockPrisma.genre.findMany.mockResolvedValue(mockGenres)

      const { getCachedGenres } = await import('@/lib/cache')
      const result = await getCachedGenres()

      const categoryOrder = Object.keys(result.genres)
      expect(categoryOrder).toEqual(['松柏類', '草もの', 'その他'])
    })

    it('空のジャンルリストを処理できる', async () => {
      mockPrisma.genre.findMany.mockResolvedValue([])

      const { getCachedGenres } = await import('@/lib/cache')
      const result = await getCachedGenres()

      expect(result.genres).toEqual({})
      expect(result.allGenres).toEqual([])
    })
  })

  describe('getCachedTrendingGenres', async () => {
    it('トレンドジャンルを投稿数順に返す', async () => {
      const mockTrendingGenres = [
        { genreId: 'genre-1', _count: { genreId: 25 } },
        { genreId: 'genre-2', _count: { genreId: 18 } },
      ]
      const mockGenreDetails = [
        { id: 'genre-1', name: '黒松', category: '松柏類' },
        { id: 'genre-2', name: 'もみじ', category: '雑木類' },
      ]
      mockPrisma.postGenre.groupBy.mockResolvedValue(mockTrendingGenres)
      mockPrisma.genre.findMany.mockResolvedValue(mockGenreDetails)

      const { getCachedTrendingGenres } = await import('@/lib/cache')
      const result = await getCachedTrendingGenres(5)

      expect(result.genres).toHaveLength(2)
      expect(result.genres[0]!.postCount).toBe(25)
      expect(result.genres[0]!.name).toBe('黒松')
    })

    it('デフォルトのlimit値（5）を使用する', async () => {
      mockPrisma.postGenre.groupBy.mockResolvedValue([])
      mockPrisma.genre.findMany.mockResolvedValue([])

      const { getCachedTrendingGenres } = await import('@/lib/cache')
      await getCachedTrendingGenres()

      expect(mockPrisma.postGenre.groupBy).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 5,
        })
      )
    })

    it('ジャンル詳細が見つからない場合は除外する', async () => {
      const mockTrendingGenres = [
        { genreId: 'genre-1', _count: { genreId: 25 } },
        { genreId: 'deleted-genre', _count: { genreId: 10 } },
      ]
      const mockGenreDetails = [
        { id: 'genre-1', name: '黒松', category: '松柏類' },
      ]
      mockPrisma.postGenre.groupBy.mockResolvedValue(mockTrendingGenres)
      mockPrisma.genre.findMany.mockResolvedValue(mockGenreDetails)

      const { getCachedTrendingGenres } = await import('@/lib/cache')
      const result = await getCachedTrendingGenres()

      expect(result.genres).toHaveLength(1)
    })

    it('非表示投稿・非公開/停止著者の投稿を集計から除外する（M-1）', async () => {
      mockPrisma.postGenre.groupBy.mockResolvedValue([])
      mockPrisma.genre.findMany.mockResolvedValue([])

      const { getCachedTrendingGenres } = await import('@/lib/cache')
      await getCachedTrendingGenres()

      expect(mockPrisma.postGenre.groupBy).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            post: expect.objectContaining({
              isHidden: false,
              user: { isPublic: true, isSuspended: false },
            }),
          },
        })
      )
    })
  })

  describe('getCachedPopularTags', async () => {
    it('人気タグを出現回数順に返す', async () => {
      // $queryRawで hashtags + post_hashtags を結合して取得
      mockPrisma.$queryRaw.mockResolvedValue([
        { name: '盆栽', tag_count: BigInt(3) },
        { name: '黒松', tag_count: BigInt(2) },
        { name: 'もみじ', tag_count: BigInt(1) },
      ])

      const { getCachedPopularTags } = await import('@/lib/cache')
      const result = await getCachedPopularTags(10)

      expect(result.tags[0]!.tag).toBe('盆栽')
      expect(result.tags[0]!.count).toBe(3)
      expect(result.tags).toHaveLength(3)
    })

    it('タグ名がそのまま返される', async () => {
      mockPrisma.$queryRaw.mockResolvedValue([
        { name: 'bonsai', tag_count: BigInt(3) },
      ])

      const { getCachedPopularTags } = await import('@/lib/cache')
      const result = await getCachedPopularTags()

      expect(result.tags).toHaveLength(1)
      expect(result.tags[0]!.tag).toBe('bonsai')
      expect(result.tags[0]!.count).toBe(3)
    })

    it('日本語タグを正しく返す', async () => {
      mockPrisma.$queryRaw.mockResolvedValue([
        { name: '盆栽好き', tag_count: BigInt(5) },
        { name: 'カタカナタグ', tag_count: BigInt(2) },
      ])

      const { getCachedPopularTags } = await import('@/lib/cache')
      const result = await getCachedPopularTags()

      expect(result.tags.map((t: { tag: string }) => t.tag)).toContain('盆栽好き')
      expect(result.tags.map((t: { tag: string }) => t.tag)).toContain('カタカナタグ')
    })

    it('結果が空の場合は空配列を返す', async () => {
      mockPrisma.$queryRaw.mockResolvedValue([])

      const { getCachedPopularTags } = await import('@/lib/cache')
      const result = await getCachedPopularTags()

      expect(result.tags).toHaveLength(0)
    })

    it('limit引数で取得数が制限される', async () => {
      mockPrisma.$queryRaw.mockResolvedValue([
        { name: 'tag1', tag_count: BigInt(6) },
        { name: 'tag2', tag_count: BigInt(5) },
        { name: 'tag3', tag_count: BigInt(4) },
      ])

      const { getCachedPopularTags } = await import('@/lib/cache')
      const result = await getCachedPopularTags(3)

      expect(result.tags).toHaveLength(3)
    })

    it('著者の可視性(is_public/is_suspended)で集計対象を絞る（M-6）', async () => {
      mockPrisma.$queryRaw.mockResolvedValue([])

      const { getCachedPopularTags } = await import('@/lib/cache')
      await getCachedPopularTags()

      const strings = mockPrisma.$queryRaw.mock.calls[0][0] as string[]
      const sql = strings.join(' ')
      expect(sql).toContain('JOIN users')
      expect(sql).toContain('is_public')
      expect(sql).toContain('is_suspended')
    })
  })

  describe('revalidateGenresCache', async () => {
    it('ジャンルキャッシュを無効化する', async () => {
      const { revalidateGenresCache, CACHE_TAGS } = await import('@/lib/cache')
      revalidateGenresCache()

      expect(mockRevalidateTag).toHaveBeenCalledWith(CACHE_TAGS.GENRES, { expire: 0 })
    })
  })

  describe('revalidateTrendingGenresCache', async () => {
    it('トレンドジャンルキャッシュを無効化する', async () => {
      const { revalidateTrendingGenresCache, CACHE_TAGS } = await import('@/lib/cache')
      revalidateTrendingGenresCache()

      expect(mockRevalidateTag).toHaveBeenCalledWith(CACHE_TAGS.TRENDING_GENRES, { expire: 0 })
    })
  })

  describe('revalidatePopularTagsCache', async () => {
    it('人気タグキャッシュを無効化する', async () => {
      const { revalidatePopularTagsCache, CACHE_TAGS } = await import('@/lib/cache')
      revalidatePopularTagsCache()

      expect(mockRevalidateTag).toHaveBeenCalledWith(CACHE_TAGS.POPULAR_TAGS, { expire: 0 })
    })
  })
})
