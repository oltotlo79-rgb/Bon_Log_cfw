import { vi } from 'vitest'
/**
 * NotificationListコンポーネントの追加テスト
 * 分岐カバレッジを向上させるためのテスト
 */

import { render, screen, fireEvent, waitFor } from '../../utils/test-utils'
import { NotificationList } from '@/components/notification/NotificationList'

// Next-Auth モック
vi.mock('next-auth/react', () => ({
  SessionProvider: ({ children }: { children: React.ReactNode }) => children,
  useSession: () => ({
    data: { user: { id: 'test-user-id' } },
    status: 'authenticated',
  }),
}))

// react-intersection-observerのモック
const mockUseInView = vi.fn()
vi.mock('react-intersection-observer', () => ({
  useInView: () => mockUseInView(),
}))

// React Query モック
const mockFetchNextPage = vi.fn()
const mockRefetch = vi.fn()
const mockInvalidateQueries = vi.fn()
const mockUseInfiniteQuery = vi.fn()

vi.mock('@tanstack/react-query', () => ({
  useInfiniteQuery: (config: unknown) => mockUseInfiniteQuery(config),
  useQueryClient: () => ({
    invalidateQueries: mockInvalidateQueries,
  }),
  QueryClientProvider: ({ children }: { children: React.ReactNode }) => children,
  QueryClient: vi.fn(),
}))

// NotificationItem モック
vi.mock('@/components/notification/NotificationItem', () => ({
  NotificationItem: ({ notification }: { notification: { id: string; type: string } }) => (
    <div data-testid={`notification-${notification.id}`} data-type={notification.type}>
      通知アイテム: {notification.type}
    </div>
  ),
}))

// Server Actions モック
const mockMarkAllAsRead = vi.fn()
const mockGetNotifications = vi.fn()
vi.mock('@/lib/actions/notification', () => ({
  getNotifications: (...args: unknown[]) => mockGetNotifications(...args),
  markAllAsRead: () => mockMarkAllAsRead(),
  markAsRead: vi.fn(),
}))
vi.mock('@/lib/services/notification-core', () => ({
  getNotifications: (...args: unknown[]) => mockGetNotifications(...args),
  markAllAsRead: () => mockMarkAllAsRead(),
  markAsRead: vi.fn(),
}))

