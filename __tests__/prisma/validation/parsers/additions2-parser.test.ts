// @vitest-environment node

import { describe, it, expect } from 'vitest'
import {
  extractPesticidesFromAdditions2,
  extractIngredientsFromAdditions2,
  extractLinksFromAdditions2,
  extractEffectsFromAdditions2,
} from '@/prisma/validation/parsers/additions2-parser'

const SAMPLE_PESTICIDE = `
  const baroque = await ensurePesticide({
    slug: "baroque-fl", name: "バロックフロアブル", registrationNumber: "19962",
    pesticideType: "acaricide",
    formulationTypeCode: "FL",
  })
`

const SAMPLE_INGREDIENT = `
  const ingEtoxazole = await ensureIngredient({
    slug: "etoxazole",
    name: "エトキサゾール",
    nameEn: "Etoxazole",
    iracCode: "10B",
    ingredientGroup: "ジフェニルオキサゾリン系（殺ダニ剤）",
    resistanceRisk: "medium",
  })
`

const SAMPLE_LINK_VAR = `
  const baroque = await ensurePesticide({
    slug: "baroque-fl", name: "バロックフロアブル", registrationNumber: "19962",
  })
  const ingEtoxazole = await ensureActiveIngredient({
    slug: "etoxazole", name: "エトキサゾール", nameEn: "Etoxazole",
  })
  await linkIngredient(baroque, ingEtoxazole, "10.0%");
`

const SAMPLE_LINK_DOT_ID = `
  const sanyol = await prisma.pesticide.findUnique({ where: { slug: 'sanyouru-ekizai-al' } })
  const ingDBEDC = await ensureActiveIngredient({
    slug: 'dbedc', name: 'DBEDC', nameEn: 'DBEDC',
  })
  await linkIngredient(sanyol.id, ingDBEDC.id, '0.040%')
`

const SAMPLE_EFFECTS = `
  const baroque = await ensurePesticide({
    slug: "baroque-fl", name: "バロックフロアブル", registrationNumber: "19962",
  })
  await linkEffect(baroque, "hadani", { preventionLevel: "excellent", treatmentLevel: "poor", efficacyLevel: "good", persistenceLevel: "excellent", note: "テスト" })
  await linkEffect(baroque, "nami-hadani", { preventionLevel: "excellent", treatmentLevel: "poor", efficacyLevel: "good", persistenceLevel: "excellent" })
`

const SAMPLE_EFFECTS_DOT_ID = `
  const sanyol = await prisma.pesticide.findUnique({ where: { slug: 'sanyouru-ekizai-al' } })
  await linkEffect(sanyol.id, 'udonko-byo', { preventionLevel: 'good', treatmentLevel: 'none', persistenceLevel: 'fair' })
  await linkEffect(sanyol.id, 'aburamushi', { efficacyLevel: 'good', persistenceLevel: 'poor' })
`

const SAMPLE_EFFECTS_SPRAY_PRODUCT = `
  const mostopjinR = await ensureSprayProduct({
    slug: 'mostopjin-r-spray',
    name: 'GFモストップジンRスプレー',
    registrationNumber: '22952',
    pesticideType: 'compound',
  })
  await linkEffect(mostopjinR.id, 'aburamushi', { efficacyLevel: 'excellent', persistenceLevel: 'good' })
  await linkEffect(mostopjinR.id, 'udonko-byo', { preventionLevel: 'good', treatmentLevel: 'good', persistenceLevel: 'good' })
`

