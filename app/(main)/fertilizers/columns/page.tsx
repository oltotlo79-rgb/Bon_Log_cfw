import { Metadata } from 'next'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { getFertilizerColumns } from '@/lib/actions/fertilizer'
import { FertilizerDisclaimer } from '@/components/fertilizer/FertilizerDisclaimer'
import { ROUTE_FERTILIZERS_COLUMNS } from '@/lib/constants/routes'
import { pageCanonical } from '@/lib/utils/seo'

export const metadata: Metadata = {
  title: 'コラム - 施肥ガイド',
  alternates: { canonical: pageCanonical(ROUTE_FERTILIZERS_COLUMNS) },
}

export const dynamic = 'force-dynamic' // (main) レイアウト/PremiumProvider が auth() を呼ぶため静的生成不可。SSR で配信しデータは unstable_cache でキャッシュ。

const CATEGORY_LABELS: Record<string, string> = {
  basics: '基礎知識',
  seasonal: '季節の施肥',
  technique: '施肥テクニック',
  troubleshooting: 'トラブル対策',
}

export default async function FertilizerColumnsPage() {
  const { columns } = await getFertilizerColumns()

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold break-words">コラム</h1>
          <p className="text-sm text-muted-foreground mt-1">施肥に関する知識・ノウハウ</p>
        </div>
        <Link
          href="/fertilizers"
          className="inline-flex items-center gap-1 text-sm text-primary hover:underline shrink-0 whitespace-nowrap"
        >
          <ChevronLeft className="h-4 w-4 shrink-0" aria-hidden /> 施肥ガイドトップ
        </Link>
      </div>

      <FertilizerDisclaimer />

      {columns.length === 0 ? (
        <p className="text-sm text-muted-foreground py-8 text-center">コラム記事はまだ公開されていません</p>
      ) : (
        <div className="space-y-3">
          {columns.map((col: { id: string; slug: string; title: string; category: string; publishedAt: Date | null }) => (
            <Link
              key={col.id}
              href={`/fertilizers/columns/${col.slug}`}
              className="block rounded-lg border border-border/40 p-4 hover:border-primary/40 hover:bg-muted/20 transition-all"
            >
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold">{col.title}</span>
                <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                  {CATEGORY_LABELS[col.category] ?? col.category}
                </span>
              </div>
              {col.publishedAt && (
                <p className="text-[11px] text-muted-foreground mt-1">
                  {new Date(col.publishedAt).toLocaleDateString('ja-JP')}
                </p>
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
