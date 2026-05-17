import { vi, describe, it, expect } from 'vitest'
import { render, screen } from '../../utils/test-utils'

const inViewState = { current: false }
vi.mock('react-intersection-observer', () => ({
  useInView: () => ({ ref: vi.fn(), inView: inViewState.current }),
}))

import { SumiStrokeReveal } from '@/components/landing/SumiStrokeReveal'

describe('SumiStrokeReveal', () => {
  beforeEach(() => {
    // reset to "out of view" before each case
    inViewState.current = false
  })
  it('childrenをレンダリングする', () => {
    render(
      <SumiStrokeReveal>
        <p>テストコンテンツ</p>
      </SumiStrokeReveal>
    )
    expect(screen.getByText('テストコンテンツ')).toBeInTheDocument()
  })

  it('SVGストロークを含む', () => {
    const { container } = render(
      <SumiStrokeReveal>
        <p>テスト</p>
      </SumiStrokeReveal>
    )
    const svg = container.querySelector('svg')
    expect(svg).toBeInTheDocument()
    expect(svg?.querySelector('path')).toBeInTheDocument()
  })

  it('初期状態でopacity-0クラスを持つ（画面外）', () => {
    const { container } = render(
      <SumiStrokeReveal>
        <p>テスト</p>
      </SumiStrokeReveal>
    )
    expect(container.firstChild).toHaveClass('opacity-0')
  })

  it('stroke-dashoffsetのtransitionクラスが設定されている', () => {
    const { container } = render(
      <SumiStrokeReveal>
        <p>テスト</p>
      </SumiStrokeReveal>
    )
    const path = container.querySelector('path')
    expect(path?.getAttribute('class')).toContain('transition-')
  })

  it('SVGパスにstroke-dasharrayが設定されている', () => {
    const { container } = render(
      <SumiStrokeReveal>
        <p>テスト</p>
      </SumiStrokeReveal>
    )
    const path = container.querySelector('path')
    expect(path).toHaveAttribute('stroke-dasharray', '900')
  })

  it('inView=true の時は opacity-100 / translate-y-0 / stroke-dashoffset:0 にスイッチする', () => {
    inViewState.current = true
    const { container } = render(
      <SumiStrokeReveal>
        <p>テスト</p>
      </SumiStrokeReveal>,
    )
    const root = container.firstChild as HTMLElement
    expect(root.className).toContain('opacity-100')
    expect(root.className).toContain('translate-y-0')
    expect(root.className).not.toContain('opacity-0')
    const path = container.querySelector('path')
    expect(path?.getAttribute('class')).toContain('[stroke-dashoffset:0]')
  })

  it('inView=false の時は translate-y-6 / stroke-dashoffset:900 を維持する', () => {
    inViewState.current = false
    const { container } = render(
      <SumiStrokeReveal>
        <p>テスト</p>
      </SumiStrokeReveal>,
    )
    const root = container.firstChild as HTMLElement
    expect(root.className).toContain('opacity-0')
    expect(root.className).toContain('translate-y-6')
    const path = container.querySelector('path')
    expect(path?.getAttribute('class')).toContain('[stroke-dashoffset:900]')
  })
})
