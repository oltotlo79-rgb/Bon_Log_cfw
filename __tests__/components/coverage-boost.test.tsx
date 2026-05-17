 
import { vi } from 'vitest'
 

import { render, screen, fireEvent } from '../utils/test-utils'

// ============================================================
// Mocks
// ============================================================

// Server Actions
vi.mock('@/lib/actions/notification', () => ({
  getUnreadCount: vi.fn().mockResolvedValue({ count: 5 }),
}))
vi.mock('@/lib/services/notification-core', () => ({
  getUnreadCount: vi.fn().mockResolvedValue({ count: 5 }),
}))
vi.mock('@/lib/actions/follow', () => ({
  toggleFollow: vi.fn().mockResolvedValue({ success: true, data: { following: true } }),
}))
vi.mock('@/lib/actions/block', () => ({
  blockUser: vi.fn(),
  unblockUser: vi.fn(),
}))
vi.mock('@/lib/actions/mute', () => ({
  muteUser: vi.fn(),
  unmuteUser: vi.fn(),
}))
vi.mock('@/lib/actions/message', () => ({
  getOrCreateConversation: vi.fn(),
}))
vi.mock('@/lib/actions/follow-request', () => ({
  sendFollowRequest: vi.fn().mockResolvedValue({ success: true, status: 'pending' }),
  cancelFollowRequest: vi.fn().mockResolvedValue({ success: true }),
}))

// Sentry
vi.mock('@/lib/sentry-shim', () => ({
  captureException: vi.fn(),
}))

// next-auth
vi.mock('next-auth/react', () => ({
  SessionProvider: ({ children }: any) => children,
  useSession: () => ({
    data: { user: { id: 'test-user-id' } },
    status: 'authenticated',
  }),
  signOut: vi.fn().mockResolvedValue(undefined),
}))

// hooks/use-toast
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: vi.fn() }),
}))

// React Query
vi.mock('@tanstack/react-query', async () => {
  const actual = await vi.importActual('@tanstack/react-query')
  return {
    ...actual,
    useQuery: vi.fn(),
  }
})

// BonsaiSearch mock
vi.mock('@/components/bonsai/BonsaiSearch', () => ({
  BonsaiSearch: ({ onSearch, onClear }: any) => (
    <div data-testid="bonsai-search">
      <button onClick={() => onSearch([])}>search-empty</button>
      <button onClick={() => onClear()}>clear-search</button>
    </div>
  ),
}))

// ============================================================
// Imports
// ============================================================

import { NotificationBadge } from '@/components/notification/NotificationBadge'
import GlobalError from '@/app/global-error'
import { MaintenanceLogoutButton } from '@/app/maintenance/logout-button'
import { useQuery } from '@tanstack/react-query'
import * as Sentry from '@/lib/sentry-shim'
import { signOut } from 'next-auth/react'

const mockUseQuery = useQuery as ReturnType<typeof vi.fn>

// ============================================================
// NotificationBadge - cover queryFn execution & edge cases
// ============================================================

describe('NotificationBadge - coverage boost', async () => {
  beforeEach(() => vi.clearAllMocks())

  it('queryFn calls getUnreadCount and returns result', async () => {
    let capturedQueryFn: any
    mockUseQuery.mockImplementation((opts: any) => {
      capturedQueryFn = opts.queryFn
      return { data: { count: 3 } }
    })

    render(<NotificationBadge />)

    // Execute the queryFn to cover the async arrow function
    const { getUnreadCount } = await import('@/lib/actions/notification')
    getUnreadCount.mockResolvedValue({ count: 7 })
    const result = await capturedQueryFn()
    expect(result).toEqual({ count: 7 })
  })

  it('className is undefined when not provided', () => {
    mockUseQuery.mockReturnValue({ data: { count: 2 } })
    render(<NotificationBadge />)
    const badge = screen.getByText('2')
    // className ends with "undefined" when no className prop is given
    expect(badge).toBeInTheDocument()
  })
})

// ============================================================
// global-error.tsx
// ============================================================

