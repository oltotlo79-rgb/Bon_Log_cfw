/**
 * @module lib/services/hormone-read-service
 * モバイル API v1 向けの植物ホルモンガイド読み取りサービス。
 *
 * Web の lib/actions/hormone と同等のクエリを提供する。
 * 件数が少ないため全件返却（カーソルなし）。
 *
 * 'use server' を付けない（API route から呼ばれる services 層）。
 * import 'server-only' で誤った client 側利用を防ぐ。
 */
import 'server-only'

import { prisma } from '@/lib/db'
import logger from '@/lib/logger'
import { HormoneCategory } from '@prisma/client'
import {
  MAX_HORMONE_LIST_LIMIT,
  MAX_HORMONE_INTERACTION_LIMIT,
  MAX_HORMONE_TECHNIQUE_LIMIT,
  MAX_HORMONE_COLUMN_LIMIT,
  MAX_HORMONE_SEASONAL_LEVEL_LIMIT,
  MAX_SLUG_LENGTH,
  DEFAULT_PAGE_LIMIT,
  MAX_PAGE_LIMIT,
} from '@/lib/constants/limits'
import { z } from 'zod'

// ── 入力バリデーションスキーマ ────────────────────────────────

export const hormoneCategoryQuerySchema = z.object({
  category: z.nativeEnum(HormoneCategory).optional(),
})

export const slugQuerySchema = z.string().min(1).max(MAX_SLUG_LENGTH)

export const hormoneColumnListQuerySchema = z.object({
  cursor: z.string().min(1).max(MAX_SLUG_LENGTH).optional(),
  limit: z.number().int().min(1).max(MAX_PAGE_LIMIT).optional(),
})

// ── 共通型定義 ───────────────────────────────────────────────

export type PaginatedResult<T> = {
  items: T[]
  nextCursor: string | null
}

// ── 型定義 ─────────────────────────────────────────────────

export type HormoneInteractionItem = {
  id: string
  hormoneAId: string
  hormoneAName: string
  hormoneASlug: string
  hormoneBId: string
  hormoneBName: string
  hormoneBSlug: string
  type: string
  description: string | null
  bonsaiRelevance: string | null
}

export type HormoneTechniqueItem = {
  id: string
  techniqueKey: string
  techniqueNameJa: string
  techniqueNameEn: string | null
  effectType: string
  magnitude: string
  mechanism: string | null
}

export type HormoneTechniqueGroupEffect = {
  hormoneId: string
  hormoneNameJa: string
  hormoneSlug: string
  effectType: string
  magnitude: string
  mechanism: string | null
}

export type HormoneTechniqueGroup = {
  techniqueKey: string
  techniqueNameJa: string
  techniqueNameEn: string | null
  effects: HormoneTechniqueGroupEffect[]
}

// H-5 シミュレーター用型（フィールド名は依頼書 H-5 に厳密準拠）
export type SimulatorHormoneItem = {
  id: string
  slug: string
  name: string
  nameEn: string | null
}

export type SimulatorTechniqueEffectItem = {
  hormoneId: string
  effectType: string
  magnitude: string
}

export type SimulatorTechniqueItem = {
  techniqueKey: string
  nameJa: string
  nameEn: string | null
  effects: SimulatorTechniqueEffectItem[]
}

export type SimulatorSeasonalLevelItem = {
  hormoneId: string
  month: number
  level: string
}

// H-6 / H-7 コラム用型
export type HormoneColumnListItem = {
  id: string
  slug: string
  title: string
  category: string
  publishedAt: string
  sortOrder: number
}

export type HormoneColumnDetail = HormoneColumnListItem & {
  content: string
  createdAt: string
  updatedAt: string
}

// ── ホルモン一覧 ─────────────────────────────────────────────

