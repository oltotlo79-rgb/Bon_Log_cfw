import { Metadata } from 'next'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { getFertilizerColumns } from '@/lib/actions/fertilizer'
import { FertilizerDisclaimer } from '@/components/fertilizer/FertilizerDisclaimer'
import { ROUTE_FERTILIZERS_PRODUCTS } from '@/lib/constants/routes'
import { pageCanonical } from '@/lib/utils/seo'

export const metadata: Metadata = {
  title: '定番肥料ガイド - 施肥ガイド',
  description: '盆栽栽培でよく使われる定番の肥料製品を紹介します。',
  alternates: { canonical: pageCanonical(ROUTE_FERTILIZERS_PRODUCTS) },
}

export const revalidate = 3600 // REVALIDATE_MASTER_DATA 相当（Next.js は revalidate に静的リテラルを要求）

export default async function FertilizerProductsPage() {
  const { columns } = await getFertilizerColumns({ category: 'product_guide' })

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold break-words">盆栽の定番肥料ガイド</h1>
          <p className="text-sm text-muted-foreground mt-1">
            盆栽栽培で広く使われている肥料製品の特徴・使い方をまとめました。製品選びの参考にしてください。
          </p>
        </div>
        <Link
          href="/fertilizers"
          className="inline-flex items-center gap-1 text-sm text-primary hover:underline shrink-0 whitespace-nowrap"
        >
          <ChevronLeft className="h-4 w-4 shrink-0" aria-hidden /> 施肥ガイドトップ
        </Link>
      </div>

      {columns.length === 0 ? (
        <p className="text-sm text-muted-foreground py-8 text-center">製品ガイドはまだ公開されていません</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {columns.map((col: { id: string; slug: string; title: string; content: string }) => (
            <article
              key={col.id}
              className="rounded-lg border bg-card p-5 space-y-3"
            >
              <h2 className="font-semibold text-base">{col.title}</h2>
              <div className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line">
                {col.content}
              </div>
            </article>
          ))}
        </div>
      )}

      <FertilizerDisclaimer />
    </div>
  )
}
