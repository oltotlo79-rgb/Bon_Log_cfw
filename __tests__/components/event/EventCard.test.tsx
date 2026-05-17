import { render, screen } from '../../utils/test-utils'
import { EventCard } from '@/components/event/EventCard'

// 明日の日付を作成
const tomorrow = new Date()
tomorrow.setDate(tomorrow.getDate() + 1)

// 昨日の日付を作成
const yesterday = new Date()
yesterday.setDate(yesterday.getDate() - 1)

const mockEvent = {
  id: 'event-1',
  title: '春の盆栽展示会',
  startDate: tomorrow,
  endDate: null,
  prefecture: '東京都',
  city: '練馬区',
  venue: '練馬文化センター',
  admissionFee: '500円',
  hasSales: true,
}

describe('EventCard', () => {
  it('イベントタイトルを表示する', () => {
    render(<EventCard event={mockEvent} />)
    expect(screen.getByText('春の盆栽展示会')).toBeInTheDocument()
  })

  it('開催場所を表示する', () => {
    render(<EventCard event={mockEvent} />)
    expect(screen.getByText(/東京都/)).toBeInTheDocument()
    expect(screen.getByText(/練馬区/)).toBeInTheDocument()
    expect(screen.getByText(/練馬文化センター/)).toBeInTheDocument()
  })

  it('入場料を表示する', () => {
    render(<EventCard event={mockEvent} />)
    expect(screen.getByText('500円')).toBeInTheDocument()
  })

  it('即売ありのバッジを表示する', () => {
    render(<EventCard event={mockEvent} />)
    expect(screen.getByText('即売あり')).toBeInTheDocument()
  })

  it('イベント詳細ページへのリンクを持つ', () => {
    render(<EventCard event={mockEvent} />)
    const link = screen.getByRole('link')
    expect(link).toHaveAttribute('href', '/events/event-1')
  })

  it('終了したイベントは「終了」バッジを表示する', () => {
    const endedEvent = {
      ...mockEvent,
      startDate: yesterday,
      endDate: yesterday,
    }
    render(<EventCard event={endedEvent} />)
    expect(screen.getByText('終了')).toBeInTheDocument()
  })

  it('終了したイベントは透明度が下がる', () => {
    const endedEvent = {
      ...mockEvent,
      startDate: yesterday,
      endDate: yesterday,
    }
    render(<EventCard event={endedEvent} />)
    const link = screen.getByRole('link')
    expect(link).toHaveClass('opacity-60')
  })

  it('開催中のイベントは「開催中」バッジを表示する', () => {
    const ongoingStart = new Date()
    ongoingStart.setDate(ongoingStart.getDate() - 1)
    const ongoingEnd = new Date()
    ongoingEnd.setDate(ongoingEnd.getDate() + 1)

    const ongoingEvent = {
      ...mockEvent,
      startDate: ongoingStart,
      endDate: ongoingEnd,
    }
    render(<EventCard event={ongoingEvent} />)
    expect(screen.getByText('開催中')).toBeInTheDocument()
  })

  it('場所がない場合は表示しない', () => {
    const eventWithoutLocation = {
      ...mockEvent,
      prefecture: null,
      city: null,
      venue: null,
    }
    render(<EventCard event={eventWithoutLocation} />)
    // MapPinIconが表示されないことを確認
    expect(screen.queryByText('練馬区')).not.toBeInTheDocument()
  })

  it('入場料がない場合は表示しない', () => {
    const eventWithoutFee = {
      ...mockEvent,
      admissionFee: null,
    }
    render(<EventCard event={eventWithoutFee} />)
    expect(screen.queryByText('500円')).not.toBeInTheDocument()
  })

  it('即売がない場合はバッジを表示しない', () => {
    const eventWithoutSales = {
      ...mockEvent,
      hasSales: false,
    }
    render(<EventCard event={eventWithoutSales} />)
    expect(screen.queryByText('即売あり')).not.toBeInTheDocument()
  })
})
