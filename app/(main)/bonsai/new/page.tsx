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
  title: '盆栽を登録',
  robots: { index: false, follow: false },
  description: '新しい盆栽を登録',
}

/**
 * 戻る矢印アイコンコンポーネント
 *
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
        <div className="px-4 py-3 border-b">
          <Link href={ROUTE_BONSAI} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeftIcon className="w-4 h-4" />
            マイ盆栽に戻る
          </Link>
        </div>

        <div className="p-4">
          <h1 className="text-xl font-bold mb-6">盆栽を登録</h1>

          <BonsaiForm />
        </div>
      </div>
    </div>
  )
}
