/**
 * @file イベント編集ページ
 * @description 既存のイベント情報を編集するためのフォームページ。
 * イベントの所有者（登録者）のみがアクセス可能で、
 * タイトル、日時、場所、詳細情報などを更新できる。
 */

// Next.jsのナビゲーション関数: 404表示とリダイレクト
import { notFound, redirect } from 'next/navigation'
// Next.jsのLinkコンポーネント: クライアントサイドナビゲーション
import Link from 'next/link'
// NextAuth.jsの認証ヘルパー: 現在のセッション取得
import { auth } from '@/lib/auth'
// ルート定数
import { ROUTE_LOGIN } from '@/lib/constants/routes'
// イベントデータ取得用のServer Action
import { getEvent } from '@/lib/actions/event'
// イベント登録・編集用フォームコンポーネント
import { EventForm } from '@/components/event/EventForm'

/**
 * ページコンポーネントのProps型定義
 * 動的ルートパラメータ（イベントID）を受け取る
 */
interface EditEventPageProps {
  params: Promise<{ id: string }>
}

/**
 * 左矢印アイコンコンポーネント
 * 「戻る」ボタンに使用するSVGアイコン
 * @param className - 追加のCSSクラス
 */
function ArrowLeftIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="m12 19-7-7 7-7" />
      <path d="M19 12H5" />
    </svg>
  )
}

/**
 * 動的メタデータ生成関数
 * イベントタイトルに基づいてページタイトルを生成する
 *
 * @param params - 動的ルートパラメータ（イベントID）
 * @returns メタデータオブジェクト（タイトル）
 */
export async function generateMetadata({ params }: EditEventPageProps) {
  const { id } = await params
  const result = await getEvent(id)

  // 編集ページは所有者専用のため検索エンジンには公開しない
  const robots = { index: false, follow: false } as const

  // イベントが見つからない場合のフォールバック
  if (!result.success || !result.data) {
    return { title: 'イベントが見つかりません - BON-LOG', robots }
  }

  return {
    title: `${result.data.event.title}を編集 - BON-LOG`,
    robots,
  }
}

/**
 * イベント編集ページコンポーネント
 *
 * このServer Componentは以下の処理を行う:
 * 1. 認証チェック（未ログインならログインページへリダイレクト）
 * 2. イベントデータの取得
 * 3. 所有者チェック（非所有者は詳細ページへリダイレクト）
 * 4. 編集モードでEventFormコンポーネントをレンダリング
 *
 * @param params - 動的ルートパラメータ（イベントID）
 */
export default async function EditEventPage({ params }: EditEventPageProps) {
  // 動的パラメータからイベントIDを取得
  const { id } = await params
  // 現在のログインセッションを取得
  const session = await auth()

  // 未ログインの場合はログインページへリダイレクト
  if (!session?.user?.id) {
    redirect(ROUTE_LOGIN)
  }

  // イベントデータを取得
  const result = await getEvent(id)

  // イベントが見つからない場合は404ページを表示
  if (!result.success || !result.data) {
    notFound()
  }

  const event = result.data.event

  // 所有者でない場合は詳細ページにリダイレクト
  // セキュリティ上、他人のイベントは編集不可
  if (!event.isOwner) {
    redirect(`/events/${id}`)
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* 戻るボタン: イベント詳細ページへのナビゲーション */}
      <Link
        href={`/events/${id}`}
        className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground"
      >
        <ArrowLeftIcon className="w-4 h-4" />
        <span>詳細に戻る</span>
      </Link>

      {/* フォームカード: 編集フォームを含むカードUI */}
      <div className="bg-card rounded-lg border p-6">
        <h1 className="text-2xl font-bold mb-6">イベントを編集</h1>
        {/* EventFormに編集モードと既存データを渡す */}
        <EventForm
          mode="edit"
          initialData={{
            id: event.id,
            title: event.title,
            startDate: event.startDate,
            endDate: event.endDate,
            prefecture: event.prefecture,
            city: event.city,
            venue: event.venue,
            organizer: event.organizer,
            fee: event.admissionFee,
            hasSales: event.hasSales,
            description: event.description,
            externalUrl: event.externalUrl,
          }}
        />
      </div>
    </div>
  )
}
