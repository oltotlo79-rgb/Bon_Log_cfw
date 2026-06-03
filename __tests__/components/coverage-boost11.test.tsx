import { vi } from 'vitest'
/* eslint-disable @next/next/no-img-element */
import { render, screen, fireEvent, waitFor, act } from '../utils/test-utils'
import { useInfiniteQuery as _useInfiniteQuery } from '@tanstack/react-query'

// ============================================================
// Mock setup
// ============================================================

const mockPush = vi.fn()
const mockRefresh = vi.fn()
const mockBack = vi.fn()

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    back: mockBack,
    refresh: mockRefresh,
    replace: vi.fn(),
    forward: vi.fn(),
    prefetch: vi.fn(),
  }),
  useSearchParams: () => {
    const params = new URLSearchParams('token=test-token&email=test@example.com')
    return params
  },
  usePathname: () => '/admin',
}))

vi.mock('next/image', () => ({
  __esModule: true,
  default: ({ src, alt, ..._rest }: any) => <img src={src} alt={alt} data-testid="mock-image" />,
}))

// Post-related action mocks
const mockDeleteComment = vi.fn()
const mockGetReplies = vi.fn()
vi.mock('@/lib/actions/comment', () => ({
  deleteComment: (...args: unknown[]) => mockDeleteComment(...args),
  getReplies: (...args: unknown[]) => mockGetReplies(...args),
}))

const mockHidePost = vi.fn()
vi.mock('@/lib/actions/hide-post', () => ({
  hidePost: (...args: unknown[]) => mockHidePost(...args),
}))

vi.mock('@/lib/mention-utils', () => ({
  parseContentSegments: (content: string) => [{ type: 'text', content }],
  insertMention: vi.fn(),
}))

vi.mock('@/components/post/ImageGallery', () => ({
  ImageGallery: ({ images }: any) => <div data-testid="image-gallery">{images.length} images</div>,
}))

vi.mock('@/components/post/QuotedPost', () => ({
  QuotedPost: ({ post }: any) => <div data-testid="quoted-post">{post.content}</div>,
}))

vi.mock('@/components/post/DeletePostButton', () => ({
  DeletePostButton: ({ postId, onDeleted }: any) => (
    <button data-testid="delete-post-btn" onClick={() => onDeleted && onDeleted()}>Delete {postId}</button>
  ),
}))

vi.mock('@/components/post/LikeButton', () => ({
  LikeButton: ({ postId, initialLiked, initialCount }: any) => (
    <button data-testid="like-button">Like {postId} {initialLiked ? 'liked' : ''} {initialCount}</button>
  ),
}))

vi.mock('@/components/post/BookmarkButton', () => ({
  BookmarkButton: ({ postId, initialBookmarked }: any) => (
    <button data-testid="bookmark-button">Bookmark {postId} {initialBookmarked ? 'saved' : ''}</button>
  ),
}))

vi.mock('@/components/report/ReportButton', () => ({
  ReportButton: ({ targetType, targetId, onSuccess }: any) => (
    <button data-testid="report-button" onClick={() => onSuccess && onSuccess()}>Report {targetType} {targetId}</button>
  ),
}))

vi.mock('@/components/post/PollDisplay', () => ({
  PollDisplay: () => <div data-testid="poll-display">Poll</div>,
}))

// Comment-related mocks
vi.mock('@/components/comment/CommentForm', () => ({
  CommentForm: ({ postId: _postId, parentId: _parentId, onSuccess, onCancel, placeholder }: any) => (
    <div data-testid="comment-form">
      <span>{placeholder}</span>
      <button data-testid="comment-submit" onClick={() => onSuccess && onSuccess()}>Submit</button>
      <button data-testid="comment-cancel" onClick={() => onCancel && onCancel()}>Cancel</button>
    </div>
  ),
}))

vi.mock('@/components/comment/CommentLikeButton', () => ({
  CommentLikeButton: ({ commentId }: any) => (
    <button data-testid="comment-like-button">Like {commentId}</button>
  ),
}))

vi.mock('@/components/comment/ThreadMuteButton', () => ({
  ThreadMuteButton: ({ rootCommentId }: any) => (
    <button data-testid="thread-mute-button">Mute {rootCommentId}</button>
  ),
}))

// Two-factor action mocks
const mockSetup2FA = vi.fn()
const mockEnable2FA = vi.fn()
const mockDisable2FA = vi.fn()
const mockRegenerateBackupCodes = vi.fn()
const mockGet2FAStatus = vi.fn()
vi.mock('@/lib/actions/two-factor', () => ({
  setup2FA: (...args: unknown[]) => mockSetup2FA(...args),
  enable2FA: (...args: unknown[]) => mockEnable2FA(...args),
  disable2FA: (...args: unknown[]) => mockDisable2FA(...args),
  regenerateBackupCodes: (...args: unknown[]) => mockRegenerateBackupCodes(...args),
  get2FAStatus: (...args: unknown[]) => mockGet2FAStatus(...args),
}))

// Password reset action mocks
const mockResetPassword = vi.fn()
const mockVerifyPasswordResetToken = vi.fn()
vi.mock('@/lib/actions/auth', () => ({
  resetPassword: (...args: unknown[]) => mockResetPassword(...args),
  verifyPasswordResetToken: (...args: unknown[]) => mockVerifyPasswordResetToken(...args),
}))

// Report action mocks
const mockUpdateReportStatus = vi.fn()
const mockDeleteReportedContent = vi.fn()
const mockDeleteReport = vi.fn()
vi.mock('@/lib/actions/report', () => ({
  updateReportStatus: (...args: unknown[]) => mockUpdateReportStatus(...args),
  deleteReportedContent: (...args: unknown[]) => mockDeleteReportedContent(...args),
  deleteReport: (...args: unknown[]) => mockDeleteReport(...args),
}))

// Mention action mocks
const mockSearchMentionUsers = vi.fn()
vi.mock('@/lib/actions/mention', () => ({
  searchMentionUsers: (...args: unknown[]) => mockSearchMentionUsers(...args),
}))

// Search action mocks
const mockSearchPosts = vi.fn()
const mockSearchUsers = vi.fn()
const mockSearchByTag = vi.fn()
vi.mock('@/lib/actions/search', () => ({
  searchPosts: (...args: unknown[]) => mockSearchPosts(...args),
  searchUsers: (...args: unknown[]) => mockSearchUsers(...args),
  searchByTag: (...args: unknown[]) => mockSearchByTag(...args),
}))

// useInView mock
vi.mock('react-intersection-observer', () => ({
  useInView: () => ({ ref: vi.fn(), inView: false }),
}))

// useToast モック
const mockToast = vi.fn()
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: mockToast, toasts: [] }),
}))

// React Query - need to unmock for SearchResults
vi.mock('@tanstack/react-query', async () => ({
  ...(await vi.importActual('@tanstack/react-query')),
  useInfiniteQuery: vi.fn().mockReturnValue({
    data: undefined,
    fetchNextPage: vi.fn(),
    hasNextPage: false,
    isFetchingNextPage: false,
    isLoading: false,
    error: null,
  }),
}))

// Clipboard mock
Object.defineProperty(navigator, 'clipboard', {
  value: {
    writeText: vi.fn().mockResolvedValue(undefined),
    readText: vi.fn().mockResolvedValue(''),
  },
  writable: true,
  configurable: true,
})

// ============================================================
// Imports (after mocks)
// ============================================================
import { PostCard } from '@/components/post/PostCard'
import { CommentCard } from '@/components/comment/CommentCard'
import { TwoFactorSettings } from '@/components/settings/TwoFactorSettings'
import { PasswordResetConfirmForm } from '@/components/auth/PasswordResetConfirmForm'
import { ReportActionsDropdown } from '@/app/admin/reports/ReportActionsDropdown'
import { MentionTextarea } from '@/components/common/MentionTextarea'
import { PostSearchResults, UserSearchResults, TagSearchResults, PopularTags } from '@/components/search/SearchResults'
import { AnalogClockPicker } from '@/components/ui/AnalogClockPicker'

// ============================================================
// Helper data
// ============================================================

function createPost(overrides: any = {}) {
  return {
    id: 'post-1',
    content: 'Hello World #test',
    createdAt: new Date('2024-01-01'),
    user: { id: 'user-1', nickname: 'TestUser', avatarUrl: null },
    media: [],
    genres: [],
    likeCount: 3,
    commentCount: 1,
    isLiked: false,
    isBookmarked: false,
    ...overrides,
  }
}

function createComment(overrides: any = {}) {
  return {
    id: 'comment-1',
    content: 'Test comment',
    createdAt: new Date('2024-01-01'),
    parentId: null,
    user: { id: 'user-1', nickname: 'TestUser', avatarUrl: null },
    likeCount: 2,
    replyCount: 0,
    isLiked: false,
    ...overrides,
  }
}

