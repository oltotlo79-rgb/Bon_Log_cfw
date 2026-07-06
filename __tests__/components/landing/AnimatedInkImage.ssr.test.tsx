import { vi, describe, it, expect } from 'vitest'
import { render } from '../../utils/test-utils'
import { AnimatedInkImage } from '@/components/landing/AnimatedInkImage'
import type { LandingFrameSet } from '@/lib/constants/landing-animation'

/**
 * useIsClient は通常の client render では hydration 前でも true を返してしまい、
 * SSR プレースホルダ分岐 (`!mounted`) をテスト環境から再現できない。
 * 本番では実際に SSR 時に到達する分岐のため、共有 hook をモックして再現する。
 */
vi.mock('@/hooks/use-is-client', () => ({
  useIsClient: () => false,
}))

const frames: LandingFrameSet = {
  lightDesktop: ['/light-desktop-1.webp', '/light-desktop-2.webp'],
}

describe('AnimatedInkImage (SSR placeholder)', () => {
  it('mounted前は画像を描画せず、aria-hidden なプレースホルダのみ表示する', () => {
    const { container } = render(
      <AnimatedInkImage frames={frames} alt="盆栽" className="placeholder-class" />
    )
    expect(container.querySelectorAll('img')).toHaveLength(0)
    const wrapper = container.firstChild as HTMLElement
    expect(wrapper).toHaveAttribute('aria-hidden', 'true')
    expect(wrapper).toHaveClass('placeholder-class')
  })

  it('fill=false の場合、プレースホルダにも position/width/height の inline style が設定される', () => {
    const { container } = render(
      <AnimatedInkImage frames={frames} alt="盆栽" fill={false} width={120} height={80} />
    )
    const wrapper = container.firstChild as HTMLElement
    expect(wrapper).toHaveStyle({ position: 'relative', width: '120px', height: '80px' })
  })
})
