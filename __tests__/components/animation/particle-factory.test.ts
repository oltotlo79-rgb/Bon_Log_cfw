import { describe, it, expect, beforeEach } from 'vitest'
import { createParticle } from '@/components/animation/particle-factory'
import type { AnimationType } from '@/lib/sakura-petals-pref'

describe('createParticle', () => {
  beforeEach(() => {
    Object.defineProperty(window, 'innerWidth', { value: 1920, writable: true })
    Object.defineProperty(window, 'innerHeight', { value: 1080, writable: true })
  })

  const allProperties = [
    'x', 'y', 'z', 'size', 'speedY', 'speedX',
    'rotation', 'rotationSpeed', 'flip', 'flipSpeed',
    'sway', 'swaySpeed', 'colorType',
  ] as const

  it('全てのParticleプロパティが存在する', () => {
    const particle = createParticle('sakura')
    for (const prop of allProperties) {
      expect(particle).toHaveProperty(prop)
      expect(typeof particle[prop]).toBe('number')
    }
  })

  describe('isInitial=true の場合、ビューポート内に配置される', () => {
    const types: AnimationType[] = ['sakura', 'snow', 'dandelion', 'momiji']

    it.each(types)('%s: y座標がビューポート内 (0 ~ innerHeight)', (type) => {
      // 複数回テストして範囲を確認
      for (let i = 0; i < 20; i++) {
        const p = createParticle(type, true)
        expect(p.y).toBeGreaterThanOrEqual(0)
        expect(p.y).toBeLessThanOrEqual(window.innerHeight)
      }
    })

    it('rain-drops: y座標が拡張範囲内 (-100 ~ innerHeight)', () => {
      for (let i = 0; i < 20; i++) {
        const p = createParticle('rain-drops', true)
        expect(p.y).toBeGreaterThanOrEqual(-100)
        expect(p.y).toBeLessThanOrEqual(window.innerHeight + 100)
      }
    })
  })

  describe('isInitial=false の場合', () => {
    it('sakura: y座標がビューポート上部 (負の値)', () => {
      for (let i = 0; i < 20; i++) {
        const p = createParticle('sakura', false)
        expect(p.y).toBe(-20)
      }
    })

    it('snow: y座標がビューポート上部 (負の値)', () => {
      for (let i = 0; i < 20; i++) {
        const p = createParticle('snow', false)
        expect(p.y).toBe(-20)
      }
    })

    it('rain-drops: y座標が-30', () => {
      for (let i = 0; i < 20; i++) {
        const p = createParticle('rain-drops', false)
        expect(p.y).toBe(-30)
      }
    })

    it('dandelion: y座標がビューポート下半分 (50%~100%)', () => {
      for (let i = 0; i < 20; i++) {
        const p = createParticle('dandelion', false)
        expect(p.y).toBeGreaterThanOrEqual(window.innerHeight * 0.5)
        expect(p.y).toBeLessThanOrEqual(window.innerHeight)
      }
    })
  })

  describe('アニメーションタイプごとのspeed/size特性', () => {
    it('rain-drops: 高速な垂直速度 (speedY >= 5)', () => {
      for (let i = 0; i < 20; i++) {
        const p = createParticle('rain-drops')
        expect(p.speedY).toBeGreaterThanOrEqual(5)
        expect(p.speedY).toBeLessThanOrEqual(9) // 4 + 5
      }
    })

    it('snow: 低速な垂直速度 (speedY < 1.1)', () => {
      for (let i = 0; i < 20; i++) {
        const p = createParticle('snow')
        expect(p.speedY).toBeGreaterThanOrEqual(0.3)
        expect(p.speedY).toBeLessThanOrEqual(1.1) // 0.8 + 0.3
      }
    })

    it('dandelion: 負の垂直速度もあり得る (上昇)', () => {
      // speedY = random*0.5 - 0.2 → range [-0.2, 0.3]
      let hasNegative = false
      for (let i = 0; i < 100; i++) {
        const p = createParticle('dandelion')
        if (p.speedY < 0) hasNegative = true
        expect(p.speedY).toBeGreaterThanOrEqual(-0.2)
        expect(p.speedY).toBeLessThanOrEqual(0.3)
      }
      // 確率的に負のspeedYが出るはず（40%の確率）
      expect(hasNegative).toBe(true)
    })

    it('dandelion: サイズが大きい (15~25)', () => {
      for (let i = 0; i < 20; i++) {
        const p = createParticle('dandelion')
        expect(p.size).toBeGreaterThanOrEqual(15)
        expect(p.size).toBeLessThanOrEqual(25)
      }
    })

    it('snow: サイズが小さい (3~11)', () => {
      for (let i = 0; i < 20; i++) {
        const p = createParticle('snow')
        expect(p.size).toBeGreaterThanOrEqual(3)
        expect(p.size).toBeLessThanOrEqual(11)
      }
    })

    it('sakura: サイズ範囲 (8~16)', () => {
      for (let i = 0; i < 20; i++) {
        const p = createParticle('sakura')
        expect(p.size).toBeGreaterThanOrEqual(8)
        expect(p.size).toBeLessThanOrEqual(16)
      }
    })
  })

  it('x座標はビューポート幅の範囲内', () => {
    for (let i = 0; i < 50; i++) {
      const p = createParticle('sakura')
      expect(p.x).toBeGreaterThanOrEqual(0)
      expect(p.x).toBeLessThanOrEqual(window.innerWidth)
    }
  })

  it('z (奥行き) は0.5~1.0の範囲', () => {
    for (let i = 0; i < 50; i++) {
      const p = createParticle('sakura')
      expect(p.z).toBeGreaterThanOrEqual(0.5)
      expect(p.z).toBeLessThanOrEqual(1.0)
    }
  })

  it('colorTypeは0~9の整数', () => {
    for (let i = 0; i < 50; i++) {
      const p = createParticle('momiji')
      expect(p.colorType).toBeGreaterThanOrEqual(0)
      expect(p.colorType).toBeLessThanOrEqual(9)
      expect(Number.isInteger(p.colorType)).toBe(true)
    }
  })
})
