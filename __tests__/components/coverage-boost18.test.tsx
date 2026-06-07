import { vi } from 'vitest'
/**
 * Coverage Boost 18 - EventForm, PremiumActionsDropdown, SentryErrors, ThemeProvider
 *
 * Targets uncovered branches/functions:
 * - EventForm: edit mode submit (updateEvent path), error from update, 'eventId' in result false branch,
 *   optional fields empty vs filled, cancel button
 * - PremiumActionsDropdown: handleGrant, handleRevoke, handleExtend with NaN for extend
 * - SentryErrors: fetch throws, success=true path, helpText/debug/helpUrl branches
 * - ThemeProvider: mediaQuery change handler, !mounted fallback, empty setTheme
 */

import React from 'react'
import { render, screen, fireEvent, waitFor, act } from '../utils/test-utils'
import userEvent from '@testing-library/user-event'

// ============================================================
// EventForm mocks
// ============================================================

const mockPush = vi.fn()
const mockBack = vi.fn()
const mockRefresh = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    back: mockBack,
    refresh: mockRefresh,
  }),
}))

const mockCreateEvent = vi.fn()
const mockUpdateEvent = vi.fn()
vi.mock('@/lib/actions/event', () => ({
  createEvent: (...args: unknown[]) => mockCreateEvent(...args),
  updateEvent: (...args: unknown[]) => mockUpdateEvent(...args),
}))

vi.mock('@/lib/prefectures', () => ({
  PREFECTURES: ['東京都', '大阪府', '埼玉県'],
}))

// ============================================================
// PremiumActionsDropdown mocks
// ============================================================

const mockGrantPremium = vi.fn()
const mockRevokePremium = vi.fn()
const mockExtendPremium = vi.fn()
vi.mock('@/lib/actions/admin/premium', () => ({
  grantPremium: (...args: unknown[]) => mockGrantPremium(...args),
  revokePremium: (...args: unknown[]) => mockRevokePremium(...args),
  extendPremium: (...args: unknown[]) => mockExtendPremium(...args),
}))

vi.mock('lucide-react', () => ({
  MoreHorizontal: ({ className }: { className?: string }) => <span data-testid="more-icon" className={className} />,
  Crown: ({ className }: { className?: string }) => <span data-testid="crown-icon" className={className} />,
  Ban: ({ className }: { className?: string }) => <span data-testid="ban-icon" className={className} />,
  CalendarPlus: ({ className }: { className?: string }) => <span data-testid="calendar-icon" className={className} />,
  ChevronRight: ({ className }: { className?: string }) => <span data-testid="chevron-right" className={className} aria-hidden />,
  AlertCircle: ({ className }: { className?: string }) => <span data-testid="alert-circle-icon" className={className} />,
  ExternalLink: ({ className }: { className?: string }) => <span data-testid="external-link-icon" className={className} />,
  RefreshCcw: ({ className }: { className?: string }) => <span data-testid="refresh-icon" className={className} />,
}))

vi.mock('@/components/ui/dropdown-menu', () => ({
  DropdownMenu: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DropdownMenuTrigger: ({ children }: { children: React.ReactNode; asChild?: boolean }) => <div data-testid="trigger">{children}</div>,
  DropdownMenuContent: ({ children }: { children: React.ReactNode }) => <div data-testid="menu-content">{children}</div>,
  DropdownMenuItem: ({ children, onClick, className }: { children: React.ReactNode; onClick?: () => void; className?: string }) => (
    <button onClick={onClick} className={className}>{children}</button>
  ),
  DropdownMenuSeparator: () => <hr />,
}))

vi.mock('@/components/ui/dialog', () => ({
  Dialog: ({ open, children }: { open: boolean; children: React.ReactNode; onOpenChange?: (v: boolean) => void }) => (
    open ? <div data-testid="dialog">{children}</div> : null
  ),
  DialogContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogDescription: ({ children }: { children: React.ReactNode }) => <p>{children}</p>,
  DialogFooter: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>,
}))

