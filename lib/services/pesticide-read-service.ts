/**
 * @module lib/services/pesticide-read-service
 * モバイル API v1 向けの農薬・病害虫・有効成分読み取りサービス。
 *
 * Web の lib/actions/pesticide と同等のクエリ・フィルタ・並び順を提供する。
 * カーソルベースページネーション付き（MAX_PAGE_LIMIT 上限）。
 *
 * 'use server' を付けない（API route から呼ばれる services 層）。
 * import 'server-only' で誤った client 側利用を防ぐ。
 */
import 'server-only'

import { z } from 'zod'
import { prisma } from '@/lib/db'
import logger from '@/lib/logger'
import { DiseasePestCategory, PesticideType, ResistanceRisk, type Prisma } from '@prisma/client'
import { normalizePesticideType } from '@/lib/utils/pesticide'
import {
  MAX_PESTICIDE_LIST_LIMIT,
  MAX_SLUG_LENGTH,
  MAX_SEARCH_QUERY_LENGTH,
  DEFAULT_PAGE_LIMIT,
  MAX_PAGE_LIMIT,
} from '@/lib/constants/limits'

// ── 画像フォールバック（Web 側 pesticide.ts と同一定義） ──────────────

const PEST_IMAGE_FALLBACK: Record<string, string> = {
  'kabura-habachi': '/images/pesticides/kabura-habachi.png',
  'kinuwaba': '/images/pesticides/kinuwaba.png',
  'koumorigiga': '/images/pesticides/koumorigiga.png',
  'kubiaka-tsuyakamikiri': '/images/pesticides/kubiaka-tsuyakamikiri.png',
  'mikan-hamorigiga': '/images/pesticides/mikan-hamorigiga.png',
  'minami-kiiro-azamiuma': '/images/pesticides/minami-kiiro-azamiuma.png',
  'oonijyuuya-hoshitentou': '/images/pesticides/oonijyuuya-hoshitentou.png',
  'ringo-kokaku-hamaki': '/images/pesticides/ringo-kokaku-hamaki.png',
  'tamana-yaga': '/images/pesticides/tamana-yaga.png',
}

function applyImageFallback<T extends { slug: string; imageUrl: string | null }>(item: T): T {
  if (item.imageUrl) return item
  const fallback = PEST_IMAGE_FALLBACK[item.slug]
  return fallback !== undefined ? { ...item, imageUrl: fallback } : item
}

// ── 入力バリデーションスキーマ ────────────────────────────────────────

const slugSchema = z.string().min(1).max(MAX_SLUG_LENGTH)
const searchSchema = z.string().max(MAX_SEARCH_QUERY_LENGTH)
const codeSchema = z.string().min(1).max(MAX_SLUG_LENGTH)
const bodySizeMmSchema = z.number().finite().nonnegative()

export const diseasePestListQuerySchema = z.object({
  cursor: z.string().min(1).max(MAX_SLUG_LENGTH).optional(),
  limit: z.number().int().min(1).max(MAX_PAGE_LIMIT).optional(),
  category: z.nativeEnum(DiseasePestCategory).optional(),
  search: searchSchema
    .transform((s) => s.slice(0, MAX_SEARCH_QUERY_LENGTH))
    .transform((s) => (s.length > 0 ? s : undefined))
    .optional(),
  bodySizeMm: bodySizeMmSchema.optional(),
})

export const pesticideListQuerySchema = z.object({
  cursor: z.string().min(1).max(MAX_SLUG_LENGTH).optional(),
  limit: z.number().int().min(1).max(MAX_PAGE_LIMIT).optional(),
  search: searchSchema
    .transform((s) => s.slice(0, MAX_SEARCH_QUERY_LENGTH))
    .transform((s) => (s.length > 0 ? s : undefined))
    .optional(),
  type: z.nativeEnum(PesticideType).optional(),
  diseasePestId: z.string().min(1).max(MAX_SLUG_LENGTH).optional(),
  formulationTypeCode: codeSchema.optional(),
})

export const ingredientListQuerySchema = z.object({
  cursor: z.string().min(1).max(MAX_SLUG_LENGTH).optional(),
  limit: z.number().int().min(1).max(MAX_PAGE_LIMIT).optional(),
  search: searchSchema
    .transform((s) => s.slice(0, MAX_SEARCH_QUERY_LENGTH))
    .transform((s) => (s.length > 0 ? s : undefined))
    .optional(),
})

// ── 型定義（戻り値の公開インターフェース） ────────────────────────────

export type DiseasePestListItem = {
  id: string
  name: string
  nameKana: string | null
  category: DiseasePestCategory
  description: string | null
  imageUrl: string | null
  slug: string
}

