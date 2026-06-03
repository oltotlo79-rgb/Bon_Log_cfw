import { Metadata } from 'next'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { getPesticideOptions, getPesticideIncompatibilities } from '@/lib/actions/pesticide'
import { MixingChecker } from '@/components/pesticide/MixingChecker'
import { PesticideDisclaimer } from '@/components/pesticide/PesticideDisclaimer'
import { ROUTE_PESTICIDES_MIXING } from '@/lib/constants/routes'
import { pageCanonical } from '@/lib/utils/seo'

export const metadata: Metadata = {
  title: '混用チェッカー | 農薬・病害虫',
  description: '農薬の混用可否をデータベースで確認。混用不可の組み合わせを事前にチェックできます。',
  alternates: { canonical: pageCanonical(ROUTE_PESTICIDES_MIXING) },
}

export default async function MixingCheckerPage() {
  const [optionsResult, incompResult] = await Promise.all([
    getPesticideOptions(),
    getPesticideIncompatibilities(),
  ])

  const pesticides = optionsResult.pesticides.map((p) => ({
    id: p.id,
    name: p.name,
    slug: p.slug,
    pesticideType: p.pesticideType,
  }))

  const incompatibilities = incompResult.incompatibilities.map((r) => ({
    pesticideId: r.pesticideId,
    incompatibleWithId: r.incompatibleWithId,
  }))

  return (
    <div className="space-y-6">
      <Link
        href="/pesticides"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        農薬・病害虫トップへ
      </Link>

      <div>
        <h1 className="text-2xl font-bold">混用チェッカー</h1>
        <p className="text-sm text-muted-foreground mt-1">
          農薬の混用可否を確認できます。2〜3剤の組み合わせをチェックしましょう。
        </p>
      </div>

      <MixingChecker
        pesticides={pesticides}
        incompatibilities={incompatibilities}
      />

      <PesticideDisclaimer />
    </div>
  )
}
