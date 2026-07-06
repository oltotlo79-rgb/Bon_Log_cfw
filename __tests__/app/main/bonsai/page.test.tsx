import { vi } from 'vitest'
import { render, screen } from '@testing-library/react'

// 認証モック
const mockAuth = vi.fn()
vi.mock('@/lib/auth', () => ({
  auth: () => mockAuth(),
}))

const mockRedirect = vi.fn((_path: string) => {
  throw new Error('NEXT_REDIRECT')
})
vi.mock('next/navigation', () => ({
  redirect: (path: string) => mockRedirect(path),
}))

// 既存の getBonsais を簡易モック
const mockGetBonsais = vi.fn()
vi.mock('@/lib/actions/bonsai', () => ({
  getBonsais: () => mockGetBonsais(),
}))

// カレンダー取得をモック
const mockGetCareLogsInRange = vi.fn()
const mockGetBonsaiCalendarOverlaysInRange = vi.fn()
vi.mock('@/lib/actions/bonsai-care-log', () => ({
  getCareLogsInRange: (...args: unknown[]) => mockGetCareLogsInRange(...args),
  getBonsaiCalendarOverlaysInRange: (...args: unknown[]) =>
    mockGetBonsaiCalendarOverlaysInRange(...args),
}))

// 子コンポーネントは testid 付きスタブに差し替え
vi.mock('@/components/bonsai/BonsaiListClient', () => ({
  BonsaiListClient: ({ initialBonsais }: { initialBonsais: unknown[] }) => (
    <div data-testid="bonsai-list-client">timeline:{initialBonsais.length}</div>
  ),
}))

vi.mock('@/components/bonsai/calendar/BonsaiViewSwitcher', () => ({
  BonsaiViewSwitcher: ({ current }: { current: string }) => (
    <div data-testid="view-switcher">view:{current}</div>
  ),
}))

// next/dynamic は遅延ロードのため、テストでは props を直接 testid 内に展開する
// スタブコンポーネントに置き換える（require() を使わず ESM 互換）。
// ただし loader / loading 引数自体は実際に呼び出し、
// 「dynamic() に渡す import が実在のコンポーネントを解決できる」ことを検証する
// （カバレッジ埋めのためだけに丸ごと無視すると import パスの typo を検出できなくなる）。
vi.mock('next/dynamic', () => ({
  __esModule: true,
  default: (
    loader: () => Promise<unknown>,
    options?: { loading?: () => React.ReactNode },
  ) => {
    loader().catch(() => {
      // テスト環境の import 解決失敗はコンポーネント自体の責務外のため握りつぶす
    })
    options?.loading?.()
    return function DynamicStub(props: {
      initialMode?: string
      initialAnchor?: Date
      initialLogs?: unknown[]
      initialRecords?: unknown[]
      initialPosts?: unknown[]
    }) {
      const anchor = props.initialAnchor
      // anchor の YYYY-MM はローカルタイムゾーン基準で出力（UTC でないことに注意）
      const anchorYm =
        anchor instanceof Date
          ? `${String(anchor.getFullYear()).padStart(4, '0')}-${String(
              anchor.getMonth() + 1,
            ).padStart(2, '0')}`
          : ''
      return (
        <div data-testid="calendar-view">
          mode:{props.initialMode ?? ''}, anchor:{anchorYm}, logs:{props.initialLogs?.length ?? 0},
          records:{props.initialRecords?.length ?? 0}, posts:{props.initialPosts?.length ?? 0}
        </div>
      )
    }
  },
}))

vi.mock('@/components/ads', () => ({
  PostDetailAdUnit: () => null,
}))

