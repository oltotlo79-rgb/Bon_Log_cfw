import { vi } from 'vitest'
import { render, screen } from '../utils/test-utils'

// Mock auth
const mockAuth = vi.fn()
vi.mock('@/lib/auth', () => ({
  auth: () => mockAuth(),
}))

// Mock next/image
vi.mock('next/image', () => ({
  __esModule: true,
  default: ({ src, alt, ...rest }: { src: string; alt: string; [key: string]: unknown }) => {
    // Filter out non-DOM props
    const { fill, priority, sizes, ...domProps } = rest as Record<string, unknown>
    void fill; void priority; void sizes;
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt={alt} {...(domProps as Record<string, string>)} />
  },
}))

import Home from '@/app/page'

describe('Home (root page)', () => {
  it('renders login/register links when not logged in', async () => {
    mockAuth.mockResolvedValue(null)
    const jsx = await Home()
    render(jsx)

    expect(screen.getAllByText('BON-LOG').length).toBeGreaterThan(0)
    expect(screen.getAllByText('ログイン').length).toBeGreaterThan(0)
    expect(screen.getAllByText('新規登録').length).toBeGreaterThan(0)
    expect(screen.getAllByText('無料で始める').length).toBeGreaterThan(0)
  })

  it('renders feed/settings links when logged in', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'user-1', name: 'Test' } })
    const jsx = await Home()
    render(jsx)

    const feedLinks = screen.getAllByText('タイムラインへ')
    expect(feedLinks.length).toBeGreaterThan(0)
    expect(screen.getByText('設定')).toBeInTheDocument()
  })

  it('renders feature sections', async () => {
    mockAuth.mockResolvedValue(null)
    const jsx = await Home()
    render(jsx)

    expect(screen.getByText('主な機能')).toBeInTheDocument()
    expect(screen.getByText('投稿・共有')).toBeInTheDocument()
    expect(screen.getByText('コミュニティ')).toBeInTheDocument()
    expect(screen.getByText('盆栽園マップ')).toBeInTheDocument()
  })

  it('renders footer', async () => {
    mockAuth.mockResolvedValue(null)
    const jsx = await Home()
    render(jsx)

    expect(screen.getByText('プライバシーポリシー')).toBeInTheDocument()
    expect(screen.getByText('利用規約')).toBeInTheDocument()
  })

  it('main has id="main-content" and tabIndex for skip link', async () => {
    mockAuth.mockResolvedValue(null)
    const jsx = await Home()
    render(jsx)

    const main = document.getElementById('main-content')
    expect(main).toBeInTheDocument()
    expect(main?.tagName).toBe('MAIN')
    expect(main).toHaveAttribute('tabindex', '-1')
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
      // canonical must be absolute, not a relative path
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
