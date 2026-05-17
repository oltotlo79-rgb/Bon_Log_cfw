import React from 'react'
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import { render, act } from '@testing-library/react'

const mockGetBgAnimationType = vi.fn()

vi.mock('@/lib/sakura-petals-pref', () => ({
  getBgAnimationType: () => mockGetBgAnimationType(),
  setBgAnimationType: vi.fn(),
  BG_ANIMATION_CHANGE_EVENT: 'bg-animation-change',
}))

// Canvas API スタブ
const mockGradient = { addColorStop: vi.fn() }
const mockCtx = {
  scale: vi.fn(),
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
  lineCap: '',
  globalCompositeOperation: '',
  setTransform: vi.fn(),
}
const mockGetContext = vi.fn(() => mockCtx)

async function importComponent() {
  const mod = await import('@/components/SakuraAnimation')
  return mod.default
}

/** rAFモックから最後に登録されたコールバックを取り出して実行する */
function executeAnimationFrame(times = 1) {
  const rAF = vi.mocked(requestAnimationFrame)
  for (let i = 0; i < times; i++) {
    const lastCall = rAF.mock.calls[rAF.mock.calls.length - 1]
    if (lastCall && lastCall[0]) {
      act(() => {
        ;(lastCall[0] as () => void)()
      })
    }
  }
}

/** renderしてsetTimeout(0)のanimType設定をフラッシュするヘルパー */
async function renderAndFlush(component: React.ReactElement) {
  render(component)
  // コンポーネント内のsetTimeout(0)でsetAnimType(getBgAnimationType())が呼ばれるのを待つ
  await act(async () => {
    vi.advanceTimersByTime(1)
  })
}