export async function listHormones(params?: { category?: HormoneCategory }) {
  try {
    const hormones = await prisma.hormoneType.findMany({
      where: params?.category ? { category: params.category } : undefined,
      select: {
        id: true,
        name: true,
        nameEn: true,
        slug: true,
        category: true,
        chemicalFormula: true,
        description: true,
      },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      take: MAX_HORMONE_LIST_LIMIT,
    })
    return { hormones }
  } catch (error) {
    logger.error('listHormones failed', {
      error: error instanceof Error ? error.message : String(error),
    })
    return { hormones: [] }
  }
}

// ── ホルモン詳細（interactions / techniques 付き） ──────────────

export async function getHormoneBySlug(slug: string) {
  try {
    const raw = await prisma.hormoneType.findUnique({
      where: { slug },
      select: {
        id: true,
        name: true,
        nameEn: true,
        slug: true,
        category: true,
        chemicalFormula: true,
        description: true,
        bonsaiRole: true,
        productionSite: true,
        practicalTips: true,
        activationMethod: true,
        effects: {
          select: {
            effectName: true,
            isPromoting: true,
          },
          orderBy: { sortOrder: 'asc' },
        },
        seasonalLevels: {
          select: {
            month: true,
            level: true,
          },
          orderBy: { month: 'asc' },
        },
        // 自ホルモンが A 側の相互作用: B 側ホルモン情報を include
        interactionsA: {
          select: {
            id: true,
            hormoneAId: true,
            hormoneBId: true,
            type: true,
            description: true,
            bonsaiRelevance: true,
            hormoneB: { select: { name: true, slug: true } },
          },
          orderBy: { sortOrder: 'asc' },
        },
        // 自ホルモンが B 側の相互作用: A 側ホルモン情報を include
        interactionsB: {
          select: {
            id: true,
            hormoneAId: true,
            hormoneBId: true,
            type: true,
            description: true,
            bonsaiRelevance: true,
            hormoneA: { select: { name: true, slug: true } },
          },
          orderBy: { sortOrder: 'asc' },
        },
        techniques: {
          select: {
            id: true,
            techniqueSlug: true,
            techniqueName: true,
            techniqueNameEn: true,
            effectType: true,
            magnitude: true,
            mechanism: true,
          },
          orderBy: { sortOrder: 'asc' },
        },
      },
    })

    if (!raw) return null

    // interactionsA（自 = A 側）と interactionsB（自 = B 側）を統一形式にマージ
    const interactionsFromA: HormoneInteractionItem[] = raw.interactionsA.map((ia) => ({
      id: ia.id,
      hormoneAId: ia.hormoneAId,
      hormoneAName: raw.name,
      hormoneASlug: raw.slug,
      hormoneBId: ia.hormoneBId,
      hormoneBName: ia.hormoneB.name,
      hormoneBSlug: ia.hormoneB.slug,
      type: ia.type,
      description: ia.description,
      bonsaiRelevance: ia.bonsaiRelevance,
    }))

    const interactionsFromB: HormoneInteractionItem[] = raw.interactionsB.map((ib) => ({
      id: ib.id,
      hormoneAId: ib.hormoneAId,
      hormoneAName: ib.hormoneA.name,
      hormoneASlug: ib.hormoneA.slug,
      hormoneBId: ib.hormoneBId,
      hormoneBName: raw.name,
      hormoneBSlug: raw.slug,
      type: ib.type,
      description: ib.description,
      bonsaiRelevance: ib.bonsaiRelevance,
    }))

    const interactions: HormoneInteractionItem[] = [...interactionsFromA, ...interactionsFromB]

    const techniques: HormoneTechniqueItem[] = raw.techniques.map((t) => ({
      id: t.id,
      techniqueKey: t.techniqueSlug,
      techniqueNameJa: t.techniqueName,
      techniqueNameEn: t.techniqueNameEn,
      effectType: t.effectType,
      magnitude: t.magnitude,
      mechanism: t.mechanism,
    }))

    return {
      id: raw.id,
      name: raw.name,
      nameEn: raw.nameEn,
      slug: raw.slug,
      category: raw.category,
      chemicalFormula: raw.chemicalFormula,
      description: raw.description,
      bonsaiRole: raw.bonsaiRole,
      productionSite: raw.productionSite,
      practicalTips: raw.practicalTips,
      activationMethod: raw.activationMethod,
      effects: raw.effects,
      seasonalLevels: raw.seasonalLevels,
      interactions,
      techniques,
    }
  } catch (error) {
    logger.error('getHormoneBySlug failed', {
      error: error instanceof Error ? error.message : String(error),
    })
    return null
  }
}

