import { render, screen } from '@testing-library/react'
import { EffectRatingBadge } from '@/components/pesticide/EffectRatingBadge'

describe('EffectRatingBadge', () => {
  it('ratingがnullのときは「—」を表示する', () => {
    render(<EffectRatingBadge rating={null} />)
    expect(screen.getByText('—')).toBeInTheDocument()
  })

  it('ratingがundefinedのときは「—」を表示する', () => {
    render(<EffectRatingBadge rating={undefined} />)
    expect(screen.getByText('—')).toBeInTheDocument()
  })

  it('excellentのとき◎を表示する', () => {
    render(<EffectRatingBadge rating="excellent" />)
    expect(screen.getByText('◎')).toBeInTheDocument()
  })

  it('goodのとき○を表示する', () => {
    render(<EffectRatingBadge rating="good" />)
    expect(screen.getByText('○')).toBeInTheDocument()
  })

  it('fairのとき△を表示する', () => {
    render(<EffectRatingBadge rating="fair" />)
    expect(screen.getByText('△')).toBeInTheDocument()
  })

  it('poorのとき×を表示する', () => {
    render(<EffectRatingBadge rating="poor" />)
    expect(screen.getByText('×')).toBeInTheDocument()
  })

  it('labelを渡すとラベルと記号の両方を表示する', () => {
    render(<EffectRatingBadge rating="good" label="予防" />)
    expect(screen.getByText('予防')).toBeInTheDocument()
    expect(screen.getByText('○')).toBeInTheDocument()
  })
})
