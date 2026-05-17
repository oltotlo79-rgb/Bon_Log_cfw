// @vitest-environment node

import { vi, describe, it, expect, beforeEach } from 'vitest'
import { createMockPrismaClient, mockUser } from '../../utils/test-utils'

// Prismaモック
const mockPrisma = createMockPrismaClient()
vi.mock('@/lib/db', () => ({
  prisma: mockPrisma,
}))

// 認証モック
const mockAuth = vi.fn()
vi.mock('@/lib/auth', () => ({
  auth: () => mockAuth(),
}))

vi.mock('next/cache', () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn(), unstable_cache: vi.fn((fn) => fn), cache: vi.fn((fn) => fn) }))

vi.mock('@/lib/rate-limit', () => ({
  checkUserRateLimit: vi.fn().mockResolvedValue({ success: true }),
  checkDailyLimit: vi.fn().mockResolvedValue({ allowed: true }),
  RATE_LIMITS: { post: { limit: 20, window: 60 } },
}))

vi.mock('next/headers', () => ({
  headers: vi.fn().mockResolvedValue({
    get: vi.fn().mockReturnValue('127.0.0.1'),
  }),
}))

vi.mock('@/lib/sanitize', () => ({
  sanitizePostContent: (content: string) => content,
}))

vi.mock('@/lib/premium', () => ({
  getMembershipLimits: vi.fn().mockResolvedValue({
    maxPostLength: 500,
    maxImages: 4,
    maxVideos: 1,
    maxDailyPosts: 20,
  }),
}))

vi.mock('@/lib/redis', () => ({
  getRedisClient: vi.fn().mockReturnValue({
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue('OK'),
    del: vi.fn().mockResolvedValue(1),
  }),
}))

vi.mock('@/lib/services/hashtag-sync', () => ({
  attachHashtagsToPost: vi.fn().mockResolvedValue(undefined),
  detachHashtagsFromPost: vi.fn().mockResolvedValue(undefined),
  extractHashtags: vi.fn().mockReturnValue([]),
}))

vi.mock('@/lib/cache', () => ({
  getCachedGenres: vi.fn().mockResolvedValue({ genres: {}, allGenres: [] }),
  revalidateTrendingGenresCache: vi.fn(),
  revalidatePopularTagsCache: vi.fn(),
}))

vi.mock('@/lib/actions/mention', () => ({
  notifyMentionedUsers: vi.fn().mockResolvedValue(undefined),
}))

import {
  MIN_POLL_OPTIONS,
  MAX_POLL_OPTIONS,
  MAX_POLL_OPTION_LENGTH,
  VALID_POLL_DURATIONS,
} from '@/lib/constants/limits'

/**
 * validatePollOptions はプライベート関数なので、createPost を通してテストする。
 * pollOptions/pollDuration フォームフィールドを使用して間接的にテストする。
 */
