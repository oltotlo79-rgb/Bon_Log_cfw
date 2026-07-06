/**
 * app/admin/backups/page.tsx
 *
 * admin-server-pages.test.tsx で「非管理者リダイレクト」「管理者表示」は
 * カバー済みだが、SUPABASE_DASHBOARD_URL 未設定時のフォールバック分岐
 * （supabaseDashboardUrl が truthy のときにダッシュボードリンクを表示する）
 * が未検証だったため、getSupabaseDashboardUrl() が実際に URL を返す
 * ケースを補強する。
 */
import { vi } from 'vitest'
import { render, screen } from '@testing-library/react'

const mockIsAdmin = vi.fn()
vi.mock('@/lib/actions/admin', () => ({
  isAdmin: () => mockIsAdmin(),
}))

const mockGetSupabaseDashboardUrl = vi.fn()
vi.mock('@/lib/env', async () => {
  const actual = await vi.importActual<typeof import('@/lib/env')>('@/lib/env')
  return {
    ...actual,
    getSupabaseDashboardUrl: () => mockGetSupabaseDashboardUrl(),
  }
})

vi.mock('@/lib/db', () => ({
  prisma: new Proxy(
    {},
    {
      get: () => ({ count: vi.fn().mockResolvedValue(0) }),
    },
  ),
}))

const mockRedirect = vi.fn((url: string) => {
  throw new Error(`REDIRECT:${url}`)
})
vi.mock('next/navigation', () => ({
  redirect: (url: string) => mockRedirect(url),
}))

import BackupsPage from '@/app/admin/backups/page'

describe('BackupsPage - Supabaseダッシュボードリンク分岐', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockIsAdmin.mockResolvedValue(true)
  })

  it('SUPABASE_DASHBOARD_URL が未設定の場合はリンクを表示しない', async () => {
    mockGetSupabaseDashboardUrl.mockReturnValue(null)
    const result = await BackupsPage()
    render(result)

    expect(screen.queryByText('Supabaseダッシュボードを開く')).not.toBeInTheDocument()
  })

  it('SUPABASE_DASHBOARD_URL が設定されている場合はダッシュボードリンクを表示する', async () => {
    mockGetSupabaseDashboardUrl.mockReturnValue('https://supabase.com/dashboard/project/xyz')
    const result = await BackupsPage()
    render(result)

    const link = screen.getByText('Supabaseダッシュボードを開く').closest('a')
    expect(link).toHaveAttribute('href', 'https://supabase.com/dashboard/project/xyz')
    expect(link).toHaveAttribute('target', '_blank')
  })
})
