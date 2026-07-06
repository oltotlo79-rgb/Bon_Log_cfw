/**
 * app/admin/ip-management/page.tsx
 *
 * getIpAddresses / detectMultiAccounts がそれぞれ独立に成功/エラーを返しうるため、
 * 'devices' / 'total' / 'nextCursor' / 'suspiciousIps' の各フォールバック分岐を検証する。
 */
import { vi } from 'vitest'
import { render, screen } from '@testing-library/react'

const mockGetIpAddresses = vi.fn()
const mockDetectMultiAccounts = vi.fn()
vi.mock('@/lib/actions/admin/ip-management', () => ({
  getIpAddresses: (...args: unknown[]) => mockGetIpAddresses(...args),
  detectMultiAccounts: (...args: unknown[]) => mockDetectMultiAccounts(...args),
}))

vi.mock('@/app/admin/ip-management/IpManagementClient', () => ({
  IpManagementClient: ({
    devices,
    total,
    suspiciousIps,
  }: {
    devices: unknown[]
    total: number
    suspiciousIps: unknown[]
  }) => (
    <div data-testid="ip-client">
      devices:{devices.length} total:{total} suspicious:{suspiciousIps.length}
    </div>
  ),
}))

vi.mock('@/components/admin/CursorPagination', () => ({
  CursorPagination: ({ nextCursor }: { nextCursor?: string }) => (
    <div data-testid="pagination" data-next-cursor={nextCursor ?? ''} />
  ),
}))

import IpManagementPage from '@/app/admin/ip-management/page'

describe('IpManagementPage - フォールバック分岐', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('両方のactionがエラーを返した場合、devices/total/suspiciousIpsが空にフォールバックする', async () => {
    mockGetIpAddresses.mockResolvedValue({ error: '権限がありません' })
    mockDetectMultiAccounts.mockResolvedValue({ error: '権限がありません' })

    const result = await IpManagementPage({ searchParams: Promise.resolve({}) })
    render(result)

    expect(screen.getByTestId('ip-client')).toHaveTextContent('devices:0 total:0 suspicious:0')
    expect(screen.getByTestId('pagination')).toHaveAttribute('data-next-cursor', '')
  })

  it('nextCursorが返された場合、CursorPaginationに伝播する', async () => {
    mockGetIpAddresses.mockResolvedValue({
      devices: [{ id: 'd1' }],
      total: 30,
      nextCursor: 'device-20',
    })
    mockDetectMultiAccounts.mockResolvedValue({ suspiciousIps: [{ ip: '1.2.3.4' }] })

    const result = await IpManagementPage({ searchParams: Promise.resolve({ search: 'foo' }) })
    render(result)

    expect(screen.getByTestId('ip-client')).toHaveTextContent('devices:1 total:30 suspicious:1')
    expect(screen.getByTestId('pagination')).toHaveAttribute('data-next-cursor', 'device-20')
  })
})
