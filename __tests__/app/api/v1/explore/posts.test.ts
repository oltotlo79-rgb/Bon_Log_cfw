// @vitest-environment node
/**
 * GET /api/v1/explore/posts のユニットテスト
 *
 * hashtag/genreId 排他制約・ゲスト可・200/400/401/429 の全分岐を検証する。
 * mentionedUsers 付与・isBlocked/isMuted 付与も検証する。
 */
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'

const VALID_SECRET = 'a'.repeat(64)
const GUEST_EMAIL = 'guest@example.com'
const USER_ID = 'user-explore-1'

// ──────────────────────────────────────────────────
// Mock: prisma（user.findUnique のみ auth-guard で使用）
// ──────────────────────────────────────────────────
const mockUserFindUnique = vi.fn()
vi.mock('@/lib/db', () => ({
  prisma: {
    user: { findUnique: (...args: unknown[]) => mockUserFindUnique(...args) },
  },
}))

// ──────────────────────────────────────────────────
// Mock: rate-limit
// ──────────────────────────────────────────────────
const mockCheckUserRateLimit = vi.fn()
vi.mock('@/lib/rate-limit', () => ({
  checkUserRateLimit: (...args: unknown[]) => mockCheckUserRateLimit(...args),
}))

// ──────────────────────────────────────────────────
// Mock: explore-posts-service
// ──────────────────────────────────────────────────
const mockFetchPostsByHashtag = vi.fn()
const mockFetchPostsByGenre = vi.fn()
vi.mock('@/lib/services/explore-posts-service', () => ({
  fetchPostsByHashtag: (...args: unknown[]) => mockFetchPostsByHashtag(...args),
  fetchPostsByGenre: (...args: unknown[]) => mockFetchPostsByGenre(...args),
}))

// ──────────────────────────────────────────────────
// Mock: mention-resolver
// ──────────────────────────────────────────────────
const mockAttachMentionedUsers = vi.fn()
vi.mock('@/lib/api/v1/mention-resolver', () => ({
  attachMentionedUsers: (...args: unknown[]) => mockAttachMentionedUsers(...args),
}))

// ──────────────────────────────────────────────────
// Mock: follow-state-resolver
// ──────────────────────────────────────────────────
const mockResolveBlockMuteStates = vi.fn()
vi.mock('@/lib/api/v1/follow-state-resolver', () => ({
  resolveBlockMuteStates: (...args: unknown[]) => mockResolveBlockMuteStates(...args),
}))

// ──────────────────────────────────────────────────
// テスト用モックデータ
// ──────────────────────────────────────────────────
function makeMockPost(id: string) {
  return {
    id,
    content: `test post ${id}`,
    userId: 'author-1',
    user: { id: 'author-1', nickname: 'Author', avatarUrl: null },
    likeCount: 0,
    commentCount: 0,
    isLiked: false,
    isBookmarked: false,
    genres: [],
    media: [],
  }
}

function makeMockPostWithMentions(id: string) {
  return { ...makeMockPost(id), mentionedUsers: [] }
}

// ──────────────────────────────────────────────────
// Request ヘルパー
// ──────────────────────────────────────────────────
async function makeRequest(
  userId: string,
  email: string,
  params: Record<string, string> = {},
): Promise<NextRequest> {
  const { signAccessToken } = await import('@/lib/api/v1/jwt')
  const token = await signAccessToken(userId)
  mockUserFindUnique.mockResolvedValueOnce({ id: userId, isSuspended: false, email })

  const url = new URL('http://localhost/api/v1/explore/posts')
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v))

  return new NextRequest(url.toString(), {
    method: 'GET',
    headers: { authorization: `Bearer ${token}` },
  })
}

