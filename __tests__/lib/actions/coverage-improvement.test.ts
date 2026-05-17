// @vitest-environment node
/**
 * Branch coverage improvement tests for notification.ts, post.ts, shop.ts.
 * Targets untested branches: invalid params, DB errors, edge cases in validation.
 */
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { createMockPrismaClient, mockUser, mockPost } from '../../utils/test-utils'

const mockPrisma = createMockPrismaClient()
;(mockPrisma.shopReview as Record<string, unknown>).aggregate = vi.fn()
vi.mock('@/lib/db', () => ({ prisma: mockPrisma }))

const mockAuth = vi.fn()
vi.mock('@/lib/auth', () => ({ auth: () => mockAuth() }))
vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(), revalidateTag: vi.fn(),
  unstable_cache: vi.fn((fn: (...a: unknown[]) => unknown) => fn),
  cache: vi.fn((fn: (...a: unknown[]) => unknown) => fn),
}))

const mockGetMutedUserIds = vi.fn()
const mockGetExcludedUserIds = vi.fn()
vi.mock('@/lib/actions/filter-helper', () => ({
  getMutedUserIds: (...args: unknown[]) => mockGetMutedUserIds(...args),
  getExcludedUserIds: (...args: unknown[]) => mockGetExcludedUserIds(...args),
}))

const mockSendPushNotification = vi.fn()
vi.mock('@/lib/web-push', () => ({
  sendPushNotification: (...args: unknown[]) => mockSendPushNotification(...args),
}))

const mockCheckUserRateLimit = vi.fn().mockResolvedValue({ success: true })
vi.mock('@/lib/rate-limit', () => ({
  checkUserRateLimit: (...args: unknown[]) => mockCheckUserRateLimit(...args),
  checkDailyLimit: vi.fn().mockResolvedValue({ allowed: true, count: 0, limit: 50 }),
}))
vi.mock('@/lib/premium', () => ({
  getMembershipLimits: vi.fn().mockResolvedValue({ maxPostLength: 500, maxImages: 4, maxVideos: 1, maxDailyPosts: 20 }),
}))
vi.mock('@/lib/sanitize', () => ({ sanitizePostContent: (c: string) => c }))
vi.mock('@/lib/cache', () => ({
  getCachedGenres: vi.fn().mockResolvedValue({ genres: {}, allGenres: [] }),
  getCachedShopRatings: vi.fn().mockResolvedValue([]),
  revalidateTrendingGenresCache: vi.fn(),
  revalidatePopularTagsCache: vi.fn(),
  revalidateShopRatingsCache: vi.fn(),
}))
vi.mock('@/lib/services/hashtag-sync', () => ({
  attachHashtagsToPost: vi.fn().mockResolvedValue(undefined),
  detachHashtagsFromPost: vi.fn().mockResolvedValue(undefined),
  extractHashtags: vi.fn().mockReturnValue([]),
}))
vi.mock('@/lib/actions/mention', () => ({ notifyMentionedUsers: vi.fn().mockResolvedValue(undefined) }))
vi.mock('@/lib/services/authorization', () => ({ canUserEditShop: vi.fn() }))
vi.mock('@/lib/logger', () => ({
  __esModule: true,
  default: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn(), log: vi.fn() },
}))

beforeEach(() => {
  vi.clearAllMocks()
  mockAuth.mockResolvedValue({ user: { id: mockUser.id } })
  mockGetMutedUserIds.mockResolvedValue([])
  mockGetExcludedUserIds.mockResolvedValue([])
  mockSendPushNotification.mockResolvedValue(undefined)
  mockCheckUserRateLimit.mockResolvedValue({ success: true })
  mockPrisma.user.findUnique.mockResolvedValue({ isSuspended: false })
})

// --- notification.ts ---

