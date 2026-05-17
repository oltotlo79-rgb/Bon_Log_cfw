'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { ROUTE_PESTICIDES_INGREDIENTS } from '@/lib/constants/routes'

type Props = { defaultSearch?: string }

export function IngredientSearchForm({ defaultSearch }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [search, setSearch] = useState(defaultSearch ?? '')

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const params = new URLSearchParams()
    if (search.trim()) params.set('search', search.trim())
    startTransition(() => {
      router.push(`${ROUTE_PESTICIDES_INGREDIENTS}?${params.toString()}`)
    })
  }

  return (
    <form onSubmit={handleSubmit} className="flex gap-2">
      <label htmlFor="ingredient-search" className="sr-only">
        原体名またはFRAC/IRACコードで検索
      </label>
      <input
        id="ingredient-search"
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="原体名・FRAC/IRACコードで検索..."
        className="flex-1 rounded-lg border border-border/50 bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
      />
      <button
        type="submit"
        disabled={isPending}
        className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
      >
        検索
      </button>
    </form>
  )
}
