/**
 * PostCard - uncovered lines coverage tests
 *
 * Targets:
 * - Line 57: hashtag case in renderSegments (hashtag onClick stopPropagation)
 * - Line 69: hashtag onClick stopPropagation
 * - Lines 110-112: keyboard navigation (Enter and Space keys)
 */

import { vi } from 'vitest'
import { render, screen, fireEvent } from '../../utils/test-utils'
import { PostCard } from '@/components/post/PostCard'
import { mockPost, mockUser } from '../../utils/test-utils'

vi.mock('@/lib/db', () => ({
  prisma: { post: { findMany: vi.fn() }, user: { findMany: vi.fn() }, report: { create: vi.fn() } },
}))

vi.mock('@/lib/actions/like', () => ({
  toggleLike: vi.fn().mockResolvedValue({ success: true, data: { liked: true } }),
}))

vi.mock('@/lib/actions/bookmark', () => ({
  toggleBookmark: vi.fn().mockResolvedValue({ success: true, data: { bookmarked: true } }),
}))

vi.mock('@/lib/actions/post', () => ({
  deletePost: vi.fn().mockResolvedValue({ success: true }),
}))

vi.mock('@/lib/actions/report', () => ({
  createReport: vi.fn().mockResolvedValue({ success: true }),
}))

const mockPush = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    refresh: vi.fn(),
  }),
}))

vi.mock('@/lib/actions/hide-post', () => ({ hidePost: vi.fn(), getHiddenPostIds: vi.fn() }))
vi.mock('@/lib/actions/poll', () => ({ votePoll: vi.fn(), getPollResults: vi.fn() }))

const defaultProps = {
  post: {
    id: mockPost.id,
    content: mockPost.content,
    createdAt: mockPost.createdAt,
    user: { id: 'user-1', nickname: mockUser.nickname, avatarUrl: mockUser.avatarUrl },
    media: [],
    genres: [{ id: 'genre-1', name: '松柏類', category: '松柏類' }],
    likeCount: 5,
    commentCount: 3,
    isLiked: false,
    isBookmarked: false,
  },
  currentUserId: 'current-user-id',
}

describe('PostCard - keyboard navigation and hashtag interaction', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('Enterキーを押すと投稿詳細ページへ遷移する', () => {
    render(<PostCard {...defaultProps} />)

    const article = screen.getByTestId('post-card')
    fireEvent.keyDown(article, { key: 'Enter' })

    expect(mockPush).toHaveBeenCalledWith(`/posts/${mockPost.id}`)
  })

  it('Spaceキーを押すと投稿詳細ページへ遷移する', () => {
    render(<PostCard {...defaultProps} />)

    const article = screen.getByTestId('post-card')
    fireEvent.keyDown(article, { key: ' ' })

    expect(mockPush).toHaveBeenCalledWith(`/posts/${mockPost.id}`)
  })

  it('Enter/Space以外のキーでは遷移しない', () => {
    render(<PostCard {...defaultProps} />)

    const article = screen.getByTestId('post-card')
    fireEvent.keyDown(article, { key: 'Tab' })

    expect(mockPush).not.toHaveBeenCalled()
  })

  it('disableNavigation時はキーボード操作で遷移しない', () => {
    render(<PostCard {...defaultProps} disableNavigation={true} />)

    const article = screen.getByTestId('post-card')
    fireEvent.keyDown(article, { key: 'Enter' })
    fireEvent.keyDown(article, { key: ' ' })

    expect(mockPush).not.toHaveBeenCalled()
  })

  it('ハッシュタグをクリックしてもカード全体のクリックイベントが発火しない（stopPropagation）', () => {
    const props = {
      ...defaultProps,
      post: {
        ...defaultProps.post,
        content: '投稿 #盆栽 について',
      },
    }
    render(<PostCard {...props} />)

    const hashtag = screen.getByText('#盆栽')
    fireEvent.click(hashtag)

    // カード全体のonClickが発火しない（stopPropagationにより）
    // router.pushが投稿詳細ではなく検索ページ用のリンクであることを確認
    expect(mockPush).not.toHaveBeenCalled()
  })

  it('メンションリンクをクリックしてもカード全体のクリックイベントが発火しない', () => {
    const mentionUsers = new Map([
      ['user123', { id: 'user123', nickname: 'john', avatarUrl: null }],
    ])
    const props = {
      ...defaultProps,
      post: {
        ...defaultProps.post,
        content: 'Hello <@user123> さん',
      },
      mentionUsers,
    }
    render(<PostCard {...props} />)

    const mention = screen.getByText('@john')
    fireEvent.click(mention)

    // stopPropagation prevents card navigation
    expect(mockPush).not.toHaveBeenCalled()
  })

  it('リポスト投稿でEnterキーを押すと元投稿の詳細ページへ遷移する', () => {
    const props = {
      ...defaultProps,
      post: {
        ...defaultProps.post,
        repostPost: {
          id: 'original-post',
          content: '元の投稿',
          createdAt: new Date().toISOString(),
          user: { id: 'original-user', nickname: 'オリジナル', avatarUrl: null },
          media: [],
        },
      },
    }
    render(<PostCard {...props} />)

    const article = screen.getByTestId('post-card')
    fireEvent.keyDown(article, { key: 'Enter' })

    // displayPost is repostPost, so it should navigate to the original post
    expect(mockPush).toHaveBeenCalledWith('/posts/original-post')
  })

  it('SpaceキーでpreventDefaultが呼ばれスクロールが防止される', () => {
    render(<PostCard {...defaultProps} />)

    const article = screen.getByTestId('post-card')
    const event = new KeyboardEvent('keydown', { key: ' ', bubbles: true })
    const preventDefaultSpy = vi.spyOn(event, 'preventDefault')

    article.dispatchEvent(event)

    expect(preventDefaultSpy).toHaveBeenCalled()
  })

  it('多行コンテンツが行数制限で省略される', () => {
    // POST_PREVIEW_MAX_LINES は通常5行。6行以上で省略される
    const multilineContent = Array.from({ length: 10 }, (_, i) => `行${i + 1}`).join('\n')
    const props = {
      ...defaultProps,
      post: {
        ...defaultProps.post,
        content: multilineContent,
      },
    }
    render(<PostCard {...props} />)

    // 省略表示で「続きを読む」ボタンが表示される
    expect(screen.getByText('続きを読む')).toBeInTheDocument()
    // 末尾に...が表示されている
    expect(screen.getByText(/\.\.\./)).toBeInTheDocument()
  })
})
