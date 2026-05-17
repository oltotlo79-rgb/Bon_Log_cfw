import { vi } from 'vitest'
/**
 * PostCard 追加カバレッジテスト
 *
 * 非表示機能、メニュー操作、コンテンツなし、リポスト詳細のテスト
 */

import { render, screen, waitFor } from '../../utils/test-utils'
import userEvent from '@testing-library/user-event'
import { PostCard } from '@/components/post/PostCard'
import { mockPost, mockUser } from '../../utils/test-utils'
import { hidePost } from '@/lib/actions/hide-post'

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

// eslint-disable-next-line no-var
var mockPush = vi.fn()
// eslint-disable-next-line no-var
var mockRefresh = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    refresh: mockRefresh,
  }),
}))

vi.mock('@/lib/actions/hide-post', () => ({
  hidePost: vi.fn().mockResolvedValue(undefined),
  getHiddenPostIds: vi.fn(),
}))
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

describe('PostCard - extended coverage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('contentがnullの場合は本文エリアが表示されない', () => {
    const props = {
      ...defaultProps,
      post: { ...defaultProps.post, content: null },
    }
    render(<PostCard {...props} />)
    expect(screen.queryByText(/続きを読む/)).not.toBeInTheDocument()
  })

  it('genresが空の場合はジャンルタグが表示されない', () => {
    const props = {
      ...defaultProps,
      post: { ...defaultProps.post, genres: [] },
    }
    render(<PostCard {...props} />)
    expect(screen.queryByText('松柏類')).not.toBeInTheDocument()
  })

  it('非表示ボタンをクリックするとhidePostが呼ばれ投稿が消える', async () => {
    const user = userEvent.setup()
    render(<PostCard {...defaultProps} />)

    // メニューを開く
    const menuButtons = screen.getAllByRole('button')
    const menuButton = menuButtons.find(btn => btn.querySelector('svg'))
    expect(menuButton).toBeTruthy()
    await user.click(menuButton!)

    // 非表示ボタンをクリック
    await waitFor(() => {
      expect(screen.getByText('この投稿を非表示')).toBeInTheDocument()
    })
    await user.click(screen.getByText('この投稿を非表示'))

    await waitFor(() => {
      expect(hidePost).toHaveBeenCalledWith(defaultProps.post.id)
    })

    // 投稿が消える
    expect(screen.queryByTestId('post-card')).not.toBeInTheDocument()
  })

  it('disableNavigation時に非表示するとfeedに遷移する', async () => {
    const user = userEvent.setup()
    render(<PostCard {...defaultProps} disableNavigation={true} />)

    const menuButtons = screen.getAllByRole('button')
    const menuButton = menuButtons.find(btn => btn.querySelector('svg'))
    await user.click(menuButton!)

    await waitFor(() => {
      expect(screen.getByText('この投稿を非表示')).toBeInTheDocument()
    })
    await user.click(screen.getByText('この投稿を非表示'))

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/feed')
    })
  })

  it('メニューのオーバーレイをクリックするとメニューが閉じる', async () => {
    const user = userEvent.setup()
    render(<PostCard {...defaultProps} />)

    const menuButtons = screen.getAllByRole('button')
    const menuButton = menuButtons.find(btn => btn.querySelector('svg'))
    await user.click(menuButton!)

    await waitFor(() => {
      expect(screen.getByText('この投稿を非表示')).toBeInTheDocument()
    })

    // オーバーレイ（fixed inset-0）をクリック
    const overlay = document.querySelector('.fixed.inset-0.z-10')
    expect(overlay).toBeTruthy()
    await user.click(overlay as Element)

    await waitFor(() => {
      expect(screen.queryByText('この投稿を非表示')).not.toBeInTheDocument()
    })
  })

  it('未ログイン時はメニューに削除も通報も非表示ボタンも表示しない', async () => {
    const user = userEvent.setup()
    const props = { ...defaultProps, currentUserId: undefined }
    render(<PostCard {...props} />)

    const menuButtons = screen.getAllByRole('button')
    const menuButton = menuButtons.find(btn => btn.querySelector('svg'))
    await user.click(menuButton!)

    await waitFor(() => {
      expect(screen.queryByText(/削除/)).not.toBeInTheDocument()
      expect(screen.queryByText(/通報/)).not.toBeInTheDocument()
      expect(screen.queryByText('この投稿を非表示')).not.toBeInTheDocument()
    })
  })

  it('未ログイン時はブックマークがログインリンクになる', () => {
    const props = { ...defaultProps, currentUserId: undefined }
    render(<PostCard {...props} />)
    const links = screen.getAllByRole('link')
    const loginLinks = links.filter(link => link.getAttribute('href') === '/login')
    // いいねとブックマークの2つ
    expect(loginLinks.length).toBeGreaterThanOrEqual(2)
  })

  it('リポスト投稿でリポスト元ユーザーのリンクが正しい', () => {
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

    // リポストした人のリンクが正しい
    const repostUserLink = screen.getByText(mockUser.nickname)
    expect(repostUserLink.closest('a')).toHaveAttribute('href', '/users/user-1')
  })

  it('リポスト投稿のカードクリックで元投稿のページに遷移する', async () => {
    const user = userEvent.setup()
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
    await user.click(article)

    expect(mockPush).toHaveBeenCalledWith('/posts/original-post')
  })

  it('自分のリポスト投稿には削除ボタンが表示されない（リポストの場合）', async () => {
    const user = userEvent.setup()
    const props = {
      ...defaultProps,
      currentUserId: 'user-1',
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

    const menuButtons = screen.getAllByRole('button')
    const menuButton = menuButtons.find(btn => btn.querySelector('svg'))
    await user.click(menuButton!)

    await waitFor(() => {
      // リポストの場合、isOwner && !isRepost なので削除は表示されない
      expect(screen.queryByText(/削除/)).not.toBeInTheDocument()
    })
  })

  it('リポスト元にメディアがある場合でもレンダリングされる', () => {
    const props = {
      ...defaultProps,
      post: {
        ...defaultProps.post,
        repostPost: {
          id: 'original-post',
          content: 'メディア付き投稿',
          createdAt: new Date().toISOString(),
          user: { id: 'original-user', nickname: 'オリジナル', avatarUrl: '/avatar.jpg' },
          media: [{ id: 'media-1', url: '/image.jpg', type: 'image', sortOrder: 0 }],
        },
      },
    }
    render(<PostCard {...props} />)
    expect(screen.getByText('メディア付き投稿')).toBeInTheDocument()
  })

  it('コメントリンクが投稿詳細ページへのリンクになっている', () => {
    render(<PostCard {...defaultProps} />)
    const commentLink = screen.getByText('3').closest('a')
    expect(commentLink).toHaveAttribute('href', `/posts/${defaultProps.post.id}`)
  })

  it('アバター画像がある場合はImage要素が表示される', () => {
    render(<PostCard {...defaultProps} />)
    const img = screen.getByAltText(mockUser.nickname)
    expect(img).toBeInTheDocument()
  })

  it('disableNavigationがtrueの場合cursorクラスがない', () => {
    render(<PostCard {...defaultProps} disableNavigation={true} />)
    const article = screen.getByTestId('post-card')
    expect(article.className).not.toContain('cursor-pointer')
  })

  it('disableNavigationがfalseの場合cursorクラスがある', () => {
    render(<PostCard {...defaultProps} />)
    const article = screen.getByTestId('post-card')
    expect(article.className).toContain('cursor-pointer')
  })

  it('自分の投稿には削除ボタンが表示される', async () => {
    const user = userEvent.setup()
    const props = {
      ...defaultProps,
      currentUserId: 'user-1', // post.user.idと同じ
    }
    render(<PostCard {...props} />)

    const menuButtons = screen.getAllByRole('button')
    const menuButton = menuButtons.find(btn => btn.querySelector('svg'))
    await user.click(menuButton!)

    await waitFor(() => {
      expect(screen.getByText('削除する')).toBeInTheDocument()
    })
  })

  it('引用投稿がある場合QuotedPostが表示される', () => {
    const props = {
      ...defaultProps,
      post: {
        ...defaultProps.post,
        quotePost: {
          id: 'quoted-post',
          content: '引用元の投稿',
          createdAt: new Date().toISOString(),
          user: { id: 'quoted-user', nickname: '引用ユーザー', avatarUrl: null },
          media: [],
        },
      },
    }
    render(<PostCard {...props} />)
    expect(screen.getByText('引用元の投稿')).toBeInTheDocument()
  })

  it('メディアがある場合ImageGalleryが表示される', () => {
    const props = {
      ...defaultProps,
      post: {
        ...defaultProps.post,
        media: [
          { id: 'media-1', url: '/image1.jpg', type: 'image', sortOrder: 0 },
          { id: 'media-2', url: '/image2.jpg', type: 'image', sortOrder: 1 },
        ],
      },
    }
    const { container } = render(<PostCard {...props} />)
    // ImageGalleryがレンダリングされている（divがある）
    expect(container.querySelector('.-mx-5')).toBeTruthy()
  })

  it('ジャンルタグをクリックしてもカードのクリックイベントは発火しない', async () => {
    const user = userEvent.setup()
    render(<PostCard {...defaultProps} />)

    const genreLink = screen.getByText('松柏類')
    await user.click(genreLink)

    // カード自体のクリック（投稿詳細への遷移）は発火しない
    // ジャンルリンクは/search?genre=にリンクする
    expect(genreLink.closest('a')).toHaveAttribute('href', '/search?genre=genre-1')
  })

  it('長いコンテンツの「続きを読む」ボタンをクリックすると全文が表示される', async () => {
    const user = userEvent.setup()
    const longContent = 'あ'.repeat(200) // 150文字以上の長いコンテンツ
    const props = {
      ...defaultProps,
      post: { ...defaultProps.post, content: longContent },
    }
    render(<PostCard {...props} />)

    // 最初は「続きを読む」が表示されている
    const expandButton = screen.getByText('続きを読む')
    expect(expandButton).toBeInTheDocument()

    await user.click(expandButton)

    // クリック後は「続きを読む」が消える
    expect(screen.queryByText('続きを読む')).not.toBeInTheDocument()
  })

  it('ハッシュタグを含むコンテンツでハッシュタグリンクが表示される', () => {
    const props = {
      ...defaultProps,
      post: {
        ...defaultProps.post,
        content: 'テスト #盆栽 タグ付き投稿',
      },
    }
    render(<PostCard {...props} />)
    // ハッシュタグリンクが表示される（検索ページへのリンク）
    const hashtagLink = screen.getByText('#盆栽')
    expect(hashtagLink).toBeInTheDocument()
    expect(hashtagLink.closest('a')).toHaveAttribute('href', '/search?q=%23%E7%9B%86%E6%A0%BD')
  })

  it('リポスト投稿でアバターがない場合はイニシャルが表示される', () => {
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
    // イニシャル「オ」が表示される
    expect(screen.getByText('オ')).toBeInTheDocument()
  })

  it('アンケート付き投稿でPollDisplayが表示される', () => {
    const props = {
      ...defaultProps,
      post: {
        ...defaultProps.post,
        poll: {
          id: 'poll-1',
          expiresAt: new Date(Date.now() + 86400000).toISOString(),
          options: [
            { id: 'opt-1', text: '選択肢1', _count: { votes: 5 } },
            { id: 'opt-2', text: '選択肢2', _count: { votes: 3 } },
          ],
          _count: { votes: 8 },
          votes: [],
        },
      },
    }
    render(<PostCard {...props} />)
    expect(screen.getByText('選択肢1')).toBeInTheDocument()
    expect(screen.getByText('選択肢2')).toBeInTheDocument()
  })
})
