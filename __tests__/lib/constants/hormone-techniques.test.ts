// @vitest-environment node

/**
 * lib/constants/hormone-techniques.ts のスナップショット・整合性テスト
 *
 * 9つの盆栽技法の定義、ホルモン関連の表示設定（色・ラベル）、
 * シミュレーター閾値などの共通定数。これらが変更されると以下に影響する:
 *   - 盆栽技法ページの URL スラグ（slug 重複は 404 を生む）
 *   - ホルモン量バランスシミュレーターの数値計算
 *   - 相互作用ダイアグラムの SVG 配置
 *
 * 値の一貫性回帰を検知する目的で、構造ベースのテストを並べる。
 */

import { describe, it, expect } from 'vitest'
import {
  BONSAI_TECHNIQUES,
  TECHNIQUE_EFFECT_TYPE_LABELS,
  TECHNIQUE_EFFECT_TYPE_COLORS,
  TECHNIQUE_MAGNITUDE_LABELS,
  TECHNIQUE_MAGNITUDE_COLORS,
  HORMONE_LEVEL_CONFIG,
  MONTH_LABELS,
  DIAGRAM_SVG_WIDTH,
  DIAGRAM_SVG_HEIGHT,
  DIAGRAM_NODE_RADIUS,
  INTERACTION_EDGE_COLORS,
  INTERACTION_TYPE_LABELS,
  SIMULATOR_MAGNITUDE_DELTA,
  SIMULATOR_MAX_LEVEL,
  SIMULATOR_MIN_LEVEL,
  SIMULATOR_LEVEL_THRESHOLDS,
} from '@/lib/constants/hormone-techniques'
import type { BonsaiTechniqueSlug } from '@/lib/constants/hormone-techniques'

describe('BONSAI_TECHNIQUES', () => {
  it('9つの技法が定義されている', () => {
    expect(BONSAI_TECHNIQUES).toHaveLength(9)
  })

  it('全 slug が一意（URL 衝突を防ぐ）', () => {
    const slugs = BONSAI_TECHNIQUES.map((t) => t.slug)
    expect(new Set(slugs).size).toBe(slugs.length)
  })

  it('全 slug が kebab-case（小文字 + ハイフン）', () => {
    for (const t of BONSAI_TECHNIQUES) {
      expect(t.slug).toMatch(/^[a-z]+(-[a-z]+)*$/)
    }
  })

  it('各エントリに slug / name / nameEn / description がある', () => {
    for (const t of BONSAI_TECHNIQUES) {
      expect(typeof t.slug).toBe('string')
      expect(typeof t.name).toBe('string')
      expect(typeof t.nameEn).toBe('string')
      expect(typeof t.description).toBe('string')
      expect(t.slug.length).toBeGreaterThan(0)
      expect(t.name.length).toBeGreaterThan(0)
    }
  })

  it('代表的な技法が含まれている', () => {
    const slugs = BONSAI_TECHNIQUES.map((t) => t.slug)
    expect(slugs).toContain('pinching')
    expect(slugs).toContain('pruning')
    expect(slugs).toContain('wiring')
    expect(slugs).toContain('repotting')
  })

  it('BonsaiTechniqueSlug 型が slug の Union 型として機能する', () => {
    const sample: BonsaiTechniqueSlug = 'pinching'
    expect(BONSAI_TECHNIQUES.some((t) => t.slug === sample)).toBe(true)
  })
})

describe('TECHNIQUE_EFFECT_TYPE_*', () => {
  it('LABELS は increase / decrease / redistribute / combined を持つ', () => {
    expect(TECHNIQUE_EFFECT_TYPE_LABELS.increase).toBe('増加')
    expect(TECHNIQUE_EFFECT_TYPE_LABELS.decrease).toBe('減少')
    expect(TECHNIQUE_EFFECT_TYPE_LABELS.redistribute).toBe('再分配')
    expect(TECHNIQUE_EFFECT_TYPE_LABELS.combined).toBe('複合効果')
  })

  it('COLORS は increase / decrease / redistribute をカバー', () => {
    expect(TECHNIQUE_EFFECT_TYPE_COLORS.increase).toBeDefined()
    expect(TECHNIQUE_EFFECT_TYPE_COLORS.decrease).toBeDefined()
    expect(TECHNIQUE_EFFECT_TYPE_COLORS.redistribute).toBeDefined()
  })

  it('各 COLOR エントリが text / bg / darkBg を持つ', () => {
    for (const v of Object.values(TECHNIQUE_EFFECT_TYPE_COLORS)) {
      expect(typeof v.text).toBe('string')
      expect(typeof v.bg).toBe('string')
      expect(typeof v.darkBg).toBe('string')
    }
  })
})

describe('TECHNIQUE_MAGNITUDE_*', () => {
  it('LABELS は strong / moderate / mild を持つ', () => {
    expect(TECHNIQUE_MAGNITUDE_LABELS.strong).toBe('強')
    expect(TECHNIQUE_MAGNITUDE_LABELS.moderate).toBe('中')
    expect(TECHNIQUE_MAGNITUDE_LABELS.mild).toBe('弱')
  })

  it('COLORS は strong / moderate / mild を持つ', () => {
    expect(TECHNIQUE_MAGNITUDE_COLORS.strong).toContain('green')
    expect(TECHNIQUE_MAGNITUDE_COLORS.moderate).toContain('yellow')
    expect(TECHNIQUE_MAGNITUDE_COLORS.mild).toContain('gray')
  })

  it('LABELS と COLORS が同じキー集合を持つ', () => {
    expect(Object.keys(TECHNIQUE_MAGNITUDE_LABELS).sort()).toEqual(
      Object.keys(TECHNIQUE_MAGNITUDE_COLORS).sort(),
    )
  })
})