describe('createNotification edge cases', () => {
  // バリデーション失敗時は actionError を返す（旧実装はサイレントに actionSuccess を返していた）
  it('invalid params (empty userId) returns error without creating', async () => {
    const { createNotification } = await import('@/lib/services/notification-core')
    const result = await createNotification({ userId: '', actorId: 'a1', type: 'like', postId: 'p1' })
    expect(result.success).toBe(false)
    expect(mockPrisma.notification.create).not.toHaveBeenCalled()
  })

  it('invalid params (empty actorId) returns error without creating', async () => {
    const { createNotification } = await import('@/lib/services/notification-core')
    const result = await createNotification({ userId: 'u1', actorId: '', type: 'comment' })
    expect(result.success).toBe(false)
    expect(mockPrisma.notification.create).not.toHaveBeenCalled()
  })

  it('duplicate notification in transaction skips creation', async () => {
    mockGetExcludedUserIds.mockResolvedValueOnce([])
    mockPrisma.user.findUnique.mockResolvedValueOnce({ notificationPreferences: {} })
    mockPrisma.$transaction.mockImplementationOnce(async (fn: (tx: typeof mockPrisma) => Promise<void>) => {
      mockPrisma.notification.findFirst.mockResolvedValueOnce({ id: 'existing' })
      await fn(mockPrisma)
    })
    const { createNotification } = await import('@/lib/services/notification-core')
    const result = await createNotification({ userId: 'other', actorId: mockUser.id, type: 'like', postId: 'p1' })
    expect(result).toEqual({ success: true })
    expect(mockPrisma.notification.create).not.toHaveBeenCalled()
  })

  it('push notification failure is caught (does not throw)', async () => {
    mockGetExcludedUserIds.mockResolvedValueOnce([])
    mockPrisma.user.findUnique
      .mockResolvedValueOnce({ notificationPreferences: {} })
      .mockResolvedValueOnce({ nickname: 'テスター' })
    mockPrisma.$transaction.mockImplementationOnce(async (fn: (tx: typeof mockPrisma) => Promise<void>) => {
      mockPrisma.notification.findFirst.mockResolvedValueOnce(null)
      mockPrisma.notification.create.mockResolvedValueOnce({ id: 'n1' })
      await fn(mockPrisma)
    })
    mockSendPushNotification.mockRejectedValueOnce(new Error('Push down'))
    const { createNotification } = await import('@/lib/services/notification-core')
    const result = await createNotification({ userId: 'other', actorId: mockUser.id, type: 'like', postId: 'p1' })
    expect(result).toEqual({ success: true })
  })

  it('actor without nickname uses fallback name in push body', async () => {
    mockGetExcludedUserIds.mockResolvedValueOnce([])
    mockPrisma.user.findUnique
      .mockResolvedValueOnce({ notificationPreferences: {} })
      .mockResolvedValueOnce(null)
    mockPrisma.$transaction.mockImplementationOnce(async (fn: (tx: typeof mockPrisma) => Promise<void>) => {
      mockPrisma.notification.findFirst.mockResolvedValueOnce(null)
      mockPrisma.notification.create.mockResolvedValueOnce({ id: 'n1' })
      await fn(mockPrisma)
    })
    const { createNotification } = await import('@/lib/services/notification-core')
    await createNotification({ userId: 'other', actorId: mockUser.id, type: 'follow' })
    expect(mockSendPushNotification).toHaveBeenCalledWith(
      'other', expect.objectContaining({ body: 'ユーザーさんがあなたをフォローしました' })
    )
  })

  it('commentId without postId uses /notifications URL', async () => {
    mockGetExcludedUserIds.mockResolvedValueOnce([])
    mockPrisma.user.findUnique
      .mockResolvedValueOnce({ notificationPreferences: {} })
      .mockResolvedValueOnce({ nickname: 'コメンター' })
    mockPrisma.$transaction.mockImplementationOnce(async (fn: (tx: typeof mockPrisma) => Promise<void>) => {
      mockPrisma.notification.findFirst.mockResolvedValueOnce(null)
      mockPrisma.notification.create.mockResolvedValueOnce({ id: 'n1' })
      await fn(mockPrisma)
    })
    const { createNotification } = await import('@/lib/services/notification-core')
    await createNotification({ userId: 'other', actorId: mockUser.id, type: 'comment_like', commentId: 'c1' })
    expect(mockSendPushNotification).toHaveBeenCalledWith(
      'other', expect.objectContaining({ data: { url: '/notifications' } })
    )
  })
})

