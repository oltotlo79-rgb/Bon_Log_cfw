import { vi } from 'vitest'
 
// @vitest-environment node

/**
 * Coverage boost tests for various action files.
 *
 * Targets the following uncovered lines:
 * - post.ts line 276: media data mismatch
 * - comment.ts line 236: media data mismatch
 * - scheduled-post.ts lines 201, 550: media data mismatch
 * - event.ts lines 94, 99: invalid date format
 * - follow.ts lines 236-237: DB error catch block
 * - auth.ts lines 163-169: x-real-ip and 'unknown' IP extraction
 * - bonsai.ts lines 77-79: x-real-ip and 'unknown' IP extraction
 * - blacklist.ts lines 224-225: addDeviceToBlacklist error catch
 * - analytics.ts lines 741-743: daily stats aggregation
 */

import { createMockPrismaClient, mockUser } from '../../utils/test-utils'

// ============================================================
// Mock setup
// ============================================================

const mockPrisma = createMockPrismaClient()
vi.mock('@/lib/db', () => ({
  prisma: mockPrisma,
}))

const mockAuth = vi.fn()
vi.mock('@/lib/auth', () => ({
  auth: () => mockAuth(),
}))

vi.mock('next/cache', () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn(), unstable_cache: vi.fn((fn) => fn), cache: vi.fn((fn) => fn) }))

const mockCheckUserRateLimit = vi.fn().mockResolvedValue({ success: true })
const mockCheckDailyLimit = vi.fn().mockResolvedValue({ allowed: true, count: 0, limit: 50 })
vi.mock('@/lib/rate-limit', () => ({
  checkUserRateLimit: (...args: unknown[]) => mockCheckUserRateLimit(...args),
  checkDailyLimit: (...args: unknown[]) => mockCheckDailyLimit(...args),
  rateLimit: vi.fn().mockResolvedValue({ success: true }),
  RATE_LIMITS: { search: { limit: 20, window: 60 } },
}))

// Premium mock
const mockGetMembershipLimits = vi.fn().mockResolvedValue({
  maxPostLength: 500,
  maxImages: 4,
  maxVideos: 1,
  maxDailyPosts: 20,
})
const mockIsPremiumUser = vi.fn().mockResolvedValue(true)
vi.mock('@/lib/premium', () => ({
  getMembershipLimits: (...args: unknown[]) => mockGetMembershipLimits(...args),
  isPremiumUser: (...args: unknown[]) => mockIsPremiumUser(...args),
}))

// Sanitize mock
vi.mock('@/lib/sanitize', () => ({
  sanitizePostContent: (content: string) => content,
  sanitizeInput: vi.fn((input: string) => input),
}))

// Hashtag mock（post.ts が参照する services 層を直接モックする）
vi.mock('@/lib/services/hashtag-sync', () => ({
  attachHashtagsToPost: vi.fn().mockResolvedValue(undefined),
  detachHashtagsFromPost: vi.fn().mockResolvedValue(undefined),
}))

// Mention mock
vi.mock('@/lib/services/mention', () => ({
  notifyMentionedUsers: vi.fn().mockResolvedValue(undefined),
}))

// Logger mock
vi.mock('@/lib/logger', () => ({
  __esModule: true,
  default: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
    log: vi.fn(),
  },
}))

// Storage mock
vi.mock('@/lib/storage', () => ({
  uploadFile: vi.fn().mockResolvedValue({ success: true, url: 'https://example.com/file.jpg' }),
}))

// Analytics mock (for follow.ts dependency)
vi.mock('@/lib/services/analytics-recording', () => ({
  recordNewFollowerService: vi.fn().mockResolvedValue(undefined),
}))

// Notification mock (for comment.ts dependency)
vi.mock('@/lib/actions/notification', () => ({
  createNotification: vi.fn().mockResolvedValue({ success: true }),
}))
vi.mock('@/lib/services/notification-core', () => ({
  createNotification: vi.fn().mockResolvedValue({ success: true }),
}))

// Admin mock (for blacklist.ts dependency)
const mockIsAdmin = vi.fn().mockResolvedValue(true)
vi.mock('@/lib/actions/admin', () => ({
  isAdmin: () => mockIsAdmin(),
}))

