import { vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '../../utils/test-utils'
import userEvent from '@testing-library/user-event'
import { ShopForm } from '@/components/shop/ShopForm'

// Next-Auth モック
vi.mock('next-auth/react', () => ({
  SessionProvider: ({ children }: { children: React.ReactNode }) => children,
  useSession: () => ({
    data: { user: { id: 'test-user-id' } },
    status: 'authenticated',
  }),
}))

// Next.js navigation モック
const mockPush = vi.fn()
const mockBack = vi.fn()
const mockReplace = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    back: mockBack,
    replace: mockReplace,
    refresh: vi.fn(),
  }),
}))

// Server Actions モック
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

// BusinessHoursInput モック
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
  { id: 'genre-2', name: '五葉松', category: '松柏類' },
  { id: 'genre-3', name: 'もみじ', category: '雑木類' },
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

describe('ShopForm', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSearchAddressSuggestions.mockResolvedValue({ suggestions: [] })
    mockCreateShop.mockResolvedValue({ success: true, data: { shopId: 'new-shop-id' } })
    mockUpdateShop.mockResolvedValue({ success: true })
    mockDeleteShop.mockResolvedValue({ success: true })
  })

  it('名称フィールドを表示する', () => {
    render(<ShopForm genres={mockGenres} mode="create" />)
    expect(screen.getByLabelText(/名称/)).toBeInTheDocument()
  })

  it('住所フィールドを表示する', () => {
    render(<ShopForm genres={mockGenres} mode="create" />)
    expect(screen.getByLabelText(/住所/)).toBeInTheDocument()
  })

  it('電話番号フィールドを表示する', () => {
    render(<ShopForm genres={mockGenres} mode="create" />)
    expect(screen.getByLabelText(/電話番号/)).toBeInTheDocument()
  })

  it('説明（ウェブサイト）フィールドを表示する', () => {
    render(<ShopForm genres={mockGenres} mode="create" />)
    expect(screen.getByLabelText(/ウェブサイト/)).toBeInTheDocument()
  })

  it('名称を入力できる', async () => {
    const user = userEvent.setup()
    render(<ShopForm genres={mockGenres} mode="create" />)
    const nameInput = screen.getByLabelText(/名称/)
    await user.type(nameInput, 'テスト盆栽園')
    expect(nameInput).toHaveValue('テスト盆栽園')
  })

  it('住所を入力できる', () => {
    render(<ShopForm genres={mockGenres} mode="create" />)
    const addressInput = screen.getByLabelText(/住所/)
    fireEvent.change(addressInput, { target: { value: '東京都' } })
    expect(addressInput).toHaveValue('東京都')
  })

  it('電話番号を入力できる', async () => {
    const user = userEvent.setup()
    render(<ShopForm genres={mockGenres} mode="create" />)
    const phoneInput = screen.getByLabelText(/電話番号/)
    await user.type(phoneInput, '03-1234-5678')
    expect(phoneInput).toHaveValue('03-1234-5678')
  })

  it('ウェブサイトを入力できる', async () => {
    const user = userEvent.setup()
    render(<ShopForm genres={mockGenres} mode="create" />)
    const websiteInput = screen.getByLabelText(/ウェブサイト/)
    await user.type(websiteInput, 'https://example.com')
    expect(websiteInput).toHaveValue('https://example.com')
  })

  it('送信ボタンを表示する（新規作成モード）', () => {
    render(<ShopForm genres={mockGenres} mode="create" />)
    expect(screen.getByRole('button', { name: '登録する' })).toBeInTheDocument()
  })

  it('送信ボタンを表示する（編集モード）', () => {
    render(<ShopForm genres={mockGenres} mode="edit" initialData={mockInitialData} />)
    expect(screen.getByRole('button', { name: '更新する' })).toBeInTheDocument()
  })

  it('名称が必須フィールドである', () => {
    render(<ShopForm genres={mockGenres} mode="create" />)
    expect(screen.getByLabelText(/名称/)).toBeRequired()
  })

  it('新規作成モードでcreateShopを呼ぶ', async () => {
    render(<ShopForm genres={mockGenres} mode="create" />)
    fireEvent.change(screen.getByLabelText(/名称/), { target: { value: 'テスト盆栽園' } })
    fireEvent.change(screen.getByLabelText(/住所/), { target: { value: '東京都渋谷区' } })

    fireEvent.click(screen.getByRole('button', { name: '登録する' }))

    // 位置情報未取得の確認ダイアログが表示される
    await waitFor(() => {
      expect(screen.getByText(/位置情報が取得されていません/)).toBeInTheDocument()
    })

    // そのまま登録をクリック
    fireEvent.click(screen.getByText('このまま登録'))

    await waitFor(() => {
      expect(mockCreateShop).toHaveBeenCalled()
    })
  })

  it('編集モードでupdateShopを呼ぶ', async () => {
    render(<ShopForm genres={mockGenres} mode="edit" initialData={mockInitialData} />)
    fireEvent.click(screen.getByRole('button', { name: '更新する' }))

    await waitFor(() => {
      expect(mockUpdateShop).toHaveBeenCalled()
    })
  })

  it('削除ボタンは編集モードのみ表示', () => {
    render(<ShopForm genres={mockGenres} mode="edit" initialData={mockInitialData} />)
    expect(screen.getByRole('button', { name: 'この盆栽園を削除' })).toBeInTheDocument()
  })

  it('削除ボタンは新規作成モードで非表示', () => {
    render(<ShopForm genres={mockGenres} mode="create" />)
    expect(screen.queryByRole('button', { name: 'この盆栽園を削除' })).not.toBeInTheDocument()
  })

  it('削除ボタンで確認ダイアログを表示する', async () => {
    render(<ShopForm genres={mockGenres} mode="edit" initialData={mockInitialData} />)
    fireEvent.click(screen.getByRole('button', { name: 'この盆栽園を削除' }))

    await waitFor(() => {
      expect(screen.getByText(/削除しますか/)).toBeInTheDocument()
    })
  })

  it('削除確認でdeleteShopを呼ぶ', async () => {
    render(<ShopForm genres={mockGenres} mode="edit" initialData={mockInitialData} />)
    fireEvent.click(screen.getByRole('button', { name: 'この盆栽園を削除' }))

    await waitFor(() => {
      expect(screen.getByText('削除する')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText('削除する'))

    await waitFor(() => {
      expect(mockDeleteShop).toHaveBeenCalledWith('shop-1')
    })
  })

  it('エラー時にエラーメッセージを表示する', async () => {
    mockCreateShop.mockResolvedValue({ error: '登録に失敗しました' })
    render(<ShopForm genres={mockGenres} mode="create" />)
    fireEvent.change(screen.getByLabelText(/名称/), { target: { value: 'テスト' } })
    fireEvent.change(screen.getByLabelText(/住所/), { target: { value: '東京都' } })
    fireEvent.click(screen.getByRole('button', { name: '登録する' }))

    // 位置情報確認をスキップ
    await waitFor(() => {
      expect(screen.getByText('このまま登録')).toBeInTheDocument()
    })
    fireEvent.click(screen.getByText('このまま登録'))

    await waitFor(() => {
      expect(screen.getByText('登録に失敗しました')).toBeInTheDocument()
    })
  })

  it('成功時にリダイレクトする', async () => {
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
      expect(mockPush).toHaveBeenCalledWith('/shops/new-id')
    })
  })

  it('ジャンルセレクターを表示する', () => {
    render(<ShopForm genres={mockGenres} mode="create" />)
    expect(screen.getByText('取り扱いジャンル')).toBeInTheDocument()
    expect(screen.getByText('黒松')).toBeInTheDocument()
    expect(screen.getByText('五葉松')).toBeInTheDocument()
    expect(screen.getByText('もみじ')).toBeInTheDocument()
  })

  it('住所候補が表示される', async () => {
    mockSearchAddressSuggestions.mockResolvedValue({
      suggestions: [
        { latitude: 35.6, longitude: 139.7, displayName: '東京都渋谷区', formattedAddress: '東京都渋谷区' },
      ],
    })
    render(<ShopForm genres={mockGenres} mode="create" />)
    fireEvent.change(screen.getByLabelText(/住所/), { target: { value: '東京都渋谷' } })

    await waitFor(() => {
      expect(screen.getByText('この位置を使用')).toBeInTheDocument()
    })
  })

  it('営業時間入力がレンダリングされる', () => {
    render(<ShopForm genres={mockGenres} mode="create" />)
    expect(screen.getByTestId('business-hours-input')).toBeInTheDocument()
  })

  it('編集モードで初期データが設定される', () => {
    render(<ShopForm genres={mockGenres} mode="edit" initialData={mockInitialData} />)
    expect(screen.getByDisplayValue('テスト盆栽園')).toBeInTheDocument()
    expect(screen.getByDisplayValue('東京都渋谷区')).toBeInTheDocument()
    expect(screen.getByDisplayValue('03-1234-5678')).toBeInTheDocument()
    expect(screen.getByDisplayValue('https://example.com')).toBeInTheDocument()
  })

  it('キャンセルボタンで戻る', async () => {
    const user = userEvent.setup()
    render(<ShopForm genres={mockGenres} mode="create" />)
    await user.click(screen.getByRole('button', { name: 'キャンセル' }))
    expect(mockBack).toHaveBeenCalled()
  })

  it('位置取得ボタンを表示する', () => {
    render(<ShopForm genres={mockGenres} mode="create" />)
    expect(screen.getByRole('button', { name: '位置取得' })).toBeInTheDocument()
  })

  it('定休日フィールドを表示する', () => {
    render(<ShopForm genres={mockGenres} mode="create" />)
    expect(screen.getByLabelText(/定休日/)).toBeInTheDocument()
  })

  it('ジャンルをトグルできる', () => {
    render(<ShopForm genres={mockGenres} mode="create" />)
    const kuromBtn = screen.getByRole('button', { name: '黒松' })
    fireEvent.click(kuromBtn)
    expect(kuromBtn).toHaveClass('bg-primary')

    // Toggle off
    fireEvent.click(kuromBtn)
    expect(kuromBtn).not.toHaveClass('bg-primary')
  })

  it('住所候補から位置情報のみ使用できる', async () => {
    mockSearchAddressSuggestions.mockResolvedValue({
      suggestions: [
        { latitude: 35.6, longitude: 139.7, displayName: '東京都渋谷区', formattedAddress: '東京都渋谷区渋谷1-1' },
      ],
    })
    render(<ShopForm genres={mockGenres} mode="create" />)
    fireEvent.change(screen.getByLabelText(/住所/), { target: { value: '東京都渋谷' } })

    await waitFor(() => {
      expect(screen.getByText('この位置を使用')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText('この位置を使用'))

    // Address should stay as typed
    expect(screen.getByLabelText(/住所/)).toHaveValue('東京都渋谷')
    // Location info should show
    await waitFor(() => {
      expect(screen.getByText(/位置情報を取得しました/)).toBeInTheDocument()
    })
  })

  it('住所候補から住所を置換できる', async () => {
    mockSearchAddressSuggestions.mockResolvedValue({
      suggestions: [
        { latitude: 35.6, longitude: 139.7, displayName: '東京都渋谷区', formattedAddress: '東京都渋谷区渋谷1-1' },
      ],
    })
    render(<ShopForm genres={mockGenres} mode="create" />)
    fireEvent.change(screen.getByLabelText(/住所/), { target: { value: '東京都渋谷' } })

    await waitFor(() => {
      expect(screen.getByText('住所も置換')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText('住所も置換'))

    expect(screen.getByLabelText(/住所/)).toHaveValue('東京都渋谷区渋谷1-1')
  })

  it('位置取得ボタンは住所が空の場合無効化される', () => {
    render(<ShopForm genres={mockGenres} mode="create" />)
    expect(screen.getByRole('button', { name: '位置取得' })).toBeDisabled()
  })

  it('位置取得ボタンで候補が見つからない場合エラーを表示する', async () => {
    mockSearchAddressSuggestions.mockResolvedValue({ suggestions: [] })
    render(<ShopForm genres={mockGenres} mode="create" />)
    fireEvent.change(screen.getByLabelText(/住所/), { target: { value: 'xxxxxx' } })

    await waitFor(() => {
      // Wait for the auto-search to finish
    })

    fireEvent.click(screen.getByRole('button', { name: '位置取得' }))

    await waitFor(() => {
      expect(screen.getByText(/住所が見つかりませんでした/)).toBeInTheDocument()
    })
  })

  it('位置取得ボタンで1件だけの候補がある場合は自動取得する', async () => {
    mockSearchAddressSuggestions.mockResolvedValue({
      suggestions: [
        { latitude: 35.6, longitude: 139.7, displayName: '東京都', formattedAddress: '東京都渋谷区' },
      ],
    })
    render(<ShopForm genres={mockGenres} mode="create" />)
    fireEvent.change(screen.getByLabelText(/住所/), { target: { value: 'x' } }) // less than 2 chars so no auto search

    // Clear auto-suggestions first
    await waitFor(() => {})

    mockSearchAddressSuggestions.mockResolvedValue({
      suggestions: [
        { latitude: 35.6, longitude: 139.7, displayName: '東京都', formattedAddress: '東京都渋谷区' },
      ],
    })
    fireEvent.change(screen.getByLabelText(/住所/), { target: { value: 'x' } })
    fireEvent.click(screen.getByRole('button', { name: '位置取得' }))

    await waitFor(() => {
      expect(screen.getByText(/位置情報を取得しました/)).toBeInTheDocument()
    })
  })

  it('位置取得ボタンで複数候補がある場合はリストを表示する', async () => {
    render(<ShopForm genres={mockGenres} mode="create" />)
    fireEvent.change(screen.getByLabelText(/住所/), { target: { value: 'x' } })

    mockSearchAddressSuggestions.mockResolvedValue({
      suggestions: [
        { latitude: 35.6, longitude: 139.7, displayName: '候補1', formattedAddress: '住所1' },
        { latitude: 35.7, longitude: 139.8, displayName: '候補2', formattedAddress: '住所2' },
      ],
    })
    fireEvent.click(screen.getByRole('button', { name: '位置取得' }))

    await waitFor(() => {
      expect(screen.getByText('住所1')).toBeInTheDocument()
      expect(screen.getByText('住所2')).toBeInTheDocument()
    })
  })

  it('確認ダイアログでキャンセルするとフォームに戻る', async () => {
    render(<ShopForm genres={mockGenres} mode="create" />)
    fireEvent.change(screen.getByLabelText(/名称/), { target: { value: 'テスト' } })
    fireEvent.change(screen.getByLabelText(/住所/), { target: { value: '東京都' } })
    fireEvent.click(screen.getByRole('button', { name: '登録する' }))

    await waitFor(() => {
      expect(screen.getByText('戻って位置取得')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText('戻って位置取得'))

    await waitFor(() => {
      expect(screen.queryByText('戻って位置取得')).not.toBeInTheDocument()
    })
  })

  it('削除エラー時にエラーメッセージを表示する', async () => {
    mockDeleteShop.mockResolvedValue({ error: '削除に失敗しました' })
    render(<ShopForm genres={mockGenres} mode="edit" initialData={mockInitialData} />)
    fireEvent.click(screen.getByRole('button', { name: 'この盆栽園を削除' }))

    await waitFor(() => {
      expect(screen.getByText('削除する')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText('削除する'))

    await waitFor(() => {
      expect(screen.getByText('削除に失敗しました')).toBeInTheDocument()
    })
  })

  it('削除成功後に一覧ページへ遷移する', async () => {
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

  it('削除確認ダイアログでキャンセルすると閉じる', async () => {
    render(<ShopForm genres={mockGenres} mode="edit" initialData={mockInitialData} />)
    fireEvent.click(screen.getByRole('button', { name: 'この盆栽園を削除' }))

    await waitFor(() => {
      expect(screen.getByText('削除する')).toBeInTheDocument()
    })

    // Click the キャンセル button inside the delete dialog
    const cancelButtons = screen.getAllByText('キャンセル')
    fireEvent.click(cancelButtons[cancelButtons.length - 1])

    await waitFor(() => {
      expect(screen.queryByText(/削除しますか/)).not.toBeInTheDocument()
    })
  })

  it('位置情報がある場合に直接送信する（確認ダイアログなし）', async () => {
    render(<ShopForm genres={mockGenres} mode="edit" initialData={mockInitialData} />)
    // initialData has latitude/longitude, so no confirm dialog
    fireEvent.click(screen.getByRole('button', { name: '更新する' }))

    await waitFor(() => {
      expect(mockUpdateShop).toHaveBeenCalled()
    })
    // No confirm dialog should have appeared
    expect(screen.queryByText('このまま登録')).not.toBeInTheDocument()
  })

  it('更新成功後に詳細ページへ遷移する', async () => {
    render(<ShopForm genres={mockGenres} mode="edit" initialData={mockInitialData} />)
    fireEvent.click(screen.getByRole('button', { name: '更新する' }))

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/shops/shop-1')
    })
  })

  it('重複登録エラー時にexistingIdメッセージを表示する', async () => {
    mockCreateShop.mockResolvedValue({ success: false, error: '重複登録です', existingId: 'existing-shop-1' })
    render(<ShopForm genres={mockGenres} mode="create" />)
    fireEvent.change(screen.getByLabelText(/名称/), { target: { value: 'テスト' } })
    fireEvent.change(screen.getByLabelText(/住所/), { target: { value: '東京都' } })
    fireEvent.click(screen.getByRole('button', { name: '登録する' }))

    await waitFor(() => {
      expect(screen.getByText('このまま登録')).toBeInTheDocument()
    })
    fireEvent.click(screen.getByText('このまま登録'))

    await waitFor(() => {
      expect(screen.getByText(/既存の盆栽園を確認しますか/)).toBeInTheDocument()
    })
  })

  it('住所入力2文字未満では候補を表示しない', async () => {
    render(<ShopForm genres={mockGenres} mode="create" />)
    fireEvent.change(screen.getByLabelText(/住所/), { target: { value: '東' } })

    await waitFor(() => {
      expect(mockSearchAddressSuggestions).not.toHaveBeenCalled()
    })
  })

  it('編集モードでジャンルが初期選択される', () => {
    render(<ShopForm genres={mockGenres} mode="edit" initialData={mockInitialData} />)
    const kuromBtn = screen.getByRole('button', { name: '黒松' })
    expect(kuromBtn).toHaveClass('bg-primary')
  })

  it('送信中は登録ボタンのテキストが変わる', async () => {
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
})
