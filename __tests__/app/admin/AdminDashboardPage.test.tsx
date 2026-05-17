import { vi } from 'vitest'
import { render, screen } from '@testing-library/react'

vi.mock('next/link', () => ({
  __esModule: true,
  default: ({
    children,
    href,
    role,
    'aria-selected': ariaSelected,
    'aria-current': ariaCurrent,
  }: {
    children: React.ReactNode
    href: string
    role?: string
    'aria-selected'?: boolean
    'aria-current'?: 'page' | undefined
  }) => (
    <a
      href={href}
      role={role}
      aria-selected={ariaSelected}
      aria-current={ariaCurrent}
    >
      {children}
    </a>
  ),
}))

const mockGetAdminStats = vi.fn()
const mockGetDailyVisitorsHistory = vi.fn()
vi.mock('@/lib/actions/admin/stats', () => ({
  getAdminStats: () => mockGetAdminStats(),
  getDailyVisitorsHistory: (days: number) => mockGetDailyVisitorsHistory(days),
}))

vi.mock('@/app/admin/DailyVisitorsChart', () => ({
  DailyVisitorsChart: ({ data }: { data: unknown[] }) => (
    <div data-testid="visitors-chart" data-points={data.length} />
  ),
}))

const mockGetReportStats = vi.fn()
vi.mock('@/lib/actions/report', () => ({
  getReportStats: () => mockGetReportStats(),
}))

const mockGetPendingShopChangeRequestCount = vi.fn()
vi.mock('@/lib/actions/shop', () => ({
  getPendingShopChangeRequestCount: () => mockGetPendingShopChangeRequestCount(),
}))

vi.mock('@/app/admin/SentryErrors', () => ({
  SentryErrors: () => <div data-testid="sentry-errors" />,
}))

