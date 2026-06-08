'use client'

import Link from 'next/link'
import { Fragment } from 'react'
import { CATEGORY_BADGE, PESTICIDE_TYPE_BADGE } from '@/lib/utils/pesticide-badge'
import type { DiseasePestCategory } from '@/lib/utils/pesticide-badge'
import type { PesticideType } from '@prisma/client'
import { InFeedAdSlot, InFeedAdTailFallback } from '@/components/ads'
import { PESTICIDES_AD_INTERVAL } from '@/lib/constants/limits'

type DiseasePestItem = {
  id: string
  name: string
  nameKana: string | null
  category: DiseasePestCategory
  slug: string
  _count: { effects: number }
}

type ProductItem = {
  id: string
  name: string
  slug: string
  pesticideType: PesticideType
}

type Props = {
  diseasePests: DiseasePestItem[]
  products: ProductItem[]
  /** 展着剤として登録されている薬剤のID一覧（重複表示を避けラベルを「展着剤」にする） */
  spreaderIds: Set<string>
  /** 現在選択中の病害虫ID（ハイライト用） */
  selectedDiseasePestId?: string
}

/** あいうえお順のソート用キー（かな優先） */
function sortKey(name: string, nameKana: string | null): string {
  return (nameKana ?? name).trim()
}

export function PesticideAllList({
  diseasePests,
  products,
  spreaderIds,
  selectedDiseasePestId,
}: Props) {
  type Row =
    | { kind: 'diseasePest'; id: string; name: string; sortKey: string; category: DiseasePestCategory; slug: string; _count: { effects: number } }
    | { kind: 'product'; id: string; name: string; sortKey: string; slug: string; typeKey: keyof typeof PESTICIDE_TYPE_BADGE }

  const rows: Row[] = [
    ...diseasePests.map((dp) => ({
      kind: 'diseasePest' as const,
      id: dp.id,
      name: dp.name,
      sortKey: sortKey(dp.name, dp.nameKana),
      category: dp.category,
      slug: dp.slug,
      _count: dp._count,
    })),
    ...products.map((p) => ({
      kind: 'product' as const,
      id: p.id,
      name: p.name,
      sortKey: sortKey(p.name, null),
      slug: p.slug,
      typeKey: (spreaderIds.has(p.id) ? 'spreader' : p.pesticideType) as keyof typeof PESTICIDE_TYPE_BADGE,
    })),
  ]

  // 病害虫と薬剤・展着剤を「あいうえお順」で混在表示するためクライアントでソート。
  // DB の sortOrder は図鑑グリッド表示用であり、このリストとは独立した並び順設計。
  rows.sort((a, b) => a.sortKey.localeCompare(b.sortKey, 'ja'))

  if (rows.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-8 text-center">
        表示するデータがありません
      </p>
    )
  }

  return (
    <>
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
      {rows.map((row, index) => (
        <Fragment key={`${row.kind}-${row.id}`}>
          {row.kind === 'diseasePest' ? (
            <Link
              href={`/pesticides?diseasePest=${row.id}`}
              className={`group rounded-lg border p-3 transition-all ${
                selectedDiseasePestId === row.id
                  ? 'border-primary bg-primary/10 hover:bg-primary/15'
                  : 'border-border/40 hover:border-primary/40 hover:bg-muted/30'
              }`}
            >
              <div className="flex items-start justify-between gap-1">
                <span className="text-sm font-medium group-hover:text-primary transition-colors leading-tight">
                  {row.name}
                </span>
                <span
                  className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium ${CATEGORY_BADGE[row.category].className}`}
                >
                  {CATEGORY_BADGE[row.category].label}
                </span>
              </div>
              {row._count.effects > 0 && (
                <p className="text-[11px] text-muted-foreground mt-1">
                  対応薬剤 {row._count.effects}件
                </p>
              )}
            </Link>
          ) : (
            <Link
              href={`/pesticides/products/${row.slug}`}
              className="group rounded-lg border border-border/40 p-3 hover:border-primary/40 hover:bg-muted/30 transition-all"
            >
              <div className="flex items-start justify-between gap-1">
                <span className="text-sm font-medium group-hover:text-primary transition-colors leading-tight">
                  {row.name}
                </span>
                <span
                  className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium ${PESTICIDE_TYPE_BADGE[row.typeKey].className}`}
                >
                  {PESTICIDE_TYPE_BADGE[row.typeKey].label}
                </span>
              </div>
            </Link>
          )}
          <InFeedAdSlot
            index={index}
            total={rows.length}
            interval={PESTICIDES_AD_INTERVAL}
            className="col-span-full my-2"
          />
        </Fragment>
      ))}
    </div>
      <InFeedAdTailFallback
        total={rows.length}
        interval={PESTICIDES_AD_INTERVAL}
        className="my-4"
      />
    </>
  )
}
