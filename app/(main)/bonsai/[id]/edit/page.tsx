/**
 * @file 盆栽編集ページコンポーネント
 * @description 既存の盆栽情報を編集するためのフォームページ
 *              - 認証済みユーザーかつオーナーのみアクセス可能
 *              - Server Componentとして実装し、既存データをサーバーサイドで取得
 *              - 盆栽の基本情報（名前、樹種、説明、入手日等）を編集
 */

// Next.js のナビゲーション関数
// - notFound: 盆栽が見つからない場合に404ページを表示
// - redirect: 未認証または非オーナーをリダイレクト
import { notFound, redirect } from 'next/navigation'

// NextAuth.js の認証関数 - 現在のセッション情報を取得
import { auth } from '@/lib/auth'

// ルート定数
import { ROUTE_LOGIN } from '@/lib/constants/routes'

// 盆栽詳細を取得するServer Action
import { getBonsai } from '@/lib/actions/bonsai'

// Next.js のLink コンポーネント - 盆栽詳細への戻りリンク用
import Link from 'next/link'

// 盆栽登録・編集フォームコンポーネント - 入力UIと更新処理を担当
import { BonsaiForm } from '@/components/bonsai/BonsaiForm'

import type { Metadata } from 'next'

/**
 * 静的メタデータ。
 *
 * 盆栽編集はオーナー専用の認証必須画面のため、検索エンジンに index させない。
 * 動的タイトル（盆栽名）の出し分けは過剰なので static で十分。
 */
export const metadata: Metadata = {
  title: '盆栽を編集',
  description: '登録済みの盆栽情報を編集します。',
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
 * 盆栽詳細ページへ戻るリンクに使用するSVGアイコン
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
 * 盆栽編集ページのメインコンポーネント
 *
 * @description
 * - 認証チェックを行い、未ログインユーザーはログインページへリダイレクト
 * - URLパラメータから盆栽IDを取得し、既存データを取得
 * - 盆栽が見つからない場合は404ページを表示
 * - オーナー以外がアクセスした場合は盆栽詳細ページへリダイレクト
 * - BonsaiFormコンポーネントに既存データを渡して編集モードで表示
 *
 * @param params - ルートパラメータ（id）
 * @returns 盆栽編集ページのJSX
 */
export default async function EditBonsaiPage({ params }: Props) {
  // ルートパラメータから盆栽IDを取得
  const { id } = await params

  // 現在のセッション情報を取得
  const session = await auth()

  // 未認証の場合はログインページへリダイレクト
  if (!session?.user?.id) {
    redirect(ROUTE_LOGIN)
  }

  // 盆栽詳細を取得
  const result = await getBonsai(id)

  // 盆栽が見つからない場合は404ページを表示
  if (!result.success || !result.data?.bonsai) {
    notFound()
  }

  const bonsai = result.data.bonsai

  // オーナーのみ編集可能 - 他のユーザーは盆栽詳細ページへリダイレクト
  if (bonsai.userId !== session.user.id) {
    redirect(`/bonsai/${id}`)
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="bg-card rounded-lg border">
        {/* ヘッダー - 盆栽詳細への戻るリンク */}
        <div className="px-4 py-3 border-b">
          <Link href={`/bonsai/${id}`} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeftIcon className="w-4 h-4" />
            盆栽詳細に戻る
          </Link>
        </div>

        {/* フォームエリア */}
        <div className="p-4">
          {/* ページタイトル */}
          <h1 className="text-xl font-bold mb-6">盆栽を編集</h1>

          {/* 盆栽編集フォーム - 既存データを渡して編集モードで表示 */}
          <BonsaiForm bonsai={bonsai} />
        </div>
      </div>
    </div>
  )
}
