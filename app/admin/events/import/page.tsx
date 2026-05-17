/**
 * 外部イベントインポートページ
 *
 * bonsai.co.jpからイベント情報をスクレイピングし、
 * 管理者が確認・選択してインポートする機能を提供
 */

import { isAdmin } from '@/lib/actions/admin'
import { redirect } from 'next/navigation'
import { ROUTE_FEED } from '@/lib/constants/routes'
import Link from 'next/link'
import { EventImportClient } from './EventImportClient'

export const metadata = {
  title: '外部イベントインポート - BON-LOG 管理',
}

export default async function AdminEventImportPage() {
  const isAdminUser = await isAdmin()
  if (!isAdminUser) {
    redirect(ROUTE_FEED)
  }

  return (
    <div className="space-y-6">
      {/* ヘッダー */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">外部イベントインポート</h1>
          <p className="text-sm text-muted-foreground mt-1">
            bonsai.co.jp からイベント情報を取得してインポートします
          </p>
        </div>
        <Link
          href="/admin/events"
          className="px-4 py-2 border rounded-lg hover:bg-muted"
        >
          イベント管理に戻る
        </Link>
      </div>

      {/* 注意事項 */}
      <div className="bg-muted/50 border border-border rounded-lg p-4">
        <div className="flex items-start gap-3">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5 text-muted-foreground flex-shrink-0 mt-0.5">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
          <div className="text-sm text-muted-foreground">
            <p className="font-medium">ご利用にあたっての注意</p>
            <ul className="mt-1 list-disc list-inside space-y-1">
              <li>外部サイトからの情報取得は、利用規約を遵守して行ってください</li>
              <li>日付のパースが正確でない場合があります。インポート前に確認してください</li>
              <li>重複の可能性があるイベントは黄色で表示されます</li>
            </ul>
          </div>
        </div>
      </div>

      {/* インポートUI（クライアントコンポーネント） */}
      <EventImportClient />
    </div>
  )
}
