'use client'

import Link from 'next/link'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { Fragment, useState, useTransition } from 'react'

import { CATEGORY_BADGE } from '@/lib/utils/pesticide-badge'
import type { DiseasePestCategory } from '@/lib/utils/pesticide-badge'
import { ROUTE_PESTICIDES_DISEASES_PESTS } from '@/lib/constants/routes'
import { buildPesticideDiseasePestPath } from '@/lib/constants/path-builders'
import { InFeedAdSlot, InFeedAdTailFallback } from '@/components/ads'
import { PESTICIDES_AD_INTERVAL } from '@/lib/constants/limits'

type Item = {
  id: string
  name: string
  nameKana: string | null
  category: DiseasePestCategory
  description: string | null
  imageUrl: string | null
  slug: string
  _count: { effects: number }
}

const CATEGORY_EMOJI: Record<DiseasePestCategory, string> = {
  disease: '🦠',
  pest: '🐛',
  beneficial_insect: '🐝',
}

type Props = {
  diseasePests: Item[]
  defaultCategory?: string
  defaultSearch?: string
  defaultBodySizeMm?: string
}

export function DiseasePestList({ diseasePests, defaultCategory, defaultSearch, defaultBodySizeMm }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [search, setSearch] = useState(defaultSearch ?? '')
  const [bodySizeMm, setBodySizeMm] = useState(defaultBodySizeMm ?? '')

  function buildParams(overrides: { search?: string; category?: string; bodySizeMm?: string } = {}) {
    const params = new URLSearchParams()
    const s = overrides.search !== undefined ? overrides.search : search.trim()
    if (s) params.set('search', s)
    const cat = overrides.category !== undefined ? overrides.category : defaultCategory
    if (cat) params.set('category', cat)
    const bm = overrides.bodySizeMm !== undefined ? overrides.bodySizeMm : bodySizeMm.trim()
    if (bm) params.set('bodySizeMm', bm)
    return params
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    startTransition(() => {
      router.push(`${ROUTE_PESTICIDES_DISEASES_PESTS}?${buildParams().toString()}`)
    })
  }

  function handleCategoryChange(cat: string) {
    startTransition(() => {
      router.push(`${ROUTE_PESTICIDES_DISEASES_PESTS}?${buildParams({ category: cat }).toString()}`)
    })
  }

  return (
    <div className="space-y-4">
      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="flex flex-wrap gap-2 items-center">
          <label htmlFor="diseases-pests-search" className="sr-only">
            病害虫名または色で検索
          </label>
          <input
            id="diseases-pests-search"
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="病害虫名・色で検索..."
            className="flex-1 min-w-[120px] rounded-lg border border-border/50 bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
          <label className="flex items-center gap-2 text-sm text-muted-foreground shrink-0" title="害虫・益虫の体長で絞り込み">
            <span>体長（mm）</span>
            <input
              type="number"
              min={0}
              step={0.1}
              value={bodySizeMm}
              onChange={(e) => setBodySizeMm(e.target.value)}
              placeholder="例: 5"
              className="w-20 rounded-lg border border-border/50 bg-background px-2 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              aria-label="体長（ミリメートル）で害虫を絞り込む"
            />
          </label>
          <button
            type="submit"
            disabled={isPending}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
          >
            検索
          </button>
        </div>
        <p className="text-xs text-muted-foreground">
          体長を指定すると、その大きさの範囲に含まれる害虫・益虫のみ表示されます。
        </p>
      </form>

      <div className="flex gap-2">
        {[
          { value: '', label: 'すべて' },
          { value: 'disease', label: '病害' },
          { value: 'pest', label: '害虫' },
          { value: 'beneficial_insect', label: '益虫' },
        ].map((opt) => (
          <button
            key={opt.value}
            onClick={() => handleCategoryChange(opt.value)}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${(defaultCategory ?? '') === opt.value
              ? 'bg-primary text-primary-foreground'
              : 'bg-muted/50 text-muted-foreground hover:bg-muted'
              }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {diseasePests.length === 0 ? (
        <p className="text-sm text-muted-foreground py-8 text-center">
          該当するデータが見つかりませんでした
        </p>
      ) : (
        <>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {diseasePests.map((dp, index) => (
            <Fragment key={dp.id}>
            <Link
              href={buildPesticideDiseasePestPath(dp.slug)}
              className="group flex gap-3 rounded-lg border border-border/40 p-3 hover:border-primary/40 hover:bg-muted/20 transition-all"
            >
              {dp.imageUrl ? (
                <Image
                  src={dp.imageUrl}
                  alt={dp.name}
                  width={64}
                  height={64}
                  sizes="64px"
                  className="rounded-md object-cover w-16 h-16 shrink-0"
                />
              ) : (
                <div className="w-16 h-16 rounded-md bg-muted/50 flex items-center justify-center shrink-0">
                  <span className="text-2xl">
                    {CATEGORY_EMOJI[dp.category]}
                  </span>
                </div>
              )}
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-medium group-hover:text-primary transition-colors">
                    {dp.name}
                  </span>
                  <span className={`rounded px-1 py-0.5 text-[10px] font-medium ${CATEGORY_BADGE[dp.category].className}`}>
                    {CATEGORY_BADGE[dp.category].label}
                  </span>
                </div>
                {dp.description && (
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{dp.description}</p>
                )}
                {dp._count.effects > 0 && (
                  <p className="text-[11px] text-muted-foreground mt-1">対応薬剤 {dp._count.effects}件</p>
                )}
              </div>
            </Link>
            <InFeedAdSlot
              index={index}
              total={diseasePests.length}
              interval={PESTICIDES_AD_INTERVAL}
              className="col-span-full my-2"
            />
            </Fragment>
          ))}
        </div>
        <InFeedAdTailFallback
          total={diseasePests.length}
          interval={PESTICIDES_AD_INTERVAL}
          className="my-4"
        />
        </>
      )}
    </div>
  )
}
