'use client'

type GenreItem = {
  id: string
  name: string
  category: string
}

type ShopGenreSelectorProps = {
  selectedGenreIds: string[]
  availableGenres: GenreItem[]
  onChange: (ids: string[]) => void
  disabled?: boolean
}

/**
 * ジャンル選択チェックボックス群（ShopForm用）
 *
 * stateなし（純粋な表示コンポーネント）
 */
export function ShopGenreSelector({
  selectedGenreIds,
  availableGenres,
  onChange,
  disabled,
}: ShopGenreSelectorProps) {
  const groupedGenres = availableGenres.reduce<Record<string, GenreItem[]>>((acc, genre) => {
    const bucket = acc[genre.category] ?? (acc[genre.category] = [])
    bucket.push(genre)
    return acc
  }, {})

  const handleToggle = (genreId: string) => {
    const next = selectedGenreIds.includes(genreId)
      ? selectedGenreIds.filter((id) => id !== genreId)
      : [...selectedGenreIds, genreId]
    onChange(next)
  }

  return (
    <div className="space-y-3">
      <label className="text-sm font-medium">取り扱いジャンル</label>
      <div className="space-y-4">
        {Object.entries(groupedGenres).map(([category, categoryGenres]) => (
          <div key={category}>
            <p className="text-xs text-muted-foreground mb-2">{category}</p>
            <div className="flex flex-wrap gap-2">
              {categoryGenres.map((genre) => (
                <button
                  key={genre.id}
                  type="button"
                  onClick={() => handleToggle(genre.id)}
                  disabled={disabled}
                  className={`px-3 py-1 text-sm rounded-full border transition-colors ${
                    selectedGenreIds.includes(genre.id)
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-background hover:bg-muted'
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
  )
}
