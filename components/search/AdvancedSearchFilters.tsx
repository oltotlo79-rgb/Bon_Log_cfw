'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'

function ChevronDownIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="m6 9 6 6 6-6" />
    </svg>
  )
}

type AdvancedSearchFiltersProps = {
  dateFrom?: string
  dateTo?: string
  minLikes?: string
  mediaType?: string
}

export function AdvancedSearchFilters({
  dateFrom: initialDateFrom,
  dateTo: initialDateTo,
  minLikes: initialMinLikes,
  mediaType: initialMediaType,
}: AdvancedSearchFiltersProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isOpen, setIsOpen] = useState(
    !!(initialDateFrom || initialDateTo || initialMinLikes || initialMediaType)
  )

  const [dateFrom, setDateFrom] = useState(initialDateFrom || '')
  const [dateTo, setDateTo] = useState(initialDateTo || '')
  const [minLikes, setMinLikes] = useState(initialMinLikes || '')
  const [mediaType, setMediaType] = useState(initialMediaType || '')

  function applyFilters() {
    const params = new URLSearchParams(searchParams.toString())
    if (dateFrom) params.set('dateFrom', dateFrom)
    else params.delete('dateFrom')
    if (dateTo) params.set('dateTo', dateTo)
    else params.delete('dateTo')
    if (minLikes && parseInt(minLikes) > 0) params.set('minLikes', minLikes)
    else params.delete('minLikes')
    if (mediaType) params.set('mediaType', mediaType)
    else params.delete('mediaType')
    router.push(`/search?${params.toString()}`)
  }

  function resetFilters() {
    setDateFrom('')
    setDateTo('')
    setMinLikes('')
    setMediaType('')
    const params = new URLSearchParams(searchParams.toString())
    params.delete('dateFrom')
    params.delete('dateTo')
    params.delete('minLikes')
    params.delete('mediaType')
    router.push(`/search?${params.toString()}`)
  }

  const hasFilters = dateFrom || dateTo || minLikes || mediaType

  return (
    <div className="border-b">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1 px-3 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors w-full"
      >
        <ChevronDownIcon className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        詳細フィルター
        {hasFilters && <span className="ml-1 w-2 h-2 rounded-full bg-bonsai-green" />}
      </button>

      {isOpen && (
        <div className="px-3 pb-3 space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-muted-foreground">開始日</label>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="w-full px-2 py-1 text-sm border rounded-md bg-background"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">終了日</label>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="w-full px-2 py-1 text-sm border rounded-md bg-background"
              />
            </div>
          </div>

          <div>
            <label className="text-xs text-muted-foreground">最小いいね数</label>
            <input
              type="number"
              min="0"
              value={minLikes}
              onChange={(e) => setMinLikes(e.target.value)}
              placeholder="0"
              className="w-full px-2 py-1 text-sm border rounded-md bg-background"
            />
          </div>

          <div>
            <label className="text-xs text-muted-foreground block mb-1">メディア種別</label>
            <div className="flex gap-2 flex-wrap">
              {[
                { label: 'すべて', value: '' },
                { label: '画像あり', value: 'images' },
                { label: '動画あり', value: 'videos' },
                { label: 'テキストのみ', value: 'text' },
              ].map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setMediaType(opt.value)}
                  className={`px-3 py-1 text-xs rounded-full border transition-colors ${
                    mediaType === opt.value
                      ? 'bg-bonsai-green text-white border-bonsai-green'
                      : 'border-border hover:bg-muted'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2 pt-1">
            <Button size="sm" variant="bonsai" onClick={applyFilters}>
              適用
            </Button>
            {hasFilters && (
              <Button size="sm" variant="outline" onClick={resetFilters}>
                リセット
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
