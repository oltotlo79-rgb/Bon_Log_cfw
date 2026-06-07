import { Metadata } from 'next'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { getSimulatorData } from '@/lib/actions/hormone'
import { HormoneBalanceSimulator } from '@/components/hormone/HormoneBalanceSimulator'
import { HormoneDisclaimer } from '@/components/hormone/HormoneDisclaimer'
import { BreadcrumbJsonLd } from '@/components/seo/BreadcrumbJsonLd'
import { BASE_URL, ROUTE_HORMONES, ROUTE_HORMONE_SIMULATOR } from '@/lib/constants/routes'
import { pageCanonical } from '@/lib/utils/seo'

export const metadata: Metadata = {
  title: 'ホルモンバランスシミュレーター - 植物ホルモン',
  description: '月と盆栽技法を選んで、五大ホルモンのバランス変動を予測するシミュレーターです。',
  alternates: { canonical: pageCanonical(ROUTE_HORMONE_SIMULATOR) },
}

export const dynamic = 'force-dynamic' // (main) レイアウト/PremiumProvider が auth() を呼ぶため静的生成不可。SSR で配信しデータは unstable_cache でキャッシュ。

export default async function HormoneSimulatorPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>
}) {
  const { hormones, techniques, seasonalLevels } = await getSimulatorData()

  const params = await searchParams
  const monthParam = params.month ? parseInt(params.month, 10) : undefined
  const initialMonth = monthParam && monthParam >= 1 && monthParam <= 12 ? monthParam : undefined

  return (
    <div className="space-y-6">
      <BreadcrumbJsonLd
        items={[
          { name: '植物ホルモン', url: `${BASE_URL}${ROUTE_HORMONES}` },
          { name: 'ホルモンバランスシミュレーター', url: `${BASE_URL}${ROUTE_HORMONE_SIMULATOR}` },
        ]}
      />

      <Link href={ROUTE_HORMONES} className="inline-flex items-center gap-1 text-sm text-primary hover:underline">
        <ChevronLeft className="h-4 w-4 shrink-0" aria-hidden /> 植物ホルモン一覧
      </Link>

      <div>
        <h1 className="text-2xl font-bold">ホルモンバランスシミュレーター</h1>
        <p className="text-sm text-muted-foreground mt-1">
          月と盆栽技法を選ぶと、五大ホルモンのバランスがどう変動するかを予測します
        </p>
      </div>

      <HormoneDisclaimer />

      <div className="rounded-lg border p-4 sm:p-6">
        <HormoneBalanceSimulator
          hormones={hormones}
          techniques={techniques}
          seasonalLevels={seasonalLevels}
          initialMonth={initialMonth}
        />
      </div>
    </div>
  )
}
