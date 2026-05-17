import { vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { ShopChangeRequestForm } from '@/components/shop/ShopChangeRequestForm'

// next/navigation モック
const mockRefresh = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    refresh: mockRefresh,
  }),
}))

// Server Action モック
const mockCreateShopChangeRequest = vi.fn()
vi.mock('@/lib/actions/shop', () => ({
  createShopChangeRequest: (...args: unknown[]) => mockCreateShopChangeRequest(...args),
}))

describe('ShopChangeRequestForm', () => {
  const mockShop = {
    id: 'shop-1',
    name: '〇〇盆栽園',
    address: '東京都渋谷区1-2-3',
    phone: '03-1234-5678',
    website: 'https://example.com',
    businessHours: '9:00〜17:00',
    closedDays: '水曜日',
  }

  const mockOnClose = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    mockCreateShopChangeRequest.mockResolvedValue({ success: true })
  })

  it('フォームを表示する', () => {
    render(<ShopChangeRequestForm shop={mockShop} onClose={mockOnClose} />)

    expect(screen.getByText('情報の変更をリクエスト')).toBeInTheDocument()
  })

  it('すべてのフィールドチェックボックスを表示する', () => {
    render(<ShopChangeRequestForm shop={mockShop} onClose={mockOnClose} />)

    expect(screen.getByText('名称')).toBeInTheDocument()
    expect(screen.getByText('住所')).toBeInTheDocument()
    expect(screen.getByText('電話番号')).toBeInTheDocument()
    expect(screen.getByText('ウェブサイト')).toBeInTheDocument()
    expect(screen.getByText('営業時間')).toBeInTheDocument()
    expect(screen.getByText('定休日')).toBeInTheDocument()
  })

  it('閉じるボタンをクリックするとonCloseを呼び出す', () => {
    render(<ShopChangeRequestForm shop={mockShop} onClose={mockOnClose} />)

    const closeButtons = screen.getAllByRole('button')
    // X印のボタンを探す
    const closeButton = closeButtons.find(btn => btn.querySelector('svg'))
    if (closeButton) {
      fireEvent.click(closeButton)
    }

    expect(mockOnClose).toHaveBeenCalled()
  })

  it('キャンセルボタンをクリックするとonCloseを呼び出す', () => {
    render(<ShopChangeRequestForm shop={mockShop} onClose={mockOnClose} />)

    fireEvent.click(screen.getByText('キャンセル'))

    expect(mockOnClose).toHaveBeenCalled()
  })

  it('チェックされたフィールドのみ入力欄を表示する', () => {
    render(<ShopChangeRequestForm shop={mockShop} onClose={mockOnClose} />)

    // 初期状態では入力欄は表示されない
    expect(screen.queryByPlaceholderText(/新しい名称/)).not.toBeInTheDocument()

    // 名称をチェック
    const nameCheckbox = screen.getByRole('checkbox', { name: /名称/ })
    fireEvent.click(nameCheckbox)

    // 入力欄が表示される
    expect(screen.getByPlaceholderText(/新しい名称/)).toBeInTheDocument()
  })

  it('チェック時に現在の値を表示する', () => {
    render(<ShopChangeRequestForm shop={mockShop} onClose={mockOnClose} />)

    const nameCheckbox = screen.getByRole('checkbox', { name: /名称/ })
    fireEvent.click(nameCheckbox)

    expect(screen.getByText(/現在: 〇〇盆栽園/)).toBeInTheDocument()
  })

  it('何もチェックされていない場合は送信ボタンを無効化する', () => {
    render(<ShopChangeRequestForm shop={mockShop} onClose={mockOnClose} />)

    expect(screen.getByText('リクエストを送信')).toBeDisabled()
  })

  it('チェックされたら送信ボタンを有効化する', () => {
    render(<ShopChangeRequestForm shop={mockShop} onClose={mockOnClose} />)

    const nameCheckbox = screen.getByRole('checkbox', { name: /名称/ })
    fireEvent.click(nameCheckbox)

    expect(screen.getByText('リクエストを送信')).not.toBeDisabled()
  })

  it('変更がない場合はエラーを表示する', async () => {
    render(<ShopChangeRequestForm shop={mockShop} onClose={mockOnClose} />)

    // 名称をチェック（値は変更しない）
    const nameCheckbox = screen.getByRole('checkbox', { name: /名称/ })
    fireEvent.click(nameCheckbox)

    // 送信
    fireEvent.click(screen.getByText('リクエストを送信'))

    await waitFor(() => {
      expect(screen.getByText(/変更内容を選択し、現在の値と異なる内容を入力してください/)).toBeInTheDocument()
    })
  })

  it('変更がある場合はリクエストを送信する', async () => {
    render(<ShopChangeRequestForm shop={mockShop} onClose={mockOnClose} />)

    // 名称をチェックして変更
    const nameCheckbox = screen.getByRole('checkbox', { name: /名称/ })
    fireEvent.click(nameCheckbox)

    const nameInput = screen.getByPlaceholderText(/新しい名称/)
    fireEvent.change(nameInput, { target: { value: '新しい盆栽園名' } })

    // 送信
    fireEvent.click(screen.getByText('リクエストを送信'))

    await waitFor(() => {
      expect(mockCreateShopChangeRequest).toHaveBeenCalledWith(
        'shop-1',
        { name: '新しい盆栽園名' },
        ''
      )
    })
  })

  it('変更理由を入力できる', async () => {
    render(<ShopChangeRequestForm shop={mockShop} onClose={mockOnClose} />)

    // 名称をチェックして変更
    const nameCheckbox = screen.getByRole('checkbox', { name: /名称/ })
    fireEvent.click(nameCheckbox)

    const nameInput = screen.getByPlaceholderText(/新しい名称/)
    fireEvent.change(nameInput, { target: { value: '新しい盆栽園名' } })

    // 変更理由を入力
    const reasonInput = screen.getByPlaceholderText(/変更をリクエストする理由/)
    fireEvent.change(reasonInput, { target: { value: '名前が変更されました' } })

    // 送信
    fireEvent.click(screen.getByText('リクエストを送信'))

    await waitFor(() => {
      expect(mockCreateShopChangeRequest).toHaveBeenCalledWith(
        'shop-1',
        { name: '新しい盆栽園名' },
        '名前が変更されました'
      )
    })
  })

  it('送信成功時に成功メッセージを表示する', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })

    render(<ShopChangeRequestForm shop={mockShop} onClose={mockOnClose} />)

    // 名称をチェックして変更
    const nameCheckbox = screen.getByRole('checkbox', { name: /名称/ })
    fireEvent.click(nameCheckbox)

    const nameInput = screen.getByPlaceholderText(/新しい名称/)
    fireEvent.change(nameInput, { target: { value: '新しい盆栽園名' } })

    // 送信
    fireEvent.click(screen.getByText('リクエストを送信'))

    await waitFor(() => {
      expect(screen.getByText('変更リクエストを送信しました')).toBeInTheDocument()
    })

    vi.useRealTimers()
  })

  it('送信エラー時にエラーメッセージを表示する', async () => {
    mockCreateShopChangeRequest.mockResolvedValue({ error: '送信に失敗しました' })

    render(<ShopChangeRequestForm shop={mockShop} onClose={mockOnClose} />)

    // 名称をチェックして変更
    const nameCheckbox = screen.getByRole('checkbox', { name: /名称/ })
    fireEvent.click(nameCheckbox)

    const nameInput = screen.getByPlaceholderText(/新しい名称/)
    fireEvent.change(nameInput, { target: { value: '新しい盆栽園名' } })

    // 送信
    fireEvent.click(screen.getByText('リクエストを送信'))

    await waitFor(() => {
      expect(screen.getByText('送信に失敗しました')).toBeInTheDocument()
    })
  })

  it('送信中はボタンを無効化する', async () => {
    mockCreateShopChangeRequest.mockImplementation(() => new Promise(() => {}))

    render(<ShopChangeRequestForm shop={mockShop} onClose={mockOnClose} />)

    // 名称をチェックして変更
    const nameCheckbox = screen.getByRole('checkbox', { name: /名称/ })
    fireEvent.click(nameCheckbox)

    const nameInput = screen.getByPlaceholderText(/新しい名称/)
    fireEvent.change(nameInput, { target: { value: '新しい盆栽園名' } })

    // 送信
    fireEvent.click(screen.getByText('リクエストを送信'))

    await waitFor(() => {
      expect(screen.getByText('送信中...')).toBeInTheDocument()
      expect(screen.getByText('送信中...')).toBeDisabled()
    })
  })

  it('営業時間と定休日はtextareaを表示する', () => {
    render(<ShopChangeRequestForm shop={mockShop} onClose={mockOnClose} />)

    // 営業時間をチェック
    const businessHoursCheckbox = screen.getByRole('checkbox', { name: /営業時間/ })
    fireEvent.click(businessHoursCheckbox)

    // textareaが表示される（rows属性でtextareaと判別）
    const textarea = screen.getByPlaceholderText(/新しい営業時間/)
    expect(textarea.tagName).toBe('TEXTAREA')
  })

  it('nullフィールドの現在値は「未設定」と表示する', () => {
    const shopWithNulls = {
      ...mockShop,
      phone: null,
      website: null,
    }

    render(<ShopChangeRequestForm shop={shopWithNulls} onClose={mockOnClose} />)

    const phoneCheckbox = screen.getByRole('checkbox', { name: /電話番号/ })
    fireEvent.click(phoneCheckbox)

    expect(screen.getByText(/現在: （未設定）/)).toBeInTheDocument()
  })
})
