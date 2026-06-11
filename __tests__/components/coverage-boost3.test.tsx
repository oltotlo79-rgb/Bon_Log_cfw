import { vi } from 'vitest'
/**
 * Coverage boost tests - batch 3
 * ShareButtons, EventActionsDropdown, NotificationBadge, PopularTags
 */
import React from 'react'
import { render, screen, fireEvent, act } from '@testing-library/react'

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
  useRouter: vi.fn(() => ({ push: vi.fn(), refresh: vi.fn(), back: vi.fn() })),
  usePathname: vi.fn(() => '/'),
  useSearchParams: vi.fn(() => new URLSearchParams()),
}))
vi.mock('next-auth/react', () => ({
  useSession: vi.fn(() => ({ data: { user: { id: 'u1', name: 'Test' } }, status: 'authenticated' })),
  signOut: vi.fn(),
}))
vi.mock('lucide-react', () => {
  const icon = (name: string) => { const Icon = (props: any) => <div data-testid={`icon-${name}`} {...props} />; Icon.displayName = name; return Icon }
  return {
    MoreHorizontal: icon('MoreHorizontal'),
    Edit: icon('Edit'),
    Trash2: icon('Trash2'),
    Flag: icon('Flag'),
    Share: icon('Share'),
    Bell: icon('Bell'),
    BellOff: icon('BellOff'),
    Search: icon('Search'),
    Hash: icon('Hash'),
    X: icon('X'),
    Copy: icon('Copy'),
    Check: icon('Check'),
  }
})
vi.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick, asChild, ...props }: any) => {
    if (asChild) return <>{children}</>
    return <button onClick={onClick} {...props}>{children}</button>
  },
}))

const mockGetUnreadCount = vi.fn()
vi.mock('@/lib/actions/notification', () => ({
  getUnreadCount: (...args: any[]) => mockGetUnreadCount(...args),
  markAllAsRead: vi.fn().mockResolvedValue({ success: true }),
}))
vi.mock('@/lib/services/notification-core', () => ({
  getUnreadCount: (...args: any[]) => mockGetUnreadCount(...args),
  markAllAsRead: vi.fn().mockResolvedValue({ success: true }),
}))
vi.mock('@tanstack/react-query', () => ({
  useQuery: (_opts: any) => {
    return { data: mockGetUnreadCount() }
  },
  useInfiniteQuery: vi.fn(() => ({
    data: undefined, fetchNextPage: vi.fn(), hasNextPage: false,
    isFetchingNextPage: false, isLoading: false, error: null,
  })),
  QueryClient: vi.fn(),
  QueryClientProvider: ({ children }: any) => <>{children}</>,
}))
vi.mock('react-intersection-observer', () => ({
  useInView: () => ({ ref: vi.fn(), inView: false }),
}))
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
vi.mock('@/lib/actions/search', () => ({
  searchPosts: vi.fn(),
  searchUsers: vi.fn(),
  searchByTag: vi.fn(),
}))
// Mock PostCard to avoid deep dependency chain (next/cache etc.)
vi.mock('@/components/post/PostCard', () => ({
  PostCard: (props: any) => <div data-testid="post-card">{props.post?.id}</div>,
}))

import { ShareButtons } from '@/components/post/ShareButtons'
import { EventActionsDropdown } from '@/components/event/EventActionsDropdown'
import { NotificationBadge } from '@/components/notification/NotificationBadge'
import { PopularTags, PostSearchResults, UserSearchResults, TagSearchResults } from '@/components/search/SearchResults'

