import { describe, it, expect } from 'vitest'
import { CATEGORY_BADGE, PESTICIDE_TYPE_BADGE } from '@/lib/utils/pesticide-badge'

describe('CATEGORY_BADGE', () => {
  it('disease は「病害」ラベルとrose系クラスを持つ', () => {
    expect(CATEGORY_BADGE.disease.label).toBe('病害')
    expect(CATEGORY_BADGE.disease.className).toBe(
      'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300'
    )
  })

  it('pest は「害虫」ラベルとamber系クラスを持つ', () => {
    expect(CATEGORY_BADGE.pest.label).toBe('害虫')
    expect(CATEGORY_BADGE.pest.className).toBe(
      'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'
    )
  })

  it('beneficial_insect は「益虫」ラベルとemerald系クラスを持つ', () => {
    expect(CATEGORY_BADGE.beneficial_insect.label).toBe('益虫')
    expect(CATEGORY_BADGE.beneficial_insect.className).toBe(
      'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
    )
  })

  it('disease, pest, beneficial_insect の3カテゴリのみ定義されている', () => {
    expect(Object.keys(CATEGORY_BADGE).sort()).toEqual(
      ['beneficial_insect', 'disease', 'pest']
    )
  })

  it('全カテゴリにlabelとclassNameが存在する', () => {
    for (const badge of Object.values(CATEGORY_BADGE)) {
      expect(badge.label).toBeTruthy()
      expect(badge.className).toBeTruthy()
    }
  })

  it('全カテゴリにダークモードクラスが含まれる', () => {
    for (const badge of Object.values(CATEGORY_BADGE)) {
      expect(badge.className).toContain('dark:')
    }
  })
})

describe('PESTICIDE_TYPE_BADGE', () => {
  it('fungicide は「殺菌剤」ラベルとsky系クラス', () => {
    expect(PESTICIDE_TYPE_BADGE.fungicide).toEqual({
      label: '殺菌剤',
      className: 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300',
    })
  })

  it('insecticide は「殺虫剤」ラベルとorange系クラス', () => {
    expect(PESTICIDE_TYPE_BADGE.insecticide).toEqual({
      label: '殺虫剤',
      className: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300',
    })
  })

  it('acaricide は「殺ダニ剤」ラベルとviolet系クラス', () => {
    expect(PESTICIDE_TYPE_BADGE.acaricide).toEqual({
      label: '殺ダニ剤',
      className: 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300',
    })
  })

  it('compound は「複合剤」ラベルとfuchsia系クラス', () => {
    expect(PESTICIDE_TYPE_BADGE.compound).toEqual({
      label: '複合剤',
      className: 'bg-fuchsia-100 text-fuchsia-700 dark:bg-fuchsia-900/30 dark:text-fuchsia-300',
    })
  })

  it('other は「その他」ラベルとmutedクラス', () => {
    expect(PESTICIDE_TYPE_BADGE.other).toEqual({
      label: 'その他',
      className: 'bg-muted text-muted-foreground',
    })
  })

  it('spreader は「展着剤」ラベルとteal系クラス', () => {
    expect(PESTICIDE_TYPE_BADGE.spreader).toEqual({
      label: '展着剤',
      className: 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300',
    })
  })

  it('6タイプ（fungicide, insecticide, acaricide, compound, other, spreader）が定義されている', () => {
    expect(Object.keys(PESTICIDE_TYPE_BADGE).sort()).toEqual(
      ['acaricide', 'compound', 'fungicide', 'insecticide', 'other', 'spreader']
    )
  })

  it('全タイプにlabelとclassNameが存在する', () => {
    for (const badge of Object.values(PESTICIDE_TYPE_BADGE)) {
      expect(badge.label).toBeTruthy()
      expect(badge.className).toBeTruthy()
    }
  })

  it('各タイプの色が全て異なる', () => {
    const classNames = Object.values(PESTICIDE_TYPE_BADGE).map(b => b.className)
    expect(new Set(classNames).size).toBe(classNames.length)
  })
})
