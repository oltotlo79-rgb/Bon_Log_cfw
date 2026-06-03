/**
 * @module components/post/GenreSelector
 */

'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'

type Genre = {
  id: string
  name: string
  category: string
}

type GenreSelectorProps = {
  genres: Record<string, Genre[]>
  selectedIds: string[]
  onChange: (ids: string[]) => void
  maxSelections?: number
}

function ChevronDownIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="m6 9 6 6 6-6" />
    </svg>
  )
}

export function GenreSelector({ genres, selectedIds, onChange, maxSelections = 3 }: GenreSelectorProps) {

  const [isOpen, setIsOpen] = useState(false)

  function toggleGenre(genreId: string) {
    if (selectedIds.includes(genreId)) {
      onChange(selectedIds.filter(id => id !== genreId))
    } else if (selectedIds.length < maxSelections) {
      onChange([...selectedIds, genreId])
    }
  }

  const selectedNames = Object.values(genres)
    .flat()
    .filter(g => selectedIds.includes(g.id))
    .map(g => g.name)

  return (
    <div className="relative">
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full justify-between"
      >
        <span className="truncate">
          {selectedNames.length > 0
            ? selectedNames.join(', ')
            : 'ジャンルを選択（任意）'}
        </span>
        <ChevronDownIcon className={`w-4 h-4 ml-2 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </Button>

      {isOpen && (
        <div className="absolute z-10 bottom-full mb-1 w-full bg-popover border rounded-lg shadow-lg max-h-64 overflow-y-auto">
          {Object.entries(genres).map(([category, categoryGenres]) => (
            <div key={category} className="p-2">
              <p className="text-xs font-medium text-muted-foreground mb-1 px-2">{category}</p>

              <div className="flex flex-wrap gap-1">
                {categoryGenres.map(genre => {
                  const isSelected = selectedIds.includes(genre.id)
                  const isDisabled = !isSelected && selectedIds.length >= maxSelections

                  return (
                    <button
                      key={genre.id}
                      type="button"
                      onClick={() => toggleGenre(genre.id)}
                      disabled={isDisabled}
                      className={`
                        px-2 py-1 text-xs rounded-full transition-colors
                        ${isSelected
                          ? 'bg-bonsai-green text-white'
                          : isDisabled
                            ? 'bg-muted text-muted-foreground cursor-not-allowed'
                            : 'bg-muted hover:bg-muted/80'
                        }
                      `}
                    >
                      {genre.name}
                    </button>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {selectedIds.length > 0 && (
        <p className="text-xs text-muted-foreground mt-1">
          {selectedIds.length}/{maxSelections} 選択中
        </p>
      )}
    </div>
  )
}
