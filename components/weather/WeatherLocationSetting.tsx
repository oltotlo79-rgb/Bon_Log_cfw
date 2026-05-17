'use client'

import { useState, useEffect, useCallback } from 'react'
import { MapPin, Navigation, Trash2, Loader2 } from 'lucide-react'
import { saveWeatherLocation, getWeatherLocation, removeWeatherLocation } from '@/lib/actions/weather'
import { PREFECTURES } from '@/lib/prefectures'
import { useToast } from '@/hooks/use-toast'
import {
  MSG_CITY_REQUIRED,
  MSG_GEO_CONVERT_FAILED,
  MSG_GEO_ERROR,
  MSG_GEO_FETCH_FAILED,
  MSG_GEO_JAPAN_REQUIRED,
  MSG_GEO_NOT_SUPPORTED,
  MSG_GEO_PERMISSION_REQUIRED_DESCRIPTION,
  MSG_GEO_PERMISSION_REQUIRED_TITLE,
  MSG_GEO_REGISTERED,
  MSG_GEO_REMOVED,
  MSG_GEO_SAVE_FAILED,
  MSG_PREFECTURE_REQUIRED,
} from '@/lib/constants/messages'

/**
 * 天気アドバイス用位置情報設定コンポーネント
 *
 * 設定ページに配置し、天気アドバイスのための位置情報を登録・削除する。
 * Geolocation APIによる自動取得と、都道府県+市区町村の手動入力に対応。
 */
