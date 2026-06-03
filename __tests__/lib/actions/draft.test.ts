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

describe('Draft Actions', async () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuth.mockResolvedValue({ user: { id: mockUser.id } })
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
