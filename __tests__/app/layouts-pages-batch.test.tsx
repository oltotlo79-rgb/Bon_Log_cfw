import { vi } from 'vitest'
/**
 * Batch tests for layouts, providers, robots, sitemap, global-error, and other 0% pages
 */
import React from 'react'
import { render, screen } from '@testing-library/react'

// Common mocks
vi.mock('next/font/google', () => ({
  Noto_Sans_JP: () => ({ className: 'noto-sans-jp', variable: '--font-noto-sans-jp' }),
  Shippori_Mincho: () => ({ className: 'shippori-mincho', variable: '--font-shippori-mincho' }),
}))
vi.mock('next/font/local', () => () => ({ className: 'geist-mono', variable: '--font-geist-mono' }))
vi.mock('next-themes', () => ({ ThemeProvider: ({ children }: { children: React.ReactNode }) => <div data-testid="theme-provider">{children}</div>, useTheme: () => ({ theme: 'light', setTheme: vi.fn() }) }), { virtual: true })
vi.mock('@tanstack/react-query', () => ({
  QueryClient: class MockQueryClient {},
  QueryClientProvider: ({ children }: { children: React.ReactNode }) => <div data-testid="query-provider">{children}</div>,
}))
vi.mock('@/lib/sentry-shim', () => ({ init: vi.fn(), captureException: vi.fn() }))
vi.mock('next/script', () => {
  const MockScript = function MockScript(_props: Record<string, unknown>) { return <div data-testid="next-script" /> }
  return { default: MockScript }
})
vi.mock('next/image', () => {
  const MockImage = function MockImage(_props: Record<string, unknown>) { return <div data-testid="next-image" /> }
  return { default: MockImage }
})
vi.mock('next/link', () => {
  const MockLink = function MockLink({ children, ...props }: { children: React.ReactNode; href?: string }) { return <a {...props}>{children}</a> }
  return { default: MockLink }
})
vi.mock('next/navigation', () => ({
  redirect: vi.fn(),
  useRouter: vi.fn(() => ({ push: vi.fn(), refresh: vi.fn() })),
  usePathname: vi.fn(() => '/'),
  useSearchParams: vi.fn(() => new URLSearchParams()),
}))
vi.mock('next-auth/react', () => ({
  SessionProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  signOut: vi.fn(),
  useSession: vi.fn(() => ({ data: null, status: 'unauthenticated' })),
}))
vi.mock('@/lib/auth', () => ({ auth: vi.fn().mockResolvedValue(null) }))
vi.mock('@/lib/db', () => ({ prisma: { user: { count: vi.fn().mockResolvedValue(1) }, systemSetting: { findUnique: vi.fn().mockResolvedValue(null) } } }))
vi.mock('sonner', () => ({ Toaster: () => <div data-testid="toaster" />, toast: { success: vi.fn(), error: vi.fn() } }), { virtual: true })
vi.mock('@/components/common/LoadingScreen', () => ({ LoadingScreen: ({ message }: { message?: string }) => <div data-testid="loading-screen">{message}</div> }))
vi.mock('@/components/theme/ThemeProvider', () => ({ ThemeProvider: ({ children }: { children: React.ReactNode }) => <div data-testid="theme-provider">{children}</div> }))
vi.mock('@/components/pwa/ServiceWorkerRegistration', () => ({ ServiceWorkerRegistration: () => null }))
vi.mock('@/lib/constants/limits', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>()
  return { ...actual, STALE_TIME_MS: 60000 }
})
vi.mock('lucide-react', () => {
  const icon = (name: string) => { const Icon = (_props: Record<string, unknown>) => <div data-testid={`icon-${name}`} />; Icon.displayName = name; return Icon }
  return {
    Home: icon('Home'), Users: icon('Users'), FileText: icon('FileText'),
    AlertTriangle: icon('AlertTriangle'), Calendar: icon('Calendar'), MapPin: icon('MapPin'),
    ScrollText: icon('ScrollText'), ShieldBan: icon('ShieldBan'), TrendingUp: icon('TrendingUp'),
    Gauge: icon('Gauge'), Wrench: icon('Wrench'), EyeOff: icon('EyeOff'),
    MessageSquare: icon('MessageSquare'), ArrowLeft: icon('ArrowLeft'), Heart: icon('Heart'),
    Search: icon('Search'), Bell: icon('Bell'), BellOff: icon('BellOff'),
    Crown: icon('Crown'), Check: icon('Check'), Star: icon('Star'),
    Settings: icon('Settings'), User: icon('User'), Shield: icon('Shield'),
    Ban: icon('Ban'), VolumeX: icon('VolumeX'), Bookmark: icon('Bookmark'),
    Plus: icon('Plus'), MoreHorizontal: icon('MoreHorizontal'), Edit: icon('Edit'),
    Trash2: icon('Trash2'), Flag: icon('Flag'), Share: icon('Share'),
    X: icon('X'), Image: icon('Image'), Camera: icon('Camera'),
    Clock: icon('Clock'), Loader2: icon('Loader2'), AlertCircle: icon('AlertCircle'),
    Mail: icon('Mail'), Activity: icon('Activity'), ArrowRight: icon('ArrowRight'),
    BarChart3: icon('BarChart3'), List: icon('List'), CalendarPlus: icon('CalendarPlus'),
  }
})

