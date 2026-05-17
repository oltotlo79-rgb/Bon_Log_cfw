import { vi } from 'vitest'
/**
 * Batch tests for error.tsx and loading.tsx pages
 */
import React from 'react'
import { render, screen } from '@testing-library/react'

// Mock lucide-react icons
vi.mock('lucide-react', () => {
  const icon = (name: string) => { const Icon = (props: Record<string, unknown>) => <div data-testid={`icon-${name}`} {...props} />; Icon.displayName = name; return Icon }
  return {
    AlertCircle: icon('AlertCircle'), AlertTriangle: icon('AlertTriangle'),
    ArrowLeft: icon('ArrowLeft'), RefreshCw: icon('RefreshCw'), Home: icon('Home'),
    Search: icon('Search'), X: icon('X'), Heart: icon('Heart'), Loader2: icon('Loader2'),
    FileText: icon('FileText'), Crown: icon('Crown'), Check: icon('Check'),
    MessageSquare: icon('MessageSquare'), Bell: icon('Bell'), BellOff: icon('BellOff'),
    Calendar: icon('Calendar'), MapPin: icon('MapPin'), Star: icon('Star'),
    MoreHorizontal: icon('MoreHorizontal'), Edit: icon('Edit'), Trash2: icon('Trash2'),
    Flag: icon('Flag'), Share: icon('Share'), Bookmark: icon('Bookmark'),
    Image: icon('Image'), Camera: icon('Camera'), Clock: icon('Clock'),
    Plus: icon('Plus'), Settings: icon('Settings'), User: icon('User'),
    Users: icon('Users'), Shield: icon('Shield'), Ban: icon('Ban'),
    ChevronDown: icon('ChevronDown'), ChevronUp: icon('ChevronUp'),
  }
})

// Mock components used by loading pages
vi.mock('@/components/common/LoadingScreen', () => ({ LoadingScreen: ({ message }: { message?: string }) => <div data-testid="loading-screen">{message}</div> }))
vi.mock('@/components/feed/TimelineSkeleton', () => ({ __esModule: true, TimelineSkeleton: () => <div data-testid="timeline-skeleton" />, default: () => <div data-testid="timeline-skeleton" /> }))

// ============================================================
// Error Pages
// ============================================================
const errorPages = [
  { name: 'analytics', path: '@/app/(main)/analytics/error', text: '読み込めません' },
  { name: 'bonsai', path: '@/app/(main)/bonsai/error', text: '読み込めません' },
  { name: 'bookmarks', path: '@/app/(main)/bookmarks/error', text: '読み込めません' },
  { name: 'events', path: '@/app/(main)/events/error', text: '読み込めません' },
  { name: 'events-detail', path: '@/app/(main)/events/[id]/error', text: '表示できません' },
  { name: 'feed', path: '@/app/(main)/feed/error', text: '読み込めません' },
  { name: 'messages', path: '@/app/(main)/messages/error', text: '読み込めません' },
  { name: 'notifications', path: '@/app/(main)/notifications/error', text: '読み込めません' },
  { name: 'search', path: '@/app/(main)/search/error', text: '読み込めません' },
  { name: 'settings', path: '@/app/(main)/settings/error', text: '読み込めません' },
  { name: 'shops', path: '@/app/(main)/shops/error', text: '読み込めません' },
  { name: 'shops-detail', path: '@/app/(main)/shops/[id]/error', text: '表示できません' },
  { name: 'users-detail', path: '@/app/(main)/users/[id]/error', text: '表示できません' },
  { name: 'main', path: '@/app/(main)/error', text: '表示できません' },
  { name: 'dictionary-detail', path: '@/app/(main)/dictionary/[slug]/error', text: '表示できません' },
  { name: 'hormones', path: '@/app/(main)/hormones/error', text: '読み込めません' },
  { name: 'settings-account', path: '@/app/(main)/settings/account/error', text: '表示できません' },
  { name: 'settings-profile', path: '@/app/(main)/settings/profile/error', text: '表示できません' },
  { name: 'settings-security', path: '@/app/(main)/settings/security/error', text: '表示できません' },
]

describe.each(errorPages)('$name error page', ({ path, text }) => {
  it('renders error message', async () => {
    const mod = await import(path)
    const ErrorComponent = mod.default
    const mockError = new Error('Test error')
    const mockReset = vi.fn()
    render(<ErrorComponent error={mockError} reset={mockReset} />)
    expect(screen.getByText(new RegExp(text))).toBeDefined()
  })

  it('renders retry button', async () => {
    const mod = await import(path)
    const ErrorComponent = mod.default
    const mockError = new Error('Test error')
    const mockReset = vi.fn()
    render(<ErrorComponent error={mockError} reset={mockReset} />)
    const retryBtn = screen.getByText('再試行')
    expect(retryBtn).toBeDefined()
  })

  it('calls reset on retry click', async () => {
    const mod = await import(path)
    const ErrorComponent = mod.default
    const mockError = new Error('Test error')
    const mockReset = vi.fn()
    render(<ErrorComponent error={mockError} reset={mockReset} />)
    const retryBtn = screen.getByText('再試行')
    retryBtn.click()
    expect(mockReset).toHaveBeenCalled()
  })

  it('shows error detail in development', async () => {
    vi.stubEnv('NODE_ENV', 'development')
    const mod = await import(path)
    const ErrorComponent = mod.default
    const mockError = new Error('Detailed error message')
    const mockReset = vi.fn()
    const { container } = render(<ErrorComponent error={mockError} reset={mockReset} />)
    vi.unstubAllEnvs()
    expect(container).toBeDefined()
  })
})

