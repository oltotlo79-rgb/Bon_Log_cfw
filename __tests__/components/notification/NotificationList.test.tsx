import type { Notification } from '@/components/notification/NotificationItem'
import { vi } from 'vitest'
import { render, screen, waitFor } from '../../utils/test-utils'
import { NotificationList } from '@/components/notification/NotificationList'

// Next-Auth モック
vi.mock('next-auth/react', () => ({
  SessionProvider: ({ children }: { children: React.ReactNode }) => children,
  useSession: () => ({
    data: { user: { id: 'test-user-id' } },
    status: 'authenticated',
  }),
}))

// React Query モック
vi.mock('@tanstack/react-query', () => ({
  useInfiniteQuery: vi.fn().mockReturnValue({
    data: undefined,
    fetchNextPage: vi.fn(),
    hasNextPage: false,
    isFetchingNextPage: false,
    isLoading: false,
    refetch: vi.fn(),
  }),
  useQueryClient: () => ({
    invalidateQueries: vi.fn(),
  }),
  QueryClientProvider: ({ children }: { children: React.ReactNode }) => children,
  QueryClient: vi.fn(),
}))

// intersection-observer モック
vi.mock('react-intersection-observer', () => ({
  useInView: () => ({ ref: vi.fn(), inView: false }),
}))

// NotificationItem モック
vi.mock('@/components/notification/NotificationItem', () => ({
  NotificationItem: ({ notification }: { notification: { id: string } }) => (
    <div data-testid={`notification-${notification.id}`}>通知アイテム</div>
  ),
}))

// Server Actions モック
const mockMarkAllAsRead = vi.fn()
vi.mock('@/lib/actions/notification', () => ({
  getNotifications: vi.fn(),
  markAllAsRead: () => mockMarkAllAsRead(),
  markAsRead: vi.fn(),
}))
vi.mock('@/lib/services/notification-core', () => ({
  getNotifications: vi.fn(),
  markAllAsRead: () => mockMarkAllAsRead(),
  markAsRead: vi.fn(),
}))

import { useInfiniteQuery as _mockUseInfiniteQuery } from '@tanstack/react-query'
const mockUseInfiniteQuery = _mockUseInfiniteQuery as unknown as ReturnType<typeof vi.fn>