// ──────────────────────────────────────────────────
// Tests
// ──────────────────────────────────────────────────
describe('GET /api/v1/explore/posts', () => {
  beforeEach(() => {
    vi.stubEnv('MOBILE_JWT_SECRET', VALID_SECRET)
    vi.clearAllMocks()
    mockCheckUserRateLimit.mockResolvedValue({ success: true, remaining: 59, resetTime: Date.now() + 60000 })
    mockFetchPostsByHashtag.mockResolvedValue({ posts: [], nextCursor: undefined })
    mockFetchPostsByGenre.mockResolvedValue({ posts: [], nextCursor: undefined })
    mockAttachMentionedUsers.mockImplementation((posts: unknown[]) =>
      posts.map((p) => ({ ...(p as Record<string, unknown>), mentionedUsers: [] })),
    )
    mockResolveBlockMuteStates.mockResolvedValue(new Map())
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  // ────────────────────────────────────────────────
  // 正常系: hashtag
  // ────────────────────────────────────────────────
  it('hashtag のみ指定で 200 { items, nextCursor } を返す', async () => {
    const posts = [makeMockPostWithMentions('post-1')]
    mockFetchPostsByHashtag.mockResolvedValue({ posts, nextCursor: undefined })
    mockAttachMentionedUsers.mockResolvedValue(posts)
    mockResolveBlockMuteStates.mockResolvedValue(
      new Map([['author-1', { isBlocked: false, isMuted: false }]]),
    )

    const req = await makeRequest(USER_ID, 'user@example.com', { hashtag: '松' })
    const { GET } = await import('@/app/api/v1/explore/posts/route')
    const res = await GET(req)

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toMatchObject({ items: expect.any(Array), nextCursor: null })
  })

  it('hashtag 指定で fetchPostsByHashtag が呼ばれる', async () => {
    const req = await makeRequest(USER_ID, 'user@example.com', { hashtag: '黒松' })
    const { GET } = await import('@/app/api/v1/explore/posts/route')
    await GET(req)

    expect(mockFetchPostsByHashtag).toHaveBeenCalled()
    expect(mockFetchPostsByGenre).not.toHaveBeenCalled()
  })

  // ────────────────────────────────────────────────
  // 正常系: genreId
  // ────────────────────────────────────────────────
  it('genreId のみ指定で 200 を返す', async () => {
    const req = await makeRequest(USER_ID, 'user@example.com', { genreId: 'genre-abc' })
    const { GET } = await import('@/app/api/v1/explore/posts/route')
    const res = await GET(req)

    expect(res.status).toBe(200)
  })

  it('genreId 指定で fetchPostsByGenre が呼ばれる', async () => {
    const req = await makeRequest(USER_ID, 'user@example.com', { genreId: 'genre-abc' })
    const { GET } = await import('@/app/api/v1/explore/posts/route')
    await GET(req)

    expect(mockFetchPostsByGenre).toHaveBeenCalled()
    expect(mockFetchPostsByHashtag).not.toHaveBeenCalled()
  })

  // ────────────────────────────────────────────────
  // 排他制約: 両方指定 / 両方なし → 400
  // ────────────────────────────────────────────────
  it('hashtag と genreId の両方を指定すると 400 VALIDATION_ERROR', async () => {
    const req = await makeRequest(USER_ID, 'user@example.com', {
      hashtag: '松',
      genreId: 'genre-1',
    })
    const { GET } = await import('@/app/api/v1/explore/posts/route')
    const res = await GET(req)

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error.code).toBe('VALIDATION_ERROR')
  })

  it('hashtag も genreId も指定しない場合 400 VALIDATION_ERROR', async () => {
    const req = await makeRequest(USER_ID, 'user@example.com', {})
    const { GET } = await import('@/app/api/v1/explore/posts/route')
    const res = await GET(req)

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error.code).toBe('VALIDATION_ERROR')
  })

  // ────────────────────────────────────────────────
  // ゲスト可
  // ────────────────────────────────────────────────
  it('ゲストメールアドレスでも 200 を返す（ゲスト可）', async () => {
    const req = await makeRequest('guest-id', GUEST_EMAIL, { hashtag: '松' })
    const { GET } = await import('@/app/api/v1/explore/posts/route')
    const res = await GET(req)

    expect(res.status).toBe(200)
  })

  // ────────────────────────────────────────────────
  // 認証エラー
  // ────────────────────────────────────────────────
  it('Bearer ヘッダーなしで 401 AUTH_REQUIRED', async () => {
    const req = new NextRequest('http://localhost/api/v1/explore/posts?hashtag=松')
    const { GET } = await import('@/app/api/v1/explore/posts/route')
    const res = await GET(req)

    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error.code).toBe('AUTH_REQUIRED')
  })

  it('不正なトークンで 401 AUTH_INVALID_TOKEN', async () => {
    const req = new NextRequest('http://localhost/api/v1/explore/posts?hashtag=松', {
      headers: { authorization: 'Bearer invalid.token' },
    })
    const { GET } = await import('@/app/api/v1/explore/posts/route')
    const res = await GET(req)

    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error.code).toBe('AUTH_INVALID_TOKEN')
  })

  it('停止アカウントで 403 ACCOUNT_SUSPENDED', async () => {
    const { signAccessToken } = await import('@/lib/api/v1/jwt')
    const token = await signAccessToken('susp-user')
    mockUserFindUnique.mockResolvedValueOnce({ id: 'susp-user', isSuspended: true, email: 'u@example.com' })

    const req = new NextRequest('http://localhost/api/v1/explore/posts?hashtag=松', {
      headers: { authorization: `Bearer ${token}` },
    })
    const { GET } = await import('@/app/api/v1/explore/posts/route')
    const res = await GET(req)

    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error.code).toBe('ACCOUNT_SUSPENDED')
  })

  // ────────────────────────────────────────────────
  // レート制限
  // ────────────────────────────────────────────────
  it('レート制限超過で 429 RATE_LIMITED + Retry-After ヘッダー', async () => {
    mockCheckUserRateLimit.mockResolvedValue({
      success: false,
      remaining: 0,
      resetTime: Date.now() + 30000,
    })

    const req = await makeRequest(USER_ID, 'user@example.com', { hashtag: '松' })
    const { GET } = await import('@/app/api/v1/explore/posts/route')
    const res = await GET(req)

    expect(res.status).toBe(429)
    expect(res.headers.get('Retry-After')).not.toBeNull()
    const body = await res.json()
    expect(body.error.code).toBe('RATE_LIMITED')
  })

  // ────────────────────────────────────────────────
  // クエリパラメータ検証
  // ────────────────────────────────────────────────
  it('limit=0 は 400 VALIDATION_ERROR', async () => {
    const req = await makeRequest(USER_ID, 'user@example.com', { hashtag: '松', limit: '0' })
    const { GET } = await import('@/app/api/v1/explore/posts/route')
    const res = await GET(req)

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error.code).toBe('VALIDATION_ERROR')
  })

  it('limit=101 は 400 VALIDATION_ERROR（上限 100 を超える）', async () => {
    const req = await makeRequest(USER_ID, 'user@example.com', { hashtag: '松', limit: '101' })
    const { GET } = await import('@/app/api/v1/explore/posts/route')
    const res = await GET(req)

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error.code).toBe('VALIDATION_ERROR')
  })

  it('cursor/limit が service に渡される', async () => {
    const req = await makeRequest(USER_ID, 'user@example.com', {
      hashtag: '松',
      cursor: 'cur-abc',
      limit: '5',
    })
    const { GET } = await import('@/app/api/v1/explore/posts/route')
    await GET(req)

    expect(mockFetchPostsByHashtag).toHaveBeenCalledWith('松', USER_ID, 'cur-abc', 5)
  })

  // ────────────────────────────────────────────────
  // isBlocked/isMuted 付与
  // ────────────────────────────────────────────────
  it('isBlocked/isMuted がレスポンスの user に付与される', async () => {
    const post = makeMockPostWithMentions('post-block-1')
    mockFetchPostsByHashtag.mockResolvedValue({ posts: [post], nextCursor: undefined })
    mockAttachMentionedUsers.mockResolvedValue([post])
    mockResolveBlockMuteStates.mockResolvedValue(
      new Map([['author-1', { isBlocked: true, isMuted: false }]]),
    )

    const req = await makeRequest(USER_ID, 'user@example.com', { hashtag: '松' })
    const { GET } = await import('@/app/api/v1/explore/posts/route')
    const res = await GET(req)

    const body = await res.json()
    expect(body.items[0]?.user).toMatchObject({ isBlocked: true, isMuted: false })
  })

  // ────────────────────────────────────────────────
  // nextCursor
  // ────────────────────────────────────────────────
  it('service が nextCursor を返すとレスポンスに含まれる', async () => {
    mockFetchPostsByHashtag.mockResolvedValue({
      posts: [makeMockPostWithMentions('post-1')],
      nextCursor: 'next-cursor-xyz',
    })
    mockAttachMentionedUsers.mockResolvedValue([makeMockPostWithMentions('post-1')])

    const req = await makeRequest(USER_ID, 'user@example.com', { hashtag: '松' })
    const { GET } = await import('@/app/api/v1/explore/posts/route')
    const res = await GET(req)

    const body = await res.json()
    expect(body.nextCursor).toBe('next-cursor-xyz')
  })

  it('service が nextCursor = undefined のとき null で返す', async () => {
    mockFetchPostsByHashtag.mockResolvedValue({ posts: [], nextCursor: undefined })

    const req = await makeRequest(USER_ID, 'user@example.com', { hashtag: '松' })
    const { GET } = await import('@/app/api/v1/explore/posts/route')
    const res = await GET(req)

    const body = await res.json()
    expect(body.nextCursor).toBeNull()
  })

  // ────────────────────────────────────────────────
  // エラーレスポンス形式
  // ────────────────────────────────────────────────
  it('エラーレスポンスが { error: { code, message, status } } 形式', async () => {
    const req = new NextRequest('http://localhost/api/v1/explore/posts?hashtag=松')
    const { GET } = await import('@/app/api/v1/explore/posts/route')
    const res = await GET(req)

    const body = await res.json()
    expect(body.error).toMatchObject({
      code: expect.any(String),
      message: expect.any(String),
      status: expect.any(Number),
    })
  })
})
