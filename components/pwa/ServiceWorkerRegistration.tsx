'use client'

/**
 * @module components/pwa/ServiceWorkerRegistration
 *
 * Service Worker の登録 + ライフサイクル管理。新版検出時のアップデートプロンプト
 * とオフラインバナーも担う。配置先は app/providers.tsx 内 (Client boundary 下)。
 */

import { clientLogger } from '@/lib/client-logger'
import { useEffect, useState, useRef, useCallback } from 'react'
import { SW_UPDATE_INTERVAL_MS } from '@/lib/constants/limits'

export function ServiceWorkerRegistration() {
  // オンライン状態の初期値はブラウザの状態を反映
  const [isOnline, setIsOnline] = useState(() => {
    if (typeof window === 'undefined') return true
    return navigator.onLine
  })
  const [showUpdatePrompt, setShowUpdatePrompt] = useState(false)
  const [waitingWorker, setWaitingWorker] = useState<ServiceWorker | null>(null)
  const isInitialized = useRef(false)
  const swIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Service Workerの登録処理
  const registerSW = useCallback(async () => {
    try {
      const registration = await navigator.serviceWorker.register('/sw.js', {
        scope: '/',
      })

      clientLogger.log('[SW] Service Worker registered:', registration.scope)

      // 更新の確認
      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing

        if (newWorker) {
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              // 新しいバージョンが利用可能
              clientLogger.log('[SW] New version available')
              setWaitingWorker(newWorker)
              setShowUpdatePrompt(true)
            }
          })
        }
      })

      // 既にインストール済みのService Workerがある場合
      if (registration.waiting) {
        setWaitingWorker(registration.waiting)
        setShowUpdatePrompt(true)
      }

      // 定期的に更新を確認（1時間ごと）
      // registration.update() は Promise を返す。catch しないと一時的な fetch 失敗
      // (デプロイ直後の hash 不一致 / 一時的な CDN 5xx / ネットワーク中断) が
      // unhandled rejection として Sentry に大量に飛んでくる。次回 interval で
      // 再試行されるため、ログだけ残してエラーは握りつぶす。
      swIntervalRef.current = setInterval(() => {
        registration.update().catch((err) => {
          clientLogger.warn('[SW] update() failed (non-fatal, will retry):', err)
        })
      }, SW_UPDATE_INTERVAL_MS)
    } catch (error) {
      clientLogger.error('[SW] Service Worker registration failed:', error)
    }
  }, [])

  // Service Workerの登録処理はイベントコールバック内でsetStateを呼ぶ正当なユースケース
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    // 二重初期化を防止
    if (isInitialized.current) return
    isInitialized.current = true

    // ブラウザがService Workerをサポートしているか確認
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
      return
    }

    // 開発環境ではService Workerを無効化（HMRとの競合を避ける）
    if (process.env.NODE_ENV === 'development') {
      clientLogger.log('[SW] Service Worker disabled in development mode')
      return
    }

    // オンライン/オフラインイベントの監視
    const handleOnline = () => {
      setIsOnline(true)
      clientLogger.log('[SW] Back online')
    }

    const handleOffline = () => {
      setIsOnline(false)
      clientLogger.log('[SW] Gone offline')
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    // ページロード完了後にService Workerを登録
    if (document.readyState === 'complete') {
      registerSW()
    } else {
      window.addEventListener('load', registerSW)
    }

    // コントローラーの変更を監視（新しいService Workerがアクティブになった時）
    let refreshing = false
    const handleControllerChange = () => {
      if (!refreshing) {
        refreshing = true
        clientLogger.log('[SW] Controller changed, reloading page')
        window.location.reload()
      }
    }
    navigator.serviceWorker.addEventListener('controllerchange', handleControllerChange)

    // クリーンアップ
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
      window.removeEventListener('load', registerSW)
      navigator.serviceWorker.removeEventListener('controllerchange', handleControllerChange)
      if (swIntervalRef.current !== null) {
        clearInterval(swIntervalRef.current)
      }
    }
  }, [registerSW])
  /* eslint-enable react-hooks/set-state-in-effect */

  /**
   * 更新を適用する
   * 待機中のService Workerをアクティブ化し、ページをリロード
   */
  const applyUpdate = () => {
    if (waitingWorker) {
      waitingWorker.postMessage({ type: 'SKIP_WAITING' })
      setShowUpdatePrompt(false)
    }
  }

  /**
   * 更新を後で行う
   */
  const dismissUpdate = () => {
    setShowUpdatePrompt(false)
  }

  // 更新プロンプトを表示
  if (showUpdatePrompt) {
    return (
      <div
        className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-4 sm:w-80 z-50
                   bg-card border rounded-lg shadow-lg p-4 animate-in slide-in-from-bottom-2"
        role="alert"
        aria-live="polite"
      >
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="w-5 h-5 text-primary"
            >
              <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8" />
              <path d="M21 3v5h-5" />
            </svg>
          </div>

          <div className="flex-1 min-w-0">
            <p className="font-medium text-sm">アップデートがあります</p>
            <p className="text-xs text-muted-foreground mt-1">
              新しいバージョンが利用可能です。更新して最新機能をお使いください。
            </p>

            <div className="flex gap-2 mt-3">
              <button
                onClick={applyUpdate}
                className="px-3 py-1.5 text-xs font-medium bg-primary text-primary-foreground
                         rounded-md hover:bg-primary/90 transition-colors"
              >
                今すぐ更新
              </button>
              <button
                onClick={dismissUpdate}
                className="px-3 py-1.5 text-xs font-medium text-muted-foreground
                         hover:text-foreground transition-colors"
              >
                後で
              </button>
            </div>
          </div>

          <button
            onClick={dismissUpdate}
            className="flex-shrink-0 text-muted-foreground hover:text-foreground"
            aria-label="閉じる"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="w-4 h-4"
            >
              <path d="M18 6 6 18" />
              <path d="m6 6 12 12" />
            </svg>
          </button>
        </div>
      </div>
    )
  }

  // オフラインバナーを表示
  if (!isOnline) {
    return (
      <div
        className="fixed top-0 left-0 right-0 z-50 bg-foreground text-background
                   px-4 py-2 text-center text-sm font-medium"
        role="alert"
        aria-live="assertive"
      >
        <span className="inline-flex items-center gap-2">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="w-4 h-4"
          >
            <line x1="2" x2="22" y1="2" y2="22" />
            <path d="M8.5 16.5a5 5 0 0 1 7 0" />
            <path d="M2 8.82a15 15 0 0 1 4.17-2.65" />
            <path d="M10.66 5c4.01-.36 8.14.9 11.34 3.76" />
            <path d="M16.85 11.25a10 10 0 0 1 2.22 1.68" />
            <path d="M5 13a10 10 0 0 1 5.24-2.76" />
            <line x1="12" x2="12.01" y1="20" y2="20" />
          </svg>
          オフラインです - 一部の機能が制限されます
        </span>
      </div>
    )
  }

  // 通常時は何も表示しない
  return null
}
