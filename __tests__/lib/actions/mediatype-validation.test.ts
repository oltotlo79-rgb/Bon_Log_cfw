// @vitest-environment node

/**
 * MediaType バリデーション テスト
 *
 * post.ts / comment.ts / scheduled-post.ts の z.enum(['image', 'video']) 検証
 */

import { vi, describe, it, expect, beforeEach } from 'vitest'
import { createMockPrismaClient, mockUser, mockPost } from '../../utils/test-utils'

const mockPrisma = createMockPrismaClient()
vi.mock('@/lib/db', () => ({ prisma: mockPrisma }))

const mockAuth = vi.fn()
vi.mock('@/lib/auth', () => ({ auth: () => mockAuth() }))

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
  unstable_cache: vi.fn((fn) => fn),
  cache: vi.fn((fn) => fn),
}))

vi.mock('@/lib/rate-limit', () => ({
  checkUserRateLimit: vi.fn().mockResolvedValue({ success: true }),
  checkDailyLimit: vi.fn().mockResolvedValue({ allowed: true, count: 0 }),
}))

vi.mock('@/lib/premium', () => ({
  isPremiumUser: vi.fn().mockResolvedValue(false),
  getMembershipLimits: vi.fn().mockReturnValue({
    maxPostLength: 500,
    maxImages: 4,
    maxVideos: 1,
    maxDailyPosts: 20,
  }),
}))

vi.mock('next/headers', () => ({
  headers: vi.fn().mockResolvedValue({ get: vi.fn().mockReturnValue('127.0.0.1') }),
}))

vi.mock('@/lib/actions/notification', () => ({
  createNotification: vi.fn().mockResolvedValue({ success: true }),
}))
vi.mock('@/lib/services/notification-core', () => ({
  createNotification: vi.fn().mockResolvedValue({ success: true }),
}))

vi.mock('@/lib/sanitize', () => ({
  sanitizePostContent: vi.fn((s: string) => s),
}))

vi.mock('@/lib/services/hashtag-sync', () => ({
  attachHashtagsToPost: vi.fn().mockResolvedValue(undefined),
  detachHashtagsFromPost: vi.fn().mockResolvedValue(undefined),
  extractHashtags: vi.fn().mockReturnValue([]),
}))

vi.mock('@/lib/actions/mention', () => ({
  notifyMentionedUsers: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@/lib/logger', () => ({
  __esModule: true,
  default: { error: vi.fn(), warn: vi.fn(), log: vi.fn() },
}))

vi.mock('@/lib/cache', () => ({
  getCachedGenres: vi.fn().mockResolvedValue([]),
  revalidateTrendingGenresCache: vi.fn(),
  revalidatePopularTagsCache: vi.fn(),
}))

describe('MediaType Validation Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
    mockAuth.mockResolvedValue({ user: { id: mockUser.id } })
    mockPrisma.user.findUnique.mockResolvedValue({
      isSuspended: false,
      isGuest: false,
      email: 'test@example.com',
    })
  })

  describe('createPost - mediaTypes z.enum バリデーション', () => {
    it('有効なmediaType "image" は受け入れられる', async () => {
      mockPrisma.post.create.mockResolvedValue({ ...mockPost, id: 'new-post' })
      mockPrisma.post.count.mockResolvedValue(0)

      const { createPost } = await import('@/lib/actions/post')
      const formData = new FormData()
      formData.append('content', 'テスト投稿')
      formData.append('mediaUrls', 'https://example.com/image.jpg')
      formData.append('mediaTypes', 'image')

      const result = await createPost(formData)

      expect(result).toMatchObject({ success: true })
    })

    it('有効なmediaType "video" は受け入れられる', async () => {
      mockPrisma.post.create.mockResolvedValue({ ...mockPost, id: 'new-post' })
      mockPrisma.post.count.mockResolvedValue(0)

      const { createPost } = await import('@/lib/actions/post')
      const formData = new FormData()
      formData.append('content', 'テスト投稿')
      formData.append('mediaUrls', 'https://example.com/video.mp4')
      formData.append('mediaTypes', 'video')

      const result = await createPost(formData)

      expect(result).toMatchObject({ success: true })
    })

    it('無効なmediaType は Zod バリデーションで拒否される', async () => {
      const { createPost } = await import('@/lib/actions/post')
      const formData = new FormData()
      formData.append('content', 'テスト投稿')
      formData.append('mediaUrls', 'https://example.com/file.exe')
      formData.append('mediaTypes', 'executable')

      const result = await createPost(formData)

      expect(result).toMatchObject({ success: false })
    })

    it('複数の無効なmediaType も拒否される', async () => {
      const { createPost } = await import('@/lib/actions/post')
      const formData = new FormData()
      formData.append('content', 'テスト投稿')
      formData.append('mediaUrls', 'url1')
      formData.append('mediaUrls', 'url2')
      formData.append('mediaTypes', 'image')
      formData.append('mediaTypes', 'malware')

      const result = await createPost(formData)

      expect(result).toMatchObject({ success: false })
    })
  })

  describe('createComment - mediaTypes z.enum バリデーション', () => {
    it('無効なmediaType は Zod バリデーションで拒否される', async () => {
      const { createComment } = await import('@/lib/actions/comment')
      const formData = new FormData()
      formData.append('postId', 'post-1')
      formData.append('content', 'テストコメント')
      formData.append('mediaUrls', 'url1')
      formData.append('mediaTypes', 'invalid_type')

      const result = await createComment(formData)

      expect(result).toMatchObject({ success: false })
    })
  })
})
