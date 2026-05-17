import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { auth } from '@/lib/auth'
import { getShopGenres } from '@/lib/actions/shop'
import { ShopForm } from '@/components/shop/ShopForm'
import { ROUTE_LOGIN, ROUTE_SHOPS } from '@/lib/constants/routes'

export const metadata = {
  title: '盆栽園を登録 - BON-LOG',
}

export default async function NewShopPage() {
  const session = await auth()
  if (!session?.user?.id) {
    redirect(ROUTE_LOGIN)
  }

  const { genres } = await getShopGenres()

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <Link
        href={ROUTE_SHOPS}
        className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="w-4 h-4" aria-hidden />
        <span>盆栽園マップに戻る</span>
      </Link>

      <div className="bg-card rounded-lg border p-6">
        <h1 className="text-2xl font-bold mb-6">盆栽園を登録</h1>
        <ShopForm genres={genres} mode="create" />
      </div>
    </div>
  )
}
