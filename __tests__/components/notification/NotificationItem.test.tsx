import { vi } from 'vitest'
import { render, screen, waitFor } from '../../utils/test-utils'
import userEvent from '@testing-library/user-event'
import { NotificationItem } from '@/components/notification/NotificationItem'

// Server Actions モック
const mockMarkAsRead = vi.fn()
vi.mock('@/lib/actions/notification', () => ({
  markAsRead: (...args: unknown[]) => mockMarkAsRead(...args),
}))
vi.mock('@/lib/services/notification-core', () => ({
  markAsRead: (...args: unknown[]) => mockMarkAsRead(...args),
}))

const baseNotification = {
  id: 'notif-1',
  isRead: false,
  createdAt: new Date().toISOString(),
  actor: {
    id: 'user-1',
    nickname: 'テストユーザー',
    avatarUrl: null,
  },
  post: null,
  comment: null,
}

describe('NotificationItem', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('いいね通知を表示する', () => {
    const notification = {
      ...baseNotification,
      type: 'like',
      post: { id: 'post-1', content: 'テスト投稿' },
    }
    render(<NotificationItem notification={notification} />)

    expect(screen.getByText('テストユーザー')).toBeInTheDocument()
    expect(screen.getByText(/さんがあなたの投稿にいいねしました/)).toBeInTheDocument()
    expect(screen.getByText('テスト投稿')).toBeInTheDocument()
  })

  it('コメント通知を表示する', () => {
    const notification = {
      ...baseNotification,
      type: 'comment',
      post: { id: 'post-1', content: 'テスト投稿' },
      comment: { id: 'comment-1', content: 'コメント内容' },
    }
    render(<NotificationItem notification={notification} />)

    expect(screen.getByText(/さんがあなたの投稿にコメントしました/)).toBeInTheDocument()
    expect(screen.getByText('コメント内容')).toBeInTheDocument()
  })

  it('フォロー通知を表示する', () => {
    const notification = {
      ...baseNotification,
      type: 'follow',
    }
    render(<NotificationItem notification={notification} />)

    expect(screen.getByText(/さんがあなたをフォローしました/)).toBeInTheDocument()
  })

  it('引用投稿通知を表示する', () => {
    const notification = {
      ...baseNotification,
      type: 'quote',
      post: { id: 'post-1', content: 'テスト投稿' },
    }
    render(<NotificationItem notification={notification} />)

    expect(screen.getByText(/さんがあなたの投稿を引用しました/)).toBeInTheDocument()
  })

  it('リポスト通知を表示する', () => {
    const notification = {
      ...baseNotification,
      type: 'repost',
      post: { id: 'post-1', content: 'テスト投稿' },
    }
    render(<NotificationItem notification={notification} />)

    expect(screen.getByText(/さんがあなたの投稿をリポストしました/)).toBeInTheDocument()
  })

  it('返信通知を表示する', () => {
    const notification = {
      ...baseNotification,
      type: 'reply',
      post: { id: 'post-1', content: 'テスト投稿' },
      comment: { id: 'comment-1', content: '返信内容' },
    }
    render(<NotificationItem notification={notification} />)

    expect(screen.getByText(/さんがあなたのコメントに返信しました/)).toBeInTheDocument()
  })

  it('コメントいいね通知を表示する', () => {
    const notification = {
      ...baseNotification,
      type: 'comment_like',
      post: { id: 'post-1', content: 'テスト投稿' },
      comment: { id: 'comment-1', content: 'コメント内容' },
    }
    render(<NotificationItem notification={notification} />)

    expect(screen.getByText(/さんがあなたのコメントにいいねしました/)).toBeInTheDocument()
  })

  it('未読の場合は背景色が変わる', () => {
    const notification = {
      ...baseNotification,
      type: 'like',
      isRead: false,
    }
    const { container } = render(<NotificationItem notification={notification} />)

    const link = container.querySelector('a')
    expect(link).toHaveClass('bg-primary/5')
  })

  it('既読の場合は背景色が変わらない', () => {
    const notification = {
      ...baseNotification,
      type: 'like',
      isRead: true,
    }
    const { container } = render(<NotificationItem notification={notification} />)

    const link = container.querySelector('a')
    expect(link).not.toHaveClass('bg-primary/5')
  })

  it('未読インジケーターを表示する（未読時）', () => {
    const notification = {
      ...baseNotification,
      type: 'like',
      isRead: false,
    }
    const { container } = render(<NotificationItem notification={notification} />)

    // 未読インジケーター（青い丸）
    expect(container.querySelector('.bg-primary.rounded-full')).toBeInTheDocument()
  })

  it('クリック時に既読処理を呼ぶ（未読の場合）', async () => {
    mockMarkAsRead.mockResolvedValue({ success: true })

    const notification = {
      ...baseNotification,
      type: 'follow',
      isRead: false,
    }

    const user = userEvent.setup()
    render(<NotificationItem notification={notification} />)

    await user.click(screen.getByRole('link'))

    await waitFor(() => {
      expect(mockMarkAsRead).toHaveBeenCalledWith('notif-1')
    })
  })

  it('クリック時に既読処理を呼ばない（既読の場合）', async () => {
    const notification = {
      ...baseNotification,
      type: 'follow',
      isRead: true,
    }

    const user = userEvent.setup()
    render(<NotificationItem notification={notification} />)

    await user.click(screen.getByRole('link'))

    expect(mockMarkAsRead).not.toHaveBeenCalled()
  })

  it('投稿があるときは投稿ページへのリンクを持つ', () => {
    const notification = {
      ...baseNotification,
      type: 'like',
      post: { id: 'post-1', content: 'テスト投稿' },
    }
    render(<NotificationItem notification={notification} />)

    expect(screen.getByRole('link')).toHaveAttribute('href', '/posts/post-1')
  })

  it('コメントがあるときはアンカーリンクを持つ', () => {
    const notification = {
      ...baseNotification,
      type: 'comment',
      post: { id: 'post-1', content: 'テスト投稿' },
      comment: { id: 'comment-1', content: 'コメント内容' },
    }
    render(<NotificationItem notification={notification} />)

    expect(screen.getByRole('link')).toHaveAttribute('href', '/posts/post-1#comment-comment-1')
  })

  it('フォロー通知はユーザーページへのリンクを持つ', () => {
    const notification = {
      ...baseNotification,
      type: 'follow',
    }
    render(<NotificationItem notification={notification} />)

    expect(screen.getByRole('link')).toHaveAttribute('href', '/users/user-1')
  })

  it('フォローリクエスト通知を表示する', () => {
    const notification = {
      ...baseNotification,
      type: 'follow_request',
    }
    render(<NotificationItem notification={notification} />)

    expect(screen.getByText(/さんからフォローリクエストが届きました/)).toBeInTheDocument()
  })

  it('フォローリクエスト通知はフォローリクエスト管理ページへのリンクを持つ', () => {
    const notification = {
      ...baseNotification,
      type: 'follow_request',
    }
    render(<NotificationItem notification={notification} />)

    expect(screen.getByRole('link')).toHaveAttribute('href', '/settings/follow-requests')
  })

  it('フォローリクエスト承認通知を表示する', () => {
    const notification = {
      ...baseNotification,
      type: 'follow_request_approved',
    }
    render(<NotificationItem notification={notification} />)

    expect(screen.getByText(/さんがフォローリクエストを承認しました/)).toBeInTheDocument()
  })

  it('フォローリクエスト承認通知はユーザーページへのリンクを持つ', () => {
    const notification = {
      ...baseNotification,
      type: 'follow_request_approved',
    }
    render(<NotificationItem notification={notification} />)

    expect(screen.getByRole('link')).toHaveAttribute('href', '/users/user-1')
  })

  it('メンション通知を表示し投稿へリンクする', () => {
    const notification = {
      ...baseNotification,
      type: 'mention',
      post: { id: 'post-9', content: '本文' },
    }
    render(<NotificationItem notification={notification} />)

    expect(screen.getByText(/さんがあなたをメンションしました/)).toBeInTheDocument()
    expect(screen.getByRole('link')).toHaveAttribute('href', '/posts/post-9')
  })

  it('メッセージ通知を表示しメッセージ一覧へリンクする', () => {
    const notification = {
      ...baseNotification,
      type: 'message',
    }
    render(<NotificationItem notification={notification} />)

    expect(screen.getByText(/さんからメッセージが届きました/)).toBeInTheDocument()
    expect(screen.getByRole('link')).toHaveAttribute('href', '/messages')
  })

  it('プレミアム期限通知は actorName を使わずサブスク管理へリンクする', () => {
    const notification = {
      ...baseNotification,
      type: 'subscription_expiring',
    }
    render(<NotificationItem notification={notification} />)

    expect(screen.getByText('プレミアム会員の有効期限が近づいています')).toBeInTheDocument()
    expect(screen.getByRole('link')).toHaveAttribute('href', '/settings/subscription')
  })

  it('運営からのお知らせ通知は通知一覧へリンクする', () => {
    const notification = {
      ...baseNotification,
      type: 'system',
    }
    render(<NotificationItem notification={notification} />)

    expect(screen.getByText('運営からのお知らせがあります')).toBeInTheDocument()
    expect(screen.getByRole('link')).toHaveAttribute('href', '/notifications')
  })

  it('相対時間を表示する', () => {
    const notification = {
      ...baseNotification,
      type: 'like',
    }
    render(<NotificationItem notification={notification} />)

    // formatDistanceToNowが「数秒前」や「約1分前」などを返す
    expect(screen.getByText(/前/)).toBeInTheDocument()
  })

  it('ユーザーのアバターイニシャルを表示する（アバターがない場合）', () => {
    const notification = {
      ...baseNotification,
      type: 'like',
    }
    render(<NotificationItem notification={notification} />)

    // イニシャル「テ」が表示される
    expect(screen.getByText('テ')).toBeInTheDocument()
  })
})
