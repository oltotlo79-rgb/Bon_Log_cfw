'use client'

import Link from 'next/link'
import { CATEGORY_BADGE } from '@/lib/utils/pesticide-badge'
import type { DiseasePestCategory } from '@/lib/utils/pesticide-badge'

type DiseasePestItem = {
  id: string
  name: string
  nameKana: string | null
  category: DiseasePestCategory
  slug: string
  _count: { effects: number }
}

type Props = {
  diseasePests: DiseasePestItem[]
  /** 現在URLで選択されている病害虫ID（ハイライト表示用） */
  selectedId?: string
  /** タグで指定された絞り込み（ページの一組タグで制御） */
  filterByCategory: 'all' | DiseasePestCategory
}

export function DiseasePestGrid({ diseasePests, selectedId, filterByCategory }: Props) {
  const filtered =
    filterByCategory === 'all'
      ? diseasePests
      : diseasePests.filter((dp) => dp.category === filterByCategory)

  if (diseasePests.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-8 text-center">
        データはまだ登録されていません。管理画面から登録してください。
      </p>
    )
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
      {filtered.map((dp) => (
        <Link
          key={dp.id}
          href={`/pesticides?diseasePest=${dp.id}`}
          className={`group rounded-lg border p-3 transition-all ${
            selectedId === dp.id
              ? 'border-primary bg-primary/10 hover:bg-primary/15'
              : 'border-border/40 hover:border-primary/40 hover:bg-muted/30'
          }`}
        >
          <div className="flex items-start justify-between gap-1">
            <span className="text-sm font-medium group-hover:text-primary transition-colors leading-tight">
              {dp.name}
            </span>
            <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium ${CATEGORY_BADGE[dp.category].className}`}>
              {CATEGORY_BADGE[dp.category].label}
            </span>
          </div>
          {dp._count.effects > 0 && (
            <p className="text-[11px] text-muted-foreground mt-1">
              対応薬剤 {dp._count.effects}件
            </p>
          )}
        </Link>
      ))}
    </div>
  )
}
