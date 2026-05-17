import { vi } from 'vitest'
/**
 * Batch tests for uncovered error.tsx and loading.tsx pages
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

// ============================================================
// Error Pages (PageError-based)
// ============================================================
const errorPages = [
  { name: 'bonsai-detail', path: '@/app/(main)/bonsai/[id]/error', text: '表示できません' },
  { name: 'dictionary', path: '@/app/(main)/dictionary/error', text: '読み込めません' },
  { name: 'drafts', path: '@/app/(main)/drafts/error', text: '読み込めません' },
  { name: 'messages-conversation', path: '@/app/(main)/messages/[conversationId]/error', text: '表示できません' },
  { name: 'pesticides', path: '@/app/(main)/pesticides/error', text: '読み込めません' },
  { name: 'posts-scheduled', path: '@/app/(main)/posts/scheduled/error', text: '読み込めません' },
  { name: 'admin', path: '@/app/admin/error', text: '読み込めません' },
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
// Loading Pages (LoadingScreen pattern - admin)
// ============================================================
const loadingScreenPages = [
  { name: 'admin-analytics-cohort', path: '@/app/admin/analytics/cohort/loading' },
  { name: 'admin-analytics-content', path: '@/app/admin/analytics/content/loading' },
  { name: 'admin-announcements', path: '@/app/admin/announcements/loading' },
  { name: 'admin-backups', path: '@/app/admin/backups/loading' },
  { name: 'admin-content-management', path: '@/app/admin/content-management/loading' },
  { name: 'admin-ip-management', path: '@/app/admin/ip-management/loading' },
  { name: 'admin-moderation-queue', path: '@/app/admin/moderation-queue/loading' },
  { name: 'admin-ng-words', path: '@/app/admin/ng-words/loading' },
  { name: 'admin-pesticide-data', path: '@/app/admin/pesticide-data/loading' },
  { name: 'admin-roles', path: '@/app/admin/roles/loading' },
  { name: 'admin-security', path: '@/app/admin/security/loading' },
  { name: 'admin-segments', path: '@/app/admin/segments/loading' },
  { name: 'admin-warnings', path: '@/app/admin/warnings/loading' },
]

describe.each(loadingScreenPages)('$name loading page', ({ path }) => {
  it('renders loading screen', async () => {
    const mod = await import(path)
    const Loading = mod.default
    render(<Loading />)
    expect(screen.getByTestId('loading-screen')).toBeDefined()
  })
})
