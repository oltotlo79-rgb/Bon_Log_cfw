// @vitest-environment node
/**
 * POST /api/v1/posts/[id]/quote — 引用投稿作成
 *
 * 201 / 400 / 401 / 403 / 404 / 429 / 500 の全分岐を検証する。
 * 空コンテンツ・日次上限・引用元不可視・ゲスト拒否を網羅する。
 */
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'

const VALID_SECRET = 'a'.repeat(64)
const GUEST_EMAIL = 'guest@example.com'

const mockUserFindUnique = vi.fn()
vi.mock('@/lib/db', () => ({
  prisma: {
    user: {
      findUnique: (...args: unknown[]) => mockUserFindUnique(...args),
    },
  },
}))

const mockCheckUserRateLimit = vi.fn()
vi.mock('@/lib/rate-limit', () => ({
  checkUserRateLimit: (...args: unknown[]) => mockCheckUserRateLimit(...args),
}))

const mockCreateQuoteV1 = vi.fn()
const mockFetchCreatedPost = vi.fn()
vi.mock('@/lib/services/post-write-service', () => ({
  createQuoteV1Schema: {
    safeParse: (data: unknown) => {
      const d = data as Record<string, unknown>
      if (typeof d !== 'object' || d === null) return { success: false, error: { issues: [{ message: 'Invalid input' }] } }
      return {
        success: true,
        data: {
          content: d['content'] ?? '',
          genreIds: d['genreIds'] ?? [],
          mediaUrls: d['mediaUrls'] ?? [],
          mediaTypes: d['mediaTypes'] ?? [],
        },
      }
    },
  },
  createQuoteV1: (...args: unknown[]) => mockCreateQuoteV1(...args),
  fetchCreatedPost: (...args: unknown[]) => mockFetchCreatedPost(...args),
}))

const mockAttachMentionedUsersToOne = vi.fn()
vi.mock('@/lib/api/v1/mention-resolver', () => ({
  attachMentionedUsersToOne: (...args: unknown[]) => mockAttachMentionedUsersToOne(...args),
}))

const mockResolveBlockMuteStateForOne = vi.fn()
vi.mock('@/lib/api/v1/follow-state-resolver', () => ({
  resolveBlockMuteStateForOne: (...args: unknown[]) => mockResolveBlockMuteStateForOne(...args),
  resolveBlockMuteStates: vi.fn().mockResolvedValue(new Map()),
}))

const VALID_QUOTE_TARGET_ID = 'cjld2cjxh0000qzrmn831i7rn'
const CREATED_POST_ID = 'cjld2cjxh0001qzrmn831i7rn'
const AUTHOR_ID = 'cjld2cjxh0002qzrmn831i7rn'

const mockCreatedPost = {
  id: CREATED_POST_ID,
  content: '引用コメント',
  userId: AUTHOR_ID,
  createdAt: new Date().toISOString(),
  likeCount: 0,
  commentCount: 0,
  user: { id: AUTHOR_ID, nickname: 'テストユーザー', avatarUrl: null },
  genres: [],
  media: [],
  quotePost: { id: VALID_QUOTE_TARGET_ID, content: '引用元投稿' },
}

async function makeAuthenticatedRequest(
  userId: string,
  email: string,
  quotePostId = VALID_QUOTE_TARGET_ID,
  body: unknown = { content: '引用コメント', genreIds: [], mediaUrls: [], mediaTypes: [] },
): Promise<[NextRequest, { params: Promise<{ id: string }> }]> {
  const { signAccessToken } = await import('@/lib/api/v1/jwt')
  const token = await signAccessToken(userId)
  mockUserFindUnique.mockResolvedValueOnce({ id: userId, isSuspended: false, email })
  const req = new NextRequest(`http://localhost/api/v1/posts/${quotePostId}/quote`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
  })
  return [req, { params: Promise.resolve({ id: quotePostId }) }]
}

