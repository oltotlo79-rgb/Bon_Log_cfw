/**
 * app/admin/logs/page.tsx
 *
 * 既存テスト（coverage-boost-logs.test.tsx 等）でカバーされていない分岐:
 * - getAdminLogs がエラーを返した場合のリダイレクト
 * - action / targetType が定義済みラベルに無い値の場合のフォールバック表示
 */
import { vi } from 'vitest'
import { render, screen } from '@testing-library/react'

const mockGetAdminLogs = vi.fn()
vi.mock('@/lib/actions/admin/logs', () => ({
  getAdminLogs: (...args: unknown[]) => mockGetAdminLogs(...args),
}))

const mockRedirect = vi.fn((url: string) => {
  throw new Error(`REDIRECT:${url}`)
})
vi.mock('next/navigation', () => ({
  redirect: (url: string) => mockRedirect(url),
}))

vi.mock('next/link', () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}))

import AdminLogsPage from '@/app/admin/logs/page'

function createLog(overrides: Record<string, unknown> = {}) {
  return {
    id: 'log-1',
    action: 'suspend_user',
    targetType: 'user',
    targetId: 'target-1',
    details: null,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    admin: { user: { id: 'admin-1', nickname: '管理者' } },
    ...overrides,
  }
}

describe('AdminLogsPage - 未カバー分岐', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('getAdminLogs がエラーを返した場合はログインへリダイレクトする', async () => {
    mockGetAdminLogs.mockResolvedValue({ error: '認証エラー' })

    await expect(
      AdminLogsPage({ searchParams: Promise.resolve({}) }),
    ).rejects.toThrow('REDIRECT')
    expect(mockRedirect).toHaveBeenCalledWith('/login')
  })

  it('actionLabels に無いアクションはそのままの文字列で表示する', async () => {
    mockGetAdminLogs.mockResolvedValue({
      logs: [createLog({ action: 'unknown_custom_action' })],
      total: 1,
    })

    const result = await AdminLogsPage({ searchParams: Promise.resolve({}) })
    render(result)

    expect(screen.getByText('unknown_custom_action')).toBeInTheDocument()
  })

  it('targetType が null の場合は対象タイプ列に "-" を表示する', async () => {
    mockGetAdminLogs.mockResolvedValue({
      logs: [createLog({ targetType: null })],
      total: 1,
    })

    const result = await AdminLogsPage({ searchParams: Promise.resolve({}) })
    render(result)

    const cells = screen.getAllByText('-')
    expect(cells.length).toBeGreaterThan(0)
  })

  it('targetTypeLabels に無いtargetTypeはそのままの文字列で表示する', async () => {
    mockGetAdminLogs.mockResolvedValue({
      logs: [createLog({ targetType: 'unknown_target_type' })],
      total: 1,
    })

    const result = await AdminLogsPage({ searchParams: Promise.resolve({}) })
    render(result)

    expect(screen.getByText('unknown_target_type')).toBeInTheDocument()
  })
})