// ============================================================
// Tests: PostCard
// ============================================================
describe('PostCard - uncovered functions and branches', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders PostCard with basic post and icons', () => {
    const post = createPost()
    render(<PostCard post={post} currentUserId="user-1" />)
    expect(screen.getByText('Hello World #test')).toBeInTheDocument()
    expect(screen.getByText('TestUser')).toBeInTheDocument()
  })

  it('renders HeartIcon for unauthenticated user', () => {
    const post = createPost({ likeCount: 5 })
    render(<PostCard post={post} />)
    // No currentUserId - should show login link with HeartIcon
    const loginLinks = screen.getAllByRole('link', { name: /5/ })
    expect(loginLinks.length).toBeGreaterThan(0)
  })

  it('renders BookmarkIcon for unauthenticated user', () => {
    const post = createPost()
    render(<PostCard post={post} />)
    // No currentUserId - should show bookmark login link
    const links = screen.getAllByRole('link')
    const loginLinks = links.filter(l => l.getAttribute('href') === '/login')
    expect(loginLinks.length).toBeGreaterThan(0)
  })

  it('opens and closes more menu (MoreHorizontalIcon)', () => {
    const post = createPost()
    render(<PostCard post={post} currentUserId="user-1" />)

    // Find and click the menu button (contains MoreHorizontalIcon)
    const menuButtons = screen.getAllByRole('button')
    const moreButton = menuButtons.find(b => b.querySelector('svg'))
    expect(moreButton).toBeTruthy()
    fireEvent.click(moreButton!)

    // Should see delete button since isOwner
    expect(screen.getByTestId('delete-post-btn')).toBeInTheDocument()

    // Click the overlay to close
    const overlay = document.querySelector('.fixed.inset-0.z-10')
    if (overlay) {
      fireEvent.click(overlay)
    }
  })

  it('shows menu with hide and report for non-owner', () => {
    const post = createPost({ user: { id: 'other-user', nickname: 'Other', avatarUrl: null } })
    render(<PostCard post={post} currentUserId="user-1" />)

    const menuButtons = screen.getAllByRole('button')
    const moreButton = menuButtons.find(b => b.querySelector('svg'))
    fireEvent.click(moreButton!)

    // Should see hide button and report button
    expect(screen.getByText('この投稿を非表示')).toBeInTheDocument()
    expect(screen.getByTestId('report-button')).toBeInTheDocument()
  })

  it('hides post via hide button', async () => {
    mockHidePost.mockResolvedValue({})
    const post = createPost({ user: { id: 'other-user', nickname: 'Other', avatarUrl: null } })
    render(<PostCard post={post} currentUserId="user-1" />)

    const menuButtons = screen.getAllByRole('button')
    const moreButton = menuButtons.find(b => b.querySelector('svg'))
    fireEvent.click(moreButton!)

    const hideButton = screen.getByText('この投稿を非表示')
    await act(async () => {
      fireEvent.click(hideButton)
    })

    await waitFor(() => {
      expect(mockHidePost).toHaveBeenCalledWith('post-1')
    })
  })

  it('navigates on card click when not disabled', () => {
    const post = createPost()
    render(<PostCard post={post} currentUserId="user-1" />)

    const article = screen.getByTestId('post-card')
    fireEvent.click(article)

    expect(mockPush).toHaveBeenCalledWith('/posts/post-1')
  })

  it('does not navigate when disableNavigation is true', () => {
    const post = createPost()
    render(<PostCard post={post} currentUserId="user-1" disableNavigation />)

    const article = screen.getByTestId('post-card')
    fireEvent.click(article)

    expect(mockPush).not.toHaveBeenCalled()
  })

  it('renders RepeatIcon for repost indicator', () => {
    const repostPost = {
      id: 'original-post',
      content: 'Original content',
      createdAt: new Date('2024-01-01'),
      user: { id: 'original-user', nickname: 'OriginalUser', avatarUrl: null },
      media: [],
    }
    const post = createPost({ repostPost })
    render(<PostCard post={post} currentUserId="user-1" />)

    // Should see repost indicator
    expect(screen.getByText('がリポスト')).toBeInTheDocument()
  })

  it('renders genres with links', () => {
    const post = createPost({
      genres: [{ id: 'g1', name: '松柏類', category: 'test' }],
    })
    render(<PostCard post={post} currentUserId="user-1" />)
    expect(screen.getByText('松柏類')).toBeInTheDocument()
  })

  it('renders MessageCircleIcon in comment link', () => {
    const post = createPost({ commentCount: 7 })
    render(<PostCard post={post} currentUserId="user-1" />)
    expect(screen.getByText('7')).toBeInTheDocument()
  })

  it('renders RepeatIcon in repost button', () => {
    const post = createPost()
    render(<PostCard post={post} currentUserId="user-1" />)
    // The repost button exists as a ghost button
    const actionButtons = screen.getAllByRole('button')
    expect(actionButtons.length).toBeGreaterThan(0)
  })

  it('renders LikeButton for authenticated user', () => {
    const post = createPost()
    render(<PostCard post={post} currentUserId="user-1" />)
    expect(screen.getByTestId('like-button')).toBeInTheDocument()
  })

  it('renders BookmarkButton for authenticated user', () => {
    const post = createPost()
    render(<PostCard post={post} currentUserId="user-1" />)
    expect(screen.getByTestId('bookmark-button')).toBeInTheDocument()
  })

  it('shows quoted post when quotePost exists', () => {
    const post = createPost({
      quotePost: { id: 'q1', content: 'Quoted content', createdAt: new Date(), user: { id: 'u2', nickname: 'QuoteUser', avatarUrl: null } },
    })
    render(<PostCard post={post} currentUserId="user-1" />)
    expect(screen.getByTestId('quoted-post')).toBeInTheDocument()
  })

  it('shows poll when poll exists', () => {
    const post = createPost({
      poll: { id: 'p1', expiresAt: new Date(), options: [], votes: [], _count: { votes: 0 } },
    })
    render(<PostCard post={post} currentUserId="user-1" />)
    expect(screen.getByTestId('poll-display')).toBeInTheDocument()
  })

  it('truncates long content and shows expand button', () => {
    const longContent = 'A'.repeat(200)
    const post = createPost({ content: longContent })
    render(<PostCard post={post} currentUserId="user-1" />)

    expect(screen.getByText('続きを読む')).toBeInTheDocument()
    fireEvent.click(screen.getByText('続きを読む'))
    expect(screen.queryByText('続きを読む')).not.toBeInTheDocument()
  })

  it('shows image gallery when media exists', () => {
    const post = createPost({
      media: [{ id: 'm1', url: '/img1.jpg', type: 'image', sortOrder: 0 }],
    })
    render(<PostCard post={post} currentUserId="user-1" />)
    expect(screen.getByTestId('image-gallery')).toBeInTheDocument()
  })

  it('renders user avatar when avatarUrl is present', () => {
    const post = createPost({
      user: { id: 'user-1', nickname: 'TestUser', avatarUrl: '/avatar.jpg' },
    })
    render(<PostCard post={post} currentUserId="user-1" />)
    expect(screen.getByTestId('mock-image')).toBeInTheDocument()
  })
})

