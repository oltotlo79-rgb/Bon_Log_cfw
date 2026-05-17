 
import { vi } from 'vitest'
import { render, screen, waitFor } from '../../utils/test-utils'
import userEvent from '@testing-library/user-event'
import { EventForm } from '@/components/event/EventForm'

// Next-Auth モック
vi.mock('next-auth/react', () => ({
  SessionProvider: ({ children }: { children: React.ReactNode }) => children,
  useSession: () => ({
    data: { user: { id: 'test-user-id' } },
    status: 'authenticated',
  }),
}))

// Next.js navigation モック
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

// Server Actions モック
const mockCreateEvent = vi.fn()
const mockUpdateEvent = vi.fn()
vi.mock('@/lib/actions/event', () => ({
  createEvent: (...args: unknown[]) => mockCreateEvent(...args),
  updateEvent: (...args: unknown[]) => mockUpdateEvent(...args),
}))

describe('EventForm', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('新規作成フォームを表示する', () => {
    render(<EventForm mode="create" />)
    expect(screen.getByLabelText(/タイトル/)).toBeInTheDocument()
    expect(screen.getByLabelText(/開始日時/)).toBeInTheDocument()
    expect(screen.getByLabelText(/都道府県/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '登録する' })).toBeInTheDocument()
  })

  it('編集フォームに初期値を設定する', () => {
    const initialData = {
      id: 'event-1',
      title: 'テストイベント',
      startDate: new Date('2024-01-01T10:00:00'),
      endDate: new Date('2024-01-01T17:00:00'),
      prefecture: '東京都',
      city: '渋谷区',
      venue: 'テスト会場',
      organizer: '主催者',
      fee: '無料',
      hasSales: true,
      description: 'イベント説明',
      externalUrl: 'https://example.com',
    }
    render(<EventForm mode="edit" initialData={initialData} />)
    expect(screen.getByDisplayValue('テストイベント')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '更新する' })).toBeInTheDocument()
  })

  it('タイトルが必須', () => {
    render(<EventForm mode="create" />)
    const titleInput = screen.getByLabelText(/タイトル/)
    expect(titleInput).toBeRequired()
  })

  it('開始日時が必須', () => {
    render(<EventForm mode="create" />)
    const startDateInput = screen.getByLabelText(/開始日時/)
    expect(startDateInput).toBeRequired()
  })

  it('都道府県が必須', () => {
    render(<EventForm mode="create" />)
    const prefectureSelect = screen.getByLabelText(/都道府県/)
    expect(prefectureSelect).toBeRequired()
  })

  it('キャンセルボタンで戻る', async () => {
    const user = userEvent.setup()
    render(<EventForm mode="create" />)

    await user.click(screen.getByRole('button', { name: 'キャンセル' }))

    expect(mockBack).toHaveBeenCalled()
  })

  it('市区町村フィールドを表示する', () => {
    render(<EventForm mode="create" />)
    expect(screen.getByLabelText(/市区町村/)).toBeInTheDocument()
  })

  it('会場名フィールドを表示する', () => {
    render(<EventForm mode="create" />)
    expect(screen.getByLabelText(/会場名/)).toBeInTheDocument()
  })

  it('主催者フィールドを表示する', () => {
    render(<EventForm mode="create" />)
    expect(screen.getByLabelText(/主催者/)).toBeInTheDocument()
  })

  it('入場料フィールドを表示する', () => {
    render(<EventForm mode="create" />)
    expect(screen.getByLabelText(/入場料/)).toBeInTheDocument()
  })

  it('即売ありチェックボックスを表示する', () => {
    render(<EventForm mode="create" />)
    expect(screen.getByLabelText(/即売あり/)).toBeInTheDocument()
  })

  it('詳細説明フィールドを表示する', () => {
    render(<EventForm mode="create" />)
    expect(screen.getByLabelText(/詳細説明/)).toBeInTheDocument()
  })

  it('外部リンクフィールドを表示する', () => {
    render(<EventForm mode="create" />)
    expect(screen.getByLabelText(/外部リンク/)).toBeInTheDocument()
  })

  it('新規作成でServer Actionが呼ばれる', async () => {
    mockCreateEvent.mockResolvedValue({ eventId: 'new-event-id' })
    const user = userEvent.setup()
    render(<EventForm mode="create" />)

    await user.type(screen.getByLabelText(/タイトル/), 'テストイベント')
    // datetime-localの入力
    const startDateInput = screen.getByLabelText(/開始日時/)
    await user.clear(startDateInput)
    await user.type(startDateInput, '2024-01-01T10:00')
    await user.selectOptions(screen.getByLabelText(/都道府県/), '東京都')

    await user.click(screen.getByRole('button', { name: '登録する' }))

    await waitFor(() => {
      expect(mockCreateEvent).toHaveBeenCalled()
    })
  })

  it('エラー時にエラーメッセージを表示する', async () => {
    mockCreateEvent.mockResolvedValue({ error: 'イベント作成に失敗しました' })
    const user = userEvent.setup()
    render(<EventForm mode="create" />)

    await user.type(screen.getByLabelText(/タイトル/), 'テストイベント')
    const startDateInput = screen.getByLabelText(/開始日時/)
    await user.clear(startDateInput)
    await user.type(startDateInput, '2024-01-01T10:00')
    await user.selectOptions(screen.getByLabelText(/都道府県/), '東京都')

    await user.click(screen.getByRole('button', { name: '登録する' }))

    await waitFor(() => {
      expect(screen.getByText('イベント作成に失敗しました')).toBeInTheDocument()
    })
  })
})
