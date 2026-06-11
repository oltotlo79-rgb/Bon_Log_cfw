/**
 * /api/analytics/view route の回帰テスト (P0-2)。
 *
 *  - 未認証は 401
 *  - 不正 body は 400
 *  - 自分自身の view は 204 で記録しない
 *  - ブロックされた閲覧者は 204 で記録しない
 *  - 正常系では recordPostView / recordProfileView が呼ばれる
 *  - dedupe TTL 中の連続呼び出しでは記録しない
 */
// @vitest-environment node

import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockAuth = vi.fn()
const mockBlockFindUnique = vi.fn()
const mockPostFindUnique = vi.fn()
const mockUserFindUnique = vi.fn()
const mockFollowFindUnique = vi.fn()
const mockRecordPostView = vi.fn().mockResolvedValue(undefined)
const mockRecordProfileView = vi.fn().mockResolvedValue(undefined)
const mockRateLimit = vi.fn().mockResolvedValue({ success: true, remaining: 30, resetTime: 0 })
const mockRedisGet = vi.fn().mockResolvedValue(null)
const mockRedisSet = vi.fn().mockResolvedValue(undefined)

vi.mock('@/lib/auth', () => ({ auth: (...args: unknown[]) => mockAuth(...args) }))

vi.mock('@/lib/db', () => ({
  prisma: {
    block: { findUnique: (...args: unknown[]) => mockBlockFindUnique(...args) },
    post: { findUnique: (...args: unknown[]) => mockPostFindUnique(...args) },
    user: { findUnique: (...args: unknown[]) => mockUserFindUnique(...args) },
    follow: { findUnique: (...args: unknown[]) => mockFollowFindUnique(...args) },
  },
}))

vi.mock('@/lib/services/analytics-recording', () => ({
  recordPostViewService: (...args: unknown[]) => mockRecordPostView(...args),
  recordProfileViewService: (...args: unknown[]) => mockRecordProfileView(...args),
}))

vi.mock('@/lib/rate-limit', () => ({
  rateLimit: (...args: unknown[]) => mockRateLimit(...args),
}))

vi.mock('@/lib/redis', () => ({
  redis: {
    client: {
      get: (...args: unknown[]) => mockRedisGet(...args),
      set: (...args: unknown[]) => mockRedisSet(...args),
    },
  },
}))

function makeRequest(body: unknown): import('next/server').NextRequest {
  return new Request('http://localhost/api/analytics/view', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  }) as never
}

