import Link from 'next/link'

import Image from 'next/image'

import { getConversations } from '@/lib/actions/message'
import { buildMessageConversationPath } from '@/lib/constants/path-builders'

import { formatDistanceToNow } from 'date-fns'

import { ja } from 'date-fns/locale'

type Conversation = {
  id: string
  updatedAt: Date
  otherUser?: {
    id: string
    nickname: string | null
    avatarUrl: string | null
  } | null
  lastMessage?: {
    content: string
  } | null
  hasUnread: boolean
}

// lucide-react アイコン
import { MessageSquare as MessageSquareIcon } from 'lucide-react'

/**
 * ページのメタデータ定義
 * ブラウザのタブに表示されるタイトルを設定
 */
export const metadata = {
  title: 'メッセージ',
  robots: { index: false, follow: false },
}

/**
 * メッセージ一覧ページのメインコンポーネント
 *
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
        <div className="p-4 border-b">
          <h1 className="text-xl font-bold">メッセージ</h1>
        </div>

        {conversations.length === 0 ? (
          // 会話がない場合の空状態表示
          <div className="p-8 text-center">
            <MessageSquareIcon className="w-12 h-12 text-muted-foreground mx-auto mb-4" />

            <p className="text-muted-foreground mb-4">
              まだメッセージはありません
            </p>

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
                href={buildMessageConversationPath(conversation.id)}
                className="flex items-center gap-3 p-4 hover:bg-muted/50 transition-colors"
              >
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

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium truncate">
                      {conversation.otherUser?.nickname || '削除されたユーザー'}
                    </span>

                    <span className="text-xs text-muted-foreground flex-shrink-0">
                      {formatDistanceToNow(new Date(conversation.updatedAt), {
                        addSuffix: true,
                        locale: ja,
                      })}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <p className="text-sm text-muted-foreground truncate flex-1">
                      {conversation.lastMessage?.content || 'メッセージなし'}
                    </p>

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
