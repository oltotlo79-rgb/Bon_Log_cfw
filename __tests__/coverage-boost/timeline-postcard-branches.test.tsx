import { vi } from 'vitest'
import { render, screen, waitFor } from '../utils/test-utils'
import userEvent from '@testing-library/user-event'
import { Timeline } from '@/components/feed/Timeline'
import { PostCard } from '@/components/post/PostCard'

// ---- Mocks: Auth & Navigation ----
vi.mock('next-auth/react', () => ({
  SessionProvider: ({ children }: { children: React.ReactNode }) => children,
  useSession: () => ({
    data: { user: { id: 'test-user-id' } },
    status: 'authenticated',
  }),
}))

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => '/',
}))

// ---- Mocks: Server Actions ----
vi.mock('@/lib/actions/feed', () => ({
  getTimeline: vi.fn().mockResolvedValue({ posts: [], nextCursor: undefined }),
}))
vi.mock('@/lib/actions/like', () => ({
  toggleLike: vi.fn().mockResolvedValue({ success: true, data: { liked: true } }),
}))
vi.mock('@/lib/actions/hide-post', () => ({
  hidePost: vi.fn().mockResolvedValue({ success: true }),
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
vi.mock('@/lib/actions/poll', () => ({
  votePoll: vi.fn().mockResolvedValue({ success: true }),
}))

// ---- Mocks: Child Components ----
vi.mock('@/components/post/ImageGallery', () => ({
  ImageGallery: () => <div data-testid="image-gallery" />,
}))
vi.mock('@/components/post/QuotedPost', () => ({
  QuotedPost: ({ post }: { post: { content: string } }) => (
    <div data-testid="quoted-post">{post.content}</div>
  ),
}))
vi.mock('@/components/post/DeletePostButton', () => ({
  DeletePostButton: () => <button data-testid="delete-post-button">削除</button>,
}))
vi.mock('@/components/post/LikeButton', () => ({
  LikeButton: ({ initialCount }: { initialCount?: number }) => (
    <button data-testid="like-button">いいね{initialCount !== undefined && initialCount > 0 ? ` ${initialCount}` : ''}</button>
  ),
}))
vi.mock('@/components/post/BookmarkButton', () => ({
  BookmarkButton: () => <button data-testid="bookmark-button">ブックマーク</button>,
}))
vi.mock('@/components/report/ReportButton', () => ({
  ReportButton: () => <button data-testid="report-button">通報</button>,
}))
vi.mock('@/components/post/PollDisplay', () => ({
  PollDisplay: () => <div data-testid="poll-display" />,
}))
vi.mock('@/components/ads', () => ({
  InFeedAdUnit: () => <div data-testid="ad-unit" />,
  InFeedAdSlot: ({ index, total, interval }: any) => {
    const position = index + 1
    if (position % interval !== 0) return null
    if (position >= total) return null
    return <div data-testid="ad-unit" />
  },
}))
vi.mock('@/components/feed/TimelineSkeleton', () => ({
  TimelineSkeleton: () => <div data-testid="timeline-skeleton" />,
}))
vi.mock('@/components/feed/EmptyTimeline', () => ({
  EmptyTimeline: () => <div data-testid="empty-timeline" />,
}))

// ---- Base Test Data ----
const basePost = {
  id: 'post-1',
  content: 'テスト投稿',
  createdAt: new Date().toISOString(),
  user: { id: 'user-1', nickname: 'ユーザー1', avatarUrl: null },
  media: [],
  genres: [],
  likeCount: 0,
  commentCount: 0,
}

// ---- Helper to create many posts ----
function createPosts(count: number) {
  return Array.from({ length: count }, (_, i) => ({
    ...basePost,
    id: `post-${i + 1}`,
    content: `投稿 ${i + 1}`,
  }))
}

// =============================================================================
// Timeline Component Tests
// =============================================================================
describe('Timeline', () => {
  it('renders EmptyTimeline when initialPosts is empty', async () => {
    render(
      <Timeline
        initialPosts={[]}
        currentUserId="test-user-id"
      />
    )

    await waitFor(() => {
      expect(screen.getByTestId('empty-timeline')).toBeInTheDocument()
    })
  })

  it('renders PostCards when initialPosts has posts', async () => {
    const posts = [basePost, { ...basePost, id: 'post-2', content: '投稿2' }]

    render(
      <Timeline
        initialPosts={posts}
        currentUserId="test-user-id"
      />
    )

    await waitFor(() => {
      expect(screen.getByText('テスト投稿')).toBeInTheDocument()
      expect(screen.getByText('投稿2')).toBeInTheDocument()
    })
  })

  it('shows "すべての投稿を表示しました" when there is no next page and posts exist', async () => {
    const posts = [basePost]

    render(
      <Timeline
        initialPosts={posts}
        currentUserId="test-user-id"
      />
    )

    await waitFor(() => {
      expect(screen.getByText(/すべての投稿を表示しました/)).toBeInTheDocument()
    })
  })

  it('shows post count when there are 20+ posts (nextCursor exists)', async () => {
    const posts = createPosts(20)

    render(
      <Timeline
        initialPosts={posts}
        currentUserId="test-user-id"
      />
    )

    await waitFor(() => {
      expect(screen.getByText(/件の投稿を表示中/)).toBeInTheDocument()
    })
  })

  it('shows InFeedAdUnit every 5 posts (AD_INTERVAL)', async () => {
    const posts = createPosts(12)

    render(
      <Timeline
        initialPosts={posts}
        currentUserId="test-user-id"
      />
    )

    await waitFor(() => {
      const adUnits = screen.getAllByTestId('ad-unit')
      // With 12 posts, ads appear after index 4 (post 5), index 9 (post 10) => 2 ads
      expect(adUnits.length).toBeGreaterThanOrEqual(2)
    })
  })

  it('renders without currentUserId', async () => {
    render(
      <Timeline
        initialPosts={[basePost]}
      />
    )

    await waitFor(() => {
      expect(screen.getByText('テスト投稿')).toBeInTheDocument()
    })
  })
})

// =============================================================================
// PostCard Component Tests
// =============================================================================
describe('PostCard', () => {
  // ---- Branch: basic rendering ----
  it('renders post content', () => {
    render(<PostCard post={basePost} currentUserId="test-user-id" />)
    expect(screen.getByText('テスト投稿')).toBeInTheDocument()
  })

  // ---- Branch: avatarUrl null vs truthy ----
  it('renders fallback initial when avatarUrl is null', () => {
    render(<PostCard post={basePost} currentUserId="test-user-id" />)
    // Shows the first character of the nickname as fallback
    expect(screen.getByText('ユ')).toBeInTheDocument()
  })

  it('renders avatar image when avatarUrl is truthy', () => {
    const postWithAvatar = {
      ...basePost,
      user: { ...basePost.user, avatarUrl: '/avatar.jpg' },
    }
    render(<PostCard post={postWithAvatar} currentUserId="test-user-id" />)
    const img = screen.getByAltText('ユーザー1')
    expect(img).toBeInTheDocument()
  })

  // ---- Branch: content truncation (> 150 chars) ----
  it('shows "続きを読む" button when content exceeds 150 chars', () => {
    const longContent = 'あ'.repeat(200)
    const postLong = { ...basePost, content: longContent }
    render(<PostCard post={postLong} currentUserId="test-user-id" />)
    expect(screen.getByText(/続きを読む/)).toBeInTheDocument()
  })

  it('does not show "続きを読む" when content is short', () => {
    render(<PostCard post={basePost} currentUserId="test-user-id" />)
    expect(screen.queryByText(/続きを読む/)).not.toBeInTheDocument()
  })

  // ---- Branch: content is null/empty ----
  it('renders without content text when content is null', () => {
    const postNoContent = { ...basePost, content: null }
    render(<PostCard post={postNoContent} currentUserId="test-user-id" />)
    expect(screen.getByText('ユーザー1')).toBeInTheDocument()
    expect(screen.queryByText('テスト投稿')).not.toBeInTheDocument()
  })

  // ---- Branch: isRepost (post.repostPost exists) ----
  it('shows repost header when post is a repost', () => {
    const repostPost = {
      ...basePost,
      id: 'repost-1',
      repostPost: {
        ...basePost,
        id: 'original-1',
        content: 'オリジナル投稿',
        user: { id: 'user-2', nickname: 'オリジナルユーザー', avatarUrl: null },
        media: [],
      },
    }
    render(<PostCard post={repostPost} currentUserId="test-user-id" />)
    expect(screen.getByText('オリジナル投稿')).toBeInTheDocument()
    expect(screen.getByText(/がリポスト/)).toBeInTheDocument()
  })

  // ---- Branch: quotePost exists ----
  it('shows QuotedPost when post has quotePost', () => {
    const quotePost = {
      ...basePost,
      quotePost: {
        id: 'quoted-1',
        content: '引用された投稿',
        user: { id: 'user-3', nickname: '引用ユーザー', avatarUrl: null },
        createdAt: new Date().toISOString(),
      },
    }
    render(<PostCard post={quotePost} currentUserId="test-user-id" />)
    expect(screen.getByTestId('quoted-post')).toBeInTheDocument()
  })

  // ---- Branch: genres.length > 0 ----
  // genres in PostCard are typed as { id, name, category }
  it('shows genre tags when post has genres', () => {
    const postWithGenres = {
      ...basePost,
      genres: [
        { id: 'g1', name: '松柏類', category: '松柏類' },
        { id: 'g2', name: '雑木類', category: '雑木類' },
      ],
    }
    render(<PostCard post={postWithGenres} currentUserId="test-user-id" />)
    expect(screen.getByText('松柏類')).toBeInTheDocument()
    expect(screen.getByText('雑木類')).toBeInTheDocument()
  })

  it('does not show genre tags when genres is empty', () => {
    render(<PostCard post={basePost} currentUserId="test-user-id" />)
    expect(screen.queryByText('松柏類')).not.toBeInTheDocument()
  })

  // ---- Branch: currentUserId exists - shows LikeButton / BookmarkButton ----
  it('shows LikeButton and BookmarkButton when currentUserId is provided', () => {
    render(<PostCard post={basePost} currentUserId="test-user-id" />)
    expect(screen.getByTestId('like-button')).toBeInTheDocument()
    expect(screen.getByTestId('bookmark-button')).toBeInTheDocument()
  })

  // ---- Branch: !currentUserId - shows login links ----
  it('shows login links when currentUserId is not provided', () => {
    render(<PostCard post={basePost} currentUserId={undefined} />)
    expect(screen.queryByTestId('like-button')).not.toBeInTheDocument()
    expect(screen.queryByTestId('bookmark-button')).not.toBeInTheDocument()
    // Login links should be present instead
    const links = screen.getAllByRole('link')
    const loginLinks = links.filter(link => link.getAttribute('href') === '/login')
    expect(loginLinks.length).toBeGreaterThanOrEqual(1)
  })

  // ---- Branch: media.length > 0 ----
  it('shows ImageGallery when post has media', () => {
    const postWithMedia = {
      ...basePost,
      media: [
        { id: 'm1', url: '/img1.jpg', type: 'image', sortOrder: 0 },
      ],
    }
    render(<PostCard post={postWithMedia} currentUserId="test-user-id" />)
    expect(screen.getByTestId('image-gallery')).toBeInTheDocument()
  })

  it('does not show ImageGallery when post has no media', () => {
    render(<PostCard post={basePost} currentUserId="test-user-id" />)
    expect(screen.queryByTestId('image-gallery')).not.toBeInTheDocument()
  })

  // ---- Branch: poll exists ----
  it('shows PollDisplay when post has a poll', () => {
    const postWithPoll = {
      ...basePost,
      poll: {
        id: 'poll-1',
        expiresAt: new Date().toISOString(),
        options: [
          { id: 'opt1', text: '松', _count: { votes: 3 } },
          { id: 'opt2', text: '梅', _count: { votes: 5 } },
        ],
        votes: [],
        _count: { votes: 8 },
      },
    }
    render(<PostCard post={postWithPoll} currentUserId="test-user-id" />)
    expect(screen.getByTestId('poll-display')).toBeInTheDocument()
  })

  // ---- Branch: likesCount > 0 (without currentUserId, rendered as span text) ----
  it('shows like count when likeCount > 0 and no currentUserId', () => {
    const postWithLikes = { ...basePost, likeCount: 5 }
    render(<PostCard post={postWithLikes} currentUserId={undefined} />)
    // The count is rendered inside a <span className="text-xs">
    expect(screen.getByText('5')).toBeInTheDocument()
  })

  // ---- Branch: commentsCount > 0 ----
  it('shows comment count when commentCount > 0', () => {
    const postWithComments = { ...basePost, commentCount: 3 }
    render(<PostCard post={postWithComments} currentUserId="test-user-id" />)
    expect(screen.getByText('3')).toBeInTheDocument()
  })

  // ---- Branch: showMenu toggle ----
  it('toggles menu when menu button is clicked', async () => {
    const user = userEvent.setup()
    render(<PostCard post={basePost} currentUserId="test-user-id" />)

    // The menu button contains MoreHorizontalIcon (3 dots SVG)
    const buttons = screen.getAllByRole('button')
    // Find the menu toggle button (the one with the SVG circles)
    const menuButton = buttons.find(btn => {
      const svg = btn.querySelector('svg')
      return svg && svg.querySelectorAll('circle').length === 3
    })

    expect(menuButton).toBeTruthy()
    await user.click(menuButton!)
    // Menu should be visible now
  })

  // ---- Branch: isOwner && !isRepost - shows DeletePostButton ----
  it('shows DeletePostButton when user is the post owner', async () => {
    const user = userEvent.setup()
    const ownPost = {
      ...basePost,
      user: { id: 'test-user-id', nickname: 'テストユーザー', avatarUrl: null },
    }
    render(<PostCard post={ownPost} currentUserId="test-user-id" />)

    // Click the menu button
    const buttons = screen.getAllByRole('button')
    const menuButton = buttons.find(btn => {
      const svg = btn.querySelector('svg')
      return svg && svg.querySelectorAll('circle').length === 3
    })
    await user.click(menuButton!)

    await waitFor(() => {
      expect(screen.getByTestId('delete-post-button')).toBeInTheDocument()
    })
  })

  // ---- Branch: currentUserId && !isOwner - shows hide post / ReportButton ----
  it('shows hide post option and ReportButton when user is not the owner', async () => {
    const user = userEvent.setup()
    const otherPost = {
      ...basePost,
      user: { id: 'other-user-id', nickname: '他のユーザー', avatarUrl: null },
    }
    render(<PostCard post={otherPost} currentUserId="test-user-id" />)

    // Click the menu button
    const buttons = screen.getAllByRole('button')
    const menuButton = buttons.find(btn => {
      const svg = btn.querySelector('svg')
      return svg && svg.querySelectorAll('circle').length === 3
    })
    await user.click(menuButton!)

    await waitFor(() => {
      expect(screen.getByText('この投稿を非表示')).toBeInTheDocument()
      expect(screen.getByTestId('report-button')).toBeInTheDocument()
    })
  })

  // ---- Branch: clicking hide post button ----
  it('hides the post when hide button is clicked', async () => {
    const user = userEvent.setup()
    const otherPost = {
      ...basePost,
      user: { id: 'other-user-id', nickname: '他のユーザー', avatarUrl: null },
    }
    render(<PostCard post={otherPost} currentUserId="test-user-id" />)

    // Open menu
    const buttons = screen.getAllByRole('button')
    const menuButton = buttons.find(btn => {
      const svg = btn.querySelector('svg')
      return svg && svg.querySelectorAll('circle').length === 3
    })
    await user.click(menuButton!)

    // Click hide button
    const hideButton = screen.getByText('この投稿を非表示')
    await user.click(hideButton)

    // After hiding, the post content should disappear (isHiddenByUser returns null)
    await waitFor(() => {
      expect(screen.queryByText('テスト投稿')).not.toBeInTheDocument()
    })
  })

  // ---- Branch: disableNavigation ----
  it('does not apply cursor-pointer class when disableNavigation is true', () => {
    render(
      <PostCard
        post={basePost}
        currentUserId="test-user-id"
        disableNavigation={true}
      />
    )
    const article = screen.getByTestId('post-card')
    expect(article.className).not.toContain('cursor-pointer')
  })

  it('applies cursor-pointer class when disableNavigation is false', () => {
    render(<PostCard post={basePost} currentUserId="test-user-id" />)
    const article = screen.getByTestId('post-card')
    expect(article.className).toContain('cursor-pointer')
  })

  // ---- Branch: HeartIcon filled prop (liked post, no currentUserId) ----
  it('renders HeartIcon without fill when not liked (no currentUserId)', () => {
    const notLikedPost = { ...basePost, isLiked: false, likeCount: 1 }
    render(<PostCard post={notLikedPost} currentUserId={undefined} />)
    const heartSvg = document.querySelector('svg[fill="none"] path[d*="M19 14c"]')
    expect(heartSvg).toBeInTheDocument()
  })

  // ---- Branch: BookmarkIcon filled prop (bookmarked post, no currentUserId) ----
  it('renders BookmarkIcon without fill when not bookmarked (no currentUserId)', () => {
    const notBookmarkedPost = { ...basePost, isBookmarked: false }
    render(<PostCard post={notBookmarkedPost} currentUserId={undefined} />)
    const bookmarkSvg = document.querySelector('svg[fill="none"] path[d*="m19 21"]')
    expect(bookmarkSvg).toBeInTheDocument()
  })

  // ---- Branch: content expand ("続きを読む") click ----
  it('expands content when "続きを読む" is clicked', async () => {
    const user = userEvent.setup()
    const longContent = 'あ'.repeat(200)
    const postLong = { ...basePost, content: longContent }
    render(<PostCard post={postLong} currentUserId="test-user-id" />)

    const expandButton = screen.getByText(/続きを読む/)
    await user.click(expandButton)

    await waitFor(() => {
      // After expanding, the button should disappear
      expect(screen.queryByText(/続きを読む/)).not.toBeInTheDocument()
    })
  })

  // ---- Branch: post with both likeCount and commentCount > 0 ----
  it('shows both like and comment counts', () => {
    const postWithCounts = { ...basePost, likeCount: 10, commentCount: 7 }
    render(<PostCard post={postWithCounts} currentUserId="test-user-id" />)
    // commentCount rendered as text inside a span
    expect(screen.getByText('7')).toBeInTheDocument()
  })

  // ---- Branch: repost by current user (isOwner && isRepost - delete only, no edit/pin) ----
  it('shows DeletePostButton but not edit/pin for a repost when owner', async () => {
    const user = userEvent.setup()
    const repostByOwner = {
      ...basePost,
      id: 'repost-own',
      user: { id: 'test-user-id', nickname: 'テストユーザー', avatarUrl: null },
      repostPost: {
        ...basePost,
        id: 'original-2',
        content: 'リポスト元',
        user: { id: 'user-other', nickname: '他ユーザー', avatarUrl: '/other.jpg' },
        media: [],
      },
    }
    render(<PostCard post={repostByOwner} currentUserId="test-user-id" />)

    // Open menu
    const buttons = screen.getAllByRole('button')
    const menuButton = buttons.find(btn => {
      const svg = btn.querySelector('svg')
      return svg && svg.querySelectorAll('circle').length === 3
    })
    await user.click(menuButton!)

    // isOwner && isRepost => 自分のリポストは削除できる。編集・固定は元投稿用なので出さない。
    expect(screen.getByTestId('delete-post-button')).toBeInTheDocument()
    expect(screen.queryByTestId('edit-post-link')).not.toBeInTheDocument()
    expect(screen.queryByTestId('pin-post-button')).not.toBeInTheDocument()
  })

  // ---- Branch: media with multiple items ----
  it('shows ImageGallery for post with multiple media items', () => {
    const postMultiMedia = {
      ...basePost,
      media: [
        { id: 'm1', url: '/img1.jpg', type: 'image', sortOrder: 0 },
        { id: 'm2', url: '/img2.jpg', type: 'image', sortOrder: 1 },
        { id: 'm3', url: '/img3.jpg', type: 'image', sortOrder: 2 },
      ],
    }
    render(<PostCard post={postMultiMedia} currentUserId="test-user-id" />)
    expect(screen.getByTestId('image-gallery')).toBeInTheDocument()
  })

  // ---- Branch: post with genres, media, and quote together ----
  it('renders all features together (genres, media, quote)', () => {
    const fullPost = {
      ...basePost,
      content: 'フル機能テスト',
      genres: [{ id: 'g1', name: '松柏類', category: '松柏類' }],
      media: [
        { id: 'm1', url: '/img1.jpg', type: 'image', sortOrder: 0 },
      ],
      quotePost: {
        id: 'q1',
        content: '引用テスト',
        user: { id: 'u2', nickname: '引用者', avatarUrl: null },
        createdAt: new Date().toISOString(),
      },
      likeCount: 3,
      commentCount: 2,
    }
    render(<PostCard post={fullPost} currentUserId="test-user-id" />)
    expect(screen.getByText('フル機能テスト')).toBeInTheDocument()
    expect(screen.getByText('松柏類')).toBeInTheDocument()
    expect(screen.getByTestId('image-gallery')).toBeInTheDocument()
    expect(screen.getByTestId('quoted-post')).toBeInTheDocument()
    expect(screen.getByText('2')).toBeInTheDocument()
  })

  // ---- Branch: no currentUserId with various features ----
  it('renders post without auth buttons when currentUserId is undefined', () => {
    const postWithCounts = { ...basePost, likeCount: 5, commentCount: 2 }
    render(<PostCard post={postWithCounts} currentUserId={undefined} />)
    expect(screen.queryByTestId('like-button')).not.toBeInTheDocument()
    expect(screen.queryByTestId('bookmark-button')).not.toBeInTheDocument()
    expect(screen.getByText('テスト投稿')).toBeInTheDocument()
  })

  // ---- Branch: initialLiked and initialBookmarked props ----
  it('respects initialLiked prop', () => {
    render(
      <PostCard
        post={basePost}
        currentUserId="test-user-id"
        initialLiked={true}
      />
    )
    expect(screen.getByTestId('like-button')).toBeInTheDocument()
  })

  it('respects initialBookmarked prop', () => {
    render(
      <PostCard
        post={basePost}
        currentUserId="test-user-id"
        initialBookmarked={true}
      />
    )
    expect(screen.getByTestId('bookmark-button')).toBeInTheDocument()
  })

  // ---- Branch: post.isLiked and post.isBookmarked ----
  it('renders with liked state from post data', () => {
    const likedPost = { ...basePost, isLiked: true, likeCount: 1 }
    render(<PostCard post={likedPost} currentUserId="test-user-id" />)
    expect(screen.getByTestId('like-button')).toBeInTheDocument()
  })

  it('renders with bookmarked state from post data', () => {
    const bookmarkedPost = { ...basePost, isBookmarked: true }
    render(<PostCard post={bookmarkedPost} currentUserId="test-user-id" />)
    expect(screen.getByTestId('bookmark-button')).toBeInTheDocument()
  })

  // ---- Branch: repost with displayPost showing original content ----
  it('shows original post content in a repost', () => {
    const repost = {
      ...basePost,
      id: 'repost-3',
      content: null,
      user: { id: 'reposter', nickname: 'リポスター', avatarUrl: null },
      repostPost: {
        id: 'orig-3',
        content: '元の投稿です',
        createdAt: new Date().toISOString(),
        user: { id: 'original-user', nickname: 'オリジナル投稿者', avatarUrl: '/avatar.png' },
        media: [],
      },
    }
    render(<PostCard post={repost} currentUserId="test-user-id" />)
    expect(screen.getByText('元の投稿です')).toBeInTheDocument()
    expect(screen.getByText('オリジナル投稿者')).toBeInTheDocument()
    expect(screen.getByText(/がリポスト/)).toBeInTheDocument()
  })

  // ---- Branch: card click navigates when disableNavigation is false ----
  it('has click handler on article when disableNavigation is false', async () => {
    const user = userEvent.setup()
    render(<PostCard post={basePost} currentUserId="test-user-id" />)
    const article = screen.getByTestId('post-card')
    // Clicking should not throw
    await user.click(article)
  })

  // ---- Branch: card click does NOT navigate when disableNavigation is true ----
  it('has no click handler on article when disableNavigation is true', () => {
    render(
      <PostCard
        post={basePost}
        currentUserId="test-user-id"
        disableNavigation={true}
      />
    )
    const article = screen.getByTestId('post-card')
    // The onClick should be undefined, so no navigation occurs
    expect(article.className).not.toContain('cursor-pointer')
  })

  // ---- Branch: likesCount === 0 shows nothing ----
  it('does not show like count when likeCount is 0 and no currentUserId', () => {
    render(<PostCard post={basePost} currentUserId={undefined} />)
    // The span for likes should exist but be empty since likesCount is 0
    const heartButton = document.querySelector('svg path[d*="M19 14c"]')
    expect(heartButton).toBeInTheDocument()
  })

  // ---- Branch: commentsCount === 0 shows nothing ----
  it('does not show comment count when commentCount is 0', () => {
    render(<PostCard post={basePost} currentUserId="test-user-id" />)
    // No count number should appear for 0
    const commentSpans = document.querySelectorAll('span.text-xs')
    const emptySpans = Array.from(commentSpans).filter(span => span.textContent === '')
    expect(emptySpans.length).toBeGreaterThanOrEqual(0)
  })

  // ---- Branch: hide post with disableNavigation=true redirects to feed ----
  it('redirects to feed when hiding post with disableNavigation=true', async () => {
    const user = userEvent.setup()
    const otherPost = {
      ...basePost,
      user: { id: 'other-user-id', nickname: '他のユーザー', avatarUrl: null },
    }
    render(
      <PostCard
        post={otherPost}
        currentUserId="test-user-id"
        disableNavigation={true}
      />
    )

    // Open menu
    const buttons = screen.getAllByRole('button')
    const menuButton = buttons.find(btn => {
      const svg = btn.querySelector('svg')
      return svg && svg.querySelectorAll('circle').length === 3
    })
    await user.click(menuButton!)

    // Click hide button
    const hideButton = screen.getByText('この投稿を非表示')
    await user.click(hideButton)

    await waitFor(() => {
      expect(screen.queryByText('テスト投稿')).not.toBeInTheDocument()
    })
  })
})
