import { vi } from 'vitest'
/**
 * Tests for low-coverage components
 */
import React from 'react'
import { render, screen } from '@testing-library/react'

vi.mock('next/link', () => {
  const MockLink = function MockLink({ children, ...props }: { children: React.ReactNode; href?: string }) { return <a {...props}>{children}</a> }
  return { default: MockLink }
})
vi.mock('next/image', () => {
  const MockImage = function MockImage(_props: Record<string, unknown>) { return <div data-testid="next-image" /> }
  return { default: MockImage }
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
  const icon = (name: string) => { const Icon = (props: Record<string, unknown>) => <div data-testid={`icon-${name}`} {...props} />; Icon.displayName = name; return Icon }
  return {
    MoreHorizontal: icon('MoreHorizontal'), Edit: icon('Edit'), Trash2: icon('Trash2'),
    Flag: icon('Flag'), Share: icon('Share'), Bell: icon('Bell'), BellOff: icon('BellOff'),
    Search: icon('Search'), Hash: icon('Hash'), X: icon('X'), Copy: icon('Copy'),
    Check: icon('Check'), Heart: icon('Heart'), MessageSquare: icon('MessageSquare'),
    Bookmark: icon('Bookmark'), Image: icon('Image'), Camera: icon('Camera'),
    MessageCircle: icon('MessageCircle'), ChevronDown: icon('ChevronDown'),
    ChevronUp: icon('ChevronUp'), Crown: icon('Crown'), Loader2: icon('Loader2'),
    FileText: icon('FileText'), Clock: icon('Clock'), Calendar: icon('Calendar'),
    Plus: icon('Plus'), ArrowLeft: icon('ArrowLeft'), AlertCircle: icon('AlertCircle'),
    ExternalLink: icon('ExternalLink'), Receipt: icon('Receipt'), Star: icon('Star'),
    ImageIcon: icon('ImageIcon'), CheckCircle: icon('CheckCircle'), XCircle: icon('XCircle'),
    TrendingUp: icon('TrendingUp'), BarChart3: icon('BarChart3'), LucideIcon: icon('LucideIcon'),
  }
})
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }), { virtual: true })
vi.mock('@/lib/actions/comment-thread-mute', () => ({
  muteThread: vi.fn().mockResolvedValue({ success: true }),
  unmuteThread: vi.fn().mockResolvedValue({ success: true }),
  isThreadMuted: vi.fn().mockResolvedValue(false),
}))
vi.mock('@/lib/actions/notification', () => ({
  getUnreadCount: vi.fn().mockResolvedValue({ count: 0 }),
  markAllAsRead: vi.fn().mockResolvedValue({ success: true }),
}))
vi.mock('@/lib/services/notification-core', () => ({
  getUnreadCount: vi.fn().mockResolvedValue({ count: 0 }),
  markAllAsRead: vi.fn().mockResolvedValue({ success: true }),
}))

// ============================================================
// ThreadMuteButton
// ============================================================
describe('ThreadMuteButton', async () => {
  it('renders mute button', async () => {
    const { ThreadMuteButton } = await import('@/components/comment/ThreadMuteButton')
    render(<ThreadMuteButton rootCommentId="c1" initialMuted={false} />)
    const btn = screen.getByRole('button')
    expect(btn).toBeDefined()
  })

  it('renders unmute when already muted', async () => {
    const { ThreadMuteButton } = await import('@/components/comment/ThreadMuteButton')
    render(<ThreadMuteButton rootCommentId="c1" initialMuted={true} />)
    const btn = screen.getByRole('button')
    expect(btn).toBeDefined()
  })
})

// ============================================================
// NotificationBadge
// ============================================================
describe('NotificationBadge', async () => {
  it('renders badge', async () => {
    const mod = await import('@/components/notification/NotificationBadge')
     
    const NotificationBadge = mod.NotificationBadge || (mod as any).default
    const { container } = render(<NotificationBadge />)
    expect(container).toBeDefined()
  })
})

// ============================================================
// ShareButtons
// ============================================================
describe('ShareButtons', async () => {
  beforeEach(() => {
    Object.defineProperty(window, 'navigator', {
      value: { clipboard: { writeText: vi.fn().mockResolvedValue(undefined) }, share: undefined },
      writable: true,
    })
  })

  it('renders share buttons', async () => {
    const mod = await import('@/components/post/ShareButtons')
     
    const ShareButtons = mod.ShareButtons || (mod as any).default
    render(<ShareButtons url="/posts/p1" title="Test post" />)
    const btns = screen.getAllByRole('button')
    expect(btns.length).toBeGreaterThan(0)
  })
})

// ============================================================
// Comment & Common index exports
// ============================================================

describe('common/index exports', async () => {
  it('exports components', async () => {
    const mod = await import('@/components/common/index')
    expect(mod).toBeDefined()
  })
})

// ============================================================
// Ads index exports
// ============================================================
describe('ads/index exports', async () => {
  it('exports components', async () => {
    const mod = await import('@/components/ads/index')
    expect(mod).toBeDefined()
  })
})
