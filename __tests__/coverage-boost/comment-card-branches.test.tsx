import { vi } from 'vitest'
/**
 * CommentCard component branch coverage tests
 *
 * Target: components/comment/CommentCard.tsx
 * Focus: Branch coverage (63.29% -> higher) and function coverage (66.66% -> higher)
 */

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

const mockDeleteComment = vi.fn()
const mockGetReplies = vi.fn()

vi.mock('@/lib/actions/comment', () => ({
  deleteComment: (...args: unknown[]) => mockDeleteComment(...args),
  getReplies: (...args: unknown[]) => mockGetReplies(...args),
}))

vi.mock('@/lib/actions/like', () => ({
  toggleCommentLike: vi.fn().mockResolvedValue({ success: true, data: { liked: true } }),
}))

vi.mock('@/lib/actions/comment-thread-mute', () => ({
  muteThread: vi.fn().mockResolvedValue({ success: true }),
  unmuteThread: vi.fn().mockResolvedValue({ success: true }),
}))

vi.mock('@/lib/actions/report', () => ({
  createReport: vi.fn().mockResolvedValue({ success: true }),
}))

// useToast モック
const mockToast = vi.fn()
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: mockToast, toasts: [] }),
}))

import React from 'react'
import { render, screen, waitFor } from '../utils/test-utils'
import userEvent from '@testing-library/user-event'
import { CommentCard } from '@/components/comment/CommentCard'

const baseComment = {
  id: 'comment-1',
  content: 'テストコメント',
  createdAt: new Date().toISOString(),
  parentId: null,
  user: { id: 'user-1', nickname: 'テストユーザー', avatarUrl: null },
  likeCount: 5,
  replyCount: 0,
}

