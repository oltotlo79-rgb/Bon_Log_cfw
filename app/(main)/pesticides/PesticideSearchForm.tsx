'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useState, useTransition } from 'react'
import { ROUTE_PESTICIDES } from '@/lib/constants/routes'

type Props = {
  defaultSearch?: string
  defaultType?: string
  /** URL の category パラメータ（害虫/病気/益虫タグのハイライト用） */
  defaultCategory?: 'pest' | 'disease' | 'beneficial_insect'
}

export function PesticideSearchForm({ defaultSearch, defaultType, defaultCategory }: Props) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()
  const [search, setSearch] = useState(defaultSearch ?? '')

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const params = new URLSearchParams(searchParams.toString())
    if (search.trim()) {
      params.set('search', search.trim())
    } else {
      params.delete('search')
    }
    params.delete('diseasePest')
    startTransition(() => {
      router.push(`${ROUTE_PESTICIDES}?${params.toString()}`)
    })
  }

  /** 一組のタグ用: 全て / 害虫 / 病気 / 殺虫剤 / 殺菌剤 / 殺ダニ剤 / 展着剤 */
  function handleTagChange(value: string) {
    if (value === '') {
      startTransition(() => router.push(ROUTE_PESTICIDES))
      return
    }
    const params = new URLSearchParams()
    if (value === 'pest' || value === 'disease' || value === 'beneficial_insect') {
      params.set('category', value)
    } else {
      params.set('type', value)
    }
    startTransition(() => {
      router.push(`${ROUTE_PESTICIDES}?${params.toString()}`)
    })
  }

  function handleClear() {
    setSearch('')
    startTransition(() => {
      router.push(ROUTE_PESTICIDES)
    })
  }

  const tagOptions = [
    { value: '', label: '全て' },
    { value: 'pest', label: '害虫' },
    { value: 'disease', label: '病気' },
    { value: 'beneficial_insect', label: '益虫' },
    { value: 'insecticide', label: '殺虫剤' },
    { value: 'fungicide', label: '殺菌剤' },
    { value: 'acaricide', label: '殺ダニ剤' },
    { value: 'compound', label: '複合剤' },
    { value: 'spreader', label: '展着剤' },
  ]

  function isTagActive(opt: (typeof tagOptions)[number]) {
    if (opt.value === '') return !defaultType && !defaultCategory
    if (opt.value === 'pest' || opt.value === 'disease' || opt.value === 'beneficial_insect') return defaultCategory === opt.value
    return defaultType === opt.value
  }

  return (
    <div className="space-y-3">
      <form onSubmit={handleSubmit} className="flex flex-wrap gap-2">
        <label htmlFor="pesticide-search" className="sr-only">
          薬剤名・登録番号で検索
        </label>
        <input
          id="pesticide-search"
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="薬剤名・登録番号で検索..."
          className="min-w-0 flex-1 rounded-lg border border-border/50 bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
        />
        <div className="flex shrink-0 gap-2">
          <button
            type="submit"
            disabled={isPending}
            className="whitespace-nowrap rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
          >
            検索
          </button>
          {(defaultSearch || defaultType || defaultCategory || searchParams.get('diseasePest')) && (
            <button
              type="button"
              onClick={handleClear}
              className="whitespace-nowrap rounded-lg border border-border/50 px-3 py-2 text-sm text-muted-foreground hover:bg-muted/50 transition-colors"
            >
              クリア
            </button>
          )}
        </div>
      </form>

      <div className="flex flex-wrap gap-2">
        {tagOptions.map((opt) => (
          <button
            key={opt.value || 'all'}
            onClick={() => handleTagChange(opt.value)}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              isTagActive(opt)
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted/50 text-muted-foreground hover:bg-muted'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  )
}
