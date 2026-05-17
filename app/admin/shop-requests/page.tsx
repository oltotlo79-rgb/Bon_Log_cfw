/**
 * @file 管理者用盆栽園変更リクエスト管理ページ
 * @description ユーザーからの盆栽園情報変更リクエスト一覧を表示し、
 *              承認・却下の管理を行う管理者ページ。
 */

// Next.jsのLinkコンポーネント（クライアントサイドナビゲーション用）
import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
// Next.jsの画像最適化コンポーネント
import Image from 'next/image'
// 盆栽園変更リクエスト一覧取得のServer Action
import { getShopChangeRequests } from '@/lib/actions/shop'
// DBのJsonカラムを型安全に絞り込むヘルパー
import { parseShopChangeRequestedChanges } from '@/lib/services/shop-change-helpers'
// 変更リクエストアクションコンポーネント
import { ShopRequestActions } from './ShopRequestActions'

/**
 * ページメタデータの定義
 * ブラウザのタイトルバーに表示される
 */
export const metadata = {
  title: '盆栽園変更リクエスト - BON-LOG 管理',
}

/**
 * ページコンポーネントのProps型定義
 * URLのクエリパラメータを受け取る
 */
interface PageProps {
  searchParams: Promise<{
    /** リクエストステータスフィルター */
    status?: 'pending' | 'approved' | 'rejected' | 'all'
  }>
}

/**
 * ステータスの日本語ラベル定義
 */
const statusLabels: Record<string, string> = {
  pending: '保留中',
  approved: '承認済み',
  rejected: '却下済み',
}

/**
 * ステータスに応じた色クラス定義
 */
const statusColors: Record<string, string> = {
  pending: 'bg-muted text-muted-foreground',
  approved: 'bg-muted text-muted-foreground',
  rejected: 'bg-muted text-muted-foreground',
}

/**
 * 管理者用盆栽園変更リクエスト管理ページコンポーネント
 * 変更リクエスト一覧をカード形式で表示し、承認/却下操作機能を提供する
 *
 * @param searchParams - URLのクエリパラメータ
 * @returns 変更リクエスト管理ページのJSX要素
 *
 * 処理内容:
 * 1. クエリパラメータからステータスフィルターを取得
 * 2. getShopChangeRequestsでリクエスト一覧を取得
 * 3. ステータスフィルタータブ、リクエストカード一覧を表示
 * 4. 各リクエストには現在値と変更後の値の比較表示
 */
