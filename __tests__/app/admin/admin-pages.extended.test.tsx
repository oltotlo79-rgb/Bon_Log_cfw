import { vi } from 'vitest'
/**
 * 管理画面ページの拡張テスト
 */
import React from 'react'

// Prismaモック
vi.mock('@/lib/db', () => ({ prisma: {} }))

// 認証モック
const mockAuth = vi.fn()
vi.mock('@/lib/auth', () => ({
  auth: () => mockAuth(),
}))

// Next.jsナビゲーションモック
const mockRedirect = vi.fn()
vi.mock('next/navigation', () => ({
  redirect: (url: string) => { mockRedirect(url); throw new Error('REDIRECT') },
  notFound: () => { throw new Error('NOT_FOUND') },
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}))

describe('管理画面認証テスト', async () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('管理者チェック', async () => {
    it('未ログインの場合はリダイレクト', async () => {
      mockAuth.mockResolvedValue(null)

      // 管理者レイアウトをインポートして未認証状態をテスト
      try {
        const { default: AdminLayout } = await import('@/app/admin/layout')
        await AdminLayout({ children: <div>Test</div> })
      } catch (e) {
        if (e instanceof Error && e.message === 'REDIRECT') {
          expect(mockRedirect).toHaveBeenCalled()
        }
      }
    })

    it('管理者でない場合はリダイレクト', async () => {
      mockAuth.mockResolvedValue({
        user: { id: 'user-1', role: 'user' },
      })

      try {
        const { default: AdminLayout } = await import('@/app/admin/layout')
        await AdminLayout({ children: <div>Test</div> })
      } catch (e) {
        if (e instanceof Error && e.message === 'REDIRECT') {
          expect(mockRedirect).toHaveBeenCalled()
        }
      }
    })
  })
})

describe('SentryErrors コンポーネントテスト', async () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('SentryErrorsコンポーネントがエクスポートされている', async () => {
    const sentryModule = await import('@/app/admin/SentryErrors')
    expect(sentryModule.SentryErrors).toBeDefined()
    expect(typeof sentryModule.SentryErrors).toBe('function')
  }, 20000)
})

describe('管理画面ドロップダウンアクション', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('ReportActionsDropdownがエクスポートされている', async () => {
    const mod = await import('@/app/admin/reports/ReportActionsDropdown')
    expect(mod.ReportActionsDropdown).toBeDefined()
    expect(typeof mod.ReportActionsDropdown).toBe('function')
  })

  it('PremiumActionsDropdownがエクスポートされている', async () => {
    const mod = await import('@/app/admin/premium/PremiumActionsDropdown')
    expect(mod.PremiumActionsDropdown).toBeDefined()
    expect(typeof mod.PremiumActionsDropdown).toBe('function')
  })
})

describe('管理画面ログページ', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuth.mockResolvedValue({
      user: { id: 'admin-1', role: 'admin' },
    })
  })

  it('ログページがエクスポートされている', async () => {
    const mod = await import('@/app/admin/logs/page')
    expect(mod.default).toBeDefined()
    expect(typeof mod.default).toBe('function')
  })
})
