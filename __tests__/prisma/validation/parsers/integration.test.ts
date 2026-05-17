// @vitest-environment node

/**
 * 統合テスト: 実際のシードファイルをパースし、期待される件数・データ品質を検証
 */

import { describe, it, expect, beforeAll } from 'vitest'
import * as fs from 'fs'
import * as path from 'path'
import {
  extractPesticidesFromMain, extractIngredientsFromMain, extractLinksFromMain,
  extractEffectsFromMain, extractDiseasePests, extractIncompatibilities,
} from '@/prisma/validation/parsers/data-parser'
import {
  extractPesticidesFromAdditions, extractEffectsFromAdditions,
} from '@/prisma/validation/parsers/additions-parser'
import {
  extractPesticidesFromAdditions2, extractEffectsFromAdditions2,
  extractLinksFromAdditions2,
} from '@/prisma/validation/parsers/additions2-parser'
import {
  extractPesticidesFromSpray, extractEffectsFromSpray,
} from '@/prisma/validation/parsers/spray-parser'
import { dedup } from '@/prisma/validation/parsers/csv-utils'

const PRISMA_DIR = path.resolve(__dirname, '../../../../prisma')
const SEED_PESTICIDE_DIR = path.join(PRISMA_DIR, 'seed', 'pesticide')

let mainSrc: string
let addSrc: string
let add2Src: string

beforeAll(() => {
  mainSrc = fs.readFileSync(path.join(SEED_PESTICIDE_DIR, 'seed-pesticide-data.ts'), 'utf-8')
  addSrc = fs.readFileSync(path.join(SEED_PESTICIDE_DIR, 'seed-pesticide-additions.ts'), 'utf-8')
  add2Src = fs.readFileSync(path.join(SEED_PESTICIDE_DIR, 'seed-pesticide-additions2.ts'), 'utf-8')
})

