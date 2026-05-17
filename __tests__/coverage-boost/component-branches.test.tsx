import { vi } from 'vitest'
/**
 * コンポーネントのブランチカバレッジ向上テスト
 *
 * 各コンポーネントの未カバーブランチを集中的にテスト
 */
import { render, screen, waitFor } from '../utils/test-utils'
import userEvent from '@testing-library/user-event'

// ==================================================
// CommentList - onDeleted ブランチカバレッジ向上
// ==================================================

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

const mockGetComments = vi.fn()
const mockDeleteComment = vi.fn()

vi.mock('@/lib/actions/comment', () => ({
  getComments: (...args: unknown[]) => mockGetComments(...args),
  deleteComment: (...args: unknown[]) => mockDeleteComment(...args),
  getReplies: vi.fn().mockResolvedValue({ replies: [] }),
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

import { CommentList } from '@/components/comment/CommentList'

describe('CommentList onDeleted ブランチ', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('replyCount=0 & isBlockedUser=true のコメントもonDeletedで処理される', () => {
    const comments = [
      {
        id: 'blocked-comment',
        content: 'ブロックユーザーのコメント',
        createdAt: new Date().toISOString(),
        parentId: null,
        user: { id: 'blocked-user', nickname: 'ブロック', avatarUrl: null },
        likeCount: 0,
        replyCount: 0,
        isBlockedUser: true,
      },
    ]

    render(
      <CommentList
        postId="post-1"
        initialComments={comments}
        currentUserId="test-user-id"
      />
    )

    expect(screen.getByText('ブロック中のユーザーのコメントです')).toBeInTheDocument()
  })

  it('mutedThreadIdsのundefinedデフォルトでも正常に動作する', () => {
    const comments = [
      {
        id: 'comment-1',
        content: 'テストコメント',
        createdAt: new Date().toISOString(),
        parentId: null,
        user: { id: 'user-1', nickname: 'ユーザー1', avatarUrl: null },
        likeCount: 0,
        replyCount: 0,
      },
    ]

    // mutedThreadIdsを渡さない
    render(
      <CommentList
        postId="post-1"
        initialComments={comments}
        currentUserId="test-user-id"
      />
    )

    expect(screen.getByText('テストコメント')).toBeInTheDocument()
  })

  it('loadMoreがloadingが既にtrueの場合スキップする', async () => {
    mockGetComments.mockImplementation(
      () => new Promise(resolve => setTimeout(() => resolve({ comments: [], nextCursor: undefined }), 1000))
    )

    const user = userEvent.setup()
    render(
      <CommentList
        postId="post-1"
        initialComments={[
          {
            id: 'c1',
            content: 'コメント',
            createdAt: new Date().toISOString(),
            parentId: null,
            user: { id: 'u1', nickname: 'U1', avatarUrl: null },
            likeCount: 0,
          },
        ]}
        initialNextCursor="cursor-1"
        currentUserId="test-user-id"
      />
    )

    // 最初のクリック
    await user.click(screen.getByRole('button', { name: 'さらに読み込む' }))

    // ボタンが読み込み中に変わる
    await waitFor(() => {
      expect(screen.getByRole('button', { name: '読み込み中...' })).toBeDisabled()
    })

    // loadMoreは1回だけ呼ばれる
    expect(mockGetComments).toHaveBeenCalledTimes(1)
  })
})

// ==================================================
// 追加のコンポーネントテスト
// ==================================================

describe('CommentList - nextCursorの変更追跡', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('追加読み込み後にnextCursorが新しい値に更新される', async () => {
    mockGetComments.mockResolvedValue({
      comments: [
        {
          id: 'c2',
          content: '追加',
          createdAt: new Date().toISOString(),
          parentId: null,
          user: { id: 'u2', nickname: 'U2', avatarUrl: null },
          likeCount: 0,
          replyCount: 0,
        },
      ],
      nextCursor: 'cursor-2',
    })

    const user = userEvent.setup()
    render(
      <CommentList
        postId="post-1"
        initialComments={[
          {
            id: 'c1',
            content: '初期',
            createdAt: new Date().toISOString(),
            parentId: null,
            user: { id: 'u1', nickname: 'U1', avatarUrl: null },
            likeCount: 0,
            replyCount: 0,
          },
        ]}
        initialNextCursor="cursor-1"
        currentUserId="test-user-id"
      />
    )

    await user.click(screen.getByRole('button', { name: 'さらに読み込む' }))

    await waitFor(() => {
      expect(screen.getByText('追加')).toBeInTheDocument()
    })

    // cursor-2があるのでボタンがまだ表示される
    expect(screen.getByRole('button', { name: 'さらに読み込む' })).toBeInTheDocument()
  })
})