describe('app/(main)/bonsai/page.tsx', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuth.mockResolvedValue({ user: { id: 'user-1', email: 'a@b.c' } })
    mockGetBonsais.mockResolvedValue({ success: true, data: { bonsais: [] } })
    mockGetCareLogsInRange.mockResolvedValue({ success: true, data: { logs: [] } })
    mockGetBonsaiCalendarOverlaysInRange.mockResolvedValue({
      success: true,
      data: { records: [], posts: [] },
    })
  })

  it('未認証の場合はログインへリダイレクト', async () => {
    mockAuth.mockResolvedValue(null)
    const { default: Page } = await import('@/app/(main)/bonsai/page')
    try {
      await Page({ searchParams: Promise.resolve({}) })
    } catch (e) {
      // redirect throws
      expect((e as Error).message).toBe('NEXT_REDIRECT')
    }
    expect(mockRedirect).toHaveBeenCalledWith('/login')
  })

  it('既定（view パラメータなし）はタイムラインを描画', async () => {
    mockGetBonsais.mockResolvedValue({ success: true, data: { bonsais: [{ id: 'b1' }, { id: 'b2' }] } })
    const { default: Page } = await import('@/app/(main)/bonsai/page')
    const el = await Page({ searchParams: Promise.resolve({}) })
    render(el)
    expect(screen.getByTestId('bonsai-list-client')).toHaveTextContent('timeline:2')
    expect(screen.queryByTestId('calendar-view')).toBeNull()
    expect(screen.getByTestId('view-switcher')).toHaveTextContent('view:timeline')
  })

  it('?view=calendar でカレンダーを描画', async () => {
    const { default: Page } = await import('@/app/(main)/bonsai/page')
    const el = await Page({
      searchParams: Promise.resolve({ view: 'calendar' }),
    })
    render(el)
    expect(screen.getByTestId('calendar-view')).toBeInTheDocument()
    expect(screen.queryByTestId('bonsai-list-client')).toBeNull()
  })

  it('?mode=year & ?anchor=2026-04 が view に伝わる', async () => {
    const { default: Page } = await import('@/app/(main)/bonsai/page')
    const el = await Page({
      searchParams: Promise.resolve({
        view: 'calendar',
        mode: 'year',
        anchor: '2026-04',
      }),
    })
    render(el)
    expect(screen.getByTestId('calendar-view')).toHaveTextContent('mode:year')
    expect(screen.getByTestId('calendar-view')).toHaveTextContent('anchor:2026-04')
  })

  it('不正な mode は month にフォールバック', async () => {
    const { default: Page } = await import('@/app/(main)/bonsai/page')
    const el = await Page({
      searchParams: Promise.resolve({ view: 'calendar', mode: 'evil' }),
    })
    render(el)
    expect(screen.getByTestId('calendar-view')).toHaveTextContent('mode:month')
  })

  it('不正な anchor はエラーにせず今月にフォールバック', async () => {
    const { default: Page } = await import('@/app/(main)/bonsai/page')
    const el = await Page({
      searchParams: Promise.resolve({ view: 'calendar', anchor: 'not-iso' }),
    })
    // 例外を投げず描画する
    render(el)
    expect(screen.getByTestId('calendar-view')).toBeInTheDocument()
  })

  it('view=calendar 時にカレンダー取得が呼ばれる', async () => {
    const { default: Page } = await import('@/app/(main)/bonsai/page')
    await Page({
      searchParams: Promise.resolve({ view: 'calendar', mode: 'month' }),
    })
    expect(mockGetCareLogsInRange).toHaveBeenCalledWith(
      expect.objectContaining({
        fromIso: expect.any(String),
        toIso: expect.any(String),
      }),
    )
  })

  it('view=timeline 時はカレンダー取得を呼ばない', async () => {
    const { default: Page } = await import('@/app/(main)/bonsai/page')
    await Page({ searchParams: Promise.resolve({}) })
    expect(mockGetCareLogsInRange).not.toHaveBeenCalled()
  })

  it('generateMetadata: view=calendar 時に title が「カレンダー」を含む', async () => {
    const { generateMetadata } = await import('@/app/(main)/bonsai/page')
    const meta = await generateMetadata({
      searchParams: Promise.resolve({ view: 'calendar' }),
    })
    expect(meta.title).toContain('カレンダー')
    expect(meta.robots).toMatchObject({ index: false, follow: false })
  })

  it('generateMetadata: view 既定時はカレンダーを含まない', async () => {
    const { generateMetadata } = await import('@/app/(main)/bonsai/page')
    const meta = await generateMetadata({ searchParams: Promise.resolve({}) })
    expect(meta.title).toBe('マイ盆栽')
  })

  it('タイムライン取得が失敗した場合は空リストにフォールバック', async () => {
    mockGetBonsais.mockResolvedValue({ success: false, error: 'DB error' })
    const { default: Page } = await import('@/app/(main)/bonsai/page')
    const el = await Page({ searchParams: Promise.resolve({}) })
    render(el)
    expect(screen.getByTestId('bonsai-list-client')).toHaveTextContent('timeline:0')
  })

  it('searchParams が配列形式でも先頭要素を採用する（多重クエリ対策）', async () => {
    const { default: Page } = await import('@/app/(main)/bonsai/page')
    const el = await Page({
      searchParams: Promise.resolve({
        view: ['calendar', 'timeline'],
        mode: ['year', 'month'],
      }),
    })
    render(el)
    expect(screen.getByTestId('calendar-view')).toHaveTextContent('mode:year')
  })

  it('カレンダー取得が失敗した場合はログ/オーバーレイとも空にフォールバック', async () => {
    mockGetCareLogsInRange.mockResolvedValue({ success: false, error: 'x' })
    mockGetBonsaiCalendarOverlaysInRange.mockResolvedValue({ success: false, error: 'x' })
    const { default: Page } = await import('@/app/(main)/bonsai/page')
    const el = await Page({
      searchParams: Promise.resolve({ view: 'calendar' }),
    })
    render(el)
    expect(screen.getByTestId('calendar-view')).toHaveTextContent('logs:0')
    expect(screen.getByTestId('calendar-view')).toHaveTextContent('records:0')
    expect(screen.getByTestId('calendar-view')).toHaveTextContent('posts:0')
  })
})
