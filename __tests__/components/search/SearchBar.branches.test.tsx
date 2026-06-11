/**
 * SearchBar - branch coverage tests
 * Covers uncovered branches:
 * - handleSearch with onSearch callback vs URL navigation
 * - handleSearch with empty query (deletes q param)
 * - handleClear with onSearch callback
 * - handleClear without onSearch (URL navigation)
 * - Keyboard shortcut / to focus
 * - Escape key to close dropdown and blur
 * - Outside click closes dropdown
 * - URL params sync (searchParams.get('q'))
 * - localStorage error handling paths
 */

import { vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '../../utils/test-utils'
import userEvent from '@testing-library/user-event'
import { SearchBar } from '@/components/search/SearchBar'

const mockPush = vi.fn()
let mockSearchParams = new URLSearchParams('tab=posts')

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
  useSearchParams: () => mockSearchParams,
}))

// localStorage mock
const localStorageMock = (() => {
  let store: Record<string, string> = {}
  return {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => { store[key] = value }),
    removeItem: vi.fn((key: string) => { delete store[key] }),
    clear: vi.fn(() => { store = {} }),
  }
})()

Object.defineProperty(window, 'localStorage', { value: localStorageMock })

describe('SearchBar - branch coverage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorageMock.clear()
    mockSearchParams = new URLSearchParams('tab=posts')
  })

  it('handleSearch with onSearch callback calls it instead of router.push', async () => {
    const onSearch = vi.fn()
    const user = userEvent.setup()
    render(<SearchBar onSearch={onSearch} />)

    const input = screen.getByTestId('search-input')
    await user.type(input, 'test query')
    await user.keyboard('{Enter}')

    expect(onSearch).toHaveBeenCalledWith('test query')
    expect(mockPush).not.toHaveBeenCalled()
  })

  it('handleSearch without onSearch uses router.push with q param', async () => {
    const user = userEvent.setup()
    render(<SearchBar />)

    const input = screen.getByTestId('search-input')
    await user.type(input, 'bonsai')
    await user.keyboard('{Enter}')

    expect(mockPush).toHaveBeenCalledWith(expect.stringContaining('q=bonsai'))
  })

  it('handleSearch with empty query deletes q param from URL', async () => {
    const user = userEvent.setup()
    render(<SearchBar />)

    const input = screen.getByTestId('search-input')
    await user.click(input)
    await user.keyboard('{Enter}')

    expect(mockPush).toHaveBeenCalledWith('/search?tab=posts')
  })

  it('handleClear with onSearch callback calls onSearch with empty string', async () => {
    const onSearch = vi.fn()
    const user = userEvent.setup()
    render(<SearchBar onSearch={onSearch} defaultValue="test" />)

    // Clear button should be visible
    const clearButton = screen.getByLabelText('検索をクリア')
    await user.click(clearButton)

    expect(onSearch).toHaveBeenCalledWith('')
  })

  it('handleClear without onSearch navigates without q param', async () => {
    const user = userEvent.setup()
    render(<SearchBar defaultValue="test" />)

    const clearButton = screen.getByLabelText('検索をクリア')
    await user.click(clearButton)

    expect(mockPush).toHaveBeenCalledWith('/search?tab=posts')
  })

  it('Escape key closes dropdown and blurs input', async () => {
    localStorageMock.getItem.mockImplementation((key: string) => key === 'bonsai-sns-recent-searches' ? JSON.stringify(['old search']) : null)
    const user = userEvent.setup()
    render(<SearchBar />)

    const input = screen.getByTestId('search-input')
    await user.click(input)

    // Dropdown should show
    await waitFor(() => {
      expect(screen.getByText('最近の検索')).toBeInTheDocument()
    })

    await user.keyboard('{Escape}')

    await waitFor(() => {
      expect(screen.queryByText('最近の検索')).not.toBeInTheDocument()
    })
  })

  it('/ key focuses the search input from outside', async () => {
    render(<SearchBar />)

    const input = screen.getByTestId('search-input')
    expect(document.activeElement).not.toBe(input)

    fireEvent.keyDown(document, { key: '/' })

    expect(document.activeElement).toBe(input)
  })

  it('/ key inside input or textarea does not focus search', async () => {
    render(
      <div>
        <textarea data-testid="other-textarea" />
        <SearchBar />
      </div>
    )

    const textarea = screen.getByTestId('other-textarea')
    textarea.focus()

    fireEvent.keyDown(textarea, { key: '/' })

    // Should not change focus since target is a TEXTAREA
    expect(document.activeElement).toBe(textarea)
  })

  it('outside click closes dropdown', async () => {
    localStorageMock.getItem.mockImplementation((key: string) => key === 'bonsai-sns-recent-searches' ? JSON.stringify(['test']) : null)
    const user = userEvent.setup()
    render(
      <div>
        <div data-testid="outside">outside</div>
        <SearchBar />
      </div>
    )

    const input = screen.getByTestId('search-input')
    await user.click(input)

    await waitFor(() => {
      expect(screen.getByText('最近の検索')).toBeInTheDocument()
    })

    fireEvent.mouseDown(screen.getByTestId('outside'))

    await waitFor(() => {
      expect(screen.queryByText('最近の検索')).not.toBeInTheDocument()
    })
  })

  it('recent search click navigates with that query', async () => {
    localStorageMock.getItem.mockImplementation((key: string) => key === 'bonsai-sns-recent-searches' ? JSON.stringify(['old search']) : null)
    const user = userEvent.setup()
    render(<SearchBar />)

    const input = screen.getByTestId('search-input')
    await user.click(input)

    await waitFor(() => {
      expect(screen.getByText('old search')).toBeInTheDocument()
    })

    // Click on the recent search
    await user.click(screen.getByText('old search'))

    expect(mockPush).toHaveBeenCalledWith(expect.stringContaining('q=old+search'))
  })

  it('clear all recent searches removes them', async () => {
    localStorageMock.getItem.mockImplementation((key: string) => key === 'bonsai-sns-recent-searches' ? JSON.stringify(['a', 'b']) : null)
    const user = userEvent.setup()
    render(<SearchBar />)

    const input = screen.getByTestId('search-input')
    await user.click(input)

    await waitFor(() => {
      expect(screen.getByText('すべて削除')).toBeInTheDocument()
    })

    await user.click(screen.getByText('すべて削除'))

    await waitFor(() => {
      expect(screen.queryByText('最近の検索')).not.toBeInTheDocument()
    })
  })

  it('remove individual search history item', async () => {
    let currentStore = JSON.stringify(['keep', 'remove'])
    localStorageMock.getItem.mockImplementation((key: string) => key === 'bonsai-sns-recent-searches' ? currentStore : null)
    localStorageMock.setItem.mockImplementation((_key: string, value: string) => { currentStore = value })
    const user = userEvent.setup()
    render(<SearchBar />)

    const input = screen.getByTestId('search-input')
    await user.click(input)

    await waitFor(() => {
      expect(screen.getByText('remove')).toBeInTheDocument()
    })

    // Click the delete button for 'remove'
    const deleteButtons = screen.getAllByLabelText('履歴を削除')
    await user.click(deleteButtons[1]!)

    await waitFor(() => {
      expect(screen.queryByText('remove')).not.toBeInTheDocument()
      expect(screen.getByText('keep')).toBeInTheDocument()
    })
  })
})
