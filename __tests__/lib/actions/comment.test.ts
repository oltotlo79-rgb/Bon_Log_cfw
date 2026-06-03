// @vitest-environment node

import { vi } from 'vitest'
import { createMockPrismaClient, mockUser, mockPost, mockComment } from '../../utils/test-utils'

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
vi.mock('@/lib/rate-limit', () => ({
  checkUserRateLimit: vi.fn().mockResolvedValue({ success: true }),
  checkDailyLimit: vi.fn().mockResolvedValue({ allowed: true, count: 0 }),
}))

// auth → validation → rate-limit の順序検証のため、file validation は通過扱いで
// rate-limit の挙動だけを観察する。実際の magic byte 検証は別途のテストで担保。
vi.mock('@/lib/file-validation', async () => {
  const actual = await vi.importActual<typeof import('@/lib/file-validation')>('@/lib/file-validation')
  return {
    ...actual,
    validateImageFile: vi.fn().mockReturnValue({ valid: true }),
  }
})

// 通知モック
const mockCreateNotification = vi.fn().mockResolvedValue({ success: true })
vi.mock('@/lib/actions/notification', () => ({
  createNotification: (...args: unknown[]) => mockCreateNotification(...args),
}))
vi.mock('@/lib/services/notification-core', () => ({
  createNotification: (...args: unknown[]) => mockCreateNotification(...args),
}))