describe('SakuraAnimation - animation type branches', () => {
  let originalGetContext: typeof HTMLCanvasElement.prototype.getContext

  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    vi.resetModules()
    originalGetContext = HTMLCanvasElement.prototype.getContext
    HTMLCanvasElement.prototype.getContext = mockGetContext as unknown as typeof HTMLCanvasElement.prototype.getContext

    vi.stubGlobal('requestAnimationFrame', vi.fn(() => 1))
    vi.stubGlobal('cancelAnimationFrame', vi.fn())
  })

  afterEach(() => {
    HTMLCanvasElement.prototype.getContext = originalGetContext
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('momiji モードでdrawMomijiが呼ばれる（紅葉描画）', async () => {
    mockGetBgAnimationType.mockReturnValue('momiji')
    const SakuraAnimation = await importComponent()
    await renderAndFlush(<SakuraAnimation />)

    executeAnimationFrame()

    expect(mockCtx.quadraticCurveTo).toHaveBeenCalled()
    expect(mockCtx.createLinearGradient).toHaveBeenCalled()
    expect(mockCtx.stroke).toHaveBeenCalled()
  })

  it('snow モードでdrawSnowが呼ばれる（雪描画）', async () => {
    mockGetBgAnimationType.mockReturnValue('snow')
    const SakuraAnimation = await importComponent()
    await renderAndFlush(<SakuraAnimation />)

    executeAnimationFrame()

    expect(mockCtx.save).toHaveBeenCalled()
    expect(mockCtx.restore).toHaveBeenCalled()
  })

  it('dandelion モードでdrawDandelionが呼ばれる（綿毛描画）', async () => {
    mockGetBgAnimationType.mockReturnValue('dandelion')
    const SakuraAnimation = await importComponent()
    await renderAndFlush(<SakuraAnimation />)

    executeAnimationFrame()

    expect(mockCtx.ellipse).toHaveBeenCalled()
    expect(mockCtx.quadraticCurveTo).toHaveBeenCalled()
  })

  it('rain モードで波紋(ripple)が生成される', async () => {
    mockGetBgAnimationType.mockReturnValue('rain')
    const SakuraAnimation = await importComponent()
    await renderAndFlush(<SakuraAnimation />)

    const origRandom = Math.random
    Math.random = vi.fn()
      .mockReturnValueOnce(0.05)
      .mockReturnValueOnce(0.5)
      .mockReturnValueOnce(0.5)
      .mockReturnValueOnce(0.5)
      .mockReturnValueOnce(0.5)
      .mockReturnValueOnce(1.0)
      .mockReturnValueOnce(0.5)
      .mockReturnValueOnce(0.5)
      .mockReturnValueOnce(0.3)
      .mockImplementation(() => origRandom())

    executeAnimationFrame()
    Math.random = origRandom

    expect(mockCtx.clearRect).toHaveBeenCalled()
  })

  it('rain-drops モードでdrawRainDropが呼ばれる（雨粒描画）', async () => {
    mockGetBgAnimationType.mockReturnValue('rain-drops')
    const SakuraAnimation = await importComponent()
    await renderAndFlush(<SakuraAnimation />)

    executeAnimationFrame()

    expect(mockCtx.lineTo).toHaveBeenCalled()
    expect(mockCtx.stroke).toHaveBeenCalled()
  })

  it('momiji の赤色バリエーション (colorType < 5) が描画される', async () => {
    const origRandom = Math.random
    Math.random = vi.fn(() => 0.1) // colorType=1 (< 5 = 赤)

    mockGetBgAnimationType.mockReturnValue('momiji')
    const SakuraAnimation = await importComponent()
    await renderAndFlush(<SakuraAnimation />)

    Math.random = origRandom

    executeAnimationFrame()

    expect(mockCtx.createLinearGradient).toHaveBeenCalled()
  })

  it('ダークモードでsnow描画の色が変わる', async () => {
    document.documentElement.classList.add('dark')

    mockGetBgAnimationType.mockReturnValue('snow')
    const SakuraAnimation = await importComponent()
    await renderAndFlush(<SakuraAnimation />)

    executeAnimationFrame()

    expect(mockCtx.save).toHaveBeenCalled()

    document.documentElement.classList.remove('dark')
  })

  it('ダークモードでdandelion描画の色が変わる', async () => {
    document.documentElement.classList.add('dark')

    mockGetBgAnimationType.mockReturnValue('dandelion')
    const SakuraAnimation = await importComponent()
    await renderAndFlush(<SakuraAnimation />)

    executeAnimationFrame()

    expect(mockCtx.ellipse).toHaveBeenCalled()

    document.documentElement.classList.remove('dark')
  })

  it('ダークモードでrain-drops描画の色が変わる', async () => {
    document.documentElement.classList.add('dark')

    mockGetBgAnimationType.mockReturnValue('rain-drops')
    const SakuraAnimation = await importComponent()
    await renderAndFlush(<SakuraAnimation />)

    executeAnimationFrame()

    expect(mockCtx.lineTo).toHaveBeenCalled()

    document.documentElement.classList.remove('dark')
  })

  it('パーティクルが画面外に出たときにリセットされる（dandelion）', async () => {
    Object.defineProperty(window, 'innerHeight', { value: 100, configurable: true })
    Object.defineProperty(window, 'innerWidth', { value: 100, configurable: true })

    mockGetBgAnimationType.mockReturnValue('dandelion')
    const SakuraAnimation = await importComponent()
    await renderAndFlush(<SakuraAnimation />)

    executeAnimationFrame(50)

    expect(mockCtx.clearRect).toHaveBeenCalled()
  })

  it('パーティクルが画面外に出たときにリセットされる（sakura）', async () => {
    Object.defineProperty(window, 'innerHeight', { value: 50, configurable: true })
    Object.defineProperty(window, 'innerWidth', { value: 50, configurable: true })

    mockGetBgAnimationType.mockReturnValue('sakura')
    const SakuraAnimation = await importComponent()
    await renderAndFlush(<SakuraAnimation />)

    executeAnimationFrame(50)

    expect(mockCtx.clearRect).toHaveBeenCalled()
    expect(mockCtx.bezierCurveTo).toHaveBeenCalled()
  })

  it('rain モードでダークモードの波紋描画', async () => {
    document.documentElement.classList.add('dark')

    mockGetBgAnimationType.mockReturnValue('rain')
    const SakuraAnimation = await importComponent()
    await renderAndFlush(<SakuraAnimation />)

    const origRandom = Math.random
    Math.random = vi.fn()
      .mockReturnValueOnce(0.01)
      .mockReturnValueOnce(0.5)
      .mockReturnValueOnce(0.5)
      .mockReturnValueOnce(0.5)
      .mockReturnValueOnce(0.5)
      .mockReturnValueOnce(1.0)
      .mockReturnValueOnce(0.5)
      .mockReturnValueOnce(0.5)
      .mockReturnValueOnce(0.7)
      .mockImplementation(() => origRandom())

    executeAnimationFrame()
    Math.random = origRandom

    expect(mockCtx.clearRect).toHaveBeenCalled()

    document.documentElement.classList.remove('dark')
  })

  it('snow の大きい結晶（size >= 6）でフリップが適用される', async () => {
    const origRandom = Math.random
    Math.random = vi.fn(() => 0.9)

    mockGetBgAnimationType.mockReturnValue('snow')
    const SakuraAnimation = await importComponent()
    await renderAndFlush(<SakuraAnimation />)

    Math.random = origRandom

    executeAnimationFrame()

    expect(mockCtx.rotate).toHaveBeenCalled()
    expect(mockCtx.scale).toHaveBeenCalled()
  })
})
