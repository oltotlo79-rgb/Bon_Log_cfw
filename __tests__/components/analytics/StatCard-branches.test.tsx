/**
 * StatCard.tsx ブランチカバレッジ向上テスト
 *
 * 対象ブランチ:
 * - change: undefined / null / 正の数 / 負の数 / 0
 * - description: あり / なし
 * - value: number / string
 */

import { vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { StatCard } from '@/components/analytics/StatCard'

vi.mock('lucide-react', () => {
  const Icon = (props: Record<string, unknown>) => <div data-testid="icon" {...props} />
  Icon.displayName = 'MockIcon'
  return {
    TrendingUp: Icon,
    TrendingDown: Icon,
    FileText: Icon,
  }
})

const FileText = vi.fn((props: Record<string, unknown>) => <div data-testid="icon" {...props} />) as unknown as import('lucide-react').LucideIcon

describe('StatCard - ブランチカバレッジ', () => {
  it('基本表示: タイトルと数値を表示する', () => {
    render(<StatCard title="投稿数" value={123} icon={FileText} />)
    expect(screen.getByText('投稿数')).toBeInTheDocument()
    expect(screen.getByText('123')).toBeInTheDocument()
  })

  it('文字列valueを表示する', () => {
    render(<StatCard title="平均" value="4.5" icon={FileText} />)
    expect(screen.getByText('4.5')).toBeInTheDocument()
  })

  it('descriptionが指定されている場合に表示する', () => {
    render(<StatCard title="投稿数" value={100} icon={FileText} description="前月比 +12%" />)
    expect(screen.getByText('前月比 +12%')).toBeInTheDocument()
  })

  it('descriptionがない場合は説明文を表示しない', () => {
    const { container } = render(<StatCard title="投稿数" value={100} icon={FileText} />)
    const descriptions = container.querySelectorAll('.text-xs.text-muted-foreground')
    // タイトルの1つだけ（description分はなし）
    expect(descriptions.length).toBe(1)
  })

  it('change > 0 の場合に緑色で+付き表示', () => {
    render(<StatCard title="投稿数" value={100} icon={FileText} change={12} />)
    expect(screen.getByText('+12%')).toBeInTheDocument()
    expect(screen.getByText('+12%').className).toContain('text-green')
  })

  it('change < 0 の場合に赤色で表示', () => {
    render(<StatCard title="投稿数" value={100} icon={FileText} change={-5} />)
    expect(screen.getByText('-5%')).toBeInTheDocument()
    expect(screen.getByText('-5%').className).toContain('text-red')
  })

  it('change === 0 の場合にmuted色で表示', () => {
    render(<StatCard title="投稿数" value={100} icon={FileText} change={0} />)
    expect(screen.getByText('0%')).toBeInTheDocument()
    expect(screen.getByText('0%').className).toContain('text-muted-foreground')
  })

  it('change === null の場合は変化率を表示しない', () => {
    render(<StatCard title="投稿数" value={100} icon={FileText} change={null} />)
    expect(screen.queryByText(/%/)).not.toBeInTheDocument()
  })

  it('change === undefined の場合は変化率を表示しない', () => {
    render(<StatCard title="投稿数" value={100} icon={FileText} />)
    expect(screen.queryByText(/%/)).not.toBeInTheDocument()
  })
})
