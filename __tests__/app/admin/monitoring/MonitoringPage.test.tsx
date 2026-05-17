import { vi, describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'

// getMonitoringStatsモック
const mockGetMonitoringStats = vi.fn()
vi.mock('@/lib/actions/admin/monitoring', () => ({
  getMonitoringStats: () => mockGetMonitoringStats(),
}))

describe('MonitoringPage', () => {
  const defaultStats = {
    health: {
      database: { status: 'healthy' as const, latencyMs: 5 },
      redis: { status: 'healthy' as const, latencyMs: 12 },
      timestamp: '2024-01-15T10:30:00.000Z',
    },
    counts: {
      totalUsers: 1234,
      totalPosts: 5678,
      activeUsersToday: 42,
      postsToday: 100,
      pendingReports: 3,
      pendingModeration: 7,
    },
    rateLimiting: {
      recentBlocks: 15,
    },
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mockGetMonitoringStats.mockResolvedValue({
      success: true,
      data: defaultStats,
    })
  })

  async function renderPage() {
    const { default: Page } = await import('@/app/admin/monitoring/page')
    const result = await Page()
    render(result)
  }

  it('ページタイトルを表示する', async () => {
    await renderPage()
    expect(screen.getByText('システム監視')).toBeInTheDocument()
  })

  it('PostgreSQLのヘルスカードを表示する', async () => {
    await renderPage()
    expect(screen.getByText('PostgreSQL')).toBeInTheDocument()
    expect(screen.getByText('5ms')).toBeInTheDocument()
  })

  it('Redisのヘルスカードを表示する', async () => {
    await renderPage()
    expect(screen.getByText('Redis (Upstash)')).toBeInTheDocument()
    expect(screen.getByText('12ms')).toBeInTheDocument()
  })

  it('正常ステータスバッジを表示する', async () => {
    await renderPage()
    const badges = screen.getAllByText('正常')
    expect(badges.length).toBe(2) // DB + Redis
  })

  it('統計カードの各ラベルを表示する', async () => {
    await renderPage()
    expect(screen.getByText('総ユーザー数')).toBeInTheDocument()
    expect(screen.getByText('総投稿数')).toBeInTheDocument()
    expect(screen.getByText('本日のアクティブユーザー')).toBeInTheDocument()
    expect(screen.getByText('本日の投稿数')).toBeInTheDocument()
    expect(screen.getByText('未処理の通報')).toBeInTheDocument()
    expect(screen.getByText('モデレーション待ち')).toBeInTheDocument()
  })

  it('統計カードに正しい値を表示する', async () => {
    await renderPage()
    expect(screen.getByText('1,234')).toBeInTheDocument()
    expect(screen.getByText('5,678')).toBeInTheDocument()
    expect(screen.getByText('42')).toBeInTheDocument()
    expect(screen.getByText('100')).toBeInTheDocument()
  })

  it('レート制限ブロック数を表示する', async () => {
    await renderPage()
    expect(screen.getByText('レート制限ブロック（24時間）')).toBeInTheDocument()
    expect(screen.getByText('15')).toBeInTheDocument()
  })

  it('エラー時にエラーメッセージを表示する', async () => {
    mockGetMonitoringStats.mockResolvedValue({
      success: false,
      error: '監視データの取得に失敗しました',
    })
    await renderPage()
    expect(screen.getByText('監視データの取得に失敗しました')).toBeInTheDocument()
    // エラー時はヘルスカードは表示されない
    expect(screen.queryByText('PostgreSQL')).not.toBeInTheDocument()
  })

  it('DBがunhealthyの場合、異常バッジとレイテンシ---を表示する', async () => {
    mockGetMonitoringStats.mockResolvedValue({
      success: true,
      data: {
        ...defaultStats,
        health: {
          ...defaultStats.health,
          database: { status: 'unhealthy', latencyMs: 0 },
        },
      },
    })
    await renderPage()
    expect(screen.getByText('異常')).toBeInTheDocument()
    expect(screen.getByText('---')).toBeInTheDocument()
  })

  it('Redisがdegradedの場合、低速バッジを表示する', async () => {
    mockGetMonitoringStats.mockResolvedValue({
      success: true,
      data: {
        ...defaultStats,
        health: {
          ...defaultStats.health,
          redis: { status: 'degraded', latencyMs: 600 },
        },
      },
    })
    await renderPage()
    expect(screen.getByText('低速')).toBeInTheDocument()
    expect(screen.getByText('600ms')).toBeInTheDocument()
  })

  it('インフラストラクチャセクションのヘッダーを表示する', async () => {
    await renderPage()
    expect(screen.getByText('インフラストラクチャ')).toBeInTheDocument()
  })

  it('アプリケーション統計セクションのヘッダーを表示する', async () => {
    await renderPage()
    expect(screen.getByText('アプリケーション統計')).toBeInTheDocument()
  })

  it('セキュリティセクションのヘッダーを表示する', async () => {
    await renderPage()
    expect(screen.getByText('セキュリティ')).toBeInTheDocument()
  })

  it('外部監視セクションを表示する', async () => {
    await renderPage()
    expect(screen.getByText('外部監視')).toBeInTheDocument()
    expect(screen.getByText('GET /api/health')).toBeInTheDocument()
  })

  it('要対応サブテキストを表示する', async () => {
    await renderPage()
    const subTexts = screen.getAllByText('要対応')
    expect(subTexts.length).toBe(2) // pendingReports + pendingModeration
  })
})
