import { Suspense } from 'react'
import { getNgWords, getNgWordStats } from '@/lib/actions/admin/moderation'
import { NgWordList } from './NgWordList'
import { DEFAULT_PAGE_LIMIT } from '@/lib/constants/limits'
import { parseAdminCursor } from '@/lib/utils/admin-cursor'
import { CursorPagination } from '@/components/admin/CursorPagination'

export const metadata = {
  title: 'NGワード管理 - BON-LOG 管理',
}

/**
 * 静的生成を無効化してサーバーサイドレンダリング（SSR）を強制
 * NGワードデータは常に最新の状態を表示する必要があるため
 */
export const dynamic = 'force-dynamic'

interface PageProps {
  searchParams: Promise<{
    /** 検索キーワード */
    search?: string
    /** カテゴリフィルター */
    category?: string
    /** ページネーション用カーソル */
    cursor?: string
    /** 経由した cursor のリスト（戻る操作用） */
    trail?: string
  }>
}

/**
 * NGワード管理ページコンポーネント
 *
 * @param searchParams - URLのクエリパラメータ
 * @returns NGワード管理ページのJSX要素
 */
export default async function NgWordsPage({ searchParams }: PageProps) {
  const params = await searchParams
  const search = params.search || ''
  const category = params.category || ''
  const { cursor, trail } = parseAdminCursor(params)

  // 一覧と集計を並列取得。集計は専用の count 関数を使い、全件フェッチを回避。
  const [result, statsResult] = await Promise.all([
    getNgWords({
      search: search || undefined,
      category: category || undefined,
      limit: DEFAULT_PAGE_LIMIT,
      cursor,
    }),
    getNgWordStats(),
  ])

  if ('error' in result) {
    return <div className="text-destructive">{result.error}</div>
  }
  if ('error' in statsResult) {
    return <div className="text-destructive">{statsResult.error}</div>
  }

  const { words, total, nextCursor } = result
  const { total: totalCount, activeCount, inactiveCount } = statsResult

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">NGワード管理</h1>
        <span className="text-sm text-muted-foreground">全 {totalCount} 件</span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-card rounded-lg border p-4">
          <p className="text-sm text-muted-foreground">総登録数</p>
          <p className="text-2xl font-bold">{totalCount}</p>
        </div>
        <div className="bg-card rounded-lg border p-4">
          <p className="text-sm text-muted-foreground">有効</p>
          <p className="text-2xl font-bold text-green-600">{activeCount}</p>
        </div>
        <div className="bg-card rounded-lg border p-4">
          <p className="text-sm text-muted-foreground">無効</p>
          <p className="text-2xl font-bold text-red-600">{inactiveCount}</p>
        </div>
      </div>

      <Suspense fallback={<div className="animate-pulse h-96 bg-muted rounded-lg" />}>
        <NgWordList
          words={words}
          search={search}
          category={category}
        />
      </Suspense>

      <CursorPagination
        cursor={cursor}
        trail={trail}
        nextCursor={nextCursor}
        total={total}
        baseUrl="/admin/ng-words"
        filters={{ search, category }}
      />
    </div>
  )
}