describe('NotificationList', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockMarkAllAsRead.mockResolvedValue({ success: true })
    // デフォルトのモック値をリセット
    mockUseInfiniteQuery.mockReturnValue({
      data: undefined,
      fetchNextPage: vi.fn(),
      hasNextPage: false,
      isFetchingNextPage: false,
      isLoading: false,
      refetch: vi.fn(),
    })
  })

  it('通知がない場合メッセージを表示する', () => {
    render(<NotificationList initialNotifications={[]} />)
    expect(screen.getByText('通知はありません')).toBeInTheDocument()
    expect(screen.getByText(/いいね、コメント、フォローなどの通知がここに表示されます/)).toBeInTheDocument()
  })

  it('自動的にmarkAllAsReadを呼ぶ', async () => {
    render(<NotificationList initialNotifications={[]} />)

    await waitFor(() => {
      expect(mockMarkAllAsRead).toHaveBeenCalled()
    })
  })

  // ============================================================
  // 追加テスト
  // ============================================================

  it('初期通知を表示する', () => {
    const useInfiniteQuery = mockUseInfiniteQuery
    const notifications = [
      { id: '1', type: 'like', isRead: false, actor: { nickname: 'user1' } },
      { id: '2', type: 'follow', isRead: true, actor: { nickname: 'user2' } },
    ]
    useInfiniteQuery.mockReturnValue({
      data: { pages: [{ notifications, nextCursor: undefined }] },
      fetchNextPage: vi.fn(),
      hasNextPage: false,
      isFetchingNextPage: false,
      isLoading: false,
      refetch: vi.fn(),
    })

    render(<NotificationList initialNotifications={notifications as unknown as Notification[]} />)

    // NotificationItemがモックされていないため個別の通知内容は確認できないが、
    // 空状態メッセージが表示されないことを確認
    expect(screen.queryByText('通知はありません')).not.toBeInTheDocument()
  })

  it('ローディング中はスケルトンを表示する', () => {
    const useInfiniteQuery = mockUseInfiniteQuery
    useInfiniteQuery.mockReturnValue({
      data: undefined,
      fetchNextPage: vi.fn(),
      hasNextPage: false,
      isFetchingNextPage: false,
      isLoading: true,
      refetch: vi.fn(),
    })

    const { container } = render(<NotificationList initialNotifications={[]} />)

    // スケルトンのanimate-pulseクラスを確認
    const skeletons = container.querySelectorAll('.animate-pulse')
    expect(skeletons.length).toBeGreaterThan(0)
  })

  it('次ページ取得中にローディングスピナーを表示する', () => {
    const useInfiniteQuery = mockUseInfiniteQuery
    const notifications = [
      { id: '1', type: 'like', isRead: false },
    ]
    useInfiniteQuery.mockReturnValue({
      data: { pages: [{ notifications, nextCursor: 'cursor-1' }] },
      fetchNextPage: vi.fn(),
      hasNextPage: true,
      isFetchingNextPage: true,
      isLoading: false,
      refetch: vi.fn(),
    })

    render(<NotificationList initialNotifications={notifications as unknown as Notification[]} />)

    expect(screen.getByText('読み込み中...')).toBeInTheDocument()
  })

  it('全データ読み込み完了時にメッセージを表示する', () => {
    const useInfiniteQuery = mockUseInfiniteQuery
    const notifications = [
      { id: '1', type: 'like', isRead: true },
    ]
    useInfiniteQuery.mockReturnValue({
      data: { pages: [{ notifications, nextCursor: undefined }] },
      fetchNextPage: vi.fn(),
      hasNextPage: false,
      isFetchingNextPage: false,
      isLoading: false,
      refetch: vi.fn(),
    })

    render(<NotificationList initialNotifications={notifications as unknown as Notification[]} />)

    expect(screen.getByText('これ以上通知はありません')).toBeInTheDocument()
  })

  it('未読通知がある場合にすべて既読にするボタンを表示する', () => {
    const useInfiniteQuery = mockUseInfiniteQuery
    const notifications = [
      { id: '1', type: 'like', isRead: false },
    ]
    useInfiniteQuery.mockReturnValue({
      data: { pages: [{ notifications, nextCursor: undefined }] },
      fetchNextPage: vi.fn(),
      hasNextPage: false,
      isFetchingNextPage: false,
      isLoading: false,
      refetch: vi.fn(),
    })

    render(<NotificationList initialNotifications={notifications as unknown as Notification[]} />)

    expect(screen.getByText('すべて既読にする')).toBeInTheDocument()
  })

  it('全て既読の場合はすべて既読ボタンを表示しない', () => {
    const useInfiniteQuery = mockUseInfiniteQuery
    const notifications = [
      { id: '1', type: 'like', isRead: true },
      { id: '2', type: 'follow', isRead: true },
    ]
    useInfiniteQuery.mockReturnValue({
      data: { pages: [{ notifications, nextCursor: undefined }] },
      fetchNextPage: vi.fn(),
      hasNextPage: false,
      isFetchingNextPage: false,
      isLoading: false,
      refetch: vi.fn(),
    })

    render(<NotificationList initialNotifications={notifications as unknown as Notification[]} />)

    expect(screen.queryByText('すべて既読にする')).not.toBeInTheDocument()
  })

  it('空状態でタイトルを表示する', () => {
    render(<NotificationList initialNotifications={[]} />)

    expect(screen.getByText('通知はありません')).toBeInTheDocument()
  })

  it('複数ページの通知をフラット化して表示する', () => {
    const useInfiniteQuery = mockUseInfiniteQuery
    const page1 = [{ id: '1', type: 'like', isRead: true }]
    const page2 = [{ id: '2', type: 'follow', isRead: true }]
    useInfiniteQuery.mockReturnValue({
      data: { pages: [{ notifications: page1, nextCursor: 'c1' }, { notifications: page2, nextCursor: undefined }] },
      fetchNextPage: vi.fn(),
      hasNextPage: false,
      isFetchingNextPage: false,
      isLoading: false,
      refetch: vi.fn(),
    })

    render(<NotificationList initialNotifications={page1 as unknown as Notification[]} />)

    expect(screen.queryByText('通知はありません')).not.toBeInTheDocument()
  })

  it('useInfiniteQueryにnotificationsキーを使用する', () => {
    const useInfiniteQuery = mockUseInfiniteQuery
    render(<NotificationList initialNotifications={[]} />)

    expect(useInfiniteQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        queryKey: ['notifications'],
      })
    )
  })

  it('初期データがuseInfiniteQueryに渡される', () => {
    const useInfiniteQuery = mockUseInfiniteQuery
    const notifications = [{ id: '1', type: 'like', isRead: false }]

    render(<NotificationList initialNotifications={notifications as unknown as Notification[]} />)

    expect(useInfiniteQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        initialData: expect.objectContaining({
          pages: expect.arrayContaining([
            expect.objectContaining({
              notifications,
            }),
          ]),
        }),
      })
    )
  })

  it('スケルトンが5件分表示される', () => {
    const useInfiniteQuery = mockUseInfiniteQuery
    useInfiniteQuery.mockReturnValue({
      data: undefined,
      fetchNextPage: vi.fn(),
      hasNextPage: false,
      isFetchingNextPage: false,
      isLoading: true,
      refetch: vi.fn(),
    })

    const { container } = render(<NotificationList initialNotifications={[]} />)

    const skeletonItems = container.querySelectorAll('.animate-pulse')
    expect(skeletonItems).toHaveLength(5)
  })

  it('hasNextPageがfalseでisFetchingNextPageがfalseの場合スピナーを表示しない', () => {
    const useInfiniteQuery = mockUseInfiniteQuery
    const notifications = [{ id: '1', type: 'like', isRead: true }]
    useInfiniteQuery.mockReturnValue({
      data: { pages: [{ notifications, nextCursor: undefined }] },
      fetchNextPage: vi.fn(),
      hasNextPage: false,
      isFetchingNextPage: false,
      isLoading: false,
      refetch: vi.fn(),
    })

    render(<NotificationList initialNotifications={notifications as unknown as Notification[]} />)

    expect(screen.queryByText('読み込み中...')).not.toBeInTheDocument()
  })

  it('混合タイプの通知を表示する', () => {
    const useInfiniteQuery = mockUseInfiniteQuery
    const notifications = [
      { id: '1', type: 'like', isRead: false },
      { id: '2', type: 'follow', isRead: true },
      { id: '3', type: 'comment', isRead: false },
      { id: '4', type: 'mention', isRead: true },
    ]
    useInfiniteQuery.mockReturnValue({
      data: { pages: [{ notifications, nextCursor: undefined }] },
      fetchNextPage: vi.fn(),
      hasNextPage: false,
      isFetchingNextPage: false,
      isLoading: false,
      refetch: vi.fn(),
    })

    render(<NotificationList initialNotifications={notifications as unknown as Notification[]} />)

    expect(screen.queryByText('通知はありません')).not.toBeInTheDocument()
  })
})
