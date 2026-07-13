// @vitest-environment node
/**
 * GET /api/v1/posts/[id] のユニットテスト
 *
 * 200 / 404 / 401 / 429 の全分岐を検証する。
 * 不可視・不存在投稿は 404 NOT_FOUND（情報漏えい防止）。
 * isBlocked / isMuted フィールドの付与も検証する。
 */
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'

const VALID_SECRET = 'a'.repeat(64)

const mockUserFindUnique = vi.fn()
const mockBlockFindUnique = vi.fn()
const mockMuteFindUnique = vi.fn()
vi.mock('@/lib/db', () => ({
  prisma: {
    user: {
      findUnique: (...args: unknown[]) => mockUserFindUnique(...args),
    },
    block: {
      findUnique: (...args: unknown[]) => mockBlockFindUnique(...args),
    },
    mute: {
      findUnique: (...args: unknown[]) => mockMuteFindUnique(...args),
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

const mockFetchPostDetail = vi.fn()
vi.mock('@/lib/services/post-read-service', () => ({
  fetchPostDetail: (...args: unknown[]) => mockFetchPostDetail(...args),
}))

async function makeAuthenticatedRequest(userId: string, postId = 'post-abc'): Promise<[NextRequest, { params: Promise<{ id: string }> }]> {
  const { signAccessToken } = await import('@/lib/api/v1/jwt')
  const token = await signAccessToken(userId)
  const req = new NextRequest(`http://localhost/api/v1/posts/${postId}`, {
    headers: { authorization: `Bearer ${token}` },
  })
  return [req, { params: Promise.resolve({ id: postId }) }]
}

const POST_AUTHOR_ID = 'author-user-post'

const mockPostDetail = {
  id: 'post-abc',
  content: 'test post',
  userId: POST_AUTHOR_ID,
  bonsaiId: null,
  createdAt: new Date().toISOString(),
  likeCount: 0,
  commentCount: 0,
  repostCount: 0,
  genres: [],
  isLiked: false,
  isBookmarked: false,
  user: { id: POST_AUTHOR_ID, nickname: 'PostAuthor', avatarUrl: null },
}

describe('GET /api/v1/posts/[id]', () => {
  beforeEach(() => {
    vi.stubEnv('MOBILE_JWT_SECRET', VALID_SECRET)
    vi.clearAllMocks()
    mockUserFindUnique.mockResolvedValue({ id: 'user-1', isSuspended: false, email: 'u@example.com' })
    mockCheckUserRateLimit.mockResolvedValue({ success: true, remaining: 59, resetTime: Date.now() + 60000 })
    mockFetchPostDetail.mockResolvedValue({ found: true, post: mockPostDetail })
    mockBlockFindUnique.mockResolvedValue(null)
    mockMuteFindUnique.mockResolvedValue(null)
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('有効なトークンと存在する投稿で 200 と投稿詳細を返す', async () => {
    const [req, params] = await makeAuthenticatedRequest('user-1')
    const { GET } = await import('@/app/api/v1/posts/[id]/route')
    const res = await GET(req, params)

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.id).toBe('post-abc')
    expect(body.content).toBe('test post')
  })

  it('レスポンス JSON に bonsaiId が含まれる', async () => {
    mockFetchPostDetail.mockResolvedValueOnce({
      found: true,
      post: { ...mockPostDetail, bonsaiId: 'bonsai-1' },
    })
    const [req, params] = await makeAuthenticatedRequest('user-1')
    const { GET } = await import('@/app/api/v1/posts/[id]/route')
    const res = await GET(req, params)

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.bonsaiId).toBe('bonsai-1')
  })

  it('fetchPostDetail に userId と postId が渡される', async () => {
    const [req, params] = await makeAuthenticatedRequest('user-1', 'post-xyz')
    const { GET } = await import('@/app/api/v1/posts/[id]/route')
    await GET(req, params)

    expect(mockFetchPostDetail).toHaveBeenCalledWith('post-xyz', 'user-1')
  })

  it('投稿が見つからない場合（found: false）で 404 NOT_FOUND', async () => {
    mockFetchPostDetail.mockResolvedValueOnce({ found: false })
    const [req, params] = await makeAuthenticatedRequest('user-1')
    const { GET } = await import('@/app/api/v1/posts/[id]/route')
    const res = await GET(req, params)

    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.error.code).toBe('NOT_FOUND')
  })

  it('非公開/ブロック関係で not found でも 404 を返す（情報漏えい防止）', async () => {
    mockFetchPostDetail.mockResolvedValueOnce({ found: false })
    const [req, params] = await makeAuthenticatedRequest('other-user')
    const { GET } = await import('@/app/api/v1/posts/[id]/route')
    const res = await GET(req, params)

    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.error.code).toBe('NOT_FOUND')
  })

  it('Bearer ヘッダーなしで 401 AUTH_REQUIRED', async () => {
    const req = new NextRequest('http://localhost/api/v1/posts/post-abc')
    const { GET } = await import('@/app/api/v1/posts/[id]/route')
    const res = await GET(req, { params: Promise.resolve({ id: 'post-abc' }) })

    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error.code).toBe('AUTH_REQUIRED')
  })

  it('不正なトークンで 401 AUTH_INVALID_TOKEN', async () => {
    const req = new NextRequest('http://localhost/api/v1/posts/post-abc', {
      headers: { authorization: 'Bearer invalid.token' },
    })
    const { GET } = await import('@/app/api/v1/posts/[id]/route')
    const res = await GET(req, { params: Promise.resolve({ id: 'post-abc' }) })

    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error.code).toBe('AUTH_INVALID_TOKEN')
  })

  it('停止アカウントで 403 ACCOUNT_SUSPENDED', async () => {
    mockUserFindUnique.mockResolvedValueOnce({ id: 'user-1', isSuspended: true, email: 'u@example.com' })
    const [req, params] = await makeAuthenticatedRequest('user-1')
    const { GET } = await import('@/app/api/v1/posts/[id]/route')
    const res = await GET(req, params)

    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error.code).toBe('ACCOUNT_SUSPENDED')
  })

  it('レート制限超過で 429 RATE_LIMITED + Retry-After ヘッダー', async () => {
    mockCheckUserRateLimit.mockResolvedValueOnce({
      success: false,
      remaining: 0,
      resetTime: Date.now() + 30000,
    })
    const [req, params] = await makeAuthenticatedRequest('user-1')
    const { GET } = await import('@/app/api/v1/posts/[id]/route')
    const res = await GET(req, params)

    expect(res.status).toBe(429)
    expect(res.headers.get('Retry-After')).not.toBeNull()
    const body = await res.json()
    expect(body.error.code).toBe('RATE_LIMITED')
  })

  it('エラーレスポンス形式が { error: { code, message, status } } であること', async () => {
    mockFetchPostDetail.mockResolvedValueOnce({ found: false })
    const [req, params] = await makeAuthenticatedRequest('user-1')
    const { GET } = await import('@/app/api/v1/posts/[id]/route')
    const res = await GET(req, params)

    const body = await res.json()
    expect(body.error).toMatchObject({
      code: expect.any(String),
      message: expect.any(String),
      status: expect.any(Number),
    })
  })
})

