import { vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import React from 'react'

/**
 * イベント一覧ページのテスト
 * - カレンダー/リスト表示切り替え
 * - 過去イベント表示切り替え
 * - 地域フィルター
 * - ゲストユーザー判定
 * - 今後のイベントフィルタリング
 */

/**
 * Helper to render a page that contains async Server Components.
 */
async function resolveAsyncJsx(element: React.ReactElement): Promise<React.ReactElement> {
  if (!element || typeof element !== 'object') return element

  const { type, props } = element
  const typedProps = props as Record<string, unknown>

  if (typeof type === 'function') {
    try {
      const result = (type as (props: Record<string, unknown>) => Promise<React.ReactElement>)(typedProps)
      if (result && typeof result === 'object' && 'then' in result) {
        const resolved = await result
        return resolveAsyncJsx(resolved)
      }
      return resolveAsyncJsx(result as React.ReactElement)
    } catch {
      return element
    }
  }

  if (typedProps?.children) {
    const children = Array.isArray(typedProps.children)
      ? await Promise.all((typedProps.children as React.ReactNode[]).map(async (child: React.ReactNode, i: number) => {
          if (!React.isValidElement(child)) return child
          const resolved = await resolveAsyncJsx(child)
          // cloneElement で静的 children を明示配列にすると React が key を要求するため、
          // key の無い要素には index ベースの key を補う (test 専用 render で reconcile しない)
          return React.isValidElement(resolved) && resolved.key == null
            ? React.cloneElement(resolved, { key: `__rk${i}` })
            : resolved
        }))
      : React.isValidElement(typedProps.children)
        ? await resolveAsyncJsx(typedProps.children as React.ReactElement)
        : typedProps.children

    return React.cloneElement(element, { ...typedProps, children } as React.Attributes)
  }

  return element
}

const mockAuth = vi.fn()
vi.mock('@/lib/auth', () => ({ auth: () => mockAuth() }))

const mockGetEvents = vi.fn()
vi.mock('@/lib/actions/event', () => ({
  getEvents: (...args: unknown[]) => mockGetEvents(...args),
}))

vi.mock('next/link', () => ({
  __esModule: true,
  default: ({ children, href, className }: { children: React.ReactNode; href: string; className?: string }) => (
    <a href={href} className={className}>{children}</a>
  ),
}))

vi.mock('@/components/common/GuestRestrictionOverlay', () => ({
  GuestRestrictionOverlay: ({ children, isGuest, contentName }: { children: React.ReactNode; isGuest: boolean; contentName: string }) => (
    <div data-testid="guest-overlay" data-is-guest={isGuest} data-content-name={contentName}>
      {children}
    </div>
  ),
}))

vi.mock('@/components/event/EventCalendarWrapper', () => ({
  EventCalendarWrapper: ({ events, initialYear, initialMonth }: { events: unknown[]; initialYear?: number; initialMonth?: number }) => (
    <div data-testid="event-calendar" data-count={events.length} data-year={initialYear} data-month={initialMonth} />
  ),
}))

vi.mock('@/components/event/EventList', () => ({
  EventList: ({ events, emptyMessage }: { events: unknown[]; emptyMessage: string }) => (
    <div data-testid="event-list" data-count={events.length} data-empty-message={emptyMessage} />
  ),
}))

vi.mock('@/components/event/RegionFilter', () => ({
  RegionFilter: ({ currentRegion, currentPrefecture }: { currentRegion?: string; currentPrefecture?: string }) => (
    <div data-testid="region-filter" data-region={currentRegion} data-prefecture={currentPrefecture} />
  ),
}))

vi.mock('@/components/event/ShowPastToggle', () => ({
  ShowPastToggle: ({ showPast }: { showPast: boolean }) => (
    <div data-testid="show-past-toggle" data-show-past={showPast} />
  ),
}))

vi.mock('@/components/event/EventFilterPersistence', () => ({
  EventFilterPersistence: () => <div data-testid="filter-persistence" />,
}))

vi.mock('lucide-react', () => ({
  Plus: ({ className }: { className?: string }) => <span data-testid="plus-icon" className={className} />,
  Calendar: ({ className }: { className?: string }) => <span data-testid="calendar-icon" className={className} />,
  List: ({ className }: { className?: string }) => <span data-testid="list-icon" className={className} />,
}))

// 将来のイベント
const futureDate = new Date(Date.now() + 86400000 * 30).toISOString()
// 過去のイベント
const pastDate = new Date(Date.now() - 86400000 * 30).toISOString()

const mockEvents = [
  { id: 'ev-1', title: '盆栽展', startDate: futureDate, endDate: null, region: '関東', prefecture: '東京都' },
  { id: 'ev-2', title: '盆栽教室', startDate: pastDate, endDate: null, region: '近畿', prefecture: '大阪府' },
  { id: 'ev-3', title: '盆栽即売会', startDate: futureDate, endDate: new Date(Date.now() + 86400000 * 60).toISOString(), region: '関東', prefecture: '埼玉県' },
]

async function renderPage(searchParams: Record<string, string> = {}) {
  const mod = await import('@/app/(main)/events/page')
  const Page = mod.default
  const result = await Page({ searchParams: Promise.resolve(searchParams) })
  const resolved = await resolveAsyncJsx(result)
  render(resolved)
}

describe('EventsPage', () => {
  beforeEach(async () => {
    vi.clearAllMocks()
    mockAuth.mockResolvedValue(null)
    mockGetEvents.mockResolvedValue({ events: mockEvents })
  }, 20000)

  it('カレンダー表示がデフォルト', async () => {
    await renderPage()

    expect(screen.getByTestId('event-calendar')).toBeInTheDocument()
    expect(screen.getByText('今後のイベント')).toBeInTheDocument()
  })

  it('リスト表示モード', async () => {
    await renderPage({ view: 'list' })

    // リストモードではカレンダーは表示されない
    expect(screen.queryByTestId('event-calendar')).not.toBeInTheDocument()
    expect(screen.getByText('イベント一覧')).toBeInTheDocument()
  })

  it('リスト表示: 全イベントの件数が表示される', async () => {
    await renderPage({ view: 'list' })

    // リストモードの EventList は全イベントを受け取る
    const lists = screen.getAllByTestId('event-list')
    const listViewList = lists.find(el => el.getAttribute('data-empty-message') === '該当するイベントがありません')
    expect(listViewList).toHaveAttribute('data-count', '3')
  })

  it('カレンダー表示: 今後のイベントのみフィルタされる', async () => {
    await renderPage()

    // 今後のイベントリスト（pastDateのイベントは除外される）
    const lists = screen.getAllByTestId('event-list')
    const upcomingList = lists.find(el => el.getAttribute('data-empty-message') === '今後のイベントはありません')
    // ev-1 (future) と ev-3 (future with endDate) のみ
    expect(upcomingList).toHaveAttribute('data-count', '2')
  })

  it('過去イベント表示フラグがgetEventsに渡される', async () => {
    await renderPage({ showPast: 'true' })

    expect(mockGetEvents).toHaveBeenCalledWith(
      expect.objectContaining({ showPast: true })
    )
  })

  it('過去イベント非表示: showPast=false', async () => {
    await renderPage()

    expect(mockGetEvents).toHaveBeenCalledWith(
      expect.objectContaining({ showPast: false })
    )
  })

  it('地域フィルターのパラメータがgetEventsに渡される', async () => {
    await renderPage({ region: '関東', prefecture: '東京都' })

    expect(mockGetEvents).toHaveBeenCalledWith({
      region: '関東',
      prefecture: '東京都',
      showPast: false,
    })
  })

  it('地域フィルターコンポーネントに値が渡される', async () => {
    await renderPage({ region: '近畿', prefecture: '大阪府' })

    const filter = screen.getByTestId('region-filter')
    expect(filter).toHaveAttribute('data-region', '近畿')
    expect(filter).toHaveAttribute('data-prefecture', '大阪府')
  })

  it('ShowPastToggleにshowPast値が渡される', async () => {
    await renderPage({ showPast: 'true' })

    expect(screen.getByTestId('show-past-toggle')).toHaveAttribute('data-show-past', 'true')
  })

  it('ShowPastToggle: デフォルトはfalse', async () => {
    await renderPage()

    expect(screen.getByTestId('show-past-toggle')).toHaveAttribute('data-show-past', 'false')
  })

  it('カレンダーにyear/monthが渡される', async () => {
    await renderPage({ year: '2026', month: '6' })

    const calendar = screen.getByTestId('event-calendar')
    expect(calendar).toHaveAttribute('data-year', '2026')
    expect(calendar).toHaveAttribute('data-month', '6')
  })

  it('year/month未指定の場合: undefinedが渡される', async () => {
    await renderPage()

    const calendar = screen.getByTestId('event-calendar')
    expect(calendar.getAttribute('data-year')).toBeNull()
    expect(calendar.getAttribute('data-month')).toBeNull()
  })

  it('ゲストユーザーでもページが表示される（公開ページ）', async () => {
    mockAuth.mockResolvedValue({
      user: { id: 'guest-1', email: 'guest@example.com' },
      expires: '',
    })

    await renderPage()

    expect(screen.getByTestId('event-calendar')).toBeInTheDocument()
  })

  it('認証済みユーザーでページが表示される', async () => {
    mockAuth.mockResolvedValue({
      user: { id: 'user-1', email: 'user@example.com' },
      expires: '',
    })

    await renderPage()

    expect(screen.getByTestId('event-calendar')).toBeInTheDocument()
  })

  it('未ログインでもページが表示される（公開ページ）', async () => {
    mockAuth.mockResolvedValue(null)

    await renderPage()

    expect(screen.getByTestId('event-calendar')).toBeInTheDocument()
  })

  it('イベント登録リンクが表示される', async () => {
    await renderPage()

    const link = screen.getByText('イベントを登録').closest('a')
    expect(link).toHaveAttribute('href', '/events/new')
  })

  it('空のイベント: カレンダー表示', async () => {
    mockGetEvents.mockResolvedValue({ events: [] })

    await renderPage()

    expect(screen.getByTestId('event-calendar')).toHaveAttribute('data-count', '0')
    expect(screen.getByText('(0件)')).toBeInTheDocument()
  })

  it('空のイベント: リスト表示', async () => {
    mockGetEvents.mockResolvedValue({ events: [] })

    await renderPage({ view: 'list' })

    const lists = screen.getAllByTestId('event-list')
    expect(lists[0]).toHaveAttribute('data-count', '0')
  })

  it('カレンダー表示: endDateがある過去イベントは除外される', async () => {
    const eventsWithEndDate = [
      { id: 'ev-past-end', title: '終了済み', startDate: pastDate, endDate: pastDate, region: '関東', prefecture: '東京都' },
      { id: 'ev-future', title: '開催中', startDate: futureDate, endDate: null, region: '関東', prefecture: '東京都' },
    ]
    mockGetEvents.mockResolvedValue({ events: eventsWithEndDate })

    await renderPage()

    const lists = screen.getAllByTestId('event-list')
    const upcomingList = lists.find(el => el.getAttribute('data-empty-message') === '今後のイベントはありません')
    expect(upcomingList).toHaveAttribute('data-count', '1')
  })

  it('EventFilterPersistenceが表示される', async () => {
    await renderPage()

    expect(screen.getByTestId('filter-persistence')).toBeInTheDocument()
  })

  it('カレンダー/リスト切り替えリンクのhrefが正しい', async () => {
    await renderPage({ region: '関東' })

    const calendarLink = screen.getByText('カレンダー').closest('a')
    expect(calendarLink?.getAttribute('href')).toContain('view=calendar')

    const listLink = screen.getByText('リスト').closest('a')
    expect(listLink?.getAttribute('href')).toContain('view=list')
  })

  it('カレンダー表示時にカレンダーボタンがアクティブスタイルを持つ', async () => {
    await renderPage()

    const calendarLink = screen.getByText('カレンダー').closest('a')
    expect(calendarLink?.className).toContain('bg-primary')
  })

  it('リスト表示時にリストボタンがアクティブスタイルを持つ', async () => {
    await renderPage({ view: 'list' })

    const listLink = screen.getByText('リスト').closest('a')
    expect(listLink?.className).toContain('bg-primary')
  })
})

describe('EventsPage metadata', async () => {
  it('正しいメタデータがエクスポートされる', async () => {
    const mod = await import('@/app/(main)/events/page')
    expect(mod.metadata).toMatchObject({
      title: 'イベント | BON-LOG',
      description: '全国の盆栽展・愛好会・体験教室などのイベント情報。カレンダーと地域フィルターで開催予定を確認できます。',
    })
    // canonical は SEO 用に追加: 絶対 URL であることを確認
    expect(mod.metadata.alternates?.canonical).toMatch(/\/events$/)
  })
})
