/**
 * @file 盆栽園詳細ページ
 * @description 個別の盆栽園の詳細情報を表示するページ。
 * 盆栽園の基本情報、地図、レビュー一覧、レビュー投稿フォームを含む。
 * SEO対策として構造化データ（JSON-LD）も出力する。
 */

// Next.jsのnotFound関数: 404ページを表示
import { notFound } from 'next/navigation'
// Next.jsのMetadata型: 動的メタデータ生成用
import { Metadata } from 'next'
// Next.jsのLinkコンポーネント: クライアントサイドナビゲーション
import Link from 'next/link'
// NextAuth.jsの認証ヘルパー: 現在のセッション取得
import { auth } from '@/lib/auth'
// 盆栽園データ取得用のServer Action
import { getShop } from '@/lib/actions/shop'
// 星評価表示コンポーネント
import { StarRatingDisplay } from '@/components/shop/StarRating'
// レビュー投稿フォームコンポーネント
import { ReviewForm } from '@/components/shop/ReviewForm'
// レビュー一覧表示コンポーネント
import { ReviewList } from '@/components/shop/ReviewList'
// 小型地図表示用ラッパーコンポーネント
import { MapWrapperSmall } from '@/components/shop/MapWrapper'
// SEO用のJSON-LD構造化データコンポーネント
import { LocalBusinessJsonLd } from '@/components/seo/JsonLd'
// パンくずリストUIコンポーネント
import { Breadcrumb } from '@/components/common/Breadcrumb'
// 盆栽園の編集・削除アクションコンポーネント
import { ShopActions } from '@/components/shop/ShopActions'
// ジャンル編集コンポーネント（誰でも編集可能）
import { ShopGenreEditor } from '@/components/shop/ShopGenreEditor'
import { BASE_URL, ROUTE_FEED, ROUTE_SHOPS } from '@/lib/constants/routes'
import { buildShopPath } from '@/lib/constants/path-builders'

/**
 * ページコンポーネントのProps型定義
 * 動的ルートパラメータ（盆栽園ID）を受け取る
 */
interface ShopDetailPageProps {
  params: Promise<{ id: string }>
}

/**
 * 地図ピンアイコンコンポーネント
 * 住所表示に使用するSVGアイコン
 */
function MapPinIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  )
}

/**
 * 電話アイコンコンポーネント
 * 電話番号表示に使用するSVGアイコン
 */
function PhoneIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
    </svg>
  )
}

/**
 * 時計アイコンコンポーネント
 * 営業時間表示に使用するSVGアイコン
 */
function ClockIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  )
}

/**
 * カレンダーオフアイコンコンポーネント
 * 定休日表示に使用するSVGアイコン
 */
function CalendarOffIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M8 2v4" />
      <path d="M16 2v4" />
      <rect width="18" height="18" x="3" y="4" rx="2" />
      <path d="M3 10h18" />
      <path d="m2 2 20 20" />
    </svg>
  )
}

/**
 * 地球アイコンコンポーネント
 * ウェブサイトリンク表示に使用するSVGアイコン
 */
function GlobeIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <circle cx="12" cy="12" r="10" />
      <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" />
      <path d="M2 12h20" />
    </svg>
  )
}

/**
 * 左矢印アイコンコンポーネント
 * 「戻る」ボタンに使用するSVGアイコン
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
 * 盆栽園情報に基づいてSEO用のメタデータを生成する
 *
 * @param params - 動的ルートパラメータ（盆栽園ID）
 * @returns メタデータオブジェクト（タイトル、説明、OGP情報）
 */
