// @vitest-environment node

import { describe, it, expect } from 'vitest'
import {
  extractPesticidesFromSpray,
  extractIngredientsFromSpray,
  extractLinksFromSpray,
  extractEffectsFromSpray,
  buildSprayVarToSlugMap,
  buildSprayIngVarMap,
} from '@/prisma/validation/parsers/spray-parser'

const SAMPLE_SPRAY_SRC = `
  const benicaXFine = await ensureSprayProduct({
    slug: 'benica-x-fine-spray',
    name: 'ベニカXファインスプレー',
    registrationNumber: '22506',
    pesticideType: 'compound',
    formulationTypeId: ftAL.id,
    description: 'テスト説明文',
  })

  const ingMepanipyrim = await ensureActiveIngredient({
    slug: 'mepanipyrim',
    name: 'メパニピリム',
    nameEn: 'Mepanipyrim',
    fracCode: '9',
    ingredientGroup: 'アニリノピリミジン系',
    description: 'テスト',
    resistanceRisk: 'medium',
  })

  const ingClothianidin = await prisma.activeIngredient.findUnique({ where: { slug: 'clothianidin' } })

  await linkIngredient(benicaXFine.id, ingClothianidin!.id, '0.0080%')
  await linkIngredient(benicaXFine.id, ingMepanipyrim.id, '0.020%')

  await linkEffect(benicaXFine.id, 'udonko-byo', { preventionLevel: 'good', treatmentLevel: 'good', persistenceLevel: 'fair' })
  await linkEffect(benicaXFine.id, 'aburamushi', { efficacyLevel: 'excellent', persistenceLevel: 'good' })
`

describe('spray-parser', () => {
  describe('extractPesticidesFromSpray', () => {
    it('スプレー製品を抽出する', () => {
      const result = extractPesticidesFromSpray(SAMPLE_SPRAY_SRC)
      expect(result).toHaveLength(1)
      expect(result[0]!.slug).toBe('benica-x-fine-spray')
      expect(result[0]!.name).toBe('ベニカXファインスプレー')
      expect(result[0]!.registrationNumber).toBe('22506')
      expect(result[0]!.pesticideType).toBe('compound')
      expect(result[0]!.source).toBe('spray')
    })
  })

  describe('extractIngredientsFromSpray', () => {
    it('ensureActiveIngredient形式の成分を抽出する', () => {
      const result = extractIngredientsFromSpray(SAMPLE_SPRAY_SRC)
      expect(result).toHaveLength(1)
      expect(result[0]!.slug).toBe('mepanipyrim')
      expect(result[0]!.nameEn).toBe('Mepanipyrim')
      expect(result[0]!.fracCode).toBe('9')
    })
  })

  describe('extractLinksFromSpray', () => {
    it('.id形式のリンクを抽出する', () => {
      const result = extractLinksFromSpray(SAMPLE_SPRAY_SRC)
      expect(result).toHaveLength(2)
      const link1 = result.find(r => r.ingredientSlug === 'clothianidin')
      const link2 = result.find(r => r.ingredientSlug === 'mepanipyrim')
      expect(link1).toBeDefined()
      expect(link1!.pesticideSlug).toBe('benica-x-fine-spray')
      expect(link1!.contentLabel).toBe('0.0080%')
      expect(link2!.contentLabel).toBe('0.020%')
    })
  })

  describe('extractEffectsFromSpray', () => {
    it('スプレー製品の効果データを抽出する', () => {
      const result = extractEffectsFromSpray(SAMPLE_SPRAY_SRC)
      expect(result).toHaveLength(2)
      expect(result[0]!.pesticideSlug).toBe('benica-x-fine-spray')
      expect(result[0]!.diseasePestSlug).toBe('udonko-byo')
      expect(result[0]!.preventionLevel).toBe('good')
      expect(result[1]!.diseasePestSlug).toBe('aburamushi')
      expect(result[1]!.efficacyLevel).toBe('excellent')
      expect(result[0]!.source).toBe('spray')
    })
  })

  describe('buildSprayVarToSlugMap', () => {
    it('変数名→slugのマッピングを構築する', () => {
      const map = buildSprayVarToSlugMap(SAMPLE_SPRAY_SRC)
      expect(map.get('benicaXFine')).toBe('benica-x-fine-spray')
    })
  })

  describe('buildSprayIngVarMap', () => {
    it('成分変数名→slugのマッピングを構築する', () => {
      const map = buildSprayIngVarMap(SAMPLE_SPRAY_SRC)
      expect(map.get('ingMepanipyrim')).toBe('mepanipyrim')
      expect(map.get('ingClothianidin')).toBe('clothianidin')
    })
  })
})
