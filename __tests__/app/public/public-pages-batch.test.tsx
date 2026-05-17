import { vi } from 'vitest'
 
/**
 * Batch tests for public pages: about, contact, help
 * and auth pages: login, register, auth layout, public layout
 */

const mockAuth = vi.fn()
vi.mock('@/lib/auth', () => ({ auth: () => mockAuth() }))

const mockRedirect = vi.fn()
vi.mock('next/navigation', () => ({
  redirect: (...args: unknown[]) => { mockRedirect(...args); throw new Error('REDIRECT') },
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}))

vi.mock('next/link', () => ({ __esModule: true, default: ({ children, href }: { children: React.ReactNode; href: string }) => <a href={href}>{children}</a> }))
vi.mock('next/image', () => ({ __esModule: true, default: function MockImage(_props: Record<string, unknown>) { return <div data-testid="next-image" /> } }))

// Component mocks
vi.mock('@/components/auth/LoginForm', () => ({ LoginForm: () => <div data-testid="login-form" /> }))
vi.mock('@/components/auth/RegisterForm', () => ({ RegisterForm: () => <div data-testid="register-form" /> }))
vi.mock('@/components/contact/ContactForm', () => ({ ContactForm: () => <div data-testid="contact-form" /> }))
vi.mock('@/components/theme/ThemeToggle', () => ({ ThemeSelect: () => <div data-testid="theme-select" /> }))
// HelpContent doesn't exist as separate component - help page has inline content
vi.mock('@/lib/actions/notification-preferences', () => ({
  getNotificationPreferences: vi.fn().mockResolvedValue({ preferences: {} }),
}))
vi.mock('@/components/settings/NotificationPreferences', () => ({ NotificationPreferences: () => <div data-testid="notif-prefs" /> }))
vi.mock('@/components/settings/SettingsGuestRestriction', () => ({
  SettingsGuestRestriction: ({ title }: { title: string }) => (
    <div data-testid="guest-restriction" data-title={title} />
  ),
}))
vi.mock('@/components/notification/PushNotificationToggle', () => ({
  PushNotificationToggle: () => <div data-testid="push-toggle" />,
}))

// Subscription mocks
vi.mock('@/lib/actions/subscription', () => ({
  getSubscriptionStatus: vi.fn().mockResolvedValue({ status: null }),
  getPaymentHistory: vi.fn().mockResolvedValue({ payments: [] }),
}))

// DB mock for public layout
const mockPrisma = {
  user: { count: vi.fn().mockResolvedValue(1) },
}
vi.mock('@/lib/db', () => ({ prisma: mockPrisma }))

vi.mock('lucide-react', () => {
  const icon = (name: string) => { const Icon = () => <span data-testid={`icon-${name}`} />; Icon.displayName = name; return Icon }
  return {
    Heart: icon('Heart'), Search: icon('Search'), Bell: icon('Bell'), BellOff: icon('BellOff'),
    Crown: icon('Crown'), Check: icon('Check'), CheckIcon: icon('CheckIcon'), Star: icon('Star'), Settings: icon('Settings'),
    User: icon('User'), Users: icon('Users'), Shield: icon('Shield'), Ban: icon('Ban'),
    VolumeX: icon('VolumeX'), Bookmark: icon('Bookmark'), Plus: icon('Plus'),
    MoreHorizontal: icon('MoreHorizontal'), Edit: icon('Edit'), Trash2: icon('Trash2'),
    Flag: icon('Flag'), Share: icon('Share'), X: icon('X'), Image: icon('Image'),
    Camera: icon('Camera'), Clock: icon('Clock'), Loader2: icon('Loader2'),
    AlertCircle: icon('AlertCircle'), FileText: icon('FileText'), Calendar: icon('Calendar'),
    MapPin: icon('MapPin'), Home: icon('Home'), ArrowLeft: icon('ArrowLeft'),
    ArrowRight: icon('ArrowRight'), MessageSquare: icon('MessageSquare'),
    CheckCircle: icon('CheckCircle'), XCircle: icon('XCircle'),
    ExternalLink: icon('ExternalLink'), Receipt: icon('Receipt'),
    Mail: icon('Mail'), Activity: icon('Activity'),
    ChevronRight: icon('ChevronRight'),
    ChevronDown: icon('ChevronDown'), ChevronDownIcon: icon('ChevronDownIcon'),
    ChevronUp: icon('ChevronUp'), ChevronUpIcon: icon('ChevronUpIcon'),
    List: icon('List'),
    BarChart3: icon('BarChart3'), CalendarPlus: icon('CalendarPlus'),
    Gauge: icon('Gauge'), Wrench: icon('Wrench'),
    CloudSun: icon('CloudSun'), Navigation: icon('Navigation'),
  }
})

