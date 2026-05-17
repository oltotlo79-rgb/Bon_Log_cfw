/**
 * ShopChangeRequestForm - branch coverage tests
 * Covers uncovered branches:
 * - Field toggle for businessHours/closedDays renders textarea
 * - Field toggle for website renders url input
 * - Submit with no actual changes shows error
 * - Submit with checked field but same value shows error
 * - createShopChangeRequest returns error without error property (generic)
 * - Success state rendering
 */

import { vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '../../utils/test-utils'
import { ShopChangeRequestForm } from '@/components/shop/ShopChangeRequestForm'

const mockRefresh = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    refresh: mockRefresh,
  }),
}))

const mockCreateShopChangeRequest = vi.fn()
vi.mock('@/lib/actions/shop', () => ({
  createShopChangeRequest: (...args: unknown[]) => mockCreateShopChangeRequest(...args),
}))

const mockShop = {
  id: 'shop-1',
  name: 'テスト盆栽園',
  address: '東京都渋谷区',
  phone: '03-1234-5678',
  website: 'https://example.com',
  businessHours: '9:00-17:00',
  closedDays: '水曜日',
}

describe('ShopChangeRequestForm - branch coverage', () => {
  const mockOnClose = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers({ shouldAdvanceTime: true })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('renders textarea for businessHours when checked', () => {
    render(<ShopChangeRequestForm shop={mockShop} onClose={mockOnClose} />)
    const checkbox = screen.getByText('営業時間').previousElementSibling as HTMLInputElement
    fireEvent.click(checkbox)

    // Should show textarea, not input
    expect(screen.getByPlaceholderText('新しい営業時間を入力')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('新しい営業時間を入力').tagName).toBe('TEXTAREA')
  })

  it('renders textarea for closedDays when checked', () => {
    render(<ShopChangeRequestForm shop={mockShop} onClose={mockOnClose} />)
    const checkbox = screen.getByText('定休日').previousElementSibling as HTMLInputElement
    fireEvent.click(checkbox)

    expect(screen.getByPlaceholderText('新しい定休日を入力')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('新しい定休日を入力').tagName).toBe('TEXTAREA')
  })

  it('renders url input for website when checked', () => {
    render(<ShopChangeRequestForm shop={mockShop} onClose={mockOnClose} />)
    const checkbox = screen.getByText('ウェブサイト').previousElementSibling as HTMLInputElement
    fireEvent.click(checkbox)

    const input = screen.getByPlaceholderText('新しいウェブサイトを入力')
    expect(input).toHaveAttribute('type', 'url')
  })

  it('renders text input for name when checked', () => {
    render(<ShopChangeRequestForm shop={mockShop} onClose={mockOnClose} />)
    const checkbox = screen.getByText('名称').previousElementSibling as HTMLInputElement
    fireEvent.click(checkbox)

    const input = screen.getByPlaceholderText('新しい名称を入力')
    expect(input).toHaveAttribute('type', 'text')
  })

  it('shows error when checked field has same value as original', async () => {
    render(<ShopChangeRequestForm shop={mockShop} onClose={mockOnClose} />)
    // Check name field but do not change value
    const checkbox = screen.getByText('名称').previousElementSibling as HTMLInputElement
    fireEvent.click(checkbox)

    // Submit
    fireEvent.click(screen.getByText('リクエストを送信'))

    await waitFor(() => {
      expect(screen.getByText('変更内容を選択し、現在の値と異なる内容を入力してください')).toBeInTheDocument()
    })
  })

  it('shows error when no fields are checked', async () => {
    render(<ShopChangeRequestForm shop={mockShop} onClose={mockOnClose} />)

    // Submit button should be disabled when no fields are checked
    expect(screen.getByText('リクエストを送信')).toBeDisabled()
  })

  it('shows generic error when createShopChangeRequest fails without error', async () => {
    mockCreateShopChangeRequest.mockResolvedValue({ success: false })
    render(<ShopChangeRequestForm shop={mockShop} onClose={mockOnClose} />)

    // Check name and change it
    const checkbox = screen.getByText('名称').previousElementSibling as HTMLInputElement
    fireEvent.click(checkbox)
    fireEvent.change(screen.getByPlaceholderText('新しい名称を入力'), { target: { value: '新しい名前' } })

    fireEvent.click(screen.getByText('リクエストを送信'))

    await waitFor(() => {
      expect(screen.getByText('エラー')).toBeInTheDocument()
    })
  })

  it('shows success state and calls onClose after timeout', async () => {
    mockCreateShopChangeRequest.mockResolvedValue({ success: true })
    render(<ShopChangeRequestForm shop={mockShop} onClose={mockOnClose} />)

    const checkbox = screen.getByText('名称').previousElementSibling as HTMLInputElement
    fireEvent.click(checkbox)
    fireEvent.change(screen.getByPlaceholderText('新しい名称を入力'), { target: { value: '新しい名前' } })

    fireEvent.click(screen.getByText('リクエストを送信'))

    await waitFor(() => {
      expect(screen.getByText('変更リクエストを送信しました')).toBeInTheDocument()
    })

    // Advance timer to trigger the setTimeout callback
    vi.advanceTimersByTime(2000)

    await waitFor(() => {
      expect(mockOnClose).toHaveBeenCalled()
      expect(mockRefresh).toHaveBeenCalled()
    })
  })

  it('shows current value as （未設定） when null', () => {
    const shopWithNulls = { ...mockShop, phone: null, website: null, businessHours: null, closedDays: null }
    render(<ShopChangeRequestForm shop={shopWithNulls} onClose={mockOnClose} />)

    const checkbox = screen.getByText('電話番号').previousElementSibling as HTMLInputElement
    fireEvent.click(checkbox)

    expect(screen.getByText(/（未設定）/)).toBeInTheDocument()
  })

  it('close button calls onClose', () => {
    render(<ShopChangeRequestForm shop={mockShop} onClose={mockOnClose} />)
    // Close button in header (the X button)
    const closeButtons = screen.getAllByRole('button')
    // First button is the X close button
    fireEvent.click(closeButtons[0])
    expect(mockOnClose).toHaveBeenCalled()
  })
})
