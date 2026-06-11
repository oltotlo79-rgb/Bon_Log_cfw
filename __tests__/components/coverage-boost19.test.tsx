import { vi } from 'vitest'
/**
 * Coverage Boost 19 - SearchBar, AdvancedSearchFilters, BonsaiRecordForm, ShopForm, ShopChangeRequestForm
 *
 * Targets uncovered branches/functions in:
 * - SearchBar.tsx: no q param, keyboard shortcut on INPUT, empty query handleSearch, handleClear without onSearch, showDropdown false
 * - AdvancedSearchFilters.tsx: applyFilters, resetFilters, minLikes=0/NaN, hasFilters true
 * - BonsaiRecordForm.tsx: file size error, empty submission, upload falsy url, server action error, catch block, ratio=0
 * - ShopForm.tsx: handleGeocode, handleDelete, handleConfirmSubmit, handleCancelSubmit, executeSubmit error branches
 * - ShopChangeRequestForm.tsx: handleSubmit with no changes, handleSubmit server error, success flow
 */

import React from 'react'
import { render, screen, fireEvent, waitFor, act } from '../utils/test-utils'

// ============================================================
// Common mocks
// ============================================================

const mockPush = vi.fn()
const mockRefresh = vi.fn()
const mockReplace = vi.fn()
const mockBack = vi.fn()

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    refresh: mockRefresh,
    replace: mockReplace,
    back: mockBack,
  }),
  useSearchParams: () => {
    const params = new URLSearchParams(mockSearchParamsString)
    return params
  },
}))

let mockSearchParamsString = ''

vi.mock('next/cache', () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn(), unstable_cache: vi.fn((fn) => fn), cache: vi.fn((fn) => fn) }))

vi.mock('next-auth/react', () => ({
  SessionProvider: ({ children }: { children: React.ReactNode }) => children,
  useSession: () => ({
    data: { user: { id: 'test-user-id' } },
    status: 'authenticated',
  }),
}))

vi.mock('next/image', () => ({
  __esModule: true,
  // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
  default: (props: any) => { const { fill: _fill, priority: _priority, ...rest } = props; return <img {...rest} /> },
}))

// ============================================================
// BonsaiRecordForm mocks
// ============================================================

const mockAddBonsaiRecord = vi.fn()
vi.mock('@/lib/actions/bonsai', () => ({
  addBonsaiRecord: (...args: any[]) => mockAddBonsaiRecord(...args),
}))

const mockPrepareFileForUpload = vi.fn()
vi.mock('@/lib/client-image-compression', () => ({
  prepareFileForUpload: (...args: any[]) => mockPrepareFileForUpload(...args),
  formatFileSize: (size: number) => `${(size / 1024).toFixed(1)}KB`,
  MAX_IMAGE_SIZE: 10 * 1024 * 1024,
}))

// ============================================================
// ShopForm mocks
// ============================================================

const mockCreateShop = vi.fn()
const mockUpdateShop = vi.fn()
const mockDeleteShop = vi.fn()
const mockSearchAddressSuggestions = vi.fn()

vi.mock('@/lib/actions/shop', () => ({
  createShop: (...args: any[]) => mockCreateShop(...args),
  updateShop: (...args: any[]) => mockUpdateShop(...args),
  deleteShop: (...args: any[]) => mockDeleteShop(...args),
  searchAddressSuggestions: (...args: any[]) => mockSearchAddressSuggestions(...args),
  createShopChangeRequest: (...args: any[]) => mockCreateShopChangeRequest(...args),
}))

const mockCreateShopChangeRequest = vi.fn()

vi.mock('@/components/shop/BusinessHoursInput', () => ({
  BusinessHoursInput: ({ value, onChange }: { value: string; onChange: (v: string) => void }) => (
    <input data-testid="business-hours" value={value} onChange={(e) => onChange(e.target.value)} />
  ),
}))

// ============================================================
// Imports after mocks
// ============================================================

import { SearchBar } from '@/components/search/SearchBar'
import { AdvancedSearchFilters } from '@/components/search/AdvancedSearchFilters'
import { BonsaiRecordForm } from '@/components/bonsai/BonsaiRecordForm'
import { ShopForm } from '@/components/shop/ShopForm'
import { ShopChangeRequestForm } from '@/components/shop/ShopChangeRequestForm'

// ============================================================
// Setup
// ============================================================

