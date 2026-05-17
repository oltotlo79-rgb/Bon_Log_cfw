/**
 * ShopForm - extra branch coverage tests
 *
 * Targets:
 * - createShop returns existingId alongside error (duplicate shop merge prompt)
 * - createShop returns success with shopId
 * - cancel submit dialog (handleCancelSubmit)
 * - handleDelete with no initialData.id (early return)
 * - deleteShop success path (router.replace)
 * - create mode pending button text '登録中...'
 */

import { vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '../../utils/test-utils'
import { ShopForm } from '@/components/shop/ShopForm'

vi.mock('next-auth/react', () => ({
  SessionProvider: ({ children }: { children: React.ReactNode }) => children,
  useSession: () => ({
    data: { user: { id: 'test-user-id' } },
    status: 'authenticated',
  }),
}))

const mockPush = vi.fn()
const mockBack = vi.fn()
const mockReplace = vi.fn()
const mockRefresh = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    back: mockBack,
    replace: mockReplace,
    refresh: mockRefresh,
  }),
}))

const mockCreateShop = vi.fn()
const mockUpdateShop = vi.fn()
const mockDeleteShop = vi.fn()
vi.mock('@/lib/actions/shop', () => ({
  createShop: (...args: unknown[]) => mockCreateShop(...args),
  updateShop: (...args: unknown[]) => mockUpdateShop(...args),
  deleteShop: (...args: unknown[]) => mockDeleteShop(...args),
  searchAddressSuggestions: vi.fn().mockResolvedValue({ suggestions: [] }),
}))

const mockGenres = [
  { id: 'genre-1', name: '黒松', category: '松柏類' },
]

const mockInitialData = {
  id: 'shop-1',
  name: 'テスト盆栽園',
  address: '東京都渋谷区',
  latitude: 35.6 as number | null,
  longitude: 139.7 as number | null,
  phone: '03-1234-5678' as string | null,
  website: 'https://example.com' as string | null,
  businessHours: '9:00-17:00' as string | null,
  closedDays: '水曜日' as string | null,
  genres: [mockGenres[0]],
}

describe('ShopForm - extra branch coverage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('createShop with existingId appends merge prompt to error message', async () => {
    mockCreateShop.mockResolvedValue({
      success: false,
      error: '類似する盆栽園が存在します',
      existingId: 'existing-shop-id',
    })
    render(<ShopForm genres={mockGenres} mode="create" />)

    fireEvent.change(screen.getByLabelText(/名称/), { target: { value: 'テスト' } })
    fireEvent.change(screen.getByLabelText(/住所/), { target: { value: '東京都' } })
    fireEvent.click(screen.getByRole('button', { name: '登録する' }))

    // Confirm dialog for missing location
    await waitFor(() => {
      expect(screen.getByText('このまま登録')).toBeInTheDocument()
    })
    fireEvent.click(screen.getByText('このまま登録'))

    await waitFor(() => {
      expect(screen.getByText(/既存の盆栽園を確認しますか/)).toBeInTheDocument()
    })
  })

  it('createShop success with shopId navigates to new shop page', async () => {
    mockCreateShop.mockResolvedValue({ success: true, data: { shopId: 'new-shop-id' } })
    render(<ShopForm genres={mockGenres} mode="create" />)

    fireEvent.change(screen.getByLabelText(/名称/), { target: { value: 'テスト' } })
    fireEvent.change(screen.getByLabelText(/住所/), { target: { value: '東京都' } })
    fireEvent.click(screen.getByRole('button', { name: '登録する' }))

    await waitFor(() => {
      expect(screen.getByText('このまま登録')).toBeInTheDocument()
    })
    fireEvent.click(screen.getByText('このまま登録'))

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/shops/new-shop-id')
      expect(mockRefresh).toHaveBeenCalled()
    })
  })

  it('cancel submit dialog returns to form without submitting', async () => {
    render(<ShopForm genres={mockGenres} mode="create" />)

    fireEvent.change(screen.getByLabelText(/名称/), { target: { value: 'テスト' } })
    fireEvent.change(screen.getByLabelText(/住所/), { target: { value: '東京都' } })
    fireEvent.click(screen.getByRole('button', { name: '登録する' }))

    await waitFor(() => {
      expect(screen.getByText('戻って位置取得')).toBeInTheDocument()
    })
    fireEvent.click(screen.getByText('戻って位置取得'))

    // Dialog should close, form should be visible
    expect(screen.queryByText('このまま登録')).not.toBeInTheDocument()
    expect(mockCreateShop).not.toHaveBeenCalled()
  })

  it('deleteShop success redirects to /shops', async () => {
    mockDeleteShop.mockResolvedValue({ success: true })
    render(<ShopForm genres={mockGenres} mode="edit" initialData={mockInitialData} />)

    fireEvent.click(screen.getByRole('button', { name: 'この盆栽園を削除' }))

    await waitFor(() => {
      expect(screen.getByText('削除する')).toBeInTheDocument()
    })
    fireEvent.click(screen.getByText('削除する'))

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/shops')
    })
  })

  it('cancel button calls router.back()', () => {
    render(<ShopForm genres={mockGenres} mode="create" />)

    fireEvent.click(screen.getByRole('button', { name: 'キャンセル' }))

    expect(mockBack).toHaveBeenCalled()
  })

  it('create mode shows 登録中... while pending', async () => {
    mockCreateShop.mockImplementation(() => new Promise(() => {}))
    render(<ShopForm genres={mockGenres} mode="create" />)

    fireEvent.change(screen.getByLabelText(/名称/), { target: { value: 'テスト' } })
    fireEvent.change(screen.getByLabelText(/住所/), { target: { value: '東京都' } })
    fireEvent.click(screen.getByRole('button', { name: '登録する' }))

    await waitFor(() => {
      expect(screen.getByText('このまま登録')).toBeInTheDocument()
    })
    fireEvent.click(screen.getByText('このまま登録'))

    await waitFor(() => {
      expect(screen.getByText('登録中...')).toBeInTheDocument()
    })
  })

  it('delete cancel button in delete dialog closes the dialog', async () => {
    render(<ShopForm genres={mockGenres} mode="edit" initialData={mockInitialData} />)

    fireEvent.click(screen.getByRole('button', { name: 'この盆栽園を削除' }))

    await waitFor(() => {
      expect(screen.getByText('削除する')).toBeInTheDocument()
    })

    // Click the cancel button in the delete dialog
    const cancelButtons = screen.getAllByRole('button', { name: 'キャンセル' })
    fireEvent.click(cancelButtons[cancelButtons.length - 1])

    expect(screen.queryByText('盆栽園を削除')).not.toBeInTheDocument()
  })
})
