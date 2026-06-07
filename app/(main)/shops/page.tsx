import Link from 'next/link'
import Image from 'next/image'
import { Suspense } from 'react'
import { Plus } from 'lucide-react'
import { getShops, getShopGenres } from '@/lib/actions/shop'
import { ShopList } from '@/components/shop/ShopList'
import { ShopSearchForm } from './ShopSearchForm'
import { MapWrapper } from '@/components/shop/MapWrapper'
import { pageCanonical, pageTitle } from '@/lib/utils/seo'
import { ROUTE_SHOPS } from '@/lib/constants/routes'

const SHOP_SORT_OPTIONS = ['rating', 'name', 'newest', 'location'] as const
type ShopSortOption = (typeof SHOP_SORT_OPTIONS)[number]

function isShopSortOption(value: string): value is ShopSortOption {
  return (SHOP_SORT_OPTIONS as readonly string[]).includes(value)
}

export const dynamic = 'force-dynamic' // (main) レイアウト/PremiumProvider が auth() を呼ぶため静的生成不可。SSR で配信しデータは unstable_cache でキャッシュ。

export const metadata = {
  title: pageTitle('盆栽園マップ'),
  description: '全国の盆栽園を地図で検索。地域・ジャンル・評価でフィルタリングし、営業時間や口コミを確認できます。',
  alternates: { canonical: pageCanonical(ROUTE_SHOPS) },
}

interface ShopsPageProps {
  searchParams: Promise<{
    search?: string
    genre?: string
    region?: string
    prefecture?: string
    sort?: string
  }>
}

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
            <Plus className="w-4 h-4" />
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
            sort={params.sort && isShopSortOption(params.sort) ? params.sort : undefined}
          />
        </Suspense>
      </div>
    </>
  )
}

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
  sort?: ShopSortOption
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