beforeEach(() => {
  vi.clearAllMocks()
  mockSearchParamsString = ''
  localStorage.clear()
  global.fetch = vi.fn()
  URL.createObjectURL = vi.fn().mockReturnValue('blob:test-url')
  URL.revokeObjectURL = vi.fn()
})

// ============================================================
// SearchBar Tests
// ============================================================

describe('SearchBar', () => {
  it('should not set query when searchParams has no q param', () => {
    mockSearchParamsString = ''
    render(<SearchBar />)
    const input = screen.getByRole('textbox', { name: '検索' })
    expect(input).toHaveValue('')
  })

  it('should set query when searchParams has q param', () => {
    mockSearchParamsString = 'q=test'
    render(<SearchBar />)
    const input = screen.getByRole('textbox', { name: '検索' })
    expect(input).toHaveValue('test')
  })

  it('should NOT focus search input when / pressed inside INPUT element', () => {
    render(
      <div>
        <input data-testid="other-input" />
        <SearchBar />
      </div>
    )
    const otherInput = screen.getByTestId('other-input')
    otherInput.focus()

    // Dispatch a real KeyboardEvent on the input itself
    const event = new KeyboardEvent('keydown', { key: '/', bubbles: true })
    otherInput.dispatchEvent(event)

    // The search input should not steal focus
    expect(document.activeElement).toBe(otherInput)
  })

  it('should NOT focus search when / pressed inside TEXTAREA', () => {
    render(
      <div>
        <textarea data-testid="textarea-el" />
        <SearchBar />
      </div>
    )
    const textarea = screen.getByTestId('textarea-el')
    textarea.focus()

    const event = new KeyboardEvent('keydown', { key: '/', bubbles: true })
    textarea.dispatchEvent(event)
    expect(document.activeElement).toBe(textarea)
  })

  it('should focus search input when / pressed outside any input', () => {
    render(<SearchBar />)
    const searchInput = screen.getByRole('textbox', { name: '検索' })

    fireEvent.keyDown(document, { key: '/', target: document.body })
    expect(document.activeElement).toBe(searchInput)
  })

  it('should handle search with empty query (navigates with q deleted)', () => {
    mockSearchParamsString = ''
    render(<SearchBar />)
    const input = screen.getByRole('textbox', { name: '検索' })

    // Submit with empty query
    fireEvent.keyDown(input, { key: 'Enter' })

    expect(mockPush).toHaveBeenCalledWith('/search?')
  })

  it('should handle search with whitespace-only query', () => {
    render(<SearchBar />)
    const input = screen.getByRole('textbox', { name: '検索' })
    fireEvent.change(input, { target: { value: '   ' } })
    fireEvent.keyDown(input, { key: 'Enter' })

    // whitespace q is still passed as-is since q.trim() is truthy but q itself is whitespace
    expect(mockPush).toHaveBeenCalled()
  })

  it('should call onSearch callback on clear when provided', () => {
    const onSearch = vi.fn()
    render(<SearchBar defaultValue="test" onSearch={onSearch} />)

    const clearBtn = screen.getByRole('button')
    fireEvent.click(clearBtn)

    expect(onSearch).toHaveBeenCalledWith('')
  })

  it('should navigate on clear when onSearch is NOT provided', () => {
    mockSearchParamsString = 'q=test'
    render(<SearchBar />)

    // The input should have 'test' from searchParams
    const clearBtn = screen.getByRole('button')
    fireEvent.click(clearBtn)

    expect(mockPush).toHaveBeenCalledWith(expect.stringContaining('/search?'))
  })

  it('showDropdown should be false when query is non-empty even with recent searches', () => {
    localStorage.setItem('bonsai-sns-recent-searches', JSON.stringify(['old search']))
    render(<SearchBar defaultValue="something" />)

    const input = screen.getByRole('textbox', { name: '検索' })
    fireEvent.focus(input)

    // Dropdown should not appear since query is non-empty
    expect(screen.queryByText('最近の検索')).not.toBeInTheDocument()
  })

  it('showDropdown should be false when no recent searches exist', () => {
    render(<SearchBar />)
    const input = screen.getByRole('textbox', { name: '検索' })
    fireEvent.focus(input)

    expect(screen.queryByText('最近の検索')).not.toBeInTheDocument()
  })

  it('should close dropdown on Escape key', () => {
    localStorage.setItem('bonsai-sns-recent-searches', JSON.stringify(['past search']))
    render(<SearchBar />)
    const input = screen.getByRole('textbox', { name: '検索' })

    fireEvent.focus(input)
    // Dropdown should appear (need effect to run)

    fireEvent.keyDown(input, { key: 'Escape' })
    expect(screen.queryByText('最近の検索')).not.toBeInTheDocument()
  })

  it('should close dropdown on outside click', () => {
    localStorage.setItem('bonsai-sns-recent-searches', JSON.stringify(['past search']))
    render(
      <div>
        <div data-testid="outside">Outside</div>
        <SearchBar />
      </div>
    )
    const input = screen.getByRole('textbox', { name: '検索' })
    fireEvent.focus(input)

    // Click outside
    fireEvent.mouseDown(screen.getByTestId('outside'))
    expect(screen.queryByText('最近の検索')).not.toBeInTheDocument()
  })
})

