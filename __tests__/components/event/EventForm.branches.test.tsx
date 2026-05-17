/**
 * EventForm - branch coverage tests
 * Covers uncovered branches:
 * - formatDateForInput with null date
 * - edit mode: updateEvent success redirects to initialData.id
 * - createEvent success redirects to eventId
 * - FormData with optional fields (endDate, city, venue, organizer, fee, description, externalUrl)
 * - FormData without optional fields
 * - updateEvent error without error property (generic)
 */

import { vi } from 'vitest'
import { render, screen, waitFor } from '../../utils/test-utils'
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

const fullInitialData = {
  id: 'event-1',
  title: 'テストイベント',
  startDate: new Date('2024-06-01T10:00:00'),
  endDate: new Date('2024-06-03T17:00:00'),
  prefecture: '東京都',
  city: '渋谷区',
  venue: 'テスト会場',
  organizer: '主催者',
  fee: '500円',
  hasSales: true,
  description: 'イベント説明',
  externalUrl: 'https://example.com',
}

describe('EventForm - branch coverage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('edit mode: updateEvent success redirects to initialData.id', async () => {
    mockUpdateEvent.mockResolvedValue({ success: true })
    const user = userEvent.setup()
    render(<EventForm mode="edit" initialData={fullInitialData} />)

    await user.click(screen.getByRole('button', { name: '更新する' }))

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/events/event-1')
      expect(mockRefresh).toHaveBeenCalled()
    })
  })

  it('create mode: createEvent success redirects to eventId', async () => {
    mockCreateEvent.mockResolvedValue({ success: true, data: { eventId: 'new-event-id' } })
    const user = userEvent.setup()
    render(<EventForm mode="create" />)

    await user.type(screen.getByLabelText(/タイトル/), 'テスト')
    const startDateInput = screen.getByLabelText(/開始日時/)
    await user.clear(startDateInput)
    await user.type(startDateInput, '2024-06-01T10:00')
    await user.selectOptions(screen.getByLabelText(/都道府県/), '東京都')

    await user.click(screen.getByRole('button', { name: '登録する' }))

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/events/new-event-id')
    })
  })

  it('updateEvent error without error property shows generic error', async () => {
    mockUpdateEvent.mockResolvedValue({ success: false })
    const user = userEvent.setup()
    render(<EventForm mode="edit" initialData={fullInitialData} />)

    await user.click(screen.getByRole('button', { name: '更新する' }))

    await waitFor(() => {
      expect(screen.getByText('エラー')).toBeInTheDocument()
    })
  })

  it('edit mode shows 保存中... while pending', async () => {
    mockUpdateEvent.mockImplementation(() => new Promise(() => {}))
    const user = userEvent.setup()
    render(<EventForm mode="edit" initialData={fullInitialData} />)

    await user.click(screen.getByRole('button', { name: '更新する' }))

    await waitFor(() => {
      expect(screen.getByText('保存中...')).toBeInTheDocument()
    })
  })

  it('edit mode with all optional fields populates initialData', () => {
    render(<EventForm mode="edit" initialData={fullInitialData} />)

    expect(screen.getByDisplayValue('テストイベント')).toBeInTheDocument()
    expect(screen.getByDisplayValue('渋谷区')).toBeInTheDocument()
    expect(screen.getByDisplayValue('テスト会場')).toBeInTheDocument()
    expect(screen.getByDisplayValue('主催者')).toBeInTheDocument()
    expect(screen.getByDisplayValue('500円')).toBeInTheDocument()
    expect(screen.getByDisplayValue('イベント説明')).toBeInTheDocument()
    expect(screen.getByDisplayValue('https://example.com')).toBeInTheDocument()
    expect((screen.getByLabelText(/即売あり/) as HTMLInputElement).checked).toBe(true)
  })

  it('create mode with no optional fields sends minimal FormData', async () => {
    mockCreateEvent.mockResolvedValue({ success: true, eventId: 'e1' })
    const user = userEvent.setup()
    render(<EventForm mode="create" />)

    await user.type(screen.getByLabelText(/タイトル/), 'テスト')
    const startDateInput = screen.getByLabelText(/開始日時/)
    await user.clear(startDateInput)
    await user.type(startDateInput, '2024-06-01T10:00')
    await user.selectOptions(screen.getByLabelText(/都道府県/), '東京都')

    await user.click(screen.getByRole('button', { name: '登録する' }))

    await waitFor(() => {
      const formData = mockCreateEvent.mock.calls[0][0] as FormData
      expect(formData.get('title')).toBe('テスト')
      expect(formData.get('endDate')).toBeNull()
      expect(formData.get('city')).toBeNull()
      expect(formData.get('venue')).toBeNull()
      expect(formData.get('organizer')).toBeNull()
      expect(formData.get('fee')).toBeNull()
      expect(formData.get('description')).toBeNull()
      expect(formData.get('externalUrl')).toBeNull()
    })
  })

  it('edit mode sends all optional fields in FormData', async () => {
    mockUpdateEvent.mockResolvedValue({ success: true })
    const user = userEvent.setup()
    render(<EventForm mode="edit" initialData={fullInitialData} />)

    await user.click(screen.getByRole('button', { name: '更新する' }))

    await waitFor(() => {
      const formData = mockUpdateEvent.mock.calls[0][1] as FormData
      expect(formData.get('endDate')).toBeTruthy()
      expect(formData.get('city')).toBe('渋谷区')
      expect(formData.get('venue')).toBe('テスト会場')
      expect(formData.get('organizer')).toBe('主催者')
      expect(formData.get('fee')).toBe('500円')
      expect(formData.get('description')).toBe('イベント説明')
      expect(formData.get('externalUrl')).toBe('https://example.com')
      expect(formData.get('hasSales')).toBe('true')
    })
  })

  it('create mode: createEvent success without eventId still calls router.refresh()', async () => {
    // discriminated union のリファクタにより、
    // create 成功かつ data.eventId が無い場合は push されず refresh のみ呼ばれる
    mockCreateEvent.mockResolvedValue({ success: true, data: {} })
    const user = userEvent.setup()
    render(<EventForm mode="create" />)

    await user.type(screen.getByLabelText(/タイトル/), 'テスト')
    const startDateInput = screen.getByLabelText(/開始日時/)
    await user.clear(startDateInput)
    await user.type(startDateInput, '2024-06-01T10:00')
    await user.selectOptions(screen.getByLabelText(/都道府県/), '東京都')

    await user.click(screen.getByRole('button', { name: '登録する' }))

    await waitFor(() => {
      expect(mockRefresh).toHaveBeenCalled()
    })
    // eventId が無いので push は呼ばれない
    expect(mockPush).not.toHaveBeenCalled()
  })

  it('create mode: createEvent failure does NOT call router.refresh()', async () => {
    mockCreateEvent.mockResolvedValue({ success: false, error: '作成失敗' })
    const user = userEvent.setup()
    render(<EventForm mode="create" />)

    await user.type(screen.getByLabelText(/タイトル/), 'テスト')
    const startDateInput = screen.getByLabelText(/開始日時/)
    await user.clear(startDateInput)
    await user.type(startDateInput, '2024-06-01T10:00')
    await user.selectOptions(screen.getByLabelText(/都道府県/), '東京都')

    await user.click(screen.getByRole('button', { name: '登録する' }))

    await waitFor(() => {
      expect(screen.getByText('作成失敗')).toBeInTheDocument()
    })
    expect(mockRefresh).not.toHaveBeenCalled()
    expect(mockPush).not.toHaveBeenCalled()
  })

  it('edit mode: updateEvent failure does NOT call router.push or refresh', async () => {
    mockUpdateEvent.mockResolvedValue({ success: false, error: '更新失敗' })
    const user = userEvent.setup()
    render(<EventForm mode="edit" initialData={fullInitialData} />)

    await user.click(screen.getByRole('button', { name: '更新する' }))

    await waitFor(() => {
      expect(screen.getByText('更新失敗')).toBeInTheDocument()
    })
    expect(mockPush).not.toHaveBeenCalled()
    expect(mockRefresh).not.toHaveBeenCalled()
  })

  it('edit mode pushes via buildEventPath helper using initialData.id (not result data)', async () => {
    // 編集成功時は result.data に eventId が無くても initialData.id にリダイレクトする
    mockUpdateEvent.mockResolvedValue({ success: true })
    const user = userEvent.setup()
    render(<EventForm mode="edit" initialData={{ ...fullInitialData, id: 'evt-9999' }} />)

    await user.click(screen.getByRole('button', { name: '更新する' }))

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/events/evt-9999')
    })
  })
})
