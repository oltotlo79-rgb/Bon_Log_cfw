/**
 * ShopForm - branch coverage tests
 * Covers uncovered branches:
 * - updateShop success without shopId (edit mode redirect to initialData.id)
 * - createShop result with no error property (generic error)
 * - deleteShop result with no error property (generic error)
 * - latitude/longitude conditional appending to FormData
 * - optional fields (phone, website, businessHours, closedDays) conditional appending
 * - edit mode submit with pending button text '更新中...'
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
const mockSearchAddressSuggestions = vi.fn()
vi.mock('@/lib/actions/shop', () => ({
  createShop: (...args: unknown[]) => mockCreateShop(...args),
  updateShop: (...args: unknown[]) => mockUpdateShop(...args),
  deleteShop: (...args: unknown[]) => mockDeleteShop(...args),
  searchAddressSuggestions: (...args: unknown[]) => mockSearchAddressSuggestions(...args),
}))

vi.mock('@/components/shop/BusinessHoursInput', () => ({
  BusinessHoursInput: ({ value, onChange, disabled }: { value: string; onChange: (v: string) => void; disabled?: boolean }) => (
    <div data-testid="business-hours-input">
      <input
        data-testid="business-hours-field"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        placeholder="営業時間"
      />
    </div>
  ),
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

describe('ShopForm - branch coverage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSearchAddressSuggestions.mockResolvedValue({ suggestions: [] })
  })

  it('createShop returns success:false without error property shows generic error', async () => {
    mockCreateShop.mockResolvedValue({ success: false })
    render(<ShopForm genres={mockGenres} mode="create" />)
    fireEvent.change(screen.getByLabelText(/名称/), { target: { value: 'テスト' } })
    fireEvent.change(screen.getByLabelText(/住所/), { target: { value: '東京都' } })
    fireEvent.click(screen.getByRole('button', { name: '登録する' }))

    await waitFor(() => {
      expect(screen.getByText('このまま登録')).toBeInTheDocument()
    })
    fireEvent.click(screen.getByText('このまま登録'))

    await waitFor(() => {
      expect(screen.getByText('エラー')).toBeInTheDocument()
    })
  })

  it('updateShop success without shopId redirects to initialData.id', async () => {
    // Returns success:true but no shopId property
    mockUpdateShop.mockResolvedValue({ success: true })
    render(<ShopForm genres={mockGenres} mode="edit" initialData={mockInitialData} />)
    fireEvent.click(screen.getByRole('button', { name: '更新する' }))

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/shops/shop-1')
    })
  })

  it('deleteShop returns success:false without error property shows generic error', async () => {
    mockDeleteShop.mockResolvedValue({ success: false })
    render(<ShopForm genres={mockGenres} mode="edit" initialData={mockInitialData} />)
    fireEvent.click(screen.getByRole('button', { name: 'この盆栽園を削除' }))

    await waitFor(() => {
      expect(screen.getByText('削除する')).toBeInTheDocument()
    })
    fireEvent.click(screen.getByText('削除する'))

    await waitFor(() => {
      expect(screen.getByText('エラー')).toBeInTheDocument()
    })
  })

  it('submits without optional fields when they are empty', async () => {
    const dataWithoutOptionals = {
      ...mockInitialData,
      phone: null,
      website: null,
      businessHours: null,
      closedDays: null,
      genres: [],
    }
    mockUpdateShop.mockResolvedValue({ success: true })
    render(<ShopForm genres={mockGenres} mode="edit" initialData={dataWithoutOptionals} />)
    fireEvent.click(screen.getByRole('button', { name: '更新する' }))

    await waitFor(() => {
      expect(mockUpdateShop).toHaveBeenCalled()
      const formData = mockUpdateShop.mock.calls[0][1] as FormData
      expect(formData.get('phone')).toBeNull()
      expect(formData.get('website')).toBeNull()
      expect(formData.get('businessHours')).toBeNull()
      expect(formData.get('closedDays')).toBeNull()
    })
  })

  it('submits without latitude/longitude when they are null', async () => {
    mockCreateShop.mockResolvedValue({ success: true, data: { shopId: 'new-id' } })
    render(<ShopForm genres={mockGenres} mode="create" />)
    fireEvent.change(screen.getByLabelText(/名称/), { target: { value: 'テスト' } })
    fireEvent.change(screen.getByLabelText(/住所/), { target: { value: '東京都' } })
    fireEvent.click(screen.getByRole('button', { name: '登録する' }))

    await waitFor(() => {
      expect(screen.getByText('このまま登録')).toBeInTheDocument()
    })
    fireEvent.click(screen.getByText('このまま登録'))

    await waitFor(() => {
      const formData = mockCreateShop.mock.calls[0][0] as FormData
      expect(formData.get('latitude')).toBeNull()
      expect(formData.get('longitude')).toBeNull()
    })
  })

  it('edit mode shows 更新中... while pending', async () => {
    mockUpdateShop.mockImplementation(() => new Promise(() => {}))
    render(<ShopForm genres={mockGenres} mode="edit" initialData={mockInitialData} />)
    fireEvent.click(screen.getByRole('button', { name: '更新する' }))

    await waitFor(() => {
      expect(screen.getByText('更新中...')).toBeInTheDocument()
    })
  })

  it('create mode: success without shopId does not redirect or refresh', async () => {
    // discriminated union リファクタにより、
    // create 成功かつ data に shopId が無い場合は push/refresh とも呼ばれない
    // （以前は initialData?.id へリダイレクトしていたが、
    //  create モードでは initialData が無いためその挙動は無意味だった）
    mockCreateShop.mockResolvedValue({ success: true, data: {} })
    render(<ShopForm genres={mockGenres} mode="create" />)
    fireEvent.change(screen.getByLabelText(/名称/), { target: { value: 'テスト' } })
    fireEvent.change(screen.getByLabelText(/住所/), { target: { value: '東京都' } })
    fireEvent.click(screen.getByRole('button', { name: '登録する' }))

    await waitFor(() => {
      expect(screen.getByText('このまま登録')).toBeInTheDocument()
    })
    fireEvent.click(screen.getByText('このまま登録'))

    await waitFor(() => {
      expect(mockCreateShop).toHaveBeenCalled()
    })
    expect(mockPush).not.toHaveBeenCalled()
    expect(mockRefresh).not.toHaveBeenCalled()
  })

  it('createShop with existingId appends 既存の盆栽園を確認しますか？ to error', async () => {
    mockCreateShop.mockResolvedValue({ success: false, error: '同名の盆栽園が既に存在します', existingId: 'existing-1' })
    render(<ShopForm genres={mockGenres} mode="create" />)
    fireEvent.change(screen.getByLabelText(/名称/), { target: { value: 'テスト' } })
    fireEvent.change(screen.getByLabelText(/住所/), { target: { value: '東京都' } })
    fireEvent.click(screen.getByRole('button', { name: '登録する' }))

    await waitFor(() => {
      expect(screen.getByText('このまま登録')).toBeInTheDocument()
    })
    fireEvent.click(screen.getByText('このまま登録'))

    await waitFor(() => {
      expect(screen.getByText(/既存の盆栽園を確認しますか？/)).toBeInTheDocument()
    })
  })

  it('delete success: replace に ROUTE_SHOPS (/shops) が渡される', async () => {
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
})
