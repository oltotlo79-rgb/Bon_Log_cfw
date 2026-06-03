import { redirect, notFound } from 'next/navigation'

import Link from 'next/link'

import { ROUTE_LOGIN } from '@/lib/constants/routes'
import { buildUserPath } from '@/lib/constants/path-builders'

import Image from 'next/image'

import { auth } from '@/lib/auth'

import { getConversation, getMessages } from '@/lib/actions/message'

import { MessageList } from '@/components/message/MessageList'

import { MessageForm } from '@/components/message/MessageForm'

function ArrowLeftIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="m12 19-7-7 7-7"/>
      <path d="M19 12H5"/>
    </svg>
  )
}

interface ConversationPageProps {
  params: Promise<{ conversationId: string }>
}

export async function generateMetadata({ params }: ConversationPageProps) {
  const { conversationId } = await params
  const result = await getConversation(conversationId)

  // ダイレクトメッセージは私的領域なので、検索エンジンには絶対に公開しない
  const robots = { index: false, follow: false } as const

  // 会話が見つからない場合はデフォルトタイトル
  if (!result.success || !result.data?.conversation) {
    return { title: 'メッセージ', robots }
  }

  // 相手のニックネームをタイトルに含める
  return {
    title: `${result.data.conversation.otherUser?.nickname || 'ユーザー'}とのメッセージ`,
    robots,
  }
}

/**
 * 会話詳細ページのメインコンポーネント
 *
 *
 * @param params - ルートパラメータ（conversationId）
 * @returns 会話詳細ページのJSX
 */
export default async function ConversationPage({ params }: ConversationPageProps) {
  // 現在のセッション情報を取得
  const session = await auth()

  // 未認証の場合はログインページへリダイレクト
  if (!session?.user?.id) {
    redirect(ROUTE_LOGIN)
  }

  // ルートパラメータから会話IDを取得
  const { conversationId } = await params

  // 会話情報とメッセージを並列で取得（パフォーマンス最適化）
  const [conversationResult, messagesResult] = await Promise.all([
    getConversation(conversationId),
    getMessages(conversationId),
  ])

  // 会話が見つからない場合は404ページを表示
  if (!conversationResult.success || !conversationResult.data?.conversation) {
    notFound()
  }

  // メッセージ取得でエラーの場合も404ページを表示
  if (!messagesResult.success || !messagesResult.data) {
    notFound()
  }

  // 取得結果からデータを抽出
  const { conversation } = conversationResult.data
  const { messages, currentUserId } = messagesResult.data

  return (
    <div className="max-w-2xl mx-auto h-[calc(100vh-120px)] flex flex-col">
      <div className="bg-card rounded-lg border flex flex-col h-full">
        <div className="flex items-center gap-3 p-4 border-b">
          <Link
            href="/messages"
            className="p-2 hover:bg-muted rounded-lg transition-colors -ml-2"
          >
            <ArrowLeftIcon className="w-5 h-5" />
          </Link>

          <Link
            href={conversation.otherUser ? buildUserPath(conversation.otherUser.id) : '#'}
            className="flex items-center gap-3 hover:opacity-80 transition-opacity"
          >
            {conversation.otherUser?.avatarUrl ? (
              <Image
                src={conversation.otherUser.avatarUrl}
                alt={conversation.otherUser.nickname || ''}
                width={40}
                height={40}
                className="rounded-full"
              />
            ) : (
              // アバターがない場合のフォールバック（頭文字表示）
              <div className="w-10 h-10 bg-muted rounded-full flex items-center justify-center">
                <span className="text-muted-foreground">
                  {conversation.otherUser?.nickname?.charAt(0) || '?'}
                </span>
              </div>
            )}

            <span className="font-medium">
              {conversation.otherUser?.nickname || '削除されたユーザー'}
            </span>
          </Link>
        </div>

        <MessageList
          initialMessages={messages}
          conversationId={conversationId}
          currentUserId={currentUserId}
        />

        <MessageForm conversationId={conversationId} />
      </div>
    </div>
  )
}
