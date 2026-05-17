/**
 * @file 下書き編集ページコンポーネント
 * @description 保存された下書きを編集するためのフォームページ
 *              - 認証済みユーザーのみアクセス可能
 *              - Server Componentとして実装し、下書きデータとジャンル一覧をサーバーサイドで取得
 *              - 下書きの内容を編集して再保存または投稿として公開
 */

// NextAuth.js の認証関数 - 現在のセッション情報を取得
import { auth } from '@/lib/auth'

// Next.js のナビゲーション関数
// - redirect: 未認証ユーザーをログインページへ誘導
// - notFound: 下書きが見つからない場合に404ページを表示
import { redirect, notFound } from 'next/navigation'

// ルート定数
import { ROUTE_LOGIN } from '@/lib/constants/routes'

// 下書き詳細を取得するServer Action
import { getDraft } from '@/lib/actions/draft'

// ジャンル一覧を取得するServer Action（ジャンル選択用）
import { getGenres } from '@/lib/actions/post'

// Next.js のLink コンポーネント - 下書き一覧への戻りリンク用
import Link from 'next/link'

// 下書き編集フォームコンポーネント - 入力UIと更新/投稿処理を担当
import { DraftEditForm } from '@/components/draft/DraftEditForm'

import type { Metadata } from 'next'

/**
 * 静的メタデータ。
 *
 * 下書きは本人のみアクセス可能な非公開コンテンツのため、index/follow を共に拒否する。
 */
export const metadata: Metadata = {
  title: '下書きを編集',
  description: '保存済みの下書きを編集または投稿として公開します。',
  robots: { index: false, follow: false },
}

/**
 * ページプロパティの型定義
 * Next.js 15以降ではparamsはPromiseとして渡される
 */
type Props = {
  params: Promise<{ id: string }>
}

/**
 * 戻る矢印アイコンコンポーネント
 *
 * @description
 * 下書き一覧ページへ戻るリンクに使用するSVGアイコン
 *
 * @param className - 追加のCSSクラス
 * @returns SVGアイコンのJSX
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
 * 下書き編集ページのメインコンポーネント
 *
 * @description
 * - 認証チェックを行い、未ログインユーザーはログインページへリダイレクト
 * - URLパラメータから下書きIDを取得し、下書きデータとジャンル一覧を並列で取得
 * - 下書きが見つからない場合は404ページを表示
 * - DraftEditFormコンポーネントに下書きデータとジャンル一覧を渡して編集UI表示
 *
 * @param params - ルートパラメータ（id）
 * @returns 下書き編集ページのJSX
 */
export default async function DraftEditPage({ params }: Props) {
  // ルートパラメータから下書きIDを取得
  const { id } = await params

  // 現在のセッション情報を取得
  const session = await auth()

  // 未認証の場合はログインページへリダイレクト
  if (!session?.user?.id) {
    redirect(ROUTE_LOGIN)
  }

  // 下書きデータとジャンル一覧を並列で取得（パフォーマンス最適化）
  const [draftResult, genresResult] = await Promise.all([
    getDraft(id),
    getGenres(),
  ])

  // 下書きが見つからない場合は404ページを表示
  if (!draftResult.success || !draftResult.data?.draft) {
    notFound()
  }

  const draft = draftResult.data.draft

  return (
    <div className="max-w-2xl mx-auto">
      <div className="bg-card rounded-lg border">
        {/* ヘッダー - 下書き一覧への戻るリンク */}
        <div className="px-4 py-3 border-b">
          <Link href="/drafts" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeftIcon className="w-4 h-4" />
            下書き一覧に戻る
          </Link>
        </div>

        {/* フォームエリア */}
        <div className="p-4">
          {/* ページタイトル */}
          <h1 className="text-xl font-bold mb-6">下書きを編集</h1>

          {/* 下書き編集フォーム */}
          {/* - draft: 編集対象の下書きデータ */}
          {/* - genres: ジャンル選択用のマスターデータ */}
          <DraftEditForm draft={draft} genres={genresResult.genres} />
        </div>
      </div>
    </div>
  )
}
