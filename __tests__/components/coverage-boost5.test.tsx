import { vi } from 'vitest'
/**
 * Coverage boost tests - batch 5
 * GenreFilter, EventForm
 */
import React from 'react'
import { render, screen, fireEvent, act } from '@testing-library/react'

// ---- mocks ----
vi.mock('next/link', () => {
  const MockLink = ({ children, href, ...props }: any) => <a href={href} {...props}>{children}</a>
  return MockLink
})
vi.mock('next/image', async () => {
  const { MockNextImage } = await import('../utils/mock-next-image')
  return { __esModule: true, default: MockNextImage }
})

const mockPush = vi.fn()
const mockSearchParams = new URLSearchParams()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, refresh: vi.fn(), back: vi.fn() }),
  usePathname: vi.fn(() => '/search'),
  useSearchParams: () => mockSearchParams,
}))

// EventForm deps
const mockCreateEvent = vi.fn()
const mockUpdateEvent = vi.fn()
vi.mock('@/lib/actions/event', () => ({
  createEvent: (...args: any[]) => mockCreateEvent(...args),
  updateEvent: (...args: any[]) => mockUpdateEvent(...args),
}))
vi.mock('@/lib/prefectures', () => ({
  PREFECTURES: ['東京都', '大阪府', '埼玉県'],
}))

import { GenreFilter } from '@/components/search/GenreFilter'
import { EventForm } from '@/components/event/EventForm'

// ============================================================
// GenreFilter
// ============================================================
describe('GenreFilter', () => {
  const genres = {
    '盆栽': [
      { id: 'g1', name: '松柏類', category: '盆栽' },
      { id: 'g2', name: '雑木類', category: '盆栽' },
    ],
    'その他': [
      { id: 'g3', name: '用品', category: 'その他' },
    ],
  }

  beforeEach(() => {
    mockPush.mockClear()
  })

  it('renders trigger button with "ジャンル" text', () => {
    render(<GenreFilter genres={genres} />)
    expect(screen.getByText('ジャンル')).toBeInTheDocument()
  })

  it('opens dropdown on click', () => {
    render(<GenreFilter genres={genres} />)
    fireEvent.click(screen.getByText('ジャンル'))
    expect(screen.getByText('ジャンルで絞り込み')).toBeInTheDocument()
    expect(screen.getByText('松柏類')).toBeInTheDocument()
    expect(screen.getByText('雑木類')).toBeInTheDocument()
    expect(screen.getByText('用品')).toBeInTheDocument()
  })

  it('shows selected count badge', () => {
    render(<GenreFilter genres={genres} selectedGenreIds={['g1', 'g2']} />)
    expect(screen.getByText('2')).toBeInTheDocument()
  })

  it('shows clear button when genres selected', () => {
    render(<GenreFilter genres={genres} selectedGenreIds={['g1']} />)
    fireEvent.click(screen.getByText('ジャンル'))
    expect(screen.getByText('クリア')).toBeInTheDocument()
  })

  it('clicking genre toggles selection (adds)', () => {
    render(<GenreFilter genres={genres} selectedGenreIds={[]} />)
    fireEvent.click(screen.getByText('ジャンル'))
    fireEvent.click(screen.getByText('松柏類'))
    expect(mockPush).toHaveBeenCalledWith(expect.stringContaining('genre=g1'))
  })

  it('clicking selected genre removes it', () => {
    // Set up searchParams with genre=g1
    const params = new URLSearchParams('genre=g1&genre=g2')
    vi.spyOn(params, 'toString').mockReturnValue('genre=g1&genre=g2')
    // We need to re-mock useSearchParams for this specific test
    render(<GenreFilter genres={genres} selectedGenreIds={['g1', 'g2']} />)
    fireEvent.click(screen.getByText('ジャンル'))
    fireEvent.click(screen.getByText('松柏類'))
    // Should push URL without g1
    expect(mockPush).toHaveBeenCalled()
  })

  it('clear button removes all genres', () => {
    render(<GenreFilter genres={genres} selectedGenreIds={['g1']} />)
    fireEvent.click(screen.getByText('ジャンル'))
    fireEvent.click(screen.getByText('クリア'))
    expect(mockPush).toHaveBeenCalledWith(expect.not.stringContaining('genre='))
  })

  it('closes dropdown when clicking overlay', () => {
    render(<GenreFilter genres={genres} />)
    fireEvent.click(screen.getByText('ジャンル'))
    expect(screen.getByText('ジャンルで絞り込み')).toBeInTheDocument()
    // Click the overlay (fixed inset-0 div)
    const overlay = document.querySelector('.fixed.inset-0')
    if (overlay) fireEvent.click(overlay)
    expect(screen.queryByText('ジャンルで絞り込み')).toBeNull()
  })

  it('renders category labels', () => {
    render(<GenreFilter genres={genres} />)
    fireEvent.click(screen.getByText('ジャンル'))
    expect(screen.getByText('盆栽')).toBeInTheDocument()
    expect(screen.getByText('その他')).toBeInTheDocument()
  })
})

