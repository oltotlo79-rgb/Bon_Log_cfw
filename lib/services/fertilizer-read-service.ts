/**
 * @module lib/services/fertilizer-read-service
 * モバイル API v1 向けの施肥ガイド読み取りサービス。
 *
 * Web の lib/actions/fertilizer と同等のクエリを提供する。
 * 件数が少ないため全件返却（カーソルなし）。
 *
 * 'use server' を付けない（API route から呼ばれる services 層）。
 * import 'server-only' で誤った client 側利用を防ぐ。
 */
import 'server-only'

import { prisma } from '@/lib/db'
import logger from '@/lib/logger'
import { NutrientCategory, TreeCategory } from '@prisma/client'
import {
  MAX_NUTRIENT_LIST_LIMIT,
  MAX_FERTILIZER_LIST_LIMIT,
  MAX_TREE_SPECIES_LIMIT,
  MAX_FERTILIZER_COLUMN_LIMIT,
  MAX_SLUG_LENGTH,
  DEFAULT_PAGE_LIMIT,
  MAX_PAGE_LIMIT,
} from '@/lib/constants/limits'
import { z } from 'zod'

// ── 入力バリデーションスキーマ ────────────────────────────────

export const nutrientCategoryQuerySchema = z.object({
  category: z.nativeEnum(NutrientCategory).optional(),
})

export const treeCategoryQuerySchema = z.object({
  category: z.nativeEnum(TreeCategory).optional(),
})

export const slugQuerySchema = z.string().min(1).max(MAX_SLUG_LENGTH)

export const fertilizerColumnListQuerySchema = z.object({
  cursor: z.string().min(1).max(MAX_SLUG_LENGTH).optional(),
  limit: z.number().int().min(1).max(MAX_PAGE_LIMIT).optional(),
  category: z.string().min(1).max(MAX_SLUG_LENGTH).optional(),
})

// ── 共通型定義 ─────────────────────────────────────────────

export type PaginatedResult<T> = {
  items: T[]
  nextCursor: string | null
}

// F-1 / F-2 コラム用型
export type FertilizerColumnListItem = {
  id: string
  slug: string
  title: string
  category: string
  publishedAt: string
  sortOrder: number
}

export type FertilizerColumnDetail = FertilizerColumnListItem & {
  content: string
  createdAt: string
  updatedAt: string
}

// ── 栄養素一覧 ────────────────────────────────────────────────

export async function listNutrients(params?: { category?: NutrientCategory }) {
  try {
    const nutrients = await prisma.fertilizerNutrient.findMany({
      where: params?.category ? { category: params.category } : undefined,
      select: {
        id: true,
        name: true,
        symbol: true,
        category: true,
        description: true,
        bonsaiRole: true,
        slug: true,
      },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      take: MAX_NUTRIENT_LIST_LIMIT,
    })
    return { nutrients }
  } catch (error) {
    logger.error('listNutrients failed', {
      error: error instanceof Error ? error.message : String(error),
    })
    return { nutrients: [] }
  }
}

// ── 栄養素詳細 ────────────────────────────────────────────────

export async function getNutrientBySlug(slug: string) {
  try {
    const nutrient = await prisma.fertilizerNutrient.findUnique({
      where: { slug },
      select: {
        id: true,
        name: true,
        symbol: true,
        category: true,
        description: true,
        bonsaiRole: true,
        deficiencySymptoms: true,
        excessSymptoms: true,
        foodSources: true,
        slug: true,
      },
    })
    return nutrient
  } catch (error) {
    logger.error('getNutrientBySlug failed', {
      error: error instanceof Error ? error.message : String(error),
    })
    return null
  }
}

// ── 肥料カテゴリ一覧 ──────────────────────────────────────────

export async function listFertilizerCategories() {
  try {
    const categories = await prisma.fertilizerCategory.findMany({
      select: {
        code: true,
        name: true,
        description: true,
        merit: true,
        demerit: true,
        bonsaiUsage: true,
        slug: true,
      },
      orderBy: { sortOrder: 'asc' },
      take: MAX_FERTILIZER_LIST_LIMIT,
    })
    return { categories }
  } catch (error) {
    logger.error('listFertilizerCategories failed', {
      error: error instanceof Error ? error.message : String(error),
    })
    return { categories: [] }
  }
}