export type DiseasePestEffectItem = {
  pesticide: {
    id: string
    name: string
    slug: string
    pesticideType: PesticideType
  }
  rating: {
    preventionLevel: string | null
    treatmentLevel: string | null
    efficacyLevel: string | null
    persistenceLevel: string | null
  }
}

export type DiseasePestDetail = DiseasePestListItem & {
  effects: DiseasePestEffectItem[]
}

export type PesticideListItem = {
  id: string
  name: string
  registrationNumber: string | null
  pesticideType: PesticideType
  description: string | null
  slug: string
}

export type IngredientListItem = {
  id: string
  name: string
  nameEn: string | null
  fracCode: string | null
  iracCode: string | null
  resistanceRisk: ResistanceRisk | null
  slug: string
}

export type PesticideFormulationType = {
  name: string
  code: string
}

export type PesticideActiveIngredientItem = {
  id: string
  name: string
  fracCode: string | null
  iracCode: string | null
  resistanceRisk: ResistanceRisk | null
  slug: string
}

export type PesticideEffectItem = {
  diseasePest: {
    id: string
    name: string
    slug: string
  }
  rating: {
    preventionLevel: string | null
    treatmentLevel: string | null
    efficacyLevel: string | null
    persistenceLevel: string | null
  }
}

export type PesticideIncompatibilityItem = {
  id: string
  name: string
  slug: string
  formulationTypeName: string | null
}

export type PesticideDetail = PesticideListItem & {
  formulationType: PesticideFormulationType | null
  activeIngredients: PesticideActiveIngredientItem[]
  effects: PesticideEffectItem[]
  incompatibilities: PesticideIncompatibilityItem[]
}

export type IngredientDetail = IngredientListItem & {
  nameEn: string | null
  ingredientGroup: string | null
  description: string | null
  pesticides: Array<{
    contentLabel: string | null
    pesticide: {
      id: string
      name: string
      slug: string
      formulationTypeName: string | null
    }
  }>
}

export type PaginatedResult<T> = {
  items: T[]
  nextCursor: string | null
}

// ── 病害虫一覧 ────────────────────────────────────────────────────────

export async function listDiseasePests(params: {
  cursor?: string
  limit?: number
  category?: DiseasePestCategory
  search?: string
  bodySizeMm?: number
}): Promise<PaginatedResult<DiseasePestListItem>> {
  const limit = params.limit ?? DEFAULT_PAGE_LIMIT
  const safeLimit = Math.min(limit, MAX_PESTICIDE_LIST_LIMIT)

  try {
    const where: Prisma.DiseasePestWhereInput = {}

    if (params.category !== undefined) {
      where.category = params.category
    }
    if (params.search) {
      where.OR = [
        { name: { contains: params.search, mode: 'insensitive' } },
        { nameKana: { contains: params.search, mode: 'insensitive' } },
        { description: { contains: params.search, mode: 'insensitive' } },
      ]
    }
    if (params.bodySizeMm !== undefined && params.bodySizeMm > 0) {
      where.bodySizeMinMm = { lte: params.bodySizeMm }
      where.bodySizeMaxMm = { gte: params.bodySizeMm }
      where.category = { in: ['pest', 'beneficial_insect'] }
    }

    const rows = await prisma.diseasePest.findMany({
      where,
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      select: {
        id: true,
        name: true,
        nameKana: true,
        category: true,
        description: true,
        imageUrl: true,
        slug: true,
      },
      take: safeLimit + 1,
      ...(params.cursor !== undefined
        ? { cursor: { slug: params.cursor }, skip: 1 }
        : {}),
    })

    const hasNext = rows.length > safeLimit
    const items = hasNext ? rows.slice(0, safeLimit) : rows
    const nextCursor = hasNext ? (items[items.length - 1]?.slug ?? null) : null

    return {
      items: items.map(applyImageFallback),
      nextCursor,
    }
  } catch (error) {
    logger.error('listDiseasePests failed', {
      error: error instanceof Error ? error.message : String(error),
    })
    return { items: [], nextCursor: null }
  }
}

// ── 病害虫詳細 ────────────────────────────────────────────────────────

