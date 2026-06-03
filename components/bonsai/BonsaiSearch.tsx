'use client'

import { useState, useTransition, useCallback } from 'react'
import { searchBonsais } from '@/lib/actions/bonsai'
import { MAX_SEARCH_QUERY_LENGTH, DEBOUNCE_DELAY_MS } from '@/lib/constants/limits'

function SearchIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  )
}

function XIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </svg>
  )
}

function LoaderIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
  )
}

interface BonsaiSearchProps {
  onSearch: (bonsais: BonsaiResult[]) => void
  onClear: () => void
  initialCount: number
}

type BonsaiResult = {
  id: string
  name: string
  species: string | null
  acquiredAt: Date | null
  description: string | null
  records?: {
    images?: { url: string }[]
  }[]
  _count?: { records: number }
}

export function BonsaiSearch({ onSearch, onClear, initialCount }: BonsaiSearchProps) {
  const [query, setQuery] = useState('')
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [resultCount, setResultCount] = useState<number | null>(null)
  const [debounceTimer, setDebounceTimer] = useState<NodeJS.Timeout | null>(null)

  const handleSearch = useCallback((searchQuery: string) => {
    if (debounceTimer) {
      clearTimeout(debounceTimer)
    }

    const trimmed = searchQuery.trim()

    if (!trimmed) {
      setResultCount(null)
      setError(null)
      onClear()
      return
    }

    const timer = setTimeout(() => {
      startTransition(async () => {
        setError(null)
        const result = await searchBonsais(trimmed)

        if (!result.success) {
          setError(result.error)
          setResultCount(null)
          return
        }
        const bonsais = result.data?.bonsais
        if (bonsais) {
          setResultCount(bonsais.length)
          onSearch(bonsais)
        }
      })
    }, DEBOUNCE_DELAY_MS)

    setDebounceTimer(timer)
  }, [debounceTimer, onSearch, onClear])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setQuery(value)
    handleSearch(value)
  }

  const handleClear = () => {
    setQuery('')
    setResultCount(null)
    setError(null)
    onClear()
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    handleSearch(query)
  }

  return (
    <div className="space-y-2">
      <form onSubmit={handleSubmit} className="relative">
        <div className="relative">
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            value={query}
            onChange={handleInputChange}
            placeholder="盆栽を検索（名前・樹種・説明）"
            className="w-full pl-10 pr-10 py-2 rounded-lg border bg-background focus:outline-none focus:ring-2 focus:ring-primary text-sm"
            maxLength={MAX_SEARCH_QUERY_LENGTH}
          />
          {isPending && (
            <LoaderIcon className="absolute right-10 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground animate-spin" />
          )}
          {query && !isPending && (
            <button
              type="button"
              onClick={handleClear}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 hover:bg-muted rounded"
            >
              <XIcon className="w-4 h-4 text-muted-foreground" />
            </button>
          )}
        </div>
      </form>

      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}
      {resultCount !== null && !error && (
        <p className="text-sm text-muted-foreground">
          {resultCount === 0
            ? '該当する盆栽が見つかりませんでした'
            : `${resultCount}件の盆栽が見つかりました`}
        </p>
      )}
      {resultCount === null && !query && (
        <p className="text-sm text-muted-foreground">
          {initialCount}本の盆栽を管理中
        </p>
      )}
    </div>
  )
}