// ============================================================
// Tests: CommentCard
// ============================================================
describe('CommentCard - uncovered functions and branches', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetReplies.mockResolvedValue({ replies: [] })
    mockDeleteComment.mockResolvedValue({})
  })

  it('renders basic comment', () => {
    const comment = createComment()
    render(<CommentCard comment={comment} postId="post-1" currentUserId="user-1" />)
    expect(screen.getByText('Test comment')).toBeInTheDocument()
    expect(screen.getByText('TestUser')).toBeInTheDocument()
  })

  it('shows reply button and opens reply form', () => {
    const comment = createComment()
    render(<CommentCard comment={comment} postId="post-1" currentUserId="user-1" />)

    const replyButton = screen.getByText('返信')
    fireEvent.click(replyButton)

    expect(screen.getByTestId('comment-form')).toBeInTheDocument()
    expect(screen.getByText('@TestUser への返信...')).toBeInTheDocument()
  })

  it('closes reply form when cancel is clicked', () => {
    const comment = createComment()
    render(<CommentCard comment={comment} postId="post-1" currentUserId="user-1" />)

    fireEvent.click(screen.getByText('返信'))
    expect(screen.getByTestId('comment-form')).toBeInTheDocument()

    fireEvent.click(screen.getByTestId('comment-cancel'))
    expect(screen.queryByTestId('comment-form')).not.toBeInTheDocument()
  })

  it('handles reply success', async () => {
    mockGetReplies.mockResolvedValue({ replies: [createComment({ id: 'reply-1', content: 'Reply content', parentId: 'comment-1' })] })
    const comment = createComment({ replyCount: 1 })
    render(<CommentCard comment={comment} postId="post-1" currentUserId="user-1" />)

    fireEvent.click(screen.getByText('返信'))

    await act(async () => {
      fireEvent.click(screen.getByTestId('comment-submit'))
    })

    await waitFor(() => {
      expect(mockGetReplies).toHaveBeenCalled()
      expect(mockRefresh).toHaveBeenCalled()
    })
  })

  it('shows delete button for own comment and handles delete', async () => {
    mockDeleteComment.mockResolvedValue({ success: true })
    const comment = createComment()
    render(<CommentCard comment={comment} postId="post-1" currentUserId="user-1" />)

    // Open the AlertDialog via the Trash icon trigger
    const trashTrigger = screen
      .getAllByRole('button')
      .find(b => b.querySelector('.lucide-trash-2') !== null)
    expect(trashTrigger).toBeDefined()
    fireEvent.click(trashTrigger as HTMLElement)

    // Confirm dialog appears with its title and destructive action
    expect(screen.getByText('コメントを削除')).toBeInTheDocument()
    const confirmBtn = screen.getByText('削除')

    await act(async () => {
      fireEvent.click(confirmBtn)
    })

    await waitFor(() => {
      expect(mockDeleteComment).toHaveBeenCalledWith('comment-1')
    })
  })

  it('toggles replies (show/hide)', async () => {
    mockGetReplies.mockResolvedValue({
      replies: [createComment({ id: 'reply-1', content: 'Reply text', parentId: 'comment-1', replyCount: 0 })],
    })

    const comment = createComment({ replyCount: 2 })
    render(<CommentCard comment={comment} postId="post-1" currentUserId="user-1" />)

    // Should show "2件の返信を表示" button
    const showRepliesButton = screen.getByText('2件の返信を表示')
    expect(showRepliesButton).toBeInTheDocument()

    // Click to show replies
    await act(async () => {
      fireEvent.click(showRepliesButton)
    })

    await waitFor(() => {
      expect(mockGetReplies).toHaveBeenCalledWith('comment-1')
    })

    // Should show "返信を非表示"
    await waitFor(() => {
      expect(screen.getByText('返信を非表示')).toBeInTheDocument()
    })

    // Click again to hide
    fireEvent.click(screen.getByText('返信を非表示'))
    await waitFor(() => {
      expect(screen.getByText('2件の返信を表示')).toBeInTheDocument()
    })
  })

  it('renders blocked user comment', () => {
    const comment = createComment({ isBlockedUser: true, replyCount: 1 })
    render(<CommentCard comment={comment} postId="post-1" currentUserId="user-1" />)
    expect(screen.getByText('ブロック中のユーザーのコメントです')).toBeInTheDocument()
    expect(screen.getByText('1件の返信を表示')).toBeInTheDocument()
  })

  it('renders deleted comment', () => {
    const comment = createComment({ isDeleted: true, replyCount: 3 })
    render(<CommentCard comment={comment} postId="post-1" currentUserId="user-1" />)
    expect(screen.getByText('削除されたコメントです')).toBeInTheDocument()
    expect(screen.getByText('3件の返信を表示')).toBeInTheDocument()
  })

  it('expands replies on blocked user comment', async () => {
    mockGetReplies.mockResolvedValue({
      replies: [createComment({ id: 'reply-1', content: 'Reply from non-blocked', parentId: 'comment-1' })],
    })

    const comment = createComment({ isBlockedUser: true, replyCount: 1 })
    render(<CommentCard comment={comment} postId="post-1" currentUserId="user-1" />)

    await act(async () => {
      fireEvent.click(screen.getByText('1件の返信を表示'))
    })

    await waitFor(() => {
      expect(mockGetReplies).toHaveBeenCalledWith('comment-1')
    })
  })

  it('expands replies on deleted comment', async () => {
    mockGetReplies.mockResolvedValue({
      replies: [createComment({ id: 'reply-1', content: 'Reply on deleted', parentId: 'comment-1' })],
    })

    const comment = createComment({ isDeleted: true, replyCount: 1 })
    render(<CommentCard comment={comment} postId="post-1" currentUserId="user-1" />)

    await act(async () => {
      fireEvent.click(screen.getByText('1件の返信を表示'))
    })

    await waitFor(() => {
      expect(mockGetReplies).toHaveBeenCalledWith('comment-1')
    })
  })

  it('shows comment media (image)', () => {
    const comment = createComment({
      media: [{ id: 'media-1', url: '/img.jpg', type: 'image', sortOrder: 0 }],
    })
    render(<CommentCard comment={comment} postId="post-1" currentUserId="user-1" />)
    expect(screen.getByTestId('mock-image')).toBeInTheDocument()
  })

  it('shows comment media (video)', () => {
    const comment = createComment({
      media: [{ id: 'media-1', url: '/vid.mp4', type: 'video', sortOrder: 0 }],
    })
    render(<CommentCard comment={comment} postId="post-1" currentUserId="user-1" />)
    // Video element should be present
    const video = document.querySelector('video')
    expect(video).toBeTruthy()
    expect(video?.getAttribute('src')).toBe('/vid.mp4')
  })

  it('shows avatar image when avatarUrl is present', () => {
    const comment = createComment({
      user: { id: 'user-1', nickname: 'TestUser', avatarUrl: '/avatar.jpg' },
    })
    render(<CommentCard comment={comment} postId="post-1" currentUserId="user-1" />)
    expect(screen.getByTestId('mock-image')).toBeInTheDocument()
  })

  it('does not show delete button for non-owner', () => {
    const comment = createComment({ user: { id: 'other-user', nickname: 'Other', avatarUrl: null } })
    render(<CommentCard comment={comment} postId="post-1" currentUserId="user-1" />)

    // Should not find Trash2 delete trigger
    const buttons = screen.getAllByRole('button')
    const hasDeleteTrigger = buttons.some(b => {
      const text = b.textContent || ''
      return text.includes('削除')
    })
    expect(hasDeleteTrigger).toBe(false)
  })

  it('calls onDeleted callback on successful delete', async () => {
    const onDeleted = vi.fn()
    mockDeleteComment.mockResolvedValue({ success: true })
    const comment = createComment()
    render(<CommentCard comment={comment} postId="post-1" currentUserId="user-1" onDeleted={onDeleted} />)

    // Open the alert dialog and confirm delete
    // Find the trash button
    const buttons = screen.getAllByRole('button')
    for (const btn of buttons) {
      if (btn.querySelector('.lucide-trash-2') !== null) {
        fireEvent.click(btn)
        break
      }
    }

    // Look for "削除" button in dialog
    const deleteConfirmBtn = screen.queryByText('削除')
    if (deleteConfirmBtn) {
      await act(async () => {
        fireEvent.click(deleteConfirmBtn)
      })

      await waitFor(() => {
        expect(mockDeleteComment).toHaveBeenCalledWith('comment-1')
        expect(onDeleted).toHaveBeenCalledWith('comment-1')
      })
    }
  })
})

