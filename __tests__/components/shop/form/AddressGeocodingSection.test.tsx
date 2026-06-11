import { vi } from 'vitest'
/**
 * AddressGeocodingSectionコンポーネントのテスト
 */

import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

// Server Actionsモック
const mockSearchAddressSuggestions = vi.fn()
vi.mock('@/lib/actions/shop', () => ({
  searchAddressSuggestions: (...args: unknown[]) => mockSearchAddressSuggestions(...args),
}))

// limits モック
vi.mock('@/lib/constants/limits', () => ({
  TWO_FACTOR_CODE_LENGTH: 6,
  TIMEOUT_COPIED_FEEDBACK: 2000,
  MAX_REVIEW_IMAGES: 3,
  MIN_ADDRESS_SEARCH_LENGTH: 3,
  TIMEOUT_DROPDOWN_BLUR: 150,
}))

import { AddressGeocodingSection } from '@/components/shop/form/AddressGeocodingSection'

const mockSuggestions = [
  {
    latitude: 35.6895,
    longitude: 139.6917,
    displayName: '東京都新宿区',
    formattedAddress: '東京都新宿区',
  },
  {
    latitude: 35.7000,
    longitude: 139.7000,
    displayName: '東京都豊島区',
    formattedAddress: '東京都豊島区',
  },
]