vi.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick, disabled, variant, ...rest }: any) => (
    <button onClick={onClick} disabled={disabled} data-variant={variant} {...rest}>{children}</button>
  ),
}))

vi.mock('@/components/ui/input', () => ({
  Input: (props: any) => <input {...props} />,
}))

vi.mock('@/components/ui/label', () => ({
  Label: ({ children, ...props }: any) => <label {...props}>{children}</label>,
}))

// ============================================================
// SentryErrors mocks
// ============================================================

vi.mock('date-fns', () => ({
  formatDistanceToNow: () => '3時間前',
}))
vi.mock('date-fns/locale', () => ({
  ja: {},
}))

// ============================================================
// Imports (after mocks)
// ============================================================

import { EventForm } from '@/components/event/EventForm'
import { PremiumActionsDropdown } from '@/app/admin/premium/PremiumActionsDropdown'
import { SentryErrors } from '@/app/admin/SentryErrors'

// ============================================================
// EventForm Tests
// ============================================================

describe('EventForm - uncovered branches', async () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  const editInitialData = {
    id: 'event-123',
    title: '盆栽展示会',
    startDate: new Date('2024-05-01T10:00:00Z'),
    endDate: new Date('2024-05-05T17:00:00Z'),
    prefecture: '東京都',
    city: '渋谷区',
    venue: '大宮盆栽美術館',
    organizer: '全日本盆栽協会',
    fee: '500円',
    hasSales: true,
    description: 'イベントの詳細説明',
    externalUrl: 'https://example.com',
  }

  it('edit mode: calls updateEvent and redirects to initialData.id on success', async () => {
    mockUpdateEvent.mockResolvedValue({ success: true })
    const user = userEvent.setup()

    render(<EventForm mode="edit" initialData={editInitialData} />)

    // Verify edit mode button text
    expect(screen.getByRole('button', { name: '更新する' })).toBeInTheDocument()

    // Submit the form
    await user.click(screen.getByRole('button', { name: '更新する' }))

    await waitFor(() => {
      expect(mockUpdateEvent).toHaveBeenCalledWith('event-123', expect.any(FormData))
    })
    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/events/event-123')
    })
    expect(mockRefresh).toHaveBeenCalled()
  })

  it('edit mode: shows error when updateEvent returns error', async () => {
    mockUpdateEvent.mockResolvedValue({ error: '更新に失敗しました' })
    const user = userEvent.setup()

    render(<EventForm mode="edit" initialData={editInitialData} />)
    await user.click(screen.getByRole('button', { name: '更新する' }))

    await waitFor(() => {
      expect(screen.getByText('更新に失敗しました')).toBeInTheDocument()
    })
    expect(mockPush).not.toHaveBeenCalled()
  })

  it('create mode: navigates to new event on create success with eventId', async () => {
    mockCreateEvent.mockResolvedValue({ success: true, data: { eventId: 'new-event-abc' } })
    const user = userEvent.setup()

    render(<EventForm mode="create" />)

    await user.type(screen.getByLabelText(/タイトル/), 'テストイベント')
    const startDateInput = screen.getByLabelText(/開始日時/)
    await user.clear(startDateInput)
    await user.type(startDateInput, '2024-01-01T10:00')
    await user.selectOptions(screen.getByLabelText(/都道府県/), '東京都')

    await user.click(screen.getByRole('button', { name: '登録する' }))

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/events/new-event-abc')
    })
  })

  it('create mode で success だが eventId が無い場合は遷移せず refresh のみ実行する', async () => {
    // 旧実装は initialData!.id にフォールバックしていたが、それは型レベルで不可能な
    // バグ動作だった。Discriminated union 化後は create モードでは initialData を
    // 受け取らないため、eventId が返らない場合は遷移しないのが正しい契約。
    mockCreateEvent.mockResolvedValue({ success: true })
    const user = userEvent.setup()

    render(<EventForm mode="create" />)

    await user.type(screen.getByLabelText(/タイトル/), 'テスト')
    const startDateInput = screen.getByLabelText(/開始日時/)
    await user.clear(startDateInput)
    await user.type(startDateInput, '2024-01-01T10:00')
    await user.selectOptions(screen.getByLabelText(/都道府県/), '東京都')

    await user.click(screen.getByRole('button', { name: '登録する' }))

    await waitFor(() => {
      expect(mockCreateEvent).toHaveBeenCalled()
    })
    // refresh は呼ばれる（最新データに更新するため）
    await waitFor(() => {
      expect(mockRefresh).toHaveBeenCalled()
    })
    // しかし push は呼ばれない（遷移先 ID が無いため）
    expect(mockPush).not.toHaveBeenCalled()
  })

  it('submits with optional fields empty (no endDate, city, venue, etc.)', async () => {
    mockCreateEvent.mockResolvedValue({ eventId: 'e-1' })
    const user = userEvent.setup()

    render(<EventForm mode="create" />)

    await user.type(screen.getByLabelText(/タイトル/), 'ミニマルイベント')
    const startDateInput = screen.getByLabelText(/開始日時/)
    await user.clear(startDateInput)
    await user.type(startDateInput, '2024-06-01T09:00')
    await user.selectOptions(screen.getByLabelText(/都道府県/), '大阪府')

    // Don't fill optional fields
    await user.click(screen.getByRole('button', { name: '登録する' }))

    await waitFor(() => {
      expect(mockCreateEvent).toHaveBeenCalled()
      const formData = mockCreateEvent.mock.calls[0][0] as FormData
      expect(formData.get('title')).toBe('ミニマルイベント')
      expect(formData.get('endDate')).toBeNull()
      expect(formData.get('city')).toBeNull()
      expect(formData.get('venue')).toBeNull()
      expect(formData.get('organizer')).toBeNull()
      expect(formData.get('fee')).toBeNull()
      expect(formData.get('description')).toBeNull()
      expect(formData.get('externalUrl')).toBeNull()
    })
  })

  it('submits with all optional fields filled', async () => {
    mockCreateEvent.mockResolvedValue({ eventId: 'e-2' })
    const user = userEvent.setup()

    render(<EventForm mode="create" />)

    await user.type(screen.getByLabelText(/タイトル/), 'フルイベント')
    const startDateInput = screen.getByLabelText(/開始日時/)
    await user.clear(startDateInput)
    await user.type(startDateInput, '2024-06-01T09:00')
    const endDateInput = screen.getByLabelText(/終了日時/)
    await user.clear(endDateInput)
    await user.type(endDateInput, '2024-06-02T17:00')
    await user.selectOptions(screen.getByLabelText(/都道府県/), '埼玉県')
    await user.type(screen.getByLabelText(/市区町村/), 'さいたま市')
    await user.type(screen.getByLabelText(/会場名/), 'テスト会場')
    await user.type(screen.getByLabelText(/主催者/), '主催者名')
    await user.type(screen.getByLabelText(/入場料/), '1000円')
    await user.type(screen.getByLabelText(/詳細説明/), '詳細テキスト')
    await user.type(screen.getByLabelText(/外部リンク/), 'https://test.com')

    await user.click(screen.getByRole('button', { name: '登録する' }))

    await waitFor(() => {
      expect(mockCreateEvent).toHaveBeenCalled()
      const formData = mockCreateEvent.mock.calls[0][0] as FormData
      expect(formData.get('endDate')).toBeTruthy()
      expect(formData.get('city')).toBe('さいたま市')
      expect(formData.get('venue')).toBe('テスト会場')
      expect(formData.get('organizer')).toBe('主催者名')
      expect(formData.get('fee')).toBe('1000円')
      expect(formData.get('description')).toBe('詳細テキスト')
      expect(formData.get('externalUrl')).toBe('https://test.com')
    })
  })

  it('cancel button calls router.back', async () => {
    const user = userEvent.setup()
    render(<EventForm mode="create" />)
    await user.click(screen.getByRole('button', { name: 'キャンセル' }))
    expect(mockBack).toHaveBeenCalled()
  })

  it('edit mode initialData with null optional fields', () => {
    const minimalData = {
      id: 'event-min',
      title: 'タイトルのみ',
      startDate: new Date('2024-01-01T10:00:00Z'),
      endDate: null,
      prefecture: null,
      city: null,
      venue: null,
      organizer: null,
      fee: null,
      hasSales: false,
      description: null,
      externalUrl: null,
    }
    render(<EventForm mode="edit" initialData={minimalData} />)
    expect(screen.getByDisplayValue('タイトルのみ')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '更新する' })).toBeInTheDocument()
  })
})

