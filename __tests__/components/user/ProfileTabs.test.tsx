import type { Post } from '@/components/post/PostCard.types'
import { vi } from 'vitest'
import { render, screen } from '../../utils/test-utils'
import userEvent from '@testing-library/user-event'
import { ProfileTabs } from '@/components/user/ProfileTabs'

// Mocks
vi.mock('next/cache', () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn(), unstable_cache: vi.fn((fn) => fn), cache: vi.fn((fn) => fn) }))

vi.mock('@/lib/actions/post', () => ({
  deletePost: vi.fn(),
  createPost: vi.fn(),
  getPost: vi.fn(),
  toggleLike: vi.fn(),
  toggleBookmark: vi.fn(),
}))

vi.mock('@/lib/actions/poll', () => ({
  votePoll: vi.fn(),
  getPollResults: vi.fn(),
}))

vi.mock('@/lib/actions/like', () => ({
  toggleLike: vi.fn(),
}))

vi.mock('@/lib/actions/comment', () => ({
  createComment: vi.fn(),
  deleteComment: vi.fn(),
}))

vi.mock('@/lib/actions/bookmark', () => ({
  toggleBookmark: vi.fn(),
  getBookmarks: vi.fn(),
}))

vi.mock('@/lib/rate-limit', () => ({
  checkRateLimit: vi.fn().mockResolvedValue(true),
  rateLimit: vi.fn().mockResolvedValue({ success: true }),
}))

vi.mock('@/lib/redis', () => ({
  redis: {
    get: vi.fn(),
    set: vi.fn(),
    del: vi.fn(),
    incr: vi.fn(),
  },
}))

// ============================================================
// テストデータ
// ============================================================

const mockPost = {
  id: 'post-1',
  content: 'テスト投稿です',
  createdAt: new Date('2024-01-15T10:00:00Z'),
  user: {
    id: 'user-1',
    nickname: 'テストユーザー',
    avatarUrl: null,
  },
  media: [],
  genres: [],
  _count: { likes: 5, comments: 2 },
  likeCount: 5,
  commentCount: 2,
  isLiked: false,
  isBookmarked: false,
  quotePost: null,
  repostPost: null,
  repostedBy: null,
  poll: null,
} as unknown as Post

const mockComment = {
  id: 'comment-1',
  content: 'テストコメントです',
  createdAt: new Date('2024-01-15T10:00:00Z'),
  post: { id: 'post-1', content: '元の投稿内容です' },
  media: [],
}

const mockCommentWithMedia = {
  id: 'comment-2',
  content: 'メディア付きコメント',
  createdAt: new Date('2024-01-15T11:00:00Z'),
  post: { id: 'post-2', content: null },
  media: [
    { id: 'media-1', url: '/image1.jpg', type: 'image', sortOrder: 0 },
    { id: 'media-2', url: '/video1.mp4', type: 'video', sortOrder: 1 },
  ],
}

const mockCommentWithLongPostContent = {
  id: 'comment-3',
  content: 'コメント',
  createdAt: new Date('2024-01-15T12:00:00Z'),
  post: {
    id: 'post-3',
    // 51文字以上の投稿内容
    content: 'あいうえおかきくけこさしすせそたちつてとなにぬねのはひふへほまみむめもやゆよらりるれろわをんABCDEFGH',
  },
  media: [],
}

// ============================================================
// テスト
// ============================================================