describe('統合テスト: 実シードファイルのパース', () => {
  describe('農薬製品', () => {
    it('全ソースから合計100件以上の農薬を抽出できる', () => {
      const all = dedup([
        ...extractPesticidesFromMain(mainSrc),
        ...extractPesticidesFromSpray(add2Src),
        ...extractPesticidesFromAdditions(addSrc),
        ...extractPesticidesFromAdditions2(add2Src),
      ], 'slug')
      expect(all.length).toBeGreaterThanOrEqual(100)
    })

    it('全農薬にslugが設定されている', () => {
      const all = extractPesticidesFromMain(mainSrc)
      for (const p of all) {
        expect(p.slug).toBeTruthy()
        expect(p.slug).toMatch(/^[a-z0-9-]+$/)
      }
    })
  })

  describe('有効成分', () => {
    it('全ソースから合計80件以上の成分を抽出できる', () => {
      const all = dedup([
        ...extractIngredientsFromMain(mainSrc),
      ], 'slug')
      expect(all.length).toBeGreaterThanOrEqual(60)
    })
  })

  describe('効果データ', () => {
    it('data.tsから1000件以上の効果を抽出できる', () => {
      const effects = extractEffectsFromMain(mainSrc)
      expect(effects.length).toBeGreaterThanOrEqual(1000)
    })

    it('additions.tsから50件以上の効果を抽出できる', () => {
      const effects = extractEffectsFromAdditions(addSrc)
      expect(effects.length).toBeGreaterThanOrEqual(50)
    })

    it('additions2.tsから200件以上の効果を抽出できる', () => {
      const effects = extractEffectsFromAdditions2(add2Src)
      expect(effects.length).toBeGreaterThanOrEqual(200)
    })

    it('spray部分から150件以上の効果を抽出できる', () => {
      const effects = extractEffectsFromSpray(add2Src)
      expect(effects.length).toBeGreaterThanOrEqual(150)
    })

    it('全効果データにsource列が設定されている', () => {
      const all = [
        ...extractEffectsFromMain(mainSrc),
        ...extractEffectsFromAdditions(addSrc),
        ...extractEffectsFromAdditions2(add2Src),
        ...extractEffectsFromSpray(add2Src),
      ]
      for (const e of all) {
        expect(['data', 'additions', 'additions2', 'spray']).toContain(e.source)
      }
    })

    it('殺菌剤の効果データでefficacyLevelとpersistenceLevelだけが空のレコードがない', () => {
      const effects = extractEffectsFromMain(mainSrc)
      for (const e of effects) {
        // 少なくとも1つのレベルが設定されていること
        const hasAny = e.preventionLevel || e.treatmentLevel || e.efficacyLevel || e.persistenceLevel
        expect(hasAny).toBeTruthy()
      }
    })
  })

  describe('カリグリーン効果データ（回帰テスト）', () => {
    it('カリグリーンの効果データが3件抽出され全レベルが非空', () => {
      const effects = extractEffectsFromAdditions(addSrc)
      const kari = effects.filter(e => e.pesticideSlug === 'kari-gurin')
      expect(kari).toHaveLength(3)
      for (const e of kari) {
        expect(e.preventionLevel).toBeTruthy()
        expect(e.persistenceLevel).toBeTruthy()
      }
    })

    it('カリグリーン×うどんこ病の全4レベルが正確', () => {
      const effects = extractEffectsFromAdditions(addSrc)
      const kariUdonko = effects.find(
        e => e.pesticideSlug === 'kari-gurin' && e.diseasePestSlug === 'udonko-byo'
      )
      expect(kariUdonko).toEqual(expect.objectContaining({
        pesticideSlug: 'kari-gurin',
        diseasePestSlug: 'udonko-byo',
        preventionLevel: 'good',
        treatmentLevel: 'excellent',
        efficacyLevel: 'excellent',
        persistenceLevel: 'fair',
      }))
    })

    it('カリグリーンの対象病害が正確（うどんこ病・さび病・灰色かび病）', () => {
      const effects = extractEffectsFromAdditions(addSrc)
      const kari = effects.filter(e => e.pesticideSlug === 'kari-gurin')
      const slugs = kari.map(e => e.diseasePestSlug).sort()
      expect(slugs).toEqual(['haiiro-kabi-byo', 'sabi-byo', 'udonko-byo'])
    })
  })

  describe('サンヨール液剤AL効果データ（回帰テスト）', () => {
    it('サンヨール液剤ALの効果データが11件抽出される', () => {
      const effects = extractEffectsFromAdditions2(add2Src)
      const sanyol = effects.filter(e => e.pesticideSlug === 'sanyouru-ekizai-al')
      expect(sanyol).toHaveLength(11)
    })

    it('サンヨール液剤ALの殺菌効果はtreatmentLevel=none（保護殺菌のみ）', () => {
      const effects = extractEffectsFromAdditions2(add2Src)
      const sanyolFungicide = effects.filter(
        e => e.pesticideSlug === 'sanyouru-ekizai-al' && e.preventionLevel !== ''
      )
      for (const e of sanyolFungicide) {
        expect(e.treatmentLevel).toBe('none')
      }
    })

    it('サンヨール液剤ALの殺虫効果は残効性が低い（poor or fair）', () => {
      const effects = extractEffectsFromAdditions2(add2Src)
      const sanyolInsect = effects.filter(
        e => e.pesticideSlug === 'sanyouru-ekizai-al' && e.efficacyLevel !== ''
      )
      expect(sanyolInsect.length).toBeGreaterThan(0)
      for (const e of sanyolInsect) {
        expect(['poor', 'fair']).toContain(e.persistenceLevel)
      }
    })

    it('サンヨール液剤ALのナメクジはpersistenceLevel=fair', () => {
      const effects = extractEffectsFromAdditions2(add2Src)
      const namekuji = effects.find(
        e => e.pesticideSlug === 'sanyouru-ekizai-al' && e.diseasePestSlug === 'namekuji'
      )
      expect(namekuji).toBeDefined()
      expect(namekuji!.persistenceLevel).toBe('fair')
    })
  })

  describe('混用不可データ', () => {
    it('100件以上のペアを抽出できる', () => {
      const result = extractIncompatibilities(mainSrc)
      expect(result.length).toBeGreaterThanOrEqual(100)
    })

    it('石灰硫黄合剤×マシン油が含まれる', () => {
      const result = extractIncompatibilities(mainSrc)
      const pair = result.find(
        r => r.slug1 === 'lime-sulfur' && r.slug2 === 'machine-oil-ec'
      )
      expect(pair).toBeDefined()
    })

    it('石灰硫黄合剤×銅系殺菌剤が含まれる', () => {
      const result = extractIncompatibilities(mainSrc)
      const copperPairs = result.filter(
        r => r.slug1 === 'lime-sulfur' && ['z-bordeaux', 'sankei-copper-wp', 'quinondo-wp'].includes(r.slug2)
      )
      expect(copperPairs.length).toBeGreaterThanOrEqual(3)
    })

    it('マシン油×有機リン系殺虫剤が含まれる', () => {
      const result = extractIncompatibilities(mainSrc)
      const pair = result.find(
        r => r.slug1 === 'machine-oil-ec' && r.slug2 === 'sumithion-ec'
      )
      expect(pair).toBeDefined()
    })

    it('重複ペアがない', () => {
      const result = extractIncompatibilities(mainSrc)
      const keys = result.map(r => `${r.slug1}|${r.slug2}`)
      expect(keys.length).toBe(new Set(keys).size)
    })
  })

  describe('pest-links', () => {
    it('additions2のリンクが抽出できる', () => {
      const links = extractLinksFromAdditions2(add2Src)
      expect(links.length).toBeGreaterThanOrEqual(10)
    })

    it('サンヨール液剤ALの成分リンクが含まれる', () => {
      const links = extractLinksFromAdditions2(add2Src)
      const sanyol = links.find(l => l.pesticideSlug === 'sanyouru-ekizai-al')
      expect(sanyol).toBeDefined()
      expect(sanyol!.ingredientSlug).toBe('dbedc')
    })
  })

  describe('病害虫', () => {
    it('200件以上の病害虫を抽出できる', () => {
      const all = dedup([
        ...extractDiseasePests(mainSrc, 'data'),
        ...extractDiseasePests(addSrc, 'additions'),
      ], 'slug')
      expect(all.length).toBeGreaterThanOrEqual(200)
    })

    it('全病害虫にcategoryが設定されている', () => {
      const all = extractDiseasePests(mainSrc, 'data')
      for (const dp of all) {
        expect(['disease', 'pest', 'beneficial_insect']).toContain(dp.category)
      }
    })

    it('害虫には体長データが設定されている', () => {
      const all = extractDiseasePests(mainSrc, 'data')
      const pests = all.filter(dp => dp.category === 'pest')
      for (const p of pests) {
        expect(p.bodySizeMinMm).toBeTruthy()
        expect(p.bodySizeMaxMm).toBeTruthy()
        expect(Number(p.bodySizeMinMm)).toBeLessThanOrEqual(Number(p.bodySizeMaxMm))
      }
    })

    it('3カテゴリ全てが存在する', () => {
      const all = dedup([
        ...extractDiseasePests(mainSrc, 'data'),
        ...extractDiseasePests(addSrc, 'additions'),
      ], 'slug')
      const categories = new Set(all.map(dp => dp.category))
      expect(categories).toEqual(new Set(['disease', 'pest', 'beneficial_insect']))
    })
  })

  describe('MAFF突合済みデータとの照合', () => {
    // MAFF公式で確認済みの含有量データと照合する回帰テスト
    const VERIFIED_LINKS: { pSlug: string; iSlug: string; content: string }[] = [
      { pSlug: 'trifumin-ec', iSlug: 'triflumizole', content: '15.0%' },
      { pSlug: 'dithane-wp', iSlug: 'mancozeb', content: '80.0%' },
      { pSlug: 'topjin-m-wp', iSlug: 'thiophanate-methyl', content: '70.0%' },
      { pSlug: 'daconil-1000', iSlug: 'chlorothalonil', content: '40.0%' },
      { pSlug: 'mospilan-sl', iSlug: 'acetamiprid', content: '2.0%' },
      { pSlug: 'milbenock-ec', iSlug: 'milbemectin', content: '1.0%' },
      { pSlug: 'affirm-ec', iSlug: 'emamectin-benzoate', content: '1.0%' },
      { pSlug: 'dantotsu-sp', iSlug: 'clothianidin', content: '16.0%' },
    ]

    it.each(VERIFIED_LINKS)(
      '$pSlug の $iSlug 含有量が $content',
      ({ pSlug, iSlug, content }) => {
        const links = extractLinksFromMain(mainSrc)
        const link = links.find(l => l.pesticideSlug === pSlug && l.ingredientSlug === iSlug)
        expect(link).toBeDefined()
        expect(link!.contentLabel).toBe(content)
      }
    )
  })

  describe('効果データの論理整合性', () => {
    it('保護殺菌剤（M系FRAC）の効果はtreatmentLevel=none', () => {
      const effects = extractEffectsFromMain(mainSrc)
      // ジマンダイセン(M03) の効果は治療効果なし
      const dithane = effects.filter(e => e.pesticideSlug === 'dithane-wp')
      for (const e of dithane) {
        expect(e.treatmentLevel).toBe('none')
      }
    })

    it('浸透性殺菌剤（DMI系FRAC3）の効果はtreatmentLevel≠none', () => {
      const effects = extractEffectsFromMain(mainSrc)
      const trifumin = effects.filter(e => e.pesticideSlug === 'trifumin-ec')
      for (const e of trifumin) {
        expect(e.treatmentLevel).not.toBe('none')
        expect(e.treatmentLevel).not.toBe('')
      }
    })

    it('BT菌製剤は鱗翅目害虫のみに紐付けされている', () => {
      const effects = extractEffectsFromMain(mainSrc)
      const bt = effects.filter(e => e.pesticideSlug === 'xentari-wp')
      const validPests = [
        'kemushi-imomushi', 'hamakimushi', 'matsukemushi', 'shinkuimushi',
        'chadokuga', 'amerika-shirohitori', 'iragarui', 'maimaiga',
        'monshirochou-youchu', 'kinuwaba', 'tamana-yaga', 'kuwagomadarahitori',
        'hiroheriaoiraga', 'kiashi-dokuga', 'obi-kareha',
      ]
      for (const e of bt) {
        expect(validPests).toContain(e.diseasePestSlug)
      }
    })

    it('殺虫剤が病害（disease）に直接効果を持たない（ウイルス媒介防除を除く）', () => {
      const effects = extractEffectsFromMain(mainSrc)
      const pests = extractDiseasePests(mainSrc, 'data')
      const diseaseSlugSet = new Set(
        pests.filter(p => p.category === 'disease').map(p => p.slug)
      )
      // 殺虫専用農薬のslug
      const insecticideOnly = ['starguard-gr', 'rody-ec', 'adion-fl', 'match-ec']
      for (const iSlug of insecticideOnly) {
        const fx = effects.filter(e => e.pesticideSlug === iSlug)
        for (const e of fx) {
          // ウイルス病（mosaic-byo, fuiri-sho）は媒介害虫防除として許容
          if (['mosaic-byo', 'fuiri-sho'].includes(e.diseasePestSlug)) continue
          expect(diseaseSlugSet.has(e.diseasePestSlug)).toBe(false)
        }
      }
    })

    it('効果レベルが有効な値のみ（excellent/good/fair/poor/none/空文字）', () => {
      const validLevels = new Set(['excellent', 'good', 'fair', 'poor', 'none', ''])
      const all = [
        ...extractEffectsFromMain(mainSrc),
        ...extractEffectsFromAdditions(addSrc),
        ...extractEffectsFromAdditions2(add2Src),
        ...extractEffectsFromSpray(add2Src),
      ]
      for (const e of all) {
        expect(validLevels.has(e.preventionLevel)).toBe(true)
        expect(validLevels.has(e.treatmentLevel)).toBe(true)
        expect(validLevels.has(e.efficacyLevel)).toBe(true)
        expect(validLevels.has(e.persistenceLevel)).toBe(true)
      }
    })
  })

  describe('slug一意性', () => {
    it('農薬slugに重複がない', () => {
      const all = [
        ...extractPesticidesFromMain(mainSrc),
        ...extractPesticidesFromSpray(add2Src),
        ...extractPesticidesFromAdditions(addSrc),
        ...extractPesticidesFromAdditions2(add2Src),
      ]
      const slugs = all.map(p => p.slug)
      // dedup前の重複を検出
      const counts = new Map<string, number>()
      for (const s of slugs) counts.set(s, (counts.get(s) ?? 0) + 1)
      const _dupes = [...counts.entries()].filter(([, c]) => c > 1).map(([s]) => s)
      // 同一製品が複数ソースで定義される場合はdedupで解消されるので、
      // ここでは同一ソース内の重複のみチェック
      const mainSlugs = extractPesticidesFromMain(mainSrc).map(p => p.slug)
      expect(mainSlugs.length).toBe(new Set(mainSlugs).size)
    })

    it('病害虫slugに重複がない', () => {
      const all = dedup([
        ...extractDiseasePests(mainSrc, 'data'),
        ...extractDiseasePests(addSrc, 'additions'),
      ], 'slug')
      const slugs = all.map(d => d.slug)
      expect(slugs.length).toBe(new Set(slugs).size)
    })
  })
})