// ============================================================
// AdvancedSearchFilters Tests
// ============================================================

describe('AdvancedSearchFilters', () => {
  it('should open panel when initial filters are provided', () => {
    render(<AdvancedSearchFilters dateFrom="2024-01-01" />)
    expect(screen.getByText('開始日')).toBeInTheDocument()
  })

  it('should apply filters and navigate', () => {
    render(<AdvancedSearchFilters />)
    // Open panel
    fireEvent.click(screen.getByText('詳細フィルター'))

    // Set values - labels don't have htmlFor, use input type selectors
    const dateInputs = screen.getAllByDisplayValue('')
    const dateFromInput = dateInputs.find((el) => el.getAttribute('type') === 'date')!
    fireEvent.change(dateFromInput, { target: { value: '2024-01-01' } })

    const dateToInput = dateInputs.filter((el) => el.getAttribute('type') === 'date')[1]!
    fireEvent.change(dateToInput, { target: { value: '2024-12-31' } })

    const minLikesInput = screen.getByPlaceholderText('0')
    fireEvent.change(minLikesInput, { target: { value: '10' } })

    // Select media type
    fireEvent.click(screen.getByText('画像あり'))

    // Click apply
    fireEvent.click(screen.getByText('適用'))

    expect(mockPush).toHaveBeenCalledWith(
      expect.stringContaining('dateFrom=2024-01-01')
    )
    expect(mockPush).toHaveBeenCalledWith(
      expect.stringContaining('minLikes=10')
    )
  })

  it('should NOT add minLikes param when value is 0', () => {
    render(<AdvancedSearchFilters />)
    fireEvent.click(screen.getByText('詳細フィルター'))

    const minLikesInput = screen.getByPlaceholderText('0')
    fireEvent.change(minLikesInput, { target: { value: '0' } })

    fireEvent.click(screen.getByText('適用'))

    const pushArg = mockPush.mock.calls[0]![0]! as string
    expect(pushArg).not.toContain('minLikes')
  })

  it('should NOT add minLikes param when value is empty string (NaN)', () => {
    render(<AdvancedSearchFilters />)
    fireEvent.click(screen.getByText('詳細フィルター'))

    const minLikesInput = screen.getByPlaceholderText('0')
    fireEvent.change(minLikesInput, { target: { value: '' } })

    fireEvent.click(screen.getByText('適用'))

    const pushArg = mockPush.mock.calls[0]![0]! as string
    expect(pushArg).not.toContain('minLikes')
  })

  it('should reset filters and navigate', () => {
    render(<AdvancedSearchFilters dateFrom="2024-01-01" dateTo="2024-12-31" minLikes="5" mediaType="images" />)

    // hasFilters is true, so reset button should show
    expect(screen.getByText('リセット')).toBeInTheDocument()

    fireEvent.click(screen.getByText('リセット'))

    const pushArg = mockPush.mock.calls[0]![0]! as string
    expect(pushArg).not.toContain('dateFrom')
    expect(pushArg).not.toContain('dateTo')
    expect(pushArg).not.toContain('minLikes')
    expect(pushArg).not.toContain('mediaType')
  })

  it('should show hasFilters indicator when filters present', () => {
    render(<AdvancedSearchFilters minLikes="5" />)
    // The indicator dot (w-2 h-2 rounded-full bg-bonsai-green) should exist
    const btn = screen.getByText('詳細フィルター')
    const dot = btn.parentElement?.querySelector('.bg-bonsai-green')
    expect(dot).toBeInTheDocument()
  })

  it('should not show reset button when no filters', () => {
    render(<AdvancedSearchFilters />)
    fireEvent.click(screen.getByText('詳細フィルター'))
    expect(screen.queryByText('リセット')).not.toBeInTheDocument()
  })

  it('should delete dateFrom/dateTo/mediaType params when empty on apply', () => {
    mockSearchParamsString = 'dateFrom=2024-01-01&dateTo=2024-12-31&mediaType=images'
    render(<AdvancedSearchFilters />)
    fireEvent.click(screen.getByText('詳細フィルター'))

    // Apply with empty values (defaults)
    fireEvent.click(screen.getByText('適用'))

    const pushArg = mockPush.mock.calls[0]![0]! as string
    expect(pushArg).not.toContain('dateFrom')
    expect(pushArg).not.toContain('dateTo')
  })
})

