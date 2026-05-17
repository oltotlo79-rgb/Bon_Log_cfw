/**
 * Event components - branch coverage boost tests
 *
 * Targets:
 * - EventCard: ongoing event (startDate <= now, endDate >= now, not ended)
 * - EventCard: admissionFee badge display
 * - EventCard: hasSales badge display
 * - EventCard: city + venue together
 * - EventCard: isEnded with endDate (endDate < now)
 * - EventForm: createEvent error with error property
 * - EventForm: cancel button calls router.back()
 * - EventCalendarWrapper: renders with initialYear and initialMonth
 */

import { vi } from 'vitest'
import { render, screen, waitFor, fireEvent } from '../../utils/test-utils'
import { EventCard } from '@/components/event/EventCard'
import { EventForm } from '@/components/event/EventForm'
import { EventCalendarWrapper } from '@/components/event/EventCalendarWrapper'

vi.mock('next-auth/react', () => ({
  SessionProvider: ({ children }: { children: React.ReactNode }) => children,
  useSession: () => ({
    data: { user: { id: 'test-user-id' } },
    status: 'authenticated',
  }),
}))

const mockPush = vi.fn()
const mockBack = vi.fn()
const mockRefresh = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    back: mockBack,
    refresh: mockRefresh,
  }),
  useSearchParams: () => new URLSearchParams(),
}))

const mockCreateEvent = vi.fn()
const mockUpdateEvent = vi.fn()
vi.mock('@/lib/actions/event', () => ({
  createEvent: (...args: unknown[]) => mockCreateEvent(...args),
  updateEvent: (...args: unknown[]) => mockUpdateEvent(...args),
}))

const tomorrow = new Date()
tomorrow.setDate(tomorrow.getDate() + 1)

const yesterday = new Date()
yesterday.setDate(yesterday.getDate() - 1)

const baseEvent = {
  id: 'event-1',
  title: 'テストイベント',
  startDate: tomorrow,
  endDate: null,
  prefecture: '東京都',
  city: null,
  venue: null,
  admissionFee: null,
  hasSales: false,
}

describe('EventCard - branch boost', () => {
  it('ongoing event shows 開催中 badge', () => {
    const twoDaysAgo = new Date()
    twoDaysAgo.setDate(twoDaysAgo.getDate() - 2)
    const twoDaysLater = new Date()
    twoDaysLater.setDate(twoDaysLater.getDate() + 2)

    render(
      <EventCard
        event={{
          ...baseEvent,
          startDate: twoDaysAgo,
          endDate: twoDaysLater,
        }}
      />
    )
    expect(screen.getByText('開催中')).toBeInTheDocument()
    expect(screen.queryByText('終了')).not.toBeInTheDocument()
  })

  it('ended event with endDate in past shows 終了', () => {
    const threeDaysAgo = new Date()
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3)
    const twoDaysAgo = new Date()
    twoDaysAgo.setDate(twoDaysAgo.getDate() - 2)

    render(
      <EventCard
        event={{
          ...baseEvent,
          startDate: threeDaysAgo,
          endDate: twoDaysAgo,
        }}
      />
    )
    expect(screen.getByText('終了')).toBeInTheDocument()
    expect(screen.queryByText('開催中')).not.toBeInTheDocument()
  })

  it('admissionFee badge is displayed when set', () => {
    render(
      <EventCard
        event={{
          ...baseEvent,
          admissionFee: '500円',
        }}
      />
    )
    expect(screen.getByText('500円')).toBeInTheDocument()
  })

  it('hasSales badge is displayed when true', () => {
    render(
      <EventCard
        event={{
          ...baseEvent,
          hasSales: true,
        }}
      />
    )
    expect(screen.getByText('即売あり')).toBeInTheDocument()
  })

  it('city and venue are both shown when present', () => {
    render(
      <EventCard
        event={{
          ...baseEvent,
          prefecture: '東京都',
          city: '渋谷区',
          venue: '渋谷ホール',
        }}
      />
    )
    expect(screen.getByText(/東京都.*渋谷区.*\/.*渋谷ホール/)).toBeInTheDocument()
  })

  it('ended event has opacity-60 class', () => {
    render(
      <EventCard
        event={{
          ...baseEvent,
          startDate: yesterday,
          endDate: null,
        }}
      />
    )
    const link = screen.getByRole('link')
    expect(link.className).toContain('opacity-60')
  })

  it('future event has no opacity-60 class', () => {
    render(<EventCard event={baseEvent} />)
    const link = screen.getByRole('link')
    expect(link.className).not.toContain('opacity-60')
  })
})

describe('EventForm - branch boost', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('createEvent error shows error message', async () => {
    mockCreateEvent.mockResolvedValue({ success: false, error: 'タイトルが必要です' })
    render(<EventForm mode="create" />)

    fireEvent.change(screen.getByLabelText(/タイトル/), { target: { value: 'テスト' } })
    fireEvent.change(screen.getByLabelText(/開始日時/), { target: { value: '2024-06-01T10:00' } })
    fireEvent.change(screen.getByLabelText(/都道府県/), { target: { value: '東京都' } })

    fireEvent.click(screen.getByRole('button', { name: '登録する' }))

    await waitFor(() => {
      expect(screen.getByText('タイトルが必要です')).toBeInTheDocument()
    })
  })

  it('cancel button calls router.back()', () => {
    render(<EventForm mode="create" />)
    fireEvent.click(screen.getByRole('button', { name: 'キャンセル' }))
    expect(mockBack).toHaveBeenCalled()
  })

  it('create mode button label shows 登録する', () => {
    render(<EventForm mode="create" />)
    expect(screen.getByRole('button', { name: '登録する' })).toBeInTheDocument()
  })

  it('edit mode with null endDate leaves endDate field empty', () => {
    render(
      <EventForm
        mode="edit"
        initialData={{
          id: 'event-1',
          title: 'テスト',
          startDate: new Date('2024-06-01T10:00:00'),
          endDate: null,
          prefecture: '東京都',
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

    const endDateInput = screen.getByLabelText(/終了日時/) as HTMLInputElement
    expect(endDateInput.value).toBe('')
  })

  it('hasSales false by default in create mode', () => {
    render(<EventForm mode="create" />)
    const checkbox = screen.getByLabelText(/即売あり/) as HTMLInputElement
    expect(checkbox.checked).toBe(false)
  })
})

describe('EventCalendarWrapper - branch boost', () => {
  it('renders with initialYear and initialMonth', () => {
    const events = [
      {
        id: 'e1',
        title: 'テストイベント',
        startDate: new Date('2024-03-15'),
        endDate: null,
        prefecture: '東京都',
      },
    ]

    render(
      <EventCalendarWrapper
        events={events}
        initialYear={2024}
        initialMonth={3}
      />
    )

    // The calendar should render with the given year/month
    expect(screen.getByText(/2024年/)).toBeInTheDocument()
    expect(screen.getByText(/3月/)).toBeInTheDocument()
  })

  it('renders without initialYear and initialMonth (defaults to current)', () => {
    render(<EventCalendarWrapper events={[]} />)

    const now = new Date()
    expect(screen.getByText(new RegExp(`${now.getFullYear()}年`))).toBeInTheDocument()
  })
})
