/**
 * @file 農薬データ管理ページ
 * @description 農薬データの一覧表示、検索、フィルタリング、追加・編集・削除機能を提供する管理者専用ページ。
 * @route /admin/pesticide-data
 */

import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { ROUTE_LOGIN } from '@/lib/constants/routes'
import {
  FlaskConical,
  Bug,
  Atom,
} from 'lucide-react'
import { getAdminPesticides } from '@/lib/actions/admin/pesticide-data'
import { prisma } from '@/lib/db'
import { isAdmin } from '@/lib/actions/admin'
import { PesticideTable } from './PesticideTable'
import { DEFAULT_PAGE_LIMIT } from '@/lib/constants/limits'
import { parseAdminCursor } from '@/lib/utils/admin-cursor'
import { CursorPagination } from '@/components/admin/CursorPagination'
import { PesticideType } from '@prisma/client'

function isPesticideType(value: string): value is PesticideType {
  return (Object.values(PesticideType) as string[]).includes(value)
}

/**
 * ページメタデータの定義
 */
export const metadata = {
  title: '農薬データ管理 - BON-LOG 管理',
}

/**
 * 静的生成を無効化
 */
export const dynamic = 'force-dynamic'

/**
 * ページコンポーネントのProps型定義
 */
interface PageProps {
  searchParams: Promise<{
    search?: string
    pesticideType?: string
    cursor?: string
    trail?: string
  }>
}

/**
 * 農薬データ管理ページコンポーネント
 *
 * @param searchParams - URLのクエリパラメータ
 * @returns 農薬データ管理ページのJSX要素
 */
export default async function PesticideDataPage({ searchParams }: PageProps) {
  const params = await searchParams
  const search = params.search || ''
  const pesticideType = params.pesticideType || ''
  const { cursor, trail } = parseAdminCursor(params)

  // 管理者権限チェック
  const isAdminUser = await isAdmin()
  if (!isAdminUser) {
    redirect(ROUTE_LOGIN)
  }

  const normalizedPesticideType = isPesticideType(pesticideType) ? pesticideType : undefined

  const [pesticidesResult, totalPesticides, totalEffects, totalIngredients] = await Promise.all([
    getAdminPesticides({
      search: search || undefined,
      pesticideType: normalizedPesticideType,
      limit: DEFAULT_PAGE_LIMIT,
      cursor,
    }),
    prisma.pesticide.count(),
    prisma.pesticideEffect.count(),
    prisma.activeIngredient.count(),
  ])

  // 権限エラーチェック
  if ('error' in pesticidesResult) {
    redirect(ROUTE_LOGIN)
  }

  const { pesticides, total, nextCursor } = pesticidesResult

  return (
    <div className="space-y-6">
      {/* ページタイトル */}
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <FlaskConical className="w-7 h-7" />
          農薬データ管理
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          農薬データの登録・編集・削除を管理します
        </p>
      </div>

      {/* 統計サマリーカード */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-card rounded-lg border p-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400 rounded-lg">
              <FlaskConical className="w-5 h-5" />
            </div>
            <span className="text-sm text-muted-foreground">登録農薬数</span>
          </div>
          <p className="text-3xl font-bold">{totalPesticides.toLocaleString()}</p>
        </div>

        <div className="bg-card rounded-lg border p-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400 rounded-lg">
              <Bug className="w-5 h-5" />
            </div>
            <span className="text-sm text-muted-foreground">登録効果数</span>
          </div>
          <p className="text-3xl font-bold">{totalEffects.toLocaleString()}</p>
        </div>

        <div className="bg-card rounded-lg border p-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400 rounded-lg">
              <Atom className="w-5 h-5" />
            </div>
            <span className="text-sm text-muted-foreground">登録有効成分数</span>
          </div>
          <p className="text-3xl font-bold">{totalIngredients.toLocaleString()}</p>
        </div>
      </div>

      {/* 農薬テーブル（Client Component） */}
      <Suspense fallback={<div className="text-sm text-muted-foreground">農薬データを読み込み中...</div>}>
        <PesticideTable
          pesticides={pesticides.map(p => ({
            id: p.id,
            name: p.name,
            registrationNumber: p.registrationNumber,
            pesticideType: p.pesticideType,
            formulationName: p.formulationType?.name || null,
            effectsCount: p._count.effects,
            ingredientsCount: p._count.ingredients,
            updatedAt: p.updatedAt instanceof Date ? p.updatedAt.toISOString() : String(p.updatedAt),
          }))}
          search={search}
          pesticideType={pesticideType}
        />
      </Suspense>

      <CursorPagination
        cursor={cursor}
        trail={trail}
        nextCursor={nextCursor}
        total={total}
        baseUrl="/admin/pesticide-data"
        filters={{ search, pesticideType }}
      />
    </div>
  )
}