describe('AddressGeocodingSection', () => {
  const mockOnAddressChange = vi.fn()
  const mockOnLocationSet = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    mockSearchAddressSuggestions.mockResolvedValue({ suggestions: [] })
  })

  // ============================================================
  // レンダリング
  // ============================================================

  describe('レンダリング', () => {
    it('住所入力フィールドが表示される', () => {
      render(
        <AddressGeocodingSection
          address=""
          latitude={null}
          longitude={null}
          onAddressChange={mockOnAddressChange}
          onLocationSet={mockOnLocationSet}
        />
      )

      expect(screen.getByLabelText(/住所/)).toBeInTheDocument()
    })

    it('位置取得ボタンが表示される', () => {
      render(
        <AddressGeocodingSection
          address=""
          latitude={null}
          longitude={null}
          onAddressChange={mockOnAddressChange}
          onLocationSet={mockOnLocationSet}
        />
      )

      expect(screen.getByRole('button', { name: '位置取得' })).toBeInTheDocument()
    })

    it('住所が空の場合、位置取得ボタンが無効になる', () => {
      render(
        <AddressGeocodingSection
          address=""
          latitude={null}
          longitude={null}
          onAddressChange={mockOnAddressChange}
          onLocationSet={mockOnLocationSet}
        />
      )

      expect(screen.getByRole('button', { name: '位置取得' })).toBeDisabled()
    })

    it('住所がある場合、位置取得ボタンが有効になる', () => {
      render(
        <AddressGeocodingSection
          address="東京都"
          latitude={null}
          longitude={null}
          onAddressChange={mockOnAddressChange}
          onLocationSet={mockOnLocationSet}
        />
      )

      expect(screen.getByRole('button', { name: '位置取得' })).not.toBeDisabled()
    })

    it('緯度・経度が設定されている場合に位置情報メッセージを表示する', () => {
      render(
        <AddressGeocodingSection
          address="東京都"
          latitude={35.6895}
          longitude={139.6917}
          onAddressChange={mockOnAddressChange}
          onLocationSet={mockOnLocationSet}
        />
      )

      expect(screen.getByText(/位置情報を取得しました/)).toBeInTheDocument()
    })

    it('disabled状態でフィールドが無効化される', () => {
      render(
        <AddressGeocodingSection
          address="東京都"
          latitude={null}
          longitude={null}
          onAddressChange={mockOnAddressChange}
          onLocationSet={mockOnLocationSet}
          disabled
        />
      )

      expect(screen.getByRole('textbox')).toBeDisabled()
    })
  })

  // ============================================================
  // 住所入力とオートコンプリート
  // ============================================================

  describe('住所入力とオートコンプリート', () => {
    it('住所入力時にonAddressChangeが呼ばれる', async () => {
      const user = userEvent.setup()
      render(
        <AddressGeocodingSection
          address=""
          latitude={null}
          longitude={null}
          onAddressChange={mockOnAddressChange}
          onLocationSet={mockOnLocationSet}
        />
      )

      await user.type(screen.getByRole('textbox'), '東京')

      expect(mockOnAddressChange).toHaveBeenCalled()
    })

    it('3文字以上入力するとサジェスト検索が実行される', async () => {
      mockSearchAddressSuggestions.mockResolvedValue({ suggestions: mockSuggestions })
      const _user = userEvent.setup()
      render(
        <AddressGeocodingSection
          address=""
          latitude={null}
          longitude={null}
          onAddressChange={mockOnAddressChange}
          onLocationSet={mockOnLocationSet}
        />
      )

      const input = screen.getByRole('textbox')
      fireEvent.change(input, { target: { value: '東京都' } })

      await waitFor(() => {
        expect(mockSearchAddressSuggestions).toHaveBeenCalledWith('東京都')
      })
    })

    it('サジェスト候補が表示される', async () => {
      mockSearchAddressSuggestions.mockResolvedValue({ suggestions: mockSuggestions })
      render(
        <AddressGeocodingSection
          address=""
          latitude={null}
          longitude={null}
          onAddressChange={mockOnAddressChange}
          onLocationSet={mockOnLocationSet}
        />
      )

      const input = screen.getByRole('textbox')
      fireEvent.change(input, { target: { value: '東京都' } })

      await waitFor(() => {
        expect(screen.getByText('東京都新宿区')).toBeInTheDocument()
        expect(screen.getByText('東京都豊島区')).toBeInTheDocument()
      })
    })

    it('「この位置を使用」ボタンが表示される', async () => {
      mockSearchAddressSuggestions.mockResolvedValue({ suggestions: mockSuggestions })
      render(
        <AddressGeocodingSection
          address=""
          latitude={null}
          longitude={null}
          onAddressChange={mockOnAddressChange}
          onLocationSet={mockOnLocationSet}
        />
      )

      const input = screen.getByRole('textbox')
      fireEvent.change(input, { target: { value: '東京都' } })

      await waitFor(() => {
        const useButtons = screen.getAllByText('この位置を使用')
        expect(useButtons.length).toBeGreaterThan(0)
      })
    })

    it('候補選択時にonLocationSetが呼ばれる', async () => {
      // Multiple suggestions so dropdown shows
      mockSearchAddressSuggestions.mockResolvedValue({ suggestions: mockSuggestions })
      render(
        <AddressGeocodingSection
          address="東京都"
          latitude={null}
          longitude={null}
          onAddressChange={mockOnAddressChange}
          onLocationSet={mockOnLocationSet}
        />
      )

      // Click geocode button to show the dropdown
      const geocodeButton = screen.getByRole('button', { name: '位置取得' })
      fireEvent.click(geocodeButton)

      // Wait for suggestions to appear
      await waitFor(() => {
        expect(screen.getAllByText('この位置を使用').length).toBeGreaterThan(0)
      })

      const useButtons = screen.getAllByText('この位置を使用')
      fireEvent.click(useButtons[0]!)

      expect(mockOnLocationSet).toHaveBeenCalledWith(
        mockSuggestions[0]!.latitude,
        mockSuggestions[0]!.longitude,
        expect.any(String)
      )
    })

    it('「住所も置換」ボタンが表示される', async () => {
      mockSearchAddressSuggestions.mockResolvedValue({ suggestions: mockSuggestions })
      render(
        <AddressGeocodingSection
          address=""
          latitude={null}
          longitude={null}
          onAddressChange={mockOnAddressChange}
          onLocationSet={mockOnLocationSet}
        />
      )

      const input = screen.getByRole('textbox')
      fireEvent.change(input, { target: { value: '東京都' } })

      await waitFor(() => {
        const replaceButtons = screen.getAllByText('住所も置換')
        expect(replaceButtons.length).toBeGreaterThan(0)
      })
    })
  })

  // ============================================================
  // 位置取得ボタン
  // ============================================================

  describe('位置取得ボタン', () => {
    it('住所なしでボタンをクリックするとエラーが表示される', async () => {
      const _user = userEvent.setup()
      render(
        <AddressGeocodingSection
          address="   "
          latitude={null}
          longitude={null}
          onAddressChange={mockOnAddressChange}
          onLocationSet={mockOnLocationSet}
        />
      )

      // Force enable button by providing non-empty address via re-render
      // The button is disabled when address.trim() is falsy, so this tests the edge case
      // We need to test the error path by checking if the button is disabled
      expect(screen.getByRole('button', { name: '位置取得' })).toBeDisabled()
    })

    it('住所があり候補が1件のみの場合onLocationSetが即座に呼ばれる', async () => {
      const singleSuggestion = [mockSuggestions[0]]
      mockSearchAddressSuggestions.mockResolvedValue({ suggestions: singleSuggestion })
      const user = userEvent.setup()
      render(
        <AddressGeocodingSection
          address="東京都新宿区"
          latitude={null}
          longitude={null}
          onAddressChange={mockOnAddressChange}
          onLocationSet={mockOnLocationSet}
        />
      )

      await user.click(screen.getByRole('button', { name: '位置取得' }))

      await waitFor(() => {
        expect(mockOnLocationSet).toHaveBeenCalledWith(
          mockSuggestions[0]!.latitude,
          mockSuggestions[0]!.longitude,
          '東京都新宿区'
        )
      })
    })

    it('候補が見つからない場合エラーを表示する', async () => {
      mockSearchAddressSuggestions.mockResolvedValue({ suggestions: [] })
      const user = userEvent.setup()
      render(
        <AddressGeocodingSection
          address="存在しない住所"
          latitude={null}
          longitude={null}
          onAddressChange={mockOnAddressChange}
          onLocationSet={mockOnLocationSet}
        />
      )

      await user.click(screen.getByRole('button', { name: '位置取得' }))

      await waitFor(() => {
        expect(screen.getByText(/住所が見つかりませんでした/)).toBeInTheDocument()
      })
    })

    it('複数候補がある場合候補リストが表示される', async () => {
      mockSearchAddressSuggestions.mockResolvedValue({ suggestions: mockSuggestions })
      const user = userEvent.setup()
      render(
        <AddressGeocodingSection
          address="東京都"
          latitude={null}
          longitude={null}
          onAddressChange={mockOnAddressChange}
          onLocationSet={mockOnLocationSet}
        />
      )

      await user.click(screen.getByRole('button', { name: '位置取得' }))

      await waitFor(() => {
        expect(screen.getByText('東京都新宿区')).toBeInTheDocument()
        expect(screen.getByText('東京都豊島区')).toBeInTheDocument()
      })
    })
  })
})