// ── 樹種一覧 ──────────────────────────────────────────────────

export async function listTreeSpecies(params?: { category?: TreeCategory }) {
  try {
    const treeSpecies = await prisma.treeSpecies.findMany({
      where: params?.category ? { category: params.category } : undefined,
      select: {
        id: true,
        name: true,
        category: true,
        fertilizingPolicy: true,
        slug: true,
      },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      take: MAX_TREE_SPECIES_LIMIT,
    })
    return { treeSpecies }
  } catch (error) {
    logger.error('listTreeSpecies failed', {
      error: error instanceof Error ? error.message : String(error),
    })
    return { treeSpecies: [] }
  }
}

// ── 施肥スケジュール ──────────────────────────────────────────

export async function getFertilizationScheduleBySlug(slug: string) {
  try {
    const species = await prisma.treeSpecies.findUnique({
      where: { slug },
      select: {
        id: true,
        name: true,
        slug: true,
        plans: {
          select: {
            month: true,
            action: true,
            nitrogenLevel: true,
            phosphorusLevel: true,
            potassiumLevel: true,
            recommendedType: true,
            description: true,
          },
          orderBy: { month: 'asc' },
        },
      },
    })
    return species
  } catch (error) {
    logger.error('getFertilizationScheduleBySlug failed', {
      error: error instanceof Error ? error.message : String(error),
    })
    return null
  }
}

// ── 施肥コラム一覧（カーソルページネーション、F-1） ─────────────

export async function listFertilizerColumns(params: {
  cursor?: string
  limit?: number
  category?: string
}): Promise<PaginatedResult<FertilizerColumnListItem>> {
  const limit = Math.min(params.limit ?? DEFAULT_PAGE_LIMIT, MAX_FERTILIZER_COLUMN_LIMIT)

  try {
    const rows = await prisma.fertilizerColumn.findMany({
      where: {
        publishedAt: { not: null },
        ...(params.category !== undefined ? { category: params.category } : {}),
      },
      orderBy: [{ sortOrder: 'asc' }, { publishedAt: 'desc' }],
      select: {
        id: true,
        slug: true,
        title: true,
        category: true,
        publishedAt: true,
        sortOrder: true,
      },
      take: limit + 1,
      ...(params.cursor !== undefined ? { cursor: { slug: params.cursor }, skip: 1 } : {}),
    })

    const hasNext = rows.length > limit
    const pageRows = hasNext ? rows.slice(0, limit) : rows
    const nextCursor = hasNext ? (pageRows[pageRows.length - 1]?.slug ?? null) : null

    // DB filter で publishedAt: { not: null } を指定しているため null 行は来ないが、
    // TypeScript の型を絞り込むためにガードを入れる
    const items = pageRows
      .filter((r): r is typeof r & { publishedAt: Date } => r.publishedAt !== null)
      .map((r) => ({
        id: r.id,
        slug: r.slug,
        title: r.title,
        category: r.category,
        publishedAt: r.publishedAt.toISOString(),
        sortOrder: r.sortOrder,
      }))

    return { items, nextCursor }
  } catch (error) {
    logger.error('listFertilizerColumns failed', {
      error: error instanceof Error ? error.message : String(error),
    })
    return { items: [], nextCursor: null }
  }
}

// ── 施肥コラム詳細（F-2） ────────────────────────────────────

export async function getFertilizerColumnBySlug(
  slug: string,
): Promise<FertilizerColumnDetail | null> {
  const parsed = slugQuerySchema.safeParse(slug)
  if (!parsed.success) return null

  try {
    const row = await prisma.fertilizerColumn.findUnique({
      where: { slug: parsed.data },
      select: {
        id: true,
        slug: true,
        title: true,
        content: true,
        category: true,
        publishedAt: true,
        sortOrder: true,
        createdAt: true,
        updatedAt: true,
      },
    })
    if (!row || !row.publishedAt) return null

    return {
      id: row.id,
      slug: row.slug,
      title: row.title,
      category: row.category,
      publishedAt: row.publishedAt.toISOString(),
      sortOrder: row.sortOrder,
      content: row.content,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    }
  } catch (error) {
    logger.error('getFertilizerColumnBySlug failed', {
      error: error instanceof Error ? error.message : String(error),
    })
    return null
  }
}
