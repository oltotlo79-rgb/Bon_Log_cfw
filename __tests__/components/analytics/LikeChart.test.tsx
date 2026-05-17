import { render, screen } from '../../utils/test-utils'
import { LikeChart } from '@/components/analytics/LikeChart'

describe('LikeChart', () => {
  const mockData = [
    { date: '2024-01-01', likes: 10, comments: 5 },
    { date: '2024-01-02', likes: 15, comments: 8 },
    { date: '2024-01-03', likes: 20, comments: 10 },
    { date: '2024-01-04', likes: 5, comments: 3 },
    { date: '2024-01-05', likes: 30, comments: 15 },
  ]

  it('チャートを表示する', () => {
    const { container } = render(<LikeChart data={mockData} />)

    expect(container.firstChild).toHaveClass('h-48')
  })

  it('データがない場合は空メッセージを表示する', () => {
    render(<LikeChart data={[]} />)

    expect(screen.getByText('データがありません')).toBeInTheDocument()
  })

  it('凡例を表示する', () => {
    render(<LikeChart data={mockData} />)

    expect(screen.getByText('いいね')).toBeInTheDocument()
    expect(screen.getByText('コメント')).toBeInTheDocument()
  })

  it('開始日を表示する', () => {
    render(<LikeChart data={mockData} />)

    // 1月1日のフォーマット
    expect(screen.getByText(/1月1日|1月 1日|Jan 1/)).toBeInTheDocument()
  })

  it('終了日を表示する', () => {
    render(<LikeChart data={mockData} />)

    // 1月5日のフォーマット
    expect(screen.getByText(/1月5日|1月 5日|Jan 5/)).toBeInTheDocument()
  })

  it('棒グラフコンテナを表示する', () => {
    const { container } = render(<LikeChart data={mockData} />)

    const barContainer = container.querySelector('.flex.items-end.justify-between.h-40')
    expect(barContainer).toBeInTheDocument()
  })

  it('各データポイントに対して棒を表示する', () => {
    const { container } = render(<LikeChart data={mockData} />)

    const bars = container.querySelectorAll('.flex-1.flex.flex-col.items-center')
    expect(bars).toHaveLength(5)
  })

  it('いいね棒にtitle属性を設定する', () => {
    const { container } = render(<LikeChart data={mockData} />)

    const likeBar = container.querySelector('[title="いいね: 10"]')
    expect(likeBar).toBeInTheDocument()
  })

  it('コメント棒にtitle属性を設定する', () => {
    const { container } = render(<LikeChart data={mockData} />)

    const commentBar = container.querySelector('[title="コメント: 5"]')
    expect(commentBar).toBeInTheDocument()
  })

  it('いいね棒にプライマリ色を適用する', () => {
    const { container } = render(<LikeChart data={mockData} />)

    const likeBar = container.querySelector('.bg-primary\\/60.rounded-t')
    expect(likeBar).toBeInTheDocument()
  })

  it('コメント棒に薄いプライマリ色を適用する', () => {
    const { container } = render(<LikeChart data={mockData} />)

    const commentBar = container.querySelector('.bg-primary\\/30.rounded-b')
    expect(commentBar).toBeInTheDocument()
  })

  it('30日以上のデータは最新30日分のみ表示する', () => {
    const longData = Array.from({ length: 40 }, (_, i) => ({
      date: `2024-01-${String(i + 1).padStart(2, '0')}`,
      likes: i + 1,
      comments: i,
    }))

    const { container } = render(<LikeChart data={longData} />)

    const bars = container.querySelectorAll('.flex-1.flex.flex-col.items-center')
    expect(bars).toHaveLength(30)
  })

  it('凡例にいいねの色見本を表示する', () => {
    const { container } = render(<LikeChart data={mockData} />)

    const likeLegend = container.querySelector('.w-3.h-3.rounded.bg-primary\\/60')
    expect(likeLegend).toBeInTheDocument()
  })

  it('凡例にコメントの色見本を表示する', () => {
    const { container } = render(<LikeChart data={mockData} />)

    const commentLegend = container.querySelector('.w-3.h-3.rounded.bg-primary\\/30')
    expect(commentLegend).toBeInTheDocument()
  })

  it('0件のデータでも棒の最小高さを確保する', () => {
    const dataWithZero = [
      { date: '2024-01-01', likes: 0, comments: 0 },
      { date: '2024-01-02', likes: 10, comments: 5 },
    ]
    const { container } = render(<LikeChart data={dataWithZero} />)

    // いいねが0の棒にはminHeightが0
    const zeroLikeBar = container.querySelector('[title="いいね: 0"]')
    expect(zeroLikeBar).toHaveStyle({ minHeight: '0' })
  })

  it('1件以上のデータには最小高さ2pxを設定する', () => {
    const { container } = render(<LikeChart data={mockData} />)

    const likeBar = container.querySelector('[title="いいね: 10"]')
    expect(likeBar).toHaveStyle({ minHeight: '2px' })
  })
})
