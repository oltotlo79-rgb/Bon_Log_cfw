/**
 * GenreFilter - branch coverage tests
 * Covers uncovered branches:
 * - selectedGenreIds default (empty array)
 * - Genre toggle: add genre (not currently selected)
 * - Genre toggle: remove genre (currently selected)
 * - Clear all genres
 * - Overlay click closes dropdown
 * - selectedCount badge display (>0 vs 0)
 */

import { vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '../../utils/test-utils'
import userEvent from '@testing-library/user-event'
import { GenreFilter } from '@/components/search/GenreFilter'

const mockPush = vi.fn()
const mockSearchParamsData = new URLSearchParams('q=test&genre=genre-1')

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
  useSearchParams: () => mockSearchParamsData,
}))

const mockGenres = {
  '盆栽の種類': [
    { id: 'genre-1', name: '松柏類', category: '盆栽の種類' },
    { id: 'genre-2', name: '雑木類', category: '盆栽の種類' },
  ],
  'その他': [
    { id: 'genre-3', name: '用品・道具', category: 'その他' },
  ],
}

describe('GenreFilter - branch coverage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders with default empty selectedGenreIds', () => {
    render(<GenreFilter genres={mockGenres} />)
    expect(screen.getByText('ジャンル')).toBeInTheDocument()
    // No count badge
    expect(screen.queryByText('0')).not.toBeInTheDocument()
  })

  it('shows count badge when genres are selected', () => {
    render(<GenreFilter genres={mockGenres} selectedGenreIds={['genre-1', 'genre-2']} />)
    expect(screen.getByText('2')).toBeInTheDocument()
  })

  it('toggles genre off (removes from params)', async () => {
    const user = userEvent.setup()
    render(<GenreFilter genres={mockGenres} selectedGenreIds={['genre-1']} />)

    await user.click(screen.getByText('ジャンル'))

    await waitFor(() => {
      expect(screen.getByText('松柏類')).toBeInTheDocument()
    })

    // Click on already-selected genre to deselect
    await user.click(screen.getByText('松柏類'))

    expect(mockPush).toHaveBeenCalledWith('/search?q=test')
  })

  it('toggles genre on (adds to params)', async () => {
    const user = userEvent.setup()
    render(<GenreFilter genres={mockGenres} selectedGenreIds={['genre-1']} />)

    await user.click(screen.getByText('ジャンル'))

    await waitFor(() => {
      expect(screen.getByText('雑木類')).toBeInTheDocument()
    })

    // Click on non-selected genre to select
    await user.click(screen.getByText('雑木類'))

    expect(mockPush).toHaveBeenCalledWith(expect.stringContaining('genre=genre-2'))
  })

  it('clear all genres removes all genre params', async () => {
    const user = userEvent.setup()
    render(<GenreFilter genres={mockGenres} selectedGenreIds={['genre-1', 'genre-2']} />)

    await user.click(screen.getByText('ジャンル'))

    await waitFor(() => {
      expect(screen.getByText('クリア')).toBeInTheDocument()
    })

    await user.click(screen.getByText('クリア'))

    expect(mockPush).toHaveBeenCalledWith('/search?q=test')
  })

  it('clicking overlay closes dropdown', async () => {
    const user = userEvent.setup()
    render(<GenreFilter genres={mockGenres} selectedGenreIds={[]} />)

    await user.click(screen.getByText('ジャンル'))

    await waitFor(() => {
      expect(screen.getByText('ジャンルで絞り込み')).toBeInTheDocument()
    })

    // Click the fixed overlay
    const overlay = document.querySelector('.fixed.inset-0.z-10') as HTMLElement
    fireEvent.click(overlay)

    await waitFor(() => {
      expect(screen.queryByText('ジャンルで絞り込み')).not.toBeInTheDocument()
    })
  })

  it('no clear button when selectedCount is 0', async () => {
    const user = userEvent.setup()
    render(<GenreFilter genres={mockGenres} selectedGenreIds={[]} />)

    await user.click(screen.getByText('ジャンル'))

    await waitFor(() => {
      expect(screen.getByText('ジャンルで絞り込み')).toBeInTheDocument()
    })

    expect(screen.queryByText('クリア')).not.toBeInTheDocument()
  })
})
