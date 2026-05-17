// @vitest-environment node

import { describe, it, expect } from 'vitest'
import {
  extractPesticidesFromAdditions,
  extractIngredientsFromAdditions,
  extractLinksFromAdditions,
  extractEffectsFromAdditions,
} from '@/prisma/validation/parsers/additions-parser'

const SAMPLE_PESTICIDE = `
      {
        slug: 'kari-gurin',
        name: 'カリグリーン',
        registrationNumber: '18358',
        pesticideType: 'fungicide',
        formulationTypeCode: 'WP',
      },
`

const SAMPLE_INGREDIENT = `
      {
        slug: 'potassium-bicarbonate',
        name: '炭酸水素カリウム',
        nameEn: 'Potassium bicarbonate',
        fracCode: 'NC',
        ingredientGroup: '無機系殺菌剤（有機JAS適合）',
        description: 'テスト',
        resistanceRisk: 'low',
      },
`

const SAMPLE_LINK = `
    { pesticideId: pMap['kari-gurin'], activeIngredientId: aiMap['potassium-bicarbonate'], contentLabel: '80.0%' },
`

const SAMPLE_EFFECTS_PMAP = `
    { pesticideId: pMap['kari-gurin'], diseasePestId: dpMap['udonko-byo'], preventionLevel: 'good' as EffectRating, treatmentLevel: 'excellent' as EffectRating, efficacyLevel: 'excellent' as EffectRating, persistenceLevel: 'fair' as EffectRating },
    { pesticideId: pMap['kari-gurin'], diseasePestId: dpMap['sabi-byo'], preventionLevel: 'good' as EffectRating, treatmentLevel: 'fair' as EffectRating, efficacyLevel: 'good' as EffectRating, persistenceLevel: 'fair' as EffectRating },
`

const SAMPLE_EFFECTS_SLUG = `
    { pesticideSlug: 'supura-saido-ec', diseasePestSlug: 'ko-sukashiba', efficacyLevel: 'excellent', persistenceLevel: 'good' },
`

describe('additions-parser', () => {
  describe('extractPesticidesFromAdditions', () => {
    it('シングルクォートの農薬データを抽出する', () => {
      const result = extractPesticidesFromAdditions(SAMPLE_PESTICIDE)
      expect(result).toHaveLength(1)
      expect(result[0].slug).toBe('kari-gurin')
      expect(result[0].name).toBe('カリグリーン')
      expect(result[0].registrationNumber).toBe('18358')
      expect(result[0].pesticideType).toBe('fungicide')
      expect(result[0].formulationType).toBe('WP')
      expect(result[0].source).toBe('additions')
    })
  })

  describe('extractIngredientsFromAdditions', () => {
    it('シングルクォートの有効成分を抽出する', () => {
      const result = extractIngredientsFromAdditions(SAMPLE_INGREDIENT)
      expect(result).toHaveLength(1)
      expect(result[0].slug).toBe('potassium-bicarbonate')
      expect(result[0].nameEn).toBe('Potassium bicarbonate')
      expect(result[0].fracCode).toBe('NC')
      expect(result[0].resistanceRisk).toBe('low')
    })
  })

  describe('extractLinksFromAdditions', () => {
    it('シングルクォートのpMap/aiMapリンクを抽出する', () => {
      const result = extractLinksFromAdditions(SAMPLE_LINK)
      expect(result).toHaveLength(1)
      expect(result[0].pesticideSlug).toBe('kari-gurin')
      expect(result[0].ingredientSlug).toBe('potassium-bicarbonate')
      expect(result[0].contentLabel).toBe('80.0%')
    })
  })

  describe('extractEffectsFromAdditions', () => {
    it('pMap/dpMap形式 + as EffectRating キャスト付きデータを正しく抽出する', () => {
      const result = extractEffectsFromAdditions(SAMPLE_EFFECTS_PMAP)
      expect(result).toHaveLength(2)
      expect(result[0].pesticideSlug).toBe('kari-gurin')
      expect(result[0].diseasePestSlug).toBe('udonko-byo')
      expect(result[0].preventionLevel).toBe('good')
      expect(result[0].treatmentLevel).toBe('excellent')
      expect(result[0].efficacyLevel).toBe('excellent')
      expect(result[0].persistenceLevel).toBe('fair')
    })

    it('treatmentLevel/efficacyLevelが空でないことを確認', () => {
      const result = extractEffectsFromAdditions(SAMPLE_EFFECTS_PMAP)
      // 全レベルが空でないことを検証（以前のバグで空になっていた）
      for (const r of result) {
        expect(r.preventionLevel).not.toBe('')
        expect(r.persistenceLevel).not.toBe('')
      }
    })

    it('pesticideSlug/diseasePestSlug形式を抽出する', () => {
      const result = extractEffectsFromAdditions(SAMPLE_EFFECTS_SLUG)
      expect(result).toHaveLength(1)
      expect(result[0].pesticideSlug).toBe('supura-saido-ec')
      expect(result[0].diseasePestSlug).toBe('ko-sukashiba')
      expect(result[0].efficacyLevel).toBe('excellent')
      expect(result[0].persistenceLevel).toBe('good')
    })

    it('両方のパターンを同時に処理できる', () => {
      const combined = SAMPLE_EFFECTS_PMAP + SAMPLE_EFFECTS_SLUG
      const result = extractEffectsFromAdditions(combined)
      expect(result).toHaveLength(3)
    })
  })
})
