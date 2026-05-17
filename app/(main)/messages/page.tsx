/**
 * @file メッセージ一覧ページコンポーネント
 * @description ユーザー間のダイレクトメッセージ会話一覧を表示するページ
 *              - 認証済みユーザーのみアクセス可能
 *              - Server Componentとして実装し、会話一覧をサーバーサイドで取得
 *              - 未読メッセージのインジケーター表示をサポート
 */

// Next.js のLink コンポーネント - クライアントサイドナビゲーション用
import Link from 'next/link'

// Next.js のImage コンポーネント - 最適化されたアバター画像表示
import Image from 'next/image'

// 会話一覧を取得するServer Action
import { getConversations } from '@/lib/actions/message'

// date-fns の相対時間フォーマット関数 - 「3分前」のような表示に使用
import { formatDistanceToNow } from 'date-fns'

// date-fns の日本語ロケール - 日本語での時間表示
import { ja } from 'date-fns/locale'

/**
 * 会話データの型定義
 */
type Conversation = {
  id: string           // 会話ID
  updatedAt: Date      // 最終更新日時
  otherUser?: {        // 相手ユーザーの情報
    id: string
    nickname: string | null
    avatarUrl: string | null
  } | null
  lastMessage?: {      // 最新メッセージ
    content: string
  } | null
  hasUnread: boolean   // 未読メッセージの有無
}

// lucide-react アイコン
import { MessageSquare as MessageSquareIcon } from 'lucide-react'

/**
 * ページのメタデータ定義
 * ブラウザのタブに表示されるタイトルを設定
 */
export const metadata = {
  title: 'メッセージ - BON-LOG',
}

/**
 * メッセージ一覧ページのメインコンポーネント
 *
 * @description
 * - proxyにより認証済みユーザーのみアクセス可能
 * - 会話一覧をサーバーサイドで取得して表示
 * - 各会話には最新メッセージのプレビューと未読インジケーターを表示
 *
 * @returns メッセージ一覧ページのJSX
 */
export default async function MessagesPage() {
  // 会話一覧を取得（proxyで認証済み、getConversationsが内部でauth処理）
  const conversationsResult = await getConversations()
  const conversations = conversationsResult.success ? conversationsResult.data?.conversations ?? [] : []

  return (
    <div className="max-w-2xl mx-auto">
      <div className="bg-card rounded-lg border">
        {/* ヘッダー */}
        <div className="p-4 border-b">
          <h1 className="text-xl font-bold">メッセージ</h1>
        </div>

        {/* 会話一覧 */}
        {conversations.length === 0 ? (
          // 会話がない場合の空状態表示
          <div className="p-8 text-center">
            {/* メッセージアイコン */}
            <MessageSquareIcon className="w-12 h-12 text-muted-foreground mx-auto mb-4" />

            {/* メインメッセージ */}
            <p className="text-muted-foreground mb-4">
              まだメッセージはありません
            </p>

            {/* 補足説明 */}
            <p className="text-sm text-muted-foreground">
              ユーザーのプロフィールページから<br />
              メッセージを送ることができます
            </p>
          </div>
        ) : (
          // 会話リスト表示
          <div className="divide-y">
            {conversations.map((conversation: Conversation) => (
              <Link
                key={conversation.id}
                href={`/messages/${conversation.id}`}
                className="flex items-center gap-3 p-4 hover:bg-muted/50 transition-colors"
              >
                {/* アバター画像 */}
                {conversation.otherUser?.avatarUrl ? (
                  <Image
                    src={conversation.otherUser.avatarUrl}
                    alt={conversation.otherUser.nickname || ''}
                    width={48}
                    height={48}
                    className="rounded-full"
                  />
                ) : (
                  // アバターがない場合のフォールバック（頭文字表示）
                  <div className="w-12 h-12 bg-muted rounded-full flex items-center justify-center">
                    <span className="text-lg text-muted-foreground">
                      {conversation.otherUser?.nickname?.charAt(0) || '?'}
                    </span>
                  </div>
                )}

                {/* 会話情報 */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    {/* 相手ユーザー名 */}
                    <span className="font-medium truncate">
                      {conversation.otherUser?.nickname || '削除されたユーザー'}
                    </span>

                    {/* 最終更新時刻（相対表示） */}
                    <span className="text-xs text-muted-foreground flex-shrink-0">
                      {formatDistanceToNow(new Date(conversation.updatedAt), {
                        addSuffix: true,
                        locale: ja,
                      })}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    {/* 最新メッセージのプレビュー */}
                    <p className="text-sm text-muted-foreground truncate flex-1">
                      {conversation.lastMessage?.content || 'メッセージなし'}
                    </p>

                    {/* 未読インジケーター */}
                    {conversation.hasUnread && (
                      <span className="w-2.5 h-2.5 bg-primary rounded-full flex-shrink-0" />
                    )}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