// Headers mock - will be overridden in specific tests
const mockHeadersGet = vi.fn().mockReturnValue('127.0.0.1')
vi.mock('next/headers', () => ({
  headers: vi.fn().mockResolvedValue({
    get: (...args: unknown[]) => mockHeadersGet(...args),
  }),
}))

// bcryptjs mock (for auth.ts)
vi.mock('bcryptjs', () => ({
  default: { hash: vi.fn().mockResolvedValue('hashed-password'), compare: vi.fn().mockResolvedValue(true) },
  hash: vi.fn().mockResolvedValue('hashed-password'),
  compare: vi.fn().mockResolvedValue(true),
}))

// crypto mock (for auth.ts)
vi.mock('crypto', () => {
  const cryptoMock = {
    randomBytes: vi.fn().mockReturnValue({
      toString: vi.fn().mockReturnValue('random-token-123'),
    }),
    createHash: vi.fn().mockReturnValue({
      update: vi.fn().mockReturnValue({
        digest: vi.fn().mockReturnValue('hashed-token-123'),
      }),
    }),
  }
  return { default: cryptoMock, ...cryptoMock }
})

// Email mock (for auth.ts)
vi.mock('@/lib/email', () => ({
  sendPasswordResetEmail: vi.fn().mockResolvedValue({ success: true }),
}))

// Login tracker mock (for auth.ts)
const mockLoginTracker = {
  checkLoginAttempt: vi.fn().mockResolvedValue({
    allowed: true,
    message: '',
    remainingAttempts: 5,
  }),
  recordFailedLogin: vi.fn().mockResolvedValue({
    allowed: true,
    message: '',
    remainingAttempts: 4,
  }),
  resetLoginAttempts: vi.fn().mockResolvedValue(undefined),
  getLoginKey: vi.fn().mockReturnValue('login-key'),
}
vi.mock('@/lib/login-tracker', () => mockLoginTracker)

// Security logger mock (for auth.ts)
vi.mock('@/lib/security-logger', () => ({
  logLoginFailure: vi.fn(),
  logLoginLockout: vi.fn(),
  logRegisterSuccess: vi.fn(),
  logPasswordResetRequest: vi.fn(),
  logPasswordResetSuccess: vi.fn(),
}))

// Blacklist check mock (for auth.ts)
vi.mock('@/lib/actions/blacklist', async () => ({
  isEmailBlacklisted: vi.fn().mockResolvedValue(false),
  isDeviceBlacklisted: vi.fn().mockResolvedValue(false),
  addDeviceToBlacklist: (await vi.importActual<Record<string, unknown>>('@/lib/actions/blacklist')).addDeviceToBlacklist,
}))

// ============================================================
// Tests
// ============================================================

