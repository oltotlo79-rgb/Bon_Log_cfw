/**
 * @file 盆栽園編集ページ
 * @description 既存の盆栽園情報を編集するためのフォームページ。
 * 盆栽園の所有者（登録者）のみがアクセス可能で、
 * 名前、住所、連絡先、営業情報などを更新できる。
 */

// Next.jsのナビゲーション関数: 404表示とリダイレクト
import { notFound, redirect } from 'next/navigation'
// Next.jsのLinkコンポーネント: クライアントサイドナビゲーション
import Link from 'next/link'
// NextAuth.jsの認証ヘルパー: 現在のセッション取得
import { auth } from '@/lib/auth'
// ルート定数
import { ROUTE_LOGIN } from '@/lib/constants/routes'
// 盆栽園データ取得用のServer Actions
import { getShop, getShopGenres } from '@/lib/actions/shop'
// 盆栽園登録・編集用フォームコンポーネント
import { ShopForm } from '@/components/shop/ShopForm'

/**
 * ページコンポーネントのProps型定義
 * 動的ルートパラメータ（盆栽園ID）を受け取る
 */
interface EditShopPageProps {
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
 * 盆栽園名に基づいてページタイトルを生成する
 *
 * @param params - 動的ルートパラメータ（盆栽園ID）
 * @returns メタデータオブジェクト（タイトル）
 */
export async function generateMetadata({ params }: EditShopPageProps) {
  const { id } = await params
  const result = await getShop(id)

  // 編集ページは所有者専用のため検索エンジンには公開しない
  const robots = { index: false, follow: false } as const

  // 盆栽園が見つからない場合のフォールバック
  if ('error' in result) {
    return { title: '盆栽園が見つかりません - BON-LOG', robots }
  }

  return {
    title: `${result.shop.name}を編集 - BON-LOG`,
    robots,
  }
}

/**
 * 盆栽園編集ページコンポーネント
 *
 * このServer Componentは以下の処理を行う:
 * 1. 認証チェック（未ログインならログインページへリダイレクト）
 * 2. 盆栽園データとジャンル一覧を並列取得
 * 3. 所有者チェック（非所有者は詳細ページへリダイレクト）
 * 4. 編集モードでShopFormコンポーネントをレンダリング
 *
 * @param params - 動的ルートパラメータ（盆栽園ID）
 */
export default async function EditShopPage({ params }: EditShopPageProps) {
  // 動的パラメータから盆栽園IDを取得
  const { id } = await params
  // 現在のログインセッションを取得
  const session = await auth()

  // 未ログインの場合はログインページへリダイレクト
  if (!session?.user?.id) {
    redirect(ROUTE_LOGIN)
  }

  // 盆栽園データとジャンル一覧を並列取得
  // Promise.allを使用することでパフォーマンスを最適化
  const [shopResult, { genres }] = await Promise.all([
    getShop(id),
    getShopGenres(),
  ])

  // 盆栽園が見つからない場合は404ページを表示
  if ('error' in shopResult) {
    notFound()
  }

  const shop = shopResult.shop

  // 所有者でない場合は詳細ページにリダイレクト
  // セキュリティ上、他人の盆栽園は編集不可
  if (!shop.isOwner) {
    redirect(`/shops/${id}`)
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* 戻るボタン: 盆栽園詳細ページへのナビゲーション */}
      <Link
        href={`/shops/${id}`}
        className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground"
      >
        <ArrowLeftIcon className="w-4 h-4" />
        <span>詳細に戻る</span>
      </Link>

      {/* フォームカード: 編集フォームを含むカードUI */}
      <div className="bg-card rounded-lg border p-6">
        <h1 className="text-2xl font-bold mb-6">盆栽園を編集</h1>
        {/* ShopFormに編集モードと既存データを渡す */}
        <ShopForm
          genres={genres}
          mode="edit"
          initialData={{
            id: shop.id,
            name: shop.name,
            address: shop.address,
            latitude: shop.latitude,
            longitude: shop.longitude,
            phone: shop.phone,
            website: shop.website,
            businessHours: shop.businessHours,
            closedDays: shop.closedDays,
            genres: shop.genres,
          }}
        />
      </div>
    </div>
  )
}
