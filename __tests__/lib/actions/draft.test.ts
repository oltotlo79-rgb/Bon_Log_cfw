// @vitest-environment node
import { vi } from 'vitest'
import { createMockPrismaClient, mockUser, mockDraft } from '../../utils/test-utils'

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

// revalidatePathモック
vi.mock('next/cache', () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn(), unstable_cache: vi.fn((fn) => fn), cache: vi.fn((fn) => fn) }))

// レート制限モック（実 Redis 不在時のインメモリフォールバックが同一プロセス内で
// テスト間累積し、後続テストを誤って rate-limit させるのを防ぐ）
vi.mock('@/lib/rate-limit', () => ({
  checkUserRateLimit: vi.fn().mockResolvedValue({ success: true }),
  RATE_LIMITS: { create_draft: { windowMs: 60000, maxRequests: 5 }, update_draft: { windowMs: 60000, maxRequests: 10 }, publish_draft: { windowMs: 60000, maxRequests: 10 }, delete_draft: { windowMs: 60000, maxRequests: 10 } },
}))

// メディア回収はストレージ層に依存するため mock し、削除アクションからの配線（URL 受け渡し）を検証する
const mockDeleteMediaFiles = vi.fn()
vi.mock('@/lib/services/media-cleanup', () => ({
  deleteMediaFiles: (...args: unknown[]) => mockDeleteMediaFiles(...args),
}))