describe('AdminDashboardPage', async () => {
  const defaultStats = {
    totalUsers: 1234,
    todayUsers: 5,
    totalPosts: 5678,
    todayPosts: 42,
    pendingReports: 3,
    activeUsersWeek: 789,
    totalEvents: 15,
    totalShops: 22,
  }

  const defaultReportStats = {
    stats: {
      pending: 3,
      reviewed: 2,
      resolved: 10,
      dismissed: 1,
      byType: { post: 8, comment: 3, user: 2 },
    },
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mockGetAdminStats.mockResolvedValue({ success: true, data: defaultStats })
    mockGetReportStats.mockResolvedValue(defaultReportStats)
    mockGetPendingShopChangeRequestCount.mockResolvedValue({ count: 4 })
    // 受け取った days 引数の長さの配列をそのまま返す（呼び出し検証も兼ねる）
    mockGetDailyVisitorsHistory.mockImplementation((days: number) =>
      Promise.resolve({
        success: true,
        data: Array.from({ length: days }, (_, i) => ({
          date: new Date(Date.now() - (days - 1 - i) * 86400000)
            .toISOString()
            .split('T')[0],
          visitors: i,
        })),
      }),
    )
  })

  async function renderPage(searchParamsValue: { range?: string } = {}) {
    const { default: Page } = await import('@/app/admin/page')
    const result = await Page({ searchParams: Promise.resolve(searchParamsValue) })
    render(result)
  }

  it('統計情報を表示する', async () => {
    await renderPage()

    expect(screen.getByText('ダッシュボード')).toBeInTheDocument()
    expect(screen.getByText('1,234')).toBeInTheDocument()
    expect(screen.getByText('+5 今日')).toBeInTheDocument()
    expect(screen.getByText('5,678')).toBeInTheDocument()
    expect(screen.getByText('+42 今日')).toBeInTheDocument()
    expect(screen.getByText('789')).toBeInTheDocument()
  })

  it('未対応通報数を表示する', async () => {
    await renderPage()
    expect(screen.getByText('未対応通報')).toBeInTheDocument()
    expect(screen.getAllByText('3').length).toBeGreaterThanOrEqual(1)
  })

  it('変更リクエスト数を表示する', async () => {
    await renderPage()
    expect(screen.getByText('4')).toBeInTheDocument()
    expect(screen.getByText('未対応変更リクエスト')).toBeInTheDocument()
  })

  it('イベント・盆栽園数を表示する', async () => {
    await renderPage()
    expect(screen.getByText('15')).toBeInTheDocument()
    expect(screen.getByText('22')).toBeInTheDocument()
  })

  it('通報統計を表示する', async () => {
    await renderPage()
    expect(screen.getByText('通報統計')).toBeInTheDocument()
    expect(screen.getByText('未対応')).toBeInTheDocument()
    expect(screen.getByText('確認中')).toBeInTheDocument()
    expect(screen.getByText('対応完了')).toBeInTheDocument()
    expect(screen.getByText('却下')).toBeInTheDocument()
  })

  it('種別ごとの通報を表示する', async () => {
    await renderPage()
    expect(screen.getByText('種別ごとの通報')).toBeInTheDocument()
    expect(screen.getByText(/投稿.*: \d+件/)).toBeInTheDocument()
    expect(screen.getByText(/コメント.*: \d+件/)).toBeInTheDocument()
  })

  it('通報統計がない場合は通報セクションを非表示', async () => {
    mockGetReportStats.mockResolvedValue({ error: 'failed' })
    await renderPage()
    expect(screen.queryByText('通報統計')).not.toBeInTheDocument()
  })

  it('クイックアクションリンクを表示する', async () => {
    await renderPage()
    expect(screen.getByText('クイックアクション')).toBeInTheDocument()
    expect(screen.getByText('ユーザー管理')).toBeInTheDocument()
    expect(screen.getByText('投稿管理')).toBeInTheDocument()
    expect(screen.getByText('レビュー管理')).toBeInTheDocument()
    expect(screen.getByText('通報管理')).toBeInTheDocument()
    expect(screen.getByText('操作ログ')).toBeInTheDocument()
  })

  it('クイックアクションのリンク先が正しい', async () => {
    await renderPage()
    expect(screen.getByText('ユーザー管理').closest('a')).toHaveAttribute('href', '/admin/users')
    expect(screen.getByText('投稿管理').closest('a')).toHaveAttribute('href', '/admin/posts')
    expect(screen.getByText('通報管理').closest('a')).toHaveAttribute('href', '/admin/reports')
  })

  it('SentryErrorsコンポーネントを表示する', async () => {
    await renderPage()
    expect(screen.getByTestId('sentry-errors')).toBeInTheDocument()
  })

  it('過去30日のアクセス推移セクションと訪問者チャートを表示する', async () => {
    await renderPage()
    expect(screen.getByText('過去30日のアクセス推移')).toBeInTheDocument()
    const chart = screen.getByTestId('visitors-chart')
    expect(chart).toBeInTheDocument()
    expect(chart).toHaveAttribute('data-points', '30')
  })

  it('訪問者取得が ActionResult エラーを返した場合はチャートを非表示', async () => {
    mockGetDailyVisitorsHistory.mockResolvedValue({ success: false, error: '管理者権限が必要です' })
    await renderPage()
    expect(screen.queryByText('過去30日のアクセス推移')).not.toBeInTheDocument()
    expect(screen.queryByTestId('visitors-chart')).not.toBeInTheDocument()
  })

  it('訪問者履歴が空配列の場合はチャートセクションを非表示', async () => {
    mockGetDailyVisitorsHistory.mockResolvedValue({ success: true, data: [] })
    await renderPage()
    expect(screen.queryByText('過去30日のアクセス推移')).not.toBeInTheDocument()
  })

  it('変更リクエスト0件の場合は通常色', async () => {
    mockGetPendingShopChangeRequestCount.mockResolvedValue({ count: 0 })
    await renderPage()
    expect(screen.getByText('0')).toBeInTheDocument()
  })

  it('byTypeが空の場合は種別セクション非表示', async () => {
    mockGetReportStats.mockResolvedValue({
      stats: { ...defaultReportStats.stats, byType: {} },
    })
    await renderPage()
    expect(screen.queryByText('種別ごとの通報')).not.toBeInTheDocument()
  })

  // ============================================================
  // 期間切替（?range=30|90|180）の検証
  // ============================================================
  describe('アクセス推移の期間切替', () => {
    it('range 未指定時はデフォルト 30 日で取得し見出しが「過去30日」', async () => {
      await renderPage()
      expect(mockGetDailyVisitorsHistory).toHaveBeenCalledWith(30)
      expect(screen.getByText('過去30日のアクセス推移')).toBeInTheDocument()
    })

    it('?range=90 で 90 日取得し見出しが「過去90日」、データポイントも 90 件', async () => {
      await renderPage({ range: '90' })
      expect(mockGetDailyVisitorsHistory).toHaveBeenCalledWith(90)
      expect(screen.getByText('過去90日のアクセス推移')).toBeInTheDocument()
      expect(screen.getByTestId('visitors-chart')).toHaveAttribute('data-points', '90')
    })

    it('?range=180 で 180 日取得し見出しが「過去180日」', async () => {
      await renderPage({ range: '180' })
      expect(mockGetDailyVisitorsHistory).toHaveBeenCalledWith(180)
      expect(screen.getByText('過去180日のアクセス推移')).toBeInTheDocument()
      expect(screen.getByTestId('visitors-chart')).toHaveAttribute('data-points', '180')
    })

    it('未許可の値（999）はデフォルト 30 にフォールバックする', async () => {
      await renderPage({ range: '999' })
      expect(mockGetDailyVisitorsHistory).toHaveBeenCalledWith(30)
      expect(screen.getByText('過去30日のアクセス推移')).toBeInTheDocument()
    })

    it('数値以外の値（"foo"）はデフォルト 30 にフォールバックする', async () => {
      await renderPage({ range: 'foo' })
      expect(mockGetDailyVisitorsHistory).toHaveBeenCalledWith(30)
    })

    it('空文字列はデフォルト 30 にフォールバックする', async () => {
      await renderPage({ range: '' })
      expect(mockGetDailyVisitorsHistory).toHaveBeenCalledWith(30)
    })

    it('小数（"30.5"）も拒否してデフォルトにフォールバックする', async () => {
      await renderPage({ range: '30.5' })
      expect(mockGetDailyVisitorsHistory).toHaveBeenCalledWith(30)
    })

    it('NaN を含む文字列はデフォルトにフォールバックする', async () => {
      await renderPage({ range: 'NaN' })
      expect(mockGetDailyVisitorsHistory).toHaveBeenCalledWith(30)
    })

    it('タブは tablist 内に 30/90/180 の 3 つだけ並ぶ', async () => {
      await renderPage()
      const tablist = screen.getByRole('tablist', { name: 'アクセス推移の表示期間' })
      const tabs = tablist.querySelectorAll('a[role="tab"]')
      expect(tabs).toHaveLength(3)
      expect(tabs[0]).toHaveTextContent('過去30日')
      expect(tabs[1]).toHaveTextContent('過去90日')
      expect(tabs[2]).toHaveTextContent('過去180日')
    })

    it('現在の range と一致するタブだけ aria-selected=true / aria-current=page', async () => {
      await renderPage({ range: '90' })
      const tabs = Array.from(
        screen
          .getByRole('tablist', { name: 'アクセス推移の表示期間' })
          .querySelectorAll('a[role="tab"]'),
      )
      const active = tabs.find((t) => t.textContent === '過去90日') as HTMLAnchorElement
      const inactive30 = tabs.find((t) => t.textContent === '過去30日') as HTMLAnchorElement
      const inactive180 = tabs.find((t) => t.textContent === '過去180日') as HTMLAnchorElement
      expect(active.getAttribute('aria-selected')).toBe('true')
      expect(active.getAttribute('aria-current')).toBe('page')
      expect(inactive30.getAttribute('aria-selected')).toBe('false')
      expect(inactive30.getAttribute('aria-current')).toBeNull()
      expect(inactive180.getAttribute('aria-selected')).toBe('false')
    })

    it('タブの href は ?range= 付きで構築される', async () => {
      await renderPage()
      const tabs = Array.from(
        screen
          .getByRole('tablist', { name: 'アクセス推移の表示期間' })
          .querySelectorAll('a[role="tab"]'),
      ) as HTMLAnchorElement[]
      expect(tabs[0].getAttribute('href')).toBe('/admin?range=30')
      expect(tabs[1].getAttribute('href')).toBe('/admin?range=90')
      expect(tabs[2].getAttribute('href')).toBe('/admin?range=180')
    })

    it('延べ訪問者数とピーク値は選択中の期間のデータから集計される', async () => {
      // 期間を 90 にし visitors=[0..89] を返す → 合計 = 0+1+..+89 = 4005, ピーク = 89
      await renderPage({ range: '90' })
      expect(screen.getByText(/延べ 4,005 人/)).toBeInTheDocument()
      expect(screen.getByText(/ピーク 89 人/)).toBeInTheDocument()
    })
  })

  // ============================================================
  // SEO / robots — 管理画面は noindex
  // ============================================================
  describe('metadata', () => {
    it('robots は { index: false, follow: false } で検索エンジンに公開しない', async () => {
      const mod = await import('@/app/admin/page')
      expect(mod.metadata.robots).toEqual({ index: false, follow: false })
    })
  })
})
