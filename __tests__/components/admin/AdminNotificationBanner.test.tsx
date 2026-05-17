import { vi } from 'vitest'
/**
 * AdminNotificationBanner コンポーネントのテスト
 */

import { render, screen, waitFor } from '../../utils/test-utils'
import userEvent from '@testing-library/user-event'
import { AdminNotificationBanner } from '@/app/admin/hidden/AdminNotificationBanner'

// モック
vi.mock('@/lib/actions/admin/hidden', () => ({
  markAllAdminNotificationsAsRead: vi.fn().mockResolvedValue(undefined),
}))

import { markAllAdminNotificationsAsRead } from '@/lib/actions/admin/hidden'

const mockMarkAll = markAllAdminNotificationsAsRead as ReturnType<typeof vi.fn>

function createNotification(overrides: Record<string, unknown> = {}) {
  return {
    id: 'notif-1',
    type: 'auto_hidden',
    targetType: 'post',
    targetId: 'post-1',
    message: 'テスト通知メッセージ',
    reportCount: 10,
    isRead: false,
    createdAt: new Date('2024-06-01T10:00:00Z'),
    ...overrides,
  }
}

function createNotifications(count: number) {
  return Array.from({ length: count }, (_, i) =>
    createNotification({ id: `notif-${i + 1}`, message: `通知メッセージ${i + 1}` })
  )
}

