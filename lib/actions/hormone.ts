/**
 * @module lib/actions/hormone
 *
 * 植物ホルモン関連の読み取り専用 query を提供する。RSC からの直接 await 用途で
 * `'use server'` ではなく `server-only` モジュールとし、公開 RPC 面を持たない。
 *
 * 認証なしで参照可能（公開 SEO ページ）。sitemap に列挙され未ログイン/crawler が入口にするため、
 * requireAuth を付けると soft 404 / 空表示になる。入力は Zod、件数は上限定数で保護する。
 */
import 'server-only'

import { cache } from 'react'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { shouldSkipBuildTimeDbAccess } from '@/lib/build/db-availability'
import { HormoneCategory } from '@prisma/client'
import {
  MAX_HORMONE_LIST_LIMIT,
  MAX_HORMONE_INTERACTION_LIMIT,
  MAX_HORMONE_COLUMN_LIMIT,
  MAX_HORMONE_TECHNIQUE_LIMIT,
  MAX_SLUG_LENGTH,
} from '@/lib/constants/limits'

// ── 入力スキーマ ──────────────────────────────────────────────────
const slugSchema = z.string().min(1).max(MAX_SLUG_LENGTH)
const hormoneCategorySchema = z.nativeEnum(HormoneCategory)
// コラム・技法の category / techniqueSlug は自由文字列だが境界を定める
const categoryStringSchema = z.string().min(1).max(MAX_SLUG_LENGTH)

// ── ホルモン一覧 ────────────────────────────────────────────────

export async function getHormones(params?: { category?: HormoneCategory }) {
  if (shouldSkipBuildTimeDbAccess()) return { hormones: [] }
  let category: HormoneCategory | undefined
  if (params?.category !== undefined) {
    const parsed = hormoneCategorySchema.safeParse(params.category)
    if (!parsed.success) return { hormones: [] }
    category = parsed.data
  }

  const hormones = await prisma.hormoneType.findMany({
    where: category ? { category } : undefined,
    include: {
      _count: { select: { effects: true } },
    },
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    take: MAX_HORMONE_LIST_LIMIT,
  })

  return { hormones }
}

// ── ホルモン詳細 ────────────────────────────────────────────────

// generateMetadata と本体での二重取得を React cache() でリクエスト内 1 回に集約する。
// unstable_cache は standalone 出力（CI は .next/cache を同梱しない）で不安定なため使わない。
const getHormoneBySlugCached = cache((slug: string) =>
  prisma.hormoneType.findUnique({
    where: { slug },
    include: {
      effects: { orderBy: { sortOrder: 'asc' } },
      seasonalLevels: { orderBy: { month: 'asc' } },
      interactionsA: {
        include: { hormoneB: { select: { id: true, name: true, nameEn: true, slug: true, category: true } } },
        orderBy: { sortOrder: 'asc' },
      },
      interactionsB: {
        include: { hormoneA: { select: { id: true, name: true, nameEn: true, slug: true, category: true } } },
        orderBy: { sortOrder: 'asc' },
      },
    },
  }),
)

export async function getHormoneBySlug(slug: string) {
  if (shouldSkipBuildTimeDbAccess()) return null
  const parsed = slugSchema.safeParse(slug)
  if (!parsed.success) return null

  return getHormoneBySlugCached(parsed.data)
}

// ── ホルモン相互作用一覧 ─────────────────────────────────────────

export async function getHormoneInteractions() {
  if (shouldSkipBuildTimeDbAccess()) return { interactions: [] }
  const interactions = await prisma.hormoneInteraction.findMany({
    include: {
      hormoneA: { select: { id: true, name: true, nameEn: true, slug: true, category: true } },
      hormoneB: { select: { id: true, name: true, nameEn: true, slug: true, category: true } },
    },
    orderBy: { sortOrder: 'asc' },
    take: MAX_HORMONE_INTERACTION_LIMIT,
  })

  return { interactions }
}

// ── 特定ホルモンの相互作用 ────────────────────────────────────────

export async function getHormoneInteractionsBySlug(slug: string) {
  if (shouldSkipBuildTimeDbAccess()) return { interactions: [] }
  const parsed = slugSchema.safeParse(slug)
  if (!parsed.success) return { interactions: [] }

  const hormone = await prisma.hormoneType.findUnique({
    where: { slug: parsed.data },
    select: { id: true },
  })

  if (!hormone) return { interactions: [] }

  const interactions = await prisma.hormoneInteraction.findMany({
    where: {
      OR: [
        { hormoneAId: hormone.id },
        { hormoneBId: hormone.id },
      ],
    },
    include: {
      hormoneA: { select: { id: true, name: true, nameEn: true, slug: true, category: true } },
      hormoneB: { select: { id: true, name: true, nameEn: true, slug: true, category: true } },
    },
    orderBy: { sortOrder: 'asc' },
    take: MAX_HORMONE_INTERACTION_LIMIT,
  })

  return { interactions }
}

