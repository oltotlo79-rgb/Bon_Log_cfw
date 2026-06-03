import { vi } from 'vitest'
import { render, screen } from '../utils/test-utils'

// useSession で landing CTA を切り替えるため、auth() server-side mock は不要。
const mockUseSession = vi.fn()
vi.mock('next-auth/react', () => ({
  useSession: () => mockUseSession(),
  SessionProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

// LandingThemeToggle が useTheme() を呼ぶため、Provider を介さず使えるよう mock する。
// 実 Provider は app/providers.tsx 側で適用されており、ここではコンポーネントの存在テストのみ行う。
vi.mock('@/components/theme/ThemeProvider', () => ({
  useTheme: () => ({
    theme: 'light' as const,
    resolvedTheme: 'light' as const,
    setTheme: vi.fn(),
  }),
}))

vi.mock('next/image', () => ({
  __esModule: true,
  default: ({ src, alt, ...rest }: { src: string; alt: string; [key: string]: unknown }) => {
    const { fill, priority, sizes, ...domProps } = rest as Record<string, unknown>
    void fill; void priority; void sizes;
    // eslint-disable-next-line @next/next/no-img-element -- test stub
    return <img src={src} alt={alt} {...(domProps as Record<string, string>)} />
  },
}))

import Home from '@/app/page'

describe('Home (root page)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders login/register links when not logged in', () => {
    mockUseSession.mockReturnValue({ data: null, status: 'unauthenticated' })
    render(Home())

    expect(screen.getAllByText('BON-LOG').length).toBeGreaterThan(0)
    expect(screen.getAllByText('ログイン').length).toBeGreaterThan(0)
    expect(screen.getAllByText('新規登録').length).toBeGreaterThan(0)
    expect(screen.getAllByText('無料で始める').length).toBeGreaterThan(0)
  })

  it('renders feed/settings links when logged in', () => {
    mockUseSession.mockReturnValue({
      data: { user: { id: 'user-1', name: 'Test' } },
      status: 'authenticated',
    })
    render(Home())

    const feedLinks = screen.getAllByText('タイムラインへ')
    expect(feedLinks.length).toBeGreaterThan(0)
    expect(screen.getByText('設定')).toBeInTheDocument()
  })

  it('renders feature sections', () => {
    mockUseSession.mockReturnValue({ data: null, status: 'unauthenticated' })
    render(Home())

    expect(screen.getByText('主な機能')).toBeInTheDocument()
    expect(screen.getByText('投稿・共有')).toBeInTheDocument()
    expect(screen.getByText('コミュニティ')).toBeInTheDocument()
    expect(screen.getByText('盆栽園マップ')).toBeInTheDocument()
  })

  it('renders footer', () => {
    mockUseSession.mockReturnValue({ data: null, status: 'unauthenticated' })
    render(Home())

    expect(screen.getByText('プライバシーポリシー')).toBeInTheDocument()
    expect(screen.getByText('利用規約')).toBeInTheDocument()
  })

  it('main has id="main-content" and tabIndex for skip link', () => {
    mockUseSession.mockReturnValue({ data: null, status: 'unauthenticated' })
    render(Home())

    const main = document.getElementById('main-content')
    expect(main).toBeInTheDocument()
    expect(main?.tagName).toBe('MAIN')
    expect(main).toHaveAttribute('tabindex', '-1')
  })

  describe('LandingThemeToggle integration', () => {
    it('テーマトグルがヘッダーに 1 つだけ存在する', () => {
      mockUseSession.mockReturnValue({ data: null, status: 'unauthenticated' })
      render(Home())

      // aria-label のどちらか (light/dark の状態に依存) で存在を保証
      const lightLabel = screen.queryAllByLabelText('ライトモードに切り替える')
      const darkLabel = screen.queryAllByLabelText('ダークモードに切り替える')
      expect(lightLabel.length + darkLabel.length).toBe(1)
    })

    it('ログイン状態でもテーマトグルが表示される (auth CTA に隠れない)', () => {
      mockUseSession.mockReturnValue({
        data: { user: { id: 'user-1', name: 'Test' } },
        status: 'authenticated',
      })
      render(Home())

      const lightLabel = screen.queryAllByLabelText('ライトモードに切り替える')
      const darkLabel = screen.queryAllByLabelText('ダークモードに切り替える')
      expect(lightLabel.length + darkLabel.length).toBe(1)
    })
  })

  describe('metadata', () => {
    it('exports page-level metadata with absolute title (bypasses parent template)', async () => {
      const { metadata } = await import('@/app/page')
      expect(metadata.title).toEqual({
        absolute: 'BON-LOG - 盆栽愛好家のためのコミュニティSNS',
      })
    })

    it('canonical URL is pinned to BASE_URL (not inherited from layout)', async () => {
      const [{ metadata }, { BASE_URL }] = await Promise.all([
        import('@/app/page'),
        import('@/lib/constants/routes'),
      ])
      expect(metadata.alternates?.canonical).toBe(BASE_URL)
      expect(String(metadata.alternates?.canonical)).toMatch(/^https?:\/\//)
    })

    it('openGraph url matches canonical and includes brand title', async () => {
      const [{ metadata }, { BASE_URL }] = await Promise.all([
        import('@/app/page'),
        import('@/lib/constants/routes'),
      ])
      expect(metadata.openGraph?.url).toBe(BASE_URL)
      expect(metadata.openGraph?.title).toContain('BON-LOG')
    })

    it('description is non-empty for SEO', async () => {
      const { metadata } = await import('@/app/page')
      expect(metadata.description).toBeTruthy()
      expect((metadata.description as string).length).toBeGreaterThan(20)
    })
  })
})
