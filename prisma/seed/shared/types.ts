/**
 * シードデータ共通の型定義。
 *
 * 各シードファイルで散在していた型を集約する。
 */

import type { GenreType } from '@prisma/client'

// ── ジャンル ─────────────────────────────────────────

export type GenreData = {
  name: string
  category: string
  type: GenreType
  sortOrder: number
}

// ── 肥料 ─────────────────────────────────────────────

export type FertilizerAction = 'none' | 'light' | 'moderate' | 'heavy'
export type FertilizerLevel = 'high' | 'balanced' | 'low' | 'none'

export interface MonthPlan {
  month: number
  action: FertilizerAction
  nitrogenLevel: FertilizerLevel | null
  phosphorusLevel: FertilizerLevel | null
  potassiumLevel: FertilizerLevel | null
  recommendedType: string | null
  description: string
  cautionNote: string | null
}

// ── 辞典 ─────────────────────────────────────────────

export type TermSeed = {
  slug: string
  term: string
  reading: string
  description: string
  category: string
  sortOrder: number
}
