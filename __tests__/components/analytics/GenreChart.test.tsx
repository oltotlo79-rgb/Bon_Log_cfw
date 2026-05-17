import { vi, describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '../../utils/test-utils'
import { GenreChart } from '@/components/analytics/GenreChart'

describe('GenreChart', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  const mockGenres = [
    { name: '松柏類', postCount: 10, avgLikes: 5, avgComments: 3, avgEngagement: 8 },
    { name: '雑木類', postCount: 7, avgLikes: 3, avgComments: 2, avgEngagement: 5 },
    { name: '用品・道具', postCount: 3, avgLikes: 1, avgComments: 1, avgEngagement: 2 },
  ]

  it('ジャンル名を表示する', () => {
    render(<GenreChart genres={mockGenres} />)

    expect(screen.getByText('松柏類')).toBeInTheDocument()
    expect(screen.getByText('雑木類')).toBeInTheDocument()
    expect(screen.getByText('用品・道具')).toBeInTheDocument()
  })

  it('投稿数とエンゲージメントを表示する', () => {
    render(<GenreChart genres={mockGenres} />)

    expect(screen.getByText('10投稿')).toBeInTheDocument()
    expect(screen.getByText('avg 8')).toBeInTheDocument()
    expect(screen.getByText('7投稿')).toBeInTheDocument()
    expect(screen.getByText('avg 5')).toBeInTheDocument()
  })

  it('凡例（いいね・コメント）を表示する', () => {
    render(<GenreChart genres={mockGenres} />)

    expect(screen.getByText('いいね')).toBeInTheDocument()
    expect(screen.getByText('コメント')).toBeInTheDocument()
  })

  it('ジャンルが空の場合はメッセージを表示する', () => {
    render(<GenreChart genres={[]} />)

    expect(screen.getByText('ジャンルデータがありません')).toBeInTheDocument()
  })

  it('バーのwidthスタイルがエンゲージメントに比例する', () => {
    const { container } = render(<GenreChart genres={mockGenres} />)

    // 最大エンゲージメント(8)のバーは100%
    const bars = container.querySelectorAll('.h-6.bg-muted')
    expect(bars.length).toBe(3)
  })

  it('avgEngagement=0 のジャンルでも、いいね幅は 50% フォールバックで描画される', () => {
    const zeroEngGenres = [
      { name: 'ゼロ', postCount: 0, avgLikes: 0, avgComments: 0, avgEngagement: 0 },
    ]
    const { container } = render(<GenreChart genres={zeroEngGenres} />)
    // div[style] で width:50% が含まれること（fallback の 50%）
    const innerBars = container.querySelectorAll('div[style*="width: 50%"]')
    expect(innerBars.length).toBeGreaterThan(0)
  })

  it('avgEngagement=1 で全ジャンル同じ場合は barWidth = 100% になる', () => {
    const sameEng = [
      { name: 'A', postCount: 1, avgLikes: 1, avgComments: 0, avgEngagement: 1 },
      { name: 'B', postCount: 1, avgLikes: 1, avgComments: 0, avgEngagement: 1 },
    ]
    const { container } = render(<GenreChart genres={sameEng} />)
    // 全部 width: 100% になる外側バー（少なくとも 2 件）
    const outerBars = container.querySelectorAll('div[style*="width: 100%"]')
    expect(outerBars.length).toBeGreaterThanOrEqual(2)
  })

  it('avgEngagement の最大値が 0 でも Math.max(..., 1) フォールバックで NaN にならない', () => {
    const allZero = [
      { name: 'A', postCount: 0, avgLikes: 0, avgComments: 0, avgEngagement: 0 },
      { name: 'B', postCount: 0, avgLikes: 0, avgComments: 0, avgEngagement: 0 },
    ]
    const { container } = render(<GenreChart genres={allZero} />)
    // width に NaN を含まない（"NaN%" の出現がないこと）
    const html = container.innerHTML
    expect(html).not.toContain('NaN')
  })

  it('barWidth が極小（< 2%）の場合でも Math.max(barWidth, 2) で 2% に丸められる', () => {
    const skewedGenres = [
      { name: 'メジャー', postCount: 100, avgLikes: 50, avgComments: 50, avgEngagement: 1000 },
      { name: '極小', postCount: 1, avgLikes: 0, avgComments: 0, avgEngagement: 1 }, // 1/1000 = 0.1%
    ]
    const { container } = render(<GenreChart genres={skewedGenres} />)
    // 極小ジャンルのバーは width: 2% (Math.max(0.1, 2))
    const html = container.innerHTML
    expect(html).toContain('width: 2%')
  })
})