// ============================================================
// Providers
// ============================================================
describe('Providers', async () => {
  it('renders children with providers', async () => {
    const { Providers } = await import('@/app/providers')
    render(<Providers><div data-testid="child">Hello</div></Providers>)
    expect(screen.getByTestId('child')).toBeDefined()
  })
})

// ============================================================
// robots.ts
// ============================================================
describe('robots', async () => {
  it('returns robots config', async () => {
    const mod = await import('@/app/robots')
    const result = mod.default()
    expect(result).toBeDefined()
    expect(result.rules).toBeDefined()
  })
})

// ============================================================
// sitemap.ts
// ============================================================
describe('sitemap', async () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('returns sitemap array', async () => {
    const db = await import('@/lib/db')
    const p = db.prisma as unknown as Record<string, Record<string, unknown>>
    p.user.findMany = vi.fn().mockResolvedValue([])
    p.post = { findMany: vi.fn().mockResolvedValue([]) }
    p.bonsaiShop = { findMany: vi.fn().mockResolvedValue([]) }
    p.event = { findMany: vi.fn().mockResolvedValue([]) }
    p.bonsaiTerm = { findMany: vi.fn().mockResolvedValue([]) }
    p.pesticide = { findMany: vi.fn().mockResolvedValue([]) }
    p.diseasePest = { findMany: vi.fn().mockResolvedValue([]) }
    p.bonsai = { findMany: vi.fn().mockResolvedValue([]) }
    const mod = await import('@/app/sitemap')
    const result = await mod.default()
    expect(Array.isArray(result)).toBe(true)
    expect(result.length).toBeGreaterThan(0)
  })
})

// ============================================================
// global-error.tsx
// ============================================================
describe('GlobalError', async () => {
  it('renders error page', async () => {
    const mod = await import('@/app/global-error')
    const GlobalError = mod.default
    const mockError = new Error('Fatal error')
    const mockReset = vi.fn()
    const { container } = render(<GlobalError error={mockError} reset={mockReset} />)
    expect(container).toBeDefined()
  })

  it('has retry button', async () => {
    const mod = await import('@/app/global-error')
    const GlobalError = mod.default
    const mockError = new Error('Fatal error')
    const mockReset = vi.fn()
    render(<GlobalError error={mockError} reset={mockReset} />)
    const btns = screen.getAllByRole('button')
    expect(btns.length).toBeGreaterThan(0)
  })
})

// ============================================================
// Auth Layout & Loading
// ============================================================
describe('Auth layout', async () => {
  it('renders children', async () => {
    const mod = await import('@/app/(auth)/layout')
    const Layout = mod.default
    render(<Layout><div data-testid="auth-child">Login</div></Layout>)
    expect(screen.getByTestId('auth-child')).toBeDefined()
  })
})

describe('Auth loading', async () => {
  it('renders loading', async () => {
    const mod = await import('@/app/(auth)/loading')
    const Loading = mod.default
    render(<Loading />)
    expect(screen.getByTestId('loading-screen')).toBeDefined()
  })
})

