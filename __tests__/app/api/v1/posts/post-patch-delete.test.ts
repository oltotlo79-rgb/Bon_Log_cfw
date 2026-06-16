// @vitest-environment node
/**
 * PATCH /api/v1/posts/[id] および DELETE /api/v1/posts/[id] のユニットテスト
 *
 * 所有権（所有者のみ操作可）・404・400・429・R2 削除を検証する。
 * 不正な cuid 形式 ID は 400 VALIDATION_ERROR。
 */
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'

const VALID_SECRET = 'a'.repeat(64)
const GUEST_EMAIL = 'guest@example.com'
// cuid 形式の有効なポスト ID（a-z0-9, 1-30 chars）
const VALID_POST_ID = 'cjld2cyuq0000t3rmniod1foy'

// ──────────────────────────────────────────────────
// Mock: prisma
// ──────────────────────────────────────────────────
const mockUserFindUnique = vi.fn()
vi.mock('@/lib/db', () => ({
  prisma: {
    user: {
      findUnique: (...args: unknown[]) => mockUserFindUnique(...args),
    },
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
// Mock: post-write-service
// ──────────────────────────────────────────────────
const mockUpdatePostV1 = vi.fn()
const mockDeletePostV1 = vi.fn()
const mockFetchCreatedPost = vi.fn()

vi.mock('@/lib/services/post-write-service', () => ({
  updatePostV1Schema: {
    safeParse: (data: unknown) => {
      const d = data as Record<string, unknown>
      if (typeof d !== 'object' || d === null) return { success: false, error: {} }
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
  updatePostV1: (...args: unknown[]) => mockUpdatePostV1(...args),
  deletePostV1: (...args: unknown[]) => mockDeletePostV1(...args),
  fetchCreatedPost: (...args: unknown[]) => mockFetchCreatedPost(...args),
}))

// ──────────────────────────────────────────────────
// Mock: mention-resolver / follow-state-resolver
// ──────────────────────────────────────────────────
const mockAttachMentionedUsersToOne = vi.fn()
vi.mock('@/lib/api/v1/mention-resolver', () => ({
  attachMentionedUsersToOne: (...args: unknown[]) => mockAttachMentionedUsersToOne(...args),
}))

const mockResolveBlockMuteStateForOne = vi.fn()
vi.mock('@/lib/api/v1/follow-state-resolver', () => ({
  resolveBlockMuteStateForOne: (...args: unknown[]) => mockResolveBlockMuteStateForOne(...args),
  resolveBlockMuteStates: vi.fn().mockResolvedValue(new Map()),
}))

// ──────────────────────────────────────────────────
// Mock: post-read-service (GET は既存テストで検証済み)
// ──────────────────────────────────────────────────
vi.mock('@/lib/services/post-read-service', () => ({
  fetchPostDetail: vi.fn(),
}))

// ──────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────
const OWNER_ID = 'user-owner'

const mockUpdatedPost = {
  id: VALID_POST_ID,
  content: '更新後の内容',
  userId: OWNER_ID,
  createdAt: new Date().toISOString(),
  user: { id: OWNER_ID, nickname: 'Owner', avatarUrl: null },
  genres: [],
  media: [],
}

async function makeAuthenticatedPatchRequest(
  userId: string,
  email: string,
  postId: string,
  body: unknown,
): Promise<[NextRequest, { params: Promise<{ id: string }> }]> {
  const { signAccessToken } = await import('@/lib/api/v1/jwt')
  const token = await signAccessToken(userId)
  const req = new NextRequest(`http://localhost/api/v1/posts/${postId}`, {
    method: 'PATCH',
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
  })
  return [req, { params: Promise.resolve({ id: postId }) }]
}

async function makeAuthenticatedDeleteRequest(
  userId: string,
  email: string,
  postId: string,
): Promise<[NextRequest, { params: Promise<{ id: string }> }]> {
  const { signAccessToken } = await import('@/lib/api/v1/jwt')
  const token = await signAccessToken(userId)
  const req = new NextRequest(`http://localhost/api/v1/posts/${postId}`, {
    method: 'DELETE',
    headers: { authorization: `Bearer ${token}` },
  })
  return [req, { params: Promise.resolve({ id: postId }) }]
}

const validPatchBody = {
  content: '更新後の内容',
  genreIds: [],
  mediaUrls: [],
  mediaTypes: [],
}

// ──────────────────────────────────────────────────
// PATCH tests
// ──────────────────────────────────────────────────
describe('PATCH /api/v1/posts/[id]', () => {
  beforeEach(() => {
    vi.stubEnv('MOBILE_JWT_SECRET', VALID_SECRET)
    vi.clearAllMocks()
    mockUserFindUnique.mockResolvedValue({ id: OWNER_ID, isSuspended: false, email: 'owner@example.com' })
    mockCheckUserRateLimit.mockResolvedValue({ success: true, remaining: 29, resetTime: Date.now() + 60000 })
    mockUpdatePostV1.mockResolvedValue({ ok: true, postId: VALID_POST_ID })
    mockFetchCreatedPost.mockResolvedValue({ found: true, post: mockUpdatedPost })
    mockAttachMentionedUsersToOne.mockResolvedValue({ ...mockUpdatedPost, mentionedUsers: [] })
    mockResolveBlockMuteStateForOne.mockResolvedValue({ isBlocked: false, isMuted: false })
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('正常系: 200 + 更新済み投稿を返す', async () => {
    const [req, params] = await makeAuthenticatedPatchRequest(
      OWNER_ID, 'owner@example.com', VALID_POST_ID, validPatchBody,
    )
    const { PATCH } = await import('@/app/api/v1/posts/[id]/route')
    const res = await PATCH(req, params)

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.id).toBe(VALID_POST_ID)
  })

  it('所有者でないユーザー（updatePostV1 が 403）→ 403', async () => {
    mockUpdatePostV1.mockResolvedValue({ ok: false, error: '権限がありません', status: 403 })
    const [req, params] = await makeAuthenticatedPatchRequest(
      OWNER_ID, 'owner@example.com', VALID_POST_ID, validPatchBody,
    )
    const { PATCH } = await import('@/app/api/v1/posts/[id]/route')
    const res = await PATCH(req, params)

    // route は 403 status をそのまま apiError に渡す
    expect(res.status).toBe(403)
  })

  it('不存在投稿（updatePostV1 が 404）→ 404 NOT_FOUND', async () => {
    mockUpdatePostV1.mockResolvedValue({ ok: false, error: '投稿が見つかりません', status: 404 })
    const [req, params] = await makeAuthenticatedPatchRequest(
      OWNER_ID, 'owner@example.com', VALID_POST_ID, validPatchBody,
    )
    const { PATCH } = await import('@/app/api/v1/posts/[id]/route')
    const res = await PATCH(req, params)

    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.error.code).toBe('NOT_FOUND')
  })

  it('バリデーションエラー（updatePostV1 が 400）→ 400 VALIDATION_ERROR', async () => {
    mockUpdatePostV1.mockResolvedValue({ ok: false, error: '本文が長すぎます', status: 400 })
    const [req, params] = await makeAuthenticatedPatchRequest(
      OWNER_ID, 'owner@example.com', VALID_POST_ID, validPatchBody,
    )
    const { PATCH } = await import('@/app/api/v1/posts/[id]/route')
    const res = await PATCH(req, params)

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error.code).toBe('VALIDATION_ERROR')
  })

  it('不正な ID 形式（空文字）→ 400 VALIDATION_ERROR', async () => {
    const [req, params] = await makeAuthenticatedPatchRequest(
      OWNER_ID, 'owner@example.com', '', validPatchBody,
    )
    const { PATCH } = await import('@/app/api/v1/posts/[id]/route')
    const res = await PATCH(req, params)

    expect(res.status).toBe(400)
  })

  it('Bearer ヘッダーなし → 401', async () => {
    const req = new NextRequest(`http://localhost/api/v1/posts/${VALID_POST_ID}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(validPatchBody),
    })
    const { PATCH } = await import('@/app/api/v1/posts/[id]/route')
    const res = await PATCH(req, { params: Promise.resolve({ id: VALID_POST_ID }) })

    expect(res.status).toBe(401)
  })

  it('ゲストアカウント → 403 GUEST_NOT_ALLOWED', async () => {
    mockUserFindUnique.mockResolvedValue({ id: 'guest-user', isSuspended: false, email: GUEST_EMAIL })
    const { signAccessToken } = await import('@/lib/api/v1/jwt')
    const token = await signAccessToken('guest-user')
    const req = new NextRequest(`http://localhost/api/v1/posts/${VALID_POST_ID}`, {
      method: 'PATCH',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify(validPatchBody),
    })
    const { PATCH } = await import('@/app/api/v1/posts/[id]/route')
    const res = await PATCH(req, { params: Promise.resolve({ id: VALID_POST_ID }) })

    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error.code).toBe('GUEST_NOT_ALLOWED')
  })

  it('レート制限超過 → 429 + Retry-After ヘッダー', async () => {
    mockCheckUserRateLimit.mockResolvedValue({
      success: false,
      remaining: 0,
      resetTime: Date.now() + 30000,
    })
    const [req, params] = await makeAuthenticatedPatchRequest(
      OWNER_ID, 'owner@example.com', VALID_POST_ID, validPatchBody,
    )
    const { PATCH } = await import('@/app/api/v1/posts/[id]/route')
    const res = await PATCH(req, params)

    expect(res.status).toBe(429)
    expect(res.headers.get('Retry-After')).not.toBeNull()
  })

  it('JSON パース失敗 → 400 VALIDATION_ERROR', async () => {
    const { signAccessToken } = await import('@/lib/api/v1/jwt')
    const token = await signAccessToken(OWNER_ID)
    const req = new NextRequest(`http://localhost/api/v1/posts/${VALID_POST_ID}`, {
      method: 'PATCH',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: 'invalid-json{',
    })
    const { PATCH } = await import('@/app/api/v1/posts/[id]/route')
    const res = await PATCH(req, { params: Promise.resolve({ id: VALID_POST_ID }) })

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error.code).toBe('VALIDATION_ERROR')
  })
})

// ──────────────────────────────────────────────────
// DELETE tests
// ──────────────────────────────────────────────────
describe('DELETE /api/v1/posts/[id]', () => {
  beforeEach(() => {
    vi.stubEnv('MOBILE_JWT_SECRET', VALID_SECRET)
    vi.clearAllMocks()
    mockUserFindUnique.mockResolvedValue({ id: OWNER_ID, isSuspended: false, email: 'owner@example.com' })
    mockCheckUserRateLimit.mockResolvedValue({ success: true, remaining: 4, resetTime: Date.now() + 60000 })
    mockDeletePostV1.mockResolvedValue({ ok: true })
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('正常系: 200 + { success: true } を返す', async () => {
    const [req, params] = await makeAuthenticatedDeleteRequest(
      OWNER_ID, 'owner@example.com', VALID_POST_ID,
    )
    const { DELETE } = await import('@/app/api/v1/posts/[id]/route')
    const res = await DELETE(req, params)

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
  })

  it('所有者でないユーザー（deletePostV1 が 403）→ 403', async () => {
    mockDeletePostV1.mockResolvedValue({ ok: false, error: '権限がありません', status: 403 })
    const [req, params] = await makeAuthenticatedDeleteRequest(
      OWNER_ID, 'owner@example.com', VALID_POST_ID,
    )
    const { DELETE } = await import('@/app/api/v1/posts/[id]/route')
    const res = await DELETE(req, params)

    expect(res.status).toBe(403)
  })

  it('不存在投稿（deletePostV1 が 404）→ 404 NOT_FOUND', async () => {
    mockDeletePostV1.mockResolvedValue({ ok: false, error: '投稿が見つかりません', status: 404 })
    const [req, params] = await makeAuthenticatedDeleteRequest(
      OWNER_ID, 'owner@example.com', VALID_POST_ID,
    )
    const { DELETE } = await import('@/app/api/v1/posts/[id]/route')
    const res = await DELETE(req, params)

    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.error.code).toBe('NOT_FOUND')
  })

  it('deletePostV1 に正しい postId と userId が渡される', async () => {
    const [req, params] = await makeAuthenticatedDeleteRequest(
      OWNER_ID, 'owner@example.com', VALID_POST_ID,
    )
    const { DELETE } = await import('@/app/api/v1/posts/[id]/route')
    await DELETE(req, params)

    expect(mockDeletePostV1).toHaveBeenCalledWith(VALID_POST_ID, OWNER_ID)
  })

  it('Bearer ヘッダーなし → 401', async () => {
    const req = new NextRequest(`http://localhost/api/v1/posts/${VALID_POST_ID}`, {
      method: 'DELETE',
    })
    const { DELETE } = await import('@/app/api/v1/posts/[id]/route')
    const res = await DELETE(req, { params: Promise.resolve({ id: VALID_POST_ID }) })

    expect(res.status).toBe(401)
  })

  it('ゲストアカウント → 403 GUEST_NOT_ALLOWED', async () => {
    mockUserFindUnique.mockResolvedValue({ id: 'guest-user', isSuspended: false, email: GUEST_EMAIL })
    const { signAccessToken } = await import('@/lib/api/v1/jwt')
    const token = await signAccessToken('guest-user')
    const req = new NextRequest(`http://localhost/api/v1/posts/${VALID_POST_ID}`, {
      method: 'DELETE',
      headers: { authorization: `Bearer ${token}` },
    })
    const { DELETE } = await import('@/app/api/v1/posts/[id]/route')
    const res = await DELETE(req, { params: Promise.resolve({ id: VALID_POST_ID }) })

    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error.code).toBe('GUEST_NOT_ALLOWED')
  })

  it('レート制限超過 → 429 + Retry-After ヘッダー', async () => {
    mockCheckUserRateLimit.mockResolvedValue({
      success: false,
      remaining: 0,
      resetTime: Date.now() + 30000,
    })
    const [req, params] = await makeAuthenticatedDeleteRequest(
      OWNER_ID, 'owner@example.com', VALID_POST_ID,
    )
    const { DELETE } = await import('@/app/api/v1/posts/[id]/route')
    const res = await DELETE(req, params)

    expect(res.status).toBe(429)
    expect(res.headers.get('Retry-After')).not.toBeNull()
  })

  it('不正な ID 形式（空文字）→ 400 VALIDATION_ERROR', async () => {
    const [req, params] = await makeAuthenticatedDeleteRequest(
      OWNER_ID, 'owner@example.com', '',
    )
    const { DELETE } = await import('@/app/api/v1/posts/[id]/route')
    const res = await DELETE(req, params)

    expect(res.status).toBe(400)
  })
})
