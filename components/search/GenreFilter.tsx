/**
 * @module components/search/GenreFilter
 */

'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { ROUTE_SEARCH } from '@/lib/constants/routes'
import { useState } from 'react'

type Genre = {
  id: string
  name: string
  category: string
}

type GenreFilterProps = {
  genres: Record<string, Genre[]>
  selectedGenreIds?: string[]
}

function ChevronDownIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="m6 9 6 6 6-6" />
    </svg>
  )
}

export function GenreFilter({ genres, selectedGenreIds = [] }: GenreFilterProps) {

  const router = useRouter()
  const searchParams = useSearchParams()
  const [isOpen, setIsOpen] = useState(false)

  const handleGenreToggle = (genreId: string) => {
    const params = new URLSearchParams(searchParams.toString())
    const currentGenres = params.getAll('genre')

    if (currentGenres.includes(genreId)) {
      params.delete('genre')
      currentGenres
        .filter((id) => id !== genreId)
        .forEach((id) => params.append('genre', id))
    } else {
      params.append('genre', genreId)
    }

    router.push(`${ROUTE_SEARCH}?${params.toString()}`)
  }

  const clearAllGenres = () => {
    const params = new URLSearchParams(searchParams.toString())
    params.delete('genre')
    router.push(`${ROUTE_SEARCH}?${params.toString()}`)
  }

  const selectedCount = selectedGenreIds.length

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 border rounded-lg bg-background hover:bg-muted transition-colors"
      >
        <span className="text-sm">
          ジャンル
          {selectedCount > 0 && (
            <span className="ml-1 px-1.5 py-0.5 text-xs bg-primary text-primary-foreground rounded-full">
              {selectedCount}
            </span>
          )}
        </span>

        <ChevronDownIcon className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-10"
            onClick={() => setIsOpen(false)}
          />

          <div className="absolute top-full left-0 mt-2 w-72 bg-card border rounded-lg shadow-lg z-20 max-h-96 overflow-y-auto">
            <div className="p-3 border-b flex items-center justify-between">
              <span className="text-sm font-medium">ジャンルで絞り込み</span>

              {selectedCount > 0 && (
                <button
                  onClick={clearAllGenres}
                  className="text-xs text-primary hover:underline"
                >
                  クリア
                </button>
              )}
            </div>

            <div className="p-2">
              {Object.entries(genres).map(([category, categoryGenres]) => (
                <div key={category} className="mb-3 last:mb-0">
                  <p className="text-xs font-medium text-muted-foreground px-2 mb-1">
                    {category}
                  </p>

                  <div className="flex flex-wrap gap-1">
                    {categoryGenres.map((genre) => (
                      <button
                        key={genre.id}
                        onClick={() => handleGenreToggle(genre.id)}
                        className={`px-2 py-1 text-xs rounded-full transition-colors ${
                          selectedGenreIds.includes(genre.id)
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-muted hover:bg-muted/80'
                        }`}
                      >
                        {genre.name}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
