'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { X, MapPin, CloudSun, Settings, Wind, Sun, Snowflake, CloudRain, Droplets } from 'lucide-react'
import { getWeatherAdvice } from '@/lib/actions/weather'
import { WEATHER_DISMISS_DURATION_MS, WEATHER_DISMISS_STORAGE_KEY } from '@/lib/constants/limits'
import { ROUTE_SETTINGS } from '@/lib/constants/routes'

/**
 * アドバイスアイコン名からlucide-reactアイコンを返す
 */
function AdviceIcon({ name, className }: { name: string; className?: string }) {
  switch (name) {
    case 'wind':
      return <Wind className={className} />
    case 'sun':
      return <Sun className={className} />
    case 'snowflake':
      return <Snowflake className={className} />
    case 'cloud-rain':
      return <CloudRain className={className} />
    case 'droplets':
      return <Droplets className={className} />
    default:
      return <CloudSun className={className} />
  }
}

/**
 * 天気アドバイスカード
 *
 * フィードページのタイムライン上部に表示。
 * ユーザーが登録した位置情報に基づき天気アドバイスを表示する。
 * 位置未登録時やアドバイスなしの場合は何も表示しない。
 */
export function WeatherAdviceCard() {
  const [dismissed, setDismissed] = useState(() => {
    if (typeof window === 'undefined') return false
    const storedAt = localStorage.getItem(WEATHER_DISMISS_STORAGE_KEY)
    if (!storedAt) return false
    return Date.now() - Number(storedAt) < WEATHER_DISMISS_DURATION_MS
  })
  const [data, setData] = useState<{
    advice: { icon: string; title: string; description: string }[]
    location: string
    temperature: number | null
  } | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    async function load() {
      try {
        const result = await getWeatherAdvice()
        if (result.success && result.data) {
          // 位置未登録 or アドバイスなしの場合はデータをセットしない
          if (result.data.location && result.data.advice.length > 0) {
            setData(result.data)
          }
        }
      } catch {
        // エラー時は何も表示しない
      }
      setIsLoading(false)
    }
    load()
  }, [])

  // ローディング中・データなし・閉じた後は何も表示しない
  if (isLoading || !data || dismissed) {
    return null
  }

  return (
    <div className="bg-card border rounded-lg mb-4 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b">
        <div className="flex items-center gap-2">
          <CloudSun className="w-5 h-5 text-amber-500" />
          <h3 className="text-sm font-bold">天気アドバイス</h3>
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <MapPin className="w-3 h-3" />
            <span>{data.location}</span>
          </div>
          {data.temperature !== null && (
            <span className="text-sm font-medium text-muted-foreground">
              {Math.round(data.temperature)}°C
            </span>
          )}
        </div>
        <button
          onClick={() => {
            localStorage.setItem(WEATHER_DISMISS_STORAGE_KEY, String(Date.now()))
            setDismissed(true)
          }}
          className="p-1 rounded-md hover:bg-muted transition-colors"
          aria-label="閉じる"
        >
          <X className="w-4 h-4 text-muted-foreground" />
        </button>
      </div>

      <div className="divide-y">
        {data.advice.map((item, index) => (
          <div key={index} className="flex items-start gap-3 px-4 py-3">
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-muted flex items-center justify-center mt-0.5">
              <AdviceIcon name={item.icon} className="w-4 h-4 text-muted-foreground" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium">{item.title}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{item.description}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="px-4 py-2 border-t bg-muted/30">
        <Link
          href={ROUTE_SETTINGS}
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <Settings className="w-3 h-3" />
          位置情報を変更
        </Link>
      </div>
    </div>
  )
}