export async function getDiseasePestBySlug(slug: string): Promise<DiseasePestDetail | null> {
  const parsed = slugSchema.safeParse(slug)
  if (!parsed.success) return null

  try {
    const dp = await prisma.diseasePest.findUnique({
      where: { slug: parsed.data },
      select: {
        id: true,
        name: true,
        nameKana: true,
        category: true,
        description: true,
        imageUrl: true,
        slug: true,
        effects: {
          select: {
            preventionLevel: true,
            treatmentLevel: true,
            efficacyLevel: true,
            persistenceLevel: true,
            pesticide: {
              select: {
                id: true,
                name: true,
                slug: true,
                pesticideType: true,
              },
            },
          },
          orderBy: { pesticide: { name: 'asc' } },
        },
      },
    })
    if (!dp) return null

    const withFallback = applyImageFallback(dp)

    return {
      id: withFallback.id,
      name: withFallback.name,
      nameKana: withFallback.nameKana,
      category: withFallback.category,
      description: withFallback.description,
      imageUrl: withFallback.imageUrl,
      slug: withFallback.slug,
      effects: dp.effects.map((e) => ({
        pesticide: {
          id: e.pesticide.id,
          name: e.pesticide.name,
          slug: e.pesticide.slug,
          pesticideType: e.pesticide.pesticideType,
        },
        rating: {
          preventionLevel: e.preventionLevel ?? null,
          treatmentLevel: e.treatmentLevel ?? null,
          efficacyLevel: e.efficacyLevel ?? null,
          persistenceLevel: e.persistenceLevel ?? null,
        },
      })),
    }
  } catch (error) {
    logger.error('getDiseasePestBySlug failed', {
      error: error instanceof Error ? error.message : String(error),
    })
    return null
  }
}

// ── 農薬製品一覧 ──────────────────────────────────────────────────────

export async function listPesticides(params: {
  cursor?: string
  limit?: number
  search?: string
  type?: PesticideType
  diseasePestId?: string
  formulationTypeCode?: string
}): Promise<PaginatedResult<PesticideListItem>> {
  const limit = params.limit ?? DEFAULT_PAGE_LIMIT
  const safeLimit = Math.min(limit, MAX_PESTICIDE_LIST_LIMIT)

  try {
    const where: Prisma.PesticideWhereInput = {}

    if (params.search) {
      where.OR = [
        { name: { contains: params.search, mode: 'insensitive' } },
        { registrationNumber: { contains: params.search, mode: 'insensitive' } },
      ]
    }
    if (params.type !== undefined) {
      where.pesticideType = params.type
    }
    if (params.diseasePestId) {
      where.effects = { some: { diseasePestId: params.diseasePestId } }
    }
    if (params.formulationTypeCode) {
      where.formulationType = { is: { code: params.formulationTypeCode } }
    }

    const rows = await prisma.pesticide.findMany({
      where,
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        registrationNumber: true,
        pesticideType: true,
        description: true,
        slug: true,
      },
      take: safeLimit + 1,
      ...(params.cursor !== undefined
        ? { cursor: { slug: params.cursor }, skip: 1 }
        : {}),
    })

    const hasNext = rows.length > safeLimit
    const items = hasNext ? rows.slice(0, safeLimit) : rows
    const nextCursor = hasNext ? (items[items.length - 1]?.slug ?? null) : null

    return { items, nextCursor }
  } catch (error) {
    logger.error('listPesticides failed', {
      error: error instanceof Error ? error.message : String(error),
    })
    return { items: [], nextCursor: null }
  }
}

// ── 農薬製品詳細 ──────────────────────────────────────────────────────

export async function getPesticideBySlug(slug: string): Promise<PesticideDetail | null> {
  const parsed = slugSchema.safeParse(slug)
  if (!parsed.success) return null

  try {
    const p = await prisma.pesticide.findUnique({
      where: { slug: parsed.data },
      select: {
        id: true,
        name: true,
        registrationNumber: true,
        pesticideType: true,
        description: true,
        slug: true,
        formulationType: {
          select: { name: true, code: true },
        },
        ingredients: {
          select: {
            activeIngredient: {
              select: {
                id: true,
                name: true,
                fracCode: true,
                iracCode: true,
                resistanceRisk: true,
                slug: true,
              },
            },
          },
        },
        effects: {
          select: {
            preventionLevel: true,
            treatmentLevel: true,
            efficacyLevel: true,
            persistenceLevel: true,
            diseasePest: {
              select: { id: true, name: true, slug: true },
            },
          },
          orderBy: { diseasePest: { name: 'asc' } },
        },
        incompatibleWith: {
          select: {
            incompatibleWith: {
              select: {
                id: true,
                name: true,
                slug: true,
                formulationType: { select: { name: true } },
              },
            },
          },
          orderBy: { incompatibleWith: { name: 'asc' } },
        },
      },
    })
    if (!p) return null

    return {
      id: p.id,
      name: p.name,
      registrationNumber: p.registrationNumber,
      pesticideType: p.pesticideType,
      description: p.description,
      slug: p.slug,
      formulationType: p.formulationType
        ? { name: p.formulationType.name, code: p.formulationType.code }
        : null,
      activeIngredients: p.ingredients.map((ing) => ({
        id: ing.activeIngredient.id,
        name: ing.activeIngredient.name,
        fracCode: ing.activeIngredient.fracCode,
        iracCode: ing.activeIngredient.iracCode,
        resistanceRisk: ing.activeIngredient.resistanceRisk,
        slug: ing.activeIngredient.slug,
      })),
      effects: p.effects.map((e) => ({
        diseasePest: {
          id: e.diseasePest.id,
          name: e.diseasePest.name,
          slug: e.diseasePest.slug,
        },
        rating: {
          preventionLevel: e.preventionLevel ?? null,
          treatmentLevel: e.treatmentLevel ?? null,
          efficacyLevel: e.efficacyLevel ?? null,
          persistenceLevel: e.persistenceLevel ?? null,
        },
      })),
      incompatibilities: p.incompatibleWith.map((inc) => ({
        id: inc.incompatibleWith.id,
        name: inc.incompatibleWith.name,
        slug: inc.incompatibleWith.slug,
        formulationTypeName: inc.incompatibleWith.formulationType?.name ?? null,
      })),
    }
  } catch (error) {
    logger.error('getPesticideBySlug failed', {
      error: error instanceof Error ? error.message : String(error),
    })
    return null
  }
}

