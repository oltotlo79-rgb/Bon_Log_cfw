import { vi } from 'vitest'
import { render, screen } from '@testing-library/react'

// モック
vi.mock('@/lib/actions/admin/hidden', () => ({
  getHiddenContent: vi.fn(),
  getAdminNotifications: vi.fn(),
}))

vi.mock('@/app/admin/hidden/HiddenContentList', () => ({
  HiddenContentList: ({ items }: any) => <div data-testid="hidden-content-list">{items.length} items</div>,
}))

vi.mock('@/app/admin/hidden/AdminNotificationBanner', () => ({
  AdminNotificationBanner: ({ unreadCount }: any) => <div data-testid="admin-notification-banner">{unreadCount} notifications</div>,
}))

describe('HiddenContentPage', async () => {
  const { getHiddenContent, getAdminNotifications } = await import('@/lib/actions/admin/hidden')

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('エラー時にエラーメッセージを表示', async () => {
     
    getHiddenContent.mockResolvedValue({ error: 'データ取得エラー' } as any)
     
    getAdminNotifications.mockResolvedValue({ notifications: [], unreadCount: 0 } as any)

    const { default: Page } = await import('@/app/admin/hidden/page')
    const result = await Page()
    render(result)

    expect(screen.getByText('データ取得エラー')).toBeInTheDocument()
  })

  it('非表示コンテンツがない場合は空メッセージを表示', async () => {
     
    getHiddenContent.mockResolvedValue({ items: [] } as any)
     
    getAdminNotifications.mockResolvedValue({ notifications: [], unreadCount: 0 } as any)

    const { default: Page } = await import('@/app/admin/hidden/page')
    const result = await Page()
    render(result)

    expect(screen.getByText('非表示コンテンツはありません')).toBeInTheDocument()
    expect(screen.queryByTestId('admin-notification-banner')).not.toBeInTheDocument()
  })

  it('未読通知がある場合はバナーを表示', async () => {
    const items = [
      { type: 'post', id: '1' },
      { type: 'comment', id: '2' },
      { type: 'event', id: '3' },
    ]
     
    getHiddenContent.mockResolvedValue({ items } as any)
    getAdminNotifications.mockResolvedValue({
      notifications: [{ id: '1' }],
      unreadCount: 5,
     
    } as any)

    const { default: Page } = await import('@/app/admin/hidden/page')
    const result = await Page()
    render(result)

    expect(screen.getByTestId('admin-notification-banner')).toHaveTextContent('5 notifications')
    expect(screen.getByTestId('hidden-content-list')).toHaveTextContent('3 items')
  })

  it('統計カードに正しい数を表示', async () => {
    const items = [
      { type: 'post', id: '1' },
      { type: 'post', id: '2' },
      { type: 'comment', id: '3' },
      { type: 'event', id: '4' },
      { type: 'shop', id: '5' },
      { type: 'review', id: '6' },
    ]
     
    getHiddenContent.mockResolvedValue({ items } as any)
     
    getAdminNotifications.mockResolvedValue({ notifications: [], unreadCount: 0 } as any)

    const { default: Page } = await import('@/app/admin/hidden/page')
    const result = await Page()
    render(result)

    // 統計カードを確認（親要素全体をチェック）
    const postCard = screen.getByText('投稿').closest('div.bg-card')
    expect(postCard).toHaveTextContent('2投稿')

    const commentCard = screen.getByText('コメント').closest('div.bg-card')
    expect(commentCard).toHaveTextContent('1コメント')

    const eventCard = screen.getByText('イベント').closest('div.bg-card')
    expect(eventCard).toHaveTextContent('1イベント')

    const shopCard = screen.getByText('盆栽園').closest('div.bg-card')
    expect(shopCard).toHaveTextContent('1盆栽園')

    const reviewCard = screen.getByText('レビュー').closest('div.bg-card')
    expect(reviewCard).toHaveTextContent('1レビュー')
  })
})