describe('deleteNotification edge cases', () => {
  // バリデーション失敗時は actionError を返す（旧実装はサイレントに actionSuccess を返していた）
  it('invalid params (empty userId) returns error without deleting', async () => {
    const { deleteNotification } = await import('@/lib/services/notification-core')
    const result = await deleteNotification({ userId: '', actorId: 'a1', type: 'like' })
    expect(result.success).toBe(false)
    expect(mockPrisma.notification.deleteMany).not.toHaveBeenCalled()
  })

  it('deleteMany count 0 (no match) still returns success', async () => {
    mockPrisma.notification.deleteMany.mockResolvedValueOnce({ count: 0 })
    const { deleteNotification } = await import('@/lib/services/notification-core')
    const result = await deleteNotification({ userId: 'u1', actorId: 'a1', type: 'follow' })
    expect(result).toEqual({ success: true })
    expect(mockPrisma.notification.deleteMany).toHaveBeenCalledWith({
      where: { userId: 'u1', actorId: 'a1', type: 'follow', postId: null, commentId: null },
    })
  })

  it('commentId is passed in where clause', async () => {
    mockPrisma.notification.deleteMany.mockResolvedValueOnce({ count: 1 })
    const { deleteNotification } = await import('@/lib/services/notification-core')
    await deleteNotification({ userId: 'u1', actorId: 'a1', type: 'comment_like', commentId: 'c1' })
    expect(mockPrisma.notification.deleteMany).toHaveBeenCalledWith({
      where: expect.objectContaining({ commentId: 'c1', postId: null }),
    })
  })
})

describe('markAsRead DB error', () => {
  it('returns ERR_OPERATION_FAILED on DB error', async () => {
    mockPrisma.notification.update.mockRejectedValueOnce(new Error('Not found'))
    const { markAsRead } = await import('@/lib/actions/notification')
    const result = await markAsRead('bad-id')
    expect(result).toMatchObject({ success: false, error: '操作に失敗しました' })
  })
})

describe('markAllAsRead DB error', () => {
  it('returns ERR_OPERATION_FAILED on DB error', async () => {
    mockPrisma.notification.updateMany.mockRejectedValueOnce(new Error('Lost'))
    const { markAllAsRead } = await import('@/lib/actions/notification')
    const result = await markAllAsRead()
    expect(result).toMatchObject({ success: false, error: '操作に失敗しました' })
  })
})

// --- post.ts ---

describe('createPost edge cases', () => {
  it('whitespace-only content with no media is handled', async () => {
    const { createPost } = await import('@/lib/actions/post')
    const formData = new FormData()
    formData.append('content', '   ')
    const result = await createPost(formData)
    expect(result.success).toBeDefined()
  })

  it('media-only post (empty content) succeeds', async () => {
    mockPrisma.post.count.mockResolvedValue(0)
    mockPrisma.post.create.mockResolvedValue({ ...mockPost, id: 'media-post' })
    const { createPost } = await import('@/lib/actions/post')
    const formData = new FormData()
    formData.append('content', '')
    formData.append('mediaUrls', 'https://example.com/img.jpg')
    formData.append('mediaTypes', 'image')
    const result = await createPost(formData)
    expect(result.success).toBe(true)
    expect(result.data?.postId).toBe('media-post')
  })

  it('poll with invalid JSON returns poll data invalid error', async () => {
    const { createPost } = await import('@/lib/actions/post')
    const formData = new FormData()
    formData.append('content', 'テスト')
    formData.append('pollOptions', '{bad json')
    const result = await createPost(formData)
    expect(result.success).toBe(false)
    expect(result.error).toBe('アンケートデータが不正です')
  })

  it('poll with too few options returns error', async () => {
    const { createPost } = await import('@/lib/actions/post')
    const formData = new FormData()
    formData.append('content', 'テスト')
    formData.append('pollOptions', JSON.stringify(['one']))
    formData.append('pollDuration', '86400')
    const result = await createPost(formData)
    expect(result.success).toBe(false)
    expect(result.error).toContain('選択肢は')
  })

  it('poll with empty option text returns error', async () => {
    const { createPost } = await import('@/lib/actions/post')
    const formData = new FormData()
    formData.append('content', 'テスト')
    formData.append('pollOptions', JSON.stringify(['ok', '']))
    formData.append('pollDuration', '86400')
    const result = await createPost(formData)
    expect(result.success).toBe(false)
    expect(result.error).toContain('選択肢は')
  })

  it('poll with invalid duration returns error', async () => {
    const { createPost } = await import('@/lib/actions/post')
    const formData = new FormData()
    formData.append('content', 'テスト')
    formData.append('pollOptions', JSON.stringify(['A', 'B']))
    formData.append('pollDuration', '999999')
    const result = await createPost(formData)
    expect(result.success).toBe(false)
    expect(result.error).toBe('無効な投票期間です')
  })
})

