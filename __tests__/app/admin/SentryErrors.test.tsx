

import { vi } from 'vitest'
import { render, screen, waitFor, fireEvent } from '../../utils/test-utils'
import { SentryErrors } from '@/app/admin/SentryErrors'

// Mock date-fns
vi.mock('date-fns', () => ({
  formatDistanceToNow: () => '3時間前',
}))
vi.mock('date-fns/locale', () => ({
  ja: {},
}))

const mockFetch = vi.fn()
global.fetch = mockFetch as unknown as typeof fetch

describe('SentryErrors', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('ローディング中にスピナーを表示する', () => {
    mockFetch.mockReturnValue(new Promise(() => {})) // never resolves
    render(<SentryErrors />)
    expect(screen.getByText('Sentryエラー')).toBeInTheDocument()
  })

  it('エラー時にエラーメッセージを表示する', async () => {
    mockFetch.mockResolvedValue({
      json: () => Promise.resolve({ success: false, error: 'トークンが無効です', helpText: 'ヘルプ', helpUrl: 'https://example.com', debug: { url: 'http://api', tokenPrefix: 'sntrys_', tokenLength: 50, org: 'org', project: 'proj' } }),
    })
    render(<SentryErrors />)
    await waitFor(() => {
      expect(screen.getByText('トークンが無効です')).toBeInTheDocument()
    })
    expect(screen.getByText('ヘルプ')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /トークンを作成/ })).toBeInTheDocument()
    expect(screen.getByText(/sntrys_/)).toBeInTheDocument()
  })

  it('成功時にエラーなしメッセージを表示する', async () => {
    mockFetch.mockResolvedValue({
      json: () => Promise.resolve({ success: true, issues: [], dashboardUrl: 'https://sentry.io' }),
    })
    render(<SentryErrors />)
    await waitFor(() => {
      expect(screen.getByText('未解決のエラーはありません')).toBeInTheDocument()
    })
  })

  it('成功時にイシューリストを表示する', async () => {
    mockFetch.mockResolvedValue({
      json: () => Promise.resolve({
        success: true,
        issues: [{
          id: '1', shortId: 'PROJ-1', title: 'TypeError', culprit: 'app/page.tsx',
          level: 'error', status: 'unresolved', count: '5', userCount: 2,
          firstSeen: '2025-01-01', lastSeen: '2025-01-02', permalink: 'https://sentry.io/1',
        }],
        dashboardUrl: 'https://sentry.io',
      }),
    })
    render(<SentryErrors />)
    await waitFor(() => {
      expect(screen.getByText('TypeError')).toBeInTheDocument()
    })
    expect(screen.getByText('app/page.tsx')).toBeInTheDocument()
    expect(screen.getByText('5回')).toBeInTheDocument()
    expect(screen.getByText('エラー')).toBeInTheDocument()
    expect(screen.getByText('PROJ-1')).toBeInTheDocument()
  })

  it('イシュー数バッジを表示する', async () => {
    mockFetch.mockResolvedValue({
      json: () => Promise.resolve({
        success: true,
        issues: [
          { id: '1', shortId: 'P-1', title: 'Err1', culprit: '', level: 'fatal', status: '', count: '1', userCount: 0, firstSeen: '', lastSeen: '2025-01-01', permalink: '' },
          { id: '2', shortId: 'P-2', title: 'Err2', culprit: '', level: 'warning', status: '', count: '2', userCount: 0, firstSeen: '', lastSeen: '2025-01-01', permalink: '' },
        ],
      }),
    })
    render(<SentryErrors />)
    await waitFor(() => {
      expect(screen.getByText('2')).toBeInTheDocument()
    })
    expect(screen.getByText('致命的')).toBeInTheDocument()
    expect(screen.getByText('警告')).toBeInTheDocument()
  })

  it('更新ボタンでデータを再取得する', async () => {
    mockFetch.mockResolvedValue({
      json: () => Promise.resolve({ success: true, issues: [] }),
    })
    render(<SentryErrors />)
    await waitFor(() => {
      expect(screen.getByText('未解決のエラーはありません')).toBeInTheDocument()
    })
    fireEvent.click(screen.getByTitle('更新'))
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledTimes(2)
    })
  })

  it('fetch例外でエラーメッセージを表示する', async () => {
    mockFetch.mockRejectedValue(new Error('network error'))
    render(<SentryErrors />)
    await waitFor(() => {
      expect(screen.getByText('取得に失敗しました')).toBeInTheDocument()
    })
  })
})