describe('POST /api/v1/posts/[id]/quote', () => {
  beforeEach(() => {
    vi.stubEnv('MOBILE_JWT_SECRET', VALID_SECRET)
    vi.clearAllMocks()
    mockCheckUserRateLimit.mockResolvedValue({ success: true, remaining: 3, resetTime: Date.now() + 60000 })
    mockCreateQuoteV1.mockResolvedValue({ ok: true, postId: CREATED_POST_ID })
    mockFetchCreatedPost.mockResolvedValue({ found: true, post: mockCreatedPost })
    mockAttachMentionedUsersToOne.mockResolvedValue({ ...mockCreatedPost, mentionedUsers: [] })
    mockResolveBlockMuteStateForOne.mockResolvedValue({ isBlocked: false, isMuted: false })
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('正常系: 201 と引用投稿レスポンスを返す', async () => {
    const [req, params] = await makeAuthenticatedRequest(AUTHOR_ID, 'author@example.com')
    const { POST } = await import('@/app/api/v1/posts/[id]/quote/route')
    const res = await POST(req, params)

    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.id).toBe(CREATED_POST_ID)
  })

  it('createQuoteV1 に quotePostId と input と userId が渡される', async () => {
    const [req, params] = await makeAuthenticatedRequest(AUTHOR_ID, 'author@example.com')
    const { POST } = await import('@/app/api/v1/posts/[id]/quote/route')
    await POST(req, params)

    expect(mockCreateQuoteV1).toHaveBeenCalledWith(
      VALID_QUOTE_TARGET_ID,
      expect.objectContaining({ content: '引用コメント' }),
      AUTHOR_ID,
    )
  })

  it('引用元投稿が不可視（404 from service）→ 404 NOT_FOUND', async () => {
    mockCreateQuoteV1.mockResolvedValueOnce({ ok: false, error: '投稿が見つかりません', status: 404 })
    const [req, params] = await makeAuthenticatedRequest(AUTHOR_ID, 'author@example.com')
    const { POST } = await import('@/app/api/v1/posts/[id]/quote/route')
    const res = await POST(req, params)

    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.error.code).toBe('NOT_FOUND')
  })

  it('空コンテンツ（400 from service）→ 400 VALIDATION_ERROR', async () => {
    mockCreateQuoteV1.mockResolvedValueOnce({ ok: false, error: '引用コメントを入力してください', status: 400 })
    const [req, params] = await makeAuthenticatedRequest(AUTHOR_ID, 'author@example.com')
    const { POST } = await import('@/app/api/v1/posts/[id]/quote/route')
    const res = await POST(req, params)

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error.code).toBe('VALIDATION_ERROR')
  })

  it('日次上限超過（429 from service）→ 429 RATE_LIMITED', async () => {
    mockCreateQuoteV1.mockResolvedValueOnce({ ok: false, error: '1日の投稿上限に達しました', status: 429 })
    const [req, params] = await makeAuthenticatedRequest(AUTHOR_ID, 'author@example.com')
    const { POST } = await import('@/app/api/v1/posts/[id]/quote/route')
    const res = await POST(req, params)

    expect(res.status).toBe(429)
    const body = await res.json()
    expect(body.error.code).toBe('RATE_LIMITED')
  })

  it('fetchCreatedPost が found:false → 500 INTERNAL_ERROR', async () => {
    mockFetchCreatedPost.mockResolvedValueOnce({ found: false })
    const [req, params] = await makeAuthenticatedRequest(AUTHOR_ID, 'author@example.com')
    const { POST } = await import('@/app/api/v1/posts/[id]/quote/route')
    const res = await POST(req, params)

    expect(res.status).toBe(500)
  })

  it('Bearer ヘッダーなしで 401 AUTH_REQUIRED', async () => {
    const req = new NextRequest(`http://localhost/api/v1/posts/${VALID_QUOTE_TARGET_ID}/quote`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ content: 'test', genreIds: [], mediaUrls: [], mediaTypes: [] }),
    })
    const { POST } = await import('@/app/api/v1/posts/[id]/quote/route')
    const res = await POST(req, { params: Promise.resolve({ id: VALID_QUOTE_TARGET_ID }) })

    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error.code).toBe('AUTH_REQUIRED')
  })

  it('ゲストユーザーで 403 GUEST_NOT_ALLOWED', async () => {
    const [req, params] = await makeAuthenticatedRequest('guest-id', GUEST_EMAIL)
    const { POST } = await import('@/app/api/v1/posts/[id]/quote/route')
    const res = await POST(req, params)

    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error.code).toBe('GUEST_NOT_ALLOWED')
  })

  it('停止アカウントで 403 ACCOUNT_SUSPENDED', async () => {
    const { signAccessToken } = await import('@/lib/api/v1/jwt')
    const token = await signAccessToken('susp-user')
    mockUserFindUnique.mockResolvedValueOnce({ id: 'susp-user', isSuspended: true, email: 'susp@example.com' })
    const req = new NextRequest(`http://localhost/api/v1/posts/${VALID_QUOTE_TARGET_ID}/quote`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${token}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ content: 'test', genreIds: [], mediaUrls: [], mediaTypes: [] }),
    })
    const { POST } = await import('@/app/api/v1/posts/[id]/quote/route')
    const res = await POST(req, { params: Promise.resolve({ id: VALID_QUOTE_TARGET_ID }) })

    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error.code).toBe('ACCOUNT_SUSPENDED')
  })

  it('不正な quotePostId（31文字超）で 400 VALIDATION_ERROR', async () => {
    const invalidId = 'a'.repeat(31)
    const [req, params] = await makeAuthenticatedRequest(AUTHOR_ID, 'author@example.com', invalidId)
    const { POST } = await import('@/app/api/v1/posts/[id]/quote/route')
    const res = await POST(req, params)

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error.code).toBe('VALIDATION_ERROR')
  })

  it('JSON パース失敗 → 400 VALIDATION_ERROR', async () => {
    const { signAccessToken } = await import('@/lib/api/v1/jwt')
    const token = await signAccessToken(AUTHOR_ID)
    mockUserFindUnique.mockResolvedValueOnce({ id: AUTHOR_ID, isSuspended: false, email: 'author@example.com' })
    const req = new NextRequest(`http://localhost/api/v1/posts/${VALID_QUOTE_TARGET_ID}/quote`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${token}`,
        'content-type': 'application/json',
      },
      body: 'invalid-json{',
    })
    const { POST } = await import('@/app/api/v1/posts/[id]/quote/route')
    const res = await POST(req, { params: Promise.resolve({ id: VALID_QUOTE_TARGET_ID }) })

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error.code).toBe('VALIDATION_ERROR')
  })

  it('レート制限超過で 429 RATE_LIMITED + Retry-After ヘッダー', async () => {
    mockCheckUserRateLimit.mockResolvedValueOnce({
      success: false,
      remaining: 0,
      resetTime: Date.now() + 60000,
    })
    const [req, params] = await makeAuthenticatedRequest(AUTHOR_ID, 'author@example.com')
    const { POST } = await import('@/app/api/v1/posts/[id]/quote/route')
    const res = await POST(req, params)

    expect(res.status).toBe(429)
    expect(res.headers.get('Retry-After')).not.toBeNull()
    const body = await res.json()
    expect(body.error.code).toBe('RATE_LIMITED')
  })

  it('レスポンスに mentionedUsers フィールドが含まれる', async () => {
    const [req, params] = await makeAuthenticatedRequest(AUTHOR_ID, 'author@example.com')
    const { POST } = await import('@/app/api/v1/posts/[id]/quote/route')
    const res = await POST(req, params)

    const body = await res.json()
    expect('mentionedUsers' in body).toBe(true)
  })
})
