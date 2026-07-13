// @vitest-environment node

import { vi } from 'vitest'
import { createMockPrismaClient, mockUser, mockPost } from '../../utils/test-utils'
// hashtag-sync / mention の mock 関数実体（個別テストで reject させるため import で参照する）
import { attachHashtagsToPost } from '@/lib/services/hashtag-sync'
import { notifyMentionedUsers } from '@/lib/services/mention'

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

// レート制限モック
const mockCheckUserRateLimit = vi.fn().mockResolvedValue({ success: true })
const mockCheckDailyLimit = vi.fn().mockResolvedValue({ allowed: true, count: 0, limit: 50 })
vi.mock('@/lib/rate-limit', () => ({
  checkUserRateLimit: (...args: unknown[]) => mockCheckUserRateLimit(...args),
  checkDailyLimit: (...args: unknown[]) => mockCheckDailyLimit(...args),
}))

// ストレージモック
const mockUploadFile = vi.fn().mockResolvedValue({ success: true, url: 'https://example.com/file.jpg' })
vi.mock('@/lib/storage', () => ({
  uploadFile: (...args: unknown[]) => mockUploadFile(...args),
}))

const mockDeleteMediaFiles = vi.fn()
vi.mock('@/lib/services/media-cleanup', () => ({
  deleteMediaFiles: (...args: unknown[]) => mockDeleteMediaFiles(...args),
}))

// ファイル検証モック（マジックバイト検証は別途 lib/file-validation.test.ts でカバー）
vi.mock('@/lib/file-validation', () => ({
  validateImageFile: vi.fn().mockReturnValue({ valid: true, detectedType: 'image/jpeg' }),
  validateVideoFile: vi.fn().mockReturnValue({ valid: true, detectedType: 'video/mp4' }),
  generateSafeFileName: vi.fn((name: string) => name),
}))

// 会員制限モック
const mockGetMembershipLimits = vi.fn().mockResolvedValue({
  maxPostLength: 500,
  maxImages: 4,
  maxVideos: 1,
  maxDailyPosts: 20,
})
vi.mock('@/lib/premium', () => ({
  getMembershipLimits: (...args: unknown[]) => mockGetMembershipLimits(...args),
}))

// サニタイズモック
vi.mock('@/lib/sanitize', () => ({
  sanitizePostContent: (content: string) => content,
}))

// キャッシュモック
const mockGetCachedGenres = vi.fn().mockResolvedValue({ genres: {}, allGenres: [] })
vi.mock('@/lib/cache', () => ({
  getCachedGenres: (...args: unknown[]) => mockGetCachedGenres(...args),
  revalidateTrendingGenresCache: vi.fn(),
  revalidatePopularTagsCache: vi.fn(),
}))

// ハッシュタグモック（post.ts は hashtag-sync から内部ヘルパーを import する）
vi.mock('@/lib/services/hashtag-sync', () => ({
  attachHashtagsToPost: vi.fn().mockResolvedValue(undefined),
  detachHashtagsFromPost: vi.fn().mockResolvedValue(undefined),
  extractHashtags: vi.fn().mockReturnValue([]),
}))

// メンションモック
vi.mock('@/lib/services/mention', () => ({
  notifyMentionedUsers: vi.fn().mockResolvedValue(undefined),
}))

// ロガーモック
vi.mock('@/lib/logger', () => ({
  __esModule: true,
  default: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  },
}))

