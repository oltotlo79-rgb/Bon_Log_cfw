import { vi } from 'vitest'
/**
 * Coverage boost tests for:
 * - components/comment/CommentCard.tsx
 * - app/admin/layout.tsx
 * - components/shop/ReviewCard.tsx
 */

import React from 'react'
import { render, screen, waitFor, fireEvent } from '../utils/test-utils'
import { redirect as _mockRedirect } from 'next/navigation'
const mockRedirect = _mockRedirect as unknown as ReturnType<typeof vi.fn>
import userEvent from '@testing-library/user-event'

// ============================================================
// CommentCard mocks
// ============================================================

const mockRefresh = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    refresh: mockRefresh,
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
  }),
  redirect: vi.fn(),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => '/',
}))

vi.mock('next-auth/react', () => ({
  SessionProvider: ({ children }: { children: React.ReactNode }) => children,
  useSession: () => ({
    data: { user: { id: 'test-user-id' } },
    status: 'authenticated',
  }),
}))

const mockDeleteComment = vi.fn()
const mockGetReplies = vi.fn()
vi.mock('@/lib/actions/comment', () => ({
  deleteComment: (...args: unknown[]) => mockDeleteComment(...args),
  getReplies: (...args: unknown[]) => mockGetReplies(...args),
}))

vi.mock('@/components/comment/CommentForm', () => ({
  CommentForm: (props: { onSuccess?: () => void; onCancel?: () => void; placeholder?: string }) => (
    <div data-testid="mock-comment-form">
      <input placeholder={props.placeholder} />
      {props.onSuccess && <button onClick={props.onSuccess} data-testid="submit-reply">送信</button>}
      {props.onCancel && <button onClick={props.onCancel}>キャンセル</button>}
    </div>
  ),
}))

vi.mock('@/components/comment/CommentLikeButton', () => ({
  CommentLikeButton: ({ commentId, initialCount }: { commentId: string; postId: string; initialLiked: boolean; initialCount: number }) => (
    <span data-testid={`like-${commentId}`}>{initialCount}</span>
  ),
}))

vi.mock('@/components/comment/ThreadMuteButton', () => ({
  ThreadMuteButton: () => <button data-testid="thread-mute-btn">ミュート</button>,
}))

vi.mock('@/lib/actions/comment-thread-mute', () => ({
  muteThread: vi.fn().mockResolvedValue({ success: true }),
  unmuteThread: vi.fn().mockResolvedValue({ success: true }),
}))

vi.mock('@/lib/actions/like', () => ({
  toggleCommentLike: vi.fn().mockResolvedValue({ success: true, data: { liked: true } }),
}))

// ============================================================
// ReviewCard mocks
// ============================================================

const mockDeleteReview = vi.fn()
const mockUpdateReview = vi.fn()
vi.mock('@/lib/actions/review', () => ({
  deleteReview: (...args: unknown[]) => mockDeleteReview(...args),
  updateReview: (...args: unknown[]) => mockUpdateReview(...args),
}))

vi.mock('@/lib/client-image-compression', () => ({
  prepareFileForUpload: vi.fn(),
  formatFileSize: vi.fn((size: number) => `${size}B`),
  MAX_IMAGE_SIZE: 10 * 1024 * 1024,
}))

vi.mock('@/components/report/ReportButton', () => ({
  ReportButton: ({ targetType, targetId }: { targetType: string; targetId: string }) => (
    <button data-testid="report-button" data-target-type={targetType} data-target-id={targetId}>通報</button>
  ),
}))

vi.mock('@/components/shop/StarRating', () => ({
  StarRatingDisplay: ({ rating }: { rating: number }) => (
    <div data-testid="star-rating-display">星{rating}</div>
  ),
  StarRatingInput: ({ value, onChange }: { value: number; onChange: (v: number) => void }) => (
    <div data-testid="star-rating-input">
      <span data-testid="edit-rating">{value}</span>
      {[1, 2, 3, 4, 5].map((v) => (
        <button key={v} data-testid={`edit-star-${v}`} onClick={() => onChange(v)}>星{v}</button>
      ))}
    </div>
  ),
}))

vi.mock('date-fns', () => ({
  formatDistanceToNow: vi.fn(() => '3時間前'),
}))
vi.mock('date-fns/locale', () => ({
  ja: {},
}))

