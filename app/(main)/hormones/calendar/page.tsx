import { Metadata } from 'next'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { getHormonesWithSeasonalLevels } from '@/lib/actions/hormone'
import { HormoneDisclaimer } from '@/components/hormone/HormoneDisclaimer'
import { BreadcrumbJsonLd } from '@/components/seo/BreadcrumbJsonLd'
import { CalendarWithNavigation } from './CalendarWithNavigation'
import { BASE_URL, ROUTE_HORMONES, ROUTE_HORMONE_CALENDAR } from '@/lib/constants/routes'
import { pageCanonical } from '@/lib/utils/seo'

export const metadata: Metadata = {
  title: '年間ホルモン活性カレンダー - 植物ホルモン',
  description: '五大植物ホルモンの月別活性レベルを一覧で確認できるヒートマップカレンダーです。',
  alternates: { canonical: pageCanonical(ROUTE_HORMONE_CALENDAR) },
}

export const revalidate = 3600 // REVALIDATE_MASTER_DATA 相当（Next.js は revalidate に静的リテラルを要求）

export default async function HormoneCalendarPage() {
  const { hormones } = await getHormonesWithSeasonalLevels()

  return (
    <div className="space-y-6">
      <BreadcrumbJsonLd
        items={[
          { name: '植物ホルモン', url: `${BASE_URL}${ROUTE_HORMONES}` },
          { name: '年間活性カレンダー', url: `${BASE_URL}${ROUTE_HORMONE_CALENDAR}` },
        ]}
      />

      <Link href={ROUTE_HORMONES} className="inline-flex items-center gap-1 text-sm text-primary hover:underline">
        <ChevronLeft className="h-4 w-4 shrink-0" aria-hidden /> 植物ホルモン一覧
      </Link>

      <div>
        <h1 className="text-2xl font-bold">年間ホルモン活性カレンダー</h1>
        <p className="text-sm text-muted-foreground mt-1">
          五大ホルモンの月別活性レベルを一覧で確認できます（関東地方の落葉広葉樹基準）
        </p>
      </div>

      <HormoneDisclaimer />

      <div className="rounded-lg border p-4">
        <CalendarWithNavigation hormones={hormones} />
      </div>
    </div>
  )
}
