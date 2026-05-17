

import { vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '../../utils/test-utils'
import { PremiumActionsDropdown } from '@/app/admin/premium/PremiumActionsDropdown'

const mockRefresh = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: mockRefresh }),
}))

const mockGrantPremium = vi.fn()
const mockRevokePremium = vi.fn()
const mockExtendPremium = vi.fn()
vi.mock('@/lib/actions/admin/premium', () => ({
  grantPremium: (...args: unknown[]) => mockGrantPremium(...args),
  revokePremium: (...args: unknown[]) => mockRevokePremium(...args),
  extendPremium: (...args: unknown[]) => mockExtendPremium(...args),
}))

// Mock lucide-react icons
vi.mock('lucide-react', () => ({
  MoreHorizontal: ({ className }: { className?: string }) => <span data-testid="more-icon" className={className} />,
  Crown: ({ className }: { className?: string }) => <span data-testid="crown-icon" className={className} />,
  Ban: ({ className }: { className?: string }) => <span data-testid="ban-icon" className={className} />,
  CalendarPlus: ({ className }: { className?: string }) => <span data-testid="calendar-icon" className={className} />,
}))

// Mock Radix dropdown to simple HTML
vi.mock('@/components/ui/dropdown-menu', () => ({
  DropdownMenu: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DropdownMenuTrigger: ({ children, asChild: _asChild }: { children: React.ReactNode; asChild?: boolean }) => <div data-testid="trigger">{children}</div>,
  DropdownMenuContent: ({ children }: { children: React.ReactNode }) => <div data-testid="menu-content">{children}</div>,
  DropdownMenuItem: ({ children, onClick, className }: { children: React.ReactNode; onClick?: () => void; className?: string }) => (
    <button onClick={onClick} className={className}>{children}</button>
  ),
  DropdownMenuSeparator: () => <hr />,
}))

// Mock Dialog components
vi.mock('@/components/ui/dialog', () => ({
  Dialog: ({ open, children, onOpenChange: _onOpenChange }: { open: boolean; children: React.ReactNode; onOpenChange?: (v: boolean) => void }) => (
    open ? <div data-testid="dialog">{children}</div> : null
  ),
  DialogContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogDescription: ({ children }: { children: React.ReactNode }) => <p>{children}</p>,
  DialogFooter: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>,
}))