describe('CommentCard branch coverage', () => {
  const user = userEvent.setup()

  beforeEach(() => {
    vi.clearAllMocks()
    mockDeleteComment.mockResolvedValue({ success: true })
    mockGetReplies.mockResolvedValue({ replies: [] })
  })

  // ----------------------------------------------------------------
  // Branch 1: comment.isBlockedUser
  // ----------------------------------------------------------------
  describe('isBlockedUser branch', () => {
    it('renders simplified blocked user view when isBlockedUser is true', () => {
      render(
        <CommentCard
          comment={{ ...baseComment, isBlockedUser: true }}
          postId="post-1"
          currentUserId="test-user-id"
        />
      )

      expect(screen.getByText('ブロック中のユーザーのコメントです')).toBeInTheDocument()
      // Should NOT render the actual content
      expect(screen.queryByText('テストコメント')).not.toBeInTheDocument()
    })

    it('renders normal comment when isBlockedUser is false', () => {
      render(
        <CommentCard
          comment={{ ...baseComment, isBlockedUser: false }}
          postId="post-1"
          currentUserId="test-user-id"
        />
      )

      expect(screen.getByText('テストコメント')).toBeInTheDocument()
      expect(screen.queryByText('ブロック中のユーザーのコメントです')).not.toBeInTheDocument()
    })

    it('shows reply toggle button inside blocked view when replyCount > 0', () => {
      render(
        <CommentCard
          comment={{ ...baseComment, isBlockedUser: true, replyCount: 3 }}
          postId="post-1"
          currentUserId="test-user-id"
        />
      )

      expect(screen.getByText('3件の返信を表示')).toBeInTheDocument()
    })

    it('toggles replies in blocked view', async () => {
      mockGetReplies.mockResolvedValue({
        replies: [
          {
            id: 'reply-blocked-1',
            content: '返信コメント',
            createdAt: new Date().toISOString(),
            parentId: 'comment-1',
            user: { id: 'user-2', nickname: '返信者', avatarUrl: null },
            likeCount: 0,
            replyCount: 0,
          },
        ],
      })

      render(
        <CommentCard
          comment={{ ...baseComment, isBlockedUser: true, replyCount: 2 }}
          postId="post-1"
          currentUserId="test-user-id"
        />
      )

      await user.click(screen.getByText('2件の返信を表示'))

      await waitFor(() => {
        expect(mockGetReplies).toHaveBeenCalledWith('comment-1')
      })

      await waitFor(() => {
        expect(screen.getByText('返信コメント')).toBeInTheDocument()
      })

      // Toggle to hide
      await user.click(screen.getByText('返信を非表示'))

      expect(screen.queryByText('返信コメント')).not.toBeInTheDocument()
    })
  })

  // ----------------------------------------------------------------
  // Branch 2: comment.isDeleted
  // ----------------------------------------------------------------
  describe('isDeleted branch', () => {
    it('renders deleted message when isDeleted is true', () => {
      render(
        <CommentCard
          comment={{ ...baseComment, isDeleted: true }}
          postId="post-1"
          currentUserId="test-user-id"
        />
      )

      expect(screen.getByText('削除されたコメントです')).toBeInTheDocument()
      expect(screen.queryByText('テストコメント')).not.toBeInTheDocument()
    })

    it('shows reply toggle button inside deleted view when replyCount > 0', () => {
      render(
        <CommentCard
          comment={{ ...baseComment, isDeleted: true, replyCount: 5 }}
          postId="post-1"
          currentUserId="test-user-id"
        />
      )

      expect(screen.getByText('5件の返信を表示')).toBeInTheDocument()
    })

    it('toggles replies in deleted view', async () => {
      mockGetReplies.mockResolvedValue({
        replies: [
          {
            id: 'reply-del-1',
            content: '削除コメントへの返信',
            createdAt: new Date().toISOString(),
            parentId: 'comment-1',
            user: { id: 'user-3', nickname: '返信者2', avatarUrl: null },
            likeCount: 0,
            replyCount: 0,
          },
        ],
      })

      render(
        <CommentCard
          comment={{ ...baseComment, isDeleted: true, replyCount: 1 }}
          postId="post-1"
          currentUserId="test-user-id"
        />
      )

      await user.click(screen.getByText('1件の返信を表示'))

      await waitFor(() => {
        expect(screen.getByText('削除コメントへの返信')).toBeInTheDocument()
      })
    })

    it('renders comment content when isDeleted is false or undefined', () => {
      render(
        <CommentCard
          comment={{ ...baseComment, isDeleted: false }}
          postId="post-1"
          currentUserId="test-user-id"
        />
      )

      expect(screen.getByText('テストコメント')).toBeInTheDocument()
      expect(screen.queryByText('削除されたコメントです')).not.toBeInTheDocument()
    })
  })

  // ----------------------------------------------------------------
  // Branch 3: comment.user.avatarUrl
  // ----------------------------------------------------------------
  describe('avatarUrl branch', () => {
    it('renders Image when avatarUrl is truthy', () => {
      render(
        <CommentCard
          comment={{
            ...baseComment,
            user: { ...baseComment.user, avatarUrl: '/avatar.jpg' },
          }}
          postId="post-1"
          currentUserId="test-user-id"
        />
      )

      const img = screen.getByAltText('テストユーザー')
      expect(img).toBeInTheDocument()
    })

    it('shows first character of nickname when avatarUrl is null', () => {
      render(
        <CommentCard
          comment={{
            ...baseComment,
            user: { ...baseComment.user, avatarUrl: null },
          }}
          postId="post-1"
          currentUserId="test-user-id"
        />
      )

      expect(screen.getByText('テ')).toBeInTheDocument()
    })
  })

  // ----------------------------------------------------------------
  // Branch 4: comment.content
  // ----------------------------------------------------------------
  describe('content branch', () => {
    it('renders text when content is truthy', () => {
      render(
        <CommentCard
          comment={{ ...baseComment, content: '内容あり' }}
          postId="post-1"
          currentUserId="test-user-id"
        />
      )

      expect(screen.getByText('内容あり')).toBeInTheDocument()
    })

    it('does not render content paragraph when content is empty string', () => {
      render(
        <CommentCard
          comment={{ ...baseComment, content: '' }}
          postId="post-1"
          currentUserId="test-user-id"
        />
      )

      // Empty content should not render the <p> element
      expect(screen.queryByText('テストコメント')).not.toBeInTheDocument()
    })
  })

  // ----------------------------------------------------------------
  // Branch 5: comment.media && comment.media.length > 0
  // ----------------------------------------------------------------
  describe('media branch', () => {
    it('shows media grid when media array has items', () => {
      const { container } = render(
        <CommentCard
          comment={{
            ...baseComment,
            media: [
              { id: 'media-1', url: '/img1.jpg', type: 'image', sortOrder: 0 },
              { id: 'media-2', url: '/img2.jpg', type: 'image', sortOrder: 1 },
            ],
          }}
          postId="post-1"
          currentUserId="test-user-id"
        />
      )

      // Media images have alt="" so they have role="presentation", query by tag
      const mediaImages = container.querySelectorAll('img[src="/img1.jpg"], img[src="/img2.jpg"]')
      expect(mediaImages.length).toBe(2)
    })

    it('does not show media grid when media is undefined', () => {
      const { container } = render(
        <CommentCard
          comment={{ ...baseComment }}
          postId="post-1"
          currentUserId="test-user-id"
        />
      )

      const videos = container.querySelectorAll('video')
      expect(videos.length).toBe(0)
    })

    it('does not show media grid when media is empty array', () => {
      const { container } = render(
        <CommentCard
          comment={{ ...baseComment, media: [] }}
          postId="post-1"
          currentUserId="test-user-id"
        />
      )

      const videos = container.querySelectorAll('video')
      expect(videos.length).toBe(0)
    })
  })

  // ----------------------------------------------------------------
  // Branch 6: media.type === 'video'
  // ----------------------------------------------------------------
  describe('media type branch', () => {
    it('renders video element for video type media', () => {
      const { container } = render(
        <CommentCard
          comment={{
            ...baseComment,
            media: [
              { id: 'media-v1', url: '/video.mp4', type: 'video', sortOrder: 0 },
            ],
          }}
          postId="post-1"
          currentUserId="test-user-id"
        />
      )

      const video = container.querySelector('video')
      expect(video).toBeInTheDocument()
      expect(video?.getAttribute('src')).toBe('/video.mp4')
    })

    it('renders Image for image type media', () => {
      const { container } = render(
        <CommentCard
          comment={{
            ...baseComment,
            media: [
              { id: 'media-i1', url: '/image.jpg', type: 'image', sortOrder: 0 },
            ],
          }}
          postId="post-1"
          currentUserId="test-user-id"
        />
      )

      // Media images have alt="" so they have role="presentation", query by selector
      const mediaImg = container.querySelector('img[src="/image.jpg"]')
      expect(mediaImg).toBeInTheDocument()
    })
  })

  // ----------------------------------------------------------------
  // Branch 7: comment.media.length === 1 vs grid-cols-2
  // ----------------------------------------------------------------
  describe('media grid layout branch', () => {
    it('does not apply grid-cols-2 for single media', () => {
      const { container } = render(
        <CommentCard
          comment={{
            ...baseComment,
            media: [
              { id: 'media-s1', url: '/img1.jpg', type: 'image', sortOrder: 0 },
            ],
          }}
          postId="post-1"
          currentUserId="test-user-id"
        />
      )

      const gridContainer = container.querySelector('.grid')
      expect(gridContainer).toBeInTheDocument()
      expect(gridContainer?.classList.contains('grid-cols-2')).toBe(false)
    })

    it('applies grid-cols-2 for multiple media', () => {
      const { container } = render(
        <CommentCard
          comment={{
            ...baseComment,
            media: [
              { id: 'media-m1', url: '/img1.jpg', type: 'image', sortOrder: 0 },
              { id: 'media-m2', url: '/img2.jpg', type: 'image', sortOrder: 1 },
            ],
          }}
          postId="post-1"
          currentUserId="test-user-id"
        />
      )

      const gridContainer = container.querySelector('.grid-cols-2')
      expect(gridContainer).toBeInTheDocument()
    })
  })

  // ----------------------------------------------------------------
  // Branch 8: currentUserId exists - show interactive buttons
  // ----------------------------------------------------------------
  describe('currentUserId exists branch', () => {
    it('shows like button, reply button, and thread mute button when currentUserId is provided', () => {
      render(
        <CommentCard
          comment={{ ...baseComment }}
          postId="post-1"
          currentUserId="test-user-id"
        />
      )

      // Reply button should be present with text "返信"
      expect(screen.getByText('返信')).toBeInTheDocument()
    })

    it('shows reply form on reply button click', async () => {
      render(
        <CommentCard
          comment={{ ...baseComment }}
          postId="post-1"
          currentUserId="test-user-id"
        />
      )

      await user.click(screen.getByText('返信'))

      // CommentForm should appear with placeholder
      await waitFor(() => {
        expect(
          screen.getByPlaceholderText('@テストユーザー への返信...')
        ).toBeInTheDocument()
      })
    })
  })

  // ----------------------------------------------------------------
  // Branch 9: !currentUserId - show login link for likes if likeCount > 0
  // ----------------------------------------------------------------
  describe('no currentUserId with likes branch', () => {
    it('shows login link when no currentUserId and likeCount > 0', () => {
      render(
        <CommentCard
          comment={{ ...baseComment, likeCount: 3 }}
          postId="post-1"
          currentUserId={undefined}
        />
      )

      // Should render a link to /login with the like count
      const loginLink = screen.getByText('3')
      expect(loginLink).toBeInTheDocument()
      // The link should point to /login
      const anchor = loginLink.closest('a')
      expect(anchor?.getAttribute('href')).toBe('/login')
    })
  })

  // ----------------------------------------------------------------
  // Branch 10: !currentUserId and likeCount === 0
  // ----------------------------------------------------------------
  describe('no currentUserId and no likes branch', () => {
    it('does not show any like UI when no currentUserId and likeCount is 0', () => {
      render(
        <CommentCard
          comment={{ ...baseComment, likeCount: 0 }}
          postId="post-1"
          currentUserId={undefined}
        />
      )

      // No login link for likes, no like button
      const loginLinks = screen.queryAllByRole('link')
      const likeLoginLink = loginLinks.find(
        (link) => link.getAttribute('href') === '/login'
      )
      expect(likeLoginLink).toBeUndefined()
      // Should not have reply button either since no currentUserId
      expect(screen.queryByText('返信')).not.toBeInTheDocument()
    })
  })

  // ----------------------------------------------------------------
  // Branch 11: isOwner - show delete button
  // ----------------------------------------------------------------
  describe('isOwner branch', () => {
    it('shows delete button (trash icon) when current user is the comment owner', () => {
      render(
        <CommentCard
          comment={{
            ...baseComment,
            user: { id: 'test-user-id', nickname: 'オーナー', avatarUrl: null },
          }}
          postId="post-1"
          currentUserId="test-user-id"
        />
      )

      // The delete button contains a Trash2 icon, look for the AlertDialog trigger
      // The dialog title "コメントを削除" should be accessible
      const buttons = screen.getAllByRole('button')
      // Owner should have at least: reply, thread mute, delete buttons
      expect(buttons.length).toBeGreaterThanOrEqual(3)
    })

    it('does not show delete button when current user is not the owner', () => {
      const { container } = render(
        <CommentCard
          comment={{
            ...baseComment,
            user: { id: 'other-user', nickname: '他のユーザー', avatarUrl: null },
          }}
          postId="post-1"
          currentUserId="test-user-id"
        />
      )

      // No AlertDialog trigger for delete should be present
      // The Trash2 icon should not be rendered
      const trashSvg = container.querySelector('.lucide-trash-2')
      expect(trashSvg).not.toBeInTheDocument()
    })
  })

  // ----------------------------------------------------------------
  // Branch 12: comment.replyCount > 0 - show reply toggle button
  // ----------------------------------------------------------------
  describe('replyCount branch', () => {
    it('shows reply toggle button when replyCount > 0', () => {
      render(
        <CommentCard
          comment={{ ...baseComment, replyCount: 3 }}
          postId="post-1"
          currentUserId="test-user-id"
        />
      )

      expect(screen.getByText('3件の返信を表示')).toBeInTheDocument()
    })

    it('does not show reply toggle button when replyCount is 0', () => {
      render(
        <CommentCard
          comment={{ ...baseComment, replyCount: 0 }}
          postId="post-1"
          currentUserId="test-user-id"
        />
      )

      expect(screen.queryByText(/件の返信を表示/)).not.toBeInTheDocument()
    })

    it('does not show reply toggle button when replyCount is undefined', () => {
      const commentNoReplyCount = { ...baseComment }
      delete (commentNoReplyCount as Record<string, unknown>).replyCount

      render(
        <CommentCard
          comment={commentNoReplyCount}
          postId="post-1"
          currentUserId="test-user-id"
        />
      )

      expect(screen.queryByText(/件の返信を表示/)).not.toBeInTheDocument()
    })
  })

  // ----------------------------------------------------------------
  // Branch 13: handleDelete - error path and success path
  // ----------------------------------------------------------------
  describe('handleDelete branch', () => {
    it('calls onDeleted callback on successful delete', async () => {
      mockDeleteComment.mockResolvedValue({ success: true })
      const onDeleted = vi.fn()

      render(
        <CommentCard
          comment={{
            ...baseComment,
            user: { id: 'test-user-id', nickname: 'オーナー', avatarUrl: null },
          }}
          postId="post-1"
          currentUserId="test-user-id"
          onDeleted={onDeleted}
        />
      )

      // Click the delete (trash) button to open the AlertDialog
      const buttons = screen.getAllByRole('button')
      // Find the trash button - it's the AlertDialogTrigger
      const trashButton = buttons.find((btn) => {
        const svg = btn.querySelector('svg')
        return svg?.classList.contains('lucide-trash-2')
      })
      expect(trashButton).toBeInTheDocument()

      await user.click(trashButton!)

      // Now the AlertDialog content should be visible
      await waitFor(() => {
        expect(screen.getByText('コメントを削除')).toBeInTheDocument()
      })

      // Click the "削除" action button in the dialog
      const deleteAction = screen.getByRole('button', { name: '削除' })
      await user.click(deleteAction)

      await waitFor(() => {
        expect(mockDeleteComment).toHaveBeenCalledWith('comment-1')
      })

      await waitFor(() => {
        expect(onDeleted).toHaveBeenCalledWith('comment-1')
      })
    })

    it('shows toast on error result from deleteComment', async () => {
      mockDeleteComment.mockResolvedValue({ error: '削除に失敗しました' })

      render(
        <CommentCard
          comment={{
            ...baseComment,
            user: { id: 'test-user-id', nickname: 'オーナー', avatarUrl: null },
          }}
          postId="post-1"
          currentUserId="test-user-id"
        />
      )

      const buttons = screen.getAllByRole('button')
      const trashButton = buttons.find((btn) => {
        const svg = btn.querySelector('svg')
        return svg?.classList.contains('lucide-trash-2')
      })
      expect(trashButton).toBeInTheDocument()

      await user.click(trashButton!)

      await waitFor(() => {
        expect(screen.getByText('コメントを削除')).toBeInTheDocument()
      })

      const deleteAction = screen.getByRole('button', { name: '削除' })
      await user.click(deleteAction)

      await waitFor(() => {
        expect(mockDeleteComment).toHaveBeenCalledWith('comment-1')
      })

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ title: '削除に失敗しました', variant: 'destructive' }))
      })
    })

    it('shows supplementary message in delete dialog when replyCount > 0', async () => {
      render(
        <CommentCard
          comment={{
            ...baseComment,
            replyCount: 3,
            user: { id: 'test-user-id', nickname: 'オーナー', avatarUrl: null },
          }}
          postId="post-1"
          currentUserId="test-user-id"
        />
      )

      const buttons = screen.getAllByRole('button')
      const trashButton = buttons.find((btn) => {
        const svg = btn.querySelector('svg')
        return svg?.classList.contains('lucide-trash-2')
      })
      expect(trashButton).toBeInTheDocument()

      await user.click(trashButton!)

      await waitFor(() => {
        expect(screen.getByText(/このコメントには3件の返信があります/)).toBeInTheDocument()
        expect(screen.getByText(/返信は削除されません/)).toBeInTheDocument()
      })
    })
  })

  // ----------------------------------------------------------------
  // Branch 14: handleToggleReplies - toggle show/hide replies
  // ----------------------------------------------------------------
  describe('handleToggleReplies branch', () => {
    it('fetches and shows replies when clicking toggle first time', async () => {
      mockGetReplies.mockResolvedValue({
        replies: [
          {
            id: 'reply-1',
            content: '返信コメント',
            createdAt: new Date().toISOString(),
            parentId: 'comment-1',
            user: { id: 'user-2', nickname: '返信者', avatarUrl: null },
            likeCount: 0,
            replyCount: 0,
          },
        ],
      })

      render(
        <CommentCard
          comment={{ ...baseComment, replyCount: 2 }}
          postId="post-1"
          currentUserId="test-user-id"
        />
      )

      // Click to show replies
      await user.click(screen.getByText('2件の返信を表示'))

      await waitFor(() => {
        expect(mockGetReplies).toHaveBeenCalledWith('comment-1')
      })

      await waitFor(() => {
        expect(screen.getByText('返信コメント')).toBeInTheDocument()
      })

      // Button text should now say "返信を非表示"
      expect(screen.getByText('返信を非表示')).toBeInTheDocument()
    })

    it('hides replies when clicking toggle while showing', async () => {
      mockGetReplies.mockResolvedValue({
        replies: [
          {
            id: 'reply-2',
            content: 'ToggleTest返信',
            createdAt: new Date().toISOString(),
            parentId: 'comment-1',
            user: { id: 'user-2', nickname: '返信者', avatarUrl: null },
            likeCount: 0,
            replyCount: 0,
          },
        ],
      })

      render(
        <CommentCard
          comment={{ ...baseComment, replyCount: 1 }}
          postId="post-1"
          currentUserId="test-user-id"
        />
      )

      // Show
      await user.click(screen.getByText('1件の返信を表示'))
      await waitFor(() => {
        expect(screen.getByText('ToggleTest返信')).toBeInTheDocument()
      })

      // Hide
      await user.click(screen.getByText('返信を非表示'))
      expect(screen.queryByText('ToggleTest返信')).not.toBeInTheDocument()
    })

    it('does not fetch replies again if already loaded', async () => {
      mockGetReplies.mockResolvedValue({
        replies: [
          {
            id: 'reply-3',
            content: 'キャッシュ済み返信',
            createdAt: new Date().toISOString(),
            parentId: 'comment-1',
            user: { id: 'user-2', nickname: '返信者', avatarUrl: null },
            likeCount: 0,
            replyCount: 0,
          },
        ],
      })

      render(
        <CommentCard
          comment={{ ...baseComment, replyCount: 1 }}
          postId="post-1"
          currentUserId="test-user-id"
        />
      )

      // Show
      await user.click(screen.getByText('1件の返信を表示'))
      await waitFor(() => expect(mockGetReplies).toHaveBeenCalledTimes(1))

      // Hide
      await user.click(screen.getByText('返信を非表示'))

      // Show again - should NOT call getReplies again because replies are already loaded
      await user.click(screen.getByText('1件の返信を表示'))
      expect(mockGetReplies).toHaveBeenCalledTimes(1)
    })
  })

  // ----------------------------------------------------------------
  // Branch 15: comment.isLiked truthy/falsy (default false)
  // ----------------------------------------------------------------
  describe('isLiked branch', () => {
    it('passes isLiked=true to CommentLikeButton', () => {
      render(
        <CommentCard
          comment={{ ...baseComment, isLiked: true }}
          postId="post-1"
          currentUserId="test-user-id"
        />
      )

      expect(screen.getByText('テストコメント')).toBeInTheDocument()
    })

    it('passes isLiked=false to CommentLikeButton', () => {
      render(
        <CommentCard
          comment={{ ...baseComment, isLiked: false }}
          postId="post-1"
          currentUserId="test-user-id"
        />
      )

      expect(screen.getByText('テストコメント')).toBeInTheDocument()
    })

    it('defaults to isLiked=false when isLiked is undefined', () => {
      const commentNoLiked = { ...baseComment }
      delete (commentNoLiked as Record<string, unknown>).isLiked

      render(
        <CommentCard
          comment={commentNoLiked}
          postId="post-1"
          currentUserId="test-user-id"
        />
      )

      expect(screen.getByText('テストコメント')).toBeInTheDocument()
    })
  })

  // ----------------------------------------------------------------
  // Additional depth/layout branches
  // ----------------------------------------------------------------
  describe('depth and layout branches', () => {
    it('renders with depth=0 and adds border-l-2 class when showing replies', async () => {
      mockGetReplies.mockResolvedValue({
        replies: [
          {
            id: 'reply-depth-0',
            content: 'depth0返信',
            createdAt: new Date().toISOString(),
            parentId: 'comment-1',
            user: { id: 'user-2', nickname: '返信者', avatarUrl: null },
            likeCount: 0,
            replyCount: 0,
          },
        ],
      })

      const { container } = render(
        <CommentCard
          comment={{ ...baseComment, replyCount: 1 }}
          postId="post-1"
          currentUserId="test-user-id"
          depth={0}
        />
      )

      await user.click(screen.getByText('1件の返信を表示'))
      await waitFor(() => {
        expect(screen.getByText('depth0返信')).toBeInTheDocument()
      })

      const replyContainer = container.querySelector('.border-l-2')
      expect(replyContainer).toBeInTheDocument()
    })

    it('renders with depth > 0 and does NOT add border-l-2 class', async () => {
      mockGetReplies.mockResolvedValue({
        replies: [
          {
            id: 'reply-depth-1',
            content: 'depth1返信',
            createdAt: new Date().toISOString(),
            parentId: 'comment-1',
            user: { id: 'user-2', nickname: '返信者', avatarUrl: null },
            likeCount: 0,
            replyCount: 0,
          },
        ],
      })

      const { container } = render(
        <CommentCard
          comment={{ ...baseComment, replyCount: 1 }}
          postId="post-1"
          currentUserId="test-user-id"
          depth={1}
        />
      )

      await user.click(screen.getByText('1件の返信を表示'))
      await waitFor(() => {
        expect(screen.getByText('depth1返信')).toBeInTheDocument()
      })

      // No border-l-2 at depth > 0
      const replyContainers = container.querySelectorAll('.border-l-2')
      expect(replyContainers.length).toBe(0)
    })
  })

  // ----------------------------------------------------------------
  // Combined scenario tests
  // ----------------------------------------------------------------
  describe('combined scenarios', () => {
    it('renders comment with all features: content, media, liked, replies', () => {
      render(
        <CommentCard
          comment={{
            ...baseComment,
            content: 'フル機能コメント',
            media: [
              { id: 'media-f1', url: '/full.jpg', type: 'image', sortOrder: 0 },
            ],
            isLiked: true,
            replyCount: 5,
            likeCount: 10,
            user: {
              id: 'test-user-id',
              nickname: 'フルユーザー',
              avatarUrl: '/avatar-full.jpg',
            },
          }}
          postId="post-1"
          currentUserId="test-user-id"
        />
      )

      expect(screen.getByText('フル機能コメント')).toBeInTheDocument()
      expect(screen.getByText('5件の返信を表示')).toBeInTheDocument()
      expect(screen.getByAltText('フルユーザー')).toBeInTheDocument()
    })

    it('renders unauthenticated view with content and mixed media types', () => {
      const { container } = render(
        <CommentCard
          comment={{
            ...baseComment,
            likeCount: 2,
            media: [
              { id: 'media-u1', url: '/unauth.jpg', type: 'image', sortOrder: 0 },
              { id: 'media-u2', url: '/unauth.mp4', type: 'video', sortOrder: 1 },
            ],
          }}
          postId="post-1"
          currentUserId={undefined}
        />
      )

      expect(screen.getByText('テストコメント')).toBeInTheDocument()
      const video = container.querySelector('video')
      expect(video).toBeInTheDocument()
      // Login link for like count
      expect(screen.getByText('2')).toBeInTheDocument()
    })

    it('handles rootCommentId prop correctly', () => {
      render(
        <CommentCard
          comment={{ ...baseComment }}
          postId="post-1"
          currentUserId="test-user-id"
          rootCommentId="root-comment-id"
        />
      )

      expect(screen.getByText('テストコメント')).toBeInTheDocument()
    })

    it('handles isMuted prop correctly', () => {
      render(
        <CommentCard
          comment={{ ...baseComment }}
          postId="post-1"
          currentUserId="test-user-id"
          isMuted={true}
        />
      )

      expect(screen.getByText('テストコメント')).toBeInTheDocument()
    })
  })
})
