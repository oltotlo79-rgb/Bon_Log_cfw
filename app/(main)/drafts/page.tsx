/**
 * @file 下書き一覧ページコンポーネント
 * @description ユーザーが保存した投稿の下書き一覧を表示するページ
 *              - 認証済みユーザーのみアクセス可能
 *              - Server Componentとして実装し、下書き一覧をサーバーサイドで取得
 *              - 下書きの編集、削除、新規投稿への導線を提供
 */

// 下書き一覧を取得するServer Action
import { getDrafts } from '@/lib/actions/draft'

// Next.js のLink コンポーネント - 新規投稿ページへの導線用
import Link from 'next/link'

// 下書きカードコンポーネント - 個々の下書きを表示
import { DraftCard } from '@/components/draft/DraftCard'
// lucide-react アイコン
import { FileText as FileTextIcon, Plus as PlusIcon } from 'lucide-react'
import { ROUTE_FEED } from '@/lib/constants/routes'

/**
 * 下書きの型定義
 */
type Draft = {
  id: string                    // 下書きID
  content: string | null        // 下書き内容
  createdAt: Date               // 作成日時
  updatedAt: Date               // 更新日時
  media: {                      // 添付メディア一覧
    id: string
    url: string
    type: string
  }[]
  genres: {                     // 選択されたジャンル一覧
    genreId: string
    genre: {
      id: string
      name: string
    }
  }[]
}

/**
 * ページのメタデータ定義
 * ブラウザのタブに表示されるタイトルと説明文を設定
 */
export const metadata = {
  title: '下書き - BON-LOG',
  description: 'あなたの下書き一覧',
}

/**
 * 下書き一覧ページのメインコンポーネント
 *
 * @description
 * - proxyにより認証済みユーザーのみアクセス可能
 * - ユーザーの下書き一覧をサーバーサイドで取得
 * - 下書きがある場合はカード形式で一覧表示
 * - 下書きがない場合は空状態の案内を表示
 *
 * @returns 下書き一覧ページのJSX
 */
export default async function DraftsPage() {
  // 下書き一覧を取得（proxyで認証済み、getDraftsが内部でauth処理）
  const result = await getDrafts()

  // エラー時は空配列をデフォルト値として使用
  const drafts = result.success && result.data ? result.data.drafts : []

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* ヘッダーカード */}
      <div className="bg-card rounded-lg border p-4">
        <div className="flex items-center justify-between">
          <div>
            {/* ページタイトル */}
            <h1 className="text-xl font-bold">下書き</h1>

            {/* 下書き件数 */}
            <p className="text-sm text-muted-foreground">
              {drafts.length}件の下書き
            </p>
          </div>

          {/* 新規投稿ボタン - フィードページへ遷移 */}
          <Link
            href={ROUTE_FEED}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
          >
            <PlusIcon className="w-4 h-4" />
            <span>新規投稿</span>
          </Link>
        </div>
      </div>

      {/* 下書きリスト */}
      {drafts.length === 0 ? (
        // 下書きがない場合の空状態表示
        <div className="bg-card rounded-lg border p-8 text-center">
          {/* ファイルアイコン */}
          <FileTextIcon className="w-16 h-16 mx-auto text-muted-foreground mb-4" />

          {/* メインメッセージ */}
          <h2 className="text-lg font-semibold mb-2">下書きがありません</h2>

          {/* 補足説明 */}
          <p className="text-muted-foreground mb-4">
            投稿を作成する際に「下書き保存」をクリックすると、
            ここに保存されます
          </p>

          {/* 投稿作成ボタン */}
          <Link
            href={ROUTE_FEED}
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
          >
            <PlusIcon className="w-4 h-4" />
            <span>投稿を作成</span>
          </Link>
        </div>
      ) : (
        // 下書きカード一覧
        <div className="space-y-4">
          {drafts.map((draft: Draft) => (
            <DraftCard key={draft.id} draft={draft} />
          ))}
        </div>
      )}
    </div>
  )
}
