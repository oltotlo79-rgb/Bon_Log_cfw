import { render, screen } from '../../utils/test-utils'
import { StatCard } from '@/components/analytics/StatCard'
import { FileText, Heart, TrendingUp } from 'lucide-react'

describe('StatCard', () => {
  it('タイトルを表示する', () => {
    render(<StatCard title="投稿数" value={123} icon={FileText} />)

    expect(screen.getByText('投稿数')).toBeInTheDocument()
  })

  it('数値を表示する', () => {
    render(<StatCard title="投稿数" value={123} icon={FileText} />)

    expect(screen.getByText('123')).toBeInTheDocument()
  })

  it('文字列の値を表示する', () => {
    render(<StatCard title="平均評価" value="4.5" icon={TrendingUp} />)

    expect(screen.getByText('4.5')).toBeInTheDocument()
  })

  it('説明文を表示する', () => {
    render(
      <StatCard
        title="いいね数"
        value={50}
        icon={Heart}
        description="前月比 +12%"
      />
    )

    expect(screen.getByText('前月比 +12%')).toBeInTheDocument()
  })

  it('説明文がない場合は表示しない', () => {
    render(<StatCard title="投稿数" value={10} icon={FileText} />)

    expect(screen.queryByText('前月比')).not.toBeInTheDocument()
  })

  it('アイコンを表示する', () => {
    const { container } = render(<StatCard title="投稿数" value={10} icon={FileText} />)

    const icon = container.querySelector('svg')
    expect(icon).toBeInTheDocument()
    expect(icon).toHaveClass('w-5', 'h-5', 'text-primary')
  })

  it('アイコン背景の円形コンテナを表示する', () => {
    const { container } = render(<StatCard title="投稿数" value={10} icon={FileText} />)

    const iconContainer = container.querySelector('.rounded-full.bg-primary\\/10')
    expect(iconContainer).toBeInTheDocument()
  })

  it('0の値を正しく表示する', () => {
    render(<StatCard title="コメント数" value={0} icon={FileText} />)

    expect(screen.getByText('0')).toBeInTheDocument()
  })

  it('大きな数値を表示する', () => {
    render(<StatCard title="閲覧数" value={1000000} icon={TrendingUp} />)

    expect(screen.getByText('1000000')).toBeInTheDocument()
  })
})
