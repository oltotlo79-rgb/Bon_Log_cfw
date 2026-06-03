'use client'

import { useState, useCallback } from 'react'
import { searchAddressSuggestions } from '@/lib/actions/shop'
import { TIMEOUT_DROPDOWN_BLUR, MIN_ADDRESS_SEARCH_LENGTH } from '@/lib/constants/limits'
import { MSG_ADDRESS_NOT_FOUND, MSG_ADDRESS_REQUIRED } from '@/lib/constants/messages'

interface AddressSuggestion {
  latitude: number
  longitude: number
  displayName: string
  formattedAddress: string
}

type AddressGeocodingSectionProps = {
  address: string
  latitude: number | null
  longitude: number | null
  onAddressChange: (v: string) => void
  onLocationSet: (lat: number, lng: number, address: string) => void
  disabled?: boolean
}

/**
 * 住所入力 + ジオコーディング検索 + サジェスト候補表示
 *
 * 内部state: suggestions, showSuggestions, searchingAddress
 */
export function AddressGeocodingSection({
  address,
  latitude,
  longitude,
  onAddressChange,
  onLocationSet,
  disabled,
}: AddressGeocodingSectionProps) {
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [searchingAddress, setSearchingAddress] = useState(false)
  const [geocoding, setGeocoding] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // 住所入力変更ハンドラ
  const handleAddressChange = useCallback(async (value: string) => {
    onAddressChange(value)

    if (value.length >= MIN_ADDRESS_SEARCH_LENGTH) {
      setSearchingAddress(true)
      const result = await searchAddressSuggestions(value)
      setSuggestions(result.suggestions)
      setShowSuggestions(result.suggestions.length > 0)
      setSearchingAddress(false)
    } else {
      setSuggestions([])
      setShowSuggestions(false)
    }
  }, [onAddressChange])

  // 候補選択ハンドラ
  const handleSelectSuggestion = (suggestion: AddressSuggestion, keepOriginalAddress = false) => {
    if (!keepOriginalAddress) {
      onAddressChange(suggestion.formattedAddress)
    }
    onLocationSet(suggestion.latitude, suggestion.longitude, keepOriginalAddress ? address : suggestion.formattedAddress)
    setSuggestions([])
    setShowSuggestions(false)
    setError(null)
  }

  // 位置取得ボタンのハンドラ
  const handleGeocode = async () => {
    if (!address.trim()) {
      setError(MSG_ADDRESS_REQUIRED)
      return
    }

    setGeocoding(true)
    setError(null)

    const result = await searchAddressSuggestions(address)

    if (result.suggestions.length === 0) {
      setError(MSG_ADDRESS_NOT_FOUND)
    } else if (result.suggestions.length === 1) {
      const suggestion = result.suggestions[0]
      if (suggestion) {
        onLocationSet(suggestion.latitude, suggestion.longitude, address)
        setSuggestions([])
        setShowSuggestions(false)
      }
    } else {
      setSuggestions(result.suggestions)
      setShowSuggestions(true)
    }

    setGeocoding(false)
  }

  return (
    <div className="space-y-2">
      <label htmlFor="address" className="text-sm font-medium">
        住所 <span className="text-destructive">*</span>
      </label>
      <div className="flex gap-2">
        <div className="relative flex-1">
          <input
            id="address"
            type="text"
            value={address}
            onChange={(e) => handleAddressChange(e.target.value)}
            onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
            onBlur={() => setTimeout(() => setShowSuggestions(false), TIMEOUT_DROPDOWN_BLUR)}
            required
            disabled={disabled}
            className="w-full px-3 py-2 rounded-lg border bg-background focus:outline-none focus:ring-2 focus:ring-primary"
            placeholder="例: 東京都○○区..."
            autoComplete="off"
          />
          {searchingAddress && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={handleGeocode}
          disabled={disabled || geocoding || !address.trim()}
          className="px-4 py-2 bg-secondary text-secondary-foreground rounded-lg hover:bg-secondary/80 disabled:opacity-50 whitespace-nowrap"
        >
          {geocoding ? '検索中...' : '位置取得'}
        </button>
      </div>

      {showSuggestions && suggestions.length > 0 && (
        <div className="border rounded-lg bg-card shadow-lg overflow-hidden">
          <p className="px-3 py-2 text-xs text-muted-foreground bg-muted border-b">
            近い場所を選択してください（入力した住所はそのまま保存されます）
          </p>
          <ul className="max-h-60 overflow-y-auto">
            {suggestions.map((suggestion, index) => (
              <li key={index} className="border-b last:border-b-0">
                <div className="px-3 py-2 hover:bg-muted transition-colors">
                  <p className="text-sm mb-1">{suggestion.formattedAddress}</p>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => handleSelectSuggestion(suggestion, true)}
                      className="text-xs px-2 py-1 bg-primary text-primary-foreground rounded hover:bg-primary/90"
                    >
                      この位置を使用
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSelectSuggestion(suggestion, false)}
                      className="text-xs px-2 py-1 border rounded hover:bg-muted"
                    >
                      住所も置換
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}

      {latitude !== null && longitude !== null && (
        <p className="text-xs text-foreground flex items-center gap-1">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
            <polyline points="22 4 12 14.01 9 11.01" />
          </svg>
          位置情報を取得しました（緯度: {latitude.toFixed(6)}, 経度: {longitude.toFixed(6)}）
        </p>
      )}
    </div>
  )
}