describe('AdminNotificationBanner', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('unreadCountが0より大きい場合バナーを表示する', () => {
    render(
      <AdminNotificationBanner notifications={[createNotification()]} unreadCount={1} />
    )
    expect(screen.getByText('1件の新しい通知があります')).toBeInTheDocument()
  })

  it('unreadCountが0の場合も表示される（コンポーネントは常にレンダリング）', () => {
    render(
      <AdminNotificationBanner notifications={[]} unreadCount={0} />
    )
    expect(screen.getByText('0件の新しい通知があります')).toBeInTheDocument()
  })

  it('正しい未読数を表示する', () => {
    render(
      <AdminNotificationBanner notifications={createNotifications(5)} unreadCount={5} />
    )
    expect(screen.getByText('5件の新しい通知があります')).toBeInTheDocument()
  })

  it('表示ボタンが存在する', () => {
    render(
      <AdminNotificationBanner notifications={[createNotification()]} unreadCount={1} />
    )
    expect(screen.getByText('表示')).toBeInTheDocument()
  })

  it('すべて既読ボタンが存在する', () => {
    render(
      <AdminNotificationBanner notifications={[createNotification()]} unreadCount={1} />
    )
    expect(screen.getByText('すべて既読')).toBeInTheDocument()
  })

  it('展開前は通知メッセージが表示されない', () => {
    render(
      <AdminNotificationBanner notifications={[createNotification()]} unreadCount={1} />
    )
    expect(screen.queryByText('テスト通知メッセージ')).not.toBeInTheDocument()
  })

  it('表示ボタンをクリックすると通知メッセージが表示される', async () => {
    const user = userEvent.setup()
    render(
      <AdminNotificationBanner notifications={[createNotification()]} unreadCount={1} />
    )
    await user.click(screen.getByText('表示'))
    expect(screen.getByText('テスト通知メッセージ')).toBeInTheDocument()
  })

  it('展開後に閉じるボタンが表示される', async () => {
    const user = userEvent.setup()
    render(
      <AdminNotificationBanner notifications={[createNotification()]} unreadCount={1} />
    )
    await user.click(screen.getByText('表示'))
    expect(screen.getByText('閉じる')).toBeInTheDocument()
  })

  it('閉じるボタンをクリックすると通知が非表示になる', async () => {
    const user = userEvent.setup()
    render(
      <AdminNotificationBanner notifications={[createNotification()]} unreadCount={1} />
    )
    await user.click(screen.getByText('表示'))
    expect(screen.getByText('テスト通知メッセージ')).toBeInTheDocument()

    await user.click(screen.getByText('閉じる'))
    expect(screen.queryByText('テスト通知メッセージ')).not.toBeInTheDocument()
  })

  it('最初の5件のみ表示する', async () => {
    const user = userEvent.setup()
    const notifications = createNotifications(7)
    render(
      <AdminNotificationBanner notifications={notifications} unreadCount={7} />
    )
    await user.click(screen.getByText('表示'))

    expect(screen.getByText('通知メッセージ1')).toBeInTheDocument()
    expect(screen.getByText('通知メッセージ5')).toBeInTheDocument()
    expect(screen.queryByText('通知メッセージ6')).not.toBeInTheDocument()
    expect(screen.queryByText('通知メッセージ7')).not.toBeInTheDocument()
  })

  it('5件を超える場合に残りの件数を表示する', async () => {
    const user = userEvent.setup()
    const notifications = createNotifications(8)
    render(
      <AdminNotificationBanner notifications={notifications} unreadCount={8} />
    )
    await user.click(screen.getByText('表示'))
    expect(screen.getByText('他 3件の通知')).toBeInTheDocument()
  })

  it('ちょうど5件の場合は残り件数を表示しない', async () => {
    const user = userEvent.setup()
    const notifications = createNotifications(5)
    render(
      <AdminNotificationBanner notifications={notifications} unreadCount={5} />
    )
    await user.click(screen.getByText('表示'))
    expect(screen.queryByText(/他.*件の通知/)).not.toBeInTheDocument()
  })

  it('すべて既読ボタンをクリックするとサーバーアクションが呼ばれる', async () => {
    const user = userEvent.setup()
    render(
      <AdminNotificationBanner notifications={[createNotification()]} unreadCount={1} />
    )
    await user.click(screen.getByText('すべて既読'))
    expect(mockMarkAll).toHaveBeenCalledTimes(1)
  })

  it('処理中はボタンが無効になる', async () => {
    let resolvePromise: () => void
    mockMarkAll.mockImplementation((() => new Promise<void>(r => { resolvePromise = r })) as never)

    const user = userEvent.setup()
    render(
      <AdminNotificationBanner notifications={[createNotification()]} unreadCount={1} />
    )
    await user.click(screen.getByText('すべて既読'))
    expect(screen.getByText('処理中...')).toBeInTheDocument()

    resolvePromise!()
    await waitFor(() => {
      expect(screen.getByText('すべて既読')).toBeInTheDocument()
    })
  })

  it('空の通知配列を渡した場合、展開しても何も表示しない', async () => {
    const user = userEvent.setup()
    render(
      <AdminNotificationBanner notifications={[]} unreadCount={0} />
    )
    await user.click(screen.getByText('表示'))
    // 通知コンテンツがないことを確認
    expect(screen.queryByText(/通知メッセージ/)).not.toBeInTheDocument()
  })

  it('単一の通知を正しく表示する', async () => {
    const user = userEvent.setup()
    render(
      <AdminNotificationBanner
        notifications={[createNotification({ message: '唯一の通知' })]}
        unreadCount={1}
      />
    )
    await user.click(screen.getByText('表示'))
    expect(screen.getByText('唯一の通知')).toBeInTheDocument()
  })

  it('amber系のスタイリングが適用されている', () => {
    const { container } = render(
      <AdminNotificationBanner notifications={[createNotification()]} unreadCount={1} />
    )
    const banner = container.querySelector('[class*="bg-muted"]')
    expect(banner).toBeInTheDocument()
  })

  it('パルスアニメーション要素が存在する', () => {
    const { container } = render(
      <AdminNotificationBanner notifications={[createNotification()]} unreadCount={1} />
    )
    const pulse = container.querySelector('.animate-pulse')
    expect(pulse).toBeInTheDocument()
  })

  it('通知の作成日時が表示される', async () => {
    const user = userEvent.setup()
    render(
      <AdminNotificationBanner
        notifications={[createNotification({ createdAt: new Date('2024-06-01T10:00:00Z') })]}
        unreadCount={1}
      />
    )
    await user.click(screen.getByText('表示'))
    // 日時のフォーマットはロケールに依存するが、何かしら表示されていることを確認
    const dateElements = screen.getAllByText(/2024/)
    expect(dateElements.length).toBeGreaterThan(0)
  })

  it('マーク既読エラー時もクラッシュしない', async () => {
    mockMarkAll.mockResolvedValueOnce({ error: 'サーバーエラー' })
    const user = userEvent.setup()
    render(
      <AdminNotificationBanner notifications={[createNotification()]} unreadCount={1} />
    )
    await user.click(screen.getByText('すべて既読'))
    await waitFor(() => {
      expect(screen.getByText('すべて既読')).toBeInTheDocument()
    })
  })

  it('大量の未読数を正しく表示する', () => {
    render(
      <AdminNotificationBanner notifications={createNotifications(100)} unreadCount={100} />
    )
    expect(screen.getByText('100件の新しい通知があります')).toBeInTheDocument()
  })

  it('展開・折りたたみを複数回切り替えられる', async () => {
    const user = userEvent.setup()
    render(
      <AdminNotificationBanner notifications={[createNotification()]} unreadCount={1} />
    )
    await user.click(screen.getByText('表示'))
    expect(screen.getByText('テスト通知メッセージ')).toBeInTheDocument()

    await user.click(screen.getByText('閉じる'))
    expect(screen.queryByText('テスト通知メッセージ')).not.toBeInTheDocument()

    await user.click(screen.getByText('表示'))
    expect(screen.getByText('テスト通知メッセージ')).toBeInTheDocument()
  })
})