describe('NotificationList - 追加カバレッジテスト', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockMarkAllAsRead.mockResolvedValue({ success: true })
    mockUseInView.mockReturnValue({ ref: vi.fn(), inView: false })
    mockRefetch.mockResolvedValue(undefined)
    mockUseInfiniteQuery.mockImplementation(() => ({
      data: undefined,
      fetchNextPage: mockFetchNextPage,
      hasNextPage: false,
      isFetchingNextPage: false,
      isLoading: false,
      refetch: mockRefetch,
    }))
  })

  describe('無限スクロール', () => {
    it('inViewがtrueでhasNextPageがtrueの場合fetchNextPageが呼ばれる', async () => {
      mockUseInView.mockReturnValue({ ref: vi.fn(), inView: true })
      const notifications = [{ id: '1', type: 'like', isRead: true }]
      mockUseInfiniteQuery.mockImplementation(() => ({
        data: { pages: [{ notifications, nextCursor: 'cursor-1' }] },
        fetchNextPage: mockFetchNextPage,
        hasNextPage: true,
        isFetchingNextPage: false,
        isLoading: false,
        refetch: mockRefetch,
      }))

      render(<NotificationList initialNotifications={notifications} />)

      await waitFor(() => {
        expect(mockFetchNextPage).toHaveBeenCalled()
      })
    })

    it('isFetchingNextPageがtrueの場合fetchNextPageは呼ばれない', () => {
      mockUseInView.mockReturnValue({ ref: vi.fn(), inView: true })
      const notifications = [{ id: '1', type: 'like', isRead: true }]
      mockUseInfiniteQuery.mockImplementation(() => ({
        data: { pages: [{ notifications, nextCursor: 'cursor-1' }] },
        fetchNextPage: mockFetchNextPage,
        hasNextPage: true,
        isFetchingNextPage: true,
        isLoading: false,
        refetch: mockRefetch,
      }))

      render(<NotificationList initialNotifications={notifications} />)

      expect(mockFetchNextPage).not.toHaveBeenCalled()
    })

    it('hasNextPageがfalseの場合fetchNextPageは呼ばれない', () => {
      mockUseInView.mockReturnValue({ ref: vi.fn(), inView: true })
      const notifications = [{ id: '1', type: 'like', isRead: true }]
      mockUseInfiniteQuery.mockImplementation(() => ({
        data: { pages: [{ notifications, nextCursor: undefined }] },
        fetchNextPage: mockFetchNextPage,
        hasNextPage: false,
        isFetchingNextPage: false,
        isLoading: false,
        refetch: mockRefetch,
      }))

      render(<NotificationList initialNotifications={notifications} />)

      expect(mockFetchNextPage).not.toHaveBeenCalled()
    })
  })

  describe('すべて既読にする機能', () => {
    it('すべて既読にするボタンをクリックするとmarkAllAsReadが呼ばれる', async () => {
      const notifications = [{ id: '1', type: 'like', isRead: false }]
      mockUseInfiniteQuery.mockImplementation(() => ({
        data: { pages: [{ notifications, nextCursor: undefined }] },
        fetchNextPage: mockFetchNextPage,
        hasNextPage: false,
        isFetchingNextPage: false,
        isLoading: false,
        refetch: mockRefetch,
      }))

      render(<NotificationList initialNotifications={notifications} />)

      const markAllButton = screen.getByText('すべて既読にする')
      fireEvent.click(markAllButton)

      await waitFor(() => {
        expect(mockMarkAllAsRead).toHaveBeenCalled()
      })
    })

    it('すべて既読にするボタンをクリックするとrefetchが呼ばれる', async () => {
      const notifications = [{ id: '1', type: 'like', isRead: false }]
      mockUseInfiniteQuery.mockImplementation(() => ({
        data: { pages: [{ notifications, nextCursor: undefined }] },
        fetchNextPage: mockFetchNextPage,
        hasNextPage: false,
        isFetchingNextPage: false,
        isLoading: false,
        refetch: mockRefetch,
      }))

      render(<NotificationList initialNotifications={notifications} />)

      const markAllButton = screen.getByText('すべて既読にする')
      fireEvent.click(markAllButton)

      await waitFor(() => {
        expect(mockRefetch).toHaveBeenCalled()
      })
    })

    it('すべて既読にするボタンをクリックするとキャッシュが無効化される', async () => {
      const notifications = [{ id: '1', type: 'like', isRead: false }]
      mockUseInfiniteQuery.mockImplementation(() => ({
        data: { pages: [{ notifications, nextCursor: undefined }] },
        fetchNextPage: mockFetchNextPage,
        hasNextPage: false,
        isFetchingNextPage: false,
        isLoading: false,
        refetch: mockRefetch,
      }))

      render(<NotificationList initialNotifications={notifications} />)

      const markAllButton = screen.getByText('すべて既読にする')
      fireEvent.click(markAllButton)

      await waitFor(() => {
        expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: ['unreadCount'] })
      })
    })
  })

  describe('ページマウント時の自動既読処理', () => {
    it('マウント時にmarkAllAsReadが呼ばれる', async () => {
      render(<NotificationList initialNotifications={[]} />)

      await waitFor(() => {
        expect(mockMarkAllAsRead).toHaveBeenCalled()
      })
    })

    it('マウント時にrefetchが呼ばれる', async () => {
      render(<NotificationList initialNotifications={[]} />)

      await waitFor(() => {
        expect(mockRefetch).toHaveBeenCalled()
      })
    })

    it('マウント時にunreadCountキャッシュが無効化される', async () => {
      render(<NotificationList initialNotifications={[]} />)

      await waitFor(() => {
        expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: ['unreadCount'] })
      })
    })
  })

  describe('通知タイプ別表示', () => {
    it('likeタイプの通知を表示する', () => {
      const notifications = [{ id: '1', type: 'like', isRead: true }]
      mockUseInfiniteQuery.mockImplementation(() => ({
        data: { pages: [{ notifications, nextCursor: undefined }] },
        fetchNextPage: mockFetchNextPage,
        hasNextPage: false,
        isFetchingNextPage: false,
        isLoading: false,
        refetch: mockRefetch,
      }))

      render(<NotificationList initialNotifications={notifications} />)

      expect(screen.getByTestId('notification-1')).toHaveAttribute('data-type', 'like')
    })

    it('followタイプの通知を表示する', () => {
      const notifications = [{ id: '2', type: 'follow', isRead: true }]
      mockUseInfiniteQuery.mockImplementation(() => ({
        data: { pages: [{ notifications, nextCursor: undefined }] },
        fetchNextPage: mockFetchNextPage,
        hasNextPage: false,
        isFetchingNextPage: false,
        isLoading: false,
        refetch: mockRefetch,
      }))

      render(<NotificationList initialNotifications={notifications} />)

      expect(screen.getByTestId('notification-2')).toHaveAttribute('data-type', 'follow')
    })

    it('commentタイプの通知を表示する', () => {
      const notifications = [{ id: '3', type: 'comment', isRead: true }]
      mockUseInfiniteQuery.mockImplementation(() => ({
        data: { pages: [{ notifications, nextCursor: undefined }] },
        fetchNextPage: mockFetchNextPage,
        hasNextPage: false,
        isFetchingNextPage: false,
        isLoading: false,
        refetch: mockRefetch,
      }))

      render(<NotificationList initialNotifications={notifications} />)

      expect(screen.getByTestId('notification-3')).toHaveAttribute('data-type', 'comment')
    })

    it('mentionタイプの通知を表示する', () => {
      const notifications = [{ id: '4', type: 'mention', isRead: true }]
      mockUseInfiniteQuery.mockImplementation(() => ({
        data: { pages: [{ notifications, nextCursor: undefined }] },
        fetchNextPage: mockFetchNextPage,
        hasNextPage: false,
        isFetchingNextPage: false,
        isLoading: false,
        refetch: mockRefetch,
      }))

      render(<NotificationList initialNotifications={notifications} />)

      expect(screen.getByTestId('notification-4')).toHaveAttribute('data-type', 'mention')
    })
  })

  describe('アイコンコンポーネント', () => {
    it('空状態でBellIconが表示される', () => {
      render(<NotificationList initialNotifications={[]} />)

      // SVG要素が存在することを確認
      const emptyState = screen.getByText('通知はありません').parentElement
      expect(emptyState?.querySelector('svg')).toBeInTheDocument()
    })

    it('すべて既読ボタンにCheckCheckIconが表示される', () => {
      const notifications = [{ id: '1', type: 'like', isRead: false }]
      mockUseInfiniteQuery.mockImplementation(() => ({
        data: { pages: [{ notifications, nextCursor: undefined }] },
        fetchNextPage: mockFetchNextPage,
        hasNextPage: false,
        isFetchingNextPage: false,
        isLoading: false,
        refetch: mockRefetch,
      }))

      render(<NotificationList initialNotifications={notifications} />)

      const markAllButton = screen.getByText('すべて既読にする').parentElement
      expect(markAllButton?.querySelector('svg')).toBeInTheDocument()
    })
  })

  describe('初期データの処理', () => {
    it('20件以上の初期データがある場合nextCursorが設定される', () => {
      const notifications = Array.from({ length: 20 }, (_, i) => ({
        id: `${i + 1}`,
        type: 'like',
        isRead: true,
      }))

      mockUseInfiniteQuery.mockImplementation((config: { initialData: { pages: Array<{ nextCursor: string | undefined }> } }) => {
        // initialDataの検証
        expect(config.initialData.pages[0].nextCursor).toBe('20')
        return {
          data: { pages: [{ notifications, nextCursor: '20' }] },
          fetchNextPage: mockFetchNextPage,
          hasNextPage: true,
          isFetchingNextPage: false,
          isLoading: false,
          refetch: mockRefetch,
        }
      })

      render(<NotificationList initialNotifications={notifications} />)
    })

    it('20件未満の初期データがある場合nextCursorはundefined', () => {
      const notifications = Array.from({ length: 10 }, (_, i) => ({
        id: `${i + 1}`,
        type: 'like',
        isRead: true,
      }))

      mockUseInfiniteQuery.mockImplementation((config: { initialData: { pages: Array<{ nextCursor: string | undefined }> } }) => {
        // initialDataの検証
        expect(config.initialData.pages[0].nextCursor).toBeUndefined()
        return {
          data: { pages: [{ notifications, nextCursor: undefined }] },
          fetchNextPage: mockFetchNextPage,
          hasNextPage: false,
          isFetchingNextPage: false,
          isLoading: false,
          refetch: mockRefetch,
        }
      })

      render(<NotificationList initialNotifications={notifications} />)
    })
  })

  describe('dataがundefinedの場合', () => {
    it('dataがundefinedでも空配列として処理される', () => {
      mockUseInfiniteQuery.mockImplementation(() => ({
        data: undefined,
        fetchNextPage: mockFetchNextPage,
        hasNextPage: false,
        isFetchingNextPage: false,
        isLoading: false,
        refetch: mockRefetch,
      }))

      render(<NotificationList initialNotifications={[]} />)

      expect(screen.getByText('通知はありません')).toBeInTheDocument()
    })
  })

  describe('複数ページのフラット化', () => {
    it('複数ページの通知を正しくフラット化する', () => {
      const page1 = [{ id: '1', type: 'like', isRead: true }]
      const page2 = [{ id: '2', type: 'follow', isRead: true }]
      const page3 = [{ id: '3', type: 'comment', isRead: true }]

      mockUseInfiniteQuery.mockImplementation(() => ({
        data: {
          pages: [
            { notifications: page1, nextCursor: 'c1' },
            { notifications: page2, nextCursor: 'c2' },
            { notifications: page3, nextCursor: undefined },
          ],
        },
        fetchNextPage: mockFetchNextPage,
        hasNextPage: false,
        isFetchingNextPage: false,
        isLoading: false,
        refetch: mockRefetch,
      }))

      render(<NotificationList initialNotifications={page1} />)

      expect(screen.getByTestId('notification-1')).toBeInTheDocument()
      expect(screen.getByTestId('notification-2')).toBeInTheDocument()
      expect(screen.getByTestId('notification-3')).toBeInTheDocument()
    })
  })

  describe('queryFnの動作', () => {
    it('queryFnが正しいパラメータでgetNotificationsを呼び出す', async () => {
      mockGetNotifications.mockResolvedValue({ notifications: [], nextCursor: undefined })

      mockUseInfiniteQuery.mockImplementation((config: { queryFn: ({ pageParam }: { pageParam: string | undefined }) => Promise<unknown> }) => {
        // queryFnを実行してテスト
        config.queryFn({ pageParam: 'test-cursor' })
        return {
          data: undefined,
          fetchNextPage: mockFetchNextPage,
          hasNextPage: false,
          isFetchingNextPage: false,
          isLoading: false,
          refetch: mockRefetch,
        }
      })

      render(<NotificationList initialNotifications={[]} />)

      await waitFor(() => {
        expect(mockGetNotifications).toHaveBeenCalledWith('test-cursor')
      })
    })
  })
})