describe('PremiumActionsDropdown', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGrantPremium.mockResolvedValue({})
    mockRevokePremium.mockResolvedValue({})
    mockExtendPremium.mockResolvedValue({})
  })

  const nonPremiumProps = {
    userId: 'u1',
    userName: 'テストユーザー',
    isPremium: false,
    premiumExpiresAt: null,
  }

  const premiumProps = {
    userId: 'u1',
    userName: 'テストユーザー',
    isPremium: true,
    premiumExpiresAt: new Date('2025-12-31'),
  }

  it('トリガーボタンが表示される', () => {
    render(<PremiumActionsDropdown {...nonPremiumProps} />)
    expect(screen.getByTestId('trigger')).toBeInTheDocument()
  })

  it('非プレミアムユーザーでプレミアム付与メニューを表示する', () => {
    render(<PremiumActionsDropdown {...nonPremiumProps} />)
    expect(screen.getByText('プレミアムを付与')).toBeInTheDocument()
  })

  it('プレミアムユーザーで期限延長と取り消しメニューを表示する', () => {
    render(<PremiumActionsDropdown {...premiumProps} />)
    expect(screen.getByText('期限を延長')).toBeInTheDocument()
    expect(screen.getByText('プレミアムを取り消し')).toBeInTheDocument()
  })

  it('非プレミアムでは延長・取り消しを表示しない', () => {
    render(<PremiumActionsDropdown {...nonPremiumProps} />)
    expect(screen.queryByText('期限を延長')).not.toBeInTheDocument()
    expect(screen.queryByText('プレミアムを取り消し')).not.toBeInTheDocument()
  })

  it('プレミアム付与ダイアログを表示する', () => {
    render(<PremiumActionsDropdown {...nonPremiumProps} />)
    fireEvent.click(screen.getByText('プレミアムを付与'))
    expect(screen.getByText('プレミアム会員を付与')).toBeInTheDocument()
    expect(screen.getByText(/テストユーザー さんにプレミアム会員を付与します/)).toBeInTheDocument()
  })

  it('プレミアム付与を実行する', async () => {
    render(<PremiumActionsDropdown {...nonPremiumProps} />)
    fireEvent.click(screen.getByText('プレミアムを付与'))
    fireEvent.click(screen.getByText('付与する'))
    await waitFor(() => {
      expect(mockGrantPremium).toHaveBeenCalledWith('u1', 30)
    })
    expect(mockRefresh).toHaveBeenCalled()
  })

  it('無効な日数では付与しない', async () => {
    render(<PremiumActionsDropdown {...nonPremiumProps} />)
    fireEvent.click(screen.getByText('プレミアムを付与'))
    const input = screen.getByDisplayValue('30')
    fireEvent.change(input, { target: { value: '0' } })
    fireEvent.click(screen.getByText('付与する'))
    await waitFor(() => {
      expect(mockGrantPremium).not.toHaveBeenCalled()
    })
  })

  it('NaN日数では付与しない', async () => {
    render(<PremiumActionsDropdown {...nonPremiumProps} />)
    fireEvent.click(screen.getByText('プレミアムを付与'))
    const input = screen.getByDisplayValue('30')
    fireEvent.change(input, { target: { value: 'abc' } })
    fireEvent.click(screen.getByText('付与する'))
    await waitFor(() => {
      expect(mockGrantPremium).not.toHaveBeenCalled()
    })
  })

  it('取り消しダイアログを表示して実行する', async () => {
    render(<PremiumActionsDropdown {...premiumProps} />)
    fireEvent.click(screen.getByText('プレミアムを取り消し'))
    expect(screen.getByText(/プレミアム会員を取り消しますか/)).toBeInTheDocument()
    fireEvent.click(screen.getByText('取り消す'))
    await waitFor(() => {
      expect(mockRevokePremium).toHaveBeenCalledWith('u1')
    })
    expect(mockRefresh).toHaveBeenCalled()
  })

  it('延長ダイアログを表示して実行する', async () => {
    render(<PremiumActionsDropdown {...premiumProps} />)
    fireEvent.click(screen.getByText('期限を延長'))
    expect(screen.getByText('プレミアム期限を延長')).toBeInTheDocument()
    fireEvent.click(screen.getByText('延長する'))
    await waitFor(() => {
      expect(mockExtendPremium).toHaveBeenCalledWith('u1', 30)
    })
    expect(mockRefresh).toHaveBeenCalled()
  })

  it('無効な日数では延長しない', async () => {
    render(<PremiumActionsDropdown {...premiumProps} />)
    fireEvent.click(screen.getByText('期限を延長'))
    const input = screen.getByDisplayValue('30')
    fireEvent.change(input, { target: { value: '-1' } })
    fireEvent.click(screen.getByText('延長する'))
    await waitFor(() => {
      expect(mockExtendPremium).not.toHaveBeenCalled()
    })
  })

  it('キャンセルボタンでダイアログを閉じる（付与）', () => {
    render(<PremiumActionsDropdown {...nonPremiumProps} />)
    fireEvent.click(screen.getByText('プレミアムを付与'))
    expect(screen.getByText('プレミアム会員を付与')).toBeInTheDocument()
    fireEvent.click(screen.getByText('キャンセル'))
    expect(screen.queryByText('プレミアム会員を付与')).not.toBeInTheDocument()
  })

  it('premiumExpiresAtがnullでも延長ダイアログが表示される', () => {
    render(<PremiumActionsDropdown {...premiumProps} premiumExpiresAt={null} />)
    fireEvent.click(screen.getByText('期限を延長'))
    expect(screen.getByText('プレミアム期限を延長')).toBeInTheDocument()
  })

  it('premiumExpiresAtがある場合に期限を表示する', () => {
    render(<PremiumActionsDropdown {...premiumProps} />)
    fireEvent.click(screen.getByText('期限を延長'))
    expect(screen.getByText(/現在の期限/)).toBeInTheDocument()
  })
})