// ============================================================
// Legal Layout
// ============================================================
describe('Legal layout', async () => {
  it('renders children + login/register links when unauthenticated (useSession → unauthenticated)', async () => {
    const nextAuth = await import('next-auth/react')
    vi.mocked(nextAuth.useSession).mockReturnValue({
      data: null,
      status: 'unauthenticated',
      update: vi.fn(),
    } as unknown as ReturnType<typeof nextAuth.useSession>)
    const mod = await import('@/app/(legal)/layout')
    const Layout = mod.default
    render(<Layout><div data-testid="legal-child">Terms</div></Layout>)
    expect(screen.getByTestId('legal-child')).toBeDefined()
    expect(screen.getByRole('link', { name: 'ログイン' })).toBeDefined()
    expect(screen.getByRole('link', { name: '新規登録' })).toBeDefined()
    expect(screen.queryByRole('link', { name: 'タイムラインへ' })).toBeNull()
  })

  it('renders the timeline shortcut when authenticated (useSession → authenticated)', async () => {
    const nextAuth = await import('next-auth/react')
    vi.mocked(nextAuth.useSession).mockReturnValue({
      data: { user: { id: 'u1', email: 'x@example.com' } },
      status: 'authenticated',
      update: vi.fn(),
    } as unknown as ReturnType<typeof nextAuth.useSession>)
    const mod = await import('@/app/(legal)/layout')
    const Layout = mod.default
    render(<Layout><div data-testid="legal-child-2">Terms</div></Layout>)
    expect(screen.getByTestId('legal-child-2')).toBeDefined()
    expect(screen.getByRole('link', { name: 'タイムラインへ' })).toBeDefined()
    expect(screen.queryByRole('link', { name: 'ログイン' })).toBeNull()
    expect(screen.queryByRole('link', { name: '新規登録' })).toBeNull()
  })

  it('always renders footer navigation regardless of auth state', async () => {
    const nextAuth = await import('next-auth/react')
    vi.mocked(nextAuth.useSession).mockReturnValue({
      data: null,
      status: 'unauthenticated',
      update: vi.fn(),
    } as unknown as ReturnType<typeof nextAuth.useSession>)
    const mod = await import('@/app/(legal)/layout')
    const Layout = mod.default
    render(<Layout><div /></Layout>)
    expect(screen.getByRole('link', { name: 'BON-LOGについて' })).toBeDefined()
    expect(screen.getByRole('link', { name: '利用規約' })).toBeDefined()
    expect(screen.getByRole('link', { name: 'プライバシーポリシー' })).toBeDefined()
    expect(screen.getByRole('link', { name: 'ヘルプ' })).toBeDefined()
    expect(screen.getByRole('link', { name: 'お問い合わせ' })).toBeDefined()
    expect(screen.getByRole('link', { name: 'アクセシビリティ' })).toBeDefined()
  })
})

// ============================================================
// Legal Pages
// ============================================================
describe('Privacy page', async () => {
  it('renders', async () => {
    const mod = await import('@/app/(legal)/privacy/page')
    const Page = mod.default
    const { container } = render(<Page />)
    expect(container.textContent).toBeTruthy()
  })
})

describe('Terms page', async () => {
  it('renders', async () => {
    const mod = await import('@/app/(legal)/terms/page')
    const Page = mod.default
    const { container } = render(<Page />)
    expect(container.textContent).toBeTruthy()
  })
})

describe('Tokushoho page', async () => {
  it('renders', async () => {
    const mod = await import('@/app/(legal)/tokushoho/page')
    const Page = mod.default
    const { container } = render(<Page />)
    expect(container.textContent).toBeTruthy()
  })
})

// ============================================================
// Auth Pages (password-reset)
// ============================================================
vi.mock('@/components/auth/PasswordResetForm', () => ({ PasswordResetForm: () => <div data-testid="pw-reset-form" /> }))
vi.mock('@/components/ui/card', () => ({
  Card: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CardContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CardHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CardTitle: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

describe('Password reset page', async () => {
  it('renders', async () => {
    const mod = await import('@/app/(auth)/password-reset/page')
    const Page = mod.default
    const { container } = render(<Page />)
    expect(container).toBeDefined()
  })
})

// ============================================================
// Maintenance pages
// ============================================================
describe('Maintenance logout button', async () => {
  it('renders button', async () => {
    const mod = await import('@/app/maintenance/logout-button')
     
    const LogoutButton = mod.MaintenanceLogoutButton || (mod as any).default
    render(<LogoutButton />)
    const btn = screen.getByRole('button')
    expect(btn).toBeDefined()
  })
})
