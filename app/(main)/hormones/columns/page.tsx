import { Metadata } from 'next'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { getHormoneColumns } from '@/lib/actions/hormone'
import { HormoneDisclaimer } from '@/components/hormone/HormoneDisclaimer'
import { ROUTE_HORMONE_COLUMNS } from '@/lib/constants/routes'
import { pageCanonical } from '@/lib/utils/seo'

export const metadata: Metadata = {
  title: 'コラム - 植物ホルモン - BON-LOG',
  alternates: { canonical: pageCanonical(ROUTE_HORMONE_COLUMNS) },
}

export const revalidate = 3600 // REVALIDATE_MASTER_DATA 相当（Next.js は revalidate に静的リテラルを要求）

const CATEGORY_LABELS: Record<string, string> = {
  basics: '基礎知識',
  application: '応用テクニック',
  research: '最新研究',
  seasonal: '季節の管理',
}

export default async function HormoneColumnsPage() {
  const { columns } = await getHormoneColumns()

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold break-words">コラム</h1>
          <p className="text-sm text-muted-foreground mt-1">植物ホルモンに関する知識・ノウハウ</p>
        </div>
        <Link
          href="/hormones"
          className="inline-flex items-center gap-1 text-sm text-primary hover:underline shrink-0 whitespace-nowrap"
        >
          <ChevronLeft className="h-4 w-4 shrink-0" aria-hidden /> 植物ホルモントップ
        </Link>
      </div>

      <HormoneDisclaimer />

      {columns.length === 0 ? (
        <p className="text-sm text-muted-foreground py-8 text-center">コラム記事はまだ公開されていません</p>
      ) : (
        <div className="space-y-3">
          {columns.map((col: { id: string; slug: string; title: string; category: string; publishedAt: Date | null }) => (
            <Link
              key={col.id}
              href={`/hormones/columns/${col.slug}`}
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