describe('HORMONE_LEVEL_CONFIG', () => {
  it('high / moderate / low / minimal の4段階を持つ', () => {
    expect(Object.keys(HORMONE_LEVEL_CONFIG).sort()).toEqual(['high', 'low', 'minimal', 'moderate'])
  })

  it('numericValue は high(3) > moderate(2) > low(1) > minimal(0) の順', () => {
    expect(HORMONE_LEVEL_CONFIG.high.numericValue).toBe(3)
    expect(HORMONE_LEVEL_CONFIG.moderate.numericValue).toBe(2)
    expect(HORMONE_LEVEL_CONFIG.low.numericValue).toBe(1)
    expect(HORMONE_LEVEL_CONFIG.minimal.numericValue).toBe(0)
  })

  it('各エントリが color / label / numericValue を持つ', () => {
    for (const v of Object.values(HORMONE_LEVEL_CONFIG)) {
      expect(typeof v.color).toBe('string')
      expect(typeof v.label).toBe('string')
      expect(typeof v.numericValue).toBe('number')
    }
  })
})

describe('MONTH_LABELS', () => {
  it('12ヶ月分のラベルを持つ', () => {
    expect(MONTH_LABELS).toHaveLength(12)
  })

  it('1月から12月まで順序通り', () => {
    expect(MONTH_LABELS[0]).toBe('1月')
    expect(MONTH_LABELS[5]).toBe('6月')
    expect(MONTH_LABELS[11]).toBe('12月')
  })
})

describe('Diagram constants', () => {
  it('SVG サイズが正の整数', () => {
    expect(DIAGRAM_SVG_WIDTH).toBeGreaterThan(0)
    expect(DIAGRAM_SVG_HEIGHT).toBeGreaterThan(0)
    expect(Number.isInteger(DIAGRAM_SVG_WIDTH)).toBe(true)
    expect(Number.isInteger(DIAGRAM_SVG_HEIGHT)).toBe(true)
  })

  it('ノード半径が正の数', () => {
    expect(DIAGRAM_NODE_RADIUS).toBeGreaterThan(0)
  })

  it('ノード半径は SVG 寸法の範囲内', () => {
    expect(DIAGRAM_NODE_RADIUS * 2).toBeLessThan(DIAGRAM_SVG_WIDTH)
    expect(DIAGRAM_NODE_RADIUS * 2).toBeLessThan(DIAGRAM_SVG_HEIGHT)
  })
})

describe('INTERACTION_*', () => {
  it('EDGE_COLORS は synergistic / antagonistic / modulatory をカバー', () => {
    expect(INTERACTION_EDGE_COLORS.synergistic).toMatch(/^#[0-9a-f]{3,6}$/i)
    expect(INTERACTION_EDGE_COLORS.antagonistic).toMatch(/^#[0-9a-f]{3,6}$/i)
    expect(INTERACTION_EDGE_COLORS.modulatory).toMatch(/^#[0-9a-f]{3,6}$/i)
  })

  it('TYPE_LABELS と EDGE_COLORS が同じキー集合を持つ', () => {
    expect(Object.keys(INTERACTION_TYPE_LABELS).sort()).toEqual(
      Object.keys(INTERACTION_EDGE_COLORS).sort(),
    )
  })

  it('日本語ラベルが定義されている', () => {
    expect(INTERACTION_TYPE_LABELS.synergistic).toBe('相乗')
    expect(INTERACTION_TYPE_LABELS.antagonistic).toBe('拮抗')
    expect(INTERACTION_TYPE_LABELS.modulatory).toBe('調節')
  })
})

describe('SIMULATOR constants', () => {
  it('MAX_LEVEL > MIN_LEVEL', () => {
    expect(SIMULATOR_MAX_LEVEL).toBeGreaterThan(SIMULATOR_MIN_LEVEL)
  })

  it('MAGNITUDE_DELTA は strong > moderate > mild の順で大きい', () => {
    expect(SIMULATOR_MAGNITUDE_DELTA['strong']).toBeGreaterThan(SIMULATOR_MAGNITUDE_DELTA['moderate']!)
    expect(SIMULATOR_MAGNITUDE_DELTA['moderate']).toBeGreaterThan(SIMULATOR_MAGNITUDE_DELTA['mild']!)
  })

  it('MAGNITUDE_DELTA すべて正の値（減少は呼び出し側で符号反転）', () => {
    for (const v of Object.values(SIMULATOR_MAGNITUDE_DELTA)) {
      expect(v).toBeGreaterThan(0)
    }
  })

  it('LEVEL_THRESHOLDS は min が降順で並んでいる（カットオフ判定の前提）', () => {
    for (let i = 1; i < SIMULATOR_LEVEL_THRESHOLDS.length; i++) {
      expect(SIMULATOR_LEVEL_THRESHOLDS[i]!.min).toBeLessThan(SIMULATOR_LEVEL_THRESHOLDS[i - 1]!.min)
    }
  })

  it('LEVEL_THRESHOLDS の最小 min は 0（minimal の境界）', () => {
    const last = SIMULATOR_LEVEL_THRESHOLDS[SIMULATOR_LEVEL_THRESHOLDS.length - 1]!
    expect(last.min).toBe(0)
    expect(last.level).toBe('minimal')
  })

  it('LEVEL_THRESHOLDS の各 level は HORMONE_LEVEL_CONFIG のキーに対応する', () => {
    for (const t of SIMULATOR_LEVEL_THRESHOLDS) {
      expect(HORMONE_LEVEL_CONFIG[t.level]).toBeDefined()
    }
  })
})
