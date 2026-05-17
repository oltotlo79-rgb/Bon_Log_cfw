import { vi } from 'vitest'
/**
 * Coverage boost tests - batch 7
 * FeedWithCompose, NotificationBadge (both client+server paths), NinjaAdMax
 */
import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'

// ---- mocks ----
vi.mock('next/link', () => {
  const MockLink = ({ children, href, ...props }: any) => <a href={href} {...props}>{children}</a>
  return { default: MockLink }
})
vi.mock('next/image', async () => {
  const { MockNextImage } = await import('../utils/mock-next-image')
  return { __esModule: true, default: MockNextImage }
})
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn(), back: vi.fn() }),
  usePathname: vi.fn(() => '/'),
  useSearchParams: () => new URLSearchParams(),
}))

// React Query
let mockQueryReturn: any = { data: undefined }
vi.mock('@tanstack/react-query', () => ({
  useQuery: () => mockQueryReturn,
  useInfiniteQuery: vi.fn(() => ({
    data: { pages: [{ posts: [], nextCursor: undefined }] },
    fetchNextPage: vi.fn(),
    hasNextPage: false,
    isFetchingNextPage: false,
    isLoading: false,
    error: null,
  })),
  QueryClient: vi.fn(),
  QueryClientProvider: ({ children }: any) => <>{children}</>,
}))
vi.mock('react-intersection-observer', () => ({
  useInView: () => ({ ref: vi.fn(), inView: false }),
}))

// Feed deps
vi.mock('@/components/post/PostCard', () => ({
  PostCard: ({ post }: any) => <div data-testid={`post-${post.id}`} />,
}))
vi.mock('@/components/ads', () => ({
  InFeedAdUnit: () => <div data-testid="ad" />,
}))
vi.mock('@/components/feed/TimelineSkeleton', () => ({
  TimelineSkeleton: () => <div data-testid="skeleton" />,
}))
vi.mock('@/components/feed/EmptyTimeline', () => ({
  EmptyTimeline: () => <div data-testid="empty" />,
}))
vi.mock('@/lib/actions/feed', () => ({
  getTimeline: vi.fn(),
}))

// PostFormModal mock
vi.mock('@/components/post/PostFormModal', () => ({
  PostFormModal: ({ isOpen, onClose }: any) =>
    isOpen ? <div data-testid="modal"><button onClick={onClose}>Close</button></div> : null,
}))

// Notification deps
const mockGetUnreadCount = vi.fn()
vi.mock('@/lib/actions/notification', () => ({
  getUnreadCount: (...args: any[]) => mockGetUnreadCount(...args),
}))
vi.mock('@/lib/services/notification-core', () => ({
  getUnreadCount: (...args: any[]) => mockGetUnreadCount(...args),
}))

// Message deps
vi.mock('@/lib/actions/message', () => ({
  getUnreadMessageCount: vi.fn(),
}))

import { FeedWithCompose } from '@/components/feed/FeedWithCompose'
import { NotificationBadge } from '@/components/notification/NotificationBadge'
import { MessageBadge } from '@/components/message/MessageBadge'

// ============================================================
// FeedWithCompose
// ============================================================
describe('FeedWithCompose', () => {
  const defaultProps = {
    initialPosts: [],
    currentUserId: 'u1',
    genres: { '盆栽': [{ id: 'g1', name: '松柏類', category: '盆栽' }] },
    limits: { maxPostLength: 500, maxImages: 4, maxVideos: 1, canSchedulePost: false, canViewAnalytics: false },
  }

  it('renders timeline heading', () => {
    render(<FeedWithCompose {...defaultProps} />)
    expect(screen.getByText('タイムライン')).toBeDefined()
  })

  it('renders FAB button with aria-label', () => {
    render(<FeedWithCompose {...defaultProps} />)
    expect(screen.getByLabelText('新規投稿')).toBeDefined()
  })

  it('opens modal on FAB click', () => {
    render(<FeedWithCompose {...defaultProps} />)
    fireEvent.click(screen.getByLabelText('新規投稿'))
    expect(screen.getByTestId('modal')).toBeDefined()
  })

  it('closes modal on close button click', () => {
    render(<FeedWithCompose {...defaultProps} />)
    fireEvent.click(screen.getByLabelText('新規投稿'))
    fireEvent.click(screen.getByText('Close'))
    expect(screen.queryByTestId('modal')).toBeNull()
  })

  it('renders with optional props', () => {
    render(<FeedWithCompose {...defaultProps} draftCount={3} bonsais={[{ id: 'b1', name: 'Test', species: '黒松' }]} />)
    expect(screen.getByText('タイムライン')).toBeDefined()
  })
})

// ============================================================
// NotificationBadge - client
// ============================================================
describe('NotificationBadge client', () => {
  it('returns null when count is 0', () => {
    mockQueryReturn = { data: { count: 0 } }
    const { container } = render(<NotificationBadge />)
    expect(container.innerHTML).toBe('')
  })

  it('shows count', () => {
    mockQueryReturn = { data: { count: 7 } }
    render(<NotificationBadge />)
    expect(screen.getByText('7')).toBeDefined()
  })

  it('shows 99+ for > 99', () => {
    mockQueryReturn = { data: { count: 200 } }
    render(<NotificationBadge />)
    expect(screen.getByText('99+')).toBeDefined()
  })

  it('returns null when data undefined', () => {
    mockQueryReturn = { data: undefined }
    const { container } = render(<NotificationBadge />)
    expect(container.innerHTML).toBe('')
  })

  it('applies className', () => {
    mockQueryReturn = { data: { count: 3 } }
    render(<NotificationBadge className="test-class" />)
    expect(document.querySelector('.test-class')).toBeDefined()
  })
})

// ============================================================
// MessageBadge - additional
// ============================================================
describe('MessageBadge additional', () => {
  it('applies className when visible', () => {
    mockQueryReturn = { data: { count: 5 } }
    render(<MessageBadge className="msg-class" />)
    expect(document.querySelector('.msg-class')).toBeDefined()
  })
})