// ── 有効成分一覧 ──────────────────────────────────────────────────────

export async function listActiveIngredients(params: {
  cursor?: string
  limit?: number
  search?: string
}): Promise<PaginatedResult<IngredientListItem>> {
  const limit = params.limit ?? DEFAULT_PAGE_LIMIT
  const safeLimit = Math.min(limit, MAX_PESTICIDE_LIST_LIMIT)

  try {
    const where: Prisma.ActiveIngredientWhereInput = {}

    if (params.search) {
      where.OR = [
        { name: { contains: params.search, mode: 'insensitive' } },
        { nameEn: { contains: params.search, mode: 'insensitive' } },
        { fracCode: { contains: params.search, mode: 'insensitive' } },
        { iracCode: { contains: params.search, mode: 'insensitive' } },
      ]
    }

    const rows = await prisma.activeIngredient.findMany({
      where,
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        nameEn: true,
        fracCode: true,
        iracCode: true,
        resistanceRisk: true,
        slug: true,
      },
      take: safeLimit + 1,
      ...(params.cursor !== undefined
        ? { cursor: { slug: params.cursor }, skip: 1 }
        : {}),
    })

    const hasNext = rows.length > safeLimit
    const items = hasNext ? rows.slice(0, safeLimit) : rows
    const nextCursor = hasNext ? (items[items.length - 1]?.slug ?? null) : null

    return { items, nextCursor }
  } catch (error) {
    logger.error('listActiveIngredients failed', {
      error: error instanceof Error ? error.message : String(error),
    })
    return { items: [], nextCursor: null }
  }
}

// ── 有効成分詳細 ──────────────────────────────────────────────────────

export async function getActiveIngredientBySlug(slug: string): Promise<IngredientDetail | null> {
  const parsed = slugSchema.safeParse(slug)
  if (!parsed.success) return null

  try {
    const ing = await prisma.activeIngredient.findUnique({
      where: { slug: parsed.data },
      select: {
        id: true,
        name: true,
        nameEn: true,
        fracCode: true,
        iracCode: true,
        resistanceRisk: true,
        slug: true,
        ingredientGroup: true,
        description: true,
        pesticides: {
          select: {
            contentLabel: true,
            pesticide: {
              select: {
                id: true,
                name: true,
                slug: true,
                formulationType: { select: { name: true } },
              },
            },
          },
        },
      },
    })
    if (!ing) return null

    return {
      id: ing.id,
      name: ing.name,
      nameEn: ing.nameEn,
      fracCode: ing.fracCode,
      iracCode: ing.iracCode,
      resistanceRisk: ing.resistanceRisk,
      slug: ing.slug,
      ingredientGroup: ing.ingredientGroup,
      description: ing.description,
      pesticides: ing.pesticides.map((p) => ({
        contentLabel: p.contentLabel,
        pesticide: {
          id: p.pesticide.id,
          name: p.pesticide.name,
          slug: p.pesticide.slug,
          formulationTypeName: p.pesticide.formulationType?.name ?? null,
        },
      })),
    }
  } catch (error) {
    logger.error('getActiveIngredientBySlug failed', {
      error: error instanceof Error ? error.message : String(error),
    })
    return null
  }
}

// ── 有効成分のtype正規化用スキーマ（PesticideType enum） ─────────────

/**
 * クエリパラメータの type を PesticideType enum に正規化する。
 * normalizePesticideType（herbicide→other変換）は Web 互換のため同様に適用する。
 */
export function parsePesticideTypeParam(raw: string | null): PesticideType | undefined {
  if (!raw) return undefined
  const normalized = normalizePesticideType(raw)
  if (!normalized) return undefined
  const result = z.nativeEnum(PesticideType).safeParse(normalized)
  return result.success ? result.data : undefined
}