// ロガーモック
vi.mock('@/lib/logger', () => ({
  __esModule: true,
  default: {
    log: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
  logger: {
    log: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}))

// 会員種別に応じた文字数・メディア数上限（saveDraft/publishDraft の再検証で参照）
const FREE_LIMITS = { maxPostLength: 500, maxImages: 4, maxVideos: 0, maxDailyPosts: 20, canSchedulePost: false, canViewAnalytics: false }
const PREMIUM_LIMITS = { maxPostLength: 2000, maxImages: 6, maxVideos: 1, maxDailyPosts: 999, canSchedulePost: true, canViewAnalytics: true }
const mockGetMembershipLimits = vi.fn().mockResolvedValue(FREE_LIMITS)
vi.mock('@/lib/premium', () => ({
  getMembershipLimits: (...args: unknown[]) => mockGetMembershipLimits(...args),
}))

describe('Draft Actions', async () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuth.mockResolvedValue({ user: { id: mockUser.id } })
    mockGetMembershipLimits.mockResolvedValue(FREE_LIMITS)
  })

  // ============================================================
  // getDrafts
  // ============================================================

  describe('getDrafts', async () => {
    it('下書き一覧を取得できる', async () => {
      const mockDrafts = [
        { ...mockDraft, media: [], genres: [] },
      ]
      mockPrisma.draftPost.findMany.mockResolvedValueOnce(mockDrafts)

      const { getDrafts } = await import('@/lib/actions/draft')
      const result = await getDrafts()

      expect(result).toMatchObject({ success: true })
      if (result.success && result.data) {
        expect(result.data.drafts).toHaveLength(1)
        expect(result.data.drafts[0]?.content).toBe(mockDraft.content)
      }
    })

    it('未認証の場合、エラーを返す', async () => {
      mockAuth.mockResolvedValueOnce(null)

      const { getDrafts } = await import('@/lib/actions/draft')
      const result = await getDrafts()

      expect('error' in result && result.error).toBe('認証が必要です')
    })

    it('取得に失敗した場合、エラーを返す', async () => {
      mockPrisma.draftPost.findMany.mockRejectedValueOnce(new Error('Database error'))

      const { getDrafts } = await import('@/lib/actions/draft')
      const result = await getDrafts()

      expect('error' in result && result.error).toBe('下書きの取得に失敗しました')
    })
  })

  // ============================================================
  // getDraftCount
  // ============================================================

  describe('getDraftCount', async () => {
    it('下書きの件数を取得できる', async () => {
      mockPrisma.draftPost.count.mockResolvedValueOnce(5)

      const { getDraftCount } = await import('@/lib/actions/draft')
      const result = await getDraftCount()

      expect(result).toBe(5)
    })

    it('未認証の場合、0を返す', async () => {
      mockAuth.mockResolvedValueOnce(null)

      const { getDraftCount } = await import('@/lib/actions/draft')
      const result = await getDraftCount()

      expect(result).toBe(0)
    })

    it('エラー時は0を返す', async () => {
      mockPrisma.draftPost.count.mockRejectedValueOnce(new Error('Database error'))

      const { getDraftCount } = await import('@/lib/actions/draft')
      const result = await getDraftCount()

      expect(result).toBe(0)
    })
  })

  // ============================================================
  // saveDraft (新規作成)
  // ============================================================

  describe('saveDraft - 新規作成', async () => {
    it('新規下書きを作成できる', async () => {
      const newDraft = { ...mockDraft, media: [], genres: [] }
      mockPrisma.draftPost.create.mockResolvedValueOnce(newDraft)

      const { saveDraft } = await import('@/lib/actions/draft')
      const result = await saveDraft({
        content: '下書きの内容',
        mediaUrls: [],
        genreIds: [],
      })

      expect(result).toMatchObject({ success: true, data: { draft: expect.any(Object) } })
      expect(mockPrisma.draftPost.create).toHaveBeenCalled()
    })

    it('メディアとジャンル付きで作成できる', async () => {
      const newDraft = {
        ...mockDraft,
        media: [{ url: '/image.jpg', type: 'image', sortOrder: 0 }],
        genres: [{ genreId: 'genre-1', genre: { id: 'genre-1', name: '黒松' } }],
      }
      mockPrisma.draftPost.create.mockResolvedValueOnce(newDraft)

      const { saveDraft } = await import('@/lib/actions/draft')
      const result = await saveDraft({
        content: '下書きの内容',
        mediaUrls: ['/image.jpg'],
        genreIds: ['genre-1'],
      })

      expect(result).toMatchObject({ success: true, data: { draft: expect.any(Object) } })
    })

    it('未認証の場合、エラーを返す', async () => {
      mockAuth.mockResolvedValueOnce(null)

      const { saveDraft } = await import('@/lib/actions/draft')
      const result = await saveDraft({ content: 'テスト' })

      expect('error' in result && result.error).toBe('認証が必要です')
    })
  })

  // ============================================================
  // saveDraft - 会員種別に応じた文字数・メディア数バリデーション
  // ============================================================

  describe('saveDraft - 会員種別バリデーション', async () => {
    it('プレミアム会員は501〜2000字の下書きを保存できる', async () => {
      mockGetMembershipLimits.mockResolvedValueOnce(PREMIUM_LIMITS)
      const longContent = 'あ'.repeat(1500)
      mockPrisma.draftPost.create.mockResolvedValueOnce({
        ...mockDraft,
        content: longContent,
        media: [],
        genres: [],
      })

      const { saveDraft } = await import('@/lib/actions/draft')
      const result = await saveDraft({ content: longContent, mediaUrls: [], genreIds: [] })

      expect(result).toMatchObject({ success: true })
    })

    it('プレミアム会員は5〜6枚の画像を保存できる', async () => {
      mockGetMembershipLimits.mockResolvedValueOnce(PREMIUM_LIMITS)
      const mediaUrls = Array.from({ length: 6 }, (_, i) => `/image-${i}.jpg`)
      mockPrisma.draftPost.create.mockResolvedValueOnce({
        ...mockDraft,
        media: mediaUrls.map((url, i) => ({ url, type: 'image', sortOrder: i })),
        genres: [],
      })

      const { saveDraft } = await import('@/lib/actions/draft')
      const result = await saveDraft({ content: '内容', mediaUrls, genreIds: [] })

      expect(result).toMatchObject({ success: true })
    })

    it('無料会員は501字以上の下書きをERR_POST_CONTENT_TOO_LONGで拒否される', async () => {
      mockGetMembershipLimits.mockResolvedValueOnce(FREE_LIMITS)
      const overContent = 'あ'.repeat(501)

      const { saveDraft } = await import('@/lib/actions/draft')
      const result = await saveDraft({ content: overContent })

      expect('error' in result && result.error).toContain('500')
      expect(mockPrisma.draftPost.create).not.toHaveBeenCalled()
    })

    it('無料会員は5枚以上の画像をエラーで拒否される（maxImages超過）', async () => {
      mockGetMembershipLimits.mockResolvedValueOnce(FREE_LIMITS)
      const mediaUrls = Array.from({ length: 5 }, (_, i) => `/image-${i}.jpg`)

      const { saveDraft } = await import('@/lib/actions/draft')
      const result = await saveDraft({ content: '内容', mediaUrls })

      expect('error' in result).toBe(true)
      expect(mockPrisma.draftPost.create).not.toHaveBeenCalled()
    })

    it('無料会員はちょうど500字なら保存できる（境界値）', async () => {
      mockGetMembershipLimits.mockResolvedValueOnce(FREE_LIMITS)
      const exactContent = 'あ'.repeat(500)
      mockPrisma.draftPost.create.mockResolvedValueOnce({
        ...mockDraft,
        content: exactContent,
        media: [],
        genres: [],
      })

      const { saveDraft } = await import('@/lib/actions/draft')
      const result = await saveDraft({ content: exactContent })

      expect(result).toMatchObject({ success: true })
    })
  })

  // ============================================================
  // saveDraft (更新)
  // ============================================================

  describe('saveDraft - 更新', async () => {
    it('既存の下書きを更新できる', async () => {
      mockPrisma.draftPost.findFirst.mockResolvedValueOnce(mockDraft)
      mockPrisma.$transaction.mockResolvedValueOnce([{ count: 0 }, { count: 0 }])
      mockPrisma.draftPost.update.mockResolvedValueOnce({
        ...mockDraft,
        content: '更新された内容',
        media: [],
        genres: [],
      })

      const { saveDraft } = await import('@/lib/actions/draft')
      const result = await saveDraft({
        id: mockDraft.id,
        content: '更新された内容',
      })

      expect(result).toMatchObject({ success: true })
      if (result.success && result.data) {
        expect(result.data.draft).toBeDefined()
        expect(result.data.draft?.content).toBe('更新された内容')
      }
    })

    it('存在しない下書きの更新はエラーを返す', async () => {
      mockPrisma.draftPost.findFirst.mockResolvedValueOnce(null)

      const { saveDraft } = await import('@/lib/actions/draft')
      const result = await saveDraft({
        id: 'nonexistent-id',
        content: '更新',
      })

      expect('error' in result && result.error).toBe('下書きが見つかりません')
    })

    it('DB エラー時はエラーを返す', async () => {
      mockPrisma.draftPost.create.mockRejectedValueOnce(new Error('DB error'))

      const { saveDraft } = await import('@/lib/actions/draft')
      const result = await saveDraft({
        content: '下書きの内容',
      })

      expect('error' in result && result.error).toBe('下書きの保存に失敗しました')
    })
  })

  // ============================================================
  // publishDraft
  // ============================================================

  describe('publishDraft', async () => {
    it('下書きから投稿を作成できる', async () => {
      mockPrisma.draftPost.findFirst.mockResolvedValueOnce({
        ...mockDraft,
        media: [],
        genres: [],
      })
      mockPrisma.post.create.mockResolvedValueOnce({ id: 'new-post-id' })
      mockPrisma.draftPost.delete.mockResolvedValueOnce(mockDraft)

      const { publishDraft } = await import('@/lib/actions/draft')
      const result = await publishDraft(mockDraft.id)

      expect(result).toMatchObject({ success: true, data: { postId: 'new-post-id' } })
      expect(mockPrisma.draftPost.delete).toHaveBeenCalled()
    })

    it('メディアとジャンル付きで投稿できる', async () => {
      mockPrisma.draftPost.findFirst.mockResolvedValueOnce({
        ...mockDraft,
        media: [{ url: '/image.jpg', type: 'image', sortOrder: 0 }],
        genres: [{ genreId: 'genre-1' }],
      })
      mockPrisma.post.create.mockResolvedValueOnce({ id: 'new-post-id' })
      mockPrisma.draftPost.delete.mockResolvedValueOnce(mockDraft)

      const { publishDraft } = await import('@/lib/actions/draft')
      const result = await publishDraft(mockDraft.id)

      expect(result).toMatchObject({ success: true, data: { postId: 'new-post-id' } })
    })

    it('未認証の場合、エラーを返す', async () => {
      mockAuth.mockResolvedValueOnce(null)

      const { publishDraft } = await import('@/lib/actions/draft')
      const result = await publishDraft(mockDraft.id)

      expect('error' in result && result.error).toBe('認証が必要です')
    })

    it('下書きが見つからない場合、エラーを返す', async () => {
      mockPrisma.draftPost.findFirst.mockResolvedValueOnce(null)

      const { publishDraft } = await import('@/lib/actions/draft')
      const result = await publishDraft('nonexistent-id')

      expect('error' in result && result.error).toBe('下書きが見つかりません')
    })

    it('投稿作成に失敗した場合、エラーを返す', async () => {
      mockPrisma.draftPost.findFirst.mockResolvedValueOnce({
        ...mockDraft,
        media: [],
        genres: [],
      })
      mockPrisma.post.create.mockRejectedValueOnce(new Error('Database error'))

      const { publishDraft } = await import('@/lib/actions/draft')
      const result = await publishDraft(mockDraft.id)

      expect('error' in result && result.error).toBe('投稿の作成に失敗しました')
    })

    it('降格後の再検証: プレミアム期間中に保存した長文の下書きを、失効後の無料会員として公開しようとすると拒否される', async () => {
      const longContent = 'あ'.repeat(1500)
      mockPrisma.draftPost.findFirst.mockResolvedValueOnce({
        ...mockDraft,
        content: longContent,
        media: [],
        genres: [],
      })
      // 公開時点では無料会員に降格済み
      mockGetMembershipLimits.mockResolvedValueOnce(FREE_LIMITS)

      const { publishDraft } = await import('@/lib/actions/draft')
      const result = await publishDraft(mockDraft.id)

      expect('error' in result && result.error).toContain('500')
      expect(mockPrisma.post.create).not.toHaveBeenCalled()
      expect(mockPrisma.draftPost.delete).not.toHaveBeenCalled()
    })

    it('降格後の再検証: プレミアム期間中に保存した5枚の画像付き下書きを、失効後の無料会員として公開しようとすると拒否される', async () => {
      const media = Array.from({ length: 5 }, (_, i) => ({ url: `/image-${i}.jpg`, type: 'image', sortOrder: i }))
      mockPrisma.draftPost.findFirst.mockResolvedValueOnce({
        ...mockDraft,
        media,
        genres: [],
      })
      mockGetMembershipLimits.mockResolvedValueOnce(FREE_LIMITS)

      const { publishDraft } = await import('@/lib/actions/draft')
      const result = await publishDraft(mockDraft.id)

      expect('error' in result).toBe(true)
      expect(mockPrisma.post.create).not.toHaveBeenCalled()
    })

    it('プレミアム会員のまま公開する場合は501〜2000字・5〜6枚でも成功する', async () => {
      const longContent = 'あ'.repeat(1500)
      const media = Array.from({ length: 6 }, (_, i) => ({ url: `/image-${i}.jpg`, type: 'image', sortOrder: i }))
      mockPrisma.draftPost.findFirst.mockResolvedValueOnce({
        ...mockDraft,
        content: longContent,
        media,
        genres: [],
      })
      mockGetMembershipLimits.mockResolvedValueOnce(PREMIUM_LIMITS)
      mockPrisma.post.create.mockResolvedValueOnce({ id: 'new-post-id' })
      mockPrisma.draftPost.delete.mockResolvedValueOnce(mockDraft)

      const { publishDraft } = await import('@/lib/actions/draft')
      const result = await publishDraft(mockDraft.id)

      expect(result).toMatchObject({ success: true, data: { postId: 'new-post-id' } })
    })
  })

  // ============================================================
  // deleteDraft
  // ============================================================

  describe('deleteDraft', async () => {
    it('下書きを削除でき、メディア実体も回収する', async () => {
      mockPrisma.draftPost.findFirst.mockResolvedValueOnce({
        ...mockDraft,
        media: [{ url: 'https://cdn/draft-a.webp' }, { url: 'https://cdn/draft-b.webp' }],
      })
      mockPrisma.draftPost.delete.mockResolvedValueOnce(mockDraft)

      const { deleteDraft } = await import('@/lib/actions/draft')
      const result = await deleteDraft(mockDraft.id)

      expect(result).toEqual({ success: true })
      expect(mockDeleteMediaFiles).toHaveBeenCalledWith([
        'https://cdn/draft-a.webp',
        'https://cdn/draft-b.webp',
      ])
    })

    it('未認証の場合、エラーを返す', async () => {
      mockAuth.mockResolvedValueOnce(null)

      const { deleteDraft } = await import('@/lib/actions/draft')
      const result = await deleteDraft(mockDraft.id)

      expect('error' in result && result.error).toBe('認証が必要です')
    })

    it('下書きが見つからない場合、エラーを返す', async () => {
      mockPrisma.draftPost.findFirst.mockResolvedValueOnce(null)

      const { deleteDraft } = await import('@/lib/actions/draft')
      const result = await deleteDraft('nonexistent-id')

      expect('error' in result && result.error).toBe('下書きが見つかりません')
    })

    it('削除に失敗した場合、エラーを返す', async () => {
      mockPrisma.draftPost.findFirst.mockResolvedValueOnce(mockDraft)
      mockPrisma.draftPost.delete.mockRejectedValueOnce(new Error('Database error'))

      const { deleteDraft } = await import('@/lib/actions/draft')
      const result = await deleteDraft(mockDraft.id)

      expect('error' in result && result.error).toBe('下書きの削除に失敗しました')
    })
  })

  // ============================================================
  // getDraft
  // ============================================================

  describe('saveDraft - 更新のメディアとジャンル', async () => {
    it('メディアとジャンル付きで既存の下書きを更新できる', async () => {
      mockPrisma.draftPost.findFirst.mockResolvedValueOnce(mockDraft)
      mockPrisma.$transaction.mockResolvedValueOnce([{ count: 0 }, { count: 0 }])
      mockPrisma.draftPost.update.mockResolvedValueOnce({
        ...mockDraft,
        content: '更新された内容',
        media: [{ url: '/new-image.jpg', type: 'image', sortOrder: 0 }],
        genres: [{ genreId: 'genre-2', genre: { id: 'genre-2', name: '五葉松' } }],
      })

      const { saveDraft } = await import('@/lib/actions/draft')
      const result = await saveDraft({
        id: mockDraft.id,
        content: '更新された内容',
        mediaUrls: ['/new-image.jpg'],
        genreIds: ['genre-2'],
      })

      expect(result).toMatchObject({ success: true, data: { draft: expect.any(Object) } })
    })
  })

  describe('publishDraft - エラーケース', async () => {
    it('未認証の場合、エラーを返す（publishDraft）', async () => {
      mockAuth.mockResolvedValueOnce(null)

      const { publishDraft } = await import('@/lib/actions/draft')
      const result = await publishDraft(mockDraft.id)

      expect('error' in result && result.error).toBe('認証が必要です')
    })
  })

  describe('getDraft', async () => {
    it('下書き詳細を取得できる', async () => {
      mockPrisma.draftPost.findFirst.mockResolvedValueOnce({
        ...mockDraft,
        media: [],
        genres: [],
      })

      const { getDraft } = await import('@/lib/actions/draft')
      const result = await getDraft(mockDraft.id)

      expect(result).toMatchObject({ success: true })
      if (result.success && result.data) {
        expect(result.data.draft).toBeDefined()
        expect(result.data.draft?.content).toBe(mockDraft.content)
      }
    })

    it('未認証の場合、エラーを返す', async () => {
      mockAuth.mockResolvedValueOnce(null)

      const { getDraft } = await import('@/lib/actions/draft')
      const result = await getDraft(mockDraft.id)

      expect('error' in result && result.error).toBe('認証が必要です')
    })

    it('下書きが見つからない場合、エラーを返す', async () => {
      mockPrisma.draftPost.findFirst.mockResolvedValueOnce(null)

      const { getDraft } = await import('@/lib/actions/draft')
      const result = await getDraft('nonexistent-id')

      expect('error' in result && result.error).toBe('下書きが見つかりません')
    })

    it('取得に失敗した場合、エラーを返す', async () => {
      mockPrisma.draftPost.findFirst.mockRejectedValueOnce(new Error('Database error'))

      const { getDraft } = await import('@/lib/actions/draft')
      const result = await getDraft(mockDraft.id)

      expect('error' in result && result.error).toBe('下書きの取得に失敗しました')
    })
  })
})