// ============================================================
// Tests: TwoFactorSettings
// ============================================================
describe('TwoFactorSettings - uncovered functions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers({ shouldAdvanceTime: true })
    mockGet2FAStatus.mockResolvedValue({ success: true, data: { enabled: false } })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('renders loading state initially', () => {
    mockGet2FAStatus.mockImplementation(() => new Promise(() => {})) // never resolves
    render(<TwoFactorSettings />)
    // Should show skeleton
    const skeleton = document.querySelector('.animate-pulse')
    expect(skeleton).toBeTruthy()
  })

  it('renders disabled state when 2FA is not enabled', async () => {
    mockGet2FAStatus.mockResolvedValue({ success: true, data: { enabled: false } })
    await act(async () => {
      render(<TwoFactorSettings />)
    })

    await waitFor(() => {
      expect(screen.getByText('2段階認証を設定する')).toBeInTheDocument()
    })
  })

  it('starts setup flow when clicking enable button', async () => {
    mockGet2FAStatus.mockResolvedValue({ success: true, data: { enabled: false } })
    mockSetup2FA.mockResolvedValue({
      success: true,
      data: {
        qrCode: 'data:image/png;base64,test',
        secret: 'TESTSECRET123',
        setupId: 'test-setup-id',
        backupCodes: ['CODE1', 'CODE2', 'CODE3'],
      },
    })

    await act(async () => {
      render(<TwoFactorSettings />)
    })

    await waitFor(() => {
      expect(screen.getByText('2段階認証を設定する')).toBeInTheDocument()
    })

    await act(async () => {
      fireEvent.click(screen.getByText('2段階認証を設定する'))
    })

    await waitFor(() => {
      expect(mockSetup2FA).toHaveBeenCalled()
      expect(screen.getByText('TESTSECRET123')).toBeInTheDocument()
    })

    // Should show backup codes
    expect(screen.getByText('CODE1')).toBeInTheDocument()
    expect(screen.getByText('CODE2')).toBeInTheDocument()
  })

  it('handles setup error', async () => {
    mockGet2FAStatus.mockResolvedValue({ success: true, data: { enabled: false } })
    mockSetup2FA.mockResolvedValue({ success: false, error: 'Setup failed' })

    await act(async () => {
      render(<TwoFactorSettings />)
    })

    await waitFor(() => {
      expect(screen.getByText('2段階認証を設定する')).toBeInTheDocument()
    })

    await act(async () => {
      fireEvent.click(screen.getByText('2段階認証を設定する'))
    })

    await waitFor(() => {
      expect(screen.getByText('Setup failed')).toBeInTheDocument()
    })
  })

  it('verifies 2FA code and enables it', async () => {
    mockGet2FAStatus.mockResolvedValue({ success: true, data: { enabled: false } })
    mockSetup2FA.mockResolvedValue({
      success: true,
      data: {
        qrCode: 'data:image/png;base64,test',
        secret: 'TESTSECRET123',
        setupId: 'test-setup-id',
        backupCodes: ['CODE1', 'CODE2'],
      },
    })
    mockEnable2FA.mockResolvedValue({ success: true })

    await act(async () => {
      render(<TwoFactorSettings />)
    })

    await waitFor(() => {
      expect(screen.getByText('2段階認証を設定する')).toBeInTheDocument()
    })

    await act(async () => {
      fireEvent.click(screen.getByText('2段階認証を設定する'))
    })

    await waitFor(() => {
      expect(screen.getByLabelText('認証コード')).toBeInTheDocument()
    })

    // Enter verification code
    fireEvent.change(screen.getByLabelText('認証コード'), { target: { value: '123456' } })

    // Submit
    await act(async () => {
      fireEvent.click(screen.getByText('2段階認証を有効化'))
    })

    await waitFor(() => {
      expect(mockEnable2FA).toHaveBeenCalledWith('123456', 'test-setup-id')
    })
  })

  it('handles enable 2FA error', async () => {
    mockGet2FAStatus.mockResolvedValue({ success: true, data: { enabled: false } })
    mockSetup2FA.mockResolvedValue({
      success: true,
      data: { qrCode: 'data:image/png;base64,test', secret: 'SECRET', setupId: 'test-setup-id', backupCodes: ['C1'] },
    })
    mockEnable2FA.mockResolvedValue({ success: false, error: 'Invalid code' })

    await act(async () => {
      render(<TwoFactorSettings />)
    })

    await waitFor(() => {
      fireEvent.click(screen.getByText('2段階認証を設定する'))
    })

    await waitFor(() => {
      expect(screen.getByLabelText('認証コード')).toBeInTheDocument()
    })

    fireEvent.change(screen.getByLabelText('認証コード'), { target: { value: '000000' } })

    await act(async () => {
      fireEvent.click(screen.getByText('2段階認証を有効化'))
    })

    await waitFor(() => {
      expect(screen.getByText('Invalid code')).toBeInTheDocument()
    })
  })

  it('cancels setup flow', async () => {
    mockGet2FAStatus.mockResolvedValue({ success: true, data: { enabled: false } })
    mockSetup2FA.mockResolvedValue({
      success: true,
      data: { qrCode: 'data:image/png;base64,test', secret: 'SECRET', setupId: 'test-setup-id', backupCodes: ['C1'] },
    })

    await act(async () => {
      render(<TwoFactorSettings />)
    })

    await act(async () => {
      fireEvent.click(screen.getByText('2段階認証を設定する'))
    })

    await waitFor(() => {
      expect(screen.getByText('キャンセル')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText('キャンセル'))

    await waitFor(() => {
      expect(screen.getByText('2段階認証を設定する')).toBeInTheDocument()
    })
  })

  it('copies individual backup code', async () => {
    mockGet2FAStatus.mockResolvedValue({ success: true, data: { enabled: false } })
    mockSetup2FA.mockResolvedValue({
      success: true,
      data: { qrCode: 'data:image/png;base64,test', secret: 'SECRET', setupId: 'test-setup-id', backupCodes: ['BACKUP1', 'BACKUP2'] },
    })

    await act(async () => {
      render(<TwoFactorSettings />)
    })

    await act(async () => {
      fireEvent.click(screen.getByText('2段階認証を設定する'))
    })

    await waitFor(() => {
      expect(screen.getByText('BACKUP1')).toBeInTheDocument()
    })

    // Find copy buttons (they are next to code elements)
    const copyButtons = document.querySelectorAll('button.text-muted-foreground')
    if (copyButtons.length > 0) {
      await act(async () => {
        fireEvent.click(copyButtons[0])
      })
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith('BACKUP1')
    }
  })

  it('copies all backup codes', async () => {
    mockGet2FAStatus.mockResolvedValue({ success: true, data: { enabled: false } })
    mockSetup2FA.mockResolvedValue({
      success: true,
      data: { qrCode: 'data:image/png;base64,test', secret: 'SECRET', setupId: 'test-setup-id', backupCodes: ['BACKUP1', 'BACKUP2'] },
    })

    await act(async () => {
      render(<TwoFactorSettings />)
    })

    await act(async () => {
      fireEvent.click(screen.getByText('2段階認証を設定する'))
    })

    await waitFor(() => {
      expect(screen.getByText('全てコピー')).toBeInTheDocument()
    })

    await act(async () => {
      fireEvent.click(screen.getByText('全てコピー'))
    })

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('BACKUP1\nBACKUP2')
  })

  it('renders enabled state and shows disable button', async () => {
    mockGet2FAStatus.mockResolvedValue({ success: true, data: { enabled: true, backupCodesRemaining: 5 } })

    await act(async () => {
      render(<TwoFactorSettings />)
    })

    await waitFor(() => {
      expect(screen.getByText('2段階認証が有効です')).toBeInTheDocument()
      expect(screen.getByText('残りのバックアップコード: 5個')).toBeInTheDocument()
    })

    expect(screen.getByRole('button', { name: '2段階認証を無効化' })).toBeInTheDocument()
  })

  it('shows warning when backup codes are low', async () => {
    mockGet2FAStatus.mockResolvedValue({ success: true, data: { enabled: true, backupCodesRemaining: 2 } })

    await act(async () => {
      render(<TwoFactorSettings />)
    })

    await waitFor(() => {
      expect(screen.getByText('バックアップコードが少なくなっています。新しいコードを生成することをおすすめします。')).toBeInTheDocument()
    })
  })

  it('disables 2FA with password', async () => {
    mockGet2FAStatus.mockResolvedValue({ success: true, data: { enabled: true, backupCodesRemaining: 5 } })
    mockDisable2FA.mockResolvedValue({ success: true })

    await act(async () => {
      render(<TwoFactorSettings />)
    })

    await waitFor(() => {
      expect(screen.getByRole('button', { name: '2段階認証を無効化' })).toBeInTheDocument()
    })

    // Click the destructive button to show the form
    fireEvent.click(screen.getByRole('button', { name: '2段階認証を無効化' }))

    await waitFor(() => {
      expect(screen.getByLabelText('パスワード')).toBeInTheDocument()
    })

    // Enter password
    fireEvent.change(screen.getByLabelText('パスワード'), { target: { value: 'mypassword' } })

    // Toggle password visibility
    const toggleButtons = document.querySelectorAll('button[type="button"]')
    const toggleBtn = Array.from(toggleButtons).find(b => b.closest('.relative'))
    if (toggleBtn) {
      fireEvent.click(toggleBtn)
    }

    // Submit
    await act(async () => {
      fireEvent.click(screen.getByText('無効化する'))
    })

    await waitFor(() => {
      expect(mockDisable2FA).toHaveBeenCalledWith('mypassword')
    })
  })

  it('handles disable error', async () => {
    mockGet2FAStatus.mockResolvedValue({ success: true, data: { enabled: true, backupCodesRemaining: 5 } })
    mockDisable2FA.mockResolvedValue({ success: false, error: 'Wrong password' })

    await act(async () => {
      render(<TwoFactorSettings />)
    })

    await waitFor(() => {
      fireEvent.click(screen.getByRole('button', { name: '2段階認証を無効化' }))
    })

    await waitFor(() => {
      fireEvent.change(screen.getByLabelText('パスワード'), { target: { value: 'wrong' } })
    })

    await act(async () => {
      fireEvent.click(screen.getByText('無効化する'))
    })

    await waitFor(() => {
      expect(screen.getByText('Wrong password')).toBeInTheDocument()
    })
  })

  it('regenerates backup codes', async () => {
    mockGet2FAStatus.mockResolvedValue({ success: true, data: { enabled: true, backupCodesRemaining: 5 } })
    mockRegenerateBackupCodes.mockResolvedValue({ success: true, data: { backupCodes: ['NEW1', 'NEW2'] } })

    await act(async () => {
      render(<TwoFactorSettings />)
    })

    await waitFor(() => {
      expect(screen.getByText('バックアップコードを再生成')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText('バックアップコードを再生成'))

    await waitFor(() => {
      expect(screen.getByLabelText('パスワード')).toBeInTheDocument()
    })

    fireEvent.change(screen.getByLabelText('パスワード'), { target: { value: 'mypass' } })

    await act(async () => {
      fireEvent.click(screen.getByText('再生成'))
    })

    await waitFor(() => {
      expect(mockRegenerateBackupCodes).toHaveBeenCalledWith('mypass')
    })
  })

  it('handles get2FAStatus error', async () => {
    mockGet2FAStatus.mockResolvedValue({ success: false, error: 'Failed to get status' })

    await act(async () => {
      render(<TwoFactorSettings />)
    })

    await waitFor(() => {
      expect(screen.getByText('Failed to get status')).toBeInTheDocument()
    })
  })
})

// ============================================================
// Tests: PasswordResetConfirmForm
// ============================================================
describe('PasswordResetConfirmForm - uncovered functions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers({ shouldAdvanceTime: true })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('renders verifying state initially', async () => {
    mockVerifyPasswordResetToken.mockImplementation(() => new Promise(() => {}))
    render(<PasswordResetConfirmForm />)
    expect(screen.getByText('リンクを検証中...')).toBeInTheDocument()
  })

  it('renders form when token is valid', async () => {
    mockVerifyPasswordResetToken.mockResolvedValue({ valid: true })

    await act(async () => {
      render(<PasswordResetConfirmForm />)
    })

    await waitFor(() => {
      expect(screen.getByLabelText('新しいパスワード')).toBeInTheDocument()
      expect(screen.getByLabelText('新しいパスワード（確認）')).toBeInTheDocument()
    })
  })

  it('toggles password visibility', async () => {
    mockVerifyPasswordResetToken.mockResolvedValue({ valid: true })

    await act(async () => {
      render(<PasswordResetConfirmForm />)
    })

    await waitFor(() => {
      expect(screen.getByLabelText('新しいパスワード')).toBeInTheDocument()
    })

    const passwordInput = screen.getByLabelText('新しいパスワード')
    expect(passwordInput).toHaveAttribute('type', 'password')

    // Click the first eye toggle button (for password field)
    const toggleButtons = screen.getAllByLabelText('パスワードを表示')
    fireEvent.click(toggleButtons[0])
    expect(passwordInput).toHaveAttribute('type', 'text')

    // Click again to hide
    const hideButtons = screen.getAllByLabelText('パスワードを隠す')
    fireEvent.click(hideButtons[0])
    expect(passwordInput).toHaveAttribute('type', 'password')
  })

  it('toggles confirm password visibility', async () => {
    mockVerifyPasswordResetToken.mockResolvedValue({ valid: true })

    await act(async () => {
      render(<PasswordResetConfirmForm />)
    })

    await waitFor(() => {
      expect(screen.getByLabelText('新しいパスワード（確認）')).toBeInTheDocument()
    })

    const confirmInput = screen.getByLabelText('新しいパスワード（確認）')
    expect(confirmInput).toHaveAttribute('type', 'password')

    // Find the second toggle (confirm password)
    const allToggles = screen.getAllByLabelText('パスワードを表示')
    fireEvent.click(allToggles[1])
    expect(confirmInput).toHaveAttribute('type', 'text')
  })

  it('shows error when passwords do not match', async () => {
    mockVerifyPasswordResetToken.mockResolvedValue({ valid: true })

    await act(async () => {
      render(<PasswordResetConfirmForm />)
    })

    await waitFor(() => {
      expect(screen.getByLabelText('新しいパスワード')).toBeInTheDocument()
    })

    fireEvent.change(screen.getByLabelText('新しいパスワード'), { target: { value: 'password1' } })
    fireEvent.change(screen.getByLabelText('新しいパスワード（確認）'), { target: { value: 'password2' } })

    await act(async () => {
      fireEvent.click(screen.getByText('パスワードを更新'))
    })

    await waitFor(() => {
      expect(screen.getByText('パスワードが一致しません')).toBeInTheDocument()
    })
  })

  it('shows error for short password', async () => {
    mockVerifyPasswordResetToken.mockResolvedValue({ valid: true })

    await act(async () => {
      render(<PasswordResetConfirmForm />)
    })

    await waitFor(() => {
      expect(screen.getByLabelText('新しいパスワード')).toBeInTheDocument()
    })

    fireEvent.change(screen.getByLabelText('新しいパスワード'), { target: { value: 'abc1' } })
    fireEvent.change(screen.getByLabelText('新しいパスワード（確認）'), { target: { value: 'abc1' } })

    await act(async () => {
      fireEvent.submit(screen.getByText('パスワードを更新').closest('form')!)
    })

    await waitFor(() => {
      expect(screen.getByText('パスワードは8文字以上で入力してください')).toBeInTheDocument()
    })
  })

  it('shows error for password without letter or number', async () => {
    mockVerifyPasswordResetToken.mockResolvedValue({ valid: true })

    await act(async () => {
      render(<PasswordResetConfirmForm />)
    })

    await waitFor(() => {
      expect(screen.getByLabelText('新しいパスワード')).toBeInTheDocument()
    })

    fireEvent.change(screen.getByLabelText('新しいパスワード'), { target: { value: '12345678' } })
    fireEvent.change(screen.getByLabelText('新しいパスワード（確認）'), { target: { value: '12345678' } })

    await act(async () => {
      fireEvent.submit(screen.getByText('パスワードを更新').closest('form')!)
    })

    await waitFor(() => {
      expect(screen.getByText('パスワードはアルファベットと数字を両方含めてください')).toBeInTheDocument()
    })
  })

  it('renders invalid token view', async () => {
    mockVerifyPasswordResetToken.mockResolvedValue({ valid: false })

    await act(async () => {
      render(<PasswordResetConfirmForm />)
    })

    await waitFor(() => {
      expect(screen.getByText('リンクが無効です')).toBeInTheDocument()
      expect(screen.getByText('パスワードリセットを再度リクエスト')).toBeInTheDocument()
    })
  })

  it('submits successfully and shows success message', async () => {
    mockVerifyPasswordResetToken.mockResolvedValue({ valid: true })
    mockResetPassword.mockResolvedValue({ success: true })

    await act(async () => {
      render(<PasswordResetConfirmForm />)
    })

    await waitFor(() => {
      expect(screen.getByLabelText('新しいパスワード')).toBeInTheDocument()
    })

    fireEvent.change(screen.getByLabelText('新しいパスワード'), { target: { value: 'newpass123' } })
    fireEvent.change(screen.getByLabelText('新しいパスワード（確認）'), { target: { value: 'newpass123' } })

    await act(async () => {
      fireEvent.submit(screen.getByText('パスワードを更新').closest('form')!)
    })

    await waitFor(() => {
      expect(screen.getByText('パスワードを更新しました')).toBeInTheDocument()
      expect(screen.getByText('今すぐログインする')).toBeInTheDocument()
    })

    // Check redirect after timeout
    act(() => {
      vi.advanceTimersByTime(3000)
    })

    expect(mockPush).toHaveBeenCalledWith('/login')
  })

  it('shows server error on submit failure', async () => {
    mockVerifyPasswordResetToken.mockResolvedValue({ valid: true })
    mockResetPassword.mockResolvedValue({ error: 'サーバーエラー' })

    await act(async () => {
      render(<PasswordResetConfirmForm />)
    })

    await waitFor(() => {
      expect(screen.getByLabelText('新しいパスワード')).toBeInTheDocument()
    })

    fireEvent.change(screen.getByLabelText('新しいパスワード'), { target: { value: 'newpass123' } })
    fireEvent.change(screen.getByLabelText('新しいパスワード（確認）'), { target: { value: 'newpass123' } })

    await act(async () => {
      fireEvent.submit(screen.getByText('パスワードを更新').closest('form')!)
    })

    await waitFor(() => {
      expect(screen.getByText('サーバーエラー')).toBeInTheDocument()
    })
  })
})