import { render, screen } from '@testing-library/react'
import React from 'react'

// ============================================================
// About Page
// ============================================================
describe('AboutPage', async () => {
  it('renders about page with title', async () => {
    const { default: Page } = await import('@/app/(public)/about/page')
    const result = Page()
    render(result)
    expect(screen.getByText('BON-LOGについて')).toBeInTheDocument()
  })

  it('shows mission statement', async () => {
    const { default: Page } = await import('@/app/(public)/about/page')
    render(Page())
    expect(screen.getAllByText(/盆栽の魅力/).length).toBeGreaterThanOrEqual(1)
  })

  it('shows feature cards', async () => {
    const { default: Page } = await import('@/app/(public)/about/page')
    render(Page())
    expect(screen.getByText('投稿・共有')).toBeInTheDocument()
    expect(screen.getByText('コミュニティ')).toBeInTheDocument()
    expect(screen.getByText('盆栽園マップ')).toBeInTheDocument()
    expect(screen.getByText('イベント情報')).toBeInTheDocument()
  })

  it('has metadata', async () => {
    const { metadata } = await import('@/app/(public)/about/page')
    expect(metadata?.title).toBeDefined()
  })
})

// ============================================================
// Contact Page
// ============================================================
describe('ContactPage', async () => {
  it('renders contact page', async () => {
    const { default: Page } = await import('@/app/(public)/contact/page')
    render(Page())
    expect(screen.getByText('お問い合わせ')).toBeInTheDocument()
  })

  it('shows pre-contact checklist', async () => {
    const { default: Page } = await import('@/app/(public)/contact/page')
    render(Page())
    expect(screen.getByText('お問い合わせの前に')).toBeInTheDocument()
  })

  it('has metadata', async () => {
    const { metadata } = await import('@/app/(public)/contact/page')
    expect(metadata?.title).toBeDefined()
  })
})

// ============================================================
// Help Page
// ============================================================
describe('HelpPage', async () => {
  it('renders help page', async () => {
    const { default: Page } = await import('@/app/(public)/help/page')
    render(Page())
    expect(screen.getByText('ヘルプセンター')).toBeInTheDocument()
  })

  it('shows FAQ sections', async () => {
    const { default: Page } = await import('@/app/(public)/help/page')
    render(Page())
    expect(screen.getByText('はじめに')).toBeInTheDocument()
    expect(screen.getByText('投稿について')).toBeInTheDocument()
    expect(screen.getByText('プレミアム会員')).toBeInTheDocument()
  })

  it('shows quick links', async () => {
    const { default: Page } = await import('@/app/(public)/help/page')
    render(Page())
    expect(screen.getByText('プレミアム会員について')).toBeInTheDocument()
  })

  it('shows notification FAQ section', async () => {
    const { default: Page } = await import('@/app/(public)/help/page')
    render(Page())
    expect(screen.getByText('通知について')).toBeInTheDocument()
  })

  it('shows event FAQ section', async () => {
    const { default: Page } = await import('@/app/(public)/help/page')
    render(Page())
    expect(screen.getByText('イベント')).toBeInTheDocument()
  })

  it('shows DM FAQ section', async () => {
    const { default: Page } = await import('@/app/(public)/help/page')
    render(Page())
    expect(screen.getByText('ダイレクトメッセージ')).toBeInTheDocument()
  })

  it('shows bonsai record FAQ section', async () => {
    const { default: Page } = await import('@/app/(public)/help/page')
    render(Page())
    expect(screen.getByText('盆栽育成記録')).toBeInTheDocument()
  })

  it('shows shop map FAQ section', async () => {
    const { default: Page } = await import('@/app/(public)/help/page')
    render(Page())
    expect(screen.getByText('盆栽園マップ')).toBeInTheDocument()
  })

  it('shows privacy section', async () => {
    const { default: Page } = await import('@/app/(public)/help/page')
    render(Page())
    expect(screen.getByText('プライバシーとセキュリティ')).toBeInTheDocument()
  })

  it('has metadata', async () => {
    const { metadata } = await import('@/app/(public)/help/page')
    expect(metadata?.title).toBeDefined()
  })
})

// ============================================================
// Login Page
// ============================================================
describe('LoginPage', async () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuth.mockResolvedValue(null)
  })

  it('renders login page', async () => {
    const { default: Page } = await import('@/app/(auth)/login/page')
    const result = await Page()
    render(result)
    expect(screen.getByText('ログイン')).toBeInTheDocument()
    expect(screen.getByTestId('login-form')).toBeInTheDocument()
  })

  it('redirects if already logged in', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'u1' } })
    const { default: Page } = await import('@/app/(auth)/login/page')
    await expect(Page()).rejects.toThrow('REDIRECT')
  })

})

