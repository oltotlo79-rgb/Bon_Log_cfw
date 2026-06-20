/**
 * @module lib/services/hormone-read-service
 * モバイル API v1 向けの植物ホルモンガイド読み取りサービス。
 *
 * Web の lib/actions/hormone と同等のクエリを提供する。
 * 件数が少ないため全件返却（カーソルなし）。
 *
 * interactions / techniques は本バッチ対象外のため詳細には含めない。
 * getHormoneBySlug は effects と seasonalLevels のみ include する。
 *
 * 'use server' を付けない（API route から呼ばれる services 層）。
 * import 'server-only' で誤った client 側利用を防ぐ。
 */
import 'server-only'

import { prisma } from '@/lib/db'
import logger from '@/lib/logger'
import { HormoneCategory } from '@prisma/client'
import { MAX_HORMONE_LIST_LIMIT, MAX_SLUG_LENGTH } from '@/lib/constants/limits'
import { z } from 'zod'

// ── 入力バリデーションスキーマ ────────────────────────────────

export const hormoneCategoryQuerySchema = z.object({
  category: z.nativeEnum(HormoneCategory).optional(),
})

export const slugQuerySchema = z.string().min(1).max(MAX_SLUG_LENGTH)

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

// ── ホルモン詳細 ─────────────────────────────────────────────

export async function getHormoneBySlug(slug: string) {
  try {
    const hormone = await prisma.hormoneType.findUnique({
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
      },
    })
    return hormone
  } catch (error) {
    logger.error('getHormoneBySlug failed', {
      error: error instanceof Error ? error.message : String(error),
    })
    return null
  }
}
