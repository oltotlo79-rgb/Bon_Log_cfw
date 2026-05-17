import { vi } from 'vitest'
import { render, screen } from '../../utils/test-utils'
import userEvent from '@testing-library/user-event'
import { EventCalendar } from '@/components/event/EventCalendar'

// Next-Auth モック
vi.mock('next-auth/react', () => ({
  SessionProvider: ({ children }: { children: React.ReactNode }) => children,
  useSession: () => ({
    data: { user: { id: 'test-user-id' } },
    status: 'authenticated',
  }),
}))

// 今月の15日を開始日として設定（カレンダー表示範囲内に確実に入れるため）
const eventDate = new Date()
eventDate.setDate(15)
eventDate.setHours(0, 0, 0, 0)

const mockEvents = [
  {
    id: 'event-1',
    title: '盆栽展示会',
    startDate: eventDate,
    endDate: null,
    prefecture: '東京都',
  },
]

describe('EventCalendar', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('カレンダーを表示する', () => {
    render(<EventCalendar events={mockEvents} />)
    // 現在の年月が表示される
    expect(screen.getByText(/年.*月/)).toBeInTheDocument()
  })

  it('曜日ヘッダーを表示する', () => {
    render(<EventCalendar events={mockEvents} />)
    expect(screen.getByText('日')).toBeInTheDocument()
    expect(screen.getByText('月')).toBeInTheDocument()
    expect(screen.getByText('火')).toBeInTheDocument()
    expect(screen.getByText('水')).toBeInTheDocument()
    expect(screen.getByText('木')).toBeInTheDocument()
    expect(screen.getByText('金')).toBeInTheDocument()
    expect(screen.getByText('土')).toBeInTheDocument()
  })

  it('前月ボタンを表示する', () => {
    render(<EventCalendar events={mockEvents} />)
    expect(screen.getByLabelText('前月')).toBeInTheDocument()
  })

  it('次月ボタンを表示する', () => {
    render(<EventCalendar events={mockEvents} />)
    expect(screen.getByLabelText('次月')).toBeInTheDocument()
  })

  it('今日ボタンを表示する', () => {
    render(<EventCalendar events={mockEvents} />)
    expect(screen.getByRole('button', { name: '今日' })).toBeInTheDocument()
  })

  it('前月に移動する', async () => {
    const onMonthChange = vi.fn()
    const user = userEvent.setup()
    render(<EventCalendar events={mockEvents} onMonthChange={onMonthChange} />)

    await user.click(screen.getByLabelText('前月'))

    expect(onMonthChange).toHaveBeenCalled()
  })

  it('次月に移動する', async () => {
    const onMonthChange = vi.fn()
    const user = userEvent.setup()
    render(<EventCalendar events={mockEvents} onMonthChange={onMonthChange} />)

    await user.click(screen.getByLabelText('次月'))

    expect(onMonthChange).toHaveBeenCalled()
  })

  it('今日に戻る', async () => {
    const onMonthChange = vi.fn()
    const user = userEvent.setup()
    render(<EventCalendar events={mockEvents} onMonthChange={onMonthChange} />)

    // 先に別の月に移動
    await user.click(screen.getByLabelText('前月'))

    // 今日に戻る
    await user.click(screen.getByRole('button', { name: '今日' }))

    expect(onMonthChange).toHaveBeenCalled()
  })

  it('イベントがある日にイベントを表示する', () => {
    render(<EventCalendar events={mockEvents} />)
    expect(screen.getByText('盆栽展示会')).toBeInTheDocument()
  })

  it('イベントがない場合は何も表示しない', () => {
    render(<EventCalendar events={[]} />)
    expect(screen.queryByText('盆栽展示会')).not.toBeInTheDocument()
  })

  it('イベントリンクがある', () => {
    render(<EventCalendar events={mockEvents} />)
    const eventLink = screen.getByText('盆栽展示会')
    expect(eventLink.closest('a')).toHaveAttribute('href', '/events/event-1')
  })
})
