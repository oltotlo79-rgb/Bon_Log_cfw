/**
 * @module components/event/EventFilterPersistence
 * イベントフィルター設定を localStorage に保存/復元する UI なしユーティリティ。
 */

'use client'

import { useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { STORAGE_KEY_EVENT_FILTER } from '@/lib/constants/storage-keys'

interface FilterSettings {
  region?: string
  prefecture?: string
  view?: string
  showPast?: string
}

export function EventFilterPersistence() {
  const router = useRouter()
  const searchParams = useSearchParams()

  useEffect(() => {
    const currentSettings: FilterSettings = {}

    const region = searchParams.get('region')
    const prefecture = searchParams.get('prefecture')
    const view = searchParams.get('view')
    const showPast = searchParams.get('showPast')

    if (region) currentSettings.region = region
    if (prefecture) currentSettings.prefecture = prefecture
    if (view) currentSettings.view = view
    if (showPast) currentSettings.showPast = showPast

    // パラメータが1つもない場合は保存しない（クリア操作との区別）
    if (Object.keys(currentSettings).length > 0) {
      localStorage.setItem(STORAGE_KEY_EVENT_FILTER, JSON.stringify(currentSettings))
    }
  }, [searchParams])

  useEffect(() => {
    const hasParams = searchParams.toString().length > 0

    if (!hasParams) {
      try {
        const saved = localStorage.getItem(STORAGE_KEY_EVENT_FILTER)
        if (saved) {
          const settings: FilterSettings = JSON.parse(saved)
          const params = new URLSearchParams()

          if (settings.region) params.set('region', settings.region)
          if (settings.prefecture) params.set('prefecture', settings.prefecture)
          if (settings.view) params.set('view', settings.view)
          if (settings.showPast) params.set('showPast', settings.showPast)

          if (params.toString()) {
            router.replace(`/events?${params.toString()}`)
          }
        }
      } catch {
        // localStorage のエラー（プライベートモード等）はサイレントに無視する
      }
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
  // router/searchParams を依存配列に含めると無限ループになるため意図的に除外

  return null
}
