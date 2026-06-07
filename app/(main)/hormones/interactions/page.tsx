import { Metadata } from 'next'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { getHormoneInteractions } from '@/lib/actions/hormone'
import { HormoneInteractionCard } from '@/components/hormone/HormoneInteractionCard'
import { HormoneDisclaimer } from '@/components/hormone/HormoneDisclaimer'
import { ROUTE_HORMONE_INTERACTIONS } from '@/lib/constants/routes'
import { pageCanonical } from '@/lib/utils/seo'

export const metadata: Metadata = {
  title: 'ホルモン相互作用 - 植物ホルモン',
  description: '植物ホルモン間の相乗・拮抗・調節関係を一覧で確認できます。',
  alternates: { canonical: pageCanonical(ROUTE_HORMONE_INTERACTIONS) },
}

export const dynamic = 'force-dynamic' // (main) レイアウト/PremiumProvider が auth() を呼ぶため静的生成不可。SSR で配信しデータは unstable_cache でキャッシュ。

export default async function HormoneInteractionsPage() {
  const { interactions } = await getHormoneInteractions()

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold break-words">ホルモン相互作用</h1>
          <p className="text-sm text-muted-foreground mt-1">ホルモン間の相乗・拮抗・調節関係</p>
        </div>
        <Link
          href="/hormones"
          className="inline-flex items-center gap-1 text-sm text-primary hover:underline shrink-0 whitespace-nowrap"
        >
          <ChevronLeft className="h-4 w-4 shrink-0" aria-hidden /> 植物ホルモントップ
        </Link>
      </div>

      <HormoneDisclaimer />

      <div className="text-sm">
        <Link href="/hormones/diagram" className="text-primary hover:underline">
          ネットワーク図で見る（ダイアグラム） →
        </Link>
      </div>

      {interactions.length === 0 ? (
        <p className="text-sm text-muted-foreground py-8 text-center">相互作用のデータはまだありません</p>
      ) : (
        <div className="space-y-3">
          {interactions.map((interaction) => (
            <HormoneInteractionCard
              key={interaction.id}
              hormoneAName={interaction.hormoneA.name}
              hormoneBName={interaction.hormoneB.name}
              type={interaction.type}
              description={interaction.description}
              bonsaiRelevance={interaction.bonsaiRelevance}
            />
          ))}
        </div>
      )}
    </div>
  )
}
