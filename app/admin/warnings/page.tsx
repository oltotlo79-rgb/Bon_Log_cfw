import { getWarnings } from '@/lib/actions/admin/warnings'
import { DEFAULT_PAGE_LIMIT } from '@/lib/constants/limits'
import { WarningsList } from './WarningsList'
import { parseAdminCursor } from '@/lib/utils/admin-cursor'
import { CursorPagination } from '@/components/admin/CursorPagination'
import type { WarningLevel } from '@prisma/client'

export const metadata = {
  title: '警告管理 - BON-LOG 管理',
}

interface PageProps {
  searchParams: Promise<{
    /** 警告レベルフィルター */
    level?: WarningLevel
    /** 有効/無効フィルター */
    isActive?: string
    /** ユーザー検索 */
    search?: string
    /** ページネーション用カーソル */
    cursor?: string
    /** 経由した cursor のリスト（戻る操作用） */
    trail?: string
  }>
}

/**
 * 管理者用警告管理ページコンポーネント
 * 警告一覧をテーブル形式で表示し、統計カード・フィルタリング・警告発行機能を提供する
 *
 * @param searchParams - URLのクエリパラメータ
 * @returns 警告管理ページのJSX要素
 */
export default async function AdminWarningsPage({ searchParams }: PageProps) {
  const params = await searchParams
  const level = params.level
  const isActive = params.isActive === 'true' ? true : params.isActive === 'false' ? false : undefined
  const search = params.search
  const { cursor, trail } = parseAdminCursor(params)

  const result = await getWarnings({
    level,
    isActive,
    search,
    limit: DEFAULT_PAGE_LIMIT,
    cursor,
  })

  if ('error' in result) {
    return <div className="text-destructive">{result.error}</div>
  }

  const { warnings, total, nextCursor } = result

  const totalWarnings = total
  const activeWarnings = warnings.filter((w: { isActive: boolean }) => w.isActive).length

  // レベル別カウント（現在のフィルター結果内）
  const levelCounts = warnings.reduce<Record<string, number>>(
    (acc, w: { level: string }) => {
      acc[w.level] = (acc[w.level] || 0) + 1
      return acc
    },
    {}
  )

  return (
    <>
      <WarningsList
        warnings={warnings}
        total={totalWarnings}
        activeWarnings={activeWarnings}
        levelCounts={levelCounts}
        currentLevel={level}
        currentIsActive={params.isActive}
        currentSearch={search}
      />
      <CursorPagination
        cursor={cursor}
        trail={trail}
        nextCursor={nextCursor}
        baseUrl="/admin/warnings"
        filters={{
          level: level,
          isActive: params.isActive,
          search,
        }}
      />
    </>
  )
}