describe('ProfileTabs', () => {
  // ============================================================
  // 基本レンダリング
  // ============================================================

  describe('基本レンダリング', () => {
    it('タブコンポーネントがレンダリングされる', () => {
      render(<ProfileTabs posts={[]} comments={[]} />)
      expect(screen.getByText('投稿')).toBeInTheDocument()
      expect(screen.getByText('コメント')).toBeInTheDocument()
    })

    it('デフォルトで投稿タブが表示される', () => {
      render(<ProfileTabs posts={[]} comments={[]} />)
      expect(screen.getByText('まだ投稿がありません')).toBeInTheDocument()
    })

    it('currentUserIdが渡される', () => {
      render(<ProfileTabs posts={[mockPost]} comments={[]} currentUserId="user-1" />)
      expect(screen.getByText('テスト投稿です')).toBeInTheDocument()
    })
  })

  // ============================================================
  // 投稿タブ
  // ============================================================

  describe('投稿タブ', () => {
    it('投稿がない場合は空メッセージが表示される', () => {
      render(<ProfileTabs posts={[]} comments={[]} />)
      expect(screen.getByText('まだ投稿がありません')).toBeInTheDocument()
    })

    it('投稿がある場合はPostCardが表示される', () => {
      render(<ProfileTabs posts={[mockPost]} comments={[]} />)
      expect(screen.getByText('テスト投稿です')).toBeInTheDocument()
    })

    it('複数の投稿が表示される', () => {
      const posts = [
        { ...mockPost, id: 'post-1', content: '投稿1' },
        { ...mockPost, id: 'post-2', content: '投稿2' },
        { ...mockPost, id: 'post-3', content: '投稿3' },
      ]
      render(<ProfileTabs posts={posts} comments={[]} />)
      expect(screen.getByText('投稿1')).toBeInTheDocument()
      expect(screen.getByText('投稿2')).toBeInTheDocument()
      expect(screen.getByText('投稿3')).toBeInTheDocument()
    })
  })

  // ============================================================
  // コメントタブ
  // ============================================================

  describe('コメントタブ', () => {
    it('コメントタブをクリックするとコメントが表示される', async () => {
      const user = userEvent.setup()
      render(<ProfileTabs posts={[]} comments={[mockComment]} />)

      await user.click(screen.getByText('コメント'))
      expect(screen.getByText('テストコメントです')).toBeInTheDocument()
    })

    it('コメントがない場合は空メッセージが表示される', async () => {
      const user = userEvent.setup()
      render(<ProfileTabs posts={[]} comments={[]} />)

      await user.click(screen.getByText('コメント'))
      expect(screen.getByText('まだコメントがありません')).toBeInTheDocument()
    })

    it('コメント元の投稿へのリンクが表示される', async () => {
      const user = userEvent.setup()
      render(<ProfileTabs posts={[]} comments={[mockComment]} />)

      await user.click(screen.getByText('コメント'))
      const link = screen.getByRole('link', { name: /元の投稿内容です/i })
      expect(link).toHaveAttribute('href', '/posts/post-1')
    })

    it('投稿内容がnullの場合は「投稿への返信」と表示される', async () => {
      const user = userEvent.setup()
      const commentWithNullContent = {
        ...mockComment,
        post: { id: 'post-1', content: null },
      }
      render(<ProfileTabs posts={[]} comments={[commentWithNullContent]} />)

      await user.click(screen.getByText('コメント'))
      expect(screen.getByText('投稿への返信')).toBeInTheDocument()
    })

    it('50文字を超える投稿内容は省略される', async () => {
      const user = userEvent.setup()
      render(<ProfileTabs posts={[]} comments={[mockCommentWithLongPostContent]} />)

      await user.click(screen.getByText('コメント'))
      // 省略記号が含まれた「への返信」リンクが表示される
      const link = screen.getByRole('link')
      expect(link.textContent).toContain('...')
    })

    it('複数のコメントが表示される', async () => {
      const user = userEvent.setup()
      const comments = [
        { ...mockComment, id: 'comment-1', content: 'コメント1' },
        { ...mockComment, id: 'comment-2', content: 'コメント2' },
      ]
      render(<ProfileTabs posts={[]} comments={comments} />)

      await user.click(screen.getByText('コメント'))
      expect(screen.getByText('コメント1')).toBeInTheDocument()
      expect(screen.getByText('コメント2')).toBeInTheDocument()
    })
  })

  // ============================================================
  // メディア表示
  // ============================================================

  describe('メディア表示', () => {
    it('コメントに添付された画像が表示される', async () => {
      const user = userEvent.setup()
      render(<ProfileTabs posts={[]} comments={[mockCommentWithMedia]} />)

      await user.click(screen.getByText('コメント'))
      // Next.js Imageはimgタグを生成するが、roleが設定されない場合がある
      // メディアコンテナの存在を確認
      const mediaContainers = document.querySelectorAll('.relative.w-20.h-20')
      expect(mediaContainers.length).toBeGreaterThan(0)
    })

    it('コメントに添付された動画が表示される', async () => {
      const user = userEvent.setup()
      render(<ProfileTabs posts={[]} comments={[mockCommentWithMedia]} />)

      await user.click(screen.getByText('コメント'))
      // video要素の存在を確認（role="video"はないため、document.querySelector使用）
      const videoContainer = document.querySelector('video')
      expect(videoContainer).toBeInTheDocument()
    })

    it('メディアがない場合はメディアセクションが表示されない', async () => {
      const user = userEvent.setup()
      render(<ProfileTabs posts={[]} comments={[mockComment]} />)

      await user.click(screen.getByText('コメント'))
      const images = screen.queryAllByRole('img')
      // PostCardのアバター以外の画像がないことを確認
      expect(images.filter(img => !img.className.includes('avatar')).length).toBe(0)
    })
  })

  // ============================================================
  // タブ切り替え
  // ============================================================

  describe('タブ切り替え', () => {
    it('投稿タブからコメントタブへ切り替えできる', async () => {
      const user = userEvent.setup()
      render(<ProfileTabs posts={[mockPost]} comments={[mockComment]} />)

      // 最初は投稿が表示
      expect(screen.getByText('テスト投稿です')).toBeInTheDocument()

      // コメントタブをクリック
      await user.click(screen.getByText('コメント'))
      expect(screen.getByText('テストコメントです')).toBeInTheDocument()
    })

    it('コメントタブから投稿タブへ切り替えできる', async () => {
      const user = userEvent.setup()
      render(<ProfileTabs posts={[mockPost]} comments={[mockComment]} />)

      // コメントタブをクリック
      await user.click(screen.getByText('コメント'))
      expect(screen.getByText('テストコメントです')).toBeInTheDocument()

      // 投稿タブをクリック
      await user.click(screen.getByText('投稿'))
      expect(screen.getByText('テスト投稿です')).toBeInTheDocument()
    })
  })

  // ============================================================
  // 日時表示
  // ============================================================

  describe('日時表示', () => {
    it('コメントの相対時間が表示される', async () => {
      const user = userEvent.setup()
      // 現在時刻から相対的な時間が表示される
      const recentComment = {
        ...mockComment,
        createdAt: new Date(Date.now() - 1000 * 60 * 5), // 5分前
      }
      render(<ProfileTabs posts={[]} comments={[recentComment]} />)

      await user.click(screen.getByText('コメント'))
      // 「前」という文字が含まれていることを確認（日本語ロケール）
      expect(screen.getByText(/前/)).toBeInTheDocument()
    })
  })

  // ============================================================
  // アクセシビリティ
  // ============================================================

  describe('アクセシビリティ', () => {
    it('タブボタンがフォーカス可能', () => {
      render(<ProfileTabs posts={[]} comments={[]} />)
      const postsTab = screen.getByText('投稿')
      const commentsTab = screen.getByText('コメント')

      expect(postsTab.closest('button')).not.toBeNull()
      expect(commentsTab.closest('button')).not.toBeNull()
    })

    it('リンクにhref属性がある', async () => {
      const user = userEvent.setup()
      render(<ProfileTabs posts={[]} comments={[mockComment]} />)

      await user.click(screen.getByText('コメント'))
      const links = screen.getAllByRole('link')
      links.forEach((link) => {
        expect(link).toHaveAttribute('href')
      })
    })
  })

  // ============================================================
  // エッジケース
  // ============================================================

  describe('エッジケース', () => {
    it('空の投稿配列でも正しくレンダリングされる', () => {
      render(<ProfileTabs posts={[]} comments={[]} />)
      expect(screen.getByText('まだ投稿がありません')).toBeInTheDocument()
    })

    it('currentUserIdがundefinedでも正しく動作する', () => {
      render(<ProfileTabs posts={[mockPost]} comments={[]} currentUserId={undefined} />)
      expect(screen.getByText('テスト投稿です')).toBeInTheDocument()
    })

    it('空のメディア配列を持つコメントが正しく表示される', async () => {
      const user = userEvent.setup()
      render(<ProfileTabs posts={[]} comments={[mockComment]} />)

      await user.click(screen.getByText('コメント'))
      expect(screen.getByText('テストコメントです')).toBeInTheDocument()
    })
  })
})