// ── 全ホルモン相互作用一覧（H-3） ─────────────────────────────

export async function listHormoneInteractions(): Promise<{ items: HormoneInteractionItem[] }> {
  try {
    const rows = await prisma.hormoneInteraction.findMany({
      select: {
        id: true,
        hormoneAId: true,
        hormoneBId: true,
        type: true,
        description: true,
        bonsaiRelevance: true,
        hormoneA: { select: { name: true, slug: true } },
        hormoneB: { select: { name: true, slug: true } },
      },
      orderBy: { sortOrder: 'asc' },
      take: MAX_HORMONE_INTERACTION_LIMIT,
    })

    return {
      items: rows.map((row) => ({
        id: row.id,
        hormoneAId: row.hormoneAId,
        hormoneAName: row.hormoneA.name,
        hormoneASlug: row.hormoneA.slug,
        hormoneBId: row.hormoneBId,
        hormoneBName: row.hormoneB.name,
        hormoneBSlug: row.hormoneB.slug,
        type: row.type,
        description: row.description,
        bonsaiRelevance: row.bonsaiRelevance,
      })),
    }
  } catch (error) {
    logger.error('listHormoneInteractions failed', {
      error: error instanceof Error ? error.message : String(error),
    })
    return { items: [] }
  }
}

// ── 全技法×ホルモン効果一覧（技法単位グループ化、H-4） ─────────

/**
 * HormoneTechnique をすべて取得し、techniqueSlug 単位でインメモリグループ化して返す。
 *
 * HormoneTechnique モデルには技法レベルの description フィールドが存在しないため
 * 技法グループの description は含まない（実データに忠実、捏造しない）。
 */
export async function listHormoneTechniques(): Promise<{ items: HormoneTechniqueGroup[] }> {
  try {
    const rows = await prisma.hormoneTechnique.findMany({
      select: {
        techniqueSlug: true,
        techniqueName: true,
        techniqueNameEn: true,
        effectType: true,
        magnitude: true,
        mechanism: true,
        hormone: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
      },
      orderBy: [{ techniqueSlug: 'asc' }, { sortOrder: 'asc' }],
      take: MAX_HORMONE_TECHNIQUE_LIMIT,
    })

    // techniqueSlug 単位でグループ化（最大 ~9 技法 × ~9 ホルモン = 低コスト）
    const groupMap = new Map<string, HormoneTechniqueGroup>()

    for (const row of rows) {
      const key = row.techniqueSlug
      let group = groupMap.get(key)
      if (!group) {
        group = {
          techniqueKey: row.techniqueSlug,
          techniqueNameJa: row.techniqueName,
          techniqueNameEn: row.techniqueNameEn,
          effects: [],
        }
        groupMap.set(key, group)
      }
      group.effects.push({
        hormoneId: row.hormone.id,
        hormoneNameJa: row.hormone.name,
        hormoneSlug: row.hormone.slug,
        effectType: row.effectType,
        magnitude: row.magnitude,
        mechanism: row.mechanism,
      })
    }

    return { items: Array.from(groupMap.values()) }
  } catch (error) {
    logger.error('listHormoneTechniques failed', {
      error: error instanceof Error ? error.message : String(error),
    })
    return { items: [] }
  }
}

// ── シミュレーター用データ一括取得（H-5） ────────────────────