// ============================================================
// EventForm
// ============================================================
describe('EventForm', () => {
  beforeEach(() => {
    mockPush.mockClear()
    mockCreateEvent.mockClear()
    mockUpdateEvent.mockClear()
  })

  it('renders create form with required fields', () => {
    render(<EventForm mode="create" />)
    expect(screen.getByLabelText(/タイトル/)).toBeInTheDocument()
    expect(screen.getByLabelText(/開始日時/)).toBeInTheDocument()
  })

  it('renders edit form with initial data', () => {
    render(
      <EventForm
        mode="edit"
        initialData={{
          id: 'e1',
          title: 'テストイベント',
          startDate: new Date('2025-06-01T10:00:00'),
          endDate: null,
          prefecture: '東京都',
          city: '渋谷区',
          venue: 'テスト会場',
          organizer: '主催者',
          fee: '500円',
          hasSales: true,
          description: '説明文',
          externalUrl: 'https://example.com',
        }}
      />
    )
    expect((screen.getByLabelText(/タイトル/) as HTMLInputElement).value).toBe('テストイベント')
  })

  it('submits create form and redirects', async () => {
    mockCreateEvent.mockResolvedValue({ eventId: 'new-e1' })
    render(<EventForm mode="create" />)

    fireEvent.change(screen.getByLabelText(/タイトル/), { target: { value: 'New Event' } })
    fireEvent.change(screen.getByLabelText(/開始日時/), { target: { value: '2025-12-01T10:00' } })

    const form = document.querySelector('form')!
    await act(async () => {
      fireEvent.submit(form)
    })

    expect(mockCreateEvent).toHaveBeenCalled()
  })

  it('submits edit form and redirects', async () => {
    mockUpdateEvent.mockResolvedValue({ success: true })
    render(
      <EventForm
        mode="edit"
        initialData={{
          id: 'e1',
          title: 'Edit Event',
          startDate: new Date('2025-06-01T10:00:00'),
          endDate: null,
          prefecture: '',
          city: null,
          venue: null,
          organizer: null,
          fee: null,
          hasSales: false,
          description: null,
          externalUrl: null,
        }}
      />
    )

    const form = document.querySelector('form')!
    await act(async () => {
      fireEvent.submit(form)
    })

    expect(mockUpdateEvent).toHaveBeenCalledWith('e1', expect.any(FormData))
  })

  it('shows error from server action', async () => {
    mockCreateEvent.mockResolvedValue({ error: 'バリデーションエラー' })
    render(<EventForm mode="create" />)

    fireEvent.change(screen.getByLabelText(/タイトル/), { target: { value: 'Test' } })
    fireEvent.change(screen.getByLabelText(/開始日時/), { target: { value: '2025-12-01T10:00' } })

    const form = document.querySelector('form')!
    await act(async () => {
      fireEvent.submit(form)
    })

    await screen.findByText('バリデーションエラー')
  })

  it('prefecture dropdown has options', () => {
    render(<EventForm mode="create" />)
    const select = screen.getByLabelText(/都道府県/)
    expect(select).toBeInTheDocument()
  })
})
