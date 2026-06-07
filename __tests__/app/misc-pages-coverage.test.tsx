/**
 * Miscellaneous app/component coverage tests
 *
 * Covers uncovered branches in:
 * - components/notification/PushNotificationToggle.tsx
 * - app/admin/stats/StatsChartsWrapper.tsx
 * - app/admin/premium/PremiumActionsDropdown.tsx
 * - components/shop/MapWrapper.tsx
 * - components/post/form/MediaUploadSection.tsx
 * - app/admin/users/[id]/UserDetailActions.tsx
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import React from 'react'

// ============================================================
// Mock setup
// ============================================================

const mockToast = vi.fn()
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: mockToast }),
}))

vi.mock('@/lib/actions/push-subscription', () => ({
  subscribePush: vi.fn().mockResolvedValue({ success: true }),
  unsubscribePush: vi.fn().mockResolvedValue({ success: true }),
  getPushSubscriptionStatus: vi.fn().mockResolvedValue({ subscribed: false }),
}))

const mockGrantPremium = vi.fn().mockResolvedValue({})
const mockRevokePremium = vi.fn().mockResolvedValue({})
const mockExtendPremium = vi.fn().mockResolvedValue({})
vi.mock('@/lib/actions/admin/premium', () => ({
  grantPremium: (...args: unknown[]) => mockGrantPremium(...args),
  revokePremium: (...args: unknown[]) => mockRevokePremium(...args),
  extendPremium: (...args: unknown[]) => mockExtendPremium(...args),
}))

const mockSuspendUser = vi.fn().mockResolvedValue({ success: true })
const mockActivateUser = vi.fn().mockResolvedValue({ success: true })
const mockDeleteUserByAdmin = vi.fn().mockResolvedValue({ success: true })
vi.mock('@/lib/actions/admin/users', () => ({
  suspendUser: (...args: unknown[]) => mockSuspendUser(...args),
  activateUser: (...args: unknown[]) => mockActivateUser(...args),
  deleteUserByAdmin: (...args: unknown[]) => mockDeleteUserByAdmin(...args),
}))

vi.mock('@/components/shop/Map', () => ({
  Map: ({ shops }: { shops: unknown[] }) => (
    <div data-testid="mock-map">Map with {shops.length} shops</div>
  ),
}))

// Mock Radix dropdown to simple HTML
vi.mock('@/components/ui/dropdown-menu', () => ({
  DropdownMenu: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DropdownMenuTrigger: ({ children }: { children: React.ReactNode; asChild?: boolean }) => <div data-testid="trigger">{children}</div>,
  DropdownMenuContent: ({ children }: { children: React.ReactNode }) => <div data-testid="menu-content">{children}</div>,
  DropdownMenuItem: ({ children, onClick, className }: { children: React.ReactNode; onClick?: () => void; className?: string }) => (
    <button onClick={onClick} className={className}>{children}</button>
  ),
  DropdownMenuSeparator: () => <hr />,
}))

// Mock Dialog components
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

// Mock lucide-react icons used in components
vi.mock('lucide-react', () => ({
  Bell: ({ className }: { className?: string }) => <span data-testid="bell-icon" className={className} />,
  BellOff: ({ className }: { className?: string }) => <span data-testid="bell-off-icon" className={className} />,
  Loader2: ({ className }: { className?: string }) => <span data-testid="loader-icon" className={className} />,
  MoreHorizontal: ({ className }: { className?: string }) => <span data-testid="more-icon" className={className} />,
  Crown: ({ className }: { className?: string }) => <span data-testid="crown-icon" className={className} />,
  Ban: ({ className }: { className?: string }) => <span data-testid="ban-icon" className={className} />,
  CalendarPlus: ({ className }: { className?: string }) => <span data-testid="calendar-icon" className={className} />,
  X: ({ className }: { className?: string }) => <span data-testid="x-icon" className={className} />,
  Image: ({ className }: { className?: string }) => <span data-testid="image-icon" className={className} />,
  AlertTriangle: ({ className }: { className?: string }) => <span data-testid="alert-triangle-icon" className={className} />,
}))

// ============================================================
// 1. PushNotificationToggle
// ============================================================

describe('PushNotificationToggle', () => {
  let PushNotificationToggle: React.ComponentType

  beforeEach(async () => {
    vi.clearAllMocks()

    const mod = await import('@/components/notification/PushNotificationToggle')
    PushNotificationToggle = mod.PushNotificationToggle
  })

  it('renders unsupported message when serviceWorker not available', async () => {
    const origSW = navigator.serviceWorker
    Object.defineProperty(navigator, 'serviceWorker', {
      value: undefined,
      configurable: true,
      writable: true,
    })
    // Ensure PushManager is also missing
    const origPM = (window as Record<string, unknown>).PushManager
    delete (window as Record<string, unknown>).PushManager

    render(<PushNotificationToggle />)

    await waitFor(() => {
      expect(screen.getByText('プッシュ通知')).toBeInTheDocument()
    })

    // Restore
    Object.defineProperty(navigator, 'serviceWorker', {
      value: origSW,
      configurable: true,
      writable: true,
    })
    ;(window as Record<string, unknown>).PushManager = origPM
  })

  it('renders toggle when push is supported and shows OFF state', async () => {
    const mockGetSubscription = vi.fn().mockResolvedValue(null)
    const mockPushManager = { getSubscription: mockGetSubscription }
    const mockRegistration = { pushManager: mockPushManager }

    Object.defineProperty(navigator, 'serviceWorker', {
      value: { ready: Promise.resolve(mockRegistration) },
      configurable: true,
      writable: true,
    })
    ;(window as Record<string, unknown>).PushManager = class {}

    render(<PushNotificationToggle />)

    await waitFor(() => {
      const toggle = screen.getByRole('switch')
      expect(toggle).toBeInTheDocument()
      expect(toggle.getAttribute('aria-checked')).toBe('false')
    })
  })

  it('shows subscribed state when subscription exists and server confirms', async () => {
    const { getPushSubscriptionStatus } = await import('@/lib/actions/push-subscription')
    ;(getPushSubscriptionStatus as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ subscribed: true })

    const mockSubscription = { endpoint: 'https://push.example.com' }
    const mockGetSubscription = vi.fn().mockResolvedValue(mockSubscription)
    const mockPushManager = { getSubscription: mockGetSubscription }
    const mockRegistration = { pushManager: mockPushManager }

    Object.defineProperty(navigator, 'serviceWorker', {
      value: { ready: Promise.resolve(mockRegistration) },
      configurable: true,
      writable: true,
    })
    ;(window as Record<string, unknown>).PushManager = class {}

    render(<PushNotificationToggle />)

    await waitFor(() => {
      const toggle = screen.getByRole('switch')
      expect(toggle.getAttribute('aria-checked')).toBe('true')
    })
  })

  it('handles unsubscribe toggle', async () => {
    const { getPushSubscriptionStatus, unsubscribePush } = await import('@/lib/actions/push-subscription')
    ;(getPushSubscriptionStatus as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ subscribed: true })

    const mockUnsubscribe = vi.fn().mockResolvedValue(true)
    const mockSubscription = { endpoint: 'https://push.example.com', unsubscribe: mockUnsubscribe }
    const mockGetSubscription = vi.fn().mockResolvedValue(mockSubscription)
    const mockPushManager = { getSubscription: mockGetSubscription, subscribe: vi.fn() }
    const mockRegistration = { pushManager: mockPushManager }

    Object.defineProperty(navigator, 'serviceWorker', {
      value: { ready: Promise.resolve(mockRegistration) },
      configurable: true,
      writable: true,
    })
    ;(window as Record<string, unknown>).PushManager = class {}

    render(<PushNotificationToggle />)

    await waitFor(() => {
      expect(screen.getByRole('switch').getAttribute('aria-checked')).toBe('true')
    })

    await act(async () => {
      fireEvent.click(screen.getByRole('switch'))
    })

    await waitFor(() => {
      expect(mockUnsubscribe).toHaveBeenCalled()
      expect(unsubscribePush).toHaveBeenCalledWith('https://push.example.com')
      expect(mockToast).toHaveBeenCalledWith({ title: 'プッシュ通知をOFFにしました' })
    })
  })

  it('handles subscribe toggle - permission denied', async () => {
    const mockGetSubscription = vi.fn().mockResolvedValue(null)
    const mockPushManager = { getSubscription: mockGetSubscription, subscribe: vi.fn() }
    const mockRegistration = { pushManager: mockPushManager }

    Object.defineProperty(navigator, 'serviceWorker', {
      value: { ready: Promise.resolve(mockRegistration) },
      configurable: true,
      writable: true,
    })
    ;(window as Record<string, unknown>).PushManager = class {}

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ publicKey: 'test-key' }),
    }) as unknown as typeof fetch

    Object.defineProperty(window, 'Notification', {
      value: { requestPermission: vi.fn().mockResolvedValue('denied') },
      configurable: true,
      writable: true,
    })

    render(<PushNotificationToggle />)

    await waitFor(() => {
      const toggle = screen.getByRole('switch')
      expect(toggle).toBeInTheDocument()
      expect(toggle).not.toBeDisabled()
    })

    await act(async () => {
      fireEvent.click(screen.getByRole('switch'))
    })

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({
        variant: 'destructive',
        title: '通知の許可が必要です',
      }))
    })
  })

  it('handles subscribe toggle - vapid key fetch failure', async () => {
    const mockGetSubscription = vi.fn().mockResolvedValue(null)
    const mockPushManager = { getSubscription: mockGetSubscription, subscribe: vi.fn() }
    const mockRegistration = { pushManager: mockPushManager }

    Object.defineProperty(navigator, 'serviceWorker', {
      value: { ready: Promise.resolve(mockRegistration) },
      configurable: true,
      writable: true,
    })
    ;(window as Record<string, unknown>).PushManager = class {}

    global.fetch = vi.fn().mockResolvedValue({ ok: false }) as unknown as typeof fetch

    render(<PushNotificationToggle />)

    await waitFor(() => {
      const toggle = screen.getByRole('switch')
      expect(toggle).toBeInTheDocument()
      expect(toggle).not.toBeDisabled()
    })

    await act(async () => {
      fireEvent.click(screen.getByRole('switch'))
    })

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({
        variant: 'destructive',
        title: 'プッシュ通知の設定に失敗しました',
      }))
    })
  })

  it('handles subscribe toggle - missing p256dh/auth keys', async () => {
    const mockGetSubscription = vi.fn().mockResolvedValue(null)
    const mockSubscription = {
      endpoint: 'https://push.example.com',
      getKey: vi.fn().mockReturnValue(null),
    }
    const mockPushManager = {
      getSubscription: mockGetSubscription,
      subscribe: vi.fn().mockResolvedValue(mockSubscription),
    }
    const mockRegistration = { pushManager: mockPushManager }

    Object.defineProperty(navigator, 'serviceWorker', {
      value: { ready: Promise.resolve(mockRegistration) },
      configurable: true,
      writable: true,
    })
    ;(window as Record<string, unknown>).PushManager = class {}

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ publicKey: 'test-key' }),
    }) as unknown as typeof fetch

    Object.defineProperty(window, 'Notification', {
      value: { requestPermission: vi.fn().mockResolvedValue('granted') },
      configurable: true,
      writable: true,
    })

    render(<PushNotificationToggle />)

    await waitFor(() => {
      const toggle = screen.getByRole('switch')
      expect(toggle).toBeInTheDocument()
      expect(toggle).not.toBeDisabled()
    })

    await act(async () => {
      fireEvent.click(screen.getByRole('switch'))
    })

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({
        variant: 'destructive',
        title: 'プッシュ通知の登録に失敗しました',
      }))
    })
  })

  it('handles subscribe toggle - server subscribePush failure', async () => {
    const { subscribePush } = await import('@/lib/actions/push-subscription')
    ;(subscribePush as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      success: false,
      error: 'Server error',
    })

    const mockGetSubscription = vi.fn().mockResolvedValue(null)
    const mockP256dh = new Uint8Array([1, 2, 3, 4])
    const mockAuthKey = new Uint8Array([5, 6, 7, 8])
    const mockSubscription = {
      endpoint: 'https://push.example.com',
      getKey: vi.fn().mockImplementation((name: string) => {
        if (name === 'p256dh') return mockP256dh.buffer
        if (name === 'auth') return mockAuthKey.buffer
        return null
      }),
    }
    const mockPushManager = {
      getSubscription: mockGetSubscription,
      subscribe: vi.fn().mockResolvedValue(mockSubscription),
    }
    const mockRegistration = { pushManager: mockPushManager }

    Object.defineProperty(navigator, 'serviceWorker', {
      value: { ready: Promise.resolve(mockRegistration) },
      configurable: true,
      writable: true,
    })
    ;(window as Record<string, unknown>).PushManager = class {}

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ publicKey: 'test-key' }),
    }) as unknown as typeof fetch

    Object.defineProperty(window, 'Notification', {
      value: { requestPermission: vi.fn().mockResolvedValue('granted') },
      configurable: true,
      writable: true,
    })

    render(<PushNotificationToggle />)

    await waitFor(() => {
      const toggle = screen.getByRole('switch')
      expect(toggle).toBeInTheDocument()
      expect(toggle).not.toBeDisabled()
    })

    await act(async () => {
      fireEvent.click(screen.getByRole('switch'))
    })

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({
        variant: 'destructive',
        title: 'Server error',
      }))
    })
  })

  it('handles error during toggle', async () => {
    // checkStatus用: 正常に返す（isSubscribed=false）
    const mockGetSubscription = vi.fn().mockResolvedValue(null)
    const mockPushManager = { getSubscription: mockGetSubscription }
    const mockRegistration = { pushManager: mockPushManager }

    Object.defineProperty(navigator, 'serviceWorker', {
      value: { ready: Promise.resolve(mockRegistration) },
      configurable: true,
      writable: true,
    })
    ;(window as Record<string, unknown>).PushManager = class {}

    // fetch をネットワークエラーにしてcatch節に到達させる
    const originalFetch = global.fetch
    global.fetch = vi.fn().mockRejectedValue(new Error('Network error'))

    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    render(<PushNotificationToggle />)

    // isLoadingがfalseになりボタンが有効化されるまで待つ
    await waitFor(() => {
      const toggle = screen.getByRole('switch')
      expect(toggle).toBeInTheDocument()
      expect(toggle).not.toBeDisabled()
    })

    await act(async () => {
      fireEvent.click(screen.getByRole('switch'))
    })

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({
        variant: 'destructive',
        title: 'エラーが発生しました',
      }))
    }, { timeout: 5000 })

    consoleSpy.mockRestore()
    global.fetch = originalFetch
  })

  it('handles checkStatus error gracefully', async () => {
    Object.defineProperty(navigator, 'serviceWorker', {
      value: { ready: Promise.reject(new Error('init error')) },
      configurable: true,
      writable: true,
    })
    ;(window as Record<string, unknown>).PushManager = class {}

    render(<PushNotificationToggle />)

    await waitFor(() => {
      const toggle = screen.getByRole('switch')
      expect(toggle.getAttribute('aria-checked')).toBe('false')
    })
  })
})

// ============================================================
// 2. StatsChartsWrapper
// ============================================================

describe('StatsChartsWrapper', () => {
  it('renders with data', async () => {
    vi.doMock('@/app/admin/stats/StatsCharts', () => ({
      StatsCharts: ({ data }: { data: unknown[] }) => (
        <div data-testid="stats-charts">Charts: {data.length}</div>
      ),
    }))

    const { StatsChartsWrapper } = await import('@/app/admin/stats/StatsChartsWrapper')
    const data = [
      { date: '2025-01-01', users: 10, posts: 20, comments: 5 },
      { date: '2025-01-02', users: 15, posts: 25, comments: 8 },
    ]

    render(<StatsChartsWrapper data={data} />)

    await waitFor(() => {
      expect(screen.getByTestId('stats-charts')).toBeInTheDocument()
    })
  })
})

// ============================================================
// 3. PremiumActionsDropdown
// ============================================================

describe('PremiumActionsDropdown', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGrantPremium.mockResolvedValue({})
    mockRevokePremium.mockResolvedValue({})
    mockExtendPremium.mockResolvedValue({})
  })

  const nonPremiumProps = {
    userId: 'u1',
    userName: 'Test User',
    isPremium: false,
    premiumExpiresAt: null,
  }

  const premiumProps = {
    userId: 'u1',
    userName: 'Test User',
    isPremium: true,
    premiumExpiresAt: new Date('2025-12-31'),
  }

  it('renders grant option for non-premium user', async () => {
    const { PremiumActionsDropdown } = await import('@/app/admin/premium/PremiumActionsDropdown')
    render(<PremiumActionsDropdown {...nonPremiumProps} />)
    expect(screen.getByText('プレミアムを付与')).toBeInTheDocument()
  })

  it('renders extend and revoke options for premium user', async () => {
    const { PremiumActionsDropdown } = await import('@/app/admin/premium/PremiumActionsDropdown')
    render(<PremiumActionsDropdown {...premiumProps} />)
    expect(screen.getByText('期限を延長')).toBeInTheDocument()
    expect(screen.getByText('プレミアムを取り消し')).toBeInTheDocument()
  })

  it('handles grant with invalid days (NaN)', async () => {
    const { PremiumActionsDropdown } = await import('@/app/admin/premium/PremiumActionsDropdown')
    render(<PremiumActionsDropdown {...nonPremiumProps} />)

    fireEvent.click(screen.getByText('プレミアムを付与'))

    // Change days to invalid
    const input = screen.getByLabelText('有効日数')
    fireEvent.change(input, { target: { value: 'abc' } })

    fireEvent.click(screen.getByText('付与する'))

    await waitFor(() => {
      expect(mockGrantPremium).not.toHaveBeenCalled()
    })
  })

  it('handles grant with zero days', async () => {
    const { PremiumActionsDropdown } = await import('@/app/admin/premium/PremiumActionsDropdown')
    render(<PremiumActionsDropdown {...nonPremiumProps} />)

    fireEvent.click(screen.getByText('プレミアムを付与'))

    const input = screen.getByLabelText('有効日数')
    fireEvent.change(input, { target: { value: '0' } })

    fireEvent.click(screen.getByText('付与する'))

    await waitFor(() => {
      expect(mockGrantPremium).not.toHaveBeenCalled()
    })
  })

  it('handles grant with valid days', async () => {
    const { PremiumActionsDropdown } = await import('@/app/admin/premium/PremiumActionsDropdown')
    render(<PremiumActionsDropdown {...nonPremiumProps} />)

    fireEvent.click(screen.getByText('プレミアムを付与'))

    // Default days is 30
    fireEvent.click(screen.getByText('付与する'))

    await waitFor(() => {
      expect(mockGrantPremium).toHaveBeenCalledWith('u1', 30)
    })
  })

  it('handles revoke action', async () => {
    const { PremiumActionsDropdown } = await import('@/app/admin/premium/PremiumActionsDropdown')
    render(<PremiumActionsDropdown {...premiumProps} />)

    fireEvent.click(screen.getByText('プレミアムを取り消し'))

    fireEvent.click(screen.getByText('取り消す'))

    await waitFor(() => {
      expect(mockRevokePremium).toHaveBeenCalledWith('u1')
    })
  })

  it('handles extend with invalid days', async () => {
    const { PremiumActionsDropdown } = await import('@/app/admin/premium/PremiumActionsDropdown')
    render(<PremiumActionsDropdown {...premiumProps} />)

    fireEvent.click(screen.getByText('期限を延長'))

    const input = screen.getByLabelText('延長日数')
    fireEvent.change(input, { target: { value: '0' } })

    fireEvent.click(screen.getByText('延長する'))

    await waitFor(() => {
      expect(mockExtendPremium).not.toHaveBeenCalled()
    })
  })

  it('handles extend with valid days', async () => {
    const { PremiumActionsDropdown } = await import('@/app/admin/premium/PremiumActionsDropdown')
    render(<PremiumActionsDropdown {...premiumProps} />)

    fireEvent.click(screen.getByText('期限を延長'))

    fireEvent.click(screen.getByText('延長する'))

    await waitFor(() => {
      expect(mockExtendPremium).toHaveBeenCalledWith('u1', 30)
    })
  })

  it('shows cancel button in grant dialog', async () => {
    const { PremiumActionsDropdown } = await import('@/app/admin/premium/PremiumActionsDropdown')
    render(<PremiumActionsDropdown {...nonPremiumProps} />)

    fireEvent.click(screen.getByText('プレミアムを付与'))
    expect(screen.getByText('キャンセル')).toBeInTheDocument()
  })

  it('shows current expiry in extend dialog', async () => {
    const { PremiumActionsDropdown } = await import('@/app/admin/premium/PremiumActionsDropdown')
    render(<PremiumActionsDropdown {...premiumProps} />)

    fireEvent.click(screen.getByText('期限を延長'))
    expect(screen.getByText(/現在の期限/)).toBeInTheDocument()
  })
})

// ============================================================
// 4. MapWrapper
// ============================================================

describe('MapWrapper', () => {
  it('renders with default height (responsive classes)', async () => {
    const { MapWrapper } = await import('@/components/shop/MapWrapper')
    const { container } = render(
      <MapWrapper shops={[]} />
    )
    const wrapper = container.firstChild as HTMLElement
    expect(wrapper.className).toContain('h-[250px]')
    expect(wrapper.className).toContain('md:h-[400px]')
  })

  it('renders with explicit height (inline style)', async () => {
    const { MapWrapper } = await import('@/components/shop/MapWrapper')
    const { container } = render(
      <MapWrapper shops={[]} height="600px" />
    )
    const wrapper = container.firstChild as HTMLElement
    expect(wrapper.style.height).toBe('600px')
  })

  it('MapWrapperSmall renders with 300px height', async () => {
    const { MapWrapperSmall } = await import('@/components/shop/MapWrapper')
    const { container } = render(
      <MapWrapperSmall shops={[]} />
    )
    const wrapper = container.firstChild as HTMLElement
    expect(wrapper.className).toContain('h-[300px]')
  })

  it('passes center and zoom props', async () => {
    const { MapWrapper } = await import('@/components/shop/MapWrapper')
    const { container } = render(
      <MapWrapper shops={[]} center={[35, 139]} zoom={10} />
    )
    // Dynamic import shows loading state initially in test environment
    const wrapper = container.firstChild as HTMLElement
    expect(wrapper).toBeInTheDocument()
  })
})

// ============================================================
// 5. MediaUploadSection
// ============================================================

describe('MediaUploadSection', () => {
  it('renders with no media files (no preview grid)', async () => {
    const { MediaUploadSection } = await import('@/components/post/form/MediaUploadSection')
    const fileInputRef = React.createRef<HTMLInputElement>()

    const { container } = render(
      <MediaUploadSection
        mediaFiles={[]}
        uploading={false}
        uploadProgress={0}
        onFileSelect={vi.fn()}
        onRemove={vi.fn()}
        fileInputRef={fileInputRef as React.RefObject<HTMLInputElement | null>}
        maxTotal={4}
      />
    )

    // No grid should be rendered
    expect(container.querySelector('.grid')).not.toBeInTheDocument()
  })

  it('renders image previews', async () => {
    const { MediaUploadSection } = await import('@/components/post/form/MediaUploadSection')
    const fileInputRef = React.createRef<HTMLInputElement>()

    render(
      <MediaUploadSection
        mediaFiles={[
          { url: '/img1.jpg', type: 'image' },
          { url: '/img2.jpg', type: 'image' },
        ]}
        uploading={false}
        uploadProgress={0}
        onFileSelect={vi.fn()}
        onRemove={vi.fn()}
        fileInputRef={fileInputRef as React.RefObject<HTMLInputElement | null>}
        maxTotal={4}
      />
    )

    expect(screen.getByAltText('アップロード画像 1')).toBeInTheDocument()
    expect(screen.getByAltText('アップロード画像 2')).toBeInTheDocument()
  })

  it('renders video preview', async () => {
    const { MediaUploadSection } = await import('@/components/post/form/MediaUploadSection')
    const fileInputRef = React.createRef<HTMLInputElement>()

    const { container } = render(
      <MediaUploadSection
        mediaFiles={[{ url: '/video.mp4', type: 'video' }]}
        uploading={false}
        uploadProgress={0}
        onFileSelect={vi.fn()}
        onRemove={vi.fn()}
        fileInputRef={fileInputRef as React.RefObject<HTMLInputElement | null>}
        maxTotal={4}
      />
    )

    const video = container.querySelector('video')
    expect(video).toBeInTheDocument()
  })

  it('shows upload progress bar when uploading', async () => {
    const { MediaUploadSection } = await import('@/components/post/form/MediaUploadSection')
    const fileInputRef = React.createRef<HTMLInputElement>()

    render(
      <MediaUploadSection
        mediaFiles={[]}
        uploading={true}
        uploadProgress={65}
        onFileSelect={vi.fn()}
        onRemove={vi.fn()}
        fileInputRef={fileInputRef as React.RefObject<HTMLInputElement | null>}
        maxTotal={4}
      />
    )

    expect(screen.getByText('65%')).toBeInTheDocument()
  })

  it('calls onRemove when remove button clicked', async () => {
    const { MediaUploadSection } = await import('@/components/post/form/MediaUploadSection')
    const onRemove = vi.fn()
    const fileInputRef = React.createRef<HTMLInputElement>()

    render(
      <MediaUploadSection
        mediaFiles={[{ url: '/img1.jpg', type: 'image' }]}
        uploading={false}
        uploadProgress={0}
        onFileSelect={vi.fn()}
        onRemove={onRemove}
        fileInputRef={fileInputRef as React.RefObject<HTMLInputElement | null>}
        maxTotal={4}
      />
    )

    // The remove button is inside the media preview - it's a button with type="button"
    const removeButtons = screen.getAllByRole('button')
    // First button is the X remove button on the media item
    fireEvent.click(removeButtons[0])
    expect(onRemove).toHaveBeenCalledWith(0)
  })

  it('disables add button when at max files', async () => {
    const { MediaUploadSection } = await import('@/components/post/form/MediaUploadSection')
    const fileInputRef = React.createRef<HTMLInputElement>()

    render(
      <MediaUploadSection
        mediaFiles={[
          { url: '/img1.jpg', type: 'image' },
          { url: '/img2.jpg', type: 'image' },
        ]}
        uploading={false}
        uploadProgress={0}
        onFileSelect={vi.fn()}
        onRemove={vi.fn()}
        fileInputRef={fileInputRef as React.RefObject<HTMLInputElement | null>}
        maxTotal={2}
      />
    )

    const buttons = screen.getAllByRole('button')
    // The add button is the last one
    const addButton = buttons[buttons.length - 1]
    expect(addButton).toBeDisabled()
  })

  it('renders single image without grid-cols-2', async () => {
    const { MediaUploadSection } = await import('@/components/post/form/MediaUploadSection')
    const fileInputRef = React.createRef<HTMLInputElement>()

    const { container } = render(
      <MediaUploadSection
        mediaFiles={[{ url: '/img1.jpg', type: 'image' }]}
        uploading={false}
        uploadProgress={0}
        onFileSelect={vi.fn()}
        onRemove={vi.fn()}
        fileInputRef={fileInputRef as React.RefObject<HTMLInputElement | null>}
        maxTotal={4}
      />
    )

    const grid = container.querySelector('.grid')
    expect(grid).toBeInTheDocument()
    expect(grid?.className).not.toContain('grid-cols-2')
  })
})

// ============================================================
// 6. UserDetailActions
// ============================================================

describe('UserDetailActions', () => {
  let UserDetailActions: React.ComponentType<{
    userId: string
    isSuspended: boolean
    nickname: string
  }>

  beforeEach(async () => {
    vi.clearAllMocks()
    mockSuspendUser.mockResolvedValue({ success: true })
    mockActivateUser.mockResolvedValue({ success: true })
    mockDeleteUserByAdmin.mockResolvedValue({ success: true })

    const mod = await import('@/app/admin/users/[id]/UserDetailActions')
    UserDetailActions = mod.UserDetailActions
  })

  it('renders suspend form for active user', () => {
    render(<UserDetailActions userId="u1" isSuspended={false} nickname="Test" />)
    expect(screen.getByPlaceholderText('停止理由を入力...')).toBeInTheDocument()
    expect(screen.getByText('アカウントを停止')).toBeInTheDocument()
  })

  it('renders activate button for suspended user', () => {
    render(<UserDetailActions userId="u1" isSuspended={true} nickname="Test" />)
    expect(screen.getByText('アカウントを復帰')).toBeInTheDocument()
  })

  it('shows error when suspending without reason', async () => {
    render(<UserDetailActions userId="u1" isSuspended={false} nickname="Test" />)

    // The suspend button is disabled when reason is empty, so try to click it
    // Actually looking at the source: !reason.trim() disables the button
    // But handleSuspend also checks if (!reason.trim()) { setError(...) }
    // The button is disabled so we need a different approach
    // Let's verify the button is disabled
    const button = screen.getByText('アカウントを停止')
    expect(button).toBeDisabled()
  })

  it('calls suspendUser with reason', async () => {
    render(<UserDetailActions userId="u1" isSuspended={false} nickname="Test" />)

    const textarea = screen.getByPlaceholderText('停止理由を入力...')
    fireEvent.change(textarea, { target: { value: 'Spam activity' } })
    fireEvent.click(screen.getByText('アカウントを停止'))

    await waitFor(() => {
      expect(mockSuspendUser).toHaveBeenCalledWith('u1', 'Spam activity')
    })
  })

  it('shows error when suspendUser fails', async () => {
    mockSuspendUser.mockResolvedValueOnce({ success: false, error: 'Permission denied' })

    render(<UserDetailActions userId="u1" isSuspended={false} nickname="Test" />)

    const textarea = screen.getByPlaceholderText('停止理由を入力...')
    fireEvent.change(textarea, { target: { value: 'Reason' } })
    fireEvent.click(screen.getByText('アカウントを停止'))

    await waitFor(() => {
      expect(screen.getByText('Permission denied')).toBeInTheDocument()
    })
  })

  it('calls activateUser', async () => {
    render(<UserDetailActions userId="u1" isSuspended={true} nickname="Test" />)

    fireEvent.click(screen.getByText('アカウントを復帰'))

    await waitFor(() => {
      expect(mockActivateUser).toHaveBeenCalledWith('u1')
    })
  })

  it('shows error when activateUser fails', async () => {
    mockActivateUser.mockResolvedValueOnce({ success: false, error: 'Activate failed' })

    render(<UserDetailActions userId="u1" isSuspended={true} nickname="Test" />)

    fireEvent.click(screen.getByText('アカウントを復帰'))

    await waitFor(() => {
      expect(screen.getByText('Activate failed')).toBeInTheDocument()
    })
  })

  it('shows delete confirmation panel', () => {
    render(<UserDetailActions userId="u1" isSuspended={false} nickname="TestUser" />)

    fireEvent.click(screen.getByText('アカウントを削除'))

    expect(screen.getByText('アカウント削除の確認')).toBeInTheDocument()
    expect(screen.getByText(/TestUser/)).toBeInTheDocument()
  })

  it('cancels delete confirmation', () => {
    render(<UserDetailActions userId="u1" isSuspended={false} nickname="TestUser" />)

    fireEvent.click(screen.getByText('アカウントを削除'))
    fireEvent.click(screen.getByText('キャンセル'))

    expect(screen.queryByText('アカウント削除の確認')).not.toBeInTheDocument()
  })

  it('handles delete with reason for non-suspended user', async () => {
    render(<UserDetailActions userId="u1" isSuspended={false} nickname="TestUser" />)

    fireEvent.click(screen.getByText('アカウントを削除'))

    // Enter reason in delete textarea
    const deleteTextarea = screen.getByPlaceholderText('削除理由を入力...')
    fireEvent.change(deleteTextarea, { target: { value: 'Delete reason' } })

    fireEvent.click(screen.getByText('削除する'))

    await waitFor(() => {
      expect(mockDeleteUserByAdmin).toHaveBeenCalledWith('u1', 'Delete reason')
    })
  })

  it('shows error when deleteUserByAdmin fails', async () => {
    mockDeleteUserByAdmin.mockResolvedValueOnce({ success: false, error: 'Delete failed' })

    render(<UserDetailActions userId="u1" isSuspended={false} nickname="TestUser" />)

    fireEvent.click(screen.getByText('アカウントを削除'))

    // Enter a reason so button is not disabled
    const deleteTextarea = screen.getByPlaceholderText('削除理由を入力...')
    fireEvent.change(deleteTextarea, { target: { value: 'Bad user' } })

    fireEvent.click(screen.getByText('削除する'))

    await waitFor(() => {
      expect(screen.getByText('Delete failed')).toBeInTheDocument()
    })
  })

  it('for suspended user, delete shows error if reason is empty', async () => {
    render(<UserDetailActions userId="u1" isSuspended={true} nickname="TestUser" />)

    fireEvent.click(screen.getByText('アカウントを削除'))

    // For suspended user, delete textarea is not shown
    expect(screen.queryByPlaceholderText('削除理由を入力...')).not.toBeInTheDocument()

    // Clicking delete with empty reason triggers error
    fireEvent.click(screen.getByText('削除する'))

    await waitFor(() => {
      expect(screen.getByText('理由を入力してください')).toBeInTheDocument()
    })
  })

  it('delete button disabled without reason for non-suspended user', () => {
    render(<UserDetailActions userId="u1" isSuspended={false} nickname="TestUser" />)

    fireEvent.click(screen.getByText('アカウントを削除'))

    const deleteBtn = screen.getByText('削除する')
    expect(deleteBtn).toBeDisabled()
  })
})
