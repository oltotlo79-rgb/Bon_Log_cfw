import { vi } from 'vitest'
import { render, screen, fireEvent, waitFor, act } from '../utils/test-utils'
import userEvent from '@testing-library/user-event'
import { BonsaiSearch } from '@/components/bonsai/BonsaiSearch'

/**
 * BonsaiSearch lines 225-228: handleSubmit (form submission via Enter key)
 *
 * The existing tests cover typing + debounce and click-clear,
 * but never exercise the <form onSubmit={handleSubmit}> path (lines 225-228).
 * handleSubmit calls e.preventDefault() and then handleSearch(query).
 */

const mockSearchBonsais = vi.fn()
vi.mock('@/lib/actions/bonsai', () => ({
  searchBonsais: (...args: unknown[]) => mockSearchBonsais(...args),
}))

vi.useFakeTimers({ shouldAdvanceTime: true })

describe('BonsaiSearch handleSubmit (lines 226-227)', () => {
  const defaultProps = {
    onSearch: vi.fn(),
    onClear: vi.fn(),
    initialCount: 5,
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.clearAllTimers()
  })

  it('submitting the form via Enter key triggers search for current query', async () => {
    mockSearchBonsais.mockResolvedValue({
      bonsais: [{ id: '1', name: '五葉松' }],
    })

    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    render(<BonsaiSearch {...defaultProps} />)

    const input = screen.getByPlaceholderText(/盆栽を検索/)

    // Type a query first
    await user.type(input, '五葉松')

    // Clear any pending debounce calls from typing
    await act(async () => {
      vi.advanceTimersByTime(300)
    })
    vi.clearAllMocks()

    // Now submit the form via Enter key (fires the form's onSubmit)
    fireEvent.submit(input.closest('form')!)

    // handleSubmit calls handleSearch which sets a new debounce timer
    await act(async () => {
      vi.advanceTimersByTime(300)
    })

    await waitFor(() => {
      expect(mockSearchBonsais).toHaveBeenCalledWith('五葉松')
    })
  })

  it('submitting with empty query calls onClear instead of searching', async () => {
    render(<BonsaiSearch {...defaultProps} />)

    const form = screen.getByPlaceholderText(/盆栽を検索/).closest('form')!

    // Submit with empty input
    fireEvent.submit(form)

    // handleSearch('') -> trimmed is empty -> calls onClear
    expect(defaultProps.onClear).toHaveBeenCalled()
    expect(mockSearchBonsais).not.toHaveBeenCalled()
  })
})