// ============================================================
// Admin layout mocks
// ============================================================

vi.mock('@/lib/actions/admin', () => ({
  isAdmin: vi.fn(),
}))

// ============================================================
// Imports
// ============================================================

import { CommentCard } from '@/components/comment/CommentCard'
import { ReviewCard } from '@/components/shop/ReviewCard'

// ============================================================
// Test data
// ============================================================

const baseComment = {
  id: 'comment-1',
  content: 'テストコメント',
  createdAt: new Date().toISOString(),
  parentId: null,
  user: { id: 'user-1', nickname: 'テストユーザー', avatarUrl: null },
  likeCount: 3,
  replyCount: 0,
  isLiked: false,
}

const baseReview = {
  id: 'review-1',
  rating: 4,
  content: '素晴らしい盆栽園',
  createdAt: new Date('2024-06-01'),
  user: { id: 'user-1', nickname: 'レビュアー', avatarUrl: null },
  images: [] as { id: string; url: string }[],
}

// ============================================================
// CommentCard coverage boost tests
// ============================================================

describe('CommentCard coverage boost', async () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ----------------------------------------------------------
  // isBlockedUser rendering
  // ----------------------------------------------------------
  describe('isBlockedUser view', async () => {
    it('renders blocked user message', () => {
      render(
        <CommentCard
          comment={{ ...baseComment, isBlockedUser: true }}
          postId="post-1"
          currentUserId="test-user-id"
        />
      )
      expect(screen.getByText('ブロック中のユーザーのコメントです')).toBeInTheDocument()
      expect(screen.queryByText('テストコメント')).not.toBeInTheDocument()
    })

    it('blocked user with replies shows expand button', () => {
      render(
        <CommentCard
          comment={{ ...baseComment, isBlockedUser: true, replyCount: 2 }}
          postId="post-1"
          currentUserId="test-user-id"
        />
      )
      expect(screen.getByText('2件の返信を表示')).toBeInTheDocument()
    })

    it('blocked user without replies does not show expand button', () => {
      render(
        <CommentCard
          comment={{ ...baseComment, isBlockedUser: true, replyCount: 0 }}
          postId="post-1"
          currentUserId="test-user-id"
        />
      )
      expect(screen.queryByText(/件の返信を表示/)).not.toBeInTheDocument()
    })

    it('blocked user can expand replies', async () => {
      mockGetReplies.mockResolvedValue({
        replies: [
          {
            id: 'reply-b1',
            content: 'ブロックユーザーへの返信',
            createdAt: new Date().toISOString(),
            parentId: 'comment-1',
            user: { id: 'user-2', nickname: '返信者', avatarUrl: null },
            likeCount: 0,
            replyCount: 0,
          },
        ],
      })

      const user = userEvent.setup()
      render(
        <CommentCard
          comment={{ ...baseComment, isBlockedUser: true, replyCount: 1 }}
          postId="post-1"
          currentUserId="test-user-id"
        />
      )

      await user.click(screen.getByText('1件の返信を表示'))
      await waitFor(() => {
        expect(mockGetReplies).toHaveBeenCalledWith('comment-1')
      })
      await waitFor(() => {
        expect(screen.getByText('ブロックユーザーへの返信')).toBeInTheDocument()
      })
    })

    it('blocked user can toggle replies to hide', async () => {
      mockGetReplies.mockResolvedValue({
        replies: [
          {
            id: 'reply-b1',
            content: 'ブロック下の返信',
            createdAt: new Date().toISOString(),
            parentId: 'comment-1',
            user: { id: 'user-2', nickname: '返信者', avatarUrl: null },
            likeCount: 0,
            replyCount: 0,
          },
        ],
      })

      const user = userEvent.setup()
      render(
        <CommentCard
          comment={{ ...baseComment, isBlockedUser: true, replyCount: 1 }}
          postId="post-1"
          currentUserId="test-user-id"
        />
      )

      // Expand
      await user.click(screen.getByText('1件の返信を表示'))
      await waitFor(() => {
        expect(screen.getByText('ブロック下の返信')).toBeInTheDocument()
      })

      // Collapse
      await user.click(screen.getByText('返信を非表示'))
      await waitFor(() => {
        expect(screen.queryByText('ブロック下の返信')).not.toBeInTheDocument()
      })
    })
  })

  // ----------------------------------------------------------
  // handleReplySuccess - getReplies returns result.replies
  // ----------------------------------------------------------
  describe('handleReplySuccess', async () => {
    it('re-fetches replies after successful reply submission and shows them', async () => {
      mockGetReplies.mockResolvedValue({
        replies: [
          {
            id: 'new-reply',
            content: '新しい返信コメント',
            createdAt: new Date().toISOString(),
            parentId: 'comment-1',
            user: { id: 'user-3', nickname: '返信者3', avatarUrl: null },
            likeCount: 0,
            replyCount: 0,
          },
        ],
      })

      const user = userEvent.setup()
      render(
        <CommentCard
          comment={baseComment}
          postId="post-1"
          currentUserId="test-user-id"
        />
      )

      // Open reply form
      await user.click(screen.getByRole('button', { name: /返信/i }))
      // Submit reply via mock
      await user.click(screen.getByTestId('submit-reply'))

      await waitFor(() => {
        expect(mockGetReplies).toHaveBeenCalledWith('comment-1')
        expect(screen.getByText('新しい返信コメント')).toBeInTheDocument()
      })
      expect(mockRefresh).toHaveBeenCalled()
    })

    it('handles handleReplySuccess when getReplies returns no replies', async () => {
      mockGetReplies.mockResolvedValue({ error: 'some error' })

      const user = userEvent.setup()
      render(
        <CommentCard
          comment={baseComment}
          postId="post-1"
          currentUserId="test-user-id"
        />
      )

      await user.click(screen.getByRole('button', { name: /返信/i }))
      await user.click(screen.getByTestId('submit-reply'))

      await waitFor(() => {
        expect(mockGetReplies).toHaveBeenCalledWith('comment-1')
      })
      // Should still call router.refresh even when no replies returned
      expect(mockRefresh).toHaveBeenCalled()
    })
  })

  // ----------------------------------------------------------
  // Deleted comment's reply onDeleted callback (lines 526-539)
  // ----------------------------------------------------------
  describe('deleted comment reply onDeleted callback', async () => {
    it('when all replies are deleted from deleted comment, calls parent onDeleted', async () => {
      const mockOnDeleted = vi.fn()
      mockDeleteComment.mockResolvedValue({ success: true })
      mockGetReplies.mockResolvedValue({
        replies: [
          {
            id: 'reply-d1',
            content: '削除コメントへの返信',
            createdAt: new Date().toISOString(),
            parentId: 'comment-1',
            user: { id: 'test-user-id', nickname: 'ユーザー', avatarUrl: null },
            likeCount: 0,
            replyCount: 0,
          },
        ],
      })

      const user = userEvent.setup()
      render(
        <CommentCard
          comment={{ ...baseComment, isDeleted: true, replyCount: 1 }}
          postId="post-1"
          currentUserId="test-user-id"
          onDeleted={mockOnDeleted}
        />
      )

      // Expand replies on deleted comment
      await user.click(screen.getByText('1件の返信を表示'))
      await waitFor(() => {
        expect(screen.getByText('削除コメントへの返信')).toBeInTheDocument()
      })

      // The reply has delete button because currentUserId matches reply user id
      // Find the delete trigger button (trash icon)
      const deleteButton = screen.getAllByRole('button').find(btn =>
        btn.querySelector('svg.lucide-trash-2')
      )
      expect(deleteButton).toBeDefined()
      await user.click(deleteButton!)

      // Confirm deletion dialog
      await waitFor(() => {
        expect(screen.getByText('コメントを削除')).toBeInTheDocument()
      })
      await user.click(screen.getByRole('button', { name: '削除' }))

      // Wait for deleteComment to be called
      await waitFor(() => {
        expect(mockDeleteComment).toHaveBeenCalledWith('reply-d1')
      })

      // The child CommentCard calls onDeleted('reply-d1')
      // The parent (deleted comment) filters the reply out
      // Since remaining.length === 0, it should call onDeleted(comment.id)
      await waitFor(() => {
        expect(mockOnDeleted).toHaveBeenCalledWith('comment-1')
      })
    })
  })

  // ----------------------------------------------------------
  // Main view reply onDeleted logic (lines 767-772)
  // ----------------------------------------------------------
  describe('main view reply onDeleted logic', async () => {
    it('filters out reply when replyCount is 0', async () => {
      mockDeleteComment.mockResolvedValue({ success: true })
      mockGetReplies.mockResolvedValue({
        replies: [
          {
            id: 'reply-m1',
            content: '返信1',
            createdAt: new Date().toISOString(),
            parentId: 'comment-1',
            user: { id: 'test-user-id', nickname: 'ユーザー', avatarUrl: null },
            likeCount: 0,
            replyCount: 0,
          },
          {
            id: 'reply-m2',
            content: '返信2',
            createdAt: new Date().toISOString(),
            parentId: 'comment-1',
            user: { id: 'user-other', nickname: '他ユーザー', avatarUrl: null },
            likeCount: 0,
            replyCount: 0,
          },
        ],
      })

      const user = userEvent.setup()
      render(
        <CommentCard
          comment={{ ...baseComment, replyCount: 2 }}
          postId="post-1"
          currentUserId="test-user-id"
        />
      )

      // Expand replies
      await user.click(screen.getByText('2件の返信を表示'))
      await waitFor(() => {
        expect(screen.getByText('返信1')).toBeInTheDocument()
        expect(screen.getByText('返信2')).toBeInTheDocument()
      })

      // Delete the first reply (replyCount===0, so it gets filtered out)
      const deleteButton = screen.getAllByRole('button').find(btn =>
        btn.querySelector('svg.lucide-trash-2')
      )
      expect(deleteButton).toBeDefined()
      await user.click(deleteButton!)

      await waitFor(() => {
        expect(screen.getByText('コメントを削除')).toBeInTheDocument()
      })
      await user.click(screen.getByRole('button', { name: '削除' }))

      await waitFor(() => {
        expect(mockDeleteComment).toHaveBeenCalledWith('reply-m1')
      })

      // reply-m1 should be filtered out (replyCount === 0)
      await waitFor(() => {
        expect(screen.queryByText('返信1')).not.toBeInTheDocument()
      })
      // reply-m2 should still be visible
      expect(screen.getByText('返信2')).toBeInTheDocument()
    })

    it('marks reply as isDeleted when it has replyCount > 0', async () => {
      mockDeleteComment.mockResolvedValue({ success: true })
      mockGetReplies.mockResolvedValue({
        replies: [
          {
            id: 'reply-has-children',
            content: '子返信がある返信',
            createdAt: new Date().toISOString(),
            parentId: 'comment-1',
            user: { id: 'test-user-id', nickname: 'ユーザー', avatarUrl: null },
            likeCount: 0,
            replyCount: 2,
          },
        ],
      })

      const user = userEvent.setup()
      render(
        <CommentCard
          comment={{ ...baseComment, replyCount: 1 }}
          postId="post-1"
          currentUserId="test-user-id"
        />
      )

      // Expand replies
      await user.click(screen.getByText('1件の返信を表示'))
      await waitFor(() => {
        expect(screen.getByText('子返信がある返信')).toBeInTheDocument()
      })

      // Delete the reply (has replyCount 2, so it should be marked isDeleted, not filtered)
      const deleteButton = screen.getAllByRole('button').find(btn =>
        btn.querySelector('svg.lucide-trash-2')
      )
      expect(deleteButton).toBeDefined()
      await user.click(deleteButton!)

      await waitFor(() => {
        expect(screen.getByText('コメントを削除')).toBeInTheDocument()
      })
      await user.click(screen.getByRole('button', { name: '削除' }))

      await waitFor(() => {
        expect(mockDeleteComment).toHaveBeenCalledWith('reply-has-children')
      })

      // The reply should now show as deleted
      await waitFor(() => {
        expect(screen.getByText('削除されたコメントです')).toBeInTheDocument()
      })
      expect(screen.queryByText('子返信がある返信')).not.toBeInTheDocument()
    })

    it('filters out reply when replyCount is undefined', async () => {
      mockDeleteComment.mockResolvedValue({ success: true })
      mockGetReplies.mockResolvedValue({
        replies: [
          {
            id: 'reply-no-count',
            content: 'カウントなし返信',
            createdAt: new Date().toISOString(),
            parentId: 'comment-1',
            user: { id: 'test-user-id', nickname: 'ユーザー', avatarUrl: null },
            likeCount: 0,
            // replyCount is undefined
          },
        ],
      })

      const user = userEvent.setup()
      render(
        <CommentCard
          comment={{ ...baseComment, replyCount: 1 }}
          postId="post-1"
          currentUserId="test-user-id"
        />
      )

      // Expand replies
      await user.click(screen.getByText('1件の返信を表示'))
      await waitFor(() => {
        expect(screen.getByText('カウントなし返信')).toBeInTheDocument()
      })

      // Delete
      const deleteButton = screen.getAllByRole('button').find(btn =>
        btn.querySelector('svg.lucide-trash-2')
      )
      await user.click(deleteButton!)

      await waitFor(() => {
        expect(screen.getByText('コメントを削除')).toBeInTheDocument()
      })
      await user.click(screen.getByRole('button', { name: '削除' }))

      await waitFor(() => {
        expect(mockDeleteComment).toHaveBeenCalledWith('reply-no-count')
      })

      // replyCount undefined => filtered out
      await waitFor(() => {
        expect(screen.queryByText('カウントなし返信')).not.toBeInTheDocument()
      })
    })
  })

  // ----------------------------------------------------------
  // Loading state in toggle button
  // ----------------------------------------------------------
  describe('toggle button loading states', async () => {
    it('shows loading text while fetching replies on blocked user', async () => {
      let resolveGetReplies: (value: unknown) => void
      mockGetReplies.mockImplementation(() => new Promise(r => { resolveGetReplies = r }))

      const user = userEvent.setup()
      render(
        <CommentCard
          comment={{ ...baseComment, isBlockedUser: true, replyCount: 1 }}
          postId="post-1"
          currentUserId="test-user-id"
        />
      )

      await user.click(screen.getByText('1件の返信を表示'))

      // While loading
      await waitFor(() => {
        expect(screen.getByText('読み込み中...')).toBeInTheDocument()
      })

      // Resolve
      resolveGetReplies!({ replies: [] })

      await waitFor(() => {
        expect(screen.queryByText('読み込み中...')).not.toBeInTheDocument()
      })
    })
  })
})