// ── コラム一覧 ───────────────────────────────────────────────────

export async function getHormoneColumns(params?: { category?: string }) {
  if (shouldSkipBuildTimeDbAccess()) return { columns: [] }
  let category: string | undefined
  if (params?.category !== undefined) {
    const parsed = categoryStringSchema.safeParse(params.category)
    if (!parsed.success) return { columns: [] }
    category = parsed.data
  }

  const columns = await prisma.hormoneColumn.findMany({
    where: {
      publishedAt: { not: null },
      ...(category && { category }),
    },
    orderBy: { sortOrder: 'asc' },
    take: MAX_HORMONE_COLUMN_LIMIT,
  })

  return { columns }
}

// ── コラム詳細 ───────────────────────────────────────────────────

export async function getHormoneColumnBySlug(slug: string) {
  if (shouldSkipBuildTimeDbAccess()) return null
  const parsed = slugSchema.safeParse(slug)
  if (!parsed.success) return null

  return prisma.hormoneColumn.findUnique({ where: { slug: parsed.data } })
}

// ── ホルモン技法マッピング一覧 ─────────────────────────────────────

export async function getHormoneTechniques(params?: { techniqueSlug?: string }) {
  if (shouldSkipBuildTimeDbAccess()) return { techniques: [] }
  let techniqueSlug: string | undefined
  if (params?.techniqueSlug !== undefined) {
    const parsed = slugSchema.safeParse(params.techniqueSlug)
    if (!parsed.success) return { techniques: [] }
    techniqueSlug = parsed.data
  }

  const techniques = await prisma.hormoneTechnique.findMany({
    where: techniqueSlug ? { techniqueSlug } : undefined,
    include: {
      hormone: { select: { id: true, name: true, nameEn: true, slug: true, category: true } },
    },
    orderBy: [{ techniqueSlug: 'asc' }, { sortOrder: 'asc' }],
    take: MAX_HORMONE_TECHNIQUE_LIMIT,
  })

  return { techniques }
}

// ── 特定ホルモンの技法マッピング ──────────────────────────────────

export async function getHormoneTechniquesBySlug(slug: string) {
  if (shouldSkipBuildTimeDbAccess()) return { techniques: [] }
  const parsed = slugSchema.safeParse(slug)
  if (!parsed.success) return { techniques: [] }

  const hormone = await prisma.hormoneType.findUnique({
    where: { slug: parsed.data },
    select: { id: true },
  })
  if (!hormone) return { techniques: [] }

  const techniques = await prisma.hormoneTechnique.findMany({
    where: { hormoneId: hormone.id },
    orderBy: { sortOrder: 'asc' },
    take: MAX_HORMONE_TECHNIQUE_LIMIT,
  })

  return { techniques }
}

// ── 月別活性データ付きホルモン一覧（カレンダー用） ───────────────────

export async function getHormonesWithSeasonalLevels() {
  if (shouldSkipBuildTimeDbAccess()) return { hormones: [] }
  const hormones = await prisma.hormoneType.findMany({
    where: { category: 'major' },
    include: {
      seasonalLevels: { orderBy: { month: 'asc' } },
    },
    orderBy: { sortOrder: 'asc' },
    take: MAX_HORMONE_LIST_LIMIT,
  })

  return { hormones }
}

// ── シミュレーター用データ一括取得 ────────────────────────────────

export async function getSimulatorData() {
  if (shouldSkipBuildTimeDbAccess()) return { hormones: [], techniques: [], seasonalLevels: [] }
  const [hormones, techniques, seasonalLevels] = await Promise.all([
    prisma.hormoneType.findMany({
      where: { category: 'major' },
      select: { id: true, name: true, nameEn: true, slug: true },
      orderBy: { sortOrder: 'asc' },
    }),
    prisma.hormoneTechnique.findMany({
      include: { hormone: { select: { slug: true } } },
      orderBy: [{ techniqueSlug: 'asc' }, { sortOrder: 'asc' }],
    }),
    prisma.hormoneSeasonalLevel.findMany({
      orderBy: [{ hormoneId: 'asc' }, { month: 'asc' }],
    }),
  ])

  return { hormones, techniques, seasonalLevels }
}