export function WeatherLocationSetting() {
  const { toast } = useToast()

  // 登録済み位置情報
  const [location, setLocation] = useState<{
    prefecture: string
    city: string
    latitude: number
    longitude: number
  } | null>(null)

  // ローディング状態
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [isGeolocating, setIsGeolocating] = useState(false)

  // 手動入力フォーム
  const [prefecture, setPrefecture] = useState('')
  const [city, setCity] = useState('')

  // 初回ロード: 現在の登録情報を取得
  useEffect(() => {
    async function load() {
      try {
        const result = await getWeatherLocation()
        if (result.success && result.data) {
          setLocation(result.data)
        }
      } catch {
        // DB未マイグレーション等でServer Actionが失敗した場合は無視
      }
      setIsLoading(false)
    }
    load()
  }, [])

  /**
   * Geolocation APIで現在地を取得し、逆ジオコーディングで都道府県・市区町村を特定
   */
  const handleGeolocation = useCallback(async () => {
    if (!('geolocation' in navigator)) {
      toast({ title: MSG_GEO_NOT_SUPPORTED, variant: 'destructive' })
      return
    }

    setIsGeolocating(true)

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords

        try {
          // OpenStreetMap Nominatim APIで逆ジオコーディング
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&accept-language=ja&zoom=10`,
            { headers: { 'User-Agent': 'BonsaiSNS/1.0' } }
          )

          if (!res.ok) {
            toast({ title: MSG_GEO_CONVERT_FAILED, variant: 'destructive' })
            setIsGeolocating(false)
            return
          }

          const data = await res.json()
          const address = data.address || {}

          // 都道府県を特定
          const pref = address.province || address.state || ''
          // 市区町村を特定
          const cityName = address.city || address.town || address.village || address.county || ''

          if (!pref || !(PREFECTURES as readonly string[]).includes(pref)) {
            toast({ title: MSG_GEO_JAPAN_REQUIRED, variant: 'destructive' })
            setIsGeolocating(false)
            return
          }

          // 保存
          setIsSaving(true)
          const result = await saveWeatherLocation({
            prefecture: pref,
            city: cityName,
            latitude,
            longitude,
          })

          if (result.success) {
            setLocation({ prefecture: pref, city: cityName, latitude, longitude })
            toast({ title: MSG_GEO_REGISTERED })
          } else {
            toast({ title: result.error, variant: 'destructive' })
          }
        } catch {
          toast({ title: MSG_GEO_ERROR, variant: 'destructive' })
        }

        setIsSaving(false)
        setIsGeolocating(false)
      },
      (err) => {
        setIsGeolocating(false)
        if (err.code === err.PERMISSION_DENIED) {
          toast({
            title: MSG_GEO_PERMISSION_REQUIRED_TITLE,
            description: MSG_GEO_PERMISSION_REQUIRED_DESCRIPTION,
            variant: 'destructive',
          })
        } else {
          toast({ title: MSG_GEO_FETCH_FAILED, variant: 'destructive' })
        }
      },
      { enableHighAccuracy: false, timeout: 10000 }
    )
  }, [toast])

  /**
   * 手動入力で位置情報を保存
   * 都道府県の代表座標を使用（簡易的にNominatim APIで取得）
   */
  const handleManualSave = useCallback(async () => {
    if (!prefecture) {
      toast({ title: MSG_PREFECTURE_REQUIRED, variant: 'destructive' })
      return
    }
    if (!city.trim()) {
      toast({ title: MSG_CITY_REQUIRED, variant: 'destructive' })
      return
    }

    setIsSaving(true)

    try {
      // Nominatim APIで緯度経度を取得
      const query = encodeURIComponent(`${prefecture} ${city.trim()}`)
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${query}&countrycodes=jp&limit=1&accept-language=ja`,
        { headers: { 'User-Agent': 'BonsaiSNS/1.0' } }
      )

      let latitude = 0
      let longitude = 0

      if (res.ok) {
        const results = await res.json()
        if (results.length > 0) {
          latitude = parseFloat(results[0].lat)
          longitude = parseFloat(results[0].lon)
        }
      }

      // 座標が取得できなくても都道府県+市区町村だけ保存（座標0,0は後で更新可能）
      if (latitude === 0 && longitude === 0) {
        // 都道府県の概算座標を使用
        const prefRes = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(prefecture)}&countrycodes=jp&limit=1&accept-language=ja`,
          { headers: { 'User-Agent': 'BonsaiSNS/1.0' } }
        )
        if (prefRes.ok) {
          const prefResults = await prefRes.json()
          if (prefResults.length > 0) {
            latitude = parseFloat(prefResults[0].lat)
            longitude = parseFloat(prefResults[0].lon)
          }
        }
      }

      const result = await saveWeatherLocation({
        prefecture,
        city: city.trim(),
        latitude,
        longitude,
      })

      if (result.success) {
        setLocation({ prefecture, city: city.trim(), latitude, longitude })
        setPrefecture('')
        setCity('')
        toast({ title: MSG_GEO_REGISTERED })
      } else {
        toast({ title: result.error, variant: 'destructive' })
      }
    } catch {
      toast({ title: MSG_GEO_SAVE_FAILED, variant: 'destructive' })
    }

    setIsSaving(false)
  }, [prefecture, city, toast])

  /**
   * 位置情報を削除
   */
  const handleRemove = useCallback(async () => {
    setIsSaving(true)
    const result = await removeWeatherLocation()
    if (result.success) {
      setLocation(null)
      toast({ title: MSG_GEO_REMOVED })
    } else {
      toast({ title: result.error, variant: 'destructive' })
    }
    setIsSaving(false)
  }, [toast])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-6">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    )
  }

  // 登録済みの場合: 位置表示 + 削除ボタン
  if (location) {
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MapPin className="w-4 h-4 text-primary" />
            <span className="text-sm">
              {location.prefecture} {location.city}
            </span>
          </div>
          <button
            onClick={handleRemove}
            disabled={isSaving}
            className="flex items-center gap-1 text-sm text-destructive hover:text-destructive/80 disabled:opacity-50"
          >
            {isSaving ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Trash2 className="w-4 h-4" />
            )}
            削除
          </button>
        </div>
        <p className="text-xs text-muted-foreground">
          この位置情報をもとに天気アドバイスがタイムラインに表示されます
        </p>
      </div>
    )
  }

  // 未登録の場合: 登録フォーム
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        位置情報を登録すると、天気に基づく盆栽管理アドバイスがタイムラインに表示されます
      </p>

      {/* Geolocation API ボタン */}
      <button
        onClick={handleGeolocation}
        disabled={isGeolocating || isSaving}
        className="w-full flex items-center justify-center gap-2 px-4 py-2.5 border rounded-lg hover:bg-muted/50 transition-colors disabled:opacity-50"
      >
        {isGeolocating ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <Navigation className="w-4 h-4" />
        )}
        <span className="text-sm font-medium">
          {isGeolocating ? '取得中...' : '現在地を取得'}
        </span>
      </button>

      {/* 区切り線 */}
      <div className="flex items-center gap-3">
        <div className="flex-1 border-t" />
        <span className="text-xs text-muted-foreground">または</span>
        <div className="flex-1 border-t" />
      </div>

      {/* 手動入力: 都道府県 + 市区町村 */}
      <div className="space-y-3">
        <div>
          <label htmlFor="weather-prefecture" className="text-xs font-medium text-muted-foreground">
            都道府県
          </label>
          <select
            id="weather-prefecture"
            value={prefecture}
            onChange={(e) => setPrefecture(e.target.value)}
            disabled={isSaving}
            className="w-full mt-1 px-3 py-2 rounded-lg border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="">選択してください</option>
            {PREFECTURES.map((pref) => (
              <option key={pref} value={pref}>
                {pref}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="weather-city" className="text-xs font-medium text-muted-foreground">
            市区町村
          </label>
          <input
            id="weather-city"
            type="text"
            value={city}
            onChange={(e) => setCity(e.target.value)}
            disabled={isSaving}
            placeholder="例: 渋谷区"
            className="w-full mt-1 px-3 py-2 rounded-lg border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>

        <button
          onClick={handleManualSave}
          disabled={isSaving || !prefecture || !city.trim()}
          className="w-full px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {isSaving ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              保存中...
            </>
          ) : (
            <>
              <MapPin className="w-4 h-4" />
              位置情報を登録
            </>
          )}
        </button>
      </div>
    </div>
  )
}