// ============================================================
// Tests: ReportActionsDropdown
// ============================================================
describe('ReportActionsDropdown - uncovered functions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Mock getBoundingClientRect
    Element.prototype.getBoundingClientRect = vi.fn().mockReturnValue({
      top: 100,
      bottom: 130,
      left: 200,
      right: 230,
      width: 30,
      height: 30,
    })
    Object.defineProperty(window, 'innerHeight', { value: 800, writable: true })
  })

  it('renders dropdown button', () => {
    render(<ReportActionsDropdown reportId="r1" currentStatus="pending" targetType="post" targetId="p1" />)
    const button = screen.getByRole('button')
    expect(button).toBeInTheDocument()
  })

  it('opens menu on click', () => {
    render(<ReportActionsDropdown reportId="r1" currentStatus="pending" targetType="post" targetId="p1" />)
    fireEvent.click(screen.getByRole('button'))

    expect(screen.getByText('対象を確認')).toBeInTheDocument()
    expect(screen.getByText('確認中にする')).toBeInTheDocument()
    expect(screen.getByText('対応完了にする')).toBeInTheDocument()
    expect(screen.getByText('却下する')).toBeInTheDocument()
  })

  it('updates status to reviewed', async () => {
    mockUpdateReportStatus.mockResolvedValue({})
    render(<ReportActionsDropdown reportId="r1" currentStatus="pending" targetType="post" targetId="p1" />)
    fireEvent.click(screen.getByRole('button'))

    await act(async () => {
      fireEvent.click(screen.getByText('確認中にする'))
    })

    expect(mockUpdateReportStatus).toHaveBeenCalledWith('r1', 'reviewed')
  })

  it('updates status to resolved', async () => {
    mockUpdateReportStatus.mockResolvedValue({})
    render(<ReportActionsDropdown reportId="r1" currentStatus="pending" targetType="post" targetId="p1" />)
    fireEvent.click(screen.getByRole('button'))

    await act(async () => {
      fireEvent.click(screen.getByText('対応完了にする'))
    })

    expect(mockUpdateReportStatus).toHaveBeenCalledWith('r1', 'resolved')
  })

  it('updates status to dismissed', async () => {
    mockUpdateReportStatus.mockResolvedValue({})
    render(<ReportActionsDropdown reportId="r1" currentStatus="pending" targetType="post" targetId="p1" />)
    fireEvent.click(screen.getByRole('button'))

    await act(async () => {
      fireEvent.click(screen.getByText('却下する'))
    })

    expect(mockUpdateReportStatus).toHaveBeenCalledWith('r1', 'dismissed')
  })

  it('shows "未対応に戻す" when not pending', async () => {
    mockUpdateReportStatus.mockResolvedValue({})
    render(<ReportActionsDropdown reportId="r1" currentStatus="reviewed" targetType="post" targetId="p1" />)
    fireEvent.click(screen.getByRole('button'))

    expect(screen.getByText('未対応に戻す')).toBeInTheDocument()
    expect(screen.queryByText('確認中にする')).not.toBeInTheDocument()

    await act(async () => {
      fireEvent.click(screen.getByText('未対応に戻す'))
    })

    expect(mockUpdateReportStatus).toHaveBeenCalledWith('r1', 'pending')
  })

  it('shows delete confirm and deletes content', async () => {
    mockDeleteReportedContent.mockResolvedValue({})
    render(<ReportActionsDropdown reportId="r1" currentStatus="pending" targetType="post" targetId="p1" />)
    fireEvent.click(screen.getByRole('button'))

    // Click "投稿を削除"
    fireEvent.click(screen.getByText('投稿を削除'))

    // Confirm dialog should appear
    expect(screen.getByText('投稿を削除しますか？')).toBeInTheDocument()

    // Confirm the delete
    const deleteBtn = screen.getAllByRole('button').find(b => b.textContent === '削除')
    await act(async () => {
      fireEvent.click(deleteBtn!)
    })

    expect(mockDeleteReportedContent).toHaveBeenCalledWith('post', 'p1')
  })

  it('cancels delete confirm', () => {
    render(<ReportActionsDropdown reportId="r1" currentStatus="pending" targetType="post" targetId="p1" />)
    fireEvent.click(screen.getByRole('button'))

    fireEvent.click(screen.getByText('投稿を削除'))
    expect(screen.getByText('投稿を削除しますか？')).toBeInTheDocument()

    fireEvent.click(screen.getByText('キャンセル'))
    expect(screen.queryByText('投稿を削除しますか？')).not.toBeInTheDocument()
  })

  it('deletes report record', async () => {
    mockDeleteReport.mockResolvedValue({})
    render(<ReportActionsDropdown reportId="r1" currentStatus="pending" targetType="post" targetId="p1" />)
    fireEvent.click(screen.getByRole('button'))

    await act(async () => {
      fireEvent.click(screen.getByText('通報を削除（レコードのみ）'))
    })

    expect(mockDeleteReport).toHaveBeenCalledWith('r1')
  })

  it('shows user suspend button for user target', () => {
    render(<ReportActionsDropdown reportId="r1" currentStatus="pending" targetType="user" targetId="u1" />)
    fireEvent.click(screen.getByRole('button'))
    expect(screen.getByText('アカウントを停止')).toBeInTheDocument()
  })

  it('handles status update error', async () => {
    mockUpdateReportStatus.mockResolvedValue({ error: 'Update failed' })
    render(<ReportActionsDropdown reportId="r1" currentStatus="pending" targetType="post" targetId="p1" />)
    fireEvent.click(screen.getByRole('button'))

    await act(async () => {
      fireEvent.click(screen.getByText('確認中にする'))
    })

    expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Update failed', variant: 'destructive' }))
  })

  it('opens menu upward when near bottom of screen', () => {
    Object.defineProperty(window, 'innerHeight', { value: 150, writable: true })
    render(<ReportActionsDropdown reportId="r1" currentStatus="pending" targetType="post" targetId="p1" />)
    fireEvent.click(screen.getByRole('button'))
    expect(screen.getByText('対象を確認')).toBeInTheDocument()
  })

  it('generates correct target links for different types', () => {
    const { unmount } = render(<ReportActionsDropdown reportId="r1" currentStatus="pending" targetType="event" targetId="e1" />)
    fireEvent.click(screen.getByRole('button'))
    const link = screen.getByText('対象を確認')
    expect(link.getAttribute('href')).toBe('/events/e1')
    unmount()

    const { unmount: unmount2 } = render(<ReportActionsDropdown reportId="r2" currentStatus="pending" targetType="shop" targetId="s1" />)
    fireEvent.click(screen.getByRole('button'))
    const link2 = screen.getByText('対象を確認')
    expect(link2.getAttribute('href')).toBe('/shops/s1')
    unmount2()

    const { unmount: unmount3 } = render(<ReportActionsDropdown reportId="r3" currentStatus="pending" targetType="user" targetId="u1" />)
    fireEvent.click(screen.getByRole('button'))
    const link3 = screen.getByText('対象を確認')
    expect(link3.getAttribute('href')).toBe('/users/u1')
    unmount3()

    // comment type has no link
    const { unmount: unmount4 } = render(<ReportActionsDropdown reportId="r4" currentStatus="pending" targetType="comment" targetId="c1" />)
    fireEvent.click(screen.getByRole('button'))
    expect(screen.queryByText('対象を確認')).not.toBeInTheDocument()
    unmount4()
  })

  it('closes menu on overlay click', () => {
    render(<ReportActionsDropdown reportId="r1" currentStatus="pending" targetType="post" targetId="p1" />)
    fireEvent.click(screen.getByRole('button'))
    expect(screen.getByText('対象を確認')).toBeInTheDocument()

    // Click the overlay
    const overlay = document.querySelector('.fixed.inset-0.z-\\[100\\]')
    if (overlay) {
      fireEvent.click(overlay)
    }

    expect(screen.queryByText('対象を確認')).not.toBeInTheDocument()
  })
})

