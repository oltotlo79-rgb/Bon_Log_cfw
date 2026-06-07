import type { Metadata } from 'next'
import Link from 'next/link'
import { AlertTriangle } from 'lucide-react'
import { getFertilizerColumns } from '@/lib/actions/fertilizer'
import { FertilizerDisclaimer } from '@/components/fertilizer/FertilizerDisclaimer'
import { ROUTE_FERTILIZERS_TROUBLES } from '@/lib/constants/routes'
import { pageCanonical } from '@/lib/utils/seo'

export const metadata: Metadata = {
  title: '施肥トラブル事例集 | 肥料ガイド',
  alternates: { canonical: pageCanonical(ROUTE_FERTILIZERS_TROUBLES) },
}

export const dynamic = 'force-dynamic' // (main) レイアウト/PremiumProvider が auth() を呼ぶため静的生成不可。SSR で配信しデータは unstable_cache でキャッシュ。

export default async function TroublesPage() {
  const { columns } = await getFertilizerColumns({ category: 'trouble' })

  return (
    <div className="space-y-6">
      <Link
        href="/fertilizers"
        className="text-sm text-muted-foreground hover:underline"
      >
        ← 肥料ガイドに戻る
      </Link>

      <div>
        <h1 className="text-2xl font-bold">施肥トラブル事例集</h1>
        <p className="text-sm text-muted-foreground mt-1">
          よくある施肥の失敗と対処法をまとめました
        </p>
      </div>

      {columns.length === 0 ? (
        <p className="text-sm text-muted-foreground py-8 text-center">
          トラブル事例はまだ公開されていません
        </p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {columns.map(
            (col: {
              id: string
              slug: string
              title: string
              category: string
              publishedAt: Date | null
            }) => (
              <Link
                key={col.id}
                href={`/fertilizers/columns/${col.slug}`}
                className="group flex items-start gap-3 rounded-lg border p-4 hover:border-primary/40 hover:bg-accent/50 transition-all"
              >
                <div className="flex-shrink-0 w-9 h-9 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                  <AlertTriangle className="w-4.5 h-4.5 text-amber-600 dark:text-amber-400" />
                </div>
                <div className="min-w-0 flex-1">
                  <span className="font-medium text-sm">{col.title}</span>
                  {col.publishedAt && (
                    <p className="text-[11px] text-muted-foreground mt-1">
                      {new Date(col.publishedAt).toLocaleDateString('ja-JP')}
                    </p>
                  )}
                </div>
              </Link>
            )
          )}
        </div>
      )}

      <FertilizerDisclaimer />
    </div>
  )
}