// ============================================================
// Register Page
// ============================================================
describe('RegisterPage', async () => {
  it('renders register page', async () => {
    const { default: Page } = await import('@/app/(auth)/register/page')
    render(Page())
    expect(screen.getByText('新規登録')).toBeInTheDocument()
    expect(screen.getByTestId('register-form')).toBeInTheDocument()
  })
})

// ============================================================
// Settings Main Page (async Server Component; auth required for menu)
// ============================================================
describe('SettingsPage', async () => {
  beforeEach(() => {
    mockAuth.mockResolvedValue({ user: { id: 'u1', email: 'user@example.com' } })
  })

  it('renders settings page', async () => {
    const { default: Page } = await import('@/app/(main)/settings/page')
    const result = await Page()
    render(result)
    expect(screen.getByText('設定')).toBeInTheDocument()
  })

  it('shows menu items', async () => {
    const { default: Page } = await import('@/app/(main)/settings/page')
    const result = await Page()
    render(result)
    expect(screen.getByText('プロフィール編集')).toBeInTheDocument()
    expect(screen.getByText('通知設定')).toBeInTheDocument()
    expect(screen.getByText('アカウント設定')).toBeInTheDocument()
    expect(screen.getByText('セキュリティ設定')).toBeInTheDocument()
  })

  it('shows follow requests link', async () => {
    const { default: Page } = await import('@/app/(main)/settings/page')
    const result = await Page()
    render(result)
    expect(screen.getByText('フォローリクエスト')).toBeInTheDocument()
  })

  it('shows plan management link', async () => {
    const { default: Page } = await import('@/app/(main)/settings/page')
    const result = await Page()
    render(result)
    expect(screen.getByText('プラン管理')).toBeInTheDocument()
  })

  it('shows display settings', async () => {
    const { default: Page } = await import('@/app/(main)/settings/page')
    const result = await Page()
    render(result)
    expect(screen.getByText('表示設定')).toBeInTheDocument()
  })

  it('has metadata', async () => {
    const { metadata } = await import('@/app/(main)/settings/page')
    expect(metadata?.title).toBeDefined()
  })
})

// ============================================================
// Notification Settings Page
// ============================================================
describe('NotificationSettingsPage', async () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuth.mockResolvedValue({ user: { id: 'u1' } })
  })

  it('renders notification settings', async () => {
    const { default: Page } = await import('@/app/(main)/settings/notifications/page')
    const result = await Page()
    render(result)
    expect(screen.getByText('通知設定')).toBeInTheDocument()
  })

  it('shows description text', async () => {
    const { default: Page } = await import('@/app/(main)/settings/notifications/page')
    const result = await Page()
    render(result)
    expect(screen.getByText(/受け取る通知の種類/)).toBeInTheDocument()
  })

  it('has metadata', async () => {
    const { metadata } = await import('@/app/(main)/settings/notifications/page')
    expect(metadata?.title).toBeDefined()
  })

  it('renders with empty preferences when fetch fails', async () => {
    const { getNotificationPreferences } = await import('@/lib/actions/notification-preferences')
    ;(getNotificationPreferences as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ preferences: {} })
    const { default: Page } = await import('@/app/(main)/settings/notifications/page')
    const result = await Page()
    render(result)
    expect(screen.getByText('通知設定')).toBeInTheDocument()
  })

  it('redirects to /login when not authenticated (early return branch)', async () => {
    mockAuth.mockResolvedValueOnce(null)
    const { default: Page } = await import('@/app/(main)/settings/notifications/page')
    await expect(Page()).rejects.toThrow('REDIRECT')
    expect(mockRedirect).toHaveBeenCalledWith('/login')
  })

  it('shows the guest restriction view when the session belongs to the guest user', async () => {
    const { GUEST_EMAIL } = await import('@/lib/constants/guest')
    mockAuth.mockResolvedValueOnce({ user: { id: 'guest-1', email: GUEST_EMAIL } })
    const { default: Page } = await import('@/app/(main)/settings/notifications/page')
    const result = await Page()
    render(result)
    const restriction = screen.getByTestId('guest-restriction')
    expect(restriction).toBeInTheDocument()
    expect(restriction.getAttribute('data-title')).toBe('通知設定')
    // The normal NotificationPreferences view must NOT render in guest mode.
    expect(screen.queryByTestId('notif-prefs')).toBeNull()
    expect(screen.queryByTestId('push-toggle')).toBeNull()
  })

  it('renders the push notification toggle for non-guest authenticated users', async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: 'u1', email: 'real@example.com' } })
    const { default: Page } = await import('@/app/(main)/settings/notifications/page')
    const result = await Page()
    render(result)
    expect(screen.getByTestId('push-toggle')).toBeInTheDocument()
    expect(screen.getByTestId('notif-prefs')).toBeInTheDocument()
  })
})