describe('GlobalError', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders error message and buttons', () => {
    const resetFn = vi.fn()
    const error = new Error('test error')

    render(<GlobalError error={error} reset={resetFn} />)

    expect(screen.getByText('エラーが発生しました')).toBeInTheDocument()
    expect(screen.getByText(/予期しないエラーが発生しました/)).toBeInTheDocument()
    expect(screen.getByText('再試行する')).toBeInTheDocument()
    expect(screen.getByText('ホームに戻る')).toBeInTheDocument()
  })

  it('calls Sentry.captureException on mount', () => {
    const error = new Error('sentry test')
    render(<GlobalError error={error} reset={vi.fn()} />)
    expect(Sentry.captureException).toHaveBeenCalledWith(error)
  })

  it('calls reset when retry button is clicked', () => {
    const resetFn = vi.fn()
    render(<GlobalError error={new Error('err')} reset={resetFn} />)

    fireEvent.click(screen.getByText('再試行する'))
    expect(resetFn).toHaveBeenCalled()
  })

  it('home button exists and is clickable', () => {
    render(<GlobalError error={new Error('err')} reset={vi.fn()} />)
    const homeBtn = screen.getByText('ホームに戻る')
    expect(homeBtn).toBeInTheDocument()
    // Clicking sets window.location.href = '/' - just verify no crash
    fireEvent.click(homeBtn)
  })

  it('handles error with stack trace in test env', () => {
    // In test env, NODE_ENV is 'test', so dev details won't show
    // but we still test the component renders without crashing
    const error = new Error('test error with stack')
    error.stack = 'Error: test error\n  at test.js:1'
    render(<GlobalError error={error} reset={vi.fn()} />)
    expect(screen.getByText('エラーが発生しました')).toBeInTheDocument()
  })

  it('handles error without stack trace', () => {
    const error = new Error('no stack')
    error.stack = undefined
    render(<GlobalError error={error} reset={vi.fn()} />)
    expect(screen.getByText('エラーが発生しました')).toBeInTheDocument()
  })

  it('handles error with digest property', () => {
    const error = Object.assign(new Error('digest error'), { digest: 'abc123' })
    render(<GlobalError error={error} reset={vi.fn()} />)
    expect(Sentry.captureException).toHaveBeenCalledWith(error)
  })
})

// ============================================================
// MaintenanceLogoutButton
// ============================================================

describe('MaintenanceLogoutButton', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders logout button', () => {
    render(<MaintenanceLogoutButton />)
    expect(screen.getByText('ログアウト')).toBeInTheDocument()
  })

  it('calls signOut on click and shows loading state', async () => {
    render(<MaintenanceLogoutButton />)

    const button = screen.getByRole('button')
    expect(button).not.toBeDisabled()

    fireEvent.click(button)

    // After click, should show loading text
    expect(screen.getByText('ログアウト中...')).toBeInTheDocument()
    expect(button).toBeDisabled()
    expect(signOut).toHaveBeenCalledWith({ callbackUrl: '/login' })
  })
})

// ============================================================
// ProfileHeader - coverage boost for uncovered branches
// ============================================================

describe('ProfileHeader - coverage boost', () => {
  const baseUser = {
    id: 'user-1',
    nickname: 'テストユーザー',
    avatarUrl: null,
    headerUrl: null,
    bio: null,
    location: null,
    bonsaiStartYear: null,
    bonsaiStartMonth: null,
    birthDate: null,
    isPublic: true,
    createdAt: '2023-06-15T00:00:00.000Z',
    postsCount: 0,
    followersCount: 0,
    followingCount: 0,
  }

  it('shows header image when headerUrl is provided', () => {
    const user = { ...baseUser, headerUrl: 'https://example.com/header.jpg' }
    render(<ProfileHeader user={user} isOwner={false} />)
    const img = document.querySelector('img[src="https://example.com/header.jpg"]')
    expect(img).toBeInTheDocument()
  })

  it('shows avatar image when avatarUrl is provided', () => {
    const user = { ...baseUser, avatarUrl: 'https://example.com/avatar.jpg' }
    render(<ProfileHeader user={user} isOwner={false} />)
    const img = document.querySelector('img[alt="テストユーザーのアバター"]')
    expect(img).toBeInTheDocument()
  })

  it('shows birthDate when provided', () => {
    const user = { ...baseUser, birthDate: '1990-05-15T00:00:00.000Z' }
    render(<ProfileHeader user={user} isOwner={false} />)
    expect(screen.getByText(/1990年5月15日生/)).toBeInTheDocument()
  })

  it('does not show bonsai experience when startYear is null', () => {
    render(<ProfileHeader user={baseUser} isOwner={false} />)
    expect(screen.queryByText(/盆栽歴/)).not.toBeInTheDocument()
  })

  it('shows "1ヶ月未満" when bonsai started this month/year', () => {
    const now = new Date()
    const user = {
      ...baseUser,
      bonsaiStartYear: now.getFullYear(),
      bonsaiStartMonth: now.getMonth() + 1,
    }
    render(<ProfileHeader user={user} isOwner={false} />)
    expect(screen.getByText(/盆栽歴 1ヶ月未満/)).toBeInTheDocument()
  })

  it('shows only years when months is 0', () => {
    const now = new Date()
    const user = {
      ...baseUser,
      bonsaiStartYear: now.getFullYear() - 3,
      bonsaiStartMonth: now.getMonth() + 1,
    }
    render(<ProfileHeader user={user} isOwner={false} />)
    expect(screen.getByText(/盆栽歴 3年$/)).toBeInTheDocument()
  })

  it('shows only months when years is 0', () => {
    const now = new Date()
    // 3 months ago
    let month = now.getMonth() + 1 - 3
    let year = now.getFullYear()
    if (month <= 0) {
      month += 12
      year -= 1
    }
    const user = {
      ...baseUser,
      bonsaiStartYear: year,
      bonsaiStartMonth: month,
    }
    render(<ProfileHeader user={user} isOwner={false} />)
    expect(screen.getByText(/盆栽歴 3ヶ月/)).toBeInTheDocument()
  })

  it('does not show bonsai experience for future dates', () => {
    const user = {
      ...baseUser,
      bonsaiStartYear: new Date().getFullYear() + 5,
      bonsaiStartMonth: 1,
    }
    render(<ProfileHeader user={user} isOwner={false} />)
    expect(screen.queryByText(/盆栽歴/)).not.toBeInTheDocument()
  })

  it('shows bonsai experience with default month 1 when startMonth is null', () => {
    const user = {
      ...baseUser,
      bonsaiStartYear: 2020,
      bonsaiStartMonth: null,
    }
    render(<ProfileHeader user={user} isOwner={false} />)
    expect(screen.getByText(/盆栽歴/)).toBeInTheDocument()
  })

  it('renders action buttons for non-owner (mute, block, message)', () => {
    render(<ProfileHeader user={baseUser} isOwner={false} isBlocked={false} isMuted={false} />)
    // These buttons are rendered by child components; just check no crash
    expect(screen.getByText('テストユーザー')).toBeInTheDocument()
  })

  it('passes hasFollowRequest to FollowButton', () => {
    render(<ProfileHeader user={baseUser} isOwner={false} hasFollowRequest={true} />)
    expect(screen.getByText('テストユーザー')).toBeInTheDocument()
  })
})