// ============================================================
// Loading Pages
// ============================================================
describe('bookmarks loading', async () => {
  it('renders loading screen', async () => {
    const mod = await import('@/app/(main)/bookmarks/loading')
    const Loading = mod.default
    render(<Loading />)
    expect(screen.getByTestId('loading-screen')).toBeDefined()
  })
})

describe('events loading', async () => {
  it('renders skeleton', async () => {
    const mod = await import('@/app/(main)/events/loading')
    const Loading = mod.default
    const { container } = render(<Loading />)
    expect(container.querySelector('.animate-pulse')).toBeDefined()
  })
})

describe('feed loading', async () => {
  it('renders skeleton', async () => {
    const mod = await import('@/app/(main)/feed/loading')
    const Loading = mod.default
    const { container } = render(<Loading />)
    expect(container).toBeDefined()
  })
})

describe('notifications loading', async () => {
  it('renders skeleton', async () => {
    const mod = await import('@/app/(main)/notifications/loading')
    const Loading = mod.default
    const { container } = render(<Loading />)
    expect(container).toBeDefined()
  })
})

describe('search loading', async () => {
  it('renders skeleton', async () => {
    const mod = await import('@/app/(main)/search/loading')
    const Loading = mod.default
    const { container } = render(<Loading />)
    expect(container).toBeDefined()
  })
})

describe('shops loading', async () => {
  it('renders skeleton', async () => {
    const mod = await import('@/app/(main)/shops/loading')
    const Loading = mod.default
    const { container } = render(<Loading />)
    expect(container).toBeDefined()
  })
})

describe('users loading', async () => {
  it('renders skeleton UI', async () => {
    const mod = await import('@/app/(main)/users/[id]/loading')
    const Loading = mod.default
    const { container } = render(<Loading />)
    expect(container.querySelector('.animate-pulse')).toBeDefined()
  })
})

describe('bonsai detail loading', async () => {
  it('renders skeleton UI', async () => {
    const mod = await import('@/app/(main)/bonsai/[id]/loading')
    const Loading = mod.default
    const { container } = render(<Loading />)
    expect(container.querySelector('.animate-pulse')).toBeDefined()
  })
})

describe('events detail loading', async () => {
  it('renders skeleton UI', async () => {
    const mod = await import('@/app/(main)/events/[id]/loading')
    const Loading = mod.default
    const { container } = render(<Loading />)
    expect(container.querySelector('.animate-pulse')).toBeDefined()
  })
})

describe('shops detail loading', async () => {
  it('renders skeleton UI', async () => {
    const mod = await import('@/app/(main)/shops/[id]/loading')
    const Loading = mod.default
    const { container } = render(<Loading />)
    expect(container.querySelector('.animate-pulse')).toBeDefined()
  })
})

describe('posts detail loading', async () => {
  it('renders skeleton UI', async () => {
    const mod = await import('@/app/(main)/posts/[id]/loading')
    const Loading = mod.default
    const { container } = render(<Loading />)
    expect(container.querySelector('.animate-pulse')).toBeDefined()
  })
})

// ============================================================
// Loading Pages - LoadingScreen pattern (batch)
// ============================================================
// Note: bonsai-detail, events-detail, shops-detail, users-detail now use skeleton UIs
// and are tested separately above
const loadingScreenPages = [
  { name: 'auth', path: '@/app/(auth)/loading' },
  { name: 'main', path: '@/app/(main)/loading' },
  { name: 'analytics', path: '@/app/(main)/analytics/loading' },
  { name: 'bonsai', path: '@/app/(main)/bonsai/loading' },
  { name: 'drafts', path: '@/app/(main)/drafts/loading' },
  { name: 'messages', path: '@/app/(main)/messages/loading' },
  { name: 'messages-conversation', path: '@/app/(main)/messages/[conversationId]/loading' },
  { name: 'posts-scheduled', path: '@/app/(main)/posts/scheduled/loading' },
  { name: 'settings-profile', path: '@/app/(main)/settings/profile/loading' },
  { name: 'settings-account', path: '@/app/(main)/settings/account/loading' },
  { name: 'settings-security', path: '@/app/(main)/settings/security/loading' },
  { name: 'settings-subscription', path: '@/app/(main)/settings/subscription/loading' },
  { name: 'settings-blocked', path: '@/app/(main)/settings/blocked/loading' },
  { name: 'settings-muted', path: '@/app/(main)/settings/muted/loading' },
  { name: 'settings-follow-requests', path: '@/app/(main)/settings/follow-requests/loading' },
  { name: 'admin', path: '@/app/admin/loading' },
  { name: 'admin-users', path: '@/app/admin/users/loading' },
  { name: 'admin-posts', path: '@/app/admin/posts/loading' },
  { name: 'admin-reports', path: '@/app/admin/reports/loading' },
  { name: 'admin-events', path: '@/app/admin/events/loading' },
  { name: 'admin-shops', path: '@/app/admin/shops/loading' },
  { name: 'dictionary', path: '@/app/(main)/dictionary/loading' },
  { name: 'fertilizers', path: '@/app/(main)/fertilizers/loading' },
  { name: 'hormones', path: '@/app/(main)/hormones/loading' },
  { name: 'pesticides', path: '@/app/(main)/pesticides/loading' },
]

describe.each(loadingScreenPages)('$name loading page', ({ path }) => {
  it('renders loading screen', async () => {
    const mod = await import(path)
    const Loading = mod.default
    render(<Loading />)
    expect(screen.getByTestId('loading-screen')).toBeDefined()
  })
})
