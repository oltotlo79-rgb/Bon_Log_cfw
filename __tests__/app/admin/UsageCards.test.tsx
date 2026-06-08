

import { vi } from 'vitest'
import { render, screen, waitFor, fireEvent } from '../../utils/test-utils'
import { UsageCards } from '@/app/admin/usage/UsageCards'

const mockFetch = vi.fn()
global.fetch = mockFetch as unknown as typeof fetch

describe('UsageCards', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('ローディング中にスケルトンを表示する', () => {
    mockFetch.mockReturnValue(new Promise(() => {}))
    render(<UsageCards />)
    const skeletons = document.querySelectorAll('.animate-pulse')
    expect(skeletons.length).toBeGreaterThan(0)
  })

  it('成功時にサービスカードを表示する', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        data: [{
          name: 'fly.io',
          status: 'ok',
          dashboardUrl: 'https://fly.io/apps/bon-log',
          lastUpdated: '2025-01-01T00:00:00Z',
          usage: [{ unit: 'マシン', current: 50, limit: 100, percentage: 50 }],
        }],
        fetchedAt: '2025-01-01T00:00:00Z',
      }),
    })
    render(<UsageCards />)
    await waitFor(() => {
      expect(screen.getByText('fly.io')).toBeInTheDocument()
    })
    expect(screen.getByText('正常')).toBeInTheDocument()
    expect(screen.getByText('50 / 100')).toBeInTheDocument()
  })

  it('エラー時にエラーメッセージを表示する', async () => {
    mockFetch.mockResolvedValue({ ok: false })
    render(<UsageCards />)
    await waitFor(() => {
      expect(screen.getByText('使用量の取得に失敗しました')).toBeInTheDocument()
    })
  })

  it('fetch例外でエラーメッセージを表示する', async () => {
    mockFetch.mockRejectedValue(new Error('network'))
    render(<UsageCards />)
    await waitFor(() => {
      expect(screen.getByText('network')).toBeInTheDocument()
    })
  })

  it('非Errorの例外で汎用エラーメッセージを表示する', async () => {
    mockFetch.mockRejectedValue('string error')
    render(<UsageCards />)
    await waitFor(() => {
      expect(screen.getByText('予期せぬエラーが発生しました')).toBeInTheDocument()
    })
  })

  it('更新ボタンでデータを再取得する', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        data: [{ name: 'Resend', status: 'ok', dashboardUrl: 'https://resend.com', lastUpdated: '2025-01-01T00:00:00Z', usage: [] }],
        fetchedAt: '2025-01-01T00:00:00Z',
      }),
    })
    render(<UsageCards />)
    await waitFor(() => {
      expect(screen.getByText('Resend')).toBeInTheDocument()
    })
    fireEvent.click(screen.getByText('更新'))
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledTimes(2)
    })
  })

  it('warningステータスを表示する', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        data: [{ name: 'Supabase', status: 'warning', dashboardUrl: 'https://supabase.com', lastUpdated: '2025-01-01T00:00:00Z', usage: [{ unit: 'API', current: 80, limit: 100, percentage: 80 }] }],
        fetchedAt: '2025-01-01T00:00:00Z',
      }),
    })
    render(<UsageCards />)
    await waitFor(() => {
      expect(screen.getByText('警告')).toBeInTheDocument()
    })
  })

  it('errorステータスとエラーメッセージを表示する', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        data: [{ name: 'Cloudflare R2', status: 'error', error: 'APIエラー', dashboardUrl: 'https://cloudflare.com', lastUpdated: '2025-01-01T00:00:00Z', usage: [] }],
        fetchedAt: '2025-01-01T00:00:00Z',
      }),
    })
    render(<UsageCards />)
    await waitFor(() => {
      expect(screen.getByText('エラー')).toBeInTheDocument()
      expect(screen.getByText('APIエラー')).toBeInTheDocument()
    })
  })

  it('unconfiguredステータスでヘルプテキストと環境変数ガイドを表示する', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        data: [{ name: 'fly.io', status: 'unconfigured', helpText: 'トークンを設定してください', helpUrl: 'https://fly.io/dashboard/personal/tokens', dashboardUrl: 'https://fly.io/dashboard', lastUpdated: '2025-01-01T00:00:00Z', usage: [] }],
        fetchedAt: '2025-01-01T00:00:00Z',
      }),
    })
    render(<UsageCards />)
    await waitFor(() => {
      expect(screen.getByText('未設定')).toBeInTheDocument()
      expect(screen.getByText('トークンを設定してください')).toBeInTheDocument()
      expect(screen.getByText('トークンを作成')).toBeInTheDocument()
      expect(screen.getByText('環境変数の設定')).toBeInTheDocument()
    })
  })

  it('fly.ioのok時にダッシュボード確認の注意を表示する', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        data: [{ name: 'fly.io', status: 'ok', dashboardUrl: 'https://fly.io/apps/bon-log', lastUpdated: '2025-01-01T00:00:00Z', usage: [] }],
        fetchedAt: '2025-01-01T00:00:00Z',
      }),
    })
    render(<UsageCards />)
    await waitFor(() => {
      expect(screen.getByText(/ダッシュボードで確認/)).toBeInTheDocument()
    })
  })

  it('fly.ioのok時にマシン使用量と次回請求額への導線を表示する', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        data: [{
          name: 'fly.io',
          status: 'ok',
          dashboardUrl: 'https://fly.io/dashboard/acme-123/billing/invoices/upcoming',
          lastUpdated: '2025-01-01T00:00:00Z',
          usage: [{ unit: '稼働マシン', current: 1, limit: 1, percentage: 100 }],
        }],
        fetchedAt: '2025-01-01T00:00:00Z',
      }),
    })
    render(<UsageCards />)
    await waitFor(() => {
      expect(screen.getByText('稼働マシン')).toBeInTheDocument()
    })
    const link = screen.getByText('使用料金・次回請求額を確認')
    expect(link.closest('a')).toHaveAttribute(
      'href',
      'https://fly.io/dashboard/acme-123/billing/invoices/upcoming'
    )
  })

  it('limitが0の場合にcurrentのみ表示する', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        data: [{ name: 'Resend', status: 'ok', dashboardUrl: 'https://resend.com', lastUpdated: '2025-01-01T00:00:00Z', usage: [{ unit: 'メール', current: 25, limit: 0, percentage: 0 }] }],
        fetchedAt: '2025-01-01T00:00:00Z',
      }),
    })
    render(<UsageCards />)
    await waitFor(() => {
      expect(screen.getByText('25')).toBeInTheDocument()
    })
  })

  it('90%以上のusageで赤いプログレスバーを表示する', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        data: [{ name: 'Supabase', status: 'warning', dashboardUrl: 'https://supabase.com', lastUpdated: '2025-01-01T00:00:00Z', usage: [{ unit: 'Storage', current: 95, limit: 100, percentage: 95 }] }],
        fetchedAt: '2025-01-01T00:00:00Z',
      }),
    })
    render(<UsageCards />)
    await waitFor(() => {
      const bar = document.querySelector('.bg-foreground.h-2')
      expect(bar).toBeInTheDocument()
    })
  })

  it('ok + helpTextでfly.io以外にヘルプテキストを表示する', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        data: [{ name: 'Resend', status: 'ok', helpText: '補足情報', dashboardUrl: 'https://resend.com', lastUpdated: '2025-01-01T00:00:00Z', usage: [] }],
        fetchedAt: '2025-01-01T00:00:00Z',
      }),
    })
    render(<UsageCards />)
    await waitFor(() => {
      expect(screen.getByText('補足情報')).toBeInTheDocument()
    })
  })

  it('未知のサービス名でデフォルトアイコンを表示する', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        data: [{ name: 'Unknown', status: 'ok', dashboardUrl: 'https://example.com', lastUpdated: '2025-01-01T00:00:00Z', usage: [] }],
        fetchedAt: '2025-01-01T00:00:00Z',
      }),
    })
    render(<UsageCards />)
    await waitFor(() => {
      expect(screen.getByText('U')).toBeInTheDocument()
    })
  })
})