describe('Coverage Boost - Action Files', async () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuth.mockResolvedValue({ user: { id: mockUser.id } })
    mockCheckUserRateLimit.mockResolvedValue({ success: true })
    mockIsPremiumUser.mockResolvedValue(true)
    mockGetMembershipLimits.mockResolvedValue({
      maxPostLength: 500,
      maxImages: 4,
      maxVideos: 1,
      maxDailyPosts: 20,
    })
    mockHeadersGet.mockReturnValue('127.0.0.1')
    mockIsAdmin.mockResolvedValue(true)
    // Default: user not suspended
    mockPrisma.user.findUnique.mockResolvedValue({ isPublic: true, isSuspended: false })
    // コメント対象投稿は閲覧可能（本人の非表示でない投稿）を既定とする
    mockPrisma.post.findUnique.mockResolvedValue({ id: 'post-123', userId: mockUser.id, isHidden: false })
  })

  // ============================================================
  // 1. post.ts line 276 - media data mismatch
  // ============================================================
  describe('post.ts - createPost media data mismatch', async () => {
    it('mediaUrlsとmediaTypesの長さが異なる場合はエラーを返す', async () => {
      const { createPost } = await import('@/lib/actions/post')

      const formData = new FormData()
      formData.append('content', 'テスト投稿')
      formData.append('genreIds', 'genre-1')
      // 2 URLs but only 1 type - mismatch
      formData.append('mediaUrls', 'https://example.com/image1.jpg')
      formData.append('mediaUrls', 'https://example.com/image2.jpg')
      formData.append('mediaTypes', 'image')

      const result = await createPost(formData)

      expect(result.success).toBe(false)
      expect('error' in result && result.error).toBe('メディアデータが不正です')
    })
  })

  // ============================================================
  // 2. comment.ts line 236 - media data mismatch
  // ============================================================
  describe('comment.ts - createComment media data mismatch', async () => {
    it('mediaUrlsとmediaTypesの長さが異なる場合はエラーを返す', async () => {
      const { createComment } = await import('@/lib/actions/comment')

      const formData = new FormData()
      formData.append('postId', 'post-123')
      formData.append('content', 'テストコメント')
      // 2 URLs but only 1 type - mismatch
      formData.append('mediaUrls', 'https://example.com/image1.jpg')
      formData.append('mediaUrls', 'https://example.com/image2.jpg')
      formData.append('mediaTypes', 'image')

      const result = await createComment(formData)

      expect('error' in result && result.error).toBe('メディアデータが不正です')
    })
  })

  // ============================================================
  // 3. scheduled-post.ts lines 201, 550 - media data mismatch
  // ============================================================
  describe('scheduled-post.ts - media data mismatch', async () => {
    it('createScheduledPost: mediaUrlsとmediaTypesの長さが異なる場合はエラーを返す', async () => {
      const { createScheduledPost } = await import('@/lib/actions/scheduled-post')

      // Set a future date
      const futureDate = new Date()
      futureDate.setDate(futureDate.getDate() + 1)

      const formData = new FormData()
      formData.append('content', '予約投稿テスト')
      formData.append('scheduledAt', futureDate.toISOString())
      formData.append('genreIds', 'genre-1')
      // 2 URLs but only 1 type - mismatch
      formData.append('mediaUrls', 'https://example.com/image1.jpg')
      formData.append('mediaUrls', 'https://example.com/image2.jpg')
      formData.append('mediaTypes', 'image')

      const result = await createScheduledPost(formData)

      expect(result).toMatchObject({ error: 'メディアデータが不正です' })
    })

    it('updateScheduledPost: mediaUrlsとmediaTypesの長さが異なる場合はエラーを返す', async () => {
      const { updateScheduledPost } = await import('@/lib/actions/scheduled-post')

      // Mock existing scheduled post
      mockPrisma.scheduledPost.findUnique.mockResolvedValue({
        id: 'scheduled-1',
        userId: mockUser.id,
        status: 'pending',
      })

      // Set a future date
      const futureDate = new Date()
      futureDate.setDate(futureDate.getDate() + 1)

      const formData = new FormData()
      formData.append('content', '更新した予約投稿')
      formData.append('scheduledAt', futureDate.toISOString())
      formData.append('genreIds', 'genre-1')
      // 3 URLs but only 1 type - mismatch
      formData.append('mediaUrls', 'https://example.com/image1.jpg')
      formData.append('mediaUrls', 'https://example.com/image2.jpg')
      formData.append('mediaUrls', 'https://example.com/image3.jpg')
      formData.append('mediaTypes', 'image')

      const result = await updateScheduledPost('scheduled-1', formData)

      expect(result).toMatchObject({ error: 'メディアデータが不正です' })
    })
  })

  // ============================================================
  // 4. event.ts lines 94, 99 - invalid date format
  // ============================================================
  describe('event.ts - invalid date format', async () => {
    it('開始日の形式が不正な場合はエラーを返す', async () => {
      const { createEvent } = await import('@/lib/actions/event')

      const formData = new FormData()
      formData.append('title', 'テストイベント')
      formData.append('startDate', 'not-a-valid-date')
      formData.append('prefecture', '東京都')

      const result = await createEvent(formData)

      expect(result).toMatchObject({ error: '開始日の形式が不正です' })
    })

    it('終了日の形式が不正な場合はエラーを返す', async () => {
      const { createEvent } = await import('@/lib/actions/event')

      const formData = new FormData()
      formData.append('title', 'テストイベント')
      formData.append('startDate', '2025-06-15')
      formData.append('endDate', 'invalid-end-date')
      formData.append('prefecture', '東京都')

      const result = await createEvent(formData)

      expect(result).toMatchObject({ error: '終了日の形式が不正です' })
    })
  })

  // ============================================================
  // 5. follow.ts lines 236-237 - DB error catch block
  // ============================================================
  describe('follow.ts - toggleFollow DB error', async () => {
    it('DB操作がエラーの場合はフォロー操作に失敗しましたを返す', async () => {
      // Make the findUnique for follow throw an error
      mockPrisma.follow.findUnique.mockRejectedValue(new Error('DB connection failed'))

      const { toggleFollow } = await import('@/lib/actions/follow')
      const result = await toggleFollow('target-user-id')

      expect(result).toEqual({ success: false, error: 'フォロー操作に失敗しました' })
    })
  })

  // ============================================================
  // 6. auth.ts lines 163-169 - IP extraction (x-real-ip and 'unknown')
  // ============================================================
  describe('auth.ts - getClientIp IP extraction', async () => {
    it('x-real-ipヘッダーがある場合はそのIPを使用する', async () => {
      // Return null for cf-connecting-ip and x-forwarded-for, but return IP for x-real-ip
      mockHeadersGet.mockImplementation((header: string) => {
        if (header === 'x-real-ip') return '10.0.0.1'
        return null
      })

      const { checkLoginAllowed } = await import('@/lib/actions/auth')
      const result = await checkLoginAllowed('test@example.com')

      // The function should work (IP extracted from x-real-ip)
      expect(mockLoginTracker.getLoginKey).toHaveBeenCalledWith('10.0.0.1', 'test@example.com')
      expect(result).toHaveProperty('allowed')
    })

    it('IPヘッダーが全くない場合は"unknown"を使用する', async () => {
      // Return null for all headers
      mockHeadersGet.mockReturnValue(null)

      const { checkLoginAllowed } = await import('@/lib/actions/auth')
      const result = await checkLoginAllowed('test@example.com')

      // The function should work with 'unknown' IP
      expect(mockLoginTracker.getLoginKey).toHaveBeenCalledWith('unknown', 'test@example.com')
      expect(result).toHaveProperty('allowed')
    })
  })

  // ============================================================
  // 7. bonsai.ts lines 77-79 - IP extraction (x-real-ip and 'unknown')
  // ============================================================
  describe('bonsai.ts - getClientIpFromHeaders IP extraction', async () => {
    it('x-real-ipヘッダーがある場合はそのIPを使用する', async () => {
      mockAuth.mockResolvedValue({ user: { id: mockUser.id } })
      mockHeadersGet.mockImplementation((header: string) => {
        if (header === 'x-real-ip') return '192.168.1.1'
        return null
      })
      mockPrisma.bonsai.findMany.mockResolvedValue([])

      const { searchBonsais } = await import('@/lib/actions/bonsai')
      await searchBonsais('黒松')

      // Should have called rateLimit with an IP-based key
      const { rateLimit } = await import('@/lib/rate-limit')
      expect(rateLimit).toHaveBeenCalledWith(
        expect.stringContaining('192.168.1.1'),
        expect.anything()
      )
    })

    it('IPヘッダーが全くない場合は"unknown"を使用する', async () => {
      mockAuth.mockResolvedValue({ user: { id: mockUser.id } })
      mockHeadersGet.mockReturnValue(null)
      mockPrisma.bonsai.findMany.mockResolvedValue([])

      const { searchBonsais } = await import('@/lib/actions/bonsai')
      await searchBonsais('真柏')

      const { rateLimit } = await import('@/lib/rate-limit')
      expect(rateLimit).toHaveBeenCalledWith(
        expect.stringContaining('unknown'),
        expect.anything()
      )
    })
  })

  // ============================================================
  // 8. blacklist.ts lines 224-225 - error catch
  // ============================================================
  describe('blacklist.ts - addDeviceToBlacklist error catch', async () => {
    it('prisma操作がエラーの場合はブラックリストへの追加に失敗しましたを返す', async () => {
      // Add deviceBlacklist model to mockPrisma dynamically
       
      ;(mockPrisma as any).deviceBlacklist = {
        findUnique: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockRejectedValue(new Error('DB error')),
        delete: vi.fn(),
        findMany: vi.fn(),
        count: vi.fn(),
      }
      // requireAdmin needs adminUser.findUnique to return a role
      mockPrisma.adminUser.findUnique.mockResolvedValue({ role: 'admin' })

      const { addDeviceToBlacklist } = await import('@/lib/actions/blacklist')
      const result = await addDeviceToBlacklist('abcdef1234567890', 'test reason', 'user@test.com')

      expect(result).toMatchObject({ error: 'ブラックリストへの追加に失敗しました' })
    })
  })
})