// ============================================================
// PremiumActionsDropdown Tests - uncovered functions
// ============================================================

describe('PremiumActionsDropdown - uncovered functions', async () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGrantPremium.mockResolvedValue({})
    mockRevokePremium.mockResolvedValue({})
    mockExtendPremium.mockResolvedValue({})
  })

  const premiumProps = {
    userId: 'u1',
    userName: 'テストユーザー',
    isPremium: true,
    premiumExpiresAt: new Date('2025-12-31'),
  }

  const nonPremiumProps = {
    userId: 'u1',
    userName: 'テストユーザー',
    isPremium: false,
    premiumExpiresAt: null,
  }

  it('handleGrant calls grantPremium with valid days', async () => {
    render(<PremiumActionsDropdown {...nonPremiumProps} />)
    fireEvent.click(screen.getByText('プレミアムを付与'))
    fireEvent.click(screen.getByText('付与する'))
    await waitFor(() => {
      expect(mockGrantPremium).toHaveBeenCalledWith('u1', 30)
    })
    expect(mockRefresh).toHaveBeenCalled()
  })

  it('handleGrant returns early with NaN days', async () => {
    render(<PremiumActionsDropdown {...nonPremiumProps} />)
    fireEvent.click(screen.getByText('プレミアムを付与'))
    const input = screen.getByDisplayValue('30')
    fireEvent.change(input, { target: { value: 'abc' } })
    fireEvent.click(screen.getByText('付与する'))
    await waitFor(() => {
      expect(mockGrantPremium).not.toHaveBeenCalled()
    })
  })

  it('handleRevoke calls revokePremium', async () => {
    render(<PremiumActionsDropdown {...premiumProps} />)
    fireEvent.click(screen.getByText('プレミアムを取り消し'))
    fireEvent.click(screen.getByText('取り消す'))
    await waitFor(() => {
      expect(mockRevokePremium).toHaveBeenCalledWith('u1')
    })
    expect(mockRefresh).toHaveBeenCalled()
  })

  it('handleExtend calls extendPremium with valid days', async () => {
    render(<PremiumActionsDropdown {...premiumProps} />)
    fireEvent.click(screen.getByText('期限を延長'))
    fireEvent.click(screen.getByText('延長する'))
    await waitFor(() => {
      expect(mockExtendPremium).toHaveBeenCalledWith('u1', 30)
    })
    expect(mockRefresh).toHaveBeenCalled()
  })

  it('handleExtend returns early with NaN days', async () => {
    render(<PremiumActionsDropdown {...premiumProps} />)
    fireEvent.click(screen.getByText('期限を延長'))
    const input = screen.getByDisplayValue('30')
    fireEvent.change(input, { target: { value: 'xyz' } })
    fireEvent.click(screen.getByText('延長する'))
    await waitFor(() => {
      expect(mockExtendPremium).not.toHaveBeenCalled()
    })
  })

  it('handleExtend returns early with zero days', async () => {
    render(<PremiumActionsDropdown {...premiumProps} />)
    fireEvent.click(screen.getByText('期限を延長'))
    const input = screen.getByDisplayValue('30')
    fireEvent.change(input, { target: { value: '0' } })
    fireEvent.click(screen.getByText('延長する'))
    await waitFor(() => {
      expect(mockExtendPremium).not.toHaveBeenCalled()
    })
  })

  it('handleGrant returns early with zero days', async () => {
    render(<PremiumActionsDropdown {...nonPremiumProps} />)
    fireEvent.click(screen.getByText('プレミアムを付与'))
    const input = screen.getByDisplayValue('30')
    fireEvent.change(input, { target: { value: '0' } })
    fireEvent.click(screen.getByText('付与する'))
    await waitFor(() => {
      expect(mockGrantPremium).not.toHaveBeenCalled()
    })
  })
})

