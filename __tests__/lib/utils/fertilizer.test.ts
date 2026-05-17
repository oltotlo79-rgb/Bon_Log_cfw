import { describe, it, expect } from 'vitest'
import {
  NUTRIENT_CATEGORY_BADGE,
  TREE_CATEGORY_BADGE,
  FERTILIZER_ACTION_BADGE,
  NUTRIENT_LEVEL_BADGE,
} from '@/lib/utils/fertilizer'

describe('NUTRIENT_CATEGORY_BADGE', () => {
  it('primary は「三大要素」ラベルとemerald系クラスを持つ', () => {
    expect(NUTRIENT_CATEGORY_BADGE.primary.label).toBe('三大要素')
    expect(NUTRIENT_CATEGORY_BADGE.primary.className).toContain('emerald')
  })

  it('secondary は「二次要素」ラベルとsky系クラスを持つ', () => {
    expect(NUTRIENT_CATEGORY_BADGE.secondary.label).toBe('二次要素')
    expect(NUTRIENT_CATEGORY_BADGE.secondary.className).toContain('sky')
  })

  it('trace は「微量要素」ラベルとamber系クラスを持つ', () => {
    expect(NUTRIENT_CATEGORY_BADGE.trace.label).toBe('微量要素')
    expect(NUTRIENT_CATEGORY_BADGE.trace.className).toContain('amber')
  })

  it('primary, secondary, trace の3カテゴリのみ定義されている', () => {
    expect(Object.keys(NUTRIENT_CATEGORY_BADGE).sort()).toEqual(
      ['primary', 'secondary', 'trace']
    )
  })

  it('全カテゴリにlabelとclassNameが存在する', () => {
    for (const badge of Object.values(NUTRIENT_CATEGORY_BADGE)) {
      expect(badge.label).toBeTruthy()
      expect(badge.className).toBeTruthy()
    }
  })

  it('全カテゴリにダークモードクラスが含まれる', () => {
    for (const badge of Object.values(NUTRIENT_CATEGORY_BADGE)) {
      expect(badge.className).toContain('dark:')
    }
  })

  it('各カテゴリの色が全て異なる', () => {
    const classNames = Object.values(NUTRIENT_CATEGORY_BADGE).map(b => b.className)
    expect(new Set(classNames).size).toBe(classNames.length)
  })
})

describe('TREE_CATEGORY_BADGE', () => {
  it('conifer は「松柏類」ラベルを持つ', () => {
    expect(TREE_CATEGORY_BADGE.conifer.label).toBe('松柏類')
  })

  it('deciduous は「雑木類」ラベルを持つ', () => {
    expect(TREE_CATEGORY_BADGE.deciduous.label).toBe('雑木類')
  })

  it('flowering は「花物」ラベルを持つ', () => {
    expect(TREE_CATEGORY_BADGE.flowering.label).toBe('花物')
  })

  it('fruiting は「実物」ラベルを持つ', () => {
    expect(TREE_CATEGORY_BADGE.fruiting.label).toBe('実物')
  })

  it('grass は「草物」ラベルを持つ', () => {
    expect(TREE_CATEGORY_BADGE.grass.label).toBe('草物')
  })

  it('evergreen は「常緑広葉樹」ラベルを持つ', () => {
    expect(TREE_CATEGORY_BADGE.evergreen.label).toBe('常緑広葉樹')
  })

  it('6つのカテゴリが定義されている', () => {
    expect(Object.keys(TREE_CATEGORY_BADGE).sort()).toEqual(
      ['conifer', 'deciduous', 'evergreen', 'flowering', 'fruiting', 'grass']
    )
  })

  it('全カテゴリにlabelとclassNameが存在する', () => {
    for (const badge of Object.values(TREE_CATEGORY_BADGE)) {
      expect(badge.label).toBeTruthy()
      expect(badge.className).toBeTruthy()
    }
  })

  it('全カテゴリにダークモードクラスが含まれる', () => {
    for (const badge of Object.values(TREE_CATEGORY_BADGE)) {
      expect(badge.className).toContain('dark:')
    }
  })

  it('各カテゴリの色が全て異なる', () => {
    const classNames = Object.values(TREE_CATEGORY_BADGE).map(b => b.className)
    expect(new Set(classNames).size).toBe(classNames.length)
  })
})

describe('FERTILIZER_ACTION_BADGE', () => {
  it('none は「不要」ラベルと「—」アイコンを持つ', () => {
    expect(FERTILIZER_ACTION_BADGE.none).toEqual(
      expect.objectContaining({ label: '不要', icon: '—' })
    )
  })

  it('light は「控えめ」ラベルと「△」アイコンを持つ', () => {
    expect(FERTILIZER_ACTION_BADGE.light).toEqual(
      expect.objectContaining({ label: '控えめ', icon: '△' })
    )
  })

  it('moderate は「通常」ラベルと「○」アイコンを持つ', () => {
    expect(FERTILIZER_ACTION_BADGE.moderate).toEqual(
      expect.objectContaining({ label: '通常', icon: '○' })
    )
  })

  it('heavy は「たっぷり」ラベルと「◎」アイコンを持つ', () => {
    expect(FERTILIZER_ACTION_BADGE.heavy).toEqual(
      expect.objectContaining({ label: 'たっぷり', icon: '◎' })
    )
  })

  it('4つのアクションが定義されている', () => {
    expect(Object.keys(FERTILIZER_ACTION_BADGE).sort()).toEqual(
      ['heavy', 'light', 'moderate', 'none']
    )
  })

  it('全アクションにlabel, icon, classNameが存在する', () => {
    for (const badge of Object.values(FERTILIZER_ACTION_BADGE)) {
      expect(badge.label).toBeTruthy()
      expect(badge.icon).toBeTruthy()
      expect(badge.className).toBeTruthy()
    }
  })

  it('アイコンは ◎○△× または — のいずれか', () => {
    const validIcons = ['◎', '○', '△', '×', '—']
    for (const badge of Object.values(FERTILIZER_ACTION_BADGE)) {
      expect(validIcons).toContain(badge.icon)
    }
  })
})

describe('NUTRIENT_LEVEL_BADGE', () => {
  it('high は「多め」ラベルと「↑」アイコンを持つ', () => {
    expect(NUTRIENT_LEVEL_BADGE.high).toEqual(
      expect.objectContaining({ label: '多め', icon: '↑' })
    )
  })

  it('balanced は「バランス」ラベルと「→」アイコンを持つ', () => {
    expect(NUTRIENT_LEVEL_BADGE.balanced).toEqual(
      expect.objectContaining({ label: 'バランス', icon: '→' })
    )
  })

  it('low は「控えめ」ラベルと「↓」アイコンを持つ', () => {
    expect(NUTRIENT_LEVEL_BADGE.low).toEqual(
      expect.objectContaining({ label: '控えめ', icon: '↓' })
    )
  })

  it('none は「不要」ラベルと「—」アイコンを持つ', () => {
    expect(NUTRIENT_LEVEL_BADGE.none).toEqual(
      expect.objectContaining({ label: '不要', icon: '—' })
    )
  })

  it('4つのレベルが定義されている', () => {
    expect(Object.keys(NUTRIENT_LEVEL_BADGE).sort()).toEqual(
      ['balanced', 'high', 'low', 'none']
    )
  })

  it('全レベルにlabel, icon, classNameが存在する', () => {
    for (const badge of Object.values(NUTRIENT_LEVEL_BADGE)) {
      expect(badge.label).toBeTruthy()
      expect(badge.icon).toBeTruthy()
      expect(badge.className).toBeTruthy()
    }
  })
})