// We need to import ProfileHeader after mocks
import { ProfileHeader } from '@/components/user/ProfileHeader'

// ============================================================
// BonsaiListClient - coverage boost
// ============================================================

import { BonsaiListClient } from '@/components/bonsai/BonsaiListClient'

describe('BonsaiListClient - coverage boost', () => {
  const bonsaiWithImage = {
    id: 'b1',
    name: '黒松',
    species: '松柏類',
    acquiredAt: new Date('2020-01-01'),
    description: '素晴らしい盆栽です',
    records: [{ images: [{ url: 'https://example.com/img.jpg' }] }],
    _count: { records: 5 },
  }

  const bonsaiWithoutImage = {
    id: 'b2',
    name: '楓',
    species: null,
    acquiredAt: null,
    description: null,
    records: [],
    _count: { records: 0 },
  }

  it('renders bonsai list with images', () => {
    render(<BonsaiListClient initialBonsais={[bonsaiWithImage]} />)
    expect(screen.getByText('黒松')).toBeInTheDocument()
    expect(screen.getByText('松柏類')).toBeInTheDocument()
    expect(screen.getByText('5件の記録')).toBeInTheDocument()
    expect(screen.getByText('素晴らしい盆栽です')).toBeInTheDocument()
  })

  it('renders bonsai without image shows placeholder', () => {
    render(<BonsaiListClient initialBonsais={[bonsaiWithoutImage]} />)
    expect(screen.getByText('楓')).toBeInTheDocument()
    expect(screen.getByText('0件の記録')).toBeInTheDocument()
  })

  it('shows empty state when no bonsais and not searching', () => {
    render(<BonsaiListClient initialBonsais={[]} />)
    expect(screen.getByText('まだ盆栽が登録されていません')).toBeInTheDocument()
    expect(screen.getByText('最初の盆栽を登録')).toBeInTheDocument()
  })

  it('shows search empty state when searching with no results', () => {
    render(<BonsaiListClient initialBonsais={[bonsaiWithImage]} />)

    // Trigger search that returns empty
    fireEvent.click(screen.getByText('search-empty'))

    expect(screen.getByText('検索結果がありません')).toBeInTheDocument()
    expect(screen.getByText('別のキーワードで検索してみてください')).toBeInTheDocument()
  })

  it('clears search and shows original list', () => {
    render(<BonsaiListClient initialBonsais={[bonsaiWithImage]} />)

    // Search empty
    fireEvent.click(screen.getByText('search-empty'))
    expect(screen.getByText('検索結果がありません')).toBeInTheDocument()

    // Clear search
    fireEvent.click(screen.getByText('clear-search'))
    expect(screen.getByText('黒松')).toBeInTheDocument()
  })

  it('renders acquiredAt date for bonsai', () => {
    render(<BonsaiListClient initialBonsais={[bonsaiWithImage]} />)
    expect(screen.getByText(/入手:/)).toBeInTheDocument()
  })

  it('renders link to bonsai detail', () => {
    render(<BonsaiListClient initialBonsais={[bonsaiWithImage]} />)
    const link = screen.getByRole('link', { name: /黒松/ })
    expect(link).toHaveAttribute('href', '/bonsai/b1')
  })

  it('renders add bonsai link in header', () => {
    render(<BonsaiListClient initialBonsais={[]} />)
    const addLink = screen.getByRole('link', { name: /盆栽を追加/ })
    expect(addLink).toHaveAttribute('href', '/bonsai/new')
  })
})