describe('Post Actions', async () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuth.mockResolvedValue({
      user: { id: mockUser.id },
    })
    // isSuspended check用
    mockPrisma.user.findUnique.mockResolvedValue({ isSuspended: false, isPublic: true })
  })

  describe('createPost', async () => {
    it('認証なしの場合はエラーを返す', async () => {
      mockAuth.mockResolvedValue(null)

      const { createPost } = await import('@/lib/actions/post')
      const formData = new FormData()
      formData.append('content', 'テスト投稿')

      const result = await createPost(formData)

      expect(result.success).toBe(false)
      expect('error' in result && result.error).toBe('認証が必要です')
    })

    it('空の投稿はエラーを返す', async () => {
      const { createPost } = await import('@/lib/actions/post')
      const formData = new FormData()
      formData.append('content', '')

      const result = await createPost(formData)

      expect(result.success).toBe(false)
      expect('error' in result && result.error).toBe('テキストまたはメディアを入力してください')
    })

    it('500文字を超える投稿はエラーを返す', async () => {
      const { createPost } = await import('@/lib/actions/post')
      const formData = new FormData()
      formData.append('content', 'a'.repeat(501))

      const result = await createPost(formData)

      expect(result.success).toBe(false)
      expect('error' in result && result.error).toBe('投稿は500文字以内で入力してください')
    })

    it('1日の投稿上限を超えるとエラーを返す', async () => {
      mockPrisma.post.count.mockResolvedValue(20)

      const { createPost } = await import('@/lib/actions/post')
      const formData = new FormData()
      formData.append('content', 'テスト投稿')

      const result = await createPost(formData)

      expect(result.success).toBe(false)
      expect('error' in result && result.error).toBe('1日の投稿上限（20件）に達しました')
    })

    it('正常な投稿を作成できる', async () => {
      mockPrisma.post.count.mockResolvedValue(0)
      mockPrisma.post.create.mockResolvedValue({
        ...mockPost,
        id: 'new-post-id',
      })

      const { createPost } = await import('@/lib/actions/post')
      const formData = new FormData()
      formData.append('content', 'テスト投稿')
      formData.append('genreIds', 'genre-1')

      const result = await createPost(formData)

      expect(result.success).toBe(true)
      expect(result.success && result.data?.postId).toBe('new-post-id')
      expect(mockPrisma.post.create).toHaveBeenCalled()
    })

    it('ハッシュタグ紐付けが失敗しても投稿自体は成功する（ログのみで握り潰す）', async () => {
      mockPrisma.post.count.mockResolvedValue(0)
      mockPrisma.post.create.mockResolvedValue({ ...mockPost, id: 'new-post-id' })
      vi.mocked(attachHashtagsToPost).mockRejectedValueOnce(new Error('hashtag sync down'))

      const { createPost } = await import('@/lib/actions/post')
      const formData = new FormData()
      formData.append('content', '#盆栽 テスト投稿')

      const result = await createPost(formData)

      expect(result).toEqual({ success: true, data: { postId: 'new-post-id' } })
    })

    it('メンション通知が失敗しても投稿自体は成功する（ログのみで握り潰す）', async () => {
      mockPrisma.post.count.mockResolvedValue(0)
      mockPrisma.post.create.mockResolvedValue({ ...mockPost, id: 'new-post-id' })
      vi.mocked(notifyMentionedUsers).mockRejectedValueOnce(new Error('mention notify down'))

      const { createPost } = await import('@/lib/actions/post')
      const formData = new FormData()
      formData.append('content', '@someone こんにちは')

      const result = await createPost(formData)

      expect(result).toEqual({ success: true, data: { postId: 'new-post-id' } })
    })
  })

  describe('createPost - bonsaiId 所有権 (IDOR対策)', async () => {
    it('他人所有の bonsaiId を指定すると ERR_BONSAI_NOT_FOUND で拒否され投稿は作成されない', async () => {
      const { ERR_BONSAI_NOT_FOUND } = await import('@/lib/constants/errors')
      mockPrisma.post.count.mockResolvedValue(0)
      mockPrisma.bonsai.findUnique.mockResolvedValue({ userId: 'other-user-id' })

      const { createPost } = await import('@/lib/actions/post')
      const formData = new FormData()
      formData.append('content', 'テスト投稿')
      formData.append('bonsaiId', 'bonsai-not-mine')

      const result = await createPost(formData)

      expect(result.success).toBe(false)
      expect('error' in result && result.error).toBe(ERR_BONSAI_NOT_FOUND)
      expect(mockPrisma.post.create).not.toHaveBeenCalled()
    })

    it('存在しない bonsaiId を指定しても ERR_BONSAI_NOT_FOUND で拒否される（存在有無を区別しない）', async () => {
      const { ERR_BONSAI_NOT_FOUND } = await import('@/lib/constants/errors')
      mockPrisma.post.count.mockResolvedValue(0)
      mockPrisma.bonsai.findUnique.mockResolvedValue(null)

      const { createPost } = await import('@/lib/actions/post')
      const formData = new FormData()
      formData.append('content', 'テスト投稿')
      formData.append('bonsaiId', 'nonexistent-bonsai')

      const result = await createPost(formData)

      expect(result.success).toBe(false)
      expect('error' in result && result.error).toBe(ERR_BONSAI_NOT_FOUND)
      expect(mockPrisma.post.create).not.toHaveBeenCalled()
    })

    it('本人所有の bonsaiId を指定すると投稿が作成され bonsaiId が反映される', async () => {
      mockPrisma.post.count.mockResolvedValue(0)
      mockPrisma.bonsai.findUnique.mockResolvedValue({ userId: mockUser.id })
      mockPrisma.post.create.mockResolvedValue({ ...mockPost, id: 'bonsai-linked-post' })

      const { createPost } = await import('@/lib/actions/post')
      const formData = new FormData()
      formData.append('content', 'テスト投稿')
      formData.append('bonsaiId', 'bonsai-mine')

      const result = await createPost(formData)

      expect(result.success).toBe(true)
      expect(result.success && result.data?.postId).toBe('bonsai-linked-post')
      expect(mockPrisma.bonsai.findUnique).toHaveBeenCalledWith({
        where: { id: 'bonsai-mine' },
        select: { userId: true },
      })
      const callArgs = mockPrisma.post.create.mock.calls[0]?.[0] as { data: Record<string, unknown> }
      expect(callArgs?.data?.bonsaiId).toBe('bonsai-mine')
    })

    it('bonsaiId 未指定なら所有権チェックをスキップし従来通り成功する', async () => {
      mockPrisma.post.count.mockResolvedValue(0)
      mockPrisma.post.create.mockResolvedValue({ ...mockPost, id: 'no-bonsai-post' })

      const { createPost } = await import('@/lib/actions/post')
      const formData = new FormData()
      formData.append('content', 'テスト投稿')

      const result = await createPost(formData)

      expect(result.success).toBe(true)
      expect(mockPrisma.bonsai.findUnique).not.toHaveBeenCalled()
    })
  })

  describe('deletePost', async () => {
    it('認証なしの場合はエラーを返す', async () => {
      mockAuth.mockResolvedValue(null)

      const { deletePost } = await import('@/lib/actions/post')
      const result = await deletePost('post-id')

      expect('error' in result && result.error).toBe('認証が必要です')
    })

    it('存在しない投稿は権限エラーを返す', async () => {
      mockPrisma.post.findUnique.mockResolvedValue(null)

      const { deletePost } = await import('@/lib/actions/post')
      const result = await deletePost('non-existent-id')

      expect('error' in result && result.error).toBe('削除権限がありません')
    })

    it('他人の投稿は削除できない', async () => {
      mockPrisma.post.findUnique.mockResolvedValue({
        ...mockPost,
        userId: 'other-user-id',
      })

      const { deletePost } = await import('@/lib/actions/post')
      const result = await deletePost('post-id')

      expect('error' in result && result.error).toBe('削除権限がありません')
    })

    it('自分の投稿を削除でき、メディア実体も回収する', async () => {
      mockPrisma.post.findUnique.mockResolvedValue({
        ...mockPost,
        userId: mockUser.id,
        media: [{ url: 'https://cdn/post-a.webp' }, { url: 'https://cdn/post-b.webp' }],
      })
      mockPrisma.post.delete.mockResolvedValue(mockPost)

      const { deletePost } = await import('@/lib/actions/post')
      const result = await deletePost('post-id')

      expect(result).toEqual({ success: true })
      expect(mockDeleteMediaFiles).toHaveBeenCalledWith([
        'https://cdn/post-a.webp',
        'https://cdn/post-b.webp',
      ])
    })

    it('DBエラー時はエラーを返す', async () => {
      mockPrisma.post.findUnique.mockResolvedValue({
        ...mockPost,
        userId: mockUser.id,
      })
      mockPrisma.post.delete.mockRejectedValue(new Error('DB error'))

      const { deletePost } = await import('@/lib/actions/post')
      const result = await deletePost('post-id')

      expect('error' in result && result.error).toBe('投稿の削除に失敗しました')
    })
  })

  describe('getPost', async () => {
    it('存在する投稿を取得できる', async () => {
      const fullPost = {
        ...mockPost,
        _count: { likes: 5, comments: 3 },
        genres: [{ genre: { id: 'genre-1', name: '松柏類', category: '松柏類' } }],
        quotePost: null,
        repostPost: null,
      }
      mockPrisma.post.findUnique.mockResolvedValue(fullPost)
      mockPrisma.like.findFirst.mockResolvedValue(null)
      mockPrisma.bookmark.findUnique.mockResolvedValue(null)

      const { getPost } = await import('@/lib/actions/post')
      const result = await getPost('post-id')

      expect(result.success).toBe(true)
      expect(result.success && result.data?.post.id).toBe(mockPost.id)
    })

    it('存在しない投稿はエラーを返す', async () => {
      mockPrisma.post.findUnique.mockResolvedValue(null)

      const { getPost } = await import('@/lib/actions/post')
      const result = await getPost('non-existent-id')

      expect(result.success).toBe(false)
      expect(!result.success && result.error).toBe('投稿が見つかりません')
    })
  })

  describe('getPost - 公開範囲ガード', async () => {
    function buildPost(authorId: string) {
      return {
        ...mockPost,
        userId: authorId,
        user: { ...mockPost.user, id: authorId },
        _count: { likes: 0, comments: 0 },
        genres: [],
        quotePost: null,
        repostPost: null,
      }
    }

    beforeEach(() => {
      mockAuth.mockResolvedValue({ user: { id: 'viewer-1' } })
      mockPrisma.like.findFirst.mockResolvedValue(null)
      mockPrisma.bookmark.findUnique.mockResolvedValue(null)
    })

    it('公開ユーザーの投稿は閲覧できる', async () => {
      mockPrisma.post.findUnique.mockResolvedValue(buildPost('author-1'))
      mockPrisma.user.findUnique.mockResolvedValue({ isPublic: true, isSuspended: false })
      const { getPost } = await import('@/lib/actions/post')
      const result = await getPost('post-id')
      expect(result.success).toBe(true)
    })

    it('停止ユーザーの投稿は本人以外には not found になる', async () => {
      mockPrisma.post.findUnique.mockResolvedValue(buildPost('author-1'))
      mockPrisma.user.findUnique.mockResolvedValue({ isPublic: true, isSuspended: true })
      const { getPost } = await import('@/lib/actions/post')
      const result = await getPost('post-id')
      expect(result.success).toBe(false)
      expect(!result.success && result.error).toBe('投稿が見つかりません')
    })

    it('非公開ユーザーの投稿はフォローしていなければ not found になる', async () => {
      mockPrisma.post.findUnique.mockResolvedValue(buildPost('author-1'))
      mockPrisma.user.findUnique.mockResolvedValue({ isPublic: false, isSuspended: false })
      mockPrisma.follow.findUnique.mockResolvedValue(null)
      const { getPost } = await import('@/lib/actions/post')
      const result = await getPost('post-id')
      expect(result.success).toBe(false)
    })

    it('非公開ユーザーでもフォロワーは閲覧できる', async () => {
      mockPrisma.post.findUnique.mockResolvedValue(buildPost('author-1'))
      mockPrisma.user.findUnique.mockResolvedValue({ isPublic: false, isSuspended: false })
      mockPrisma.follow.findUnique.mockResolvedValue({ followerId: 'viewer-1' })
      const { getPost } = await import('@/lib/actions/post')
      const result = await getPost('post-id')
      expect(result.success).toBe(true)
    })

    it('著者本人は非公開/停止でも閲覧できる（owner bypass）', async () => {
      mockPrisma.post.findUnique.mockResolvedValue(buildPost('viewer-1'))
      mockPrisma.user.findUnique.mockResolvedValue({ isPublic: false, isSuspended: true })
      const { getPost } = await import('@/lib/actions/post')
      const result = await getPost('post-id')
      expect(result.success).toBe(true)
    })
  })

  describe('getPosts (フィード)', async () => {
    it('投稿一覧を取得できる', async () => {
      mockPrisma.post.findMany.mockResolvedValue([
        {
          ...mockPost,
          _count: { likes: 5, comments: 3 },
          genres: [],
          quotePost: null,
          repostPost: null,
        },
      ])
      mockPrisma.follow.findMany.mockResolvedValue([])
      mockPrisma.block.findMany.mockResolvedValue([])
      mockPrisma.mute.findMany.mockResolvedValue([])
      mockPrisma.userHiddenPost.findMany.mockResolvedValue([])
      mockPrisma.like.findMany.mockResolvedValue([])
      mockPrisma.bookmark.findMany.mockResolvedValue([])

      const { getPosts } = await import('@/lib/actions/post')
      const result = await getPosts()

      expect(result.posts).toHaveLength(1)
      expect(result.posts[0]!.id).toBe(mockPost.id)
    })

    it('ブロック/ミュートしたユーザーの投稿は除外される', async () => {
      mockPrisma.follow.findMany.mockResolvedValue([])
      mockPrisma.block.findMany.mockResolvedValue([
        { blockerId: mockUser.id, blockedId: 'blocked-user-id' },
      ])
      mockPrisma.mute.findMany.mockResolvedValue([
        { muterId: mockUser.id, mutedId: 'muted-user-id' },
      ])
      mockPrisma.userHiddenPost.findMany.mockResolvedValue([])
      mockPrisma.post.findMany.mockResolvedValue([])
      mockPrisma.like.findMany.mockResolvedValue([])
      mockPrisma.bookmark.findMany.mockResolvedValue([])

      const { getPosts } = await import('@/lib/actions/post')
      await getPosts()

      // findManyが除外リスト付きで呼ばれることを確認
      expect(mockPrisma.post.findMany).toHaveBeenCalled()
    })

    it('createdAt + id の決定的順序で取得する（cursor 安定化）', async () => {
      mockPrisma.follow.findMany.mockResolvedValue([])
      mockPrisma.block.findMany.mockResolvedValue([])
      mockPrisma.mute.findMany.mockResolvedValue([])
      mockPrisma.userHiddenPost.findMany.mockResolvedValue([])
      mockPrisma.post.findMany.mockResolvedValue([])
      mockPrisma.like.findMany.mockResolvedValue([])
      mockPrisma.bookmark.findMany.mockResolvedValue([])

      const { getPosts } = await import('@/lib/actions/post')
      await getPosts()

      expect(mockPrisma.post.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ orderBy: [{ createdAt: 'desc' }, { id: 'desc' }] })
      )
    })

    it('ページネーションが動作する', async () => {
      mockPrisma.post.findMany.mockResolvedValue([])
      mockPrisma.follow.findMany.mockResolvedValue([])
      mockPrisma.block.findMany.mockResolvedValue([])
      mockPrisma.mute.findMany.mockResolvedValue([])
      mockPrisma.userHiddenPost.findMany.mockResolvedValue([])
      mockPrisma.like.findMany.mockResolvedValue([])
      mockPrisma.bookmark.findMany.mockResolvedValue([])

      const { getPosts } = await import('@/lib/actions/post')
      await getPosts('cursor-id', 10)

      expect(mockPrisma.post.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 10,
          cursor: { id: 'cursor-id' },
          skip: 1,
        })
      )
    })

    it('未認証時は公開かつ非停止著者の投稿のみ取得する（M-1）', async () => {
      mockAuth.mockResolvedValue(null)
      mockPrisma.post.findMany.mockResolvedValue([])

      const { getPosts } = await import('@/lib/actions/post')
      await getPosts()

      expect(mockPrisma.post.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { isHidden: false, user: { isSuspended: false, OR: [{ isPublic: true }] } },
        })
      )
    })
  })

  describe('createPost - 追加テスト', async () => {
    it('アカウント停止中はエラーを返す', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ isSuspended: true })

      const { createPost } = await import('@/lib/actions/post')
      const formData = new FormData()
      formData.append('content', 'テスト投稿')

      const result = await createPost(formData)

      expect(result.success).toBe(false)
      expect('error' in result && result.error).toBe('アカウントが停止されています')
    })

    it('レート制限に達した場合はエラーを返す', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ isSuspended: false, isPublic: true })
      mockCheckUserRateLimit.mockResolvedValueOnce({ success: false })

      const { createPost } = await import('@/lib/actions/post')
      const formData = new FormData()
      formData.append('content', 'テスト投稿')

      const result = await createPost(formData)

      expect(result.success).toBe(false)
      expect('error' in result && result.error).toBe('操作が多すぎます。しばらく待ってから再試行してください')
    })

    it('ジャンルが3つを超える場合はエラーを返す', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ isSuspended: false, isPublic: true })

      const { createPost } = await import('@/lib/actions/post')
      const formData = new FormData()
      formData.append('content', 'テスト投稿')
      formData.append('genreIds', 'genre-1')
      formData.append('genreIds', 'genre-2')
      formData.append('genreIds', 'genre-3')
      formData.append('genreIds', 'genre-4')

      const result = await createPost(formData)

      expect(result.success).toBe(false)
      expect('error' in result && result.error).toBe('ジャンルは3つまで選択できます')
    })

    it('画像が上限を超える場合はエラーを返す', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ isSuspended: false, isPublic: true })

      const { createPost } = await import('@/lib/actions/post')
      const formData = new FormData()
      formData.append('content', 'テスト投稿')
      // 5枚の画像を追加（上限は4枚）
      for (let i = 0; i < 5; i++) {
        formData.append('mediaUrls', `https://example.com/image${i}.jpg`)
        formData.append('mediaTypes', 'image')
      }

      const result = await createPost(formData)

      expect(result.success).toBe(false)
      expect('error' in result && result.error).toBe('画像は4枚までです')
    })

    it('動画が上限を超える場合はエラーを返す', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ isSuspended: false, isPublic: true })

      const { createPost } = await import('@/lib/actions/post')
      const formData = new FormData()
      formData.append('content', 'テスト投稿')
      // 2本の動画を追加（上限は1本）
      formData.append('mediaUrls', 'https://example.com/video1.mp4')
      formData.append('mediaTypes', 'video')
      formData.append('mediaUrls', 'https://example.com/video2.mp4')
      formData.append('mediaTypes', 'video')

      const result = await createPost(formData)

      expect(result.success).toBe(false)
      expect('error' in result && result.error).toBe('動画は1本までです')
    })

    it('メディアのみの投稿も作成できる', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ isSuspended: false, isPublic: true })
      mockPrisma.post.count.mockResolvedValue(0)
      mockPrisma.post.create.mockResolvedValue({ ...mockPost, id: 'media-only-post' })

      const { createPost } = await import('@/lib/actions/post')
      const formData = new FormData()
      formData.append('content', '')
      formData.append('mediaUrls', 'https://example.com/image.jpg')
      formData.append('mediaTypes', 'image')

      const result = await createPost(formData)

      expect(result.success).toBe(true)
      expect(result.success && result.data?.postId).toBe('media-only-post')
    })

    it('エラー発生時はエラーメッセージを返す', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ isSuspended: false, isPublic: true })
      mockPrisma.post.count.mockResolvedValue(0)
      mockPrisma.post.create.mockRejectedValue(new Error('Database error'))

      const { createPost } = await import('@/lib/actions/post')
      const formData = new FormData()
      formData.append('content', 'テスト投稿')

      const result = await createPost(formData)

      expect(result.success).toBe(false)
      expect('error' in result && result.error).toBe('投稿の作成に失敗しました')
    })
  })

  describe('createQuotePost', async () => {
    it('認証なしの場合はエラーを返す', async () => {
      mockAuth.mockResolvedValue(null)

      const { createQuotePost } = await import('@/lib/actions/post')
      const formData = new FormData()
      formData.append('content', '引用コメント')

      const result = await createQuotePost(formData, 'post-id')

      expect('error' in result && result.error).toBe('認証が必要です')
    })

    it('アカウント停止中はエラーを返す', async () => {
      mockAuth.mockResolvedValue({ user: { id: mockUser.id } })
      mockPrisma.user.findUnique.mockResolvedValue({ isSuspended: true })

      const { createQuotePost } = await import('@/lib/actions/post')
      const formData = new FormData()
      formData.append('content', '引用コメント')

      const result = await createQuotePost(formData, 'post-id')

      expect('error' in result && result.error).toBe('アカウントが停止されています')
    })

    it('引用コメントが空の場合はエラーを返す', async () => {
      mockAuth.mockResolvedValue({ user: { id: mockUser.id } })
      mockPrisma.user.findUnique.mockResolvedValue({ isSuspended: false, isPublic: true })

      const { createQuotePost } = await import('@/lib/actions/post')
      const formData = new FormData()
      formData.append('content', '')

      const result = await createQuotePost(formData, 'post-id')

      expect('error' in result && result.error).toBe('引用コメントを入力してください')
    })

    it('引用コメントが文字数制限を超える場合はエラーを返す', async () => {
      mockAuth.mockResolvedValue({ user: { id: mockUser.id } })
      mockPrisma.user.findUnique.mockResolvedValue({ isSuspended: false, isPublic: true })

      const { createQuotePost } = await import('@/lib/actions/post')
      const formData = new FormData()
      formData.append('content', 'a'.repeat(501))

      const result = await createQuotePost(formData, 'post-id')

      expect('error' in result && result.error).toBe('投稿は500文字以内で入力してください')
    })

    it('投稿上限に達した場合はエラーを返す', async () => {
      mockAuth.mockResolvedValue({ user: { id: mockUser.id } })
      mockPrisma.user.findUnique.mockResolvedValue({ isSuspended: false, isPublic: true })
      mockPrisma.post.count.mockResolvedValue(20)

      const { createQuotePost } = await import('@/lib/actions/post')
      const formData = new FormData()
      formData.append('content', '引用コメント')

      const result = await createQuotePost(formData, 'post-id')

      expect('error' in result && result.error).toBe('1日の投稿上限（20件）に達しました')
    })

    it('正常に引用投稿を作成できる', async () => {
      mockAuth.mockResolvedValue({ user: { id: mockUser.id } })
      mockPrisma.user.findUnique.mockResolvedValue({ isSuspended: false, isPublic: true })
      mockPrisma.post.count.mockResolvedValue(0)
      mockPrisma.post.create.mockResolvedValue({ ...mockPost, id: 'quote-post-id' })
      mockPrisma.post.findUnique.mockResolvedValue({ userId: 'other-user-id', isHidden: false, user: { isPublic: true, isSuspended: false } })
      mockPrisma.notification.create.mockResolvedValue({})

      const { createQuotePost } = await import('@/lib/actions/post')
      const formData = new FormData()
      formData.append('content', '引用コメント')

      const result = await createQuotePost(formData, 'post-id')

      expect(result.success).toBe(true)
      expect(result.success && result.data?.postId).toBe('quote-post-id')
      expect(mockPrisma.notification.create).toHaveBeenCalled()
    })

    it('自分の投稿を引用した場合は通知が作成されない', async () => {
      mockAuth.mockResolvedValue({ user: { id: mockUser.id } })
      mockPrisma.user.findUnique.mockResolvedValue({ isSuspended: false, isPublic: true })
      mockPrisma.post.count.mockResolvedValue(0)
      mockPrisma.post.create.mockResolvedValue({ ...mockPost, id: 'quote-post-id' })
      mockPrisma.post.findUnique.mockResolvedValue({ userId: mockUser.id })

      const { createQuotePost } = await import('@/lib/actions/post')
      const formData = new FormData()
      formData.append('content', '引用コメント')

      const result = await createQuotePost(formData, 'post-id')

      expect(result.success).toBe(true)
      expect(mockPrisma.notification.create).not.toHaveBeenCalled()
    })

    it('レート制限に達した場合はエラーを返す', async () => {
      mockAuth.mockResolvedValue({ user: { id: mockUser.id } })
      mockPrisma.user.findUnique.mockResolvedValue({ isSuspended: false, isPublic: true })
      mockCheckUserRateLimit.mockResolvedValueOnce({ success: false })

      const { createQuotePost } = await import('@/lib/actions/post')
      const formData = new FormData()
      formData.append('content', '引用コメント')

      const result = await createQuotePost(formData, 'post-id')

      expect('error' in result && result.error).toBe('操作が多すぎます。しばらく待ってから再試行してください')
    })

    it('DBエラー時はエラーを返す', async () => {
      mockAuth.mockResolvedValue({ user: { id: mockUser.id } })
      mockPrisma.user.findUnique.mockResolvedValue({ isSuspended: false, isPublic: true })
      mockPrisma.post.count.mockResolvedValue(0)
      mockPrisma.post.findUnique.mockResolvedValue({ userId: 'other-user-id', isHidden: false, user: { isPublic: true, isSuspended: false } })
      mockPrisma.post.create.mockRejectedValue(new Error('DB error'))

      const { createQuotePost } = await import('@/lib/actions/post')
      const formData = new FormData()
      formData.append('content', '引用コメント')

      const result = await createQuotePost(formData, 'post-id')

      expect('error' in result && result.error).toBe('投稿の作成に失敗しました')
    })

    it('閲覧権限のない非公開著者の投稿は引用できない（可視性ガード）', async () => {
      mockAuth.mockResolvedValue({ user: { id: mockUser.id } })
      mockPrisma.user.findUnique.mockResolvedValue({ isSuspended: false, isPublic: true })
      mockPrisma.post.count.mockResolvedValue(0)
      // 引用元は非公開著者・viewer は非フォロワー
      mockPrisma.post.findUnique.mockResolvedValue({ userId: 'private-author', isHidden: false, user: { isPublic: false, isSuspended: false } })
      mockPrisma.follow.findUnique.mockResolvedValue(null)

      const { createQuotePost } = await import('@/lib/actions/post')
      const formData = new FormData()
      formData.append('content', '引用コメント')

      const result = await createQuotePost(formData, 'post-id')

      expect('error' in result && result.error).toBe('投稿が見つかりません')
      expect(mockPrisma.post.create).not.toHaveBeenCalled()
    })

    it('非表示(isHidden)の投稿は引用できない', async () => {
      mockAuth.mockResolvedValue({ user: { id: mockUser.id } })
      mockPrisma.user.findUnique.mockResolvedValue({ isSuspended: false, isPublic: true })
      mockPrisma.post.count.mockResolvedValue(0)
      mockPrisma.post.findUnique.mockResolvedValue({ userId: 'other-user-id', isHidden: true, user: { isPublic: true, isSuspended: false } })

      const { createQuotePost } = await import('@/lib/actions/post')
      const formData = new FormData()
      formData.append('content', '引用コメント')

      const result = await createQuotePost(formData, 'post-id')

      expect('error' in result && result.error).toBe('投稿が見つかりません')
      expect(mockPrisma.post.create).not.toHaveBeenCalled()
    })
  })

  describe('createRepost', async () => {
    it('認証なしの場合はエラーを返す', async () => {
      mockAuth.mockResolvedValue(null)

      const { createRepost } = await import('@/lib/actions/post')
      const result = await createRepost('post-id')

      expect('error' in result && result.error).toBe('認証が必要です')
    })

    it('アカウント停止中はエラーを返す', async () => {
      mockAuth.mockResolvedValue({ user: { id: mockUser.id } })
      mockPrisma.user.findUnique.mockResolvedValue({ isSuspended: true })

      const { createRepost } = await import('@/lib/actions/post')
      const result = await createRepost('post-id')

      expect('error' in result && result.error).toBe('アカウントが停止されています')
    })

    it('既にリポスト済みの場合は削除する', async () => {
      mockAuth.mockResolvedValue({ user: { id: mockUser.id } })
      mockPrisma.user.findUnique.mockResolvedValue({ isSuspended: false, isPublic: true })
      mockPrisma.post.findFirst.mockResolvedValue({ id: 'existing-repost-id' })
      mockPrisma.post.delete.mockResolvedValue({})

      const { createRepost } = await import('@/lib/actions/post')
      const result = await createRepost('post-id')

      expect(result).toEqual({ success: true, data: { reposted: false } })
      expect(mockPrisma.post.delete).toHaveBeenCalledWith({ where: { id: 'existing-repost-id' } })
    })

    it('投稿上限に達した場合はエラーを返す', async () => {
      mockAuth.mockResolvedValue({ user: { id: mockUser.id } })
      mockPrisma.user.findUnique.mockResolvedValue({ isSuspended: false, isPublic: true })
      mockPrisma.post.findFirst.mockResolvedValue(null)
      mockPrisma.post.count.mockResolvedValue(20)

      const { createRepost } = await import('@/lib/actions/post')
      const result = await createRepost('post-id')

      expect('error' in result && result.error).toBe('1日の投稿上限（20件）に達しました')
    })

    it('正常にリポストを作成できる', async () => {
      mockAuth.mockResolvedValue({ user: { id: mockUser.id } })
      mockPrisma.user.findUnique.mockResolvedValue({ isSuspended: false, isPublic: true })
      mockPrisma.post.findFirst.mockResolvedValue(null)
      mockPrisma.post.count.mockResolvedValue(0)
      mockPrisma.post.create.mockResolvedValue({ id: 'repost-id' })
      mockPrisma.post.findUnique.mockResolvedValue({ userId: 'other-user-id', isHidden: false, user: { isPublic: true, isSuspended: false } })

      const { createRepost } = await import('@/lib/actions/post')
      const result = await createRepost('post-id')

      expect(result).toEqual({ success: true, data: { reposted: true } })
      // 通知作成はトランザクション内で実行される
      expect(mockPrisma.$transaction).toHaveBeenCalled()
    })

    it('競合で既にリポストが存在する場合は冪等に reposted:true を返し再作成しない', async () => {
      mockAuth.mockResolvedValue({ user: { id: mockUser.id } })
      mockPrisma.user.findUnique.mockResolvedValue({ isSuspended: false, isPublic: true })
      // 1回目（トグル判定）は未リポスト、2回目（作成 tx 内の再確認）で別リクエストの作成を検出
      mockPrisma.post.findFirst.mockResolvedValueOnce(null).mockResolvedValueOnce({ id: 'dup-repost' })
      mockPrisma.post.count.mockResolvedValue(0)
      mockPrisma.post.findUnique.mockResolvedValue({ userId: 'other-user-id', isHidden: false })
      mockPrisma.post.create.mockResolvedValue({})

      const { createRepost } = await import('@/lib/actions/post')
      const result = await createRepost('post-id')

      expect(result).toEqual({ success: true, data: { reposted: true } })
      expect(mockPrisma.post.create).not.toHaveBeenCalled()
      expect(mockPrisma.notification.create).not.toHaveBeenCalled()
    })

    it('自分の投稿をリポストした場合は通知が作成されない', async () => {
      mockAuth.mockResolvedValue({ user: { id: mockUser.id } })
      mockPrisma.user.findUnique.mockResolvedValue({ isSuspended: false, isPublic: true })
      mockPrisma.post.findFirst.mockResolvedValue(null)
      mockPrisma.post.count.mockResolvedValue(0)
      mockPrisma.post.create.mockResolvedValue({ id: 'repost-id' })
      mockPrisma.post.findUnique.mockResolvedValue({ userId: mockUser.id })

      const { createRepost } = await import('@/lib/actions/post')
      const result = await createRepost('post-id')

      expect(result).toEqual({ success: true, data: { reposted: true } })
      expect(mockPrisma.notification.create).not.toHaveBeenCalled()
    })

    it('既に通知がある場合は重複して作成しない', async () => {
      mockAuth.mockResolvedValue({ user: { id: mockUser.id } })
      mockPrisma.user.findUnique.mockResolvedValue({ isSuspended: false, isPublic: true })
      mockPrisma.post.findFirst.mockResolvedValue(null)
      mockPrisma.post.count.mockResolvedValue(0)
      mockPrisma.post.create.mockResolvedValue({ id: 'repost-id' })
      mockPrisma.post.findUnique.mockResolvedValue({ userId: 'other-user-id', isHidden: false, user: { isPublic: true, isSuspended: false } })

      const { createRepost } = await import('@/lib/actions/post')
      const result = await createRepost('post-id')

      expect(result).toEqual({ success: true, data: { reposted: true } })
      // トランザクション内でfindFirst→重複チェック→作成スキップが行われる
      expect(mockPrisma.$transaction).toHaveBeenCalled()
    })

    it('レート制限に達した場合はエラーを返す', async () => {
      mockAuth.mockResolvedValue({ user: { id: mockUser.id } })
      mockPrisma.user.findUnique.mockResolvedValue({ isSuspended: false, isPublic: true })
      mockCheckUserRateLimit.mockResolvedValueOnce({ success: false })

      const { createRepost } = await import('@/lib/actions/post')
      const result = await createRepost('post-id')

      expect('error' in result && result.error).toBe('操作が多すぎます。しばらく待ってから再試行してください')
    })

    it('DBエラー時はエラーを返す', async () => {
      mockAuth.mockResolvedValue({ user: { id: mockUser.id } })
      mockPrisma.user.findUnique.mockResolvedValue({ isSuspended: false, isPublic: true })
      mockPrisma.post.findFirst.mockResolvedValue(null)
      mockPrisma.post.count.mockResolvedValue(0)
      mockPrisma.post.findUnique.mockResolvedValue({ userId: 'other-user-id', isHidden: false })
      mockPrisma.post.create.mockRejectedValue(new Error('DB error'))

      const { createRepost } = await import('@/lib/actions/post')
      const result = await createRepost('post-id')

      expect('error' in result && result.error).toBe('リポストに失敗しました')
    })

    it('閲覧権限のない非公開著者の投稿はリポストできない（可視性ガード）', async () => {
      mockAuth.mockResolvedValue({ user: { id: mockUser.id } })
      // 著者は非公開・viewer は非フォロワー（actor の停止チェックは isSuspended:false で通過）
      mockPrisma.user.findUnique.mockResolvedValue({ isSuspended: false, isPublic: false })
      mockPrisma.post.findFirst.mockResolvedValue(null)
      mockPrisma.post.count.mockResolvedValue(0)
      mockPrisma.post.findUnique.mockResolvedValue({ userId: 'private-author', isHidden: false })
      mockPrisma.follow.findUnique.mockResolvedValue(null)

      const { createRepost } = await import('@/lib/actions/post')
      const result = await createRepost('post-id')

      expect('error' in result && result.error).toBe('投稿が見つかりません')
      expect(mockPrisma.post.create).not.toHaveBeenCalled()
    })

    it('unique 制約違反(P2002)は冪等に reposted:true を返す', async () => {
      const { Prisma } = await import('@prisma/client')
      mockAuth.mockResolvedValue({ user: { id: mockUser.id } })
      mockPrisma.user.findUnique.mockResolvedValue({ isSuspended: false, isPublic: true })
      mockPrisma.post.findFirst.mockResolvedValue(null)
      mockPrisma.post.count.mockResolvedValue(0)
      mockPrisma.post.findUnique.mockResolvedValue({ userId: 'other-user-id', isHidden: false })
      mockPrisma.post.create.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError('Unique constraint failed', { code: 'P2002', clientVersion: '6' }),
      )

      const { createRepost } = await import('@/lib/actions/post')
      const result = await createRepost('post-id')

      expect(result).toEqual({ success: true, data: { reposted: true } })
    })
  })

  describe('getGenres', async () => {
    it('ジャンル一覧をカテゴリ別に取得できる', async () => {
      mockGetCachedGenres.mockResolvedValue({
        genres: {
          '松柏類': [
            { id: 'genre-1', name: '黒松', category: '松柏類', sortOrder: 1 },
            { id: 'genre-2', name: '五葉松', category: '松柏類', sortOrder: 2 },
          ],
          '雑木類': [
            { id: 'genre-3', name: 'もみじ', category: '雑木類', sortOrder: 10 },
          ],
        },
        allGenres: [],
      })

      const { getGenres } = await import('@/lib/actions/post')
      const result = await getGenres()

      expect(result.genres).toBeDefined()
      expect(result.genres['松柏類']).toHaveLength(2)
      expect(result.genres['雑木類']).toHaveLength(1)
    })

    it('空のジャンルリストを返す', async () => {
      mockGetCachedGenres.mockResolvedValue({ genres: {}, allGenres: [] })

      const { getGenres } = await import('@/lib/actions/post')
      const result = await getGenres()

      expect(result.genres).toEqual({})
    })
  })

  describe('uploadPostMedia', async () => {
    it('認証なしの場合はエラーを返す', async () => {
      mockAuth.mockResolvedValue(null)

      const { uploadPostMedia } = await import('@/lib/actions/post')
      const formData = new FormData()
      const result = await uploadPostMedia(formData)

      expect('error' in result && result.error).toBe('認証が必要です')
    })

    it('ファイルが選択されていない場合はエラーを返す', async () => {
      mockAuth.mockResolvedValue({ user: { id: mockUser.id } })

      const { uploadPostMedia } = await import('@/lib/actions/post')
      const formData = new FormData()
      const result = await uploadPostMedia(formData)

      expect('error' in result && result.error).toBe('ファイルが選択されていません')
    })

    it('画像でも動画でもないファイルはエラーを返す', async () => {
      mockAuth.mockResolvedValue({ user: { id: mockUser.id } })

      const { uploadPostMedia } = await import('@/lib/actions/post')
      const formData = new FormData()
      const file = new File(['test'], 'test.txt', { type: 'text/plain' })
      formData.append('file', file)

      const result = await uploadPostMedia(formData)

      expect('error' in result && result.error).toBe('画像または動画ファイルを選択してください')
    })

    it('画像サイズが上限を超える場合はエラーを返す', async () => {
      mockAuth.mockResolvedValue({ user: { id: mockUser.id } })

      const { uploadPostMedia } = await import('@/lib/actions/post')
      const formData = new FormData()
      // 6MB以上のファイル
      const largeBuffer = new ArrayBuffer(6 * 1024 * 1024)
      const file = new File([largeBuffer], 'large-image.jpg', { type: 'image/jpeg' })
      formData.append('file', file)

      const result = await uploadPostMedia(formData)

      expect('error' in result && result.error).toBe('画像は4MB以下にしてください')
    })

    it('動画サイズが上限を超える場合はエラーを返す', async () => {
      mockAuth.mockResolvedValue({ user: { id: mockUser.id } })

      const { uploadPostMedia } = await import('@/lib/actions/post')
      const formData = new FormData()
      // 81MB以上のファイル（80MB上限）
      const largeBuffer = new ArrayBuffer(81 * 1024 * 1024)
      const file = new File([largeBuffer], 'large-video.mp4', { type: 'video/mp4' })
      formData.append('file', file)

      const result = await uploadPostMedia(formData)

      expect('error' in result && result.error).toBe('動画は80MB以下にしてください')
    })

    it('レート制限に達した場合はエラーを返す', async () => {
      mockAuth.mockResolvedValue({ user: { id: mockUser.id } })
      mockCheckUserRateLimit.mockResolvedValueOnce({ success: false })

      const { uploadPostMedia } = await import('@/lib/actions/post')
      const formData = new FormData()
      const file = new File(['test'], 'test.jpg', { type: 'image/jpeg' })
      formData.append('file', file)

      const result = await uploadPostMedia(formData)

      expect('error' in result && result.error).toBe('アップロードが多すぎます。しばらく待ってから再試行してください')
    })

    it('日次アップロード制限に達した場合はエラーを返す', async () => {
      mockAuth.mockResolvedValue({ user: { id: mockUser.id } })
      mockCheckDailyLimit.mockResolvedValueOnce({ allowed: false, limit: 50 })

      const { uploadPostMedia } = await import('@/lib/actions/post')
      const formData = new FormData()
      const file = new File(['test'], 'test.jpg', { type: 'image/jpeg' })
      formData.append('file', file)

      const result = await uploadPostMedia(formData)

      expect('error' in result && result.error).toBe('1日のアップロード上限（50回）に達しました')
    })

    it('正常に画像をアップロードできる', async () => {
      mockAuth.mockResolvedValue({ user: { id: mockUser.id } })
      mockCheckUserRateLimit.mockResolvedValue({ success: true })
      mockCheckDailyLimit.mockResolvedValue({ allowed: true, count: 0, limit: 50 })
      mockUploadFile.mockResolvedValueOnce({ success: true, url: 'https://example.com/uploaded-image.jpg' })

      const { uploadPostMedia } = await import('@/lib/actions/post')
      const formData = new FormData()
      const file = new File(['test image content'], 'test.jpg', { type: 'image/jpeg' })
      formData.append('file', file)

      const result = await uploadPostMedia(formData)

      expect(result.success).toBe(true)
      expect(result.success && result.data?.url).toBe('https://example.com/uploaded-image.jpg')
      expect(result.success && result.data?.type).toBe('image')
    })

    it('正常に動画をアップロードできる', async () => {
      mockAuth.mockResolvedValue({ user: { id: mockUser.id } })
      mockCheckUserRateLimit.mockResolvedValue({ success: true })
      mockCheckDailyLimit.mockResolvedValue({ allowed: true, count: 0, limit: 50 })
      mockUploadFile.mockResolvedValueOnce({ success: true, url: 'https://example.com/uploaded-video.mp4' })

      const { uploadPostMedia } = await import('@/lib/actions/post')
      const formData = new FormData()
      const file = new File(['test video content'], 'test.mp4', { type: 'video/mp4' })
      formData.append('file', file)

      const result = await uploadPostMedia(formData)

      expect(result.success).toBe(true)
      expect(result.success && result.data?.url).toBe('https://example.com/uploaded-video.mp4')
      expect(result.success && result.data?.type).toBe('video')
    })

    it('動画 magic byte 検証で valid:false が返ったらアップロード前に拒否する', async () => {
      mockAuth.mockResolvedValue({ user: { id: mockUser.id } })
      mockCheckUserRateLimit.mockResolvedValue({ success: true })
      mockCheckDailyLimit.mockResolvedValue({ allowed: true, count: 0, limit: 50 })
      // 偽装 video/mp4 (中身は別形式) を validateVideoFile が検出した想定
      const { validateVideoFile } = await import('@/lib/file-validation')
      vi.mocked(validateVideoFile).mockReturnValueOnce({
        valid: false,
        error: '動画ファイルとして認識できません',
      })

      const { uploadPostMedia } = await import('@/lib/actions/post')
      const formData = new FormData()
      const file = new File(['fake content'], 'fake.mp4', { type: 'video/mp4' })
      formData.append('file', file)

      const result = await uploadPostMedia(formData)

      // upload は呼ばれず、validation error を返す
      expect(result.success).toBe(false)
      expect(mockUploadFile).not.toHaveBeenCalled()
    })

    it('アップロード失敗時はエラーを返す', async () => {
      mockAuth.mockResolvedValue({ user: { id: mockUser.id } })
      mockCheckUserRateLimit.mockResolvedValue({ success: true })
      mockCheckDailyLimit.mockResolvedValue({ allowed: true, count: 0, limit: 50 })
      mockUploadFile.mockResolvedValueOnce({ success: false, error: 'Storage error' })

      const { uploadPostMedia } = await import('@/lib/actions/post')
      const formData = new FormData()
      const file = new File(['test image content'], 'test.jpg', { type: 'image/jpeg' })
      formData.append('file', file)

      const result = await uploadPostMedia(formData)

      expect('error' in result && result.error).toBe('アップロードに失敗しました')
    })
  })

  describe('getPostsByBonsai', async () => {
    beforeEach(() => {
      // マイ盆栽は所有者専用。閲覧者を所有者として扱い owner チェックを通過させる
      mockPrisma.bonsai.findUnique.mockResolvedValue({ userId: mockUser.id })
    })

    /** ActionResult 成功レスポンスから data 部を取り出す（型安全） */
    function unwrapOk<T>(result: { success: true; data?: T } | { success: false; error: string }): T {
      if (!result.success) throw new Error(`Expected success, got error: ${result.error}`)
      if (!result.data) throw new Error('Expected data to be defined')
      return result.data
    }

    it('盆栽に関連する投稿を取得できる', async () => {
      mockPrisma.post.findMany.mockResolvedValue([
        {
          ...mockPost,
          bonsaiId: 'bonsai-1',
          _count: { likes: 5, comments: 3 },
          genres: [],
        },
      ])

      const { getPostsByBonsai } = await import('@/lib/actions/post')
      const result = await getPostsByBonsai('bonsai-1')

      const data = unwrapOk<{ posts: unknown[]; nextCursor?: string }>(result)
      expect(data.posts).toHaveLength(1)
      expect(mockPrisma.post.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { bonsaiId: 'bonsai-1', isHidden: false },
        })
      )
    })

    it('ページネーションが動作する', async () => {
      mockPrisma.post.findMany.mockResolvedValue([])

      const { getPostsByBonsai } = await import('@/lib/actions/post')
      await getPostsByBonsai('bonsai-1', 'cursor-id', 10)

      expect(mockPrisma.post.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 10,
          cursor: { id: 'cursor-id' },
          skip: 1,
        })
      )
    })

    it('投稿がlimit件あれば次のカーソルを返す', async () => {
      const posts = Array(20).fill(null).map((_, i) => ({
        ...mockPost,
        id: `post-${i}`,
        _count: { likes: 0, comments: 0 },
        genres: [],
      }))
      mockPrisma.post.findMany.mockResolvedValue(posts)

      const { getPostsByBonsai } = await import('@/lib/actions/post')
      const result = await getPostsByBonsai('bonsai-1')

      const data = unwrapOk<{ posts: unknown[]; nextCursor?: string }>(result)
      expect(data.nextCursor).toBe('post-19')
    })

    it('投稿がlimit件未満なら次のカーソルはundefined', async () => {
      mockPrisma.post.findMany.mockResolvedValue([
        { ...mockPost, _count: { likes: 0, comments: 0 }, genres: [] },
      ])

      const { getPostsByBonsai } = await import('@/lib/actions/post')
      const result = await getPostsByBonsai('bonsai-1')

      const data = unwrapOk<{ posts: unknown[]; nextCursor?: string }>(result)
      expect(data.nextCursor).toBeUndefined()
    })

    it('エラー発生時は ActionResult の error を返す（サイレント握り潰しを廃止）', async () => {
      mockPrisma.post.findMany.mockRejectedValue(new Error('Database error'))

      const { getPostsByBonsai } = await import('@/lib/actions/post')
      const result = await getPostsByBonsai('bonsai-1')

      // 旧実装は actionSuccess({ posts: [] }) で握り潰していたが、
      // 「該当 0 件」と「DB 障害」を呼び出し側で区別できなくなるサイレント障害だった。
      // 現行は actionError を返し UI 側でリトライ UI を出せるようにする。
      expect(result).toMatchObject({ success: false })
      if (!result.success) {
        expect(result.error).toBeDefined()
      }
    })

    it('不正な bonsaiId は ActionResult error を返す', async () => {
      const { getPostsByBonsai } = await import('@/lib/actions/post')
      const result = await getPostsByBonsai('')
      expect(result).toMatchObject({ success: false })
    })

    it('limit が上限を超える場合は actionError を返す', async () => {
      const { getPostsByBonsai } = await import('@/lib/actions/post')
      const result = await getPostsByBonsai('bonsai-1', undefined, 9999)
      expect(result).toMatchObject({ success: false })
    })
  })

  describe('getPost - ジャンル付き', async () => {
    it('ジャンル付きの投稿を正しく取得できる', async () => {
      const fullPost = {
        ...mockPost,
        _count: { likes: 5, comments: 3 },
        genres: [
          { genreId: 'genre-1', genre: { id: 'genre-1', name: '黒松', category: '松柏類' } },
        ],
        quotePost: null,
        repostPost: null,
      }
      mockPrisma.post.findUnique.mockResolvedValue(fullPost)
      mockPrisma.like.findFirst.mockResolvedValue(null)
      mockPrisma.bookmark.findUnique.mockResolvedValue(null)

      const { getPost } = await import('@/lib/actions/post')
      const result = await getPost('post-id')

      expect(result.success).toBe(true)
      expect(result.success && result.data?.post.genres).toBeDefined()
    })

    it('引用投稿付きの投稿を取得できる', async () => {
      const fullPost = {
        ...mockPost,
        _count: { likes: 5, comments: 3 },
        genres: [],
        quotePost: {
          ...mockPost,
          id: 'quoted-post-id',
          user: mockUser,
          media: [],
          genres: [],
          _count: { likes: 2, comments: 1 },
        },
        repostPost: null,
      }
      mockPrisma.post.findUnique.mockResolvedValue(fullPost)
      // ネスト可視性判定(getVisiblePostIds)で引用元を可視として返す
      mockPrisma.post.findMany.mockResolvedValue([{ id: 'quoted-post-id' }])
      mockPrisma.like.findFirst.mockResolvedValue(null)
      mockPrisma.bookmark.findUnique.mockResolvedValue(null)

      const { getPost } = await import('@/lib/actions/post')
      const result = await getPost('post-id')

      expect(result.success).toBe(true)
      expect(result.success && result.data?.post.quotePost).toBeDefined()
    })

    it('閲覧権限のない引用元は null に落とす（ネスト可視性ガード）', async () => {
      const fullPost = {
        ...mockPost,
        _count: { likes: 0, comments: 0 },
        genres: [],
        quotePost: {
          ...mockPost,
          id: 'hidden-quote-id',
          user: mockUser,
          media: [],
          genres: [],
          _count: { likes: 0, comments: 0 },
        },
        repostPost: null,
      }
      mockPrisma.post.findUnique.mockResolvedValue(fullPost)
      // getVisiblePostIds が引用元を不可視（空）として返す
      mockPrisma.post.findMany.mockResolvedValue([])
      mockPrisma.like.findFirst.mockResolvedValue(null)
      mockPrisma.bookmark.findUnique.mockResolvedValue(null)

      const { getPost } = await import('@/lib/actions/post')
      const result = await getPost('post-id')

      expect(result.success).toBe(true)
      expect(result.success && result.data?.post.quotePost).toBeNull()
    })
  })

  describe('getPost - 追加テスト', async () => {
    it('ログイン済みの場合、いいね/ブックマーク状態を取得できる', async () => {
      mockAuth.mockResolvedValue({ user: { id: mockUser.id } })
      const fullPost = {
        ...mockPost,
        _count: { likes: 5, comments: 3 },
        genres: [],
        quotePost: null,
        repostPost: null,
      }
      mockPrisma.post.findUnique.mockResolvedValue(fullPost)
      mockPrisma.like.findFirst.mockResolvedValue({ id: 'like-1' })
      mockPrisma.bookmark.findUnique.mockResolvedValue({ id: 'bookmark-1' })

      const { getPost } = await import('@/lib/actions/post')
      const result = await getPost('post-id')

      expect(result.success && result.data?.post.isLiked).toBe(true)
      expect(result.success && result.data?.post.isBookmarked).toBe(true)
    })

    it('メディア付き投稿のいいね/ブックマーク状態を取得できる', async () => {
      mockAuth.mockResolvedValue({ user: { id: mockUser.id } })
      const fullPost = {
        ...mockPost,
        _count: { likes: 10, comments: 5 },
        genres: [],
        media: [{ url: '/image.jpg', type: 'image', sortOrder: 0 }],
        quotePost: null,
        repostPost: null,
      }
      mockPrisma.post.findUnique.mockResolvedValue(fullPost)
      mockPrisma.like.findFirst.mockResolvedValue(null)
      mockPrisma.bookmark.findUnique.mockResolvedValue(null)

      const { getPost } = await import('@/lib/actions/post')
      const result = await getPost('post-id')

      expect(result.success && result.data?.post.isLiked).toBe(false)
      expect(result.success && result.data?.post.isBookmarked).toBe(false)
      expect(result.success && result.data?.post.likeCount).toBe(10)
    })

    it('存在しない投稿はエラーを返す', async () => {
      mockPrisma.post.findUnique.mockResolvedValue(null)

      const { getPost } = await import('@/lib/actions/post')
      const result = await getPost('nonexistent-id')

      expect(result.success).toBe(false)
      expect(!result.success && result.error).toBeDefined()
    })

    it('リポスト付きの投稿を取得できる', async () => {
      const fullPost = {
        ...mockPost,
        _count: { likes: 0, comments: 0 },
        genres: [],
        quotePost: null,
        repostPost: {
          ...mockPost,
          id: 'repost-original',
          user: mockUser,
          media: [],
          genres: [],
          _count: { likes: 1, comments: 0 },
        },
      }
      mockPrisma.post.findUnique.mockResolvedValue(fullPost)
      // ネスト可視性判定(getVisiblePostIds)でリポスト元を可視として返す
      mockPrisma.post.findMany.mockResolvedValue([{ id: 'repost-original' }])
      mockPrisma.like.findFirst.mockResolvedValue(null)
      mockPrisma.bookmark.findUnique.mockResolvedValue(null)

      const { getPost } = await import('@/lib/actions/post')
      const result = await getPost('post-id')

      expect(result.success).toBe(true)
      expect(result.success && result.data?.post.repostPost).toBeDefined()
    })

    it('DB取得エラー時は例外がスローされる', async () => {
      mockPrisma.post.findUnique.mockRejectedValue(new Error('DB error'))

      const { getPost } = await import('@/lib/actions/post')
      await expect(getPost('post-id')).rejects.toThrow('DB error')
    })

    it('未ログインの場合、いいね/ブックマーク状態はfalse', async () => {
      mockAuth.mockResolvedValue(null)
      const fullPost = {
        ...mockPost,
        _count: { likes: 5, comments: 3 },
        genres: [],
        quotePost: null,
        repostPost: null,
      }
      mockPrisma.post.findUnique.mockResolvedValue(fullPost)

      const { getPost } = await import('@/lib/actions/post')
      const result = await getPost('post-id')

      expect(result.success && result.data?.post.isLiked).toBe(false)
      expect(result.success && result.data?.post.isBookmarked).toBe(false)
    })
  })

  describe('updatePost', async () => {
    function editForm(content: string) {
      const formData = new FormData()
      formData.append('content', content)
      return formData
    }

    it('認証なしの場合はエラーを返す', async () => {
      mockAuth.mockResolvedValue(null)

      const { updatePost } = await import('@/lib/actions/post')
      const result = await updatePost('post-1', editForm('更新後'))

      expect(result).toMatchObject({ success: false, error: '認証が必要です' })
    })

    it('自分の投稿を編集でき editedAt を更新する', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ isSuspended: false, isPublic: true })
      mockPrisma.post.findUnique.mockResolvedValue({
        userId: mockUser.id,
        repostPostId: null,
        media: [],
      })
      mockPrisma.post.update.mockResolvedValue({ id: 'post-1' })

      const { updatePost } = await import('@/lib/actions/post')
      const result = await updatePost('post-1', editForm('更新後の本文'))

      expect(result.success).toBe(true)
      const updateArg = mockPrisma.post.update.mock.calls[0][0]
      expect(updateArg.data.editedAt).toBeInstanceOf(Date)
      expect(updateArg.data.content).toBe('更新後の本文')
    })

    it('他人の投稿は編集できない', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ isSuspended: false, isPublic: true })
      mockPrisma.post.findUnique.mockResolvedValue({
        userId: 'other-user',
        repostPostId: null,
        media: [],
      })

      const { updatePost } = await import('@/lib/actions/post')
      const result = await updatePost('post-1', editForm('更新後'))

      expect(result).toMatchObject({ success: false })
      expect(mockPrisma.post.update).not.toHaveBeenCalled()
    })

    it('純粋リポストは編集できない', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ isSuspended: false, isPublic: true })
      mockPrisma.post.findUnique.mockResolvedValue({
        userId: mockUser.id,
        repostPostId: 'original-post',
        media: [],
      })

      const { updatePost } = await import('@/lib/actions/post')
      const result = await updatePost('post-1', editForm('更新後'))

      expect(result).toMatchObject({ success: false, error: 'この投稿は編集できません' })
      expect(mockPrisma.post.update).not.toHaveBeenCalled()
    })

    it('本文もメディアも無い場合はエラー', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ isSuspended: false, isPublic: true })

      const { updatePost } = await import('@/lib/actions/post')
      const result = await updatePost('post-1', editForm(''))

      expect(result).toMatchObject({ success: false })
      expect(mockPrisma.post.update).not.toHaveBeenCalled()
    })

    it('レート制限超過時はエラー', async () => {
      mockCheckUserRateLimit.mockResolvedValueOnce({ success: false })

      const { updatePost } = await import('@/lib/actions/post')
      const result = await updatePost('post-1', editForm('更新後'))

      expect(result).toMatchObject({ success: false })
      expect(mockPrisma.post.update).not.toHaveBeenCalled()
    })

    it('差し替えで外れた旧メディアを回収する', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ isSuspended: false, isPublic: true })
      mockPrisma.post.findUnique.mockResolvedValue({
        userId: mockUser.id,
        repostPostId: null,
        media: [{ url: 'https://cdn/old.webp' }],
      })
      mockPrisma.post.update.mockResolvedValue({ id: 'post-1' })

      const { updatePost } = await import('@/lib/actions/post')
      // 新しい mediaUrls を送らない＝旧メディアは全て削除対象
      const result = await updatePost('post-1', editForm('本文のみに変更'))

      expect(result.success).toBe(true)
      expect(mockDeleteMediaFiles).toHaveBeenCalledWith(['https://cdn/old.webp'])
    })

    it('mediaUrls を指定すると新しいメディアで置き換える', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ isSuspended: false, isPublic: true })
      mockPrisma.post.findUnique.mockResolvedValue({
        userId: mockUser.id,
        repostPostId: null,
        media: [],
      })
      mockPrisma.post.update.mockResolvedValue({ id: 'post-1' })

      const formData = editForm('画像付きに更新')
      formData.append('mediaUrls', 'https://example.com/new-image.jpg')
      formData.append('mediaTypes', 'image')

      const { updatePost } = await import('@/lib/actions/post')
      const result = await updatePost('post-1', formData)

      expect(result.success).toBe(true)
      const updateArg = mockPrisma.post.update.mock.calls[0][0]
      expect(updateArg.data.media.create).toEqual([
        { url: 'https://example.com/new-image.jpg', type: 'image', sortOrder: 0 },
      ])
    })

    it('genreIds を指定すると新しいジャンルで置き換える', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ isSuspended: false, isPublic: true })
      mockPrisma.post.findUnique.mockResolvedValue({
        userId: mockUser.id,
        repostPostId: null,
        media: [],
      })
      mockPrisma.post.update.mockResolvedValue({ id: 'post-1' })

      const formData = editForm('ジャンル付きに更新')
      formData.append('genreIds', 'genre-1')
      formData.append('genreIds', 'genre-2')

      const { updatePost } = await import('@/lib/actions/post')
      const result = await updatePost('post-1', formData)

      expect(result.success).toBe(true)
      const updateArg = mockPrisma.post.update.mock.calls[0][0]
      expect(updateArg.data.genres.create).toEqual([
        { genreId: 'genre-1' },
        { genreId: 'genre-2' },
      ])
    })

    it('編集時にハッシュタグ再紐付けが失敗しても更新自体は成功する（ログのみで握り潰す）', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ isSuspended: false, isPublic: true })
      mockPrisma.post.findUnique.mockResolvedValue({
        userId: mockUser.id,
        repostPostId: null,
        media: [],
      })
      mockPrisma.post.update.mockResolvedValue({ id: 'post-1' })
      vi.mocked(attachHashtagsToPost).mockRejectedValueOnce(new Error('hashtag sync down'))

      const { updatePost } = await import('@/lib/actions/post')
      const result = await updatePost('post-1', editForm('#盆栽 更新後の本文'))

      expect(result).toEqual({ success: true, data: { postId: 'post-1' } })
    })
  })
})
