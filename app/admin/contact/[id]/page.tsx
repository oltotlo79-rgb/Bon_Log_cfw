/**
 * @file お問い合わせ詳細ページ
 * @description 個別のお問い合わせの詳細情報を表示し、
 *              ステータス変更やメモ編集などの管理操作を提供するページ。
 * @route /admin/contact/[id]
 */

// Next.jsのLinkコンポーネント（クライアントサイドナビゲーション用）
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
// Next.jsの404ページ表示関数
import { notFound } from 'next/navigation'
// お問い合わせ取得用のServer Action
import { getContactInquiry } from '@/lib/actions/contact'
// アクションパネルコンポーネント（クライアントコンポーネント）
import { ContactDetailActions } from './ContactDetailActions'

/**
 * ステータスの日本語ラベル定義
 * データベースの英語値を日本語表示に変換
 */
const STATUS_LABELS: Record<string, string> = {
  pending: '未対応',
  in_progress: '対応中',
  resolved: '解決済',
  closed: 'クローズ', // 対応完了、追加対応不要
}

/**
 * ステータスの背景色・文字色定義
 * Tailwind CSSクラスで視覚的に区別
 */
const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-yellow-500/10 text-yellow-600',
  in_progress: 'bg-blue-500/10 text-blue-600',
  resolved: 'bg-green-500/10 text-green-600',
  closed: 'bg-gray-500/10 text-gray-600', // クローズ済み（グレー）
}

/**
 * カテゴリーの日本語ラベル定義
 */
const CATEGORY_LABELS: Record<string, string> = {
  general: '一般的なお問い合わせ',
  account: 'アカウントについて',
  bug: '不具合の報告',
  feature: '機能のリクエスト',
  premium: 'プレミアム会員について',
  other: 'その他', // 上記に当てはまらないカテゴリー
}

/**
 * ページメタデータの定義
 * ブラウザのタイトルバーに表示される
 */
export const metadata = {
  title: 'お問い合わせ詳細 - BON-LOG 管理',
}

/**
 * お問い合わせ詳細ページコンポーネント
 * 個別のお問い合わせの詳細情報と管理操作を提供する
 *
 * @param params - ルートパラメータ（お問い合わせID）
 * @returns お問い合わせ詳細ページのJSX要素
 *
 * 処理内容:
 * 1. URLパラメータからお問い合わせIDを取得
 * 2. データベースからお問い合わせ情報を取得
 * 3. 存在しない場合は404ページを表示
 * 4. 基本情報、ステータス、カテゴリー、内容を表示
 * 5. アクションパネル（更新・削除）を表示
 */
export default async function ContactDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  // ルートパラメータを取得（Next.js 15ではPromiseとして扱う）
  const { id } = await params
  // Server Actionでお問い合わせ情報を取得
  const result = await getContactInquiry(id)

  // エラーまたは存在しない場合は404ページを表示
  if (!result.success || !result.data?.inquiry) {
    notFound()
  }

  const inquiry = result.data.inquiry

  return (
    <div className="space-y-6 max-w-3xl">
      {/* ページヘッダー */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">お問い合わせ詳細</h1>
        {/* 一覧ページへの戻るリンク */}
        <Link href="/admin/contact" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:underline">
          <ChevronLeft className="h-4 w-4 shrink-0" aria-hidden /> 一覧に戻る
        </Link>
      </div>

      {/* 基本情報カード */}
      <div className="bg-card rounded-lg border p-6 space-y-4">
        {/* ステータスとカテゴリーバッジ */}
        <div className="flex items-center gap-3">
          {/* ステータスバッジ（色分けで視覚的に状態を表現） */}
          <span className={`rounded-full px-3 py-1 text-sm ${STATUS_COLORS[inquiry.status] || ''}`}>
            {STATUS_LABELS[inquiry.status] || inquiry.status}
          </span>
          {/* カテゴリーバッジ */}
          <span className="rounded-full bg-muted px-3 py-1 text-sm">
            {CATEGORY_LABELS[inquiry.category] || inquiry.category}
          </span>
        </div>

        {/* 詳細情報グリッド（2カラムレイアウト） */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* 問い合わせ者の名前 */}
          <div>
            <p className="text-sm text-muted-foreground">名前</p>
            <p className="font-medium">{inquiry.name}</p>
          </div>
          {/* 問い合わせ者のメールアドレス（mailto:リンク付き） */}
          <div>
            <p className="text-sm text-muted-foreground">メールアドレス</p>
            <p className="font-medium">
              <a href={`mailto:${inquiry.email}`} className="text-blue-600 hover:underline">
                {inquiry.email}
              </a>
            </p>
          </div>
          {/* お問い合わせ受信日時 */}
          <div>
            <p className="text-sm text-muted-foreground">受信日時</p>
            <p className="font-medium">{new Date(inquiry.createdAt).toLocaleString('ja-JP')}</p>
          </div>
          {/* 対応日時（対応済みの場合のみ表示） */}
          {inquiry.respondedAt && (
            <div>
              <p className="text-sm text-muted-foreground">対応日時</p>
              <p className="font-medium">{new Date(inquiry.respondedAt).toLocaleString('ja-JP')}</p>
            </div>
          )}
        </div>

        {/* お問い合わせ件名 */}
        <div>
          <p className="text-sm text-muted-foreground">件名</p>
          <p className="font-medium text-lg">{inquiry.subject}</p>
        </div>

        {/* お問い合わせ本文（改行を保持するためwhitespace-pre-wrap） */}
        <div>
          <p className="text-sm text-muted-foreground mb-1">お問い合わせ内容</p>
          <div className="bg-muted/50 rounded-md p-4 whitespace-pre-wrap text-sm">
            {inquiry.message}
          </div>
        </div>

        {/* 管理者メモ（入力済みの場合のみ表示） */}
        {inquiry.adminNote && (
          <div>
            <p className="text-sm text-muted-foreground mb-1">管理者メモ</p>
            {/* 青い背景で管理者専用の情報であることを強調 */}
            <div className="bg-blue-50 dark:bg-blue-950 rounded-md p-4 whitespace-pre-wrap text-sm">
              {inquiry.adminNote}
            </div>
          </div>
        )}
      </div>

      {/* アクションパネル（ステータス変更・削除） */}
      <ContactDetailActions
        inquiryId={inquiry.id}
        currentStatus={inquiry.status}
        currentNote={inquiry.adminNote || ''}
      />
    </div>
  )
}