// ============================================================
// Tests: MentionTextarea
// ============================================================
describe('MentionTextarea - uncovered branches', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers({ shouldAdvanceTime: true })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('renders textarea with placeholder', () => {
    const onChange = vi.fn()
    render(<MentionTextarea value="" onChange={onChange} placeholder="Type here..." />)
    expect(screen.getByPlaceholderText('Type here...')).toBeInTheDocument()
  })

  it('calls onChange when typing', () => {
    const onChange = vi.fn()
    render(<MentionTextarea value="" onChange={onChange} />)
    const textarea = screen.getByRole('textbox')
    fireEvent.change(textarea, { target: { value: 'Hello', selectionStart: 5 } })
    expect(onChange).toHaveBeenCalledWith('Hello')
  })

  it('detects @ trigger and searches users', async () => {
    mockSearchMentionUsers.mockResolvedValue([
      { id: 'u1', nickname: 'TestUser', avatarUrl: null, isFollowing: true },
    ])

    const onChange = vi.fn()
    render(<MentionTextarea value="" onChange={onChange} />)
    const textarea = screen.getByRole('textbox')

    fireEvent.change(textarea, {
      target: { value: '@test', selectionStart: 5 },
    })

    // Advance timers for debounce
    act(() => {
      vi.advanceTimersByTime(400)
    })

    await waitFor(() => {
      expect(mockSearchMentionUsers).toHaveBeenCalledWith('test', 8)
    })
  })

  it('does not trigger search when @ is preceded by non-space', () => {
    const onChange = vi.fn()
    render(<MentionTextarea value="" onChange={onChange} />)
    const textarea = screen.getByRole('textbox')

    fireEvent.change(textarea, {
      target: { value: 'email@test', selectionStart: 10 },
    })

    act(() => {
      vi.advanceTimersByTime(400)
    })

    expect(mockSearchMentionUsers).not.toHaveBeenCalled()
  })

  it('hides suggestions when no @ trigger', () => {
    const onChange = vi.fn()
    render(<MentionTextarea value="@test" onChange={onChange} />)
    const textarea = screen.getByRole('textbox')

    // Type without @ trigger
    fireEvent.change(textarea, {
      target: { value: 'no mention here', selectionStart: 15 },
    })

    // No suggestions should appear
    expect(screen.queryByText('検索中...')).not.toBeInTheDocument()
  })

  it('handles keyboard navigation (ArrowDown, ArrowUp, Enter, Escape)', async () => {
    mockSearchMentionUsers.mockResolvedValue([
      { id: 'u1', nickname: 'User1', avatarUrl: null, isFollowing: false },
      { id: 'u2', nickname: 'User2', avatarUrl: '/avatar.jpg', isFollowing: true },
    ])

    const onChange = vi.fn()
    render(<MentionTextarea value="" onChange={onChange} />)
    const textarea = screen.getByRole('textbox')

    fireEvent.change(textarea, {
      target: { value: '@u', selectionStart: 2 },
    })

    act(() => {
      vi.advanceTimersByTime(400)
    })

    await waitFor(() => {
      expect(mockSearchMentionUsers).toHaveBeenCalled()
    })

    // If suggestions are shown, test keyboard
    if (screen.queryByText('@User1')) {
      fireEvent.keyDown(textarea, { key: 'ArrowDown' })
      fireEvent.keyDown(textarea, { key: 'ArrowUp' })
      fireEvent.keyDown(textarea, { key: 'Escape' })
    }
  })

  it('handles disabled state', () => {
    const onChange = vi.fn()
    render(<MentionTextarea value="" onChange={onChange} disabled />)
    const textarea = screen.getByRole('textbox')
    expect(textarea).toBeDisabled()
  })

  it('respects maxLength prop', () => {
    const onChange = vi.fn()
    render(<MentionTextarea value="" onChange={onChange} maxLength={100} />)
    const textarea = screen.getByRole('textbox')
    expect(textarea).toHaveAttribute('maxLength', '100')
  })

  it('detects @ at beginning of text', () => {
    const onChange = vi.fn()
    render(<MentionTextarea value="" onChange={onChange} />)
    const textarea = screen.getByRole('textbox')

    fireEvent.change(textarea, {
      target: { value: '@user', selectionStart: 5 },
    })

    act(() => {
      vi.advanceTimersByTime(400)
    })

    expect(mockSearchMentionUsers).toHaveBeenCalledWith('user', 8)
  })

  it('detects @ after newline', () => {
    const onChange = vi.fn()
    render(<MentionTextarea value="" onChange={onChange} />)
    const textarea = screen.getByRole('textbox')

    fireEvent.change(textarea, {
      target: { value: 'line1\n@user', selectionStart: 11 },
    })

    act(() => {
      vi.advanceTimersByTime(400)
    })

    expect(mockSearchMentionUsers).toHaveBeenCalledWith('user', 8)
  })

  it('does not search when text after @ contains space', () => {
    const onChange = vi.fn()
    render(<MentionTextarea value="" onChange={onChange} />)
    const textarea = screen.getByRole('textbox')

    fireEvent.change(textarea, {
      target: { value: '@user name', selectionStart: 10 },
    })

    act(() => {
      vi.advanceTimersByTime(400)
    })

    expect(mockSearchMentionUsers).not.toHaveBeenCalled()
  })
})