export async function generateMetadata({ params }: ShopDetailPageProps): Promise<Metadata> {
  const { id } = await params
  const result = await getShop(id)

  // 盆栽園が見つからない場合のフォールバック
  if ('error' in result) {
    return { title: '盆栽園が見つかりません' }
  }

  const shop = result.shop
  const title = shop.name
  // 説明文を動的に生成（住所、評価、取り扱いジャンルを含む）
  const description = `${shop.address}にある盆栽園「${shop.name}」の情報。${shop.averageRating ? `評価: ${shop.averageRating.toFixed(1)}点` : ''}${shop.genres.length > 0 ? ` 取り扱い: ${shop.genres.map((g: { name: string }) => g.name).join('、')}` : ''}`

  return {
    title,
    description,
    // Open Graph（SNSシェア用）メタデータ
    openGraph: {
      type: 'website',
      title: `${title} - 盆栽園`,
      description,
      url: `${BASE_URL}/shops/${id}`,
      images: [
        {
          url: '/api/og',
          width: 1200,
          height: 630,
          alt: title,
        },
      ],
    },
    // Twitterカード用メタデータ
    twitter: {
      card: 'summary_large_image',
      title: `${title} - 盆栽園`,
      description,
      images: ['/api/og'],
    },
    // 正規URLを指定（重複コンテンツ対策）
    alternates: {
      canonical: `${BASE_URL}/shops/${id}`,
    },
  }
}

/**
 * 盆栽園詳細ページコンポーネント
 *
 * このServer Componentは以下の情報を表示する:
 * 1. 盆栽園の基本情報（名前、住所、連絡先、営業情報）
 * 2. 評価と星レーティング
 * 3. 小型地図での位置表示
 * 4. レビュー投稿フォーム（ログインユーザーかつ未レビューの場合）
 * 5. レビュー一覧
 * 6. SEO用のJSON-LD構造化データ
 *
 * @param params - 動的ルートパラメータ（盆栽園ID）
 */
