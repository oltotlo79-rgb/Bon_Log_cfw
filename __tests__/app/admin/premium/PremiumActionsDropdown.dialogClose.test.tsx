/**
 * app/admin/premium/PremiumActionsDropdown.tsx
 *
 * 既存の PremiumActionsDropdown.test.tsx では Dialog モックが onOpenChange を
 * 無視するため、以下の未カバー分岐が残っていた:
 * - 延長ダイアログ・取り消しダイアログの「キャンセル」ボタン
 * - 各ダイアログの onOpenChange（Escape / オーバーレイクリック相当）でダイアログが閉じること
 *
 * ここでは onOpenChange を実際に呼び出す Dialog モックを使い、
 * 「ダイアログの外側操作でも状態がリセットされる」実際の挙動を検証する。
 */
import { vi } from 'vitest'
import { render, screen, fireEvent } from '../../../utils/test-utils'
import { PremiumActionsDropdown } from '@/app/admin/premium/PremiumActionsDropdown'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}))

vi.mock('@/lib/actions/admin/premium', () => ({
  grantPremium: vi.fn().mockResolvedValue({}),
  revokePremium: vi.fn().mockResolvedValue({}),
  extendPremium: vi.fn().mockResolvedValue({}),
}))

vi.mock('lucide-react', () => ({
  MoreHorizontal: () => <span data-testid="more-icon" />,
  Crown: () => <span data-testid="crown-icon" />,
  Ban: () => <span data-testid="ban-icon" />,
  CalendarPlus: () => <span data-testid="calendar-icon" />,
}))

vi.mock('@/components/ui/dropdown-menu', () => ({
  DropdownMenu: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DropdownMenuTrigger: ({ children }: { children: React.ReactNode }) => <div data-testid="trigger">{children}</div>,
  DropdownMenuContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DropdownMenuItem: ({
    children,
    onClick,
    className,
  }: {
    children: React.ReactNode
    onClick?: () => void
    className?: string
  }) => (
    <button onClick={onClick} className={className}>
      {children}
    </button>
  ),
  DropdownMenuSeparator: () => <hr />,
}))

// Radix の Dialog は Escape / オーバーレイクリック時に onOpenChange(false) を呼ぶ。
// ここでは「閉じるボタン」で onOpenChange を実際に呼び出すモックにして、その経路を再現する。
vi.mock('@/components/ui/dialog', () => ({
  Dialog: ({
    open,
    children,
    onOpenChange,
  }: {
    open: boolean
    children: React.ReactNode
    onOpenChange: (open: boolean) => void
  }) =>
    open ? (
      <div data-testid="dialog">
        <button data-testid="overlay-close" onClick={() => onOpenChange(false)}>
          overlay
        </button>
        {children}
      </div>
    ) : null,
  DialogContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogDescription: ({ children }: { children: React.ReactNode }) => <p>{children}</p>,
  DialogFooter: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>,
}))

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

describe('PremiumActionsDropdown - ダイアログを閉じる分岐', () => {
  it('付与ダイアログはonOpenChange(false)でも閉じる', () => {
    render(<PremiumActionsDropdown {...nonPremiumProps} />)
    fireEvent.click(screen.getByText('プレミアムを付与'))
    expect(screen.getByText('プレミアム会員を付与')).toBeInTheDocument()

    fireEvent.click(screen.getByTestId('overlay-close'))
    expect(screen.queryByText('プレミアム会員を付与')).not.toBeInTheDocument()
  })

  it('延長ダイアログのキャンセルボタンで閉じる', () => {
    render(<PremiumActionsDropdown {...premiumProps} />)
    fireEvent.click(screen.getByText('期限を延長'))
    expect(screen.getByText('プレミアム期限を延長')).toBeInTheDocument()

    fireEvent.click(screen.getByText('キャンセル'))
    expect(screen.queryByText('プレミアム期限を延長')).not.toBeInTheDocument()
  })

  it('延長ダイアログはonOpenChange(false)でも閉じる', () => {
    render(<PremiumActionsDropdown {...premiumProps} />)
    fireEvent.click(screen.getByText('期限を延長'))
    fireEvent.click(screen.getByTestId('overlay-close'))
    expect(screen.queryByText('プレミアム期限を延長')).not.toBeInTheDocument()
  })

  it('取り消しダイアログのキャンセルボタンで閉じる', () => {
    render(<PremiumActionsDropdown {...premiumProps} />)
    fireEvent.click(screen.getByText('プレミアムを取り消し'))
    expect(screen.getByText('プレミアム会員を取り消し')).toBeInTheDocument()

    fireEvent.click(screen.getByText('キャンセル'))
    expect(screen.queryByText('プレミアム会員を取り消し')).not.toBeInTheDocument()
  })

  it('取り消しダイアログはonOpenChange(false)でも閉じる', () => {
    render(<PremiumActionsDropdown {...premiumProps} />)
    fireEvent.click(screen.getByText('プレミアムを取り消し'))
    fireEvent.click(screen.getByTestId('overlay-close'))
    expect(screen.queryByText('プレミアム会員を取り消し')).not.toBeInTheDocument()
  })
})
