/**
 * @file 盆栽新規登録ページコンポーネント
 * @description 新しい盆栽を登録するためのフォームページ
 *              - 認証済みユーザーのみアクセス可能
 *              - Server Componentとして実装
 *              - 盆栽の基本情報（名前、樹種、説明、入手日等）を入力
 */

// NextAuth.js の認証関数 - 現在のセッション情報を取得
import { auth } from '@/lib/auth'

// Next.js のリダイレクト関数 - 未認証ユーザーをログインページへ誘導
import { redirect } from 'next/navigation'

// Next.js のLink コンポーネント - マイ盆栽一覧への戻りリンク用
import Link from 'next/link'

// ルート定数
import { ROUTE_LOGIN, ROUTE_BONSAI } from '@/lib/constants/routes'

// 盆栽登録フォームコンポーネント - 入力UIと登録処理を担当
import { BonsaiForm } from '@/components/bonsai/BonsaiForm'

/**
 * ページのメタデータ定義
 * ブラウザのタブに表示されるタイトルと説明文を設定
 */
export const metadata = {
  title: '盆栽を登録 - BON-LOG',
  description: '新しい盆栽を登録',
}

/**
 * 戻る矢印アイコンコンポーネント
 *
 * @description
 * マイ盆栽一覧ページへ戻るリンクに使用するSVGアイコン
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
 * 盆栽新規登録ページのメインコンポーネント
 *
 * @description
 * - 認証チェックを行い、未ログインユーザーはログインページへリダイレクト
 * - 盆栽登録フォームを表示
 * - 登録完了後は盆栽詳細ページへ遷移（BonsaiFormコンポーネントで処理）
 *
 * @returns 盆栽新規登録ページのJSX
 */
export default async function NewBonsaiPage() {
  // 現在のセッション情報を取得
  const session = await auth()

  // 未認証の場合はログインページへリダイレクト
  if (!session?.user?.id) {
    redirect(ROUTE_LOGIN)
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="bg-card rounded-lg border">
        {/* ヘッダー - 戻るリンク */}
        <div className="px-4 py-3 border-b">
          <Link href={ROUTE_BONSAI} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeftIcon className="w-4 h-4" />
            マイ盆栽に戻る
          </Link>
        </div>

        {/* フォームエリア */}
        <div className="p-4">
          {/* ページタイトル */}
          <h1 className="text-xl font-bold mb-6">盆栽を登録</h1>

          {/* 盆栽登録フォーム - propsなしで新規登録モード */}
          <BonsaiForm />
        </div>
      </div>
    </div>
  )
}
