import { Suspense } from 'react'
import { getEmailBlacklist, getDeviceBlacklist } from '@/lib/actions/blacklist'
import { BlacklistTabs } from './BlacklistTabs'
import { DEFAULT_PAGE_LIMIT } from '@/lib/constants/limits'

export const metadata = {
  title: 'ブラックリスト管理 - BON-LOG 管理',
}

/**
 * 静的生成を無効化してサーバーサイドレンダリング（SSR）を強制。
 * ブラックリストデータは常に最新状態を表示する必要があるため。
 */
export const dynamic = 'force-dynamic'

interface PageProps {
  /** URLクエリパラメータ（非同期で取得） */
  searchParams: Promise<{
    /** 現在選択されているタブ（email or device） */
    tab?: 'email' | 'device'
    /** 検索キーワード */
    search?: string
    /** カーソル（前ページ末尾のID） */
    cursor?: string
  }>
}

/**
 * ブラックリスト管理ページコンポーネント。
 *
 * @remarks
 * CLAUDE.md ルール「リスト取得はカーソルベースページネーション」に従い、
 * URL パラメータは `page=N` ではなく `cursor=<id>` を用いる。
 * 「前へ」は履歴戻し（router.back）で実装する方針。
 */
export default async function BlacklistPage({ searchParams }: PageProps) {
  const params = await searchParams
  const tab = params.tab || 'email'
  const search = params.search || ''
  const cursor = params.cursor
  const limit = DEFAULT_PAGE_LIMIT

  // アクティブタブのみカーソル/検索を渡し、非アクティブタブは初期ページを取得する。
  const emailResult = await getEmailBlacklist({
    search: tab === 'email' ? search : undefined,
    limit,
    cursor: tab === 'email' ? cursor : undefined,
  })

  const deviceResult = await getDeviceBlacklist({
    search: tab === 'device' ? search : undefined,
    limit,
    cursor: tab === 'device' ? cursor : undefined,
  })

  const emailData =
    emailResult.success && emailResult.data
      ? emailResult.data
      : { items: [], total: 0, nextCursor: undefined as string | undefined }
  const deviceData =
    deviceResult.success && deviceResult.data
      ? deviceResult.data
      : { items: [], total: 0, nextCursor: undefined as string | undefined }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">ブラックリスト管理</h1>
      </div>

      <Suspense fallback={<div className="animate-pulse h-96 bg-muted rounded-lg" />}>
        <BlacklistTabs
          tab={tab}
          search={search}
          cursor={cursor}
          limit={limit}
          emailItems={emailData.items}
          emailTotal={emailData.total}
          emailNextCursor={emailData.nextCursor}
          deviceItems={deviceData.items}
          deviceTotal={deviceData.total}
          deviceNextCursor={deviceData.nextCursor}
        />
      </Suspense>
    </div>
  )
}