export default async function AdminShopRequestsPage({ searchParams }: PageProps) {
  const params = await searchParams
  const status = params.status || 'pending'

  const result = await getShopChangeRequests({ status })

  if ('error' in result) {
    return <div className="text-destructive">{result.error}</div>
  }

  const { requests } = result

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">盆栽園変更リクエスト</h1>
        <span className="text-sm text-muted-foreground">{requests.length} 件</span>
      </div>

      {/* フィルター */}
      <div className="bg-card rounded-lg border p-4">
        <div className="flex flex-wrap gap-2">
          <Link
            href="/admin/shop-requests?status=pending"
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              status === 'pending'
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted hover:bg-muted/80'
            }`}
          >
            保留中
          </Link>
          <Link
            href="/admin/shop-requests?status=approved"
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              status === 'approved'
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted hover:bg-muted/80'
            }`}
          >
            承認済み
          </Link>
          <Link
            href="/admin/shop-requests?status=rejected"
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              status === 'rejected'
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted hover:bg-muted/80'
            }`}
          >
            却下済み
          </Link>
          <Link
            href="/admin/shop-requests?status=all"
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              status === 'all'
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted hover:bg-muted/80'
            }`}
          >
            すべて
          </Link>
        </div>
      </div>

      {/* リクエスト一覧 */}
      {requests.length === 0 ? (
        <div className="bg-card rounded-lg border p-8 text-center text-muted-foreground">
          {status === 'pending' ? '保留中のリクエストはありません' : 'リクエストはありません'}
        </div>
      ) : (
        <div className="space-y-4">
          {requests.map((request: { id: string; requestedChanges: unknown; status: string; createdAt: Date; reason: string | null; adminComment: string | null; user: { id: string; nickname: string; avatarUrl: string | null }; shop: { id: string; name: string; address: string; [key: string]: unknown } }) => {
            const changes = parseShopChangeRequestedChanges(request.requestedChanges)
            const changeFields = (Object.keys(changes) as Array<keyof typeof changes>).filter((k) => Boolean(changes[k]))

            return (
              <div key={request.id} className="bg-card rounded-lg border p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    {/* リクエスター情報 */}
                    <div className="flex items-center gap-3 mb-3">
                      {request.user.avatarUrl ? (
                        <Image
                          src={request.user.avatarUrl}
                          alt={request.user.nickname}
                          width={40}
                          height={40}
                          className="rounded-full object-cover"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                          <span className="text-muted-foreground">
                            {request.user.nickname.charAt(0)}
                          </span>
                        </div>
                      )}
                      <div>
                        <Link
                          href={`/users/${request.user.id}`}
                          className="font-medium hover:underline"
                        >
                          {request.user.nickname}
                        </Link>
                        <p className="text-xs text-muted-foreground">
                          {new Date(request.createdAt).toLocaleString('ja-JP')}
                        </p>
                      </div>
                      <span
                        className={`ml-auto px-2 py-1 text-xs font-medium rounded ${
                          statusColors[request.status] || 'bg-muted'
                        }`}
                      >
                        {statusLabels[request.status] || request.status}
                      </span>
                    </div>

                    {/* 対象盆栽園 */}
                    <div className="mb-3">
                      <p className="text-sm text-muted-foreground mb-1">対象盆栽園</p>
                      <Link
                        href={`/shops/${request.shop.id}`}
                        className="font-medium text-primary hover:underline"
                      >
                        {request.shop.name}
                      </Link>
                      <p className="text-sm text-muted-foreground">{request.shop.address}</p>
                    </div>

                    {/* 変更内容詳細（現在値 → 変更後） */}
                    <div className="mb-3">
                      <p className="text-sm text-muted-foreground mb-2">変更リクエスト内容</p>
                      <div className="bg-muted/30 rounded-lg p-3 space-y-3">
                        {changeFields.map((field) => {
                          const rawCurrent = request.shop[field]
                          const currentValue = typeof rawCurrent === 'string' ? rawCurrent : null
                          const newValue = changes[field]
                          return (
                            <div key={field} className="text-sm">
                              <div className="font-medium text-muted-foreground mb-1">
                                {fieldLabels[field] || field}
                              </div>
                              <div className="flex items-start gap-2">
                                <div className="flex-1 p-2 bg-muted/50 rounded text-muted-foreground">
                                  <span className="text-xs text-muted-foreground block mb-0.5">現在</span>
                                  <span className="break-all">{currentValue || '（未設定）'}</span>
                                </div>
                                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground self-center" aria-hidden />
                                <div className="flex-1 p-2 bg-muted rounded text-foreground">
                                  <span className="text-xs text-muted-foreground block mb-0.5">変更後</span>
                                  <span className="break-all">{newValue || '（空欄に変更）'}</span>
                                </div>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>

                    {/* 変更理由 */}
                    {request.reason && (
                      <div className="mb-3">
                        <p className="text-sm text-muted-foreground mb-1">変更理由</p>
                        <p className="text-sm bg-muted/50 p-2 rounded">{request.reason}</p>
                      </div>
                    )}

                    {/* 管理者コメント */}
                    {request.adminComment && (
                      <div className="mb-3">
                        <p className="text-sm text-muted-foreground mb-1">管理者コメント</p>
                        <p className="text-sm bg-muted/50 p-2 rounded">
                          {request.adminComment}
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                {/* アクションボタン */}
                {request.status === 'pending' && (
                  <div className="mt-4 pt-4 border-t">
                    <ShopRequestActions
                      requestId={request.id}
                      shopId={request.shop.id}
                      shopName={request.shop.name}
                      changes={changes}
                    />
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

/**
 * 変更フィールドの日本語ラベル定義
 */
const fieldLabels: Record<string, string> = {
  name: '名称',
  address: '住所',
  phone: '電話番号',
  website: 'ウェブサイト',
  businessHours: '営業時間',
  closedDays: '定休日',
}