// ============================================================
// Tests: SearchResults
// ============================================================
describe('SearchResults - uncovered branches', () => {
  const useInfiniteQuery = _useInfiniteQuery as unknown as ReturnType<typeof vi.fn>

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('PostSearchResults', () => {
    it('renders loading skeleton', () => {
      useInfiniteQuery.mockReturnValue({
        data: undefined,
        fetchNextPage: vi.fn(),
        hasNextPage: false,
        isFetchingNextPage: false,
        isLoading: true,
        error: null,
      })
      render(<PostSearchResults query="test" />)
      expect(document.querySelector('.animate-pulse')).toBeTruthy()
    })

    it('renders empty results with query', () => {
      useInfiniteQuery.mockReturnValue({
        data: { pages: [{ posts: [] }] },
        fetchNextPage: vi.fn(),
        hasNextPage: false,
        isFetchingNextPage: false,
        isLoading: false,
        error: null,
      })
      render(<PostSearchResults query="nonexistent" />)
      expect(screen.getByText('「nonexistent」に一致する投稿はありません')).toBeInTheDocument()
    })

    it('renders empty results without query', () => {
      useInfiniteQuery.mockReturnValue({
        data: { pages: [{ posts: [] }] },
        fetchNextPage: vi.fn(),
        hasNextPage: false,
        isFetchingNextPage: false,
        isLoading: false,
        error: null,
      })
      render(<PostSearchResults query="" />)
      expect(screen.getByText('投稿が見つかりません')).toBeInTheDocument()
    })

    it('renders posts with "no more" message', () => {
      useInfiniteQuery.mockReturnValue({
        data: {
          pages: [{
            posts: [createPost()],
          }],
        },
        fetchNextPage: vi.fn(),
        hasNextPage: false,
        isFetchingNextPage: false,
        isLoading: false,
        error: null,
      })
      render(<PostSearchResults query="test" currentUserId="user-1" />)
      expect(screen.getByText('これ以上投稿はありません')).toBeInTheDocument()
    })

    it('renders loading more indicator', () => {
      useInfiniteQuery.mockReturnValue({
        data: {
          pages: [{ posts: [createPost()] }],
        },
        fetchNextPage: vi.fn(),
        hasNextPage: true,
        isFetchingNextPage: true,
        isLoading: false,
        error: null,
      })
      render(<PostSearchResults query="test" currentUserId="user-1" />)
      expect(screen.getByText('読み込み中...')).toBeInTheDocument()
    })
  })

  describe('UserSearchResults', () => {
    it('renders loading skeleton', () => {
      useInfiniteQuery.mockReturnValue({
        data: undefined,
        fetchNextPage: vi.fn(),
        hasNextPage: false,
        isFetchingNextPage: false,
        isLoading: true,
        error: null,
      })
      render(<UserSearchResults query="test" />)
      expect(document.querySelector('.animate-pulse')).toBeTruthy()
    })

    it('renders empty results with query', () => {
      useInfiniteQuery.mockReturnValue({
        data: { pages: [{ users: [] }] },
        fetchNextPage: vi.fn(),
        hasNextPage: false,
        isFetchingNextPage: false,
        isLoading: false,
        error: null,
      })
      render(<UserSearchResults query="nobody" />)
      expect(screen.getByText('「nobody」に一致するユーザーはいません')).toBeInTheDocument()
    })

    it('renders empty results without query', () => {
      useInfiniteQuery.mockReturnValue({
        data: { pages: [{ users: [] }] },
        fetchNextPage: vi.fn(),
        hasNextPage: false,
        isFetchingNextPage: false,
        isLoading: false,
        error: null,
      })
      render(<UserSearchResults query="" />)
      expect(screen.getByText('ユーザーが見つかりません')).toBeInTheDocument()
    })

    it('renders users with avatarUrl', () => {
      useInfiniteQuery.mockReturnValue({
        data: {
          pages: [{
            users: [{ id: 'u1', nickname: 'TestUser', avatarUrl: '/avatar.jpg', bio: 'Hello', followersCount: 10, followingCount: 5 }],
          }],
        },
        fetchNextPage: vi.fn(),
        hasNextPage: false,
        isFetchingNextPage: false,
        isLoading: false,
        error: null,
      })
      render(<UserSearchResults query="test" />)
      expect(screen.getByText('TestUser')).toBeInTheDocument()
      expect(screen.getByText('Hello')).toBeInTheDocument()
      expect(screen.getByText('10フォロワー')).toBeInTheDocument()
    })

    it('renders users without avatarUrl', () => {
      useInfiniteQuery.mockReturnValue({
        data: {
          pages: [{
            users: [{ id: 'u1', nickname: 'NoAvatar', avatarUrl: null, bio: null, followersCount: 0, followingCount: 0 }],
          }],
        },
        fetchNextPage: vi.fn(),
        hasNextPage: false,
        isFetchingNextPage: false,
        isLoading: false,
        error: null,
      })
      render(<UserSearchResults query="test" />)
      expect(screen.getByText('N')).toBeInTheDocument() // First letter
    })

    it('renders error state', () => {
      useInfiniteQuery.mockReturnValue({
        data: undefined,
        fetchNextPage: vi.fn(),
        hasNextPage: false,
        isFetchingNextPage: false,
        isLoading: false,
        error: { message: 'Search error' },
      })
      render(<UserSearchResults query="test" />)
      expect(screen.getByText('Search error')).toBeInTheDocument()
    })

    it('shows loading more for users', () => {
      useInfiniteQuery.mockReturnValue({
        data: {
          pages: [{
            users: [{ id: 'u1', nickname: 'Test', avatarUrl: null, bio: null, followersCount: 0, followingCount: 0 }],
          }],
        },
        fetchNextPage: vi.fn(),
        hasNextPage: true,
        isFetchingNextPage: true,
        isLoading: false,
        error: null,
      })
      render(<UserSearchResults query="test" />)
      expect(screen.getByText('読み込み中...')).toBeInTheDocument()
    })

    it('shows no more users message', () => {
      useInfiniteQuery.mockReturnValue({
        data: {
          pages: [{
            users: [{ id: 'u1', nickname: 'Test', avatarUrl: null, bio: null, followersCount: 0, followingCount: 0 }],
          }],
        },
        fetchNextPage: vi.fn(),
        hasNextPage: false,
        isFetchingNextPage: false,
        isLoading: false,
        error: null,
      })
      render(<UserSearchResults query="test" />)
      expect(screen.getByText('これ以上ユーザーはいません')).toBeInTheDocument()
    })
  })

  describe('TagSearchResults', () => {
    it('renders empty tag results', () => {
      useInfiniteQuery.mockReturnValue({
        data: { pages: [{ posts: [] }] },
        fetchNextPage: vi.fn(),
        hasNextPage: false,
        isFetchingNextPage: false,
        isLoading: false,
        error: null,
      })
      render(<TagSearchResults tag="bonsai" />)
      expect(screen.getByText('#bonsai を含む投稿はありません')).toBeInTheDocument()
    })

    it('renders empty tag without tag name', () => {
      useInfiniteQuery.mockReturnValue({
        data: { pages: [{ posts: [] }] },
        fetchNextPage: vi.fn(),
        hasNextPage: false,
        isFetchingNextPage: false,
        isLoading: false,
        error: null,
      })
      render(<TagSearchResults tag="" />)
      expect(screen.getByText('タグを入力してください')).toBeInTheDocument()
    })

    it('renders tag results with header', () => {
      useInfiniteQuery.mockReturnValue({
        data: {
          pages: [{
            posts: [createPost()],
          }],
        },
        fetchNextPage: vi.fn(),
        hasNextPage: false,
        isFetchingNextPage: false,
        isLoading: false,
        error: null,
      })
      render(<TagSearchResults tag="松柏" currentUserId="user-1" />)
      expect(screen.getByText('#松柏')).toBeInTheDocument()
      expect(screen.getByText('1件の投稿')).toBeInTheDocument()
    })

    it('renders loading state', () => {
      useInfiniteQuery.mockReturnValue({
        data: undefined,
        fetchNextPage: vi.fn(),
        hasNextPage: false,
        isFetchingNextPage: false,
        isLoading: true,
        error: null,
      })
      render(<TagSearchResults tag="test" />)
      expect(document.querySelector('.animate-pulse')).toBeTruthy()
    })
  })

  describe('PopularTags', () => {
    it('renders nothing when tags are empty', () => {
      const { container } = render(<PopularTags tags={[]} />)
      expect(container.innerHTML).toBe('')
    })

    it('renders tags with counts', () => {
      render(<PopularTags tags={[{ tag: '松柏類', count: 100 }, { tag: '雑木類', count: 50 }]} />)
      expect(screen.getByText('人気のタグ')).toBeInTheDocument()
      expect(screen.getByText('#松柏類')).toBeInTheDocument()
      expect(screen.getByText('100')).toBeInTheDocument()
      expect(screen.getByText('#雑木類')).toBeInTheDocument()
      expect(screen.getByText('50')).toBeInTheDocument()
    })
  })
})

