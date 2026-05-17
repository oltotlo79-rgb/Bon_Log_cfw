/**
 * @module app/api/admin/search/setup/route
 * 全文検索インフラ (pg_trgm 拡張 + GIN index) のセットアップ admin API。
 *
 * 認可: `requireAdmin('search:setup')` でロール別 permission チェック
 * 入力: Zod enum で action を runtime 検証 (任意文字列の流入を遮断)
 * 定数: action 名 / index 名 / message は constants に集約
 */

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAdmin } from '@/lib/actions/utils'
import {
  ERR_AUTH_REQUIRED,
  ERR_SEARCH_EXTENSION_ENABLED,
  ERR_SEARCH_EXTENSION_FAILED,
  ERR_SEARCH_FULL_SETUP_FAILED,
  ERR_SEARCH_FULL_SETUP_OK,
  ERR_SEARCH_INVALID_ACTION,
  ERR_SEARCH_SETUP_FAILED,
  ERR_SEARCH_STATUS_FAILED,
} from '@/lib/constants/errors'
import {
  RECOMMENDED_SEARCH_INDEXES,
  SEARCH_SETUP_ACTIONS,
} from '@/lib/constants/search-setup'
import {
  createSearchIndexes,
  enableExtension,
  getSearchIndexes,
  getSearchStatus,
  setupFulltextSearch,
} from '@/lib/search/fulltext'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'

const setupRequestSchema = z.object({
  action: z.enum(SEARCH_SETUP_ACTIONS),
})

/** GET: 現在の検索 mode、extension の有無、index 一覧、推奨事項を返す。 */
export async function GET() {
  const adminResult = await requireAdmin('search:setup')
  if ('error' in adminResult) {
    const status = adminResult.error === ERR_AUTH_REQUIRED ? 401 : 403
    return NextResponse.json({ error: adminResult.error }, { status })
  }

  try {
    const [status, indexes] = await Promise.all([getSearchStatus(), getSearchIndexes()])
    const existingIndexNames = indexes.map((idx) => idx.name)
    const missingIndexes = RECOMMENDED_SEARCH_INDEXES.filter(
      (idx) => !existingIndexNames.includes(idx),
    )

    return NextResponse.json({
      status: {
        currentMode: status.mode,
        extensionStatus: {
          pg_bigm: status.bigmAvailable,
          pg_trgm: status.trgmAvailable,
        },
        isOptimal: status.trgmAvailable && status.mode === 'trgm' && missingIndexes.length === 0,
      },
      indexes: {
        existing: indexes,
        missing: missingIndexes,
        total: indexes.length,
      },
      recommendations: buildRecommendations(status, missingIndexes.length),
    })
  } catch (error) {
    logger.error('Failed to get search status:', error)
    return NextResponse.json({ error: ERR_SEARCH_STATUS_FAILED }, { status: 500 })
  }
}

/** POST: action enum に応じて extension 有効化 / index 作成 / 全 setup を実行する。 */
export async function POST(request: Request) {
  const adminResult = await requireAdmin('search:setup')
  if ('error' in adminResult) {
    const status = adminResult.error === ERR_AUTH_REQUIRED ? 401 : 403
    return NextResponse.json({ error: adminResult.error }, { status })
  }

  try {
    const body = (await request.json()) as unknown
    const parsed = setupRequestSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: ERR_SEARCH_INVALID_ACTION }, { status: 400 })
    }

    switch (parsed.data.action) {
      case 'enable_extension': {
        const success = await enableExtension('pg_trgm')
        return NextResponse.json({
          success,
          message: success ? ERR_SEARCH_EXTENSION_ENABLED : ERR_SEARCH_EXTENSION_FAILED,
        })
      }
      case 'create_indexes': {
        const result = await createSearchIndexes()
        return NextResponse.json({
          success: result.success,
          message: result.message,
          details: result.details,
        })
      }
      case 'full_setup': {
        const result = await setupFulltextSearch()
        return NextResponse.json({
          success: result.success,
          steps: result.steps,
          message: result.success ? ERR_SEARCH_FULL_SETUP_OK : ERR_SEARCH_FULL_SETUP_FAILED,
        })
      }
    }
  } catch (error) {
    logger.error('Failed to setup search:', error)
    return NextResponse.json({ error: ERR_SEARCH_SETUP_FAILED }, { status: 500 })
  }
}

/** 推奨事項を組み立てる。pg_trgm の有無と missing index 数から日本語メッセージ配列を返す。 */
function buildRecommendations(
  status: { mode: string; bigmAvailable: boolean; trgmAvailable: boolean },
  missingIndexCount: number,
): string[] {
  const recommendations: string[] = []

  if (!status.trgmAvailable) {
    recommendations.push(
      'pg_trgm拡張が有効化されていません。「拡張を有効化」ボタンをクリックしてください。',
    )
  }

  if (status.mode === 'like' && status.trgmAvailable) {
    recommendations.push(
      '環境変数 SEARCH_MODE=trgm を設定することで、全文検索のパフォーマンスが向上します。',
    )
  }

  if (missingIndexCount > 0) {
    recommendations.push(
      `${missingIndexCount}個のGINインデックスが不足しています。「インデックスを作成」ボタンをクリックしてください。`,
    )
  }

  if (recommendations.length === 0) {
    recommendations.push('全文検索は最適な状態で動作しています。')
  }

  return recommendations
}