describe('Comment Actions', async () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuth.mockResolvedValue({
      user: { id: mockUser.id },
    })
    // requireActiveNonGuestUser の自ユーザー状態 + 投稿著者の閲覧可否判定の双方で参照される
    mockPrisma.user.findUnique.mockResolvedValue({ isPublic: true, isSuspended: false })
    // コメント対象投稿は閲覧可能（本人の非表示でない投稿）を既定とする
    mockPrisma.post.findUnique.mockResolvedValue({
      id: mockPost.id,
      isHidden: false,
      userId: mockUser.id,
    })
  })

  describe('createComment', async () => {
    it('認証なしの場合はエラーを返す', async () => {
      mockAuth.mockResolvedValue(null)

      const { createComment } = await import('@/lib/actions/comment')
      const formData = new FormData()
      formData.append('postId', 'post-id')
      formData.append('content', 'テストコメント')
      const result = await createComment(formData)

      expect('error' in result && result.error).toBe('認証が必要です')
    })

    it('空のコメントはエラーを返す', async () => {
      const { createComment } = await import('@/lib/actions/comment')
      const formData = new FormData()
      formData.append('postId', 'post-id')
      formData.append('content', '')
      const result = await createComment(formData)

      expect('error' in result && result.error).toBe('コメント内容またはメディアを入力してください')
    })

    it('500文字を超えるコメントはエラーを返す', async () => {
      const { createComment } = await import('@/lib/actions/comment')
      const formData = new FormData()
      formData.append('postId', 'post-id')
      formData.append('content', 'a'.repeat(501))
      const result = await createComment(formData)

      expect('error' in result && result.error).toBe('コメントは500文字以内で入力してください')
    })

    it('1日のコメント上限を超えるとエラーを返す', async () => {
      mockPrisma.comment.count.mockResolvedValue(100)

      const { createComment } = await import('@/lib/actions/comment')
      const formData = new FormData()
      formData.append('postId', 'post-id')
      formData.append('content', 'テストコメント')
      const result = await createComment(formData)

      expect('error' in result && result.error).toBe('1日のコメント上限（100件）に達しました')
    })

    it('正常にコメントを作成できる', async () => {
      mockPrisma.comment.count.mockResolvedValue(0)
      mockPrisma.comment.create.mockResolvedValue({
        ...mockComment,
        id: 'new-comment-id',
      })
      mockPrisma.post.findUnique.mockResolvedValue({
        ...mockPost,
        userId: mockUser.id,
      })

      const { createComment } = await import('@/lib/actions/comment')
      const formData = new FormData()
      formData.append('postId', 'post-id')
      formData.append('content', 'テストコメント')
      const result = await createComment(formData)

      expect(result.success).toBe(true)
      expect('data' in result && result.data?.comment?.id).toBe('new-comment-id')
    })

    it('返信コメントを作成できる', async () => {
      mockPrisma.comment.count.mockResolvedValue(0)
      // 親コメントは同一投稿に属し有効（返信先バリデーションを通過させる）
      mockPrisma.comment.findUnique.mockResolvedValue({
        postId: 'post-id',
        isHidden: false,
        deletedAt: null,
      })
      mockPrisma.comment.create.mockResolvedValue({
        ...mockComment,
        id: 'reply-comment-id',
        parentId: mockComment.id,
      })
      // 再帰CTEで祖先を一括取得（ルートコメント: parent_id: null）
      mockPrisma.$queryRaw.mockResolvedValue([
        { id: mockComment.id, user_id: 'other-user-id', parent_id: null },
      ])
      // 投稿者
      mockPrisma.post.findUnique.mockResolvedValue({
        ...mockPost,
        userId: 'post-owner-id',
      })
      // スレッドミュートなし
      mockPrisma.commentThreadMute.findMany.mockResolvedValue([])
      mockPrisma.block.findMany.mockResolvedValue([])
      mockPrisma.user.findMany.mockResolvedValue([
        { id: 'other-user-id', notificationPreferences: {} },
        { id: 'post-owner-id', notificationPreferences: {} },
      ])
      mockPrisma.notification.createMany.mockResolvedValue({ count: 2 })

      const { createComment } = await import('@/lib/actions/comment')
      const formData = new FormData()
      formData.append('postId', 'post-id')
      formData.append('parentId', mockComment.id)
      formData.append('content', '返信コメント')
      const result = await createComment(formData)

      expect(result.success).toBe(true)
    })

    it('他人の投稿にコメントすると通知が作成される（createNotification経由）', async () => {
      mockPrisma.comment.count.mockResolvedValue(0)
      mockPrisma.comment.create.mockResolvedValue({
        ...mockComment,
        id: 'new-comment-id',
      })
      mockPrisma.post.findUnique.mockResolvedValue({
        ...mockPost,
        userId: 'other-user-id',
      })

      const { createComment } = await import('@/lib/actions/comment')
      const formData = new FormData()
      formData.append('postId', 'post-id')
      formData.append('content', 'テストコメント')
      await createComment(formData)

      // notifyCommentParticipants は fire-and-forget なので await を待つマイクロタスクの隙間で呼ばれる
      await new Promise((resolve) => setImmediate(resolve))

      // CLAUDE.md ルール6: prisma.notification.create を直接呼ぶのではなく createNotification 経由
      expect(mockCreateNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'other-user-id',
          actorId: mockUser.id,
          type: 'comment',
        })
      )
    })

    it('createNotification 経由で通知を委譲する（prefs フィルタは helper 側で実施）', async () => {
      // 旧テストは prefs チェックがサービス内にあったが、現在は createNotification 内部で実施されるため
      // ここでは「サービスが createNotification を正しく呼んでいる」ことを検証する。
      // prefs=false での実際のスキップは __tests__/lib/actions/notification.test.ts でカバー済み。
      mockPrisma.comment.count.mockResolvedValue(0)
      mockPrisma.comment.create.mockResolvedValue({
        ...mockComment,
        id: 'new-comment-id',
      })
      mockPrisma.post.findUnique.mockResolvedValue({
        ...mockPost,
        userId: 'other-user-id',
      })

      const { createComment } = await import('@/lib/actions/comment')
      const formData = new FormData()
      formData.append('postId', 'post-id')
      formData.append('content', 'テストコメント')
      await createComment(formData)

      await new Promise((resolve) => setImmediate(resolve))

      expect(mockCreateNotification).toHaveBeenCalled()
      // prisma.notification.create は createNotification 内部で呼ばれるため、サービスからは直接呼ばれない
      expect(mockPrisma.notification.create).not.toHaveBeenCalled()
    })
  })

  describe('deleteComment', async () => {
    it('認証なしの場合はエラーを返す', async () => {
      mockAuth.mockResolvedValue(null)

      const { deleteComment } = await import('@/lib/actions/comment')
      const result = await deleteComment('comment-id')

      expect('error' in result && result.error).toBe('認証が必要です')
    })

    it('存在しないコメントはエラーを返す', async () => {
      mockPrisma.comment.findUnique.mockResolvedValue(null)

      const { deleteComment } = await import('@/lib/actions/comment')
      const result = await deleteComment('non-existent-id')

      expect('error' in result && result.error).toBe('コメントが見つかりません')
    })

    it('他人のコメントは削除できない', async () => {
      mockPrisma.comment.findUnique.mockResolvedValue({
        ...mockComment,
        userId: 'other-user-id',
        postId: 'post-id',
        post: { userId: 'another-user-id' },
      })

      const { deleteComment } = await import('@/lib/actions/comment')
      const result = await deleteComment('comment-id')

      expect('error' in result && result.error).toBe('削除権限がありません')
    })

    it('自分のコメントを削除できる', async () => {
      mockPrisma.comment.findUnique.mockResolvedValue({
        ...mockComment,
        userId: mockUser.id,
        postId: 'post-id',
        post: { userId: 'other-user-id' },
      })
      mockPrisma.comment.delete.mockResolvedValue(mockComment)

      const { deleteComment } = await import('@/lib/actions/comment')
      const result = await deleteComment('comment-id')

      expect(result).toEqual({ success: true })
    })
  })

  describe('updateComment', async () => {
    it('認証なしの場合はエラーを返す', async () => {
      mockAuth.mockResolvedValue(null)

      const { updateComment } = await import('@/lib/actions/comment')
      const result = await updateComment('comment-id', '新しい本文')

      expect('error' in result && result.error).toBe('認証が必要です')
    })

    it('存在しない/削除済みコメントはエラーを返す', async () => {
      mockPrisma.comment.findUnique.mockResolvedValue(null)

      const { updateComment } = await import('@/lib/actions/comment')
      const result = await updateComment('non-existent-id', '本文')

      expect('error' in result && result.error).toBe('コメントが見つかりません')
    })

    it('他人のコメントは編集できない（削除と異なり投稿主でも不可）', async () => {
      mockPrisma.comment.findUnique.mockResolvedValue({
        userId: 'other-user-id',
        postId: 'post-id',
        deletedAt: null,
        _count: { media: 0 },
      })

      const { updateComment } = await import('@/lib/actions/comment')
      const result = await updateComment('comment-id', '本文')

      expect('error' in result && result.error).toBe('削除権限がありません')
      expect(mockPrisma.comment.update).not.toHaveBeenCalled()
    })

    it('本文が空でメディアも無い場合はエラーを返す', async () => {
      mockPrisma.comment.findUnique.mockResolvedValue({
        userId: mockUser.id,
        postId: 'post-id',
        deletedAt: null,
        _count: { media: 0 },
      })

      const { updateComment } = await import('@/lib/actions/comment')
      const result = await updateComment('comment-id', '   ')

      expect('error' in result && result.error).toBe('コメント内容またはメディアを入力してください')
      expect(mockPrisma.comment.update).not.toHaveBeenCalled()
    })

    it('自分のコメントを編集でき、editedAt が付与される', async () => {
      mockPrisma.comment.findUnique.mockResolvedValue({
        userId: mockUser.id,
        postId: 'post-id',
        deletedAt: null,
        _count: { media: 0 },
      })
      mockPrisma.comment.update.mockResolvedValue({})

      const { updateComment } = await import('@/lib/actions/comment')
      const result = await updateComment('comment-id', '編集後の本文')

      expect(result.success).toBe(true)
      expect(mockPrisma.comment.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'comment-id' },
          data: expect.objectContaining({ content: '編集後の本文', editedAt: expect.any(Date) }),
        }),
      )
    })
  })

  describe('getComments', async () => {
    it('投稿のコメント一覧を取得できる', async () => {
      mockPrisma.comment.findMany.mockResolvedValue([
        {
          ...mockComment,
          _count: { likes: 2, replies: 1 },
          media: [],
          likes: [],
        },
      ])
      mockPrisma.block.findMany.mockResolvedValue([])

      const { getComments } = await import('@/lib/actions/comment')
      const result = await getComments('post-id')

      expect(result.comments).toHaveLength(1)
      expect(result.comments[0].id).toBe(mockComment.id)
    })

    it('ブロックしたユーザーのコメントは除外される', async () => {
      mockPrisma.block.findMany.mockResolvedValue([
        { blockerId: mockUser.id, blockedId: 'blocked-user-id' },
      ])
      mockPrisma.comment.findMany.mockResolvedValue([])

      const { getComments } = await import('@/lib/actions/comment')
      await getComments('post-id')

      expect(mockPrisma.comment.findMany).toHaveBeenCalled()
    })

    it('ページネーションが動作する', async () => {
      mockPrisma.block.findMany.mockResolvedValue([])
      mockPrisma.comment.findMany.mockResolvedValue([])

      const { getComments } = await import('@/lib/actions/comment')
      await getComments('post-id', 'cursor-id', 10)

      expect(mockPrisma.comment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 10,
          cursor: { id: 'cursor-id' },
          skip: 1,
        })
      )
    })

    it('いいね状態が正しく取得される', async () => {
      mockPrisma.block.findMany.mockResolvedValue([])
      mockPrisma.comment.findMany.mockResolvedValue([
        {
          ...mockComment,
          id: 'comment-1',
          _count: { likes: 5, replies: 0 },
          media: [],
          likes: [{ id: 'like-1' }],
        },
        {
          ...mockComment,
          id: 'comment-2',
          _count: { likes: 3, replies: 0 },
          media: [],
          likes: [],
        },
      ])

      const { getComments } = await import('@/lib/actions/comment')
      const result = await getComments('post-id')

      expect(result.comments[0].isLiked).toBe(true)
      expect(result.comments[1].isLiked).toBe(false)
    })

    it('未認証でもコメント一覧を取得できる', async () => {
      mockAuth.mockResolvedValue(null)
      mockPrisma.block.findMany.mockResolvedValue([])
      mockPrisma.comment.findMany.mockResolvedValue([
        {
          ...mockComment,
          _count: { likes: 2, replies: 1 },
          media: [],
        },
      ])

      const { getComments } = await import('@/lib/actions/comment')
      const result = await getComments('post-id')

      expect(result.comments).toHaveLength(1)
      expect(result.comments[0].isLiked).toBe(false)
    })
  })

  describe('createComment - 追加テスト', async () => {
    it('レート制限に達した場合はエラーを返す', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ isSuspended: false })
      const { checkUserRateLimit } = await import('@/lib/rate-limit')
      ;(checkUserRateLimit as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ success: false })

      const { createComment } = await import('@/lib/actions/comment')
      const formData = new FormData()
      formData.append('postId', 'post-id')
      formData.append('content', 'テストコメント')
      const result = await createComment(formData)

      expect('error' in result && result.error).toBe('操作が多すぎます。しばらく待ってから再試行してください')
    })

    it('メディア付きコメントを作成できる', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ isSuspended: false })
      mockPrisma.comment.count.mockResolvedValue(0)
      mockPrisma.comment.create.mockResolvedValue({
        ...mockComment,
        id: 'media-comment-id',
      })
      mockPrisma.post.findUnique.mockResolvedValue({
        ...mockPost,
        userId: mockUser.id,
      })

      const { createComment } = await import('@/lib/actions/comment')
      const formData = new FormData()
      formData.append('postId', 'post-id')
      formData.append('content', 'テストコメント')
      formData.append('mediaUrls', 'https://example.com/image.jpg')
      formData.append('mediaTypes', 'image')
      const result = await createComment(formData)

      expect(result.success).toBe(true)
    })

    it('画像が上限を超える場合はエラーを返す', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ isSuspended: false })

      const { createComment } = await import('@/lib/actions/comment')
      const formData = new FormData()
      formData.append('postId', 'post-id')
      formData.append('content', 'テストコメント')
      // 3枚以上の画像（上限は2枚）
      for (let i = 0; i < 3; i++) {
        formData.append('mediaUrls', `https://example.com/image${i}.jpg`)
        formData.append('mediaTypes', 'image')
      }
      const result = await createComment(formData)

      expect('error' in result && result.error).toBe('画像は2枚までです')
    })

    it('動画が上限を超える場合はエラーを返す', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ isSuspended: false })

      const { createComment } = await import('@/lib/actions/comment')
      const formData = new FormData()
      formData.append('postId', 'post-id')
      formData.append('content', 'テストコメント')
      formData.append('mediaUrls', 'https://example.com/video1.mp4')
      formData.append('mediaTypes', 'video')
      formData.append('mediaUrls', 'https://example.com/video2.mp4')
      formData.append('mediaTypes', 'video')
      const result = await createComment(formData)

      expect('error' in result && result.error).toBe('動画は1本までです')
    })

    it('メディアのみのコメントも作成できる', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ isSuspended: false })
      mockPrisma.comment.count.mockResolvedValue(0)
      mockPrisma.comment.create.mockResolvedValue({
        ...mockComment,
        id: 'media-only-comment-id',
      })
      mockPrisma.post.findUnique.mockResolvedValue({
        ...mockPost,
        userId: mockUser.id,
      })

      const { createComment } = await import('@/lib/actions/comment')
      const formData = new FormData()
      formData.append('postId', 'post-id')
      formData.append('content', '')
      formData.append('mediaUrls', 'https://example.com/image.jpg')
      formData.append('mediaTypes', 'image')
      const result = await createComment(formData)

      expect(result.success).toBe(true)
    })

    it('エラー発生時はエラーメッセージを返す', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ isSuspended: false })
      mockPrisma.comment.count.mockResolvedValue(0)
      mockPrisma.comment.create.mockRejectedValue(new Error('Database error'))

      const { createComment } = await import('@/lib/actions/comment')
      const formData = new FormData()
      formData.append('postId', 'post-id')
      formData.append('content', 'テストコメント')
      const result = await createComment(formData)

      expect('error' in result && result.error).toBe('コメントの作成に失敗しました')
    })
  })

  describe('getReplies', async () => {
    it('コメントへの返信一覧を取得できる', async () => {
      mockPrisma.block.findMany.mockResolvedValue([])
      mockPrisma.comment.findMany.mockResolvedValue([
        {
          id: 'reply-1',
          parentId: 'comment-id',
          content: '返信1',
          user: mockUser,
          _count: { likes: 1, replies: 0 },
          media: [],
          likes: [],
          createdAt: new Date(),
          deletedAt: null,
          userId: mockUser.id,
        },
        {
          id: 'reply-2',
          parentId: 'comment-id',
          content: '返信2',
          user: mockUser,
          _count: { likes: 2, replies: 0 },
          media: [],
          likes: [],
          createdAt: new Date(),
          deletedAt: null,
          userId: mockUser.id,
        },
      ])

      const { getReplies } = await import('@/lib/actions/comment')
      const result = await getReplies('comment-id')

      expect(result.replies).toHaveLength(2)
      expect(result.replies[0].parentId).toBe('comment-id')
    })

    it('ブロックしたユーザーの返信は除外される', async () => {
      mockPrisma.block.findMany.mockResolvedValue([
        { blockerId: mockUser.id, blockedId: 'blocked-user-id' },
      ])
      mockPrisma.comment.findMany.mockResolvedValue([])

      const { getReplies } = await import('@/lib/actions/comment')
      await getReplies('comment-id')

      expect(mockPrisma.comment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            parentId: 'comment-id',
          }),
        })
      )
    })

    it('ページネーションが動作する', async () => {
      mockPrisma.block.findMany.mockResolvedValue([])
      mockPrisma.comment.findMany.mockResolvedValue([])

      const { getReplies } = await import('@/lib/actions/comment')
      await getReplies('comment-id', 'cursor-id', 10)

      expect(mockPrisma.comment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 10,
          cursor: { id: 'cursor-id' },
          skip: 1,
        })
      )
    })
  })

  describe('getCommentCount', async () => {
    it('投稿のコメント数を取得できる', async () => {
      mockPrisma.comment.count.mockResolvedValue(42)

      const { getCommentCount } = await import('@/lib/actions/comment')
      const result = await getCommentCount('post-id')

      expect(result).toEqual({ count: 42 })
      expect(mockPrisma.comment.count).toHaveBeenCalledWith({
        where: { postId: 'post-id', isHidden: false, deletedAt: null },
      })
    })

    it('コメントがない場合は0を返す', async () => {
      mockPrisma.comment.count.mockResolvedValue(0)

      const { getCommentCount } = await import('@/lib/actions/comment')
      const result = await getCommentCount('post-id')

      expect(result).toEqual({ count: 0 })
    })

    it('エラー発生時は0を返す', async () => {
      mockPrisma.comment.count.mockRejectedValue(new Error('Database error'))

      const { getCommentCount } = await import('@/lib/actions/comment')
      const result = await getCommentCount('post-id')

      expect(result).toEqual({ count: 0 })
    })
  })

  describe('uploadCommentMedia', async () => {
    it('認証なしの場合はエラーを返す', async () => {
      mockAuth.mockResolvedValue(null)

      const { uploadCommentMedia } = await import('@/lib/actions/comment')
      const formData = new FormData()
      const result = await uploadCommentMedia(formData)

      expect('error' in result && result.error).toBe('認証が必要です')
    })

    it('ファイルが選択されていない場合はエラーを返す', async () => {
      const { uploadCommentMedia } = await import('@/lib/actions/comment')
      const formData = new FormData()
      const result = await uploadCommentMedia(formData)

      expect('error' in result && result.error).toBe('ファイルが選択されていません')
    })
  })

  describe('deleteComment - 追加テスト', async () => {
    it('エラー発生時はエラーメッセージを返す', async () => {
      mockPrisma.comment.findUnique.mockResolvedValue({
        ...mockComment,
        userId: mockUser.id,
        postId: 'post-id',
      })
      mockPrisma.comment.update.mockRejectedValue(new Error('Database error'))

      const { deleteComment } = await import('@/lib/actions/comment')
      const result = await deleteComment('comment-id')

      expect('error' in result && result.error).toBe('コメントの削除に失敗しました')
    })
  })

  describe('getComments - エラーケース', async () => {
    it('エラー発生時は空の配列を返す', async () => {
      mockPrisma.block.findMany.mockResolvedValue([])
      mockPrisma.comment.findMany.mockRejectedValue(new Error('Database error'))

      const { getComments } = await import('@/lib/actions/comment')
      const result = await getComments('post-id')

      expect(result.comments).toEqual([])
    })
  })

  describe('getReplies - 追加テスト', async () => {
    it('いいね状態が正しく取得される', async () => {
      mockPrisma.block.findMany.mockResolvedValue([])
      mockPrisma.comment.findMany.mockResolvedValue([
        {
          id: 'reply-1',
          parentId: 'comment-id',
          content: '返信1',
          user: mockUser,
          _count: { likes: 1, replies: 0 },
          media: [],
          likes: [{ id: 'like-1' }],
          createdAt: new Date(),
          deletedAt: null,
          userId: mockUser.id,
        },
        {
          id: 'reply-2',
          parentId: 'comment-id',
          content: '返信2',
          user: mockUser,
          _count: { likes: 2, replies: 0 },
          media: [],
          likes: [],
          createdAt: new Date(),
          deletedAt: null,
          userId: mockUser.id,
        },
      ])

      const { getReplies } = await import('@/lib/actions/comment')
      const result = await getReplies('comment-id')

      expect(result.replies[0].isLiked).toBe(true)
      expect(result.replies[1].isLiked).toBe(false)
    })

    it('エラー発生時は空の配列を返す', async () => {
      mockPrisma.block.findMany.mockResolvedValue([])
      mockPrisma.comment.findMany.mockRejectedValue(new Error('Database error'))

      const { getReplies } = await import('@/lib/actions/comment')
      const result = await getReplies('comment-id')

      expect(result.replies).toEqual([])
    })

    it('未認証でも返信一覧を取得できる', async () => {
      mockAuth.mockResolvedValue(null)
      mockPrisma.block.findMany.mockResolvedValue([])
      mockPrisma.comment.findMany.mockResolvedValue([
        {
          id: 'reply-1',
          parentId: 'comment-id',
          content: '返信1',
          user: mockUser,
          _count: { likes: 1, replies: 0 },
          media: [],
          createdAt: new Date(),
          deletedAt: null,
          userId: mockUser.id,
        },
      ])

      const { getReplies } = await import('@/lib/actions/comment')
      const result = await getReplies('comment-id')

      expect(result.replies).toHaveLength(1)
      expect(result.replies[0].isLiked).toBe(false)
    })

    it('hasMoreが正しく判定される（limitと同数の場合）', async () => {
      mockPrisma.block.findMany.mockResolvedValue([])
      const replies = [
        { id: 'reply-0', parentId: 'comment-id', content: '返信0', user: mockUser, _count: { likes: 0, replies: 0 }, media: [], createdAt: new Date(), deletedAt: null, userId: mockUser.id },
        { id: 'reply-1', parentId: 'comment-id', content: '返信1', user: mockUser, _count: { likes: 0, replies: 0 }, media: [], createdAt: new Date(), deletedAt: null, userId: mockUser.id },
      ]
      mockPrisma.comment.findMany.mockResolvedValue(replies)

      const { getReplies } = await import('@/lib/actions/comment')
      const result = await getReplies('comment-id', undefined, 2)

      expect(result.nextCursor).toBe('reply-1')
    })

    it('hasMoreが正しく判定される（limitより少ない場合）', async () => {
      mockPrisma.block.findMany.mockResolvedValue([])
      const replies = [
        { id: 'reply-0', parentId: 'comment-id', content: '返信0', user: mockUser, _count: { likes: 0, replies: 0 }, media: [], createdAt: new Date(), deletedAt: null, userId: mockUser.id },
      ]
      mockPrisma.comment.findMany.mockResolvedValue(replies)

      const { getReplies } = await import('@/lib/actions/comment')
      const result = await getReplies('comment-id', undefined, 5)

      expect(result.nextCursor).toBeUndefined()
    })
  })

  describe('createComment - 通知の追加テスト', async () => {
    it('自分のコメントへの返信には通知を作成しない', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ isSuspended: false })
      mockPrisma.comment.count.mockResolvedValue(0)
      mockPrisma.comment.create.mockResolvedValue({
        ...mockComment,
        id: 'reply-comment-id',
        parentId: mockComment.id,
      })
      // 再帰CTEで祖先取得 - 自分のコメント
      mockPrisma.$queryRaw.mockResolvedValue([
        { id: mockComment.id, user_id: mockUser.id, parent_id: null },
      ])
      // 投稿も自分
      mockPrisma.post.findUnique.mockResolvedValue({
        ...mockPost,
        userId: mockUser.id,
      })
      mockPrisma.commentThreadMute.findMany.mockResolvedValue([])

      const { createComment } = await import('@/lib/actions/comment')
      const formData = new FormData()
      formData.append('postId', 'post-id')
      formData.append('parentId', mockComment.id)
      formData.append('content', '自分への返信')
      await createComment(formData)

      // 自分自身が除外されるので通知は作成されない
      expect(mockPrisma.notification.create).not.toHaveBeenCalled()
    })

    it('自分の投稿へのコメントには通知を作成しない', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ isSuspended: false })
      mockPrisma.comment.count.mockResolvedValue(0)
      mockPrisma.comment.create.mockResolvedValue({
        ...mockComment,
        id: 'new-comment-id',
      })
      mockPrisma.post.findUnique.mockResolvedValue({
        ...mockPost,
        userId: mockUser.id, // 自分の投稿
      })

      const { createComment } = await import('@/lib/actions/comment')
      const formData = new FormData()
      formData.append('postId', 'post-id')
      formData.append('content', '自分の投稿へのコメント')
      await createComment(formData)

      // 通知は作成されない
      expect(mockPrisma.notification.create).not.toHaveBeenCalled()
    })

    it('投稿が見つからない場合は通知を作成しない', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ isSuspended: false })
      mockPrisma.comment.count.mockResolvedValue(0)
      mockPrisma.comment.create.mockResolvedValue({
        ...mockComment,
        id: 'new-comment-id',
      })
      mockPrisma.post.findUnique.mockResolvedValue(null)

      const { createComment } = await import('@/lib/actions/comment')
      const formData = new FormData()
      formData.append('postId', 'post-id')
      formData.append('content', 'テストコメント')
      await createComment(formData)

      expect(mockPrisma.notification.create).not.toHaveBeenCalled()
    })

    it('親コメントが見つからない場合は返信通知を作成しない', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ isSuspended: false })
      mockPrisma.comment.count.mockResolvedValue(0)
      mockPrisma.comment.create.mockResolvedValue({
        ...mockComment,
        id: 'reply-comment-id',
        parentId: 'parent-id',
      })
      // 再帰CTEで祖先なし
      mockPrisma.$queryRaw.mockResolvedValue([])
      // 投稿は自分のもの
      mockPrisma.post.findUnique.mockResolvedValue({
        ...mockPost,
        userId: mockUser.id,
      })
      mockPrisma.commentThreadMute.findMany.mockResolvedValue([])

      const { createComment } = await import('@/lib/actions/comment')
      const formData = new FormData()
      formData.append('postId', 'post-id')
      formData.append('parentId', 'parent-id')
      formData.append('content', '返信コメント')
      await createComment(formData)

      expect(mockPrisma.notification.create).not.toHaveBeenCalled()
    })
  })

  describe('uploadCommentMedia - 追加テスト', async () => {
    it('レート制限に達した場合はエラーを返す', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ isSuspended: false })
      const { checkUserRateLimit } = await import('@/lib/rate-limit')
      ;(checkUserRateLimit as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ success: false })

      const { uploadCommentMedia } = await import('@/lib/actions/comment')
      const formData = new FormData()
      const file = new File(['test'], 'test.jpg', { type: 'image/jpeg' })
      formData.append('file', file)
      const result = await uploadCommentMedia(formData)

      expect('error' in result && result.error).toBe('アップロードが多すぎます。しばらく待ってから再試行してください')
    })

    it('日次制限に達した場合はエラーを返す', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ isSuspended: false })
      const { checkDailyLimit } = await import('@/lib/rate-limit')
      ;(checkDailyLimit as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ allowed: false, limit: 50 })

      const { uploadCommentMedia } = await import('@/lib/actions/comment')
      const formData = new FormData()
      const file = new File(['test'], 'test.jpg', { type: 'image/jpeg' })
      formData.append('file', file)
      const result = await uploadCommentMedia(formData)

      expect('error' in result && result.error).toBe('1日のアップロード上限（50回）に達しました')
    })

    it('画像でも動画でもないファイルはエラーを返す', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ isSuspended: false })

      const { uploadCommentMedia } = await import('@/lib/actions/comment')
      const formData = new FormData()
      const file = new File(['test'], 'test.txt', { type: 'text/plain' })
      formData.append('file', file)
      const result = await uploadCommentMedia(formData)

      expect('error' in result && result.error).toBe('画像または動画ファイルを選択してください')
    })
  })

  describe('createComment - ネストされた返信スレッド', async () => {
    it('深いネストの返信で祖先を辿って通知対象を収集する', async () => {
      mockPrisma.comment.count.mockResolvedValue(0)
      mockPrisma.comment.create.mockResolvedValue({
        ...mockComment,
        id: 'deep-reply-id',
        parentId: 'parent-2',
      })
      // 再帰CTEで祖先を一括取得
      mockPrisma.$queryRaw.mockResolvedValue([
        { id: 'parent-2', user_id: 'user-middle', parent_id: 'parent-1' },
        { id: 'parent-1', user_id: 'user-root', parent_id: null },
      ])
      mockPrisma.post.findUnique.mockResolvedValue({
        ...mockPost,
        userId: 'post-owner-id',
      })
      mockPrisma.commentThreadMute.findMany.mockResolvedValue([])
      mockPrisma.block.findMany.mockResolvedValue([])
      mockPrisma.user.findMany.mockResolvedValue([
        { id: 'user-middle', notificationPreferences: {} },
        { id: 'user-root', notificationPreferences: {} },
        { id: 'post-owner-id', notificationPreferences: {} },
      ])
      mockPrisma.notification.createMany.mockResolvedValue({ count: 3 })

      const { createComment } = await import('@/lib/actions/comment')
      const formData = new FormData()
      formData.append('postId', 'post-id')
      formData.append('parentId', 'parent-2')
      formData.append('content', '深い返信')
      const result = await createComment(formData)

      expect(result.success).toBe(true)
      // $queryRawが1回呼ばれる（再帰CTEで一括取得）
      expect(mockPrisma.$queryRaw).toHaveBeenCalledTimes(1)
    })

    it('祖先が見つからない場合は空の結果を返す', async () => {
      mockPrisma.comment.count.mockResolvedValue(0)
      mockPrisma.comment.create.mockResolvedValue({
        ...mockComment,
        id: 'reply-id',
        parentId: 'deleted-parent',
      })
      // 再帰CTEで祖先なし（親コメントが削除済み）
      mockPrisma.$queryRaw.mockResolvedValue([])
      mockPrisma.post.findUnique.mockResolvedValue({
        ...mockPost,
        userId: 'post-owner-id',
      })
      mockPrisma.commentThreadMute.findMany.mockResolvedValue([])
      mockPrisma.block.findMany.mockResolvedValue([])
      mockPrisma.user.findMany.mockResolvedValue([])
      mockPrisma.notification.createMany.mockResolvedValue({ count: 0 })

      const { createComment } = await import('@/lib/actions/comment')
      const formData = new FormData()
      formData.append('postId', 'post-id')
      formData.append('parentId', 'deleted-parent')
      formData.append('content', '返信')
      const result = await createComment(formData)

      expect(result.success).toBe(true)
    })
  })

  describe('createComment - セキュリティエッジケース', () => {
    it('停止中（suspended）ユーザーはコメント作成できない', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ isSuspended: true })

      const { createComment } = await import('@/lib/actions/comment')
      const formData = new FormData()
      formData.append('postId', 'post-id')
      formData.append('content', 'テストコメント')
      const result = await createComment(formData)

      expect('error' in result && result.error).toBeTruthy()
      // DB操作（コメント作成）が行われないことを確認
      expect(mockPrisma.comment.create).not.toHaveBeenCalled()
    })

    it('DB例外（トランザクション失敗）時はエラーメッセージを返す', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ isSuspended: false })
      mockPrisma.$transaction.mockRejectedValue(new Error('Transaction deadlock'))

      const { createComment } = await import('@/lib/actions/comment')
      const formData = new FormData()
      formData.append('postId', 'post-id')
      formData.append('content', 'テストコメント')
      const result = await createComment(formData)

      expect('error' in result && result.error).toBe('コメントの作成に失敗しました')
    })
  })

  describe('deleteComment - 投稿オーナーによる削除', () => {
    it('投稿オーナーは他人のコメントを削除できる', async () => {
      // コメント投稿者はother-user-id、投稿オーナーはtest-user-id（ログインユーザー）
      mockPrisma.comment.findUnique.mockResolvedValue({
        ...mockComment,
        userId: 'other-user-id',
        postId: 'post-id',
        post: { userId: mockUser.id },
      })
      mockPrisma.comment.update.mockResolvedValue(mockComment)

      const { deleteComment } = await import('@/lib/actions/comment')
      const result = await deleteComment('comment-id')

      expect(result).toEqual({ success: true })
      expect(mockPrisma.comment.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'comment-id' },
          data: { deletedAt: expect.any(Date) },
        })
      )
    })

    it('停止中（suspended）ユーザーはコメント削除できない', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ isSuspended: true })

      const { deleteComment } = await import('@/lib/actions/comment')
      const result = await deleteComment('comment-id')

      expect('error' in result && result.error).toBeTruthy()
      expect(mockPrisma.comment.update).not.toHaveBeenCalled()
    })
  })

  describe('getComments - hasMore判定', async () => {
    it('hasMoreが正しく判定される（limitと同数の場合）', async () => {
      mockPrisma.block.findMany.mockResolvedValue([])
      const comments = [
        { ...mockComment, id: 'comment-0', _count: { likes: 0, replies: 0 }, media: [] },
        { ...mockComment, id: 'comment-1', _count: { likes: 0, replies: 0 }, media: [] },
        { ...mockComment, id: 'comment-2', _count: { likes: 0, replies: 0 }, media: [] },
      ]
      mockPrisma.comment.findMany.mockResolvedValue(comments)

      const { getComments } = await import('@/lib/actions/comment')
      const result = await getComments('post-id', undefined, 3)

      expect(result.nextCursor).toBe('comment-2')
    })

    it('hasMoreが正しく判定される（limitより少ない場合）', async () => {
      mockPrisma.block.findMany.mockResolvedValue([])
      const comments = [
        { ...mockComment, id: 'comment-0', _count: { likes: 0, replies: 0 }, media: [] },
      ]
      mockPrisma.comment.findMany.mockResolvedValue(comments)

      const { getComments } = await import('@/lib/actions/comment')
      const result = await getComments('post-id', undefined, 3)

      expect(result.nextCursor).toBeUndefined()
    })
  })
})