describe('validatePollOptions (createPost を通じた間接テスト)', async () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuth.mockResolvedValue({
      user: { id: mockUser.id },
    })
    mockPrisma.user.findUnique.mockResolvedValue({ isSuspended: false })
    mockPrisma.post.count.mockResolvedValue(0)
    mockPrisma.post.create.mockResolvedValue({ id: 'new-post-id' })
    mockPrisma.follow.findMany.mockResolvedValue([])
    mockPrisma.block.findMany.mockResolvedValue([])
    mockPrisma.mute.findMany.mockResolvedValue([])
  })

  it('pollOptionsRaw が null の場合は success: true, pollOptions: [], pollDuration: 0 で通過する', async () => {
    const { createPost } = await import('@/lib/actions/post')
    const formData = new FormData()
    formData.append('content', 'テスト投稿')
    formData.append('genreIds', 'genre-1')
    // pollOptions は設定しない（null 相当）

    const result = await createPost(formData)

    expect(result.success).toBe(true)
  })

  it('pollOptions が不正なJSONの場合はエラーを返す', async () => {
    const { createPost } = await import('@/lib/actions/post')
    const formData = new FormData()
    formData.append('content', 'テスト投稿')
    formData.append('genreIds', 'genre-1')
    formData.append('pollOptions', 'invalid-json')
    formData.append('pollDuration', String(VALID_POLL_DURATIONS[0]))

    const result = await createPost(formData)

    expect(result.success).toBe(false)
    expect('error' in result && result.error).toBeTruthy()
  })

  it('pollOptions が空配列の場合はエラーを返す（MIN_POLL_OPTIONS未満）', async () => {
    const { createPost } = await import('@/lib/actions/post')
    const formData = new FormData()
    formData.append('content', 'テスト投稿')
    formData.append('genreIds', 'genre-1')
    formData.append('pollOptions', JSON.stringify([]))
    formData.append('pollDuration', String(VALID_POLL_DURATIONS[0]))

    const result = await createPost(formData)

    expect(result.success).toBe(false)
    expect('error' in result && result.error).toBeTruthy()
  })

  it(`MIN_POLL_OPTIONS（${MIN_POLL_OPTIONS}）個の選択肢は成功する`, async () => {
    const { createPost } = await import('@/lib/actions/post')
    const formData = new FormData()
    formData.append('content', 'テスト投稿')
    formData.append('genreIds', 'genre-1')
    const options = Array.from({ length: MIN_POLL_OPTIONS }, (_, i) => `選択肢${i + 1}`)
    formData.append('pollOptions', JSON.stringify(options))
    formData.append('pollDuration', String(VALID_POLL_DURATIONS[0]))

    const result = await createPost(formData)

    expect(result.success).toBe(true)
  })

  it(`MAX_POLL_OPTIONS（${MAX_POLL_OPTIONS}）個の選択肢は成功する`, async () => {
    const { createPost } = await import('@/lib/actions/post')
    const formData = new FormData()
    formData.append('content', 'テスト投稿')
    formData.append('genreIds', 'genre-1')
    const options = Array.from({ length: MAX_POLL_OPTIONS }, (_, i) => `選択肢${i + 1}`)
    formData.append('pollOptions', JSON.stringify(options))
    formData.append('pollDuration', String(VALID_POLL_DURATIONS[0]))

    const result = await createPost(formData)

    expect(result.success).toBe(true)
  })

  it(`MAX_POLL_OPTIONS + 1（${MAX_POLL_OPTIONS + 1}）個の選択肢はエラーを返す`, async () => {
    const { createPost } = await import('@/lib/actions/post')
    const formData = new FormData()
    formData.append('content', 'テスト投稿')
    formData.append('genreIds', 'genre-1')
    const options = Array.from({ length: MAX_POLL_OPTIONS + 1 }, (_, i) => `選択肢${i + 1}`)
    formData.append('pollOptions', JSON.stringify(options))
    formData.append('pollDuration', String(VALID_POLL_DURATIONS[0]))

    const result = await createPost(formData)

    expect(result.success).toBe(false)
    expect('error' in result && result.error).toBeTruthy()
  })

  it('空白のみの選択肢はエラーを返す', async () => {
    const { createPost } = await import('@/lib/actions/post')
    const formData = new FormData()
    formData.append('content', 'テスト投稿')
    formData.append('genreIds', 'genre-1')
    formData.append('pollOptions', JSON.stringify(['選択肢1', '   ', '選択肢3']))
    formData.append('pollDuration', String(VALID_POLL_DURATIONS[0]))

    const result = await createPost(formData)

    expect(result.success).toBe(false)
    expect('error' in result && result.error).toBeTruthy()
  })

  it(`MAX_POLL_OPTION_LENGTH（${MAX_POLL_OPTION_LENGTH}）を超える選択肢はエラーを返す`, async () => {
    const { createPost } = await import('@/lib/actions/post')
    const formData = new FormData()
    formData.append('content', 'テスト投稿')
    formData.append('genreIds', 'genre-1')
    const longOption = 'a'.repeat(MAX_POLL_OPTION_LENGTH + 1)
    formData.append('pollOptions', JSON.stringify(['選択肢1', longOption]))
    formData.append('pollDuration', String(VALID_POLL_DURATIONS[0]))

    const result = await createPost(formData)

    expect(result.success).toBe(false)
    expect('error' in result && result.error).toBeTruthy()
  })

  it('無効な投票期間（VALID_POLL_DURATIONSに含まれない値）はエラーを返す', async () => {
    const { createPost } = await import('@/lib/actions/post')
    const formData = new FormData()
    formData.append('content', 'テスト投稿')
    formData.append('genreIds', 'genre-1')
    formData.append('pollOptions', JSON.stringify(['選択肢1', '選択肢2']))
    formData.append('pollDuration', '99999') // 無効な値

    const result = await createPost(formData)

    expect(result.success).toBe(false)
    expect('error' in result && result.error).toBeTruthy()
  })

  it('有効な投票期間は成功する', async () => {
    const { createPost } = await import('@/lib/actions/post')
    const formData = new FormData()
    formData.append('content', 'テスト投稿')
    formData.append('genreIds', 'genre-1')
    formData.append('pollOptions', JSON.stringify(['選択肢1', '選択肢2']))
    formData.append('pollDuration', String(VALID_POLL_DURATIONS[3])) // 86400 (1日)

    const result = await createPost(formData)

    expect(result.success).toBe(true)
  })
})
