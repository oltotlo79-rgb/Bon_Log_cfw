import { Metadata } from 'next'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { getDiseasePests } from '@/lib/actions/pesticide'
import { PesticideDisclaimer } from '@/components/pesticide/PesticideDisclaimer'
import { DiseasePestList } from './DiseasePestList'
import { ROUTE_PESTICIDES_DISEASES_PESTS } from '@/lib/constants/routes'
import { pageCanonical } from '@/lib/utils/seo'
import { isDiseasePestCategory } from '@/lib/utils/pesticide-badge'

export const metadata: Metadata = {
  title: '病害虫・益虫図鑑 - 農薬・病害虫',
  alternates: { canonical: pageCanonical(ROUTE_PESTICIDES_DISEASES_PESTS) },
}

export const dynamic = 'force-dynamic' // (main) レイアウト/PremiumProvider が auth() を呼ぶため静的生成不可。SSR で配信しデータは unstable_cache でキャッシュ。

type Props = {
  searchParams: Promise<{ category?: string; search?: string; bodySizeMm?: string }>
}

export default async function DiseasePestsPage({ searchParams }: Props) {
  const params = await searchParams
  const category = isDiseasePestCategory(params.category) ? params.category : undefined
  const { diseasePests } = await getDiseasePests({
    category,
    search: params.search,
    bodySizeMm: params.bodySizeMm ? parseFloat(params.bodySizeMm) : undefined,
  })

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold break-words">病害虫・益虫図鑑</h1>
          <p className="text-sm text-muted-foreground mt-1">{diseasePests.length}件</p>
        </div>
        <Link
          href="/pesticides"
          className="inline-flex items-center gap-1 text-sm text-primary hover:underline shrink-0 whitespace-nowrap"
        >
          <ChevronLeft className="h-4 w-4 shrink-0" aria-hidden /> 農薬・病害虫トップ
        </Link>
      </div>

      <PesticideDisclaimer />

      <DiseasePestList
        key={`${params.category ?? ''}-${params.search ?? ''}-${params.bodySizeMm ?? ''}`}
        diseasePests={diseasePests}
        defaultCategory={params.category}
        defaultSearch={params.search}
        defaultBodySizeMm={params.bodySizeMm}
      />
    </div>
  )
}
