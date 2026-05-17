'use client'

import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { useCallback } from 'react'
import {
  DICTIONARY_CATEGORIES,
  KANA_ROW_LABELS,
} from '@/lib/constants/dictionary'

type Props = {
  defaultSearch?: string
  defaultCategory?: string
  defaultRow?: string
}

export function DictionarySearch({ defaultSearch = '', defaultCategory = '', defaultRow = '' }: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const updateParams = useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString())
      if (value) {
        params.set(key, value)
      } else {
        params.delete(key)
      }
      router.push(`${pathname}?${params.toString()}`)
    },
    [router, pathname, searchParams]
  )

  return (
    <div className="space-y-3">
      <div className="relative">
        <svg
          className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none"
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <circle cx="11" cy="11" r="8" />
          <path d="m21 21-4.3-4.3" />
        </svg>
        <input
          type="search"
          placeholder="用語・読み・説明文で検索…"
          defaultValue={defaultSearch}
          onChange={(e) => updateParams('search', e.target.value)}
          className="w-full pl-9 pr-4 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
          aria-label="用語を検索"
        />
      </div>

      <div className="flex flex-wrap gap-1.5" role="group" aria-label="五十音で絞り込み">
        <button
          type="button"
          onClick={() => updateParams('row', '')}
          className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
            !defaultRow
              ? 'bg-foreground text-background border-foreground'
              : 'border-border text-muted-foreground hover:border-foreground hover:text-foreground'
          }`}
        >
          全行
        </button>
        {KANA_ROW_LABELS.map((row) => (
          <button
            key={row}
            type="button"
            onClick={() => updateParams('row', defaultRow === row ? '' : row)}
            className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
              defaultRow === row
                ? 'bg-foreground text-background border-foreground'
                : 'border-border text-muted-foreground hover:border-foreground hover:text-foreground'
            }`}
          >
            {row}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-2" role="group" aria-label="カテゴリで絞り込み">
        <button
          type="button"
          onClick={() => updateParams('category', '')}
          className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
            !defaultCategory
              ? 'bg-primary text-primary-foreground border-primary'
              : 'border-border text-muted-foreground hover:border-primary hover:text-primary'
          }`}
        >
          すべて
        </button>
        {DICTIONARY_CATEGORIES.map((cat) => (
          <button
            key={cat}
            type="button"
            onClick={() => updateParams('category', defaultCategory === cat ? '' : cat)}
            className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
              defaultCategory === cat
                ? 'bg-primary text-primary-foreground border-primary'
                : 'border-border text-muted-foreground hover:border-primary hover:text-primary'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>
    </div>
  )
}
