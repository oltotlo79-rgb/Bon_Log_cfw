/**
 * シードスクリプト共通のヘルパー関数。
 *
 * seed-pesticide-additions.ts / additions2.ts で重複していた
 * ensure/link 系関数を一元化する。
 *
 * 注意: バリデーションパーサーはこれらの関数の「呼び出し元」を正規表現で検出する。
 * 関数名（ensurePesticide, ensureIngredient 等）は変更しないこと。
 */

import type { PrismaClient, Pesticide, ActiveIngredient } from '@prisma/client'

// ── 型定義 ─────────────────────────────────────────────

export type IngredientData = {
  slug: string
  name: string
  nameEn: string
  fracCode?: string
  iracCode?: string
  ingredientGroup: string
  description: string
  resistanceRisk?: 'low' | 'medium' | 'high'
}

export type PesticideData = {
  slug: string
  name: string
  registrationNumber: string | null
  pesticideType: string
  formulationTypeCode: string
  description: string
}

export type SprayProductData = {
  slug: string
  name: string
  registrationNumber: string | null
  pesticideType: 'fungicide' | 'insecticide' | 'acaricide' | 'compound' | 'other'
  formulationTypeId: string
  description: string
}

export type EffectParams = {
  preventionLevel?: string
  treatmentLevel?: string
  efficacyLevel?: string
  persistenceLevel?: string
  note?: string
}

// ── ファクトリ ─────────────────────────────────────────

/**
 * PrismaClient に紐づいたヘルパー関数群を生成する。
 */
export function createSeedHelpers(prisma: PrismaClient) {
  async function ensureFormulationType(
    code: string,
    name: string,
    description: string,
    sortOrder: number,
  ) {
    let ft = await prisma.formulationType.findUnique({ where: { code } })
    if (!ft) {
      ft = await prisma.formulationType.create({ data: { code, name, description, sortOrder } })
      console.log(`剤型 ${code}（${name}）を追加しました。`)
    }
    return ft
  }

  async function ensureIngredient(data: IngredientData): Promise<string> {
    let ing = await prisma.activeIngredient.findUnique({ where: { slug: data.slug } })
    if (!ing) {
      ing = await prisma.activeIngredient.create({
        data: {
          slug: data.slug,
          name: data.name,
          nameEn: data.nameEn,
          fracCode: data.fracCode ?? null,
          iracCode: data.iracCode ?? null,
          ingredientGroup: data.ingredientGroup,
          description: data.description,
          resistanceRisk: data.resistanceRisk ?? null,
        },
      })
      console.log(`  + 有効成分追加: ${data.name}`)
    }
    return ing.id
  }

  async function ensureActiveIngredient(data: IngredientData): Promise<ActiveIngredient> {
    let ing = await prisma.activeIngredient.findUnique({ where: { slug: data.slug } })
    if (!ing) {
      ing = await prisma.activeIngredient.create({
        data: {
          slug: data.slug,
          name: data.name,
          nameEn: data.nameEn,
          fracCode: data.fracCode ?? null,
          iracCode: data.iracCode ?? null,
          ingredientGroup: data.ingredientGroup,
          description: data.description,
          resistanceRisk: data.resistanceRisk ?? null,
        },
      })
      console.log(`有効成分 ${data.name}（${data.slug}）を追加しました。`)
    }
    return ing
  }

  async function ensurePesticide(data: PesticideData): Promise<string> {
    let p = await prisma.pesticide.findUnique({ where: { slug: data.slug } })
    if (!p) {
      const ft = await prisma.formulationType.findUnique({
        where: { code: data.formulationTypeCode },
      })
      if (!ft) {
        console.warn(`  ⚠ 剤型 ${data.formulationTypeCode} が見つかりません`)
        return ''
      }
      p = await prisma.pesticide.create({
        data: {
          slug: data.slug,
          name: data.name,
          registrationNumber: data.registrationNumber,
          pesticideType: data.pesticideType as never,
          formulationTypeId: ft.id,
          description: data.description,
        },
      })
      console.log(`  + 製品追加: ${data.name}`)
    } else {
      await prisma.pesticide.update({
        where: { id: p.id },
        data: { description: data.description, registrationNumber: data.registrationNumber },
      })
      console.log(`  ✓ 製品更新: ${data.name}`)
    }
    return p.id
  }

  async function ensureSprayProduct(data: SprayProductData): Promise<Pesticide> {
    const existing = await prisma.pesticide.findUnique({ where: { slug: data.slug } })
    if (existing) {
      console.log(`${data.name}（${data.slug}）は既に登録済みです。スキップします。`)
      return existing
    }
    const pesticide = await prisma.pesticide.create({
      data: {
        slug: data.slug,
        name: data.name,
        registrationNumber: data.registrationNumber,
        pesticideType: data.pesticideType,
        formulationTypeId: data.formulationTypeId,
        description: data.description,
      },
    })
    console.log(`農薬 ${data.name}（${data.slug}）を追加しました。`)
    return pesticide
  }

  async function linkIngredient(
    pesticideId: string,
    ingredientId: string,
    contentLabel: string,
  ) {
    if (!pesticideId || !ingredientId) return
    const existing = await prisma.pesticideActiveIngredient.findUnique({
      where: {
        pesticideId_activeIngredientId: { pesticideId, activeIngredientId: ingredientId },
      },
    })
    if (!existing) {
      await prisma.pesticideActiveIngredient.create({
        data: { pesticideId, activeIngredientId: ingredientId, contentLabel },
      })
    }
  }

  async function linkEffect(pesticideId: string, dpSlug: string, params: EffectParams) {
    if (!pesticideId) return
    const dp = await prisma.diseasePest.findUnique({ where: { slug: dpSlug } })
    if (!dp) {
      console.warn(`  ⚠ 病害虫 ${dpSlug} が見つかりません。スキップします。`)
      return
    }
    const existing = await prisma.pesticideEffect.findFirst({
      where: { pesticideId, diseasePestId: dp.id },
    })
    if (!existing) {
      await prisma.pesticideEffect.create({
        data: {
          pesticideId,
          diseasePestId: dp.id,
          preventionLevel: (params.preventionLevel as never) ?? null,
          treatmentLevel: (params.treatmentLevel as never) ?? null,
          efficacyLevel: (params.efficacyLevel as never) ?? null,
          persistenceLevel: (params.persistenceLevel as never) ?? null,
          note: params.note ?? null,
        },
      })
    }
  }

  return {
    ensureFormulationType,
    ensureIngredient,
    ensureActiveIngredient,
    ensurePesticide,
    ensureSprayProduct,
    linkIngredient,
    linkEffect,
  }
}
