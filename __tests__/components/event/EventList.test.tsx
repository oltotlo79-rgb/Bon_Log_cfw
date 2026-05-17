import { render, screen } from '../../utils/test-utils'
import { EventList } from '@/components/event/EventList'

vi.mock('@/components/event/EventCard', () => ({
  EventCard: ({ event }: { event: { id: string; title: string } }) => (
    <div data-testid="event-card" data-event-id={event.id}>{event.title}</div>
  ),
}))

const mockEvents = [
  {
    id: 'e1',
    title: '春の盆栽展',
    startDate: new Date('2025-04-01'),
    endDate: null,
    prefecture: '東京都',
    city: null,
    venue: '会場A',
    admissionFee: '無料',
    hasSales: false,
  },
  {
    id: 'e2',
    title: '秋の展示会',
    startDate: new Date('2025-10-01'),
    endDate: new Date('2025-10-02'),
    prefecture: '大阪府',
    city: '大阪市',
    venue: '会場B',
    admissionFee: '500円',
    hasSales: true,
  },
]

describe('EventList', () => {
  it('イベントが複数ある場合にカードを表示する', () => {
    render(<EventList events={mockEvents} />)
    expect(screen.getByText('春の盆栽展')).toBeInTheDocument()
    expect(screen.getByText('秋の展示会')).toBeInTheDocument()
    expect(screen.getAllByTestId('event-card')).toHaveLength(2)
  })

  it('イベントが0件の場合に空メッセージを表示する', () => {
    render(<EventList events={[]} />)
    expect(screen.getByText('イベントがありません')).toBeInTheDocument()
  })

  it('emptyMessageを渡すとカスタム空メッセージを表示する', () => {
    render(
      <EventList
        events={[]}
        emptyMessage="該当するイベントが見つかりません"
      />
    )
    expect(screen.getByText('該当するイベントが見つかりません')).toBeInTheDocument()
  })
})
