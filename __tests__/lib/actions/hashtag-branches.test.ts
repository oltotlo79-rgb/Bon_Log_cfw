// @vitest-environment node
/**
 * hashtag.ts ブランチカバレッジ向上テスト
 *
 * 対象:
 * - attachHashtagsToPost: contentがnull/空文字、ハッシュタグなし、DB失敗
 * - detachHashtagsFromPost: 空結果、hashtagIds=0、DBエラー
 * - getTrendingHashtags: 正常、DBエラー
 * - getPostsByHashtag: 正常、ページネーション境界
 * - searchHashtags: 空クエリ、正常、DBエラー
 */

import { vi, describe, it, expect, beforeEach } from 'vitest'
vi.unmock('@/lib/actions/hashtag')
vi.unmock('@/lib/services/hashtag-sync')

import { createMockPrismaClient } from '../../utils/test-utils'

const mockPrisma = createMockPrismaClient()
vi.mock('@/lib/db', () => ({ prisma: mockPrisma }))

vi.mock('@/lib/logger', () => ({
  __esModule: true,
  default: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}))

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
  unstable_cache: vi.fn((fn: (...a: unknown[]) => unknown) => fn),
}))

const mockAuth = vi.fn()
vi.mock('@/lib/auth', () => ({ auth: () => mockAuth() }))

vi.mock('@/lib/rate-limit', () => ({
  rateLimit: vi.fn().mockResolvedValue({ success: true }),
  checkUserRateLimit: vi.fn().mockResolvedValue({ success: true }),
  RATE_LIMITS: { search: { maxRequests: 30, windowMs: 60000 } },
}))

beforeEach(() => {
  vi.clearAllMocks()
  vi.resetModules()
})

describe('attachHashtagsToPost', () => {
  const importModule = () => import('@/lib/services/hashtag-sync')

  it('contentがnullの場合は何もしない', async () => {
    const { attachHashtagsToPost } = await importModule()
    await attachHashtagsToPost('post-1', null)
    expect(mockPrisma.$transaction).not.toHaveBeenCalled()
  })

  it('contentが空文字の場合は何もしない', async () => {
    const { attachHashtagsToPost } = await importModule()
    await attachHashtagsToPost('post-1', '')
    expect(mockPrisma.$transaction).not.toHaveBeenCalled()
  })

  it('ハッシュタグがない通常テキストの場合は何もしない', async () => {
    const { attachHashtagsToPost } = await importModule()
    await attachHashtagsToPost('post-1', 'これはハッシュタグなしのテキスト')
    expect(mockPrisma.$transaction).not.toHaveBeenCalled()
  })

  it('ハッシュタグを含むテキストでupsertが呼ばれる', async () => {
    mockPrisma.$transaction.mockResolvedValueOnce([{ id: 'h1', name: '盆栽', count: 1 }])
    mockPrisma.$transaction.mockResolvedValueOnce([{}])

    const { attachHashtagsToPost } = await importModule()
    await attachHashtagsToPost('post-1', '#盆栽 を楽しむ')

    expect(mockPrisma.$transaction).toHaveBeenCalledTimes(2)
  })

  it('DB失敗時はエラーを吸収して終了する', async () => {
    mockPrisma.$transaction.mockRejectedValueOnce(new Error('DB error'))

    const { attachHashtagsToPost } = await importModule()
    // エラーがスローされないことを確認
    await attachHashtagsToPost('post-1', '#テスト')
  })
})

describe('detachHashtagsFromPost', () => {
  const importModule = () => import('@/lib/services/hashtag-sync')

  it('関連ハッシュタグがない場合はtransactionを呼ばない', async () => {
    mockPrisma.postHashtag.findMany.mockResolvedValue([])
    mockPrisma.postHashtag.deleteMany.mockResolvedValue({ count: 0 })

    const { detachHashtagsFromPost } = await importModule()
    await detachHashtagsFromPost('post-1')

    // hashtagIds.length === 0 なのでtransactionは呼ばれない
    expect(mockPrisma.$transaction).not.toHaveBeenCalled()
  })

  it('関連ハッシュタグがある場合はカウント減少+削除を実行', async () => {
    mockPrisma.postHashtag.findMany.mockResolvedValue([
      { hashtagId: 'h1', hashtag: { id: 'h1', name: '盆栽', count: 2 } },
    ])
    mockPrisma.postHashtag.deleteMany.mockResolvedValue({ count: 1 })
    mockPrisma.$transaction.mockResolvedValue([{}, {}])

    const { detachHashtagsFromPost } = await importModule()
    await detachHashtagsFromPost('post-1')

    expect(mockPrisma.$transaction).toHaveBeenCalled()
  })

  it('DB失敗時はエラーを吸収する', async () => {
    mockPrisma.postHashtag.findMany.mockRejectedValue(new Error('DB error'))

    const { detachHashtagsFromPost } = await importModule()
    await detachHashtagsFromPost('post-1')
  })
})

describe('getTrendingHashtags', () => {
  const importModule = () => import('@/lib/actions/hashtag')

  it('人気順でハッシュタグを返す', async () => {
    const mockTags = [
      { id: 'h1', name: '盆栽', count: 50 },
      { id: 'h2', name: '松', count: 30 },
    ]
    mockPrisma.hashtag.findMany.mockResolvedValue(mockTags)

    const { getTrendingHashtags } = await importModule()
    const result = await getTrendingHashtags(5)

    expect(result).toEqual(mockTags)
  })

  it('DB失敗時は空配列を返す', async () => {
    mockPrisma.hashtag.findMany.mockRejectedValue(new Error('DB error'))

    const { getTrendingHashtags } = await importModule()
    const result = await getTrendingHashtags()

    expect(result).toEqual([])
  })
})

describe('searchHashtags', () => {
  const importModule = () => import('@/lib/actions/hashtag')

  it('空クエリの場合は空配列を返す', async () => {
    const { searchHashtags } = await importModule()
    expect(await searchHashtags('')).toEqual([])
  })

  it('正常に検索結果を返す', async () => {
    const mockTags = [{ id: 'h1', name: '盆栽展示', count: 10 }]
    mockPrisma.hashtag.findMany.mockResolvedValue(mockTags)

    const { searchHashtags } = await importModule()
    const result = await searchHashtags('盆栽')

    expect(result).toEqual(mockTags)
  })

  it('DB失敗時は空配列を返す', async () => {
    mockPrisma.hashtag.findMany.mockRejectedValue(new Error('DB error'))

    const { searchHashtags } = await importModule()
    const result = await searchHashtags('test')

    expect(result).toEqual([])
  })
})

describe('getPostsByHashtag', () => {
  const importModule = () => import('@/lib/actions/hashtag')

  it('投稿一覧とハッシュタグ情報を返す', async () => {
    const mockPosts = [{ id: 'p1', content: '#盆栽' }]
    mockPrisma.post.findMany.mockResolvedValue(mockPosts)

    const { getPostsByHashtag } = await importModule()
    const result = await getPostsByHashtag('盆栽')

    expect(result.posts).toEqual(mockPosts)
    expect(result.hashtag.name).toBe('盆栽')
  })

  it('DB失敗時は空結果を返す', async () => {
    mockPrisma.post.findMany.mockRejectedValue(new Error('DB error'))

    const { getPostsByHashtag } = await importModule()
    const result = await getPostsByHashtag('test')

    expect(result.posts).toEqual([])
    expect(result.nextCursor).toBeUndefined()
  })
})
