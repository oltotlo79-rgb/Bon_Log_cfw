/**
 * EventForm - extra branch coverage
 *
 * Targets:
 * - cancel button calls router.back()
 * - hasSales checkbox toggle
 * - create mode with no endDate omits endDate from FormData
 * - createEvent error with error property shows error message
 */

import { vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '../../utils/test-utils'
import userEvent from '@testing-library/user-event'
import { EventForm } from '@/components/event/EventForm'

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
}))

const mockCreateEvent = vi.fn()
const mockUpdateEvent = vi.fn()
vi.mock('@/lib/actions/event', () => ({
  createEvent: (...args: unknown[]) => mockCreateEvent(...args),
  updateEvent: (...args: unknown[]) => mockUpdateEvent(...args),
}))

describe('EventForm - extra branch coverage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('cancel button calls router.back()', () => {
    render(<EventForm mode="create" />)
    fireEvent.click(screen.getByRole('button', { name: 'キャンセル' }))
    expect(mockBack).toHaveBeenCalled()
  })

  it('hasSales checkbox can be toggled', () => {
    render(<EventForm mode="create" />)
    const checkbox = screen.getByLabelText(/即売あり/) as HTMLInputElement
    expect(checkbox.checked).toBe(false)
    fireEvent.click(checkbox)
    expect(checkbox.checked).toBe(true)
  })

  it('createEvent error with error property shows error message', async () => {
    mockCreateEvent.mockResolvedValue({ success: false, error: 'タイトルは必須です' })
    const user = userEvent.setup()
    render(<EventForm mode="create" />)

    await user.type(screen.getByLabelText(/タイトル/), 'テスト')
    const startDateInput = screen.getByLabelText(/開始日時/)
    await user.clear(startDateInput)
    await user.type(startDateInput, '2024-06-01T10:00')
    await user.selectOptions(screen.getByLabelText(/都道府県/), '東京都')

    await user.click(screen.getByRole('button', { name: '登録する' }))

    await waitFor(() => {
      expect(screen.getByText('タイトルは必須です')).toBeInTheDocument()
    })
  })

  it('create mode shows 登録する button text', () => {
    render(<EventForm mode="create" />)
    expect(screen.getByRole('button', { name: '登録する' })).toBeInTheDocument()
  })

  it('edit mode with null endDate shows empty endDate input', () => {
    const initialData = {
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
    }
    render(<EventForm mode="edit" initialData={initialData} />)

    const endDateInput = screen.getByLabelText(/終了日時/) as HTMLInputElement
    expect(endDateInput.value).toBe('')
  })
})