// ============================================================
// Admin Layout coverage boost tests
// ============================================================

describe('Admin Layout coverage boost', async () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders AdminLayout with all nav items and icon functions', async () => {
     
    const { isAdmin } = await import('@/lib/actions/admin')
    vi.mocked(isAdmin).mockResolvedValue(true)

    // Mock prisma.user.count to return non-zero
     
    const { prisma } = await import('@/lib/db')
    prisma.user.count = vi.fn().mockResolvedValue(5)

    // Mock auth to return a session
    const authModule1 = await import('@/lib/auth')
    ;(authModule1.auth as unknown as import('vitest').MockInstance).mockResolvedValue({ user: { id: 'admin-user-id' } })

    const AdminLayout = (await import('@/app/admin/layout')).default

    const jsx = await AdminLayout({ children: <div data-testid="admin-children">Test Content</div> })
    const { container } = render(jsx)

    // Verify section titles are rendered
    expect(screen.getByText('概要')).toBeInTheDocument()
    expect(screen.getByText('モデレーション')).toBeInTheDocument()
    expect(screen.getByText('コンテンツ管理')).toBeInTheDocument()
    expect(screen.getByText('システム')).toBeInTheDocument()

    // Verify nav items are rendered (some labels appear as both section title and link)
    expect(screen.getByText('ダッシュボード')).toBeInTheDocument()
    expect(screen.getAllByText('ユーザー管理').length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText('投稿管理')).toBeInTheDocument()
    expect(screen.getByText('NGワード管理')).toBeInTheDocument()
    expect(screen.getByText('警告管理')).toBeInTheDocument()
    expect(screen.getByText('モデレーションキュー')).toBeInTheDocument()
    expect(screen.getByText('IP管理')).toBeInTheDocument()
    expect(screen.getByText('セグメント')).toBeInTheDocument()
    expect(screen.getByText('ロール管理')).toBeInTheDocument()
    expect(screen.getByText('農薬データ管理')).toBeInTheDocument()
    expect(screen.getByText('コホート分析')).toBeInTheDocument()
    expect(screen.getByText('お知らせ管理')).toBeInTheDocument()
    expect(screen.getByText('CMS管理')).toBeInTheDocument()
    expect(screen.getByText('セキュリティ')).toBeInTheDocument()
    expect(screen.getByText('バックアップ')).toBeInTheDocument()
    expect(screen.getByText('操作ログ')).toBeInTheDocument()

    // Verify icons are rendered (SVGs)
    const svgs = container.querySelectorAll('svg')
    // 30+ navItems + 1 ArrowLeftIcon
    expect(svgs.length).toBeGreaterThanOrEqual(25)

    // Verify header
    expect(screen.getByText('BON-LOG 管理')).toBeInTheDocument()
    expect(screen.getByText('管理者ダッシュボード')).toBeInTheDocument()

    // Verify footer "サイトに戻る"
    expect(screen.getByText('サイトに戻る')).toBeInTheDocument()

    // Verify children rendered
    expect(screen.getByTestId('admin-children')).toBeInTheDocument()
  })

  it('redirects to / when no users exist', async () => {
     
    const { prisma } = await import('@/lib/db')
    prisma.user.count = vi.fn().mockResolvedValue(0)

     
    const { signOut } = await import('@/lib/auth')
    vi.mocked(signOut).mockResolvedValue(undefined)

    const redirect = mockRedirect

    const AdminLayout = (await import('@/app/admin/layout')).default
    await AdminLayout({ children: <div>Test</div> })

    expect(signOut).toHaveBeenCalledWith({ redirect: false })
    expect(redirect).toHaveBeenCalledWith('/')
  })

  it('redirects to /login when not authenticated', async () => {
     
    const { prisma } = await import('@/lib/db')
    prisma.user.count = vi.fn().mockResolvedValue(5)

     
    const authModule2 = await import('@/lib/auth')
    ;(authModule2.auth as unknown as import('vitest').MockInstance).mockResolvedValue(null)

    const redirect = mockRedirect

    const AdminLayout = (await import('@/app/admin/layout')).default
    await AdminLayout({ children: <div>Test</div> })

    expect(redirect).toHaveBeenCalledWith('/login')
  })

  it('redirects to /feed when not admin', async () => {
     
    const { prisma } = await import('@/lib/db')
    prisma.user.count = vi.fn().mockResolvedValue(5)

     
    const authModule3 = await import('@/lib/auth')
    ;(authModule3.auth as unknown as import('vitest').MockInstance).mockResolvedValue({ user: { id: 'regular-user-id' } })

     
    const { isAdmin } = await import('@/lib/actions/admin')
    vi.mocked(isAdmin).mockResolvedValue(false)

    const redirect = mockRedirect

    const AdminLayout = (await import('@/app/admin/layout')).default
    await AdminLayout({ children: <div>Test</div> })

    expect(redirect).toHaveBeenCalledWith('/feed')
  })
})

