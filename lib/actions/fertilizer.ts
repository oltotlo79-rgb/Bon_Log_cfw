/**
 * @module lib/actions/fertilizer
 *
 * 肥料・栄養素・樹種関連の読み取り専用 query を提供する。RSC からの直接 await 用途で
 * `'use server'` ではなく `server-only` モジュールとし、公開 RPC 面を持たない。
 *
 * 認証なしで参照可能（公開 SEO ページ）。sitemap に列挙され未ログイン/crawler が入口にするため、
 * requireAuth を付けると soft 404 / 空表示になる。入力は Zod、件数は上限定数で保護する。
 */
import 'server-only'

import { z } from 'zod'
import { unstable_cache } from 'next/cache'
import { prisma } from '@/lib/db'
import { shouldSkipBuildTimeDbAccess } from '@/lib/build/db-availability'
import { NutrientCategory, TreeCategory, type Prisma } from '@prisma/client'
import { CACHE_TAGS } from '@/lib/cache'
import {
  MAX_NUTRIENT_LIST_LIMIT,
  MAX_FERTILIZER_LIST_LIMIT,
  MAX_TREE_SPECIES_LIMIT,
  MAX_FERTILIZER_COLUMN_LIMIT,
  MAX_SLUG_LENGTH,
  CACHE_TTL_FERTILIZER_MASTER,
} from '@/lib/constants/limits'

// ── 入力スキーマ ──────────────────────────────────────────────────
// slug は URL 経由で渡るため、runtime で形式を検証する
const slugSchema = z.string().min(1).max(MAX_SLUG_LENGTH)
const nutrientCategorySchema = z.nativeEnum(NutrientCategory)
const treeCategorySchema = z.nativeEnum(TreeCategory)

// ── 栄養素 ────────────────────────────────────────────────────────

function getNutrientsCachedImpl(category: NutrientCategory | undefined) {
  return unstable_cache(
    async () => {
      if (shouldSkipBuildTimeDbAccess()) return { nutrients: [] }
      const nutrients = await prisma.fertilizerNutrient.findMany({
        where: category ? { category } : undefined,
        orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
        take: MAX_NUTRIENT_LIST_LIMIT,
      })

      return { nutrients }
    },
    ['fertilizer-nutrients', category ?? 'all'],
    { revalidate: CACHE_TTL_FERTILIZER_MASTER, tags: [CACHE_TAGS.FERTILIZER_MASTER] }
  )
}

export async function getNutrients(params?: { category?: NutrientCategory }) {
  // 境界検証: category が渡されていれば Prisma enum と一致することを確認
  let category: NutrientCategory | undefined
  if (params?.category !== undefined) {
    const parsed = nutrientCategorySchema.safeParse(params.category)
    if (!parsed.success) return { nutrients: [] }
    category = parsed.data
  }

  return getNutrientsCachedImpl(category)()
}

export async function getNutrientBySlug(slug: string) {
  if (shouldSkipBuildTimeDbAccess()) return null
  const parsed = slugSchema.safeParse(slug)
  if (!parsed.success) return null

  return prisma.fertilizerNutrient.findUnique({ where: { slug: parsed.data } })
}

// ── 肥料カテゴリ ──────────────────────────────────────────────────

const getFertilizerCategoriesCached = unstable_cache(
  async () => {
    if (shouldSkipBuildTimeDbAccess()) return { categories: [] }
    const categories = await prisma.fertilizerCategory.findMany({
      orderBy: { sortOrder: 'asc' },
      take: MAX_FERTILIZER_LIST_LIMIT,
    })

    return { categories }
  },
  ['fertilizer-categories'],
  { revalidate: CACHE_TTL_FERTILIZER_MASTER, tags: [CACHE_TAGS.FERTILIZER_MASTER] }
)

export async function getFertilizerCategories() {
  return getFertilizerCategoriesCached()
}

// ── 樹種 ──────────────────────────────────────────────────────────

function getTreeSpeciesCachedImpl(category: TreeCategory | undefined) {
  return unstable_cache(
    async () => {
      if (shouldSkipBuildTimeDbAccess()) return { treeSpecies: [] }
      const treeSpecies = await prisma.treeSpecies.findMany({
        where: category ? { category } : undefined,
        orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
        include: {
          _count: { select: { plans: true } },
        },
        take: MAX_TREE_SPECIES_LIMIT,
      })

      return { treeSpecies }
    },
    ['tree-species', category ?? 'all'],
    { revalidate: CACHE_TTL_FERTILIZER_MASTER, tags: [CACHE_TAGS.FERTILIZER_MASTER] }
  )
}

export async function getTreeSpecies(params?: { category?: TreeCategory }) {
  let category: TreeCategory | undefined
  if (params?.category !== undefined) {
    const parsed = treeCategorySchema.safeParse(params.category)
    if (!parsed.success) return { treeSpecies: [] }
    category = parsed.data
  }

  return getTreeSpeciesCachedImpl(category)()
}

// ── 施肥スケジュール ──────────────────────────────────────────────

export async function getFertilizationSchedule(treeSpeciesSlug: string) {
  if (shouldSkipBuildTimeDbAccess()) return null
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

function getFertilizerColumnsCachedImpl(category: string | undefined) {
  return unstable_cache(
    async () => {
      if (shouldSkipBuildTimeDbAccess()) return { columns: [] }
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
    },
    ['fertilizer-columns', category ?? 'all'],
    { revalidate: CACHE_TTL_FERTILIZER_MASTER, tags: [CACHE_TAGS.FERTILIZER_MASTER] }
  )
}

export async function getFertilizerColumns(params?: { category?: string }) {
  let category: string | undefined
  if (params?.category !== undefined) {
    const parsed = slugSchema.safeParse(params.category)
    if (!parsed.success) return { columns: [] }
    category = parsed.data
  }

  return getFertilizerColumnsCachedImpl(category)()
}

export async function getFertilizerColumnBySlug(slug: string) {
  if (shouldSkipBuildTimeDbAccess()) return null
  const parsed = slugSchema.safeParse(slug)
  if (!parsed.success) return null

  return prisma.fertilizerColumn.findUnique({ where: { slug: parsed.data } })
}