// ============================================================
// BonsaiRecordForm Tests
// ============================================================

describe('BonsaiRecordForm', () => {
  it('should show error for empty submission (no content, no images)', async () => {
    render(<BonsaiRecordForm bonsaiId="bonsai-1" />)

    const submitBtn = screen.getByText('記録する')
    // Button should be disabled since no content and no images
    expect(submitBtn).toBeDisabled()
  })

  it('should show file size validation error', async () => {
    render(<BonsaiRecordForm bonsaiId="bonsai-1" />)

    const fileInput = document.getElementById('record-images') as HTMLInputElement

    // Create a file larger than MAX_IMAGE_SIZE (10MB)
    const largeFile = new File(['x'.repeat(100)], 'large.jpg', { type: 'image/jpeg' })
    Object.defineProperty(largeFile, 'size', { value: 15 * 1024 * 1024 })

    fireEvent.change(fileInput, { target: { files: [largeFile] } })

    expect(screen.getByText(/画像は.*MB以下にしてください/)).toBeInTheDocument()
  })

  it('should handle empty form submission via form event', async () => {
    render(<BonsaiRecordForm bonsaiId="bonsai-1" />)

    const textarea = screen.getByPlaceholderText('成長の様子や作業内容を記録...')
    fireEvent.change(textarea, { target: { value: 'test content' } })
    fireEvent.change(textarea, { target: { value: '' } })

    // Form submit with empty content and no images
    const form = textarea.closest('form')!
    fireEvent.submit(form)

    expect(screen.getByText('テキストまたは画像を入力してください')).toBeInTheDocument()
  })

  it('should handle upload result with falsy url', async () => {
    const smallFile = new File(['data'], 'test.jpg', { type: 'image/jpeg' })
    Object.defineProperty(smallFile, 'size', { value: 1024 })

    mockPrepareFileForUpload.mockResolvedValue(smallFile)
    ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      json: () => Promise.resolve({ url: '' }),  // falsy url
    })
    mockAddBonsaiRecord.mockResolvedValue({ success: true })

    render(<BonsaiRecordForm bonsaiId="bonsai-1" />)

    const textarea = screen.getByPlaceholderText('成長の様子や作業内容を記録...')
    fireEvent.change(textarea, { target: { value: 'test' } })

    const fileInput = document.getElementById('record-images') as HTMLInputElement
    fireEvent.change(fileInput, { target: { files: [smallFile] } })

    const form = textarea.closest('form')!
    await act(async () => {
      fireEvent.submit(form)
    })

    await waitFor(() => {
      expect(mockAddBonsaiRecord).toHaveBeenCalledWith(
        expect.objectContaining({ bonsaiId: 'bonsai-1' })
      )
    })
  })

  it('should handle server action error (result.error)', async () => {
    mockPrepareFileForUpload.mockResolvedValue(new File(['data'], 'test.jpg', { type: 'image/jpeg' }))
    ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      json: () => Promise.resolve({ url: 'http://example.com/img.jpg' }),
    })
    mockAddBonsaiRecord.mockResolvedValue({ error: 'サーバーエラー' })

    render(<BonsaiRecordForm bonsaiId="bonsai-1" />)

    const textarea = screen.getByPlaceholderText('成長の様子や作業内容を記録...')
    fireEvent.change(textarea, { target: { value: 'some content' } })

    const form = textarea.closest('form')!
    await act(async () => {
      fireEvent.submit(form)
    })

    await waitFor(() => {
      expect(screen.getByText('サーバーエラー')).toBeInTheDocument()
    })
  })

  it('should handle unexpected error (catch block)', async () => {
    mockPrepareFileForUpload.mockRejectedValue(new Error('Compression failed'))

    render(<BonsaiRecordForm bonsaiId="bonsai-1" />)

    const textarea = screen.getByPlaceholderText('成長の様子や作業内容を記録...')
    fireEvent.change(textarea, { target: { value: 'content' } })

    // Add an image to trigger the compression path
    const smallFile = new File(['data'], 'test.jpg', { type: 'image/jpeg' })
    Object.defineProperty(smallFile, 'size', { value: 1024 })
    const fileInput = document.getElementById('record-images') as HTMLInputElement
    fireEvent.change(fileInput, { target: { files: [smallFile] } })

    const form = textarea.closest('form')!
    await act(async () => {
      fireEvent.submit(form)
    })

    await waitFor(() => {
      expect(screen.getByText('エラーが発生しました')).toBeInTheDocument()
    })
  })

  it('should not log compression when ratio is 0', async () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

    const file = new File(['data'], 'test.jpg', { type: 'image/jpeg' })
    Object.defineProperty(file, 'size', { value: 5000 })

    // Return same size file (ratio = 0)
    const compressedFile = new File(['data'], 'test.jpg', { type: 'image/jpeg' })
    Object.defineProperty(compressedFile, 'size', { value: 5000 })
    mockPrepareFileForUpload.mockResolvedValue(compressedFile)
    ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      json: () => Promise.resolve({ url: 'http://example.com/img.jpg' }),
    })
    mockAddBonsaiRecord.mockResolvedValue({ success: true })

    render(<BonsaiRecordForm bonsaiId="bonsai-1" />)

    const textarea = screen.getByPlaceholderText('成長の様子や作業内容を記録...')
    fireEvent.change(textarea, { target: { value: 'text content' } })

    const fileInput = document.getElementById('record-images') as HTMLInputElement
    fireEvent.change(fileInput, { target: { files: [file] } })

    const form = textarea.closest('form')!
    await act(async () => {
      fireEvent.submit(form)
    })

    await waitFor(() => {
      expect(mockAddBonsaiRecord).toHaveBeenCalled()
    })

    // Should NOT have logged compression since ratio is 0
    expect(consoleSpy).not.toHaveBeenCalledWith(expect.stringContaining('圧縮'))
    consoleSpy.mockRestore()
  })

  it('should submit text-only record without images', async () => {
    mockAddBonsaiRecord.mockResolvedValue({ success: true })

    render(<BonsaiRecordForm bonsaiId="bonsai-1" />)

    const textarea = screen.getByPlaceholderText('成長の様子や作業内容を記録...')
    fireEvent.change(textarea, { target: { value: 'text only record' } })

    const form = textarea.closest('form')!
    await act(async () => {
      fireEvent.submit(form)
    })

    await waitFor(() => {
      expect(mockAddBonsaiRecord).toHaveBeenCalledWith({
        bonsaiId: 'bonsai-1',
        content: 'text only record',
        imageUrls: undefined,
      })
    })
  })
})

