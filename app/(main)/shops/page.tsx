// Next.jsのLinkコンポーネント: クライアントサイドナビゲーションを実現
import Link from 'next/link'
import Image from 'next/image'
import { Suspense } from 'react'
// 盆栽園データ取得用のServer Actions
import { getShops, getShopGenres } from '@/lib/actions/shop'
// 盆栽園リスト表示コンポーネント
import { ShopList } from '@/components/shop/ShopList'
// 検索・フィルターフォームコンポーネント（クライアントコンポーネント）
import { ShopSearchForm } from './ShopSearchForm'
// 地図表示用ラッパーコンポーネント（Leafletを使用）
import { MapWrapper } from '@/components/shop/MapWrapper'
import { pageCanonical, pageTitle } from '@/lib/utils/seo'
import { ROUTE_SHOPS } from '@/lib/constants/routes'

export const revalidate = 300 // REVALIDATE_LIST_PAGE 相当（Next.js は revalidate に静的リテラルを要求）

export const metadata = {
  title: pageTitle('盆栽園マップ'),
  description: '全国の盆栽園を地図で検索。地域・ジャンル・評価でフィルタリングし、営業時間や口コミを確認できます。',
  alternates: { canonical: pageCanonical(ROUTE_SHOPS) },
}

/**
 * URLのクエリパラメータを受け取る
 */
interface ShopsPageProps {
  searchParams: Promise<{
    search?: string     // 検索キーワード
    genre?: string      // 選択されたジャンルID
    region?: string     // 選択された地方ID
    prefecture?: string // 選択された都道府県
    sort?: string       // ソート順（rating, name, newest, location）
  }>
}

/**
 * プラスアイコンコンポーネント
 * 新規登録ボタンに使用するSVGアイコン
 * @param className - 追加のCSSクラス
 */
function PlusIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M5 12h14" />
      <path d="M12 5v14" />
    </svg>
  )
}

/**
 * 盆栽園マップページコンポーネント
 *
 * このServer Componentは以下の機能を提供する:
 * 1. 盆栽園データとジャンルデータの並列取得
 * 2. 検索・フィルター条件に基づいた盆栽園の表示
 * 3. 地図上での盆栽園位置の可視化
 * 4. 盆栽園一覧のリスト表示
 *
 * @param searchParams - URLクエリパラメータ（検索、ジャンル、ソート）
 */
export default async function ShopsPage({ searchParams }: ShopsPageProps) {
  const params = await searchParams
  const { genres } = await getShopGenres()

  return (
    <>
      <div className="space-y-6">
        <div className="relative w-full h-24 md:h-32 rounded-lg overflow-hidden mb-4">
          <Image src="/images/generated/ui/map-header-mobile.webp" alt="" fill sizes="100vw" className="object-cover opacity-80 md:hidden dark:hidden" />
          <Image src="/images/generated/ui/map-header.webp" alt="" fill sizes="100vw" className="object-cover opacity-80 hidden md:block dark:hidden" />
          <Image src="/images/generated/ui/map-header-dark.webp" alt="" fill sizes="100vw" className="object-cover opacity-80 hidden dark:block" />
        </div>
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">盆栽園マップ</h1>
          <Link
            href="/shops/new"
            className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90"
          >
            <PlusIcon className="w-4 h-4" />
            <span>盆栽園を登録</span>
          </Link>
        </div>

        <ShopSearchForm
          genres={genres}
          initialSearch={params.search}
          initialGenre={params.genre}
          initialRegion={params.region}
          initialPrefecture={params.prefecture}
          initialSort={params.sort}
        />

        <Suspense fallback={<ShopContentSkeleton />}>
          <ShopContentSection
            search={params.search}
            genre={params.genre}
            region={params.region}
            prefecture={params.prefecture}
            sort={params.sort as 'rating' | 'name' | 'newest' | 'location' | undefined}
          />
        </Suspense>
      </div>
    </>
  )
}

/**
 * 盆栽園コンテンツのスケルトン表示
 */
function ShopContentSkeleton() {
  return (
    <div className="space-y-6">
      <div className="h-[250px] md:h-[400px] bg-muted animate-pulse rounded-lg" />
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-32 bg-muted animate-pulse rounded-lg" />
        ))}
      </div>
    </div>
  )
}

/**
 * 盆栽園データを非同期で取得して地図とリストを表示するServer Component
 */
async function ShopContentSection({
  search,
  genre,
  region,
  prefecture,
  sort,
}: {
  search?: string
  genre?: string
  region?: string
  prefecture?: string
  sort?: 'rating' | 'name' | 'newest' | 'location'
}) {
  const { shops } = await getShops({
    search,
    genreId: genre,
    region,
    prefecture,
    sortBy: sort,
  })

  return (
    <>
      <MapWrapper shops={shops} />
      <div>
        <h2 className="text-lg font-semibold mb-4">
          盆栽園一覧
          <span className="text-sm font-normal text-muted-foreground ml-2">
            ({shops.length}件)
          </span>
        </h2>
        <ShopList shops={shops} />
      </div>
    </>
  )
}
