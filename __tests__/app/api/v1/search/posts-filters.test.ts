// @vitest-environment node
/**
 * GET /api/v1/search/posts — 新規フィルタパラメータのテスト（C-1）
 *
 * genreId → [genreId] 配列変換、dateFrom/dateTo/minLikes フィルタ構築、
 * mediaType の API→サービス層マッピング（image→images, video→videos, none→text）、
 * 不正な mediaType → 400 VALIDATION_ERROR を検証する。
 */
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'

const VALID_SECRET = 'a'.repeat(64)

const mockUserFindUnique = vi.fn()
const mockBlockFindMany = vi.fn()
const mockMuteFindMany = vi.fn()
vi.mock('@/lib/db', () => ({
  prisma: {
    user: {
      findUnique: (...args: unknown[]) => mockUserFindUnique(...args),
    },
    block: {
      findMany: (...args: unknown[]) => mockBlockFindMany(...args),
    },
    mute: {
      findMany: (...args: unknown[]) => mockMuteFindMany(...args),
    },
    follow: {
      findMany: vi.fn().mockResolvedValue([]),
    },
    followRequest: {
      findMany: vi.fn().mockResolvedValue([]),
    },
  },
}))

const mockCheckUserRateLimit = vi.fn()
vi.mock('@/lib/rate-limit', () => ({
  checkUserRateLimit: (...args: unknown[]) => mockCheckUserRateLimit(...args),
}))

const mockFetchSearchPosts = vi.fn()
vi.mock('@/lib/services/search-service', () => ({
  fetchSearchPosts: (...args: unknown[]) => mockFetchSearchPosts(...args),
  fetchSearchUsers: vi.fn(),
}))

// WHY: The search/posts route imports mention-resolver and follow-state-resolver,
// which both have `import 'server-only'` at module level.
// Mocking prevents the "Client Component" error in node test environment.
vi.mock('server-only', () => ({}))

async function makeFilterRequest(
  userId: string,
  params: Record<string, string>,
): Promise<NextRequest> {
  const { signAccessToken } = await import('@/lib/api/v1/jwt')
  const token = await signAccessToken(userId)
  const url = new URL('http://localhost/api/v1/search/posts')
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v)
  }
  return new NextRequest(url.toString(), {
    headers: { authorization: `Bearer ${token}` },
  })
}

/** genreIds のような反復クエリパラメータ (?k=v1&k=v2) を組み立てるための拡張版リクエストヘルパー */
async function makeMultiValueRequest(
  userId: string,
  params: Array<[string, string]>,
): Promise<NextRequest> {
  const { signAccessToken } = await import('@/lib/api/v1/jwt')
  const token = await signAccessToken(userId)
  const url = new URL('http://localhost/api/v1/search/posts')
  for (const [k, v] of params) {
    url.searchParams.append(k, v)
  }
  return new NextRequest(url.toString(), {
    headers: { authorization: `Bearer ${token}` },
  })
}