describe('POST /api/analytics/view', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockRateLimit.mockResolvedValue({ success: true, remaining: 30, resetTime: 0 })
    mockRedisGet.mockResolvedValue(null)
  })

  it('未認証は 401', async () => {
    mockAuth.mockResolvedValue(null)
    const { POST } = await import('@/app/api/analytics/view/route')
    const res = await POST(makeRequest({ type: 'profile', targetUserId: 'u1' }))
    expect(res.status).toBe(401)
  })

  it('不正 JSON は 400', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'viewer' } })
    const { POST } = await import('@/app/api/analytics/view/route')
    const req = new Request('http://localhost/api/analytics/view', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{not json',
    }) as never
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it('schema 不一致は 400 で record されない', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'viewer' } })
    const { POST } = await import('@/app/api/analytics/view/route')
    const res = await POST(makeRequest({ type: 'unknown' }))
    expect(res.status).toBe(400)
    expect(mockRecordPostView).not.toHaveBeenCalled()
    expect(mockRecordProfileView).not.toHaveBeenCalled()
  })

  it('自分自身の view は 204 で record されない', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'self' } })
    const { POST } = await import('@/app/api/analytics/view/route')
    const res = await POST(makeRequest({ type: 'profile', targetUserId: 'self' }))
    expect(res.status).toBe(204)
    expect(mockRecordProfileView).not.toHaveBeenCalled()
  })

  it('ブロックされた閲覧者は record されない', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'viewer' } })
    mockBlockFindUnique.mockResolvedValue({ blockerId: 'target' })
    const { POST } = await import('@/app/api/analytics/view/route')
    const res = await POST(makeRequest({ type: 'profile', targetUserId: 'target' }))
    expect(res.status).toBe(204)
    expect(mockRecordProfileView).not.toHaveBeenCalled()
  })

  it('正常系: profile view を記録する', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'viewer' } })
    mockBlockFindUnique.mockResolvedValue(null)
    mockUserFindUnique.mockResolvedValue({ isPublic: true, isSuspended: false })
    const { POST } = await import('@/app/api/analytics/view/route')
    const res = await POST(makeRequest({ type: 'profile', targetUserId: 'target' }))
    expect(res.status).toBe(204)
    expect(mockRecordProfileView).toHaveBeenCalledWith('target')
  })

  it('dedupe key がヒットしたら record しない', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'viewer' } })
    mockBlockFindUnique.mockResolvedValue(null)
    mockUserFindUnique.mockResolvedValue({ isPublic: true, isSuspended: false })
    mockRedisGet.mockResolvedValue('1')
    const { POST } = await import('@/app/api/analytics/view/route')
    const res = await POST(makeRequest({ type: 'profile', targetUserId: 'target' }))
    expect(res.status).toBe(204)
    expect(mockRecordProfileView).not.toHaveBeenCalled()
  })

  it('post view は post.userId と targetUserId の一致を要求', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'viewer' } })
    mockBlockFindUnique.mockResolvedValue(null)
    mockPostFindUnique.mockResolvedValue({ isHidden: false, userId: 'authorA' })
    const { POST } = await import('@/app/api/analytics/view/route')
    // spoofing: postId は authorA の投稿だが targetUserId は authorB
    const res = await POST(
      makeRequest({ type: 'post', postId: 'p1', targetUserId: 'authorB' }),
    )
    expect(res.status).toBe(204)
    expect(mockRecordPostView).not.toHaveBeenCalled()
  })

  it('正常系: post view を記録する（公開著者）', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'viewer' } })
    mockBlockFindUnique.mockResolvedValue(null)
    mockPostFindUnique.mockResolvedValue({ isHidden: false, userId: 'author' })
    mockUserFindUnique.mockResolvedValue({ isPublic: true, isSuspended: false })
    const { POST } = await import('@/app/api/analytics/view/route')
    const res = await POST(
      makeRequest({ type: 'post', postId: 'p1', targetUserId: 'author' }),
    )
    expect(res.status).toBe(204)
    expect(mockRecordPostView).toHaveBeenCalledWith('author')
  })

  it('非公開著者・未フォローの post view は記録しない（M-2）', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'viewer' } })
    mockBlockFindUnique.mockResolvedValue(null)
    mockPostFindUnique.mockResolvedValue({ isHidden: false, userId: 'author' })
    mockUserFindUnique.mockResolvedValue({ isPublic: false, isSuspended: false })
    mockFollowFindUnique.mockResolvedValue(null)
    const { POST } = await import('@/app/api/analytics/view/route')
    const res = await POST(
      makeRequest({ type: 'post', postId: 'p1', targetUserId: 'author' }),
    )
    expect(res.status).toBe(204)
    expect(mockRecordPostView).not.toHaveBeenCalled()
  })

  it('停止著者の post view は記録しない（M-2）', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'viewer' } })
    mockBlockFindUnique.mockResolvedValue(null)
    mockPostFindUnique.mockResolvedValue({ isHidden: false, userId: 'author' })
    mockUserFindUnique.mockResolvedValue({ isPublic: true, isSuspended: true })
    const { POST } = await import('@/app/api/analytics/view/route')
    const res = await POST(
      makeRequest({ type: 'post', postId: 'p1', targetUserId: 'author' }),
    )
    expect(res.status).toBe(204)
    expect(mockRecordPostView).not.toHaveBeenCalled()
  })

  it('非公開著者でもフォロワーの post view は記録する（M-2）', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'viewer' } })
    mockBlockFindUnique.mockResolvedValue(null)
    mockPostFindUnique.mockResolvedValue({ isHidden: false, userId: 'author' })
    mockUserFindUnique.mockResolvedValue({ isPublic: false, isSuspended: false })
    mockFollowFindUnique.mockResolvedValue({ followerId: 'viewer' })
    const { POST } = await import('@/app/api/analytics/view/route')
    const res = await POST(
      makeRequest({ type: 'post', postId: 'p1', targetUserId: 'author' }),
    )
    expect(res.status).toBe(204)
    expect(mockRecordPostView).toHaveBeenCalledWith('author')
  })
})
