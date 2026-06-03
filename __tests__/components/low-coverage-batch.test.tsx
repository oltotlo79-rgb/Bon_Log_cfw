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
  it('未ミュート時はミュート操作のラベルを表示する', async () => {
    const { ThreadMuteButton } = await import('@/components/comment/ThreadMuteButton')
    render(<ThreadMuteButton rootCommentId="c1" initialMuted={false} />)
    expect(screen.getByRole('button', { name: 'スレッド通知をミュート' })).toBeInTheDocument()
  })

  it('ミュート済み時は解除操作のラベルを表示する', async () => {
    const { ThreadMuteButton } = await import('@/components/comment/ThreadMuteButton')
    render(<ThreadMuteButton rootCommentId="c1" initialMuted={true} />)
    expect(screen.getByRole('button', { name: 'スレッド通知をオンにする' })).toBeInTheDocument()
  })
})

// ============================================================
// NotificationBadge
// ============================================================
describe('NotificationBadge', async () => {
  it('未読が0件のときはバッジを描画しない', async () => {
    // モックの getUnreadCount は count:0 を返すため、バッジ span は出力されない
    const { NotificationBadge } = await import('@/components/notification/NotificationBadge')
    const { container } = render(<NotificationBadge />)
    expect(container.querySelector('span')).toBeNull()
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

  it('共有ボタン群を描画する', async () => {
    const { ShareButtons } = await import('@/components/post/ShareButtons')
    render(<ShareButtons url="/posts/p1" title="Test post" />)
    const btns = screen.getAllByRole('button')
    expect(btns.length).toBeGreaterThan(0)
  })
})

// ============================================================
// Comment & Common index exports
// ============================================================

describe('common/index re-exports', async () => {
  it('消費側が依存する名前付きエクスポートを再公開する', async () => {
    const mod = await import('@/components/common/index')
    expect(mod.FormError).toBeDefined()
    expect(mod.PageError).toBeDefined()
    expect(mod.SkipLink).toBeDefined()
  })
})

// ============================================================
// Ads index exports
// ============================================================
describe('ads/index re-exports', async () => {
  it('主要な広告コンポーネントを再公開する', async () => {
    const mod = await import('@/components/ads/index')
    expect(mod.GoogleAdSense).toBeDefined()
    expect(mod.AdBanner).toBeDefined()
    expect(mod.AdProvider).toBeDefined()
  })
})