// ============================================================
// ShareButtons
// ============================================================
describe('ShareButtons', () => {
  it('renders all 4 buttons', () => {
    render(<ShareButtons url="https://example.com/p/1" title="Test" />)
    expect(screen.getByLabelText('X(Twitter)でシェア')).toBeInTheDocument()
    expect(screen.getByLabelText('Facebookでシェア')).toBeInTheDocument()
    expect(screen.getByLabelText('LINEでシェア')).toBeInTheDocument()
    expect(screen.getByLabelText('リンクをコピー')).toBeInTheDocument()
  })

  it('opens share window on X button click', () => {
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null)
    render(<ShareButtons url="https://example.com" title="Test" />)
    fireEvent.click(screen.getByLabelText('X(Twitter)でシェア'))
    expect(openSpy).toHaveBeenCalledWith(
      expect.stringContaining('twitter.com/intent/tweet'),
      '_blank',
      expect.any(String)
    )
    openSpy.mockRestore()
  })

  it('opens share window on Facebook button click', () => {
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null)
    render(<ShareButtons url="https://example.com" title="Test" />)
    fireEvent.click(screen.getByLabelText('Facebookでシェア'))
    expect(openSpy).toHaveBeenCalledWith(
      expect.stringContaining('facebook.com/sharer'),
      '_blank',
      expect.any(String)
    )
    openSpy.mockRestore()
  })

  it('opens share window on LINE button click', () => {
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null)
    render(<ShareButtons url="https://example.com" title="Test" />)
    fireEvent.click(screen.getByLabelText('LINEでシェア'))
    expect(openSpy).toHaveBeenCalledWith(
      expect.stringContaining('line.me'),
      '_blank',
      expect.any(String)
    )
    openSpy.mockRestore()
  })

  it('copies link with clipboard API and shows copied state', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.assign(navigator, { clipboard: { writeText } })
    render(<ShareButtons url="https://example.com/p1" title="Test" />)

    await act(async () => {
      fireEvent.click(screen.getByLabelText('リンクをコピー'))
    })

    expect(writeText).toHaveBeenCalledWith('https://example.com/p1')
    expect(screen.getByText('コピー済')).toBeInTheDocument()
  })

  it('uses fallback when clipboard API fails', async () => {
    Object.assign(navigator, { clipboard: { writeText: vi.fn().mockRejectedValue(new Error('fail')) } })
    const execCommand = vi.fn()
    document.execCommand = execCommand

    render(<ShareButtons url="https://example.com/p1" title="Test" />)

    await act(async () => {
      fireEvent.click(screen.getByLabelText('リンクをコピー'))
    })

    expect(execCommand).toHaveBeenCalledWith('copy')
    expect(screen.getByText('コピー済')).toBeInTheDocument()
  })

  it('uses text prop when provided', () => {
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null)
    render(<ShareButtons url="https://example.com" title="Title" text="Custom text" />)
    fireEvent.click(screen.getByLabelText('X(Twitter)でシェア'))
    expect(openSpy).toHaveBeenCalledWith(
      expect.stringContaining(encodeURIComponent('Custom text')),
      '_blank',
      expect.any(String)
    )
    openSpy.mockRestore()
  })
})

// ============================================================
// EventActionsDropdown
// ============================================================
describe('EventActionsDropdown', () => {
  it('toggles menu on click', () => {
    render(<EventActionsDropdown eventId="e1" isOwner={true} />)
    const btn = screen.getByLabelText('イベント操作メニュー')
    expect(screen.queryByRole('menu')).toBeNull()
    fireEvent.click(btn)
    expect(screen.getByRole('menu')).toBeInTheDocument()
    fireEvent.click(btn)
    expect(screen.queryByRole('menu')).toBeNull()
  })

  it('shows edit and delete for owner', () => {
    render(<EventActionsDropdown eventId="e1" isOwner={true} />)
    fireEvent.click(screen.getByLabelText('イベント操作メニュー'))
    expect(screen.getByText('編集')).toBeInTheDocument()
    expect(screen.getByText('削除')).toBeInTheDocument()
  })

  it('shows report for non-owner', () => {
    render(<EventActionsDropdown eventId="e1" isOwner={false} />)
    fireEvent.click(screen.getByLabelText('イベント操作メニュー'))
    expect(screen.getByText('通報')).toBeInTheDocument()
  })

  it('calls onDelete when delete clicked', () => {
    const onDelete = vi.fn()
    render(<EventActionsDropdown eventId="e1" isOwner={true} onDelete={onDelete} />)
    fireEvent.click(screen.getByLabelText('イベント操作メニュー'))
    fireEvent.click(screen.getByText('削除'))
    expect(onDelete).toHaveBeenCalled()
  })

  it('calls onReport when report clicked', () => {
    const onReport = vi.fn()
    render(<EventActionsDropdown eventId="e1" isOwner={false} onReport={onReport} />)
    fireEvent.click(screen.getByLabelText('イベント操作メニュー'))
    fireEvent.click(screen.getByText('通報'))
    expect(onReport).toHaveBeenCalled()
  })

  it('copies share link on share click', () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.assign(navigator, { clipboard: { writeText } })
    render(<EventActionsDropdown eventId="e1" isOwner={true} />)
    fireEvent.click(screen.getByLabelText('イベント操作メニュー'))
    fireEvent.click(screen.getByText('共有'))
    expect(writeText).toHaveBeenCalledWith(expect.stringContaining('/events/e1'))
  })

  it('edit link points to correct href', () => {
    render(<EventActionsDropdown eventId="e1" isOwner={true} />)
    fireEvent.click(screen.getByLabelText('イベント操作メニュー'))
    const editLink = screen.getByText('編集').closest('a')
    expect(editLink?.getAttribute('href')).toBe('/events/e1/edit')
  })
})