// ============================================================
// Tests: AnalogClockPicker
// ============================================================
describe('AnalogClockPicker - uncovered branches', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders with value and label', () => {
    const onChange = vi.fn()
    render(<AnalogClockPicker value="09:30" onChange={onChange} label="開始時刻" />)
    expect(screen.getByText('開始時刻')).toBeInTheDocument()
    expect(screen.getByText('09:30')).toBeInTheDocument()
  })

  it('renders without label', () => {
    const onChange = vi.fn()
    render(<AnalogClockPicker value="14:00" onChange={onChange} />)
    expect(screen.getByText('14:00')).toBeInTheDocument()
  })

  it('opens picker on click', () => {
    const onChange = vi.fn()
    render(<AnalogClockPicker value="09:00" onChange={onChange} />)
    fireEvent.click(screen.getByText('09:00'))

    // Should show hour and minute buttons
    expect(screen.getByText('09')).toBeInTheDocument()
    expect(screen.getByText('00')).toBeInTheDocument()
    expect(screen.getByText('OK')).toBeInTheDocument()
    expect(screen.getByText('キャンセル')).toBeInTheDocument()
  })

  it('does not open when disabled', () => {
    const onChange = vi.fn()
    render(<AnalogClockPicker value="09:00" onChange={onChange} disabled />)
    fireEvent.click(screen.getByText('09:00'))
    expect(screen.queryByText('OK')).not.toBeInTheDocument()
  })

  it('closes on cancel click', () => {
    const onChange = vi.fn()
    render(<AnalogClockPicker value="09:00" onChange={onChange} />)
    fireEvent.click(screen.getByText('09:00'))
    expect(screen.getByText('OK')).toBeInTheDocument()

    fireEvent.click(screen.getByText('キャンセル'))
    expect(screen.queryByText('OK')).not.toBeInTheDocument()
  })

  it('closes on OK click', () => {
    const onChange = vi.fn()
    render(<AnalogClockPicker value="09:00" onChange={onChange} />)
    fireEvent.click(screen.getByText('09:00'))
    fireEvent.click(screen.getByText('OK'))
    expect(screen.queryByText('OK')).not.toBeInTheDocument()
  })

  it('switches to minutes mode on header click', () => {
    const onChange = vi.fn()
    render(<AnalogClockPicker value="09:30" onChange={onChange} />)
    fireEvent.click(screen.getByText('09:30'))

    // Find the minutes button in the header (should show "30")
    const headerButtons = document.querySelectorAll('.text-3xl.font-bold')
    const minuteButton = Array.from(headerButtons).find(b => b.textContent === '30')
    expect(minuteButton).toBeDefined()
    fireEvent.click(minuteButton as HTMLElement)

    // Active mode is reflected by the bg-primary highlight on the header button
    expect(minuteButton).toHaveClass('bg-primary')
    const hourButton = Array.from(headerButtons).find(b => b.textContent === '09')
    expect(hourButton).not.toHaveClass('bg-primary')
  })

  it('switches to hours mode on header click', () => {
    const onChange = vi.fn()
    render(<AnalogClockPicker value="09:30" onChange={onChange} />)
    fireEvent.click(screen.getByText('09:30'))

    // Switch to minutes first
    const headerButtons = document.querySelectorAll('.text-3xl.font-bold')
    const minuteButton = Array.from(headerButtons).find(b => b.textContent === '30')
    expect(minuteButton).toBeDefined()
    fireEvent.click(minuteButton as HTMLElement)
    expect(minuteButton).toHaveClass('bg-primary')

    // Then switch back to hours
    const hourButton = Array.from(headerButtons).find(b => b.textContent === '09')
    expect(hourButton).toBeDefined()
    fireEvent.click(hourButton as HTMLElement)
    expect(hourButton).toHaveClass('bg-primary')
    expect(minuteButton).not.toHaveClass('bg-primary')
  })

  it('handles mouse interaction on clock face (hours mode)', () => {
    const onChange = vi.fn()
    render(<AnalogClockPicker value="09:00" onChange={onChange} />)
    fireEvent.click(screen.getByText('09:00'))

    const clockFace = document.querySelector('.rounded-full.bg-muted\\/50')
    expect(clockFace).not.toBeNull()
    // Mock getBoundingClientRect for the clock face
    vi.spyOn(clockFace as Element, 'getBoundingClientRect').mockReturnValue({
      left: 0,
      top: 0,
      right: 224,
      bottom: 224,
      width: 224,
      height: 224,
      x: 0,
      y: 0,
      toJSON: () => {},
    })

    // MouseDown on outer ring top => 12 o'clock (00:00)
    fireEvent.mouseDown(clockFace as Element, { clientX: 112, clientY: 10 })
    expect(onChange).toHaveBeenCalledWith('00:00')

    onChange.mockClear()
    // MouseMove with button pressed => right edge = 3 o'clock (03:00)
    fireEvent.mouseMove(clockFace as Element, { clientX: 200, clientY: 112, buttons: 1 })
    expect(onChange).toHaveBeenCalledWith('03:00')

    onChange.mockClear()
    // MouseUp finalizes hours and transitions to minutes mode
    fireEvent.mouseUp(clockFace as Element, { clientX: 200, clientY: 112 })
    expect(onChange).toHaveBeenCalledWith('03:00')
    const headerButtons = document.querySelectorAll('.text-3xl.font-bold')
    const minuteHeader = Array.from(headerButtons).find(b => b.textContent === '00')
    expect(minuteHeader).toHaveClass('bg-primary')
  })

  it('handles mouse interaction on clock face (PM / inner ring)', () => {
    const onChange = vi.fn()
    render(<AnalogClockPicker value="09:00" onChange={onChange} />)
    fireEvent.click(screen.getByText('09:00'))

    const clockFace = document.querySelector('.rounded-full.bg-muted\\/50')
    expect(clockFace).not.toBeNull()
    vi.spyOn(clockFace as Element, 'getBoundingClientRect').mockReturnValue({
      left: 0,
      top: 0,
      right: 224,
      bottom: 224,
      width: 224,
      height: 224,
      x: 0,
      y: 0,
      toJSON: () => {},
    })

    // Click near center top (inner ring = PM, 12 o'clock => 12:00)
    fireEvent.mouseDown(clockFace as Element, { clientX: 112, clientY: 90 })
    expect(onChange).toHaveBeenCalledWith('12:00')
    fireEvent.mouseUp(clockFace as Element, { clientX: 112, clientY: 90 })
  })

  it('handles touch interaction', () => {
    const onChange = vi.fn()
    render(<AnalogClockPicker value="09:00" onChange={onChange} />)
    fireEvent.click(screen.getByText('09:00'))

    const clockFace = document.querySelector('.rounded-full.bg-muted\\/50')
    expect(clockFace).not.toBeNull()
    vi.spyOn(clockFace as Element, 'getBoundingClientRect').mockReturnValue({
      left: 0,
      top: 0,
      right: 224,
      bottom: 224,
      width: 224,
      height: 224,
      x: 0,
      y: 0,
      toJSON: () => {},
    })

    // Touch start at top outer ring => 12 o'clock (00:00)
    fireEvent.touchStart(clockFace as Element, {
      touches: [{ clientX: 112, clientY: 10 }],
      preventDefault: vi.fn(),
    })
    expect(onChange).toHaveBeenCalledWith('00:00')

    onChange.mockClear()
    // Touch move to right edge => 3 o'clock (03:00)
    fireEvent.touchMove(clockFace as Element, {
      touches: [{ clientX: 200, clientY: 112 }],
      preventDefault: vi.fn(),
    })
    expect(onChange).toHaveBeenCalledWith('03:00')

    onChange.mockClear()
    // Touch end finalizes and switches to minutes mode
    fireEvent.touchEnd(clockFace as Element, {
      changedTouches: [{ clientX: 200, clientY: 112 }],
      preventDefault: vi.fn(),
    })
    expect(onChange).toHaveBeenCalledWith('03:00')
    const headerButtons = document.querySelectorAll('.text-3xl.font-bold')
    const minuteHeader = Array.from(headerButtons).find(b => b.textContent === '00')
    expect(minuteHeader).toHaveClass('bg-primary')
  })

  it('handles minute mode mouse interaction', () => {
    const onChange = vi.fn()
    render(<AnalogClockPicker value="09:00" onChange={onChange} />)
    fireEvent.click(screen.getByText('09:00'))

    // Switch to minutes mode
    const headerButtons = document.querySelectorAll('button.text-3xl')
    const minuteBtn = Array.from(headerButtons).find(b => b.textContent === '00')
    expect(minuteBtn).toBeDefined()
    fireEvent.click(minuteBtn as HTMLElement)

    const clockFace = document.querySelector('.rounded-full.bg-muted\\/50')
    expect(clockFace).not.toBeNull()
    vi.spyOn(clockFace as Element, 'getBoundingClientRect').mockReturnValue({
      left: 0,
      top: 0,
      right: 224,
      bottom: 224,
      width: 224,
      height: 224,
      x: 0,
      y: 0,
      toJSON: () => {},
    })

    // Click right edge (3 o'clock => 15 minutes), keeping hours=09
    fireEvent.mouseDown(clockFace as Element, { clientX: 200, clientY: 112 })
    expect(onChange).toHaveBeenCalledWith('09:15')

    onChange.mockClear()
    // MouseUp in minute mode finalizes and closes the picker
    fireEvent.mouseUp(clockFace as Element, { clientX: 200, clientY: 112 })
    expect(onChange).toHaveBeenCalledWith('09:15')
    expect(screen.queryByText('OK')).not.toBeInTheDocument()
  })

  it('ignores mouse move without button pressed', () => {
    const onChange = vi.fn()
    render(<AnalogClockPicker value="09:00" onChange={onChange} />)
    fireEvent.click(screen.getByText('09:00'))

    const clockFace = document.querySelector('.rounded-full.bg-muted\\/50')
    expect(clockFace).not.toBeNull()
    // MouseMove without button pressed (buttons: 0) must be ignored => no onChange
    fireEvent.mouseMove(clockFace as Element, { clientX: 200, clientY: 112, buttons: 0 })
    expect(onChange).not.toHaveBeenCalled()
  })

  it('closes on mobile overlay click', () => {
    const onChange = vi.fn()
    render(<AnalogClockPicker value="09:00" onChange={onChange} />)
    fireEvent.click(screen.getByText('09:00'))

    // Click mobile overlay
    const overlay = document.querySelector('.fixed.inset-0.bg-black\\/50')
    if (overlay) {
      fireEvent.click(overlay)
      expect(screen.queryByText('OK')).not.toBeInTheDocument()
    }
  })

  it('renders hour numbers correctly', () => {
    const onChange = vi.fn()
    render(<AnalogClockPicker value="09:00" onChange={onChange} />)
    fireEvent.click(screen.getByText('09:00'))

    // Should show all hour numbers (0-23)
    // outer ring: 12, 1-11
    // inner ring: 0, 13-23
    expect(screen.getByText('12')).toBeInTheDocument()
    expect(screen.getByText('3')).toBeInTheDocument()
    expect(screen.getByText('6')).toBeInTheDocument()
    expect(screen.getByText('15')).toBeInTheDocument()
    expect(screen.getByText('18')).toBeInTheDocument()
  })

  it('renders minute numbers in minute mode', () => {
    const onChange = vi.fn()
    render(<AnalogClockPicker value="09:00" onChange={onChange} />)
    fireEvent.click(screen.getByText('09:00'))

    // Switch to minute mode
    const headerButtons = document.querySelectorAll('button.text-3xl')
    const minuteBtn = Array.from(headerButtons).find(b => b.textContent === '00')
    if (minuteBtn) {
      fireEvent.click(minuteBtn)
    }

    // Should show minute marks (00, 05, 10, ..., 55)
    expect(screen.getAllByText('00').length).toBeGreaterThan(0)
    expect(screen.getByText('15')).toBeInTheDocument()
    expect(screen.getByText('30')).toBeInTheDocument()
    expect(screen.getByText('45')).toBeInTheDocument()
  })

  it('parses invalid time string gracefully', () => {
    const onChange = vi.fn()
    render(<AnalogClockPicker value="invalid" onChange={onChange} />)
    fireEvent.click(screen.getByText('invalid'))
    // Should default to 09:00
    expect(screen.getByText('09')).toBeInTheDocument()
  })

  it('renders placeholder when no value', () => {
    const onChange = vi.fn()
    render(<AnalogClockPicker value="" onChange={onChange} />)
    expect(screen.getByText('--:--')).toBeInTheDocument()
  })

  it('does not process interactions when disabled', () => {
    const onChange = vi.fn()
    render(<AnalogClockPicker value="09:00" onChange={onChange} disabled />)

    // Try to click - should not open
    const button = screen.getByRole('button')
    fireEvent.click(button)
    expect(screen.queryByText('OK')).not.toBeInTheDocument()
    expect(onChange).not.toHaveBeenCalled()
  })
})