// ============================================================
// ReviewCard coverage boost tests
// ============================================================

describe('ReviewCard coverage boost', async () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockDeleteReview.mockResolvedValue({ success: true })
    mockUpdateReview.mockResolvedValue({ success: true })
  })

  describe('handleRemoveNewImage', async () => {
    it('removes a newly uploaded image from the list', async () => {
       
      const { prepareFileForUpload } = await import('@/lib/client-image-compression')
      vi.mocked(prepareFileForUpload).mockResolvedValue(new File(['compressed'], 'c.jpg', { type: 'image/jpeg' }))

      // Mock XHR for upload success
      const mockXHR = {
        open: vi.fn(),
        send: vi.fn(),
        addEventListener: vi.fn(),
        status: 200,
        responseText: JSON.stringify({ url: '/uploaded-new.jpg' }),
      }
      vi.spyOn(window, 'XMLHttpRequest').mockImplementation(function() { return mockXHR } as unknown as () => XMLHttpRequest)
      mockXHR.send.mockImplementation(() => {
        const loadHandler = (mockXHR.addEventListener.mock.calls as [string, () => void][]).find((c) => c[0] === 'load'
        )?.[1]
        if (loadHandler) loadHandler()
      })

      const user = userEvent.setup()
      const { container } = render(<ReviewCard review={baseReview} currentUserId="user-1" />)

      // Enter edit mode
      await user.click(screen.getByTitle('編集'))
      await waitFor(() => {
        expect(screen.getByRole('button', { name: '保存' })).toBeInTheDocument()
      })

      // Upload a new image
      const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement
      const file = new File(['test'], 'test.jpg', { type: 'image/jpeg' })
      Object.defineProperty(file, 'size', { value: 1024 })
      fireEvent.change(fileInput, { target: { files: [file] } })

      // Wait for the new image to appear
      await waitFor(() => {
        expect(screen.getByText('画像 (1/3枚)')).toBeInTheDocument()
        expect(screen.getByText('新規')).toBeInTheDocument()
      })

      // Find the delete button on the new image (has bg-destructive class)
      const newImageDeleteBtns = container.querySelectorAll('.border-2.border-primary')
      expect(newImageDeleteBtns.length).toBe(1)

      // Click the X button to remove the new image
      const deleteNewBtn = newImageDeleteBtns[0]?.parentElement?.querySelector('.bg-destructive')
      expect(deleteNewBtn).toBeTruthy()
      fireEvent.click(deleteNewBtn!)

      await waitFor(() => {
        expect(screen.getByText('画像 (0/3枚)')).toBeInTheDocument()
        expect(screen.queryByText('新規')).not.toBeInTheDocument()
      })

      vi.restoreAllMocks()
    })
  })

  describe('XHR non-200 status code', async () => {
    it('shows error when XHR returns non-200 status', async () => {
       
      const { prepareFileForUpload } = await import('@/lib/client-image-compression')
      vi.mocked(prepareFileForUpload).mockResolvedValue(new File(['compressed'], 'c.jpg', { type: 'image/jpeg' }))

      const mockXHR = {
        open: vi.fn(),
        send: vi.fn(),
        addEventListener: vi.fn(),
        status: 500,
        responseText: 'Internal Server Error',
      }
      vi.spyOn(window, 'XMLHttpRequest').mockImplementation(function() { return mockXHR } as unknown as () => XMLHttpRequest)
      mockXHR.send.mockImplementation(() => {
        const loadHandler = (mockXHR.addEventListener.mock.calls as [string, () => void][]).find((c) => c[0] === 'load'
        )?.[1]
        if (loadHandler) loadHandler()
      })

      const user = userEvent.setup()
      const { container } = render(<ReviewCard review={baseReview} currentUserId="user-1" />)

      await user.click(screen.getByTitle('編集'))
      await waitFor(() => {
        expect(screen.getByRole('button', { name: '保存' })).toBeInTheDocument()
      })

      const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement
      const file = new File(['test'], 'test.jpg', { type: 'image/jpeg' })
      Object.defineProperty(file, 'size', { value: 1024 })
      fireEvent.change(fileInput, { target: { files: [file] } })

      await waitFor(() => {
        expect(screen.getByText('アップロードに失敗しました')).toBeInTheDocument()
      })

      vi.restoreAllMocks()
    })
  })

  describe('XHR 200 but invalid JSON', async () => {
    it('shows error when XHR returns 200 with invalid JSON', async () => {
       
      const { prepareFileForUpload } = await import('@/lib/client-image-compression')
      vi.mocked(prepareFileForUpload).mockResolvedValue(new File(['compressed'], 'c.jpg', { type: 'image/jpeg' }))

      const mockXHR = {
        open: vi.fn(),
        send: vi.fn(),
        addEventListener: vi.fn(),
        status: 200,
        responseText: 'not-json',
      }
      vi.spyOn(window, 'XMLHttpRequest').mockImplementation(function() { return mockXHR } as unknown as () => XMLHttpRequest)
      mockXHR.send.mockImplementation(() => {
        const loadHandler = (mockXHR.addEventListener.mock.calls as [string, () => void][]).find((c) => c[0] === 'load'
        )?.[1]
        if (loadHandler) loadHandler()
      })

      const user = userEvent.setup()
      const { container } = render(<ReviewCard review={baseReview} currentUserId="user-1" />)

      await user.click(screen.getByTitle('編集'))
      await waitFor(() => {
        expect(screen.getByRole('button', { name: '保存' })).toBeInTheDocument()
      })

      const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement
      const file = new File(['test'], 'test.jpg', { type: 'image/jpeg' })
      Object.defineProperty(file, 'size', { value: 1024 })
      fireEvent.change(fileInput, { target: { files: [file] } })

      await waitFor(() => {
        expect(screen.getByText('アップロードに失敗しました')).toBeInTheDocument()
      })

      vi.restoreAllMocks()
    })
  })
})
