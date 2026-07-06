import { describe, it, expect } from 'vitest'
import { renderToString } from 'react-dom/server'
import { AnimatedInkImage } from '@/components/landing/AnimatedInkImage'
import type { LandingFrameSet } from '@/lib/constants/landing-animation'

/**
 * useSyncExternalStore の getServerSnapshot 分岐 (SSR 専用) は、通常の client render
 * (createRoot) では決して呼ばれない (React は SSR パスでのみ getServerSnapshot を使う)。
 * renderToString で実際に SSR を実行し、本番で唯一到達するこの分岐を検証する。
 */

const frames: LandingFrameSet = {
  lightDesktop: ['/light-desktop-1.webp', '/light-desktop-2.webp'],
}

describe('AnimatedInkImage (SSR string render)', () => {
  it('renderToString でクラッシュせず、SSR 用の getServerSnapshot 経路を通る', () => {
    const html = renderToString(<AnimatedInkImage frames={frames} alt="SSR test" />)
    expect(typeof html).toBe('string')
  })
})