// ============================================================
// ShopForm Tests
// ============================================================

describe('ShopForm', () => {
  const genres = [
    { id: 'g1', name: '黒松', category: '松柏類' },
    { id: 'g2', name: 'もみじ', category: '雑木類' },
  ]

  beforeEach(() => {
    // Default mock for address change handler auto-search
    mockSearchAddressSuggestions.mockResolvedValue({ suggestions: [] })
  })

  it('should show confirm dialog when submitting without location', async () => {
    render(<ShopForm genres={genres} mode="create" />)

    const nameInput = screen.getByLabelText(/名称/)
    fireEvent.change(nameInput, { target: { value: 'テスト園' } })

    const addressInput = screen.getByLabelText(/住所/)
    fireEvent.change(addressInput, { target: { value: '東京都' } })

    const form = nameInput.closest('form')!
    fireEvent.submit(form)

    expect(screen.getByText('位置情報が取得されていません')).toBeInTheDocument()
  })

  it('should handle handleCancelSubmit from confirm dialog', async () => {
    render(<ShopForm genres={genres} mode="create" />)

    const nameInput = screen.getByLabelText(/名称/)
    fireEvent.change(nameInput, { target: { value: 'テスト園' } })

    const addressInput = screen.getByLabelText(/住所/)
    fireEvent.change(addressInput, { target: { value: '東京都' } })

    fireEvent.submit(nameInput.closest('form')!)

    // Click cancel button
    fireEvent.click(screen.getByText('戻って位置取得'))
    expect(screen.queryByText('位置情報が取得されていません')).not.toBeInTheDocument()
  })

  it('should handle handleConfirmSubmit - submit without location', async () => {
    mockCreateShop.mockResolvedValue({ shopId: 'new-shop-id' })

    render(<ShopForm genres={genres} mode="create" />)

    const nameInput = screen.getByLabelText(/名称/)
    fireEvent.change(nameInput, { target: { value: 'テスト園' } })

    const addressInput = screen.getByLabelText(/住所/)
    fireEvent.change(addressInput, { target: { value: '東京都渋谷区' } })

    fireEvent.submit(nameInput.closest('form')!)

    // Confirm submit without location
    await act(async () => {
      fireEvent.click(screen.getByText('このまま登録'))
    })

    await waitFor(() => {
      expect(mockCreateShop).toHaveBeenCalled()
    })
  })

  it('should handle executeSubmit error with existingId', async () => {
    mockCreateShop.mockResolvedValue({ error: '既に登録されています', existingId: 'existing-123' })

    render(<ShopForm genres={genres} mode="create" />)

    const nameInput = screen.getByLabelText(/名称/)
    fireEvent.change(nameInput, { target: { value: 'テスト園' } })

    const addressInput = screen.getByLabelText(/住所/)
    fireEvent.change(addressInput, { target: { value: '東京都渋谷区' } })

    fireEvent.submit(nameInput.closest('form')!)

    await act(async () => {
      fireEvent.click(screen.getByText('このまま登録'))
    })

    await waitFor(() => {
      expect(screen.getByText(/既存の盆栽園を確認しますか/)).toBeInTheDocument()
    })
  })

  it('should handle update mode executeSubmit success', async () => {
    mockUpdateShop.mockResolvedValue({ success: true })

    const initialData = {
      id: 'shop-1',
      name: 'テスト園',
      address: '東京都',
      latitude: 35.0,
      longitude: 139.0,
      phone: null,
      website: null,
      businessHours: null,
      closedDays: null,
      genres: [],
    }

    render(<ShopForm genres={genres} initialData={initialData} mode="edit" />)

    const nameInput = screen.getByLabelText(/名称/)
    fireEvent.change(nameInput, { target: { value: '更新園' } })

    const form = nameInput.closest('form')!
    await act(async () => {
      fireEvent.submit(form)
    })

    await waitFor(() => {
      expect(mockUpdateShop).toHaveBeenCalled()
      expect(mockPush).toHaveBeenCalledWith('/shops/shop-1')
    })
  })

  it('should handle handleGeocode with empty address', async () => {
    render(<ShopForm genres={genres} mode="create" />)

    const geocodeBtn = screen.getByText('位置取得')
    expect(geocodeBtn).toBeDisabled()
  })

  it('should handle handleGeocode with no results', async () => {
    mockSearchAddressSuggestions.mockResolvedValue({ suggestions: [] })

    render(<ShopForm genres={genres} mode="create" />)

    const addressInput = screen.getByLabelText(/住所/)
    fireEvent.change(addressInput, { target: { value: '不明な場所' } })

    await act(async () => {
      fireEvent.click(screen.getByText('位置取得'))
    })

    await waitFor(() => {
      expect(screen.getByText(/住所が見つかりませんでした/)).toBeInTheDocument()
    })
  })

  it('should handle handleGeocode with single result', async () => {
    mockSearchAddressSuggestions.mockResolvedValue({
      suggestions: [{ latitude: 35.0, longitude: 139.0, displayName: 'Tokyo', formattedAddress: '東京都' }],
    })

    render(<ShopForm genres={genres} mode="create" />)

    const addressInput = screen.getByLabelText(/住所/)
    fireEvent.change(addressInput, { target: { value: '東京' } })

    await act(async () => {
      fireEvent.click(screen.getByText('位置取得'))
    })

    await waitFor(() => {
      expect(screen.getByText(/位置情報を取得しました/)).toBeInTheDocument()
    })
  })

  it('should handle handleGeocode with multiple results', async () => {
    mockSearchAddressSuggestions.mockResolvedValue({
      suggestions: [
        { latitude: 35.0, longitude: 139.0, displayName: 'Tokyo 1', formattedAddress: '東京都A' },
        { latitude: 35.1, longitude: 139.1, displayName: 'Tokyo 2', formattedAddress: '東京都B' },
      ],
    })

    render(<ShopForm genres={genres} mode="create" />)

    const addressInput = screen.getByLabelText(/住所/)
    fireEvent.change(addressInput, { target: { value: '東京' } })

    await act(async () => {
      fireEvent.click(screen.getByText('位置取得'))
    })

    await waitFor(() => {
      expect(screen.getByText('東京都A')).toBeInTheDocument()
      expect(screen.getByText('東京都B')).toBeInTheDocument()
    })
  })

  it('should handle genre toggle', () => {
    render(<ShopForm genres={genres} mode="create" />)

    fireEvent.click(screen.getByText('黒松'))
    // Click again to deselect
    fireEvent.click(screen.getByText('黒松'))
  })

  it('should show delete button in edit mode and handle delete', async () => {
    mockDeleteShop.mockResolvedValue({ success: true })

    const initialData = {
      id: 'shop-1',
      name: 'テスト園',
      address: '東京都',
      latitude: 35.0,
      longitude: 139.0,
      phone: '03-1234-5678',
      website: 'https://example.com',
      businessHours: '9-17',
      closedDays: '水曜',
      genres: [{ id: 'g1', name: '黒松', category: '松柏類' }],
    }

    render(<ShopForm genres={genres} initialData={initialData} mode="edit" />)

    fireEvent.click(screen.getByText('この盆栽園を削除'))

    expect(screen.getByText(/を削除しますか/)).toBeInTheDocument()

    await act(async () => {
      fireEvent.click(screen.getByText('削除する'))
    })

    await waitFor(() => {
      expect(mockDeleteShop).toHaveBeenCalledWith('shop-1')
      expect(mockReplace).toHaveBeenCalledWith('/shops')
    })
  })

  it('should handle delete error', async () => {
    mockDeleteShop.mockResolvedValue({ error: '削除できませんでした' })

    const initialData = {
      id: 'shop-1',
      name: 'テスト園',
      address: '東京都',
      latitude: 35.0,
      longitude: 139.0,
      phone: null,
      website: null,
      businessHours: null,
      closedDays: null,
      genres: [],
    }

    render(<ShopForm genres={genres} initialData={initialData} mode="edit" />)

    fireEvent.click(screen.getByText('この盆栽園を削除'))

    await act(async () => {
      fireEvent.click(screen.getByText('削除する'))
    })

    await waitFor(() => {
      expect(screen.getByText('削除できませんでした')).toBeInTheDocument()
    })
  })

  it('should handle cancel delete dialog', () => {
    const initialData = {
      id: 'shop-1',
      name: 'テスト園',
      address: '東京都',
      latitude: null,
      longitude: null,
      phone: null,
      website: null,
      businessHours: null,
      closedDays: null,
      genres: [],
    }

    render(<ShopForm genres={genres} initialData={initialData} mode="edit" />)

    fireEvent.click(screen.getByText('この盆栽園を削除'))
    expect(screen.getByText(/を削除しますか/)).toBeInTheDocument()

    // Click cancel in delete dialog - find all cancel buttons and click the last one (delete dialog's)
    const cancelButtons = screen.getAllByText('キャンセル')
    fireEvent.click(cancelButtons[cancelButtons.length - 1]!)
    expect(screen.queryByText(/を削除しますか/)).not.toBeInTheDocument()
  })

  it('should handle back button click', () => {
    render(<ShopForm genres={genres} mode="create" />)
    // Find the cancel button (not the delete dialog one)
    const cancelBtns = screen.getAllByText('キャンセル')
    fireEvent.click(cancelBtns[0]!)
    expect(mockBack).toHaveBeenCalled()
  })

  it('should handle address suggestion select with keepOriginalAddress', async () => {
    mockSearchAddressSuggestions.mockResolvedValue({
      suggestions: [
        { latitude: 35.0, longitude: 139.0, displayName: 'Tokyo', formattedAddress: '東京都渋谷区' },
        { latitude: 35.1, longitude: 139.1, displayName: 'Tokyo2', formattedAddress: '東京都新宿区' },
      ],
    })

    render(<ShopForm genres={genres} mode="create" />)

    const addressInput = screen.getByLabelText(/住所/)
    fireEvent.change(addressInput, { target: { value: '東京' } })

    await act(async () => {
      fireEvent.click(screen.getByText('位置取得'))
    })

    await waitFor(() => {
      expect(screen.getByText('東京都渋谷区')).toBeInTheDocument()
    })

    // Click "この位置を使用" (keepOriginalAddress=true)
    const usePositionBtns = screen.getAllByText('この位置を使用')
    fireEvent.click(usePositionBtns[0]!)

    // Address should remain 東京 (original), not replaced
    expect(addressInput).toHaveValue('東京')
    expect(screen.getByText(/位置情報を取得しました/)).toBeInTheDocument()
  })
})

