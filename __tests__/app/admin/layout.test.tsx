// @vitest-environment node
 

import { vi } from 'vitest'
import { redirect } from 'next/navigation'

// Mocks
const mockAuth = vi.fn()
const mockSignOut = vi.fn()
const mockIsAdmin = vi.fn()
const mockCount = vi.fn()

vi.mock('@/lib/auth', () => ({
  auth: (...args: unknown[]) => mockAuth(...args),
  signOut: (...args: unknown[]) => mockSignOut(...args),
}))

vi.mock('@/lib/actions/admin', () => ({
  isAdmin: (...args: unknown[]) => mockIsAdmin(...args),
}))

vi.mock('@/lib/db', () => ({
  prisma: {
    user: {
      count: (...args: unknown[]) => mockCount(...args),
    },
  },
}))

vi.mock('next/navigation', () => ({
  redirect: vi.fn(),
}))

vi.mock('next/link', () => {
  return {
    __esModule: true,
    default: ({ children, href }: { children: React.ReactNode; href: string }) => (
      <a href={href}>{children}</a>
    ),
  }
})

describe('AdminLayout', async () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('ユーザーテーブルが空の場合サインアウトしてリダイレクト', async () => {
    mockCount.mockResolvedValue(0)
    mockSignOut.mockResolvedValue(undefined)

    const { default: AdminLayout } = await import('@/app/admin/layout')
    await AdminLayout({ children: <div>child</div> })

    expect(mockSignOut).toHaveBeenCalledWith({ redirect: false })
    expect(redirect).toHaveBeenCalledWith('/')
  })

  it('未認証ユーザーをログインページにリダイレクト', async () => {
    mockCount.mockResolvedValue(1)
    mockAuth.mockResolvedValue(null)

    const { default: AdminLayout } = await import('@/app/admin/layout')
    await AdminLayout({ children: <div>child</div> })

    expect(redirect).toHaveBeenCalledWith('/login')
  })

  it('非管理者ユーザーをフィードにリダイレクト', async () => {
    mockCount.mockResolvedValue(1)
    mockAuth.mockResolvedValue({ user: { id: 'user-1' } })
    mockIsAdmin.mockResolvedValue(false)

    const { default: AdminLayout } = await import('@/app/admin/layout')
    await AdminLayout({ children: <div>child</div> })

    expect(redirect).toHaveBeenCalledWith('/feed')
  })

  it('管理者ユーザーにサイドバーとコンテンツを表示', async () => {
    mockCount.mockResolvedValue(1)
    mockAuth.mockResolvedValue({ user: { id: 'admin-1' } })
    mockIsAdmin.mockResolvedValue(true)

    const { default: AdminLayout } = await import('@/app/admin/layout')
    const result = await AdminLayout({ children: <div>child content</div> })

    // result is JSX - just verify it's truthy (rendered without redirect)
    expect(result).toBeTruthy()
    expect(redirect).not.toHaveBeenCalled()
  })

  it('admin-themeクラスが適用されている', async () => {
    mockCount.mockResolvedValue(1)
    mockAuth.mockResolvedValue({ user: { id: 'admin-1' } })
    mockIsAdmin.mockResolvedValue(true)

    const { default: AdminLayout } = await import('@/app/admin/layout')
    const result = await AdminLayout({ children: <div>test</div> })

    // JSX要素のpropsからクラス名を検証
    const jsxElement = result as React.ReactElement<{ className?: string }>
    const rootClassName = jsxElement.props.className
    expect(rootClassName).toContain('admin-theme')
  })
})
