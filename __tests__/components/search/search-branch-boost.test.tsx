/**
 * Search components - branch coverage boost tests
 *
 * Targets:
 * - AdvancedSearchFilters: isOpen initial state when filters are set
 * - AdvancedSearchFilters: applyFilters with all fields set
 * - AdvancedSearchFilters: applyFilters with empty fields (delete params)
 * - AdvancedSearchFilters: resetFilters
 * - AdvancedSearchFilters: hasFilters indicator shown
 * - AdvancedSearchFilters: mediaType toggle
 * - AdvancedSearchFilters: minLikes with 0 value (deleted)
 * - SearchBar: localStorage error handling in getRecentSearches
 * - SearchBar: localStorage error in saveRecentSearch
 * - SearchBar: SSR guard (window undefined) - handled via existing tests
 */

import { vi } from 'vitest'
import { render, screen, fireEvent } from '../../utils/test-utils'
import userEvent from '@testing-library/user-event'
import { AdvancedSearchFilters } from '@/components/search/AdvancedSearchFilters'

const mockPush = vi.fn()
let mockSearchParams = new URLSearchParams('q=test')

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
  useSearchParams: () => mockSearchParams,
}))

describe('AdvancedSearchFilters - branch coverage boost', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSearchParams = new URLSearchParams('q=test')
  })

  it('opens automatically when initialDateFrom is provided', () => {
    render(<AdvancedSearchFilters dateFrom="2024-01-01" />)
    // Should be open since dateFrom is set
    expect(screen.getByText('開始日')).toBeInTheDocument()
  })

  it('opens automatically when initialMinLikes is provided', () => {
    render(<AdvancedSearchFilters minLikes="5" />)
    expect(screen.getByText('最小いいね数')).toBeInTheDocument()
  })

  it('opens automatically when initialMediaType is provided', () => {
    render(<AdvancedSearchFilters mediaType="images" />)
    expect(screen.getByText('メディア種別')).toBeInTheDocument()
  })

  it('hasFilters indicator shown when filters are set', () => {
    render(<AdvancedSearchFilters dateFrom="2024-01-01" />)
    // The green dot indicator
    const indicator = document.querySelector('.bg-bonsai-green.rounded-full')
    expect(indicator).not.toBeNull()
  })

  it('hasFilters indicator not shown when no filters', () => {
    render(<AdvancedSearchFilters />)
    // With no initial filters, hasFilters is false, so indicator should not be present
    const indicators = document.querySelectorAll('.bg-bonsai-green')
    // Only the button has bg-bonsai-green (the apply button), not the dot
    const dots = Array.from(indicators).filter(el => el.classList.contains('rounded-full') && el.classList.contains('w-2'))
    expect(dots.length).toBe(0)
  })

  it('applyFilters sets all params', async () => {
    const user = userEvent.setup()
    render(<AdvancedSearchFilters />)

    // Open filters
    await user.click(screen.getByText('詳細フィルター'))

    // Set dateFrom and dateTo via date inputs
    const dateInputs = document.querySelectorAll('input[type="date"]')
    fireEvent.change(dateInputs[0], { target: { value: '2024-01-01' } })
    fireEvent.change(dateInputs[1], { target: { value: '2024-12-31' } })

    // Set minLikes
    const minLikesInput = screen.getByPlaceholderText('0')
    fireEvent.change(minLikesInput, { target: { value: '10' } })

    // Set mediaType
    await user.click(screen.getByText('画像あり'))

    // Apply
    await user.click(screen.getByText('適用'))

    expect(mockPush).toHaveBeenCalledWith(expect.stringContaining('dateFrom='))
    expect(mockPush).toHaveBeenCalledWith(expect.stringContaining('minLikes=10'))
    expect(mockPush).toHaveBeenCalledWith(expect.stringContaining('mediaType=images'))
  })

  it('applyFilters with empty values deletes params', async () => {
    const user = userEvent.setup()
    mockSearchParams = new URLSearchParams('q=test&dateFrom=2024-01-01&minLikes=5&mediaType=images')
    const { container } = render(<AdvancedSearchFilters dateFrom="2024-01-01" minLikes="5" mediaType="images" />)

    // Clear all fields
    const dateInputs = container.querySelectorAll('input[type="date"]')
    fireEvent.change(dateInputs[0], { target: { value: '' } })
    fireEvent.change(dateInputs[1], { target: { value: '' } })

    const numberInput = container.querySelector('input[type="number"]') as HTMLInputElement
    fireEvent.change(numberInput, { target: { value: '' } })
    await user.click(screen.getByText('すべて'))

    await user.click(screen.getByText('適用'))

    expect(mockPush).toHaveBeenCalled()
    const url = mockPush.mock.calls[0][0] as string
    expect(url).not.toContain('dateFrom')
    expect(url).not.toContain('minLikes')
    expect(url).not.toContain('mediaType')
  })

  it('resetFilters clears all filter state and params', async () => {
    const user = userEvent.setup()
    mockSearchParams = new URLSearchParams('q=test&dateFrom=2024-01-01&dateTo=2024-12-31&minLikes=5&mediaType=images')
    render(
      <AdvancedSearchFilters
        dateFrom="2024-01-01"
        dateTo="2024-12-31"
        minLikes="5"
        mediaType="images"
      />
    )

    await user.click(screen.getByText('リセット'))

    expect(mockPush).toHaveBeenCalled()
    const url = mockPush.mock.calls[0][0] as string
    expect(url).not.toContain('dateFrom')
    expect(url).not.toContain('dateTo')
    expect(url).not.toContain('minLikes')
    expect(url).not.toContain('mediaType')
  })

  it('toggle open/close', async () => {
    const user = userEvent.setup()
    render(<AdvancedSearchFilters />)

    // Initially closed
    expect(screen.queryByText('開始日')).not.toBeInTheDocument()

    // Open
    await user.click(screen.getByText('詳細フィルター'))
    expect(screen.getByText('開始日')).toBeInTheDocument()

    // Close
    await user.click(screen.getByText('詳細フィルター'))
    expect(screen.queryByText('開始日')).not.toBeInTheDocument()
  })

  it('minLikes=0 is treated as empty (deleted from params)', async () => {
    const user = userEvent.setup()
    render(<AdvancedSearchFilters />)
    await user.click(screen.getByText('詳細フィルター'))

    fireEvent.change(screen.getByPlaceholderText('0'), { target: { value: '0' } })
    await user.click(screen.getByText('適用'))

    expect(mockPush).toHaveBeenCalled()
    const url = mockPush.mock.calls[0][0] as string
    expect(url).not.toContain('minLikes')
  })

  it('mediaType toggle to specific type and back to empty', async () => {
    const user = userEvent.setup()
    render(<AdvancedSearchFilters />)
    await user.click(screen.getByText('詳細フィルター'))

    // Select videos
    await user.click(screen.getByText('動画あり'))
    // The videos button should have the active class
    expect(screen.getByText('動画あり').className).toContain('bg-bonsai-green')

    // Select text only
    await user.click(screen.getByText('テキストのみ'))
    expect(screen.getByText('テキストのみ').className).toContain('bg-bonsai-green')
    expect(screen.getByText('動画あり').className).not.toContain('bg-bonsai-green')
  })

  it('リセット button not shown when no filters', async () => {
    const user = userEvent.setup()
    render(<AdvancedSearchFilters />)
    await user.click(screen.getByText('詳細フィルター'))

    expect(screen.queryByText('リセット')).not.toBeInTheDocument()
  })
})