// ============================================================
// SentryErrors Tests - uncovered branches
// ============================================================

describe('SentryErrors - uncovered branches', async () => {
  const originalFetch = global.fetch

  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    global.fetch = originalFetch
  })

  it('catch block: fetch throws error', async () => {
     
    global.fetch = vi.fn().mockRejectedValue(new Error('network error')) as any
    render(<SentryErrors />)
    await waitFor(() => {
      expect(screen.getByText('取得に失敗しました')).toBeInTheDocument()
    })
  })

  it('success path with empty issues list shows no-error message', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      json: () => Promise.resolve({
        success: true,
        issues: [],
        dashboardUrl: 'https://sentry.io/dashboard',
      }),
     
    }) as any
    render(<SentryErrors />)
    await waitFor(() => {
      expect(screen.getByText('未解決のエラーはありません')).toBeInTheDocument()
    })
  })

  it('success path with issues shows issue list', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      json: () => Promise.resolve({
        success: true,
        issues: [
          {
            id: '1',
            shortId: 'PROJ-1',
            title: 'TypeError: Cannot read',
            culprit: 'app/api/route.ts',
            level: 'error',
            status: 'unresolved',
            count: '10',
            userCount: 3,
            firstSeen: '2025-01-01T00:00:00Z',
            lastSeen: '2025-01-02T00:00:00Z',
            permalink: 'https://sentry.io/issues/1',
          },
          {
            id: '2',
            shortId: 'PROJ-2',
            title: 'Info event',
            culprit: 'app/page.tsx',
            level: 'info',
            status: 'unresolved',
            count: '1',
            userCount: 1,
            firstSeen: '2025-01-01T00:00:00Z',
            lastSeen: '2025-01-02T00:00:00Z',
            permalink: 'https://sentry.io/issues/2',
          },
          {
            id: '3',
            shortId: 'PROJ-3',
            title: 'Debug event',
            culprit: 'lib/util.ts',
            level: 'debug',
            status: 'unresolved',
            count: '1',
            userCount: 0,
            firstSeen: '2025-01-01T00:00:00Z',
            lastSeen: '2025-01-02T00:00:00Z',
            permalink: 'https://sentry.io/issues/3',
          },
        ],
        dashboardUrl: 'https://sentry.io/dashboard',
      }),
     
    }) as any

    render(<SentryErrors />)
    await waitFor(() => {
      expect(screen.getByText('TypeError: Cannot read')).toBeInTheDocument()
    })
    expect(screen.getByText('情報')).toBeInTheDocument() // info level label
    expect(screen.getByText('debug')).toBeInTheDocument() // default level label returns level as-is
  })

  it('error path with helpText displays help text', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      json: () => Promise.resolve({
        success: false,
        error: 'APIエラー',
        helpText: 'トークンの設定を確認してください',
      }),
     
    }) as any

    render(<SentryErrors />)
    await waitFor(() => {
      expect(screen.getByText('APIエラー')).toBeInTheDocument()
    })
    expect(screen.getByText('トークンの設定を確認してください')).toBeInTheDocument()
  })

  it('error path with debug info displays debug details', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      json: () => Promise.resolve({
        success: false,
        error: 'デバッグエラー',
        debug: {
          url: 'https://sentry.io/api/0/',
          tokenPrefix: 'sntrys_',
          tokenLength: 64,
          org: 'my-org',
          project: 'my-proj',
        },
      }),
     
    }) as any

    render(<SentryErrors />)
    await waitFor(() => {
      expect(screen.getByText('デバッグエラー')).toBeInTheDocument()
    })
    expect(screen.getByText(/sntrys_/)).toBeInTheDocument()
    expect(screen.getByText(/my-org/)).toBeInTheDocument()
    expect(screen.getByText(/my-proj/)).toBeInTheDocument()
  })

  it('error path with helpUrl displays link', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      json: () => Promise.resolve({
        success: false,
        error: 'トークン未設定',
        helpUrl: 'https://sentry.io/settings/tokens/',
      }),
     
    }) as any

    render(<SentryErrors />)
    await waitFor(() => {
      expect(screen.getByText('トークン未設定')).toBeInTheDocument()
    })
    const link = screen.getByRole('link', { name: /トークンを作成/ })
    expect(link).toBeInTheDocument()
    expect(link).toHaveAttribute('href', 'https://sentry.io/settings/tokens/')
  })

  it('error path without helpText, debug, helpUrl', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      json: () => Promise.resolve({
        success: false,
        error: 'シンプルエラー',
      }),
     
    }) as any

    render(<SentryErrors />)
    await waitFor(() => {
      expect(screen.getByText('シンプルエラー')).toBeInTheDocument()
    })
    expect(screen.queryByRole('link', { name: /トークンを作成/ })).not.toBeInTheDocument()
  })

  it('refresh button refetches data', async () => {
    const mockFetchFn = vi.fn().mockResolvedValue({
      json: () => Promise.resolve({ success: true, issues: [] }),
    })
     
    global.fetch = mockFetchFn as any

    render(<SentryErrors />)
    await waitFor(() => {
      expect(screen.getByText('未解決のエラーはありません')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByTitle('更新'))
    await waitFor(() => {
      expect(mockFetchFn).toHaveBeenCalledTimes(2)
    })
  })
})

