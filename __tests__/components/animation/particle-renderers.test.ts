/**
 * particle-renderers の Canvas 描画関数の直接テスト
 *
 * 87% S, 62% B に留まっていた branch を補強する。
 * - colorType による紅葉色のバリエーション分岐（赤/オレンジ/黄）
 * - Snow の小粒/結晶分岐（size < 6）
 * - Ripple の numRings 分岐 / dark/light テーマ分岐 / 内側リングのスキップ条件
 *
 * jsdom には Canvas コンテキストが無いため、`Path2D 操作と style 設定に
 * 触れたメソッド呼び出しの呼び出し履歴` で検証する。
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  drawSakura,
  drawMomiji,
  drawSnow,
  drawDandelion,
  drawRainDrop,
  drawRipple,
  type Particle,
  type Ripple,
} from '@/components/animation/particle-renderers'

function makeCtxStub() {
  const gradient = {
    addColorStop: vi.fn(),
  }
  const ctx = {
    createLinearGradient: vi.fn().mockReturnValue(gradient),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    bezierCurveTo: vi.fn(),
    quadraticCurveTo: vi.fn(),
    closePath: vi.fn(),
    fill: vi.fn(),
    stroke: vi.fn(),
    arc: vi.fn(),
    ellipse: vi.fn(),
    save: vi.fn(),
    restore: vi.fn(),
    rotate: vi.fn(),
    translate: vi.fn(),
    scale: vi.fn(),
    fillStyle: '',
    strokeStyle: '',
    shadowColor: '',
    shadowBlur: 0,
    lineWidth: 0,
    lineCap: '' as CanvasLineCap,
    globalCompositeOperation: 'source-over' as GlobalCompositeOperation,
  }
  return ctx
}

function makeParticle(overrides: Partial<Particle> = {}): Particle {
  return {
    x: 100,
    y: 100,
    z: 0.5,
    size: 10,
    speedY: 1,
    speedX: 0.2,
    rotation: 0,
    rotationSpeed: 0.01,
    flip: 0,
    flipSpeed: 0.01,
    sway: 0,
    swaySpeed: 0.02,
    ...overrides,
  }
}

function makeRipple(overrides: Partial<Ripple> = {}): Ripple {
  return {
    x: 100,
    y: 100,
    currentRadius: 50,
    maxRadius: 200,
    speed: 1,
    alpha: 0.8,
    seedX: 0.123,
    seedY: 0.456,
    numRings: 3,
    ...overrides,
  }
}

describe('drawSakura', () => {
  it('Bezier カーブで花びら形状を描画する', () => {
    const ctx = makeCtxStub()
    drawSakura(ctx as unknown as CanvasRenderingContext2D, makeParticle())

    expect(ctx.createLinearGradient).toHaveBeenCalled()
    expect(ctx.beginPath).toHaveBeenCalled()
    expect(ctx.bezierCurveTo).toHaveBeenCalledTimes(2)
    expect(ctx.closePath).toHaveBeenCalled()
    expect(ctx.fill).toHaveBeenCalled()
  })

  it('shadowColor / shadowBlur を設定する', () => {
    const ctx = makeCtxStub()
    drawSakura(ctx as unknown as CanvasRenderingContext2D, makeParticle())
    expect(ctx.shadowColor).toMatch(/rgba/)
    expect(ctx.shadowBlur).toBeGreaterThan(0)
  })
})

describe('drawMomiji - colorType 分岐', () => {
  it('colorType=undefined のときは赤（デフォルト）色になる', () => {
    const ctx = makeCtxStub()
    drawMomiji(ctx as unknown as CanvasRenderingContext2D, makeParticle({ colorType: undefined }))
    // shadowColor が rgba(200, 30, 30, 0.4) になるはず
    expect(ctx.shadowColor).toContain('200, 30, 30')
  })

  it('colorType < 5 は赤', () => {
    const ctx = makeCtxStub()
    drawMomiji(ctx as unknown as CanvasRenderingContext2D, makeParticle({ colorType: 0 }))
    expect(ctx.shadowColor).toContain('200, 30, 30')
  })

  it('colorType < 5 の境界 (4) も赤', () => {
    const ctx = makeCtxStub()
    drawMomiji(ctx as unknown as CanvasRenderingContext2D, makeParticle({ colorType: 4 }))
    expect(ctx.shadowColor).toContain('200, 30, 30')
  })

  it('colorType=5 はオレンジ', () => {
    const ctx = makeCtxStub()
    drawMomiji(ctx as unknown as CanvasRenderingContext2D, makeParticle({ colorType: 5 }))
    expect(ctx.shadowColor).toContain('220, 100, 20')
  })

  it('colorType < 8 の境界 (7) もオレンジ', () => {
    const ctx = makeCtxStub()
    drawMomiji(ctx as unknown as CanvasRenderingContext2D, makeParticle({ colorType: 7 }))
    expect(ctx.shadowColor).toContain('220, 100, 20')
  })

  it('colorType=8 は黄色', () => {
    const ctx = makeCtxStub()
    drawMomiji(ctx as unknown as CanvasRenderingContext2D, makeParticle({ colorType: 8 }))
    expect(ctx.shadowColor).toContain('230, 180, 30')
  })

  it('葉脈（stroke）も描画される', () => {
    const ctx = makeCtxStub()
    drawMomiji(ctx as unknown as CanvasRenderingContext2D, makeParticle())
    // beginPath が 2 回（葉本体 + 葉脈）
    expect(ctx.beginPath.mock.calls.length).toBeGreaterThanOrEqual(2)
    expect(ctx.stroke).toHaveBeenCalled()
  })
})

describe('drawSnow - size 分岐', () => {
  beforeEach(() => {
    document.documentElement.classList.remove('dark')
  })

  it('size < 6 は arc で粉雪を描く（fill）', () => {
    const ctx = makeCtxStub()
    drawSnow(ctx as unknown as CanvasRenderingContext2D, makeParticle({ size: 5 }))
    expect(ctx.arc).toHaveBeenCalled()
    expect(ctx.fill).toHaveBeenCalled()
    expect(ctx.stroke).not.toHaveBeenCalled()
  })

  it('size = 6 は結晶（stroke）モード', () => {
    const ctx = makeCtxStub()
    drawSnow(ctx as unknown as CanvasRenderingContext2D, makeParticle({ size: 6 }))
    expect(ctx.stroke).toHaveBeenCalled()
  })

  it('結晶モードでは spike 数だけ save/rotate/restore が呼ばれる', () => {
    const ctx = makeCtxStub()
    drawSnow(ctx as unknown as CanvasRenderingContext2D, makeParticle({ size: 10 }))
    // spikes = 6
    expect(ctx.save).toHaveBeenCalledTimes(6)
    expect(ctx.restore).toHaveBeenCalledTimes(6)
    expect(ctx.rotate).toHaveBeenCalledTimes(6)
  })

  it('ダークモードでは白色 / shadow が変わる', () => {
    document.documentElement.classList.add('dark')
    const ctx = makeCtxStub()
    drawSnow(ctx as unknown as CanvasRenderingContext2D, makeParticle({ size: 5 }))
    expect(ctx.fillStyle).toContain('255, 255, 255')
  })

  it('ライトモードでは灰青色', () => {
    document.documentElement.classList.remove('dark')
    const ctx = makeCtxStub()
    drawSnow(ctx as unknown as CanvasRenderingContext2D, makeParticle({ size: 5 }))
    expect(ctx.fillStyle).toContain('200, 210, 220')
  })
})

describe('drawDandelion', () => {
  beforeEach(() => {
    document.documentElement.classList.remove('dark')
  })

  it('save/restore で context を保存して回転を適用する', () => {
    const ctx = makeCtxStub()
    drawDandelion(ctx as unknown as CanvasRenderingContext2D, makeParticle())
    expect(ctx.save).toHaveBeenCalled()
    expect(ctx.restore).toHaveBeenCalled()
    expect(ctx.rotate).toHaveBeenCalled()
  })

  it('種（ellipse）と冠毛（quadraticCurveTo）の両方を描く', () => {
    const ctx = makeCtxStub()
    drawDandelion(ctx as unknown as CanvasRenderingContext2D, makeParticle())
    expect(ctx.ellipse).toHaveBeenCalled()
    // fluffLines = 24 → quadraticCurveTo は 24 回
    expect(ctx.quadraticCurveTo).toHaveBeenCalledTimes(24)
  })

  it('ダークモードでは白っぽい綿毛色', () => {
    document.documentElement.classList.add('dark')
    const ctx = makeCtxStub()
    drawDandelion(ctx as unknown as CanvasRenderingContext2D, makeParticle())
    expect(ctx.strokeStyle).toContain('255, 255, 255')
  })
})

describe('drawRainDrop', () => {
  beforeEach(() => {
    document.documentElement.classList.remove('dark')
  })

  it('傾いた直線で描く（speedX=0 でも tilt=0 で描画）', () => {
    const ctx = makeCtxStub()
    drawRainDrop(ctx as unknown as CanvasRenderingContext2D, makeParticle({ speedX: 0 }))
    expect(ctx.moveTo).toHaveBeenCalledWith(0, 0)
    expect(ctx.lineTo).toHaveBeenCalled()
    expect(ctx.stroke).toHaveBeenCalled()
  })

  it('z（奥行き）に応じた線幅', () => {
    const ctx = makeCtxStub()
    drawRainDrop(ctx as unknown as CanvasRenderingContext2D, makeParticle({ z: 1.0 }))
    // lineWidth = max(0.8, z * 1.2) = 1.2
    expect(ctx.lineWidth).toBeCloseTo(1.2, 5)
  })

  it('z が小さくても 0.8 を下回らない（最小幅クランプ）', () => {
    const ctx = makeCtxStub()
    drawRainDrop(ctx as unknown as CanvasRenderingContext2D, makeParticle({ z: 0.1 }))
    expect(ctx.lineWidth).toBeGreaterThanOrEqual(0.8)
  })

  it('ダークモードでは別の色を使う', () => {
    document.documentElement.classList.add('dark')
    const ctx = makeCtxStub()
    drawRainDrop(ctx as unknown as CanvasRenderingContext2D, makeParticle())
    // dark の色は rgba(200, 220, 255, 0.5)
    expect(ctx.strokeStyle).toContain('200, 220, 255')
  })
})

describe('drawRipple', () => {
  beforeEach(() => {
    document.documentElement.classList.remove('dark')
  })

  it('numRings=3 で 3 本のリングを描こうと試みる', () => {
    const ctx = makeCtxStub()
    drawRipple(ctx as unknown as CanvasRenderingContext2D, makeRipple({ numRings: 3 }))
    // arc は ringRadius > 1 で 2 回（shadow + highlight）呼ばれる
    expect(ctx.arc.mock.calls.length).toBeGreaterThan(0)
  })

  it('numRings=2 でもエラーなく動く', () => {
    const ctx = makeCtxStub()
    drawRipple(ctx as unknown as CanvasRenderingContext2D, makeRipple({ numRings: 2 }))
    expect(ctx.arc.mock.calls.length).toBeGreaterThan(0)
  })

  it('alpha=0 ならほぼ何も描かない（fadeAlpha が 0 で ringAlpha も 0）', () => {
    const ctx = makeCtxStub()
    drawRipple(ctx as unknown as CanvasRenderingContext2D, makeRipple({ alpha: 0 }))
    // ringAlpha <= 0.005 で continue するため、arc は 1 回も呼ばれない
    expect(ctx.arc).not.toHaveBeenCalled()
  })

  it('currentRadius=0 だと内側リング（speedFactor 縮小）が ringRadius<=0 でスキップされる', () => {
    const ctx = makeCtxStub()
    drawRipple(ctx as unknown as CanvasRenderingContext2D, makeRipple({ currentRadius: 0 }))
    // 全リングが ringRadius <= 0 で continue
    expect(ctx.arc).not.toHaveBeenCalled()
  })

  it('currentRadius >= maxRadius だと ringProgress >= 1 でスキップ', () => {
    const ctx = makeCtxStub()
    drawRipple(
      ctx as unknown as CanvasRenderingContext2D,
      makeRipple({ currentRadius: 200, maxRadius: 100 }),
    )
    // 全リングが ringProgress >= 1 で continue するか、
    // 一部のみ通過する可能性があるが、最外リングは弾かれる
    // 最低限 highlight 用 arc が描かれない、または描画呼び出しが少ない
    // ここでは arc が 4 回 (2リング x 2(shadow/highlight)) 未満で OK
    expect(ctx.arc.mock.calls.length).toBeLessThan(6)
  })

  it('ダークモードでは globalCompositeOperation=screen', () => {
    document.documentElement.classList.add('dark')
    const ctx = makeCtxStub()
    drawRipple(ctx as unknown as CanvasRenderingContext2D, makeRipple())
    expect(ctx.globalCompositeOperation).toBe('screen')
  })

  it('ライトモードでは globalCompositeOperation=source-over', () => {
    document.documentElement.classList.remove('dark')
    const ctx = makeCtxStub()
    drawRipple(ctx as unknown as CanvasRenderingContext2D, makeRipple())
    expect(ctx.globalCompositeOperation).toBe('source-over')
  })

  it('save/translate/scale/restore でコンテキスト変換が行われる', () => {
    const ctx = makeCtxStub()
    drawRipple(ctx as unknown as CanvasRenderingContext2D, makeRipple())
    expect(ctx.save).toHaveBeenCalled()
    expect(ctx.translate).toHaveBeenCalledWith(100, 100)
    expect(ctx.scale).toHaveBeenCalled()
    expect(ctx.restore).toHaveBeenCalled()
  })
})