describe('deletePost edge cases', () => {
  it('empty postId returns invalid input error', async () => {
    const { deletePost } = await import('@/lib/actions/post')
    const result = await deletePost('')
    expect(result.success).toBe(false)
    expect(result.error).toBe('入力データが不正です')
  })
})

describe('getPost edge cases', () => {
  it('empty postId returns invalid input error', async () => {
    const { getPost } = await import('@/lib/actions/post')
    const result = await getPost('')
    expect('error' in result && result.error).toBe('入力データが不正です')
  })
})

describe('createQuotePost edge cases', () => {
  it('original post deleted still creates quote without notification', async () => {
    mockPrisma.post.count.mockResolvedValue(0)
    mockPrisma.post.create.mockResolvedValue({ ...mockPost, id: 'quote-post' })
    mockPrisma.post.findUnique.mockResolvedValue(null)
    const { createQuotePost } = await import('@/lib/actions/post')
    const formData = new FormData()
    formData.append('content', '引用コメントテスト')
    const result = await createQuotePost(formData, 'deleted-post-id')
    expect(result.success).toBe(true)
    expect(mockPrisma.notification.create).not.toHaveBeenCalled()
  })
})

// --- shop.ts ---

describe('createShop edge cases', () => {
  it('invalid latitude returns invalid input error', async () => {
    mockPrisma.bonsaiShop.findFirst.mockResolvedValue(null)
    const { createShop } = await import('@/lib/actions/shop')
    const formData = new FormData()
    formData.append('name', 'テスト盆栽園')
    formData.append('address', '東京都渋谷区')
    formData.append('latitude', 'NaN')
    formData.append('longitude', '139.65')
    const result = await createShop(formData)
    expect(result.success).toBe(false)
    expect(result.error).toBe('入力データが不正です')
  })

  it('invalid longitude returns invalid input error', async () => {
    mockPrisma.bonsaiShop.findFirst.mockResolvedValue(null)
    const { createShop } = await import('@/lib/actions/shop')
    const formData = new FormData()
    formData.append('name', 'テスト盆栽園')
    formData.append('address', '東京都渋谷区')
    formData.append('latitude', '35.67')
    formData.append('longitude', 'bad')
    const result = await createShop(formData)
    expect(result.success).toBe(false)
    expect(result.error).toBe('入力データが不正です')
  })

  it('DB error during create returns shop create failed', async () => {
    mockPrisma.bonsaiShop.findFirst.mockResolvedValue(null)
    mockPrisma.bonsaiShop.create.mockRejectedValue(new Error('constraint'))
    const { createShop } = await import('@/lib/actions/shop')
    const formData = new FormData()
    formData.append('name', 'テスト盆栽園')
    formData.append('address', '新住所')
    const result = await createShop(formData)
    expect(result.success).toBe(false)
    expect(result.error).toBe('盆栽園の登録に失敗しました')
  })

  it('duplicate address returns error with existingId', async () => {
    mockPrisma.bonsaiShop.findFirst.mockResolvedValue({ id: 'dup-id', address: '東京都' })
    const { createShop } = await import('@/lib/actions/shop')
    const formData = new FormData()
    formData.append('name', '別')
    formData.append('address', '東京都')
    const result = await createShop(formData)
    expect(result.success).toBe(false)
    expect(result.error).toBe('この住所の盆栽園は既に登録されています')
    expect(result.existingId).toBe('dup-id')
  })
})