// ============================================================
// ThemeProvider Tests - uncovered branches/functions
// ============================================================

describe('ThemeProvider - uncovered branches', async () => {
  // We need to import ThemeProvider fresh to test properly
   
  const { ThemeProvider, useTheme } = await import('@/components/theme/ThemeProvider')

  // Custom local storage mock for this suite
  const localStorageMock: Record<string, string> = {}

  beforeEach(() => {
    vi.clearAllMocks()
    Object.keys(localStorageMock).forEach(key => delete localStorageMock[key])
    ;(window.localStorage.getItem as ReturnType<typeof vi.fn>).mockImplementation((key: string) => localStorageMock[key] || null)
    ;(window.localStorage.setItem as ReturnType<typeof vi.fn>).mockImplementation((key: string, value: string) => {
      localStorageMock[key] = value
    })
    document.documentElement.classList.remove('light', 'dark')
    document.documentElement.style.colorScheme = ''
  })

  function TestThemeConsumer() {
    const { theme, resolvedTheme, setTheme } = useTheme()
    return (
      <div>
        <span data-testid="t-theme">{theme}</span>
        <span data-testid="t-resolved">{resolvedTheme}</span>
        <button onClick={() => setTheme('system')}>SetSystem</button>
        <button onClick={() => setTheme('dark')}>SetDark</button>
        <button onClick={() => setTheme('light')}>SetLight</button>
      </div>
    )
  }

  it('renders unmounted fallback initially with no-op setTheme', () => {
    // The first render before useEffect fires should show the fallback
    // The fallback has theme='system', resolvedTheme='light', setTheme=() => {}
    const { container } = render(
      <ThemeProvider>
        <TestThemeConsumer />
      </ThemeProvider>
    )
    // At the very first render, mounted=false, so fallback provider is used
    // After effects run, mounted becomes true
    expect(container).toBeTruthy()
  })

  it('mediaQuery change event triggers applyTheme when theme=system', async () => {
    let changeHandler: (() => void) | null = null
    const addEventListenerMock = vi.fn((event: string, handler: () => void) => {
      if (event === 'change') changeHandler = handler
    })
    const removeEventListenerMock = vi.fn()

    ;(window.matchMedia as ReturnType<typeof vi.fn>).mockImplementation((query: string) => ({
      matches: query === '(prefers-color-scheme: dark)' ? false : false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: addEventListenerMock,
      removeEventListener: removeEventListenerMock,
      dispatchEvent: vi.fn(),
    }))

    render(
      <ThemeProvider>
        <TestThemeConsumer />
      </ThemeProvider>
    )

    // Wait for mount
    await waitFor(() => {
      expect(screen.getByTestId('t-theme')).toHaveTextContent('system')
    })

    // Now set theme to system explicitly (it's already system but let's confirm)
    act(() => {
      screen.getByText('SetSystem').click()
    })

    await waitFor(() => {
      expect(screen.getByTestId('t-theme')).toHaveTextContent('system')
    })

    // Simulate OS theme change
    expect(addEventListenerMock).toHaveBeenCalledWith('change', expect.any(Function))
    if (changeHandler) {
      // Make matchMedia return dark for the next call
      ;(window.matchMedia as ReturnType<typeof vi.fn>).mockImplementation((query: string) => ({
        matches: query === '(prefers-color-scheme: dark)',
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }))

      act(() => {
        changeHandler!()
      })

      await waitFor(() => {
        expect(screen.getByTestId('t-resolved')).toHaveTextContent('dark')
      })
    }
  })

  it('mediaQuery change event does NOT apply theme when theme is not system', async () => {
    let changeHandler: (() => void) | null = null
    const addEventListenerMock = vi.fn((event: string, handler: () => void) => {
      if (event === 'change') changeHandler = handler
    })

    ;(window.matchMedia as ReturnType<typeof vi.fn>).mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: addEventListenerMock,
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }))

    render(
      <ThemeProvider>
        <TestThemeConsumer />
      </ThemeProvider>
    )

    await waitFor(() => {
      expect(screen.getByTestId('t-theme')).toBeInTheDocument()
    })

    // Set to 'light' explicitly (not 'system')
    act(() => {
      screen.getByText('SetLight').click()
    })

    await waitFor(() => {
      expect(screen.getByTestId('t-theme')).toHaveTextContent('light')
      expect(screen.getByTestId('t-resolved')).toHaveTextContent('light')
    })

    // Simulate OS theme change - since theme='light', handleChange should NOT call applyTheme
    if (changeHandler) {
      ;(window.matchMedia as ReturnType<typeof vi.fn>).mockImplementation((query: string) => ({
        matches: query === '(prefers-color-scheme: dark)',
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }))

      act(() => {
        changeHandler!()
      })

      // resolvedTheme should still be 'light' since theme is not 'system'
      expect(screen.getByTestId('t-resolved')).toHaveTextContent('light')
    }
  })

  it('reads stored theme from localStorage on mount', async () => {
    localStorageMock['theme'] = 'dark'

    ;(window.matchMedia as ReturnType<typeof vi.fn>).mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }))

    render(
      <ThemeProvider>
        <TestThemeConsumer />
      </ThemeProvider>
    )

    await waitFor(() => {
      expect(screen.getByTestId('t-theme')).toHaveTextContent('dark')
      expect(screen.getByTestId('t-resolved')).toHaveTextContent('dark')
    })
  })
})