export default async function ShopDetailPage({ params }: ShopDetailPageProps) {
  // 動的パラメータから盆栽園IDを取得
  const { id } = await params
  // 現在のログインセッションを取得
  const session = await auth()
  // 盆栽園の詳細データを取得
  const result = await getShop(id)

  // 盆栽園が見つからない場合は404ページを表示
  if ('error' in result) {
    notFound()
  }

  const shop = result.shop
  // 現在のユーザーがすでにレビュー済みかどうかをチェック
  const hasReviewed = shop.reviews.some((r: { user: { id: string } }) => r.user.id === session?.user?.id)

  return (
    <>
      {/* パンくずリスト（UI + JSON-LD） */}
      <Breadcrumb
        items={[
          { name: 'ホーム', href: ROUTE_FEED },
          { name: '盆栽園マップ', href: ROUTE_SHOPS },
          { name: shop.name },
        ]}
      />
      <LocalBusinessJsonLd
        name={shop.name}
        address={shop.address}
        url={`${BASE_URL}${buildShopPath(shop.id)}`}
        telephone={shop.phone || undefined}
        openingHours={shop.businessHours || undefined}
        aggregateRating={
          shop.averageRating !== null && shop.reviewCount > 0
            ? { ratingValue: shop.averageRating, reviewCount: shop.reviewCount }
            : undefined
        }
        geo={
          shop.latitude !== null && shop.longitude !== null
            ? { latitude: shop.latitude, longitude: shop.longitude }
            : undefined
        }
      />
    <div className="space-y-6">
      {/* 戻るボタン: 盆栽園マップページへのナビゲーション */}
      <Link
        href={ROUTE_SHOPS}
        className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground"
      >
        <ArrowLeftIcon className="w-4 h-4" />
        <span>盆栽園マップに戻る</span>
      </Link>

      {/* ヘッダーカード: 盆栽園の基本情報 */}
      <div className="bg-card rounded-lg border p-6">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            {/* 盆栽園名 */}
            <h1 className="text-2xl font-bold mb-2">{shop.name}</h1>
            {/* 評価（レビューがある場合のみ表示） */}
            {shop.averageRating !== null && (
              <div className="flex items-center gap-2">
                <StarRatingDisplay rating={shop.averageRating} size="md" showValue />
                <span className="text-sm text-muted-foreground">
                  ({shop.reviewCount}件のレビュー)
                </span>
              </div>
            )}
          </div>
          {/* アクションボタン（編集・削除・シェア） */}
          <ShopActions
            shop={{
              id: shop.id,
              name: shop.name,
              address: shop.address,
              phone: shop.phone,
              website: shop.website,
              businessHours: shop.businessHours,
              closedDays: shop.closedDays,
            }}
            isOwner={shop.isOwner}
            isLoggedIn={!!session?.user}
          />
        </div>

        {/* 詳細情報リスト */}
        <div className="space-y-3">
          {/* 住所 */}
          <div className="flex items-start gap-3">
            <MapPinIcon className="w-5 h-5 text-muted-foreground mt-0.5 flex-shrink-0" />
            <span>{shop.address}</span>
          </div>

          {/* 電話番号（存在する場合のみ表示） */}
          {shop.phone && (
            <div className="flex items-center gap-3">
              <PhoneIcon className="w-5 h-5 text-muted-foreground flex-shrink-0" />
              <a href={`tel:${shop.phone}`} className="text-primary hover:underline">
                {shop.phone}
              </a>
            </div>
          )}

          {/* ウェブサイト（存在する場合のみ表示） */}
          {shop.website && (
            <div className="flex items-center gap-3">
              <GlobeIcon className="w-5 h-5 text-muted-foreground flex-shrink-0" />
              <a
                href={shop.website}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                {shop.website}
              </a>
            </div>
          )}

          {/* 営業時間（存在する場合のみ表示） */}
          {shop.businessHours && (
            <div className="flex items-center gap-3">
              <ClockIcon className="w-5 h-5 text-muted-foreground flex-shrink-0" />
              <span>{shop.businessHours}</span>
            </div>
          )}

          {/* 定休日（存在する場合のみ表示） */}
          {shop.closedDays && (
            <div className="flex items-center gap-3">
              <CalendarOffIcon className="w-5 h-5 text-muted-foreground flex-shrink-0" />
              <span>定休日: {shop.closedDays}</span>
            </div>
          )}
        </div>

        {/* ジャンル編集セクション（ログインユーザーは誰でも編集可能） */}
        <ShopGenreEditor
          shopId={shop.id}
          currentGenres={shop.genres}
          isLoggedIn={!!session?.user}
        />
      </div>

      {/* マップ表示（緯度経度がある場合のみ） */}
      {shop.latitude !== null && shop.longitude !== null && (
        <div className="bg-card rounded-lg border overflow-hidden">
          <MapWrapperSmall
            shops={[shop]}
            center={[shop.latitude, shop.longitude]}
            zoom={15}
          />
        </div>
      )}

      {/* レビューセクション */}
      <div className="bg-card rounded-lg border">
        <div className="p-4 border-b">
          <h2 className="text-lg font-semibold">レビュー</h2>
        </div>

        {/* レビューフォーム（ログイン済み＆未レビューの場合） */}
        {session?.user && !hasReviewed && (
          <div className="p-4 border-b">
            <ReviewForm shopId={shop.id} />
          </div>
        )}

        {/* レビュー済みメッセージ */}
        {hasReviewed && (
          <div className="p-4 border-b text-sm text-muted-foreground text-center">
            この盆栽園にはレビュー済みです
          </div>
        )}

        {/* 未ログインユーザーへのメッセージ */}
        {!session?.user && (
          <div className="p-4 border-b text-center">
            <p className="text-sm text-muted-foreground mb-2">
              レビューを投稿するにはログインしてください
            </p>
            <Link
              href="/login"
              className="text-sm text-primary hover:underline"
            >
              ログイン
            </Link>
          </div>
        )}

        {/* レビュー一覧 */}
        <ReviewList
          reviews={shop.reviews}
          currentUserId={session?.user?.id}
        />
      </div>
    </div>
    </>
  )
}