describe('GET /api/v1/search/posts — フィルタパラメータ（C-1）', () => {
  beforeEach(() => {
    vi.stubEnv('MOBILE_JWT_SECRET', VALID_SECRET)
    vi.clearAllMocks()
    mockUserFindUnique.mockResolvedValue({ id: 'user-1', isSuspended: false, email: 'u@example.com' })
    mockCheckUserRateLimit.mockResolvedValue({ success: true, remaining: 19, resetTime: Date.now() + 60000 })
    mockFetchSearchPosts.mockResolvedValue({ posts: [], nextCursor: undefined })
    mockBlockFindMany.mockResolvedValue([])
    mockMuteFindMany.mockResolvedValue([])
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  // ── genreId フィルタ ──

  it('genreId を渡すと fetchSearchPosts の第 3 引数が [genreId] になる', async () => {
    const req = await makeFilterRequest('user-1', { q: '松', genreId: 'genre-abc' })
    const { GET } = await import('@/app/api/v1/search/posts/route')
    await GET(req)

    expect(mockFetchSearchPosts).toHaveBeenCalledWith(
      '松',
      'user-1',
      ['genre-abc'],
      undefined,
      undefined,
      undefined,
    )
  })

  it('genreId なしの場合 fetchSearchPosts の第 3 引数が undefined になる', async () => {
    const req = await makeFilterRequest('user-1', { q: '松' })
    const { GET } = await import('@/app/api/v1/search/posts/route')
    await GET(req)

    expect(mockFetchSearchPosts).toHaveBeenCalledWith(
      '松',
      'user-1',
      undefined,
      undefined,
      undefined,
      undefined,
    )
  })

  // ── genreIds（反復クエリ）フィルタ ──

  it('genreIds=a&genreIds=b を渡すと fetchSearchPosts の第 3 引数が [a, b] になる', async () => {
    const req = await makeMultiValueRequest('user-1', [
      ['q', '松'],
      ['genreIds', 'a'],
      ['genreIds', 'b'],
    ])
    const { GET } = await import('@/app/api/v1/search/posts/route')
    await GET(req)

    const call = mockFetchSearchPosts.mock.calls[0]
    expect(call?.[2]).toEqual(['a', 'b'])
  })

  it('genreId と genreIds を併用すると重複除去した和集合になる（genreId=a, genreIds=b,a → [a, b]）', async () => {
    const req = await makeMultiValueRequest('user-1', [
      ['q', '松'],
      ['genreId', 'a'],
      ['genreIds', 'b'],
      ['genreIds', 'a'],
    ])
    const { GET } = await import('@/app/api/v1/search/posts/route')
    await GET(req)

    const call = mockFetchSearchPosts.mock.calls[0]
    expect(call?.[2]).toEqual(['a', 'b'])
  })

  it('genreIds を 4 件以上渡しても受理される（MAX_GENRES_PER_POST は投稿ジャンル数の制約であり検索には非適用）', async () => {
    const req = await makeMultiValueRequest('user-1', [
      ['q', '松'],
      ['genreIds', 'a'],
      ['genreIds', 'b'],
      ['genreIds', 'c'],
      ['genreIds', 'd'],
    ])
    const { GET } = await import('@/app/api/v1/search/posts/route')
    const res = await GET(req)

    expect(res.status).toBe(200)
    const call = mockFetchSearchPosts.mock.calls[0]
    expect(call?.[2]).toEqual(['a', 'b', 'c', 'd'])
  })

  it('genreIds= のような空文字要素は 400 VALIDATION_ERROR になる', async () => {
    const req = await makeMultiValueRequest('user-1', [
      ['q', '松'],
      ['genreIds', ''],
    ])
    const { GET } = await import('@/app/api/v1/search/posts/route')
    const res = await GET(req)

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error.code).toBe('VALIDATION_ERROR')
  })

  it('genreIds= の 400 ではレート制限を消費しない（Zod エラー優先）', async () => {
    const req = await makeMultiValueRequest('user-1', [
      ['q', '松'],
      ['genreIds', ''],
    ])
    const { GET } = await import('@/app/api/v1/search/posts/route')
    await GET(req)

    expect(mockCheckUserRateLimit).not.toHaveBeenCalled()
  })

  it('genreId・genreIds どちらのパラメータもない場合は第 3 引数が undefined になる', async () => {
    const req = await makeFilterRequest('user-1', { q: '松' })
    const { GET } = await import('@/app/api/v1/search/posts/route')
    await GET(req)

    const call = mockFetchSearchPosts.mock.calls[0]
    expect(call?.[2]).toBeUndefined()
  })

  it('genreIds 付きでもレスポンス形状・cursor に回帰がない（200 + items + nextCursor）', async () => {
    mockFetchSearchPosts.mockResolvedValueOnce({
      posts: [{ id: 'p-1', content: '黒松の管理', user: { id: 'author-1', nickname: 'A', avatarUrl: null } }],
      nextCursor: 'p-1',
    })
    const req = await makeMultiValueRequest('user-1', [
      ['q', '黒松'],
      ['genreIds', 'a'],
      ['genreIds', 'b'],
    ])
    const { GET } = await import('@/app/api/v1/search/posts/route')
    const res = await GET(req)

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(Array.isArray(body.items)).toBe(true)
    expect(body.nextCursor).toBe('p-1')
  })

  // ── filters オブジェクト構築 ──

  it('フィルタパラメータなしの場合 filters=undefined で呼ばれる', async () => {
    const req = await makeFilterRequest('user-1', { q: '松' })
    const { GET } = await import('@/app/api/v1/search/posts/route')
    await GET(req)

    const call = mockFetchSearchPosts.mock.calls[0]
    expect(call?.[5]).toBeUndefined()
  })

  it('dateFrom を渡すと filters.dateFrom が設定される', async () => {
    const req = await makeFilterRequest('user-1', { q: '松', dateFrom: '2026-06-01' })
    const { GET } = await import('@/app/api/v1/search/posts/route')
    await GET(req)

    const call = mockFetchSearchPosts.mock.calls[0]
    const filters = call?.[5]
    expect(filters).toBeDefined()
    expect(filters.dateFrom).toBe('2026-06-01')
  })

  it('dateTo を渡すと filters.dateTo が設定される', async () => {
    const req = await makeFilterRequest('user-1', { q: '松', dateTo: '2026-06-30' })
    const { GET } = await import('@/app/api/v1/search/posts/route')
    await GET(req)

    const call = mockFetchSearchPosts.mock.calls[0]
    const filters = call?.[5]
    expect(filters).toBeDefined()
    expect(filters.dateTo).toBe('2026-06-30')
  })

  it('minLikes を渡すと filters.minLikes が数値で設定される', async () => {
    const req = await makeFilterRequest('user-1', { q: '松', minLikes: '5' })
    const { GET } = await import('@/app/api/v1/search/posts/route')
    await GET(req)

    const call = mockFetchSearchPosts.mock.calls[0]
    const filters = call?.[5]
    expect(filters).toBeDefined()
    expect(filters.minLikes).toBe(5)
  })

  it('minLikes=0 は Zod を通過し filters.minLikes が 0 で設定される', async () => {
    // WHY: route.ts は `minLikes !== undefined` でフィルタ有無を判定する。
    // minLikes=0 は undefined でないため hasFilter=true になり filters が構築される。
    const req = await makeFilterRequest('user-1', { q: '松', minLikes: '0' })
    const { GET } = await import('@/app/api/v1/search/posts/route')
    await GET(req)

    const call = mockFetchSearchPosts.mock.calls[0]
    const filters = call?.[5]
    expect(filters).toBeDefined()
    expect(filters.minLikes).toBe(0)
  })

  // ── mediaType マッピング ──

  it('mediaType=image は filters.mediaType="images" に変換される', async () => {
    const req = await makeFilterRequest('user-1', { q: '松', mediaType: 'image' })
    const { GET } = await import('@/app/api/v1/search/posts/route')
    await GET(req)

    const call = mockFetchSearchPosts.mock.calls[0]
    const filters = call?.[5]
    expect(filters).toBeDefined()
    expect(filters.mediaType).toBe('images')
  })

  it('mediaType=video は filters.mediaType="videos" に変換される', async () => {
    const req = await makeFilterRequest('user-1', { q: '松', mediaType: 'video' })
    const { GET } = await import('@/app/api/v1/search/posts/route')
    await GET(req)

    const call = mockFetchSearchPosts.mock.calls[0]
    const filters = call?.[5]
    expect(filters).toBeDefined()
    expect(filters.mediaType).toBe('videos')
  })

  it('mediaType=none は filters.mediaType="text" に変換される', async () => {
    const req = await makeFilterRequest('user-1', { q: '松', mediaType: 'none' })
    const { GET } = await import('@/app/api/v1/search/posts/route')
    await GET(req)

    const call = mockFetchSearchPosts.mock.calls[0]
    const filters = call?.[5]
    expect(filters).toBeDefined()
    expect(filters.mediaType).toBe('text')
  })

  it('不正な mediaType（text）で 400 VALIDATION_ERROR', async () => {
    const req = await makeFilterRequest('user-1', { q: '松', mediaType: 'text' })
    const { GET } = await import('@/app/api/v1/search/posts/route')
    const res = await GET(req)

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error.code).toBe('VALIDATION_ERROR')
  })

  it('不正な mediaType（photo）で 400 VALIDATION_ERROR', async () => {
    const req = await makeFilterRequest('user-1', { q: '松', mediaType: 'photo' })
    const { GET } = await import('@/app/api/v1/search/posts/route')
    const res = await GET(req)

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error.code).toBe('VALIDATION_ERROR')
  })

  it('不正な mediaType ではレート制限を消費しない（Zod エラー優先）', async () => {
    const req = await makeFilterRequest('user-1', { q: '松', mediaType: 'photo' })
    const { GET } = await import('@/app/api/v1/search/posts/route')
    await GET(req)

    expect(mockCheckUserRateLimit).not.toHaveBeenCalled()
  })

  // ── 複合フィルタ ──

  it('dateFrom + dateTo + minLikes の複合フィルタで filters オブジェクトが正しく構築される', async () => {
    const req = await makeFilterRequest('user-1', {
      q: '松',
      dateFrom: '2026-01-01',
      dateTo: '2026-06-30',
      minLikes: '10',
    })
    const { GET } = await import('@/app/api/v1/search/posts/route')
    await GET(req)

    const call = mockFetchSearchPosts.mock.calls[0]
    const filters = call?.[5]
    expect(filters).toMatchObject({
      dateFrom: '2026-01-01',
      dateTo: '2026-06-30',
      minLikes: 10,
    })
  })

  it('genreId + mediaType + cursor の組み合わせが正しく渡される', async () => {
    const req = await makeFilterRequest('user-1', {
      q: '黒松',
      genreId: 'genre-1',
      mediaType: 'image',
      cursor: 'cursor-1',
    })
    const { GET } = await import('@/app/api/v1/search/posts/route')
    await GET(req)

    const call = mockFetchSearchPosts.mock.calls[0]
    expect(call?.[0]).toBe('黒松')
    expect(call?.[1]).toBe('user-1')
    expect(call?.[2]).toEqual(['genre-1'])
    expect(call?.[3]).toBe('cursor-1')
    const filters = call?.[5]
    expect(filters).toBeDefined()
    expect(filters.mediaType).toBe('images')
  })

  it('フィルタ付きでも 200 と items を返す', async () => {
    mockFetchSearchPosts.mockResolvedValueOnce({
      posts: [{ id: 'p-1', content: '黒松の管理', user: { id: 'author-1', nickname: 'A', avatarUrl: null } }],
      nextCursor: undefined,
    })
    const req = await makeFilterRequest('user-1', { q: '黒松', mediaType: 'image' })
    const { GET } = await import('@/app/api/v1/search/posts/route')
    const res = await GET(req)

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(Array.isArray(body.items)).toBe(true)
  })

  it('投稿一覧の user オブジェクトに isBlockedByUser が混入しない（プロフィール専用フィールドの回帰防止）', async () => {
    mockFetchSearchPosts.mockResolvedValueOnce({
      posts: [{ id: 'p-1', content: '黒松の管理', user: { id: 'author-1', nickname: 'A', avatarUrl: null } }],
      nextCursor: undefined,
    })
    const req = await makeFilterRequest('user-1', { q: '黒松' })
    const { GET } = await import('@/app/api/v1/search/posts/route')
    const res = await GET(req)

    expect(res.status).toBe(200)
    const body = await res.json()
    expect('isBlockedByUser' in body.items[0].user).toBe(false)
    expect(body.items[0].user.isBlocked).toBe(false)
    expect(body.items[0].user.isMuted).toBe(false)
  })
})