describe('GET /api/v1/posts/[id] — isBlocked/isMuted フィールド', () => {
  beforeEach(() => {
    vi.stubEnv('MOBILE_JWT_SECRET', VALID_SECRET)
    vi.clearAllMocks()
    mockUserFindUnique.mockResolvedValue({ id: 'user-1', isSuspended: false, email: 'u@example.com' })
    mockCheckUserRateLimit.mockResolvedValue({ success: true, remaining: 59, resetTime: Date.now() + 60000 })
    mockFetchPostDetail.mockResolvedValue({ found: true, post: mockPostDetail })
    mockBlockFindUnique.mockResolvedValue(null)
    mockMuteFindUnique.mockResolvedValue(null)
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('レスポンスの user に isBlocked/isMuted フィールドが含まれる', async () => {
    const [req, params] = await makeAuthenticatedRequest('user-1')
    const { GET } = await import('@/app/api/v1/posts/[id]/route')
    const res = await GET(req, params)

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.user).toBeDefined()
    expect(Object.prototype.hasOwnProperty.call(body.user, 'isBlocked')).toBe(true)
    expect(Object.prototype.hasOwnProperty.call(body.user, 'isMuted')).toBe(true)
  })

  it('未ブロック・未ミュート時は user.isBlocked:false / isMuted:false', async () => {
    const [req, params] = await makeAuthenticatedRequest('user-1')
    const { GET } = await import('@/app/api/v1/posts/[id]/route')
    const res = await GET(req, params)

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.user.isBlocked).toBe(false)
    expect(body.user.isMuted).toBe(false)
  })

  it('著者 id が block テーブルにある場合 user.isBlocked:true', async () => {
    mockBlockFindUnique.mockResolvedValueOnce({ blockerId: 'user-1' })
    const [req, params] = await makeAuthenticatedRequest('user-1')
    const { GET } = await import('@/app/api/v1/posts/[id]/route')
    const res = await GET(req, params)

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.user.isBlocked).toBe(true)
    expect(body.user.isMuted).toBe(false)
  })

  it('著者 id が mute テーブルにある場合 user.isMuted:true', async () => {
    mockMuteFindUnique.mockResolvedValueOnce({ muterId: 'user-1' })
    const [req, params] = await makeAuthenticatedRequest('user-1')
    const { GET } = await import('@/app/api/v1/posts/[id]/route')
    const res = await GET(req, params)

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.user.isBlocked).toBe(false)
    expect(body.user.isMuted).toBe(true)
  })

  it('DB エラー時は fail-open で user.isBlocked:false / isMuted:false になる', async () => {
    mockBlockFindUnique.mockRejectedValueOnce(new Error('DB connection error'))
    const [req, params] = await makeAuthenticatedRequest('user-1')
    const { GET } = await import('@/app/api/v1/posts/[id]/route')
    const res = await GET(req, params)

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.user.isBlocked).toBe(false)
    expect(body.user.isMuted).toBe(false)
  })

  it('quotePost/repostPost のネスト著者には isBlocked/isMuted が付かない', async () => {
    const NESTED_AUTHOR_ID = 'nested-author-id'
    mockFetchPostDetail.mockResolvedValueOnce({
      found: true,
      post: {
        ...mockPostDetail,
        quotePost: { id: 'q1', content: 'quoted', user: { id: NESTED_AUTHOR_ID, nickname: 'N', avatarUrl: null } },
        repostPost: null,
      },
    })
    mockBlockFindUnique.mockResolvedValueOnce({ blockerId: 'user-1' })
    const [req, params] = await makeAuthenticatedRequest('user-1')
    const { GET } = await import('@/app/api/v1/posts/[id]/route')
    const res = await GET(req, params)

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.user.isBlocked).toBe(true)
    expect(body.quotePost?.user?.isBlocked).toBeUndefined()
    expect(body.quotePost?.user?.isMuted).toBeUndefined()
  })
})