// ============================================================
// ShopChangeRequestForm Tests
// ============================================================

describe('ShopChangeRequestForm', () => {
  const mockShop = {
    id: 'shop-1',
    name: 'テスト盆栽園',
    address: '東京都渋谷区',
    phone: '03-1234-5678',
    website: 'https://example.com',
    businessHours: '9:00-17:00',
    closedDays: '水曜日',
  }

  const mockOnClose = vi.fn()

  beforeEach(() => {
    mockOnClose.mockClear()
  })

  it('should show error when submitting without changes', async () => {
    render(<ShopChangeRequestForm shop={mockShop} onClose={mockOnClose} />)

    // Check name field
    const nameCheckbox = screen.getAllByRole('checkbox')[0]!
    fireEvent.click(nameCheckbox)

    // Don't change the value (same as original)
    const form = nameCheckbox.closest('form')!
    await act(async () => {
      fireEvent.submit(form)
    })

    expect(screen.getByText('変更内容を選択し、現在の値と異なる内容を入力してください')).toBeInTheDocument()
  })

  it('should handle server error on submit', async () => {
    mockCreateShopChangeRequest.mockResolvedValue({ error: 'リクエスト送信エラー' })

    render(<ShopChangeRequestForm shop={mockShop} onClose={mockOnClose} />)

    // Check name field and change value
    const nameCheckbox = screen.getAllByRole('checkbox')[0]!
    fireEvent.click(nameCheckbox)

    const nameInput = screen.getByPlaceholderText('新しい名称を入力')
    fireEvent.change(nameInput, { target: { value: '新しい名前' } })

    const form = nameCheckbox.closest('form')!
    await act(async () => {
      fireEvent.submit(form)
    })

    await waitFor(() => {
      expect(screen.getByText('リクエスト送信エラー')).toBeInTheDocument()
    })
  })

  it('should show success state on successful submit', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    mockCreateShopChangeRequest.mockResolvedValue({ success: true })

    render(<ShopChangeRequestForm shop={mockShop} onClose={mockOnClose} />)

    // Check name field and change value
    const nameCheckbox = screen.getAllByRole('checkbox')[0]!
    fireEvent.click(nameCheckbox)

    const nameInput = screen.getByPlaceholderText('新しい名称を入力')
    fireEvent.change(nameInput, { target: { value: '新しい盆栽園名' } })

    const form = nameCheckbox.closest('form')!
    await act(async () => {
      fireEvent.submit(form)
    })

    await waitFor(() => {
      expect(screen.getByText('変更リクエストを送信しました')).toBeInTheDocument()
    })

    // After 2 seconds, onClose should be called
    act(() => {
      vi.advanceTimersByTime(2000)
    })

    expect(mockOnClose).toHaveBeenCalled()
    expect(mockRefresh).toHaveBeenCalled()

    vi.useRealTimers()
  })

  it('should handle close button click', () => {
    render(<ShopChangeRequestForm shop={mockShop} onClose={mockOnClose} />)

    // Find close button (the X button in header)
    const closeButtons = screen.getAllByRole('button')
    // First button should be the X close button
    fireEvent.click(closeButtons[0]!)

    expect(mockOnClose).toHaveBeenCalled()
  })

  it('should handle textarea fields (businessHours, closedDays)', () => {
    render(<ShopChangeRequestForm shop={mockShop} onClose={mockOnClose} />)

    // Toggle businessHours checkbox (5th checkbox)
    const checkboxes = screen.getAllByRole('checkbox')
    fireEvent.click(checkboxes[4]!) // businessHours

    // Should render a textarea (not input) for businessHours
    const textarea = screen.getByPlaceholderText('新しい営業時間を入力')
    expect(textarea.tagName).toBe('TEXTAREA')

    fireEvent.change(textarea, { target: { value: '10:00-18:00' } })
  })

  it('should show current value as 未設定 when field is null', () => {
    const shopWithNulls = {
      ...mockShop,
      phone: null,
      website: null,
      businessHours: null,
      closedDays: null,
    }

    render(<ShopChangeRequestForm shop={shopWithNulls} onClose={mockOnClose} />)

    // Check phone field
    const checkboxes = screen.getAllByRole('checkbox')
    fireEvent.click(checkboxes[2]!) // phone

    expect(screen.getByText(/（未設定）/)).toBeInTheDocument()
  })

  it('should submit button disabled when no fields checked', () => {
    render(<ShopChangeRequestForm shop={mockShop} onClose={mockOnClose} />)

    const submitBtn = screen.getByText('リクエストを送信')
    expect(submitBtn).toBeDisabled()
  })
})