/**
 * シミュレーター画面向けに全ホルモン・全技法効果・全月別活性を Promise.all で並列取得して返す。
 *
 * techniques は techniqueSlug 単位でグループ化。フィールド名は依頼書 H-5 に準拠:
 *   techniqueSlug → techniqueKey, techniqueName → nameJa, techniqueNameEn → nameEn。
 * HormoneType.nameEn は Prisma スキーマ上 String?（nullable）のため null 許容で返す。
 */
export async function getHormoneSimulatorData(): Promise<{
  hormones: SimulatorHormoneItem[]
  techniques: SimulatorTechniqueItem[]
  seasonalLevels: SimulatorSeasonalLevelItem[]
}> {
  try {
    const [hormoneRows, techniqueRows, seasonalLevelRows] = await Promise.all([
      prisma.hormoneType.findMany({
        select: { id: true, slug: true, name: true, nameEn: true },
        orderBy: { sortOrder: 'asc' },
        take: MAX_HORMONE_LIST_LIMIT,
      }),
      prisma.hormoneTechnique.findMany({
        select: {
          techniqueSlug: true,
          techniqueName: true,
          techniqueNameEn: true,
          hormoneId: true,
          effectType: true,
          magnitude: true,
          sortOrder: true,
        },
        orderBy: [{ techniqueSlug: 'asc' }, { sortOrder: 'asc' }],
        take: MAX_HORMONE_TECHNIQUE_LIMIT,
      }),
      prisma.hormoneSeasonalLevel.findMany({
        select: { hormoneId: true, month: true, level: true },
        orderBy: [{ hormoneId: 'asc' }, { month: 'asc' }],
        take: MAX_HORMONE_SEASONAL_LEVEL_LIMIT,
      }),
    ])

    // techniqueSlug 単位でグループ化
    const techniqueMap = new Map<string, SimulatorTechniqueItem>()
    for (const row of techniqueRows) {
      const key = row.techniqueSlug
      let group = techniqueMap.get(key)
      if (!group) {
        group = {
          techniqueKey: row.techniqueSlug,
          nameJa: row.techniqueName,
          nameEn: row.techniqueNameEn,
          effects: [],
        }
        techniqueMap.set(key, group)
      }
      group.effects.push({
        hormoneId: row.hormoneId,
        effectType: row.effectType,
        magnitude: row.magnitude,
      })
    }

    return {
      hormones: hormoneRows.map((h) => ({
        id: h.id,
        slug: h.slug,
        name: h.name,
        nameEn: h.nameEn,
      })),
      techniques: Array.from(techniqueMap.values()),
      seasonalLevels: seasonalLevelRows.map((s) => ({
        hormoneId: s.hormoneId,
        month: s.month,
        level: s.level,
      })),
    }
  } catch (error) {
    logger.error('getHormoneSimulatorData failed', {
      error: error instanceof Error ? error.message : String(error),
    })
    return { hormones: [], techniques: [], seasonalLevels: [] }
  }
}

// ── ホルモンコラム一覧（カーソルページネーション、H-6） ────────

export async function listHormoneColumns(params: {
  cursor?: string
  limit?: number
}): Promise<PaginatedResult<HormoneColumnListItem>> {
  const limit = Math.min(params.limit ?? DEFAULT_PAGE_LIMIT, MAX_HORMONE_COLUMN_LIMIT)

  try {
    const rows = await prisma.hormoneColumn.findMany({
      where: { publishedAt: { not: null } },
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
    logger.error('listHormoneColumns failed', {
      error: error instanceof Error ? error.message : String(error),
    })
    return { items: [], nextCursor: null }
  }
}

// ── ホルモンコラム詳細（H-7） ─────────────────────────────────

export async function getHormoneColumnBySlug(slug: string): Promise<HormoneColumnDetail | null> {
  const parsed = slugQuerySchema.safeParse(slug)
  if (!parsed.success) return null

  try {
    const row = await prisma.hormoneColumn.findUnique({
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
    logger.error('getHormoneColumnBySlug failed', {
      error: error instanceof Error ? error.message : String(error),
    })
    return null
  }
}