// ============================================================
// NotificationBadge
// ============================================================
describe('NotificationBadge', () => {
  it('returns null when count is 0', () => {
    mockGetUnreadCount.mockReturnValue({ count: 0 })
    const { container } = render(<NotificationBadge />)
    expect(container.querySelector('span')).toBeNull()
  })

  it('shows count when > 0', () => {
    mockGetUnreadCount.mockReturnValue({ count: 5 })
    const { container } = render(<NotificationBadge />)
    expect(container.textContent).toContain('5')
  })

  it('shows 99+ when count > 99', () => {
    mockGetUnreadCount.mockReturnValue({ count: 150 })
    const { container } = render(<NotificationBadge />)
    expect(container.textContent).toContain('99+')
  })

  it('handles undefined data', () => {
    mockGetUnreadCount.mockReturnValue(undefined)
    const { container } = render(<NotificationBadge />)
    expect(container.querySelector('span')).toBeNull()
  })
})

// ============================================================
// PopularTags
// ============================================================
describe('PopularTags', () => {
  it('returns null for empty tags', () => {
    const { container } = render(<PopularTags tags={[]} />)
    expect(container.innerHTML).toBe('')
  })

  it('renders tags with counts', () => {
    render(<PopularTags tags={[
      { tag: '松柏類', count: 100 },
      { tag: '雑木類', count: 50 },
    ]} />)
    expect(screen.getByText('人気のタグ')).toBeInTheDocument()
    expect(screen.getByText('100')).toBeInTheDocument()
    expect(screen.getByText('50')).toBeInTheDocument()
  })

  it('links to search page with correct href', () => {
    const { container } = render(<PopularTags tags={[{ tag: '松柏類', count: 10 }]} />)
    const link = container.querySelector('a')
    expect(link?.getAttribute('href')).toContain('tab=tags')
    expect(link?.getAttribute('href')).toContain(encodeURIComponent('松柏類'))
  })
})

// ============================================================
// SearchResults components (with PostCard mocked)
// ============================================================
describe('PostSearchResults', () => {
  it('shows empty message when no posts', () => {
    render(<PostSearchResults query="notfound" initialPosts={[]} />)
    expect(screen.getByText(/投稿はありません|投稿が見つかりません/)).toBeInTheDocument()
  })

  it('shows generic empty message when no query', () => {
    render(<PostSearchResults query="" initialPosts={[]} />)
    expect(screen.getByText('投稿が見つかりません')).toBeInTheDocument()
  })
})

describe('UserSearchResults', () => {
  it('shows empty message when no users', () => {
    render(<UserSearchResults query="nobody" initialUsers={[]} />)
    expect(screen.getByText(/ユーザーはいません|ユーザーが見つかりません/)).toBeInTheDocument()
  })

  it('shows generic empty message when no query', () => {
    render(<UserSearchResults query="" initialUsers={[]} />)
    expect(screen.getByText('ユーザーが見つかりません')).toBeInTheDocument()
  })
})

describe('TagSearchResults', () => {
  it('shows empty message when no posts for tag', () => {
    render(<TagSearchResults tag="none" initialPosts={[]} />)
    expect(screen.getByText(/投稿はありません/)).toBeInTheDocument()
  })
})
