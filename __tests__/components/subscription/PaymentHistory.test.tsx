import { vi } from 'vitest'
import { render, screen } from '../../utils/test-utils'
import { PaymentHistory } from '@/components/subscription/PaymentHistory'

// Next-Auth モック
vi.mock('next-auth/react', () => ({
  SessionProvider: ({ children }: { children: React.ReactNode }) => children,
  useSession: () => ({
    data: { user: { id: 'test-user-id' } },
    status: 'authenticated',
  }),
}))

const mockPayments = [
  {
    id: 'payment-1',
    amount: 500,
    currency: 'jpy',
    status: 'succeeded',
    description: 'プレミアム会員（月額）',
    createdAt: new Date('2024-01-15'),
  },
  {
    id: 'payment-2',
    amount: 500,
    currency: 'jpy',
    status: 'succeeded',
    description: 'プレミアム会員（月額）',
    createdAt: new Date('2024-02-15'),
  },
]

describe('PaymentHistory', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('支払い履歴がない場合は何も表示しない', () => {
    const { container } = render(<PaymentHistory payments={[]} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('支払い履歴タイトルを表示する', () => {
    render(<PaymentHistory payments={mockPayments} />)
    expect(screen.getByText('支払い履歴')).toBeInTheDocument()
  })

  it('支払い金額を表示する', () => {
    render(<PaymentHistory payments={mockPayments} />)
    const amounts = screen.getAllByText('¥500')
    expect(amounts.length).toBe(2)
  })

  it('支払い説明を表示する', () => {
    render(<PaymentHistory payments={mockPayments} />)
    const descriptions = screen.getAllByText('プレミアム会員（月額）')
    expect(descriptions.length).toBe(2)
  })

  it('支払い日を表示する', () => {
    render(<PaymentHistory payments={mockPayments} />)
    expect(screen.getByText(/2024年.*1月.*15日/)).toBeInTheDocument()
    expect(screen.getByText(/2024年.*2月.*15日/)).toBeInTheDocument()
  })

  it('成功ステータスを表示する', () => {
    render(<PaymentHistory payments={mockPayments} />)
    const statuses = screen.getAllByText('完了')
    expect(statuses.length).toBe(2)
  })

  it('処理中ステータスを表示する', () => {
    const pendingPayments = [
      {
        id: 'payment-1',
        amount: 500,
        currency: 'jpy',
        status: 'pending',
        description: null,
        createdAt: new Date(),
      },
    ]
    render(<PaymentHistory payments={pendingPayments} />)
    expect(screen.getByText('処理中')).toBeInTheDocument()
  })

  it('失敗ステータスを表示する', () => {
    const failedPayments = [
      {
        id: 'payment-1',
        amount: 500,
        currency: 'jpy',
        status: 'failed',
        description: null,
        createdAt: new Date(),
      },
    ]
    render(<PaymentHistory payments={failedPayments} />)
    expect(screen.getByText('失敗')).toBeInTheDocument()
  })

  it('説明がない場合はデフォルト表示', () => {
    const paymentsWithoutDescription = [
      {
        id: 'payment-1',
        amount: 500,
        currency: 'jpy',
        status: 'succeeded',
        description: null,
        createdAt: new Date(),
      },
    ]
    render(<PaymentHistory payments={paymentsWithoutDescription} />)
    expect(screen.getByText('プレミアム会員')).toBeInTheDocument()
  })

  it('USD通貨を表示する', () => {
    const usdPayments = [
      {
        id: 'payment-1',
        amount: 5,
        currency: 'usd',
        status: 'succeeded',
        description: 'Premium membership',
        createdAt: new Date(),
      },
    ]
    render(<PaymentHistory payments={usdPayments} />)
    expect(screen.getByText('5 USD')).toBeInTheDocument()
  })
})