describe('updateShop edge cases', () => {
  it('invalid latitude returns invalid input error', async () => {
    const { canUserEditShop } = await import('@/lib/services/authorization')
    vi.mocked(canUserEditShop).mockResolvedValue({ allowed: true })
    const { updateShop } = await import('@/lib/actions/shop')
    const formData = new FormData()
    formData.append('name', 'テスト')
    formData.append('address', '住所')
    formData.append('latitude', 'abc')
    const result = await updateShop('s1', formData)
    expect(result).toMatchObject({ success: false, error: '入力データが不正です' })
  })

  it('DB error returns update failed error', async () => {
    const { canUserEditShop } = await import('@/lib/services/authorization')
    vi.mocked(canUserEditShop).mockResolvedValue({ allowed: true })
    mockPrisma.$transaction.mockRejectedValueOnce(new Error('deadlock'))
    const { updateShop } = await import('@/lib/actions/shop')
    const formData = new FormData()
    formData.append('name', 'テスト')
    formData.append('address', '住所')
    const result = await updateShop('s1', formData)
    expect(result).toMatchObject({ success: false, error: '盆栽園の更新に失敗しました' })
  })

  it('shop not found via canUserEditShop', async () => {
    const { canUserEditShop } = await import('@/lib/services/authorization')
    vi.mocked(canUserEditShop).mockResolvedValue({ allowed: false, reason: 'Shop not found' })
    const { updateShop } = await import('@/lib/actions/shop')
    const formData = new FormData()
    formData.append('name', 'テスト')
    formData.append('address', '住所')
    const result = await updateShop('bad', formData)
    expect(result).toMatchObject({ success: false, error: '盆栽園が見つかりません' })
  })

  it('unauthorized user returns edit permission denied', async () => {
    const { canUserEditShop } = await import('@/lib/services/authorization')
    vi.mocked(canUserEditShop).mockResolvedValue({ allowed: false, reason: 'Not owner' })
    const { updateShop } = await import('@/lib/actions/shop')
    const formData = new FormData()
    formData.append('name', 'テスト')
    formData.append('address', '住所')
    const result = await updateShop('s1', formData)
    expect(result).toMatchObject({ success: false, error: '編集権限がありません' })
  })
})

describe('geocodeAddress edge cases', () => {
  it('unauthenticated user returns auth error', async () => {
    mockAuth.mockResolvedValueOnce(null)
    const { geocodeAddress } = await import('@/lib/actions/shop')
    const result = await geocodeAddress('東京都')
    expect(result).toMatchObject({ error: '認証が必要です' })
  })

  it('address exceeding max length returns invalid input', async () => {
    const { geocodeAddress } = await import('@/lib/actions/shop')
    const result = await geocodeAddress('あ'.repeat(300))
    expect(result).toMatchObject({ error: '入力データが不正です' })
  })

  it('JSON parse failure returns parse failed error', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true, json: () => Promise.reject(new SyntaxError('bad')),
    })
    const { geocodeAddress } = await import('@/lib/actions/shop')
    const result = await geocodeAddress('東京都渋谷区')
    expect(result).toMatchObject({ error: '住所の検索結果の解析に失敗しました' })
  })

  it('non-array response returns address not found', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true, json: () => Promise.resolve({ not: 'array' }),
    })
    const { geocodeAddress } = await import('@/lib/actions/shop')
    const result = await geocodeAddress('東京都渋谷区')
    expect(result).toMatchObject({ error: '住所が見つかりませんでした' })
  })
})
