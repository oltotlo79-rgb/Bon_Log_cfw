/**
 * @module lib/actions/fertilizer
 *
 * 肥料・栄養素・樹種関連の読み取り専用 query を提供する。RSC からの直接 await 用途で
 * `'use server'` ではなく `server-only` モジュールとし、公開 RPC 面を持たない。
 */
import 'server-only'

import { z } from 'zod'
import { prisma } from '@/lib/db'
import { requireAuth } from '@/lib/actions/utils'
import { NutrientCategory, TreeCategory, type Prisma } from '@prisma/client'
import {
  MAX_NUTRIENT_LIST_LIMIT,
  MAX_FERTILIZER_LIST_LIMIT,
  MAX_TREE_SPECIES_LIMIT,
  MAX_FERTILIZER_COLUMN_LIMIT,
  MAX_SLUG_LENGTH,
} from '@/lib/constants/limits'

// ── 入力スキーマ ──────────────────────────────────────────────────
// slug は URL 経由で渡るため、runtime で形式を検証する
const slugSchema = z.string().min(1).max(MAX_SLUG_LENGTH)
const nutrientCategorySchema = z.nativeEnum(NutrientCategory)
const treeCategorySchema = z.nativeEnum(TreeCategory)

// ── 栄養素 ────────────────────────────────────────────────────────

export async function getNutrients(params?: { category?: NutrientCategory }) {
  const authResult = await requireAuth()
  if ('error' in authResult) return { nutrients: [], error: authResult.error }

  // 境界検証: category が渡されていれば Prisma enum と一致することを確認
  let category: NutrientCategory | undefined
  if (params?.category !== undefined) {
    const parsed = nutrientCategorySchema.safeParse(params.category)
    if (!parsed.success) return { nutrients: [] }
    category = parsed.data
  }

  const nutrients = await prisma.fertilizerNutrient.findMany({
    where: category ? { category } : undefined,
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    take: MAX_NUTRIENT_LIST_LIMIT,
  })

  return { nutrients }
}

export async function getNutrientBySlug(slug: string) {
  const authResult = await requireAuth()
  if ('error' in authResult) return null

  const parsed = slugSchema.safeParse(slug)
  if (!parsed.success) return null

  return prisma.fertilizerNutrient.findUnique({ where: { slug: parsed.data } })
}

// ── 肥料カテゴリ ──────────────────────────────────────────────────

export async function getFertilizerCategories() {
  const authResult = await requireAuth()
  if ('error' in authResult) return { categories: [], error: authResult.error }

  const categories = await prisma.fertilizerCategory.findMany({
    orderBy: { sortOrder: 'asc' },
    take: MAX_FERTILIZER_LIST_LIMIT,
  })

  return { categories }
}

// ── 樹種 ──────────────────────────────────────────────────────────

export async function getTreeSpecies(params?: { category?: TreeCategory }) {
  const authResult = await requireAuth()
  if ('error' in authResult) return { treeSpecies: [], error: authResult.error }

  let category: TreeCategory | undefined
  if (params?.category !== undefined) {
    const parsed = treeCategorySchema.safeParse(params.category)
    if (!parsed.success) return { treeSpecies: [] }
    category = parsed.data
  }

  const treeSpecies = await prisma.treeSpecies.findMany({
    where: category ? { category } : undefined,
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    include: {
      _count: { select: { plans: true } },
    },
    take: MAX_TREE_SPECIES_LIMIT,
  })

  return { treeSpecies }
}

// ── 施肥スケジュール ──────────────────────────────────────────────

export async function getFertilizationSchedule(treeSpeciesSlug: string) {
  const authResult = await requireAuth()
  if ('error' in authResult) return null

  const parsed = slugSchema.safeParse(treeSpeciesSlug)
  if (!parsed.success) return null

  return prisma.treeSpecies.findUnique({
    where: { slug: parsed.data },
    include: {
      plans: { orderBy: { month: 'asc' } },
    },
  })
}

// ── コラム ────────────────────────────────────────────────────────

export async function getFertilizerColumns(params?: { category?: string }) {
  const authResult = await requireAuth()
  if ('error' in authResult) return { columns: [], error: authResult.error }

  let category: string | undefined
  if (params?.category !== undefined) {
    const parsed = slugSchema.safeParse(params.category)
    if (!parsed.success) return { columns: [] }
    category = parsed.data
  }

  const where: Prisma.FertilizerColumnWhereInput = {
    publishedAt: { not: null },
  }
  if (category) {
    where.category = category
  }

  const columns = await prisma.fertilizerColumn.findMany({
    where,
    orderBy: [{ sortOrder: 'asc' }, { title: 'asc' }],
    take: MAX_FERTILIZER_COLUMN_LIMIT,
  })

  return { columns }
}

export async function getFertilizerColumnBySlug(slug: string) {
  const authResult = await requireAuth()
  if ('error' in authResult) return null

  const parsed = slugSchema.safeParse(slug)
  if (!parsed.success) return null

  return prisma.fertilizerColumn.findUnique({ where: { slug: parsed.data } })
}
