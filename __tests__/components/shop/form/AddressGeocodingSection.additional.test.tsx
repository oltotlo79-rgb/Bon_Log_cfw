import { vi } from 'vitest'
/**
 * AddressGeocodingSection の追加カバレッジテスト
 *
 * 対象:
 * - 「住所も置換」ボタン (keepOriginalAddress=false) を押した際の onAddressChange 呼び出しと
 *   onLocationSet に渡るアドレス値の分岐 (keepOriginalAddress ? address : formattedAddress)
 * - suggestions が存在する状態で input に再フォーカスした際の候補再表示 (onFocus ガード)
 */

import { render, screen, waitFor, fireEvent } from '@testing-library/react'

const mockSearchAddressSuggestions = vi.fn()
vi.mock('@/lib/actions/shop', () => ({
  searchAddressSuggestions: (...args: unknown[]) => mockSearchAddressSuggestions(...args),
}))

vi.mock('@/lib/constants/limits', () => ({
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
    latitude: 35.7,
    longitude: 139.7,
    displayName: '東京都豊島区',
    formattedAddress: '東京都豊島区',
  },
]

describe('AddressGeocodingSection - 追加カバレッジテスト', () => {
  const mockOnAddressChange = vi.fn()
  const mockOnLocationSet = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('「住所も置換」を押すと候補の formattedAddress で onAddressChange と onLocationSet が呼ばれる', async () => {
    mockSearchAddressSuggestions.mockResolvedValue({ suggestions: mockSuggestions })
    render(
      <AddressGeocodingSection
        address="東京"
        latitude={null}
        longitude={null}
        onAddressChange={mockOnAddressChange}
        onLocationSet={mockOnLocationSet}
      />
    )

    const input = screen.getByRole('textbox')
    fireEvent.change(input, { target: { value: '東京都' } })

    await waitFor(() => {
      expect(screen.getAllByText('住所も置換').length).toBeGreaterThan(0)
    })

    fireEvent.click(screen.getAllByText('住所も置換')[0]!)

    expect(mockOnAddressChange).toHaveBeenCalledWith(mockSuggestions[0]!.formattedAddress)
    expect(mockOnLocationSet).toHaveBeenCalledWith(
      mockSuggestions[0]!.latitude,
      mockSuggestions[0]!.longitude,
      mockSuggestions[0]!.formattedAddress,
    )
  })

  it('「この位置を使用」(keepOriginalAddress=true) では入力済みの address がそのまま渡る', async () => {
    mockSearchAddressSuggestions.mockResolvedValue({ suggestions: mockSuggestions })
    render(
      <AddressGeocodingSection
        address="元の住所そのまま"
        latitude={null}
        longitude={null}
        onAddressChange={mockOnAddressChange}
        onLocationSet={mockOnLocationSet}
      />
    )

    const input = screen.getByRole('textbox')
    fireEvent.change(input, { target: { value: '東京都' } })

    await waitFor(() => {
      expect(screen.getAllByText('この位置を使用').length).toBeGreaterThan(0)
    })
    // 入力中の onAddressChange 呼び出し履歴をクリアしてから選択操作のみを検証する
    mockOnAddressChange.mockClear()

    fireEvent.click(screen.getAllByText('この位置を使用')[0]!)

    // keepOriginalAddress=true のため onAddressChange は呼ばれない (元の住所を維持)
    expect(mockOnAddressChange).not.toHaveBeenCalled()
    expect(mockOnLocationSet).toHaveBeenCalledWith(
      mockSuggestions[0]!.latitude,
      mockSuggestions[0]!.longitude,
      '元の住所そのまま',
    )
  })

  it('候補がある状態で入力欄からフォーカスが外れて再度フォーカスすると候補が再表示される', async () => {
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
    })

    fireEvent.blur(input)
    await waitFor(() => {
      expect(screen.queryByText('東京都新宿区')).not.toBeInTheDocument()
    }, { timeout: 500 })

    // suggestions 配列自体はまだ保持されているため、再フォーカスで再表示される
    fireEvent.focus(input)

    expect(screen.getByText('東京都新宿区')).toBeInTheDocument()
  })

  it('候補が空の状態でフォーカスしても候補は表示されない', () => {
    render(
      <AddressGeocodingSection
        address=""
        latitude={null}
        longitude={null}
        onAddressChange={mockOnAddressChange}
        onLocationSet={mockOnLocationSet}
      />
    )

    fireEvent.focus(screen.getByRole('textbox'))

    expect(screen.queryByText('近い場所を選択してください')).not.toBeInTheDocument()
  })
})
