import React from 'react'
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import { render, act, waitFor } from '@testing-library/react'

const mockGetBgAnimationType = vi.fn()
const mockSetBgAnimationType = vi.fn()

vi.mock('@/lib/sakura-petals-pref', () => ({
  getBgAnimationType: () => mockGetBgAnimationType(),
  setBgAnimationType: (t: string) => mockSetBgAnimationType(t),
  BG_ANIMATION_CHANGE_EVENT: 'bg-animation-change',
}))

// canvas API はjsdomで未実装のためスタブ
const mockGradient = { addColorStop: vi.fn() }
const mockGetContext = vi.fn(() => ({
  scale: vi.fn(),
  setTransform: vi.fn(),
  clearRect: vi.fn(),
  fillRect: vi.fn(),
  beginPath: vi.fn(),
  arc: vi.fn(),
  fill: vi.fn(),
  save: vi.fn(),
  restore: vi.fn(),
  translate: vi.fn(),
  rotate: vi.fn(),
  drawImage: vi.fn(),
  createRadialGradient: vi.fn(() => mockGradient),
  createLinearGradient: vi.fn(() => mockGradient),
  ellipse: vi.fn(),
  bezierCurveTo: vi.fn(),
  quadraticCurveTo: vi.fn(),
  closePath: vi.fn(),
  moveTo: vi.fn(),
  lineTo: vi.fn(),
  stroke: vi.fn(),
  fillStyle: '',
  globalAlpha: 1,
  strokeStyle: '',
  lineWidth: 1,
  shadowBlur: 0,
  shadowColor: '',
}))

async function importComponent() {
  const mod = await import('@/components/SakuraAnimation')
  return mod.default
}

describe('SakuraAnimation', () => {
  let originalGetContext: typeof HTMLCanvasElement.prototype.getContext

  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
    mockGetBgAnimationType.mockReturnValue('sakura')
    originalGetContext = HTMLCanvasElement.prototype.getContext
    HTMLCanvasElement.prototype.getContext = mockGetContext as unknown as typeof HTMLCanvasElement.prototype.getContext
    // requestAnimationFrame スタブ
    vi.stubGlobal('requestAnimationFrame', vi.fn(() => 1))
    vi.stubGlobal('cancelAnimationFrame', vi.fn())
  })

  afterEach(() => {
    HTMLCanvasElement.prototype.getContext = originalGetContext
    vi.unstubAllGlobals()
  })

  it('sakura モードのとき canvas が描画される', async () => {
    const SakuraAnimation = await importComponent()
    const { container } = render(<SakuraAnimation />)
    // 初期 state は "none"。useEffect 内の setTimeout(0) で preference (sakura) に切り替わる。
    await waitFor(() => {
      expect(container.querySelector('canvas')).toBeInTheDocument()
    })
    const canvas = container.querySelector('canvas')
    expect(canvas).toHaveAttribute('aria-hidden', 'true')
  })

  it('none モードのとき canvas が描画されない', async () => {
    mockGetBgAnimationType.mockReturnValue('none')
    const SakuraAnimation = await importComponent()
    const { container } = render(<SakuraAnimation />)
    // 初期 animType は 'sakura' で、useEffect 内の setTimeout(0) で 'none' に
    // 切り替わる。waitFor は最終状態まで polling するのでスケジューラ遅延に強い。
    await waitFor(() => {
      expect(container.querySelector('canvas')).not.toBeInTheDocument()
    })
  })

  it('BG_ANIMATION_CHANGE_EVENT で animType が変わる', async () => {
    const SakuraAnimation = await importComponent()
    const { container } = render(<SakuraAnimation />)
    // setTimeout(0) で preference (sakura) に切り替わってから canvas を確認する。
    await waitFor(() => {
      expect(container.querySelector('canvas')).toBeInTheDocument()
    })

    // none に切り替えるイベントを発火
    act(() => {
      window.dispatchEvent(
        new CustomEvent('bg-animation-change', { detail: { type: 'none' } })
      )
    })
    expect(container.querySelector('canvas')).not.toBeInTheDocument()
  })

  it('BG_ANIMATION_CHANGE_EVENT で momiji に切り替えると canvas が表示される', async () => {
    mockGetBgAnimationType.mockReturnValue('none')
    const SakuraAnimation = await importComponent()
    const { container } = render(<SakuraAnimation />)
    // コンポーネント内の setTimeout(0) による初期 animType 同期を完了させる
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0))
    })
    expect(container.querySelector('canvas')).not.toBeInTheDocument()

    await act(async () => {
      window.dispatchEvent(
        new CustomEvent('bg-animation-change', { detail: { type: 'momiji' } })
      )
    })
    expect(container.querySelector('canvas')).toBeInTheDocument()
  })

  it('canvas に fixed クラスが付いている', async () => {
    const SakuraAnimation = await importComponent()
    const { container } = render(<SakuraAnimation />)
    await waitFor(() => {
      expect(container.querySelector('canvas')).toBeInTheDocument()
    })
    const canvas = container.querySelector('canvas')
    expect(canvas?.className).toContain('fixed')
    expect(canvas?.className).toContain('pointer-events-none')
  })

  it('アンマウント時にイベントリスナーが解除される（エラーなし）', async () => {
    const SakuraAnimation = await importComponent()
    const { unmount } = render(<SakuraAnimation />)
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0))
    })
    expect(() => unmount()).not.toThrow()
  })

  it('タブ非表示時にアニメーションが停止される', async () => {
    const SakuraAnimation = await importComponent()
    const { container } = render(<SakuraAnimation />)
    await waitFor(() => {
      expect(container.querySelector('canvas')).toBeInTheDocument()
    })

    // タブ非表示をシミュレート
    Object.defineProperty(document, 'hidden', { value: true, writable: true, configurable: true })
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'))
    })
    expect(cancelAnimationFrame).toHaveBeenCalled()

    // タブ復帰をシミュレート
    Object.defineProperty(document, 'hidden', { value: false, writable: true, configurable: true })
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'))
    })
    expect(requestAnimationFrame).toHaveBeenCalled()
  })

  it('prefers-reduced-motion が有効な場合はアニメーションを開始しない', async () => {
    const originalMatchMedia = window.matchMedia
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: query === '(prefers-reduced-motion: reduce)',
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      onchange: null,
      dispatchEvent: vi.fn(),
    }))

    const SakuraAnimation = await importComponent()
    const { container } = render(<SakuraAnimation />)
    // setTimeout(0) で animType が sakura に切り替わるまで待つ。
    // canvas DOM は描画されるが、effect 内で reduced-motion を検知して早期 return する。
    await waitFor(() => {
      expect(container.querySelector('canvas')).toBeInTheDocument()
    })
    // requestAnimationFrame は呼ばれない (effect 内で reduced-motion 早期 return)。
    expect(requestAnimationFrame).not.toHaveBeenCalled()
    window.matchMedia = originalMatchMedia
  })
})
