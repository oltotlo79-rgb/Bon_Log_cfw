/**
 * @module components/event/RegionFilter
 */

'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { REGION_NAME_LIST as REGION_LIST, PREFECTURES } from '@/lib/prefectures'

interface RegionFilterProps {
  currentRegion?: string
  currentPrefecture?: string
}

export function RegionFilter({ currentRegion, currentPrefecture }: RegionFilterProps) {
  const router = useRouter()
  const searchParams = useSearchParams()

  const handleRegionChange = (region: string) => {
    const params = new URLSearchParams(searchParams.toString())
    if (region) {
      // 地方と都道府県は排他的
      params.set('region', region)
      params.delete('prefecture')
    } else {
      params.delete('region')
    }
    router.push(`/events?${params.toString()}`)
  }

  const handlePrefectureChange = (prefecture: string) => {
    const params = new URLSearchParams(searchParams.toString())
    if (prefecture) {
      // 地方と都道府県は排他的
      params.set('prefecture', prefecture)
      params.delete('region')
    } else {
      params.delete('prefecture')
    }
    router.push(`/events?${params.toString()}`)
  }

  const handleClear = () => {
    const params = new URLSearchParams(searchParams.toString())
    params.delete('region')
    params.delete('prefecture')
    router.push(`/events?${params.toString()}`)
  }

  return (
    <div className="bg-card rounded-lg border p-4 space-y-4">
      <h3 className="font-semibold">地域で絞り込み</h3>

      <div>
        <label className="block text-sm text-muted-foreground mb-2">
          地方
        </label>
        <div className="flex flex-wrap gap-2">
          {REGION_LIST.map((region) => (
            <button
              key={region}
              onClick={() => handleRegionChange(currentRegion === region ? '' : region)}
              className={`px-3 py-1 text-sm rounded-full border transition-colors ${
                currentRegion === region
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'hover:bg-muted'
              }`}
            >
              {region}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label htmlFor="prefecture-select" className="block text-sm text-muted-foreground mb-2">
          都道府県
        </label>
        <select
          id="prefecture-select"
          value={currentPrefecture || ''}
          onChange={(e) => handlePrefectureChange(e.target.value)}
          className="w-full px-3 py-2 border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary"
        >
          <option value="">すべての都道府県</option>
          {PREFECTURES.map((pref) => (
            <option key={pref} value={pref}>
              {pref}
            </option>
          ))}
        </select>
      </div>

      {(currentRegion || currentPrefecture) && (
        <button
          onClick={handleClear}
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          フィルターをクリア
        </button>
      )}
    </div>
  )
}