describe('additions2-parser', () => {
  describe('extractPesticidesFromAdditions2', () => {
    it('ensurePesticide形式を抽出する', () => {
      const result = extractPesticidesFromAdditions2(SAMPLE_PESTICIDE)
      expect(result).toHaveLength(1)
      expect(result[0]!.slug).toBe('baroque-fl')
      expect(result[0]!.name).toBe('バロックフロアブル')
      expect(result[0]!.registrationNumber).toBe('19962')
      expect(result[0]!.pesticideType).toBe('acaricide')
    })
  })

  describe('extractIngredientsFromAdditions2', () => {
    it('ensureIngredient形式を抽出する', () => {
      const result = extractIngredientsFromAdditions2(SAMPLE_INGREDIENT)
      expect(result).toHaveLength(1)
      expect(result[0]!.slug).toBe('etoxazole')
      expect(result[0]!.iracCode).toBe('10B')
      expect(result[0]!.resistanceRisk).toBe('medium')
    })
  })

  describe('extractLinksFromAdditions2', () => {
    it('変数名直接参照のリンクを抽出する', () => {
      const result = extractLinksFromAdditions2(SAMPLE_LINK_VAR)
      expect(result).toHaveLength(1)
      expect(result[0]!.pesticideSlug).toBe('baroque-fl')
      expect(result[0]!.ingredientSlug).toBe('etoxazole')
      expect(result[0]!.contentLabel).toBe('10.0%')
    })

    it('.id suffix付きリンクを抽出する', () => {
      const result = extractLinksFromAdditions2(SAMPLE_LINK_DOT_ID)
      expect(result).toHaveLength(1)
      expect(result[0]!.pesticideSlug).toBe('sanyouru-ekizai-al')
      expect(result[0]!.ingredientSlug).toBe('dbedc')
      expect(result[0]!.contentLabel).toBe('0.040%')
    })
  })

  describe('extractEffectsFromAdditions2', () => {
    it('ensurePesticide変数名でのlinkEffectを抽出する', () => {
      const result = extractEffectsFromAdditions2(SAMPLE_EFFECTS)
      expect(result).toHaveLength(2)
      expect(result[0]!.pesticideSlug).toBe('baroque-fl')
      expect(result[0]!.diseasePestSlug).toBe('hadani')
      expect(result[0]!.preventionLevel).toBe('excellent')
      expect(result[0]!.treatmentLevel).toBe('poor')
      expect(result[0]!.efficacyLevel).toBe('good')
      expect(result[0]!.persistenceLevel).toBe('excellent')
    })

    it('prisma.pesticide.findUnique変数の.id参照を抽出する', () => {
      const result = extractEffectsFromAdditions2(SAMPLE_EFFECTS_DOT_ID)
      expect(result).toHaveLength(2)
      expect(result[0]!.pesticideSlug).toBe('sanyouru-ekizai-al')
      expect(result[0]!.diseasePestSlug).toBe('udonko-byo')
      expect(result[0]!.preventionLevel).toBe('good')
      expect(result[0]!.treatmentLevel).toBe('none')
      expect(result[1]!.diseasePestSlug).toBe('aburamushi')
      expect(result[1]!.efficacyLevel).toBe('good')
    })

    it('ensureSprayProduct変数の.id参照を抽出する', () => {
      const result = extractEffectsFromAdditions2(SAMPLE_EFFECTS_SPRAY_PRODUCT)
      expect(result).toHaveLength(2)
      expect(result[0]!.pesticideSlug).toBe('mostopjin-r-spray')
      expect(result[0]!.diseasePestSlug).toBe('aburamushi')
      expect(result[0]!.efficacyLevel).toBe('excellent')
      expect(result[1]!.diseasePestSlug).toBe('udonko-byo')
      expect(result[1]!.preventionLevel).toBe('good')
    })

    it('コメントアウトされた行を除外する', () => {
      const src = `
  const baroque = await ensurePesticide({
    slug: "baroque-fl", name: "テスト",
  })
  // await linkEffect(baroque, "hadani", { efficacyLevel: "good" })
`
      const result = extractEffectsFromAdditions2(src)
      expect(result).toHaveLength(0)
    })

    it('空文字列では0件を返す', () => {
      expect(extractEffectsFromAdditions2('')).toHaveLength(0)
    })

    it('全3パターンを同時に処理できる', () => {
      const combined = SAMPLE_EFFECTS + SAMPLE_EFFECTS_DOT_ID + SAMPLE_EFFECTS_SPRAY_PRODUCT
      const result = extractEffectsFromAdditions2(combined)
      expect(result).toHaveLength(6)
    })
  })
})
