import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { auth } from '@/lib/auth'
import { ROUTE_LOGIN } from '@/lib/constants/routes'
import { buildShopPath } from '@/lib/constants/path-builders'
import { getShop, getShopGenres } from '@/lib/actions/shop'
import { ShopForm } from '@/components/shop/ShopForm'

interface EditShopPageProps {
  params: Promise<{ id: string }>
}

function ArrowLeftIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="m12 19-7-7 7-7" />
      <path d="M19 12H5" />
    </svg>
  )
}

export async function generateMetadata({ params }: EditShopPageProps) {
  const { id } = await params
  const result = await getShop(id)

  // 編集ページは所有者専用のため検索エンジンには公開しない
  const robots = { index: false, follow: false } as const

  if ('error' in result) {
    return { title: '盆栽園が見つかりません', robots }
  }

  return {
    title: `${result.shop.name}を編集`,
    robots,
  }
}

export default async function EditShopPage({ params }: EditShopPageProps) {
  const { id } = await params
  const session = await auth()

  if (!session?.user?.id) {
    redirect(ROUTE_LOGIN)
  }

  const [shopResult, { genres }] = await Promise.all([
    getShop(id),
    getShopGenres(),
  ])

  if ('error' in shopResult) {
    notFound()
  }

  const shop = shopResult.shop

  if (!shop.isOwner) {
    redirect(buildShopPath(id))
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <Link
        href={buildShopPath(id)}
        className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground"
      >
        <ArrowLeftIcon className="w-4 h-4" />
        <span>詳細に戻る</span>
      </Link>

      <div className="bg-card rounded-lg border p-6">
        <h1 className="text-2xl font-bold mb-6">盆栽園を編集</h1>
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
