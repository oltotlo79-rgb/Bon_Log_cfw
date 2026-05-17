/**
 * @file 会話詳細ページコンポーネント
 * @description 特定のユーザーとのダイレクトメッセージ会話を表示するページ
 *              - 認証済みユーザーのみアクセス可能
 *              - Server Componentとして実装し、会話とメッセージをサーバーサイドで取得
 *              - リアルタイムメッセージ表示と送信機能を提供
 */

// Next.js のナビゲーション関数
// - redirect: 未認証ユーザーをログインページへ誘導
// - notFound: 会話が見つからない場合に404ページを表示
import { redirect, notFound } from 'next/navigation'

// Next.js のLink コンポーネント - 戻るボタン等のナビゲーション用
import Link from 'next/link'

// ルート定数
import { ROUTE_LOGIN } from '@/lib/constants/routes'

// Next.js のImage コンポーネント - 最適化されたアバター画像表示
import Image from 'next/image'

// NextAuth.js の認証関数 - 現在のセッション情報を取得
import { auth } from '@/lib/auth'

// メッセージ関連のServer Actions
// - getConversation: 会話の詳細情報を取得
// - getMessages: 会話内のメッセージ一覧を取得
import { getConversation, getMessages } from '@/lib/actions/message'

// メッセージリストコンポーネント - メッセージ一覧の表示とスクロール管理
import { MessageList } from '@/components/message/MessageList'

// メッセージ送信フォームコンポーネント - 新規メッセージの入力と送信
import { MessageForm } from '@/components/message/MessageForm'

/**
 * 戻る矢印アイコンコンポーネント
 *
 * @description
 * メッセージ一覧ページへ戻るボタンに使用するSVGアイコン
 *
 * @param className - 追加のCSSクラス
 * @returns SVGアイコンのJSX
 */
function ArrowLeftIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="m12 19-7-7 7-7"/>
      <path d="M19 12H5"/>
    </svg>
  )
}

/**
 * ページプロパティの型定義
 * Next.js 15以降ではparamsはPromiseとして渡される
 */
interface ConversationPageProps {
  params: Promise<{ conversationId: string }>
}

/**
 * 動的メタデータ生成関数
 *
 * @description
 * 会話相手のニックネームをページタイトルに含める
 * 会話が見つからない場合はデフォルトのタイトルを返す
 *
 * @param params - ルートパラメータ（conversationId）
 * @returns ページのメタデータオブジェクト
 */
export async function generateMetadata({ params }: ConversationPageProps) {
  const { conversationId } = await params
  const result = await getConversation(conversationId)

  // ダイレクトメッセージは私的領域なので、検索エンジンには絶対に公開しない
  const robots = { index: false, follow: false } as const

  // 会話が見つからない場合はデフォルトタイトル
  if (!result.success || !result.data?.conversation) {
    return { title: 'メッセージ - BON-LOG', robots }
  }

  // 相手のニックネームをタイトルに含める
  return {
    title: `${result.data.conversation.otherUser?.nickname || 'ユーザー'}とのメッセージ - BON-LOG`,
    robots,
  }
}

/**
 * 会話詳細ページのメインコンポーネント
 *
 * @description
 * - 認証チェックを行い、未ログインユーザーはログインページへリダイレクト
 * - 会話情報とメッセージ一覧を並列で取得
 * - 会話が見つからない場合は404ページを表示
 * - ヘッダー、メッセージリスト、送信フォームで構成
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
        {/* ヘッダー - 戻るボタンと相手ユーザー情報 */}
        <div className="flex items-center gap-3 p-4 border-b">
          {/* メッセージ一覧への戻るリンク */}
          <Link
            href="/messages"
            className="p-2 hover:bg-muted rounded-lg transition-colors -ml-2"
          >
            <ArrowLeftIcon className="w-5 h-5" />
          </Link>

          {/* 相手ユーザーのプロフィールへのリンク */}
          <Link
            href={conversation.otherUser ? `/users/${conversation.otherUser.id}` : '#'}
            className="flex items-center gap-3 hover:opacity-80 transition-opacity"
          >
            {/* アバター画像 */}
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

            {/* 相手ユーザー名 */}
            <span className="font-medium">
              {conversation.otherUser?.nickname || '削除されたユーザー'}
            </span>
          </Link>
        </div>

        {/* メッセージ一覧 - スクロール可能な領域 */}
        <MessageList
          initialMessages={messages}
          conversationId={conversationId}
          currentUserId={currentUserId}
        />

        {/* 入力フォーム - 画面下部に固定 */}
        <MessageForm conversationId={conversationId} />
      </div>
    </div>
  )
}
