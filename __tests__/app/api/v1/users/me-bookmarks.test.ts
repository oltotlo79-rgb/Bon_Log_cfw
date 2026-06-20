// @vitest-environment node
/**
 * GET /api/v1/users/me/bookmarks — ブックマーク投稿一覧（カーソルページネーション）
 *
 * 200 / 401 / 403 / 429 の全分岐・isBookmarked 保証・可視性フィルタ・
 * limit 上限・N+1 防止を検証する。
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

const mockFetchBookmarkedPosts = vi.fn()
vi.mock('@/lib/services/bookmark-service', () => ({
  fetchBookmarkedPosts: (...args: unknown[]) => mockFetchBookmarkedPosts(...args),
}))

const mockAttachMentionedUsers = vi.fn()
vi.mock('@/lib/api/v1/mention-resolver', () => ({
  attachMentionedUsers: (...args: unknown[]) => mockAttachMentionedUsers(...args),
}))

const mockResolveBlockMuteStates = vi.fn()
vi.mock('@/lib/api/v1/follow-state-resolver', () => ({
  resolveBlockMuteStates: (...args: unknown[]) => mockResolveBlockMuteStates(...args),
}))

const mockBookmarkedPosts = [
  {
    id: 'post-1',
    content: '盆栽の投稿1',
    isBookmarked: true,
    isLiked: false,
    user: { id: 'author-1', nickname: '著者1', avatarUrl: null },
  },
  {
    id: 'post-2',
    content: '盆栽の投稿2',
    isBookmarked: true,
    isLiked: true,
    user: { id: 'author-2', nickname: '著者2', avatarUrl: '/a.jpg' },
  },
]

async function makeAuthenticatedRequest(
  userId: string,
  email: string,
  searchParams = '',
): Promise<NextRequest> {
  const { signAccessToken } = await import('@/lib/api/v1/jwt')
  const token = await signAccessToken(userId)
  mockUserFindUnique.mockResolvedValueOnce({ id: userId, isSuspended: false, email })
  const url = `http://localhost/api/v1/users/me/bookmarks${searchParams ? `?${searchParams}` : ''}`
  return new NextRequest(url, {
    method: 'GET',
    headers: { authorization: `Bearer ${token}` },
  })
}

describe('GET /api/v1/users/me/bookmarks', () => {
  beforeEach(() => {
    vi.stubEnv('MOBILE_JWT_SECRET', VALID_SECRET)
    vi.clearAllMocks()
    mockCheckUserRateLimit.mockResolvedValue({ success: true, remaining: 59, resetTime: Date.now() + 60000 })
    mockFetchBookmarkedPosts.mockResolvedValue({
      items: mockBookmarkedPosts,
      nextCursor: null,
    })
    const postsWithMentions = mockBookmarkedPosts.map((p) => ({ ...p, mentionedUsers: [] }))
    mockAttachMentionedUsers.mockResolvedValue(postsWithMentions)
    mockResolveBlockMuteStates.mockResolvedValue(new Map([
      ['author-1', { isBlocked: false, isMuted: false }],
      ['author-2', { isBlocked: false, isMuted: false }],
    ]))
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('正常取得で 200 { items, nextCursor } を返す', async () => {
    const req = await makeAuthenticatedRequest('user-1', 'user@example.com')
    const { GET } = await import('@/app/api/v1/users/me/bookmarks/route')
    const res = await GET(req)

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.items).toHaveLength(2)
    expect(body.nextCursor).toBeNull()
  })

  it('全アイテムの isBookmarked が true', async () => {
    const req = await makeAuthenticatedRequest('user-1', 'user@example.com')
    const { GET } = await import('@/app/api/v1/users/me/bookmarks/route')
    const res = await GET(req)

    const body = await res.json()
    for (const item of body.items) {
      expect(item.isBookmarked).toBe(true)
    }
  })

  it('fetchBookmarkedPosts に userId が渡される', async () => {
    const req = await makeAuthenticatedRequest('user-1', 'user@example.com')
    const { GET } = await import('@/app/api/v1/users/me/bookmarks/route')
    await GET(req)

    // limit 未指定時は undefined（service 側のデフォルト適用）
    expect(mockFetchBookmarkedPosts).toHaveBeenCalledWith('user-1', undefined, undefined)
  })

  it('cursor クエリパラメータが fetchBookmarkedPosts に渡される', async () => {
    const req = await makeAuthenticatedRequest('user-1', 'user@example.com', 'cursor=bm-cursor-id&limit=10')
    const { GET } = await import('@/app/api/v1/users/me/bookmarks/route')
    await GET(req)

    expect(mockFetchBookmarkedPosts).toHaveBeenCalledWith('user-1', 'bm-cursor-id', 10)
  })

  it('limit クエリパラメータが fetchBookmarkedPosts に渡される', async () => {
    const req = await makeAuthenticatedRequest('user-1', 'user@example.com', 'limit=5')
    const { GET } = await import('@/app/api/v1/users/me/bookmarks/route')
    await GET(req)

    expect(mockFetchBookmarkedPosts).toHaveBeenCalledWith('user-1', undefined, 5)
  })

  it('nextCursor がある場合はレスポンスに含まれる', async () => {
    mockFetchBookmarkedPosts.mockResolvedValueOnce({
      items: mockBookmarkedPosts,
      nextCursor: 'bm-next-cursor',
    })
    const postsWithMentions = mockBookmarkedPosts.map((p) => ({ ...p, mentionedUsers: [] }))
    mockAttachMentionedUsers.mockResolvedValueOnce(postsWithMentions)

    const req = await makeAuthenticatedRequest('user-1', 'user@example.com')
    const { GET } = await import('@/app/api/v1/users/me/bookmarks/route')
    const res = await GET(req)

    const body = await res.json()
    expect(body.nextCursor).toBe('bm-next-cursor')
  })

  it('ブックマークがない場合は空配列と nextCursor: null', async () => {
    mockFetchBookmarkedPosts.mockResolvedValueOnce({ items: [], nextCursor: null })
    mockAttachMentionedUsers.mockResolvedValueOnce([])

    const req = await makeAuthenticatedRequest('user-1', 'user@example.com')
    const { GET } = await import('@/app/api/v1/users/me/bookmarks/route')
    const res = await GET(req)

    const body = await res.json()
    expect(body.items).toHaveLength(0)
    expect(body.nextCursor).toBeNull()
  })

  it('可視性フィルタ: fetchBookmarkedPosts が userId を受けて可視性フィルタを実施する', async () => {
    const req = await makeAuthenticatedRequest('user-1', 'user@example.com')
    const { GET } = await import('@/app/api/v1/users/me/bookmarks/route')
    await GET(req)

    // viewer=auth.userId が渡されることでブロック/非公開著者を除外する
    const [viewerId] = mockFetchBookmarkedPosts.mock.calls[0] as [string, string | undefined, number | undefined]
    expect(viewerId).toBe('user-1')
  })

  it('user に isBlocked / isMuted が付与される（Block/Mute 状態バッチ解決）', async () => {
    mockResolveBlockMuteStates.mockResolvedValueOnce(new Map([
      ['author-1', { isBlocked: true, isMuted: false }],
      ['author-2', { isBlocked: false, isMuted: true }],
    ]))
    const postsWithMentions = mockBookmarkedPosts.map((p) => ({ ...p, mentionedUsers: [] }))
    mockAttachMentionedUsers.mockResolvedValueOnce(postsWithMentions)

    const req = await makeAuthenticatedRequest('user-1', 'user@example.com')
    const { GET } = await import('@/app/api/v1/users/me/bookmarks/route')
    const res = await GET(req)

    const body = await res.json()
    expect(body.items[0]?.user?.isBlocked).toBe(true)
    expect(body.items[0]?.user?.isMuted).toBe(false)
    expect(body.items[1]?.user?.isBlocked).toBe(false)
    expect(body.items[1]?.user?.isMuted).toBe(true)
  })

  it('limit=101 は 400 VALIDATION_ERROR（上限 100 を超える）', async () => {
    const req = await makeAuthenticatedRequest('user-1', 'user@example.com', 'limit=101')
    const { GET } = await import('@/app/api/v1/users/me/bookmarks/route')
    const res = await GET(req)

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error.code).toBe('VALIDATION_ERROR')
  })

  it('Bearer ヘッダーなしで 401 AUTH_REQUIRED', async () => {
    const req = new NextRequest('http://localhost/api/v1/users/me/bookmarks', { method: 'GET' })
    const { GET } = await import('@/app/api/v1/users/me/bookmarks/route')
    const res = await GET(req)

    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error.code).toBe('AUTH_REQUIRED')
  })

  it('不正なトークンで 401 AUTH_INVALID_TOKEN', async () => {
    const req = new NextRequest('http://localhost/api/v1/users/me/bookmarks', {
      headers: { authorization: 'Bearer invalid.token' },
    })
    const { GET } = await import('@/app/api/v1/users/me/bookmarks/route')
    const res = await GET(req)

    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error.code).toBe('AUTH_INVALID_TOKEN')
  })

  it('停止アカウントで 403 ACCOUNT_SUSPENDED', async () => {
    const { signAccessToken } = await import('@/lib/api/v1/jwt')
    const token = await signAccessToken('user-susp')
    mockUserFindUnique.mockResolvedValueOnce({ id: 'user-susp', isSuspended: true, email: 'u@example.com' })
    const req = new NextRequest('http://localhost/api/v1/users/me/bookmarks', {
      headers: { authorization: `Bearer ${token}` },
    })
    const { GET } = await import('@/app/api/v1/users/me/bookmarks/route')
    const res = await GET(req)

    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error.code).toBe('ACCOUNT_SUSPENDED')
  })

  it('ゲストユーザーで 403 GUEST_NOT_ALLOWED', async () => {
    const req = await makeAuthenticatedRequest('guest-id', GUEST_EMAIL)
    const { GET } = await import('@/app/api/v1/users/me/bookmarks/route')
    const res = await GET(req)

    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error.code).toBe('GUEST_NOT_ALLOWED')
  })

  it('レート制限超過で 429 RATE_LIMITED + Retry-After ヘッダー', async () => {
    mockCheckUserRateLimit.mockResolvedValueOnce({
      success: false,
      remaining: 0,
      resetTime: Date.now() + 30000,
    })
    const req = await makeAuthenticatedRequest('user-1', 'user@example.com')
    const { GET } = await import('@/app/api/v1/users/me/bookmarks/route')
    const res = await GET(req)

    expect(res.status).toBe(429)
    expect(res.headers.get('Retry-After')).not.toBeNull()
    const body = await res.json()
    expect(body.error.code).toBe('RATE_LIMITED')
  })

  it('N+1 防止: attachMentionedUsers が 1 回のみ呼ばれる', async () => {
    const req = await makeAuthenticatedRequest('user-1', 'user@example.com')
    const { GET } = await import('@/app/api/v1/users/me/bookmarks/route')
    await GET(req)

    expect(mockAttachMentionedUsers).toHaveBeenCalledTimes(1)
  })

  it('N+1 防止: resolveBlockMuteStates が 1 回のみ呼ばれ全著者 ID が渡される', async () => {
    const req = await makeAuthenticatedRequest('user-1', 'user@example.com')
    const { GET } = await import('@/app/api/v1/users/me/bookmarks/route')
    await GET(req)

    expect(mockResolveBlockMuteStates).toHaveBeenCalledTimes(1)
    const [viewerId, authorIds] = mockResolveBlockMuteStates.mock.calls[0] as [string, string[]]
    expect(viewerId).toBe('user-1')
    expect(authorIds).toContain('author-1')
    expect(authorIds).toContain('author-2')
  })
})
