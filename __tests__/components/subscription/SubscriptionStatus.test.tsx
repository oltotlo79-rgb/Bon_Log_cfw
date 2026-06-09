import { vi } from 'vitest'
import { render, screen, waitFor } from '../../utils/test-utils'
import userEvent from '@testing-library/user-event'
import { SubscriptionStatus } from '@/components/subscription/SubscriptionStatus'

// Next-Auth モック
vi.mock('next-auth/react', () => ({
  SessionProvider: ({ children }: { children: React.ReactNode }) => children,
  useSession: () => ({
    data: { user: { id: 'test-user-id' } },
    status: 'authenticated',
  }),
}))

// Server Actions モック
const mockCreateCustomerPortalSession = vi.fn()
vi.mock('@/lib/actions/subscription', () => ({
  createCustomerPortalSession: () => mockCreateCustomerPortalSession(),
}))

const defaultProps = {
  isPremium: true,
  premiumExpiresAt: null,
  subscription: {
    status: 'active',
    currentPeriodEnd: new Date('2024-12-31'),
    cancelAtPeriodEnd: false,
  },
}

describe('SubscriptionStatus', () => {
  let locationHrefSetter: ReturnType<typeof vi.fn>

  beforeEach(() => {
    vi.clearAllMocks()
    locationHrefSetter = vi.fn()
    // Replace window.location so we can intercept the href setter that SubscriptionStatus.tsx uses
    // to redirect to Stripe portal. jsdom's location.href is non-configurable, so replace whole object.
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: {
        href: 'http://localhost/',
        pathname: '/',
        search: '',
        hash: '',
        hostname: 'localhost',
        host: 'localhost',
        port: '',
        protocol: 'http:',
        origin: 'http://localhost',
        ancestorOrigins: window.location.ancestorOrigins,
        get href() { return 'http://localhost/' },
        set href(url: string) { locationHrefSetter(url) },
        reload: vi.fn(),
        assign: vi.fn(),
        replace: vi.fn(),
        toString: () => 'http://localhost/',
      },
    })
  })

  it('プレミアム会員でない場合は何も表示しない', () => {
    const { container } = render(
      <SubscriptionStatus isPremium={false} premiumExpiresAt={null} subscription={null} />
    )
    expect(container).toBeEmptyDOMElement()
  })

  it('プレミアムバッジを表示する', () => {
    render(<SubscriptionStatus {...defaultProps} />)
    expect(screen.getByText('プレミアム会員')).toBeInTheDocument()
  })

  it('現在のプランラベルを表示する', () => {
    render(<SubscriptionStatus {...defaultProps} />)
    expect(screen.getByText('現在のプラン')).toBeInTheDocument()
  })

  it('ステータスを表示する', () => {
    render(<SubscriptionStatus {...defaultProps} />)
    expect(screen.getByText('ステータス')).toBeInTheDocument()
    expect(screen.getByText('有効')).toBeInTheDocument()
  })

  it('次回更新日を表示する', () => {
    render(<SubscriptionStatus {...defaultProps} />)
    expect(screen.getByText('次回更新日')).toBeInTheDocument()
    expect(screen.getByText('2024年12月31日')).toBeInTheDocument()
  })

  it('プラン管理ボタンを表示する', () => {
    render(<SubscriptionStatus {...defaultProps} />)
    expect(screen.getByRole('button', { name: /プラン管理/ })).toBeInTheDocument()
  })

  it('解約予定の場合は警告を表示', () => {
    render(
      <SubscriptionStatus
        {...defaultProps}
        subscription={{
          ...defaultProps.subscription!,
          cancelAtPeriodEnd: true,
        }}
      />
    )
    expect(screen.getByText('期間終了時に解約されます')).toBeInTheDocument()
  })

  it('プラン管理クリックでポータルセッションを作成', async () => {
    mockCreateCustomerPortalSession.mockResolvedValue({ url: 'https://billing.stripe.com/xxx' })
    const user = userEvent.setup()
    render(<SubscriptionStatus {...defaultProps} />)

    await user.click(screen.getByRole('button', { name: /プラン管理/ }))

    await waitFor(() => {
      expect(mockCreateCustomerPortalSession).toHaveBeenCalled()
    })
  })

  it('ポータルURLへのリダイレクトを試みる', async () => {
    mockCreateCustomerPortalSession.mockResolvedValue({ url: 'https://billing.stripe.com/xxx' })
    const user = userEvent.setup()
    render(<SubscriptionStatus {...defaultProps} />)

    await user.click(screen.getByRole('button', { name: /プラン管理/ }))

    await waitFor(() => {
      expect(locationHrefSetter).toHaveBeenCalledWith('https://billing.stripe.com/xxx')
    })
  })

  it('サブスクリプションがない場合（管理者付与）の表示', () => {
    render(
      <SubscriptionStatus
        isPremium={true}
        premiumExpiresAt={new Date('2025-01-01')}
        subscription={null}
      />
    )
    expect(screen.getByText('有効期限')).toBeInTheDocument()
    expect(screen.getByText('管理者により付与されたプレミアム会員です')).toBeInTheDocument()
  })

  it('無期限プレミアムの場合', () => {
    render(
      <SubscriptionStatus
        isPremium={true}
        premiumExpiresAt={null}
        subscription={null}
      />
    )
    expect(screen.getByText('無期限')).toBeInTheDocument()
  })

  it('エラー時にエラーメッセージを表示する', async () => {
    mockCreateCustomerPortalSession.mockResolvedValue({ error: 'エラーが発生しました' })
    const user = userEvent.setup()
    render(<SubscriptionStatus {...defaultProps} />)

    await user.click(screen.getByRole('button', { name: /プラン管理/ }))

    await waitFor(() => {
      expect(screen.getByText('エラーが発生しました')).toBeInTheDocument()
    })
  })
})
