'use client'

import { useState, useEffect, useCallback } from 'react'
import { Bell, BellOff, Loader2 } from 'lucide-react'
import { subscribePush, unsubscribePush, getPushSubscriptionStatus } from '@/lib/actions/push-subscription'
import { useToast } from '@/hooks/use-toast'
import {
  MSG_GENERIC_ERROR,
  MSG_PUSH_DISABLED,
  MSG_PUSH_ENABLED,
  MSG_PUSH_PERMISSION_REQUIRED_DESCRIPTION,
  MSG_PUSH_PERMISSION_REQUIRED_TITLE,
  MSG_PUSH_REGISTER_FAILED,
  MSG_PUSH_SETTING_FAILED,
} from '@/lib/constants/messages'
import { clientLogger } from '@/lib/client-logger'

/**
 * Base64url文字列を Push API の applicationServerKey に渡せる ArrayBuffer に変換する。
 *
 * Why ArrayBuffer (not Uint8Array): 一部 TS lib バージョンで Uint8Array が
 * BufferSource に直接代入できず call site に `as` cast が必要だった。
 * 戻り値型を ArrayBuffer に寄せることで境界の cast を helper 内に閉じ込める。
 */
function urlBase64ToBuffer(base64String: string): ArrayBuffer {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = atob(base64)
  const buffer = new ArrayBuffer(rawData.length)
  const view = new Uint8Array(buffer)
  for (let i = 0; i < rawData.length; i++) {
    view[i] = rawData.charCodeAt(i)
  }
  return buffer
}

/**
 * プッシュ通知のON/OFFトグルコンポーネント
 *
 * Service WorkerのPush APIを使用してブラウザプッシュ通知を制御する。
 * 設定ページに配置して使用する。
 */
export function PushNotificationToggle() {
  const [isSubscribed, setIsSubscribed] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isSupported, setIsSupported] = useState(false)
  const { toast } = useToast()

  // Push APIの対応状況チェック + 現在の購読状態を取得
  useEffect(() => {
    async function checkStatus() {
      // ブラウザ対応チェック
      if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
        setIsSupported(false)
        setIsLoading(false)
        return
      }
      setIsSupported(true)

      try {
        // SW登録を取得
        const registration = await navigator.serviceWorker.ready
        const subscription = await registration.pushManager.getSubscription()

        if (subscription) {
          // ブラウザ側で購読済み → サーバー側の状態も確認
          const status = await getPushSubscriptionStatus()
          setIsSubscribed(status.subscribed)
        } else {
          setIsSubscribed(false)
        }
      } catch {
        setIsSubscribed(false)
      }
      setIsLoading(false)
    }

    checkStatus()
  }, [])

  const handleToggle = useCallback(async () => {
    setIsLoading(true)

    try {
      const registration = await navigator.serviceWorker.ready

      if (isSubscribed) {
        // 購読解除
        const subscription = await registration.pushManager.getSubscription()
        if (subscription) {
          await subscription.unsubscribe()
          await unsubscribePush(subscription.endpoint)
        }
        setIsSubscribed(false)
        toast({ title: MSG_PUSH_DISABLED })
      } else {
        // 購読登録
        // VAPID公開鍵を取得
        const res = await fetch('/api/push/vapid-key')
        if (!res.ok) {
          toast({ variant: 'destructive', title: MSG_PUSH_SETTING_FAILED })
          setIsLoading(false)
          return
        }
        const { publicKey } = await res.json()

        // 通知許可を要求
        const permission = await Notification.requestPermission()
        if (permission !== 'granted') {
          toast({
            variant: 'destructive',
            title: MSG_PUSH_PERMISSION_REQUIRED_TITLE,
            description: MSG_PUSH_PERMISSION_REQUIRED_DESCRIPTION,
          })
          setIsLoading(false)
          return
        }

        // Push API購読
        const subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToBuffer(publicKey),
        })

        const p256dh = subscription.getKey('p256dh')
        const auth = subscription.getKey('auth')

        if (!p256dh || !auth) {
          toast({ variant: 'destructive', title: MSG_PUSH_REGISTER_FAILED })
          setIsLoading(false)
          return
        }

        // サーバーに購読情報を送信
        const result = await subscribePush({
          endpoint: subscription.endpoint,
          keys: {
            p256dh: btoa(String.fromCharCode(...new Uint8Array(p256dh))),
            auth: btoa(String.fromCharCode(...new Uint8Array(auth))),
          },
        })

        if (!result.success) {
          toast({ variant: 'destructive', title: result.error || MSG_PUSH_REGISTER_FAILED })
          setIsLoading(false)
          return
        }

        setIsSubscribed(true)
        toast({ title: MSG_PUSH_ENABLED })
      }
    } catch (error) {
      clientLogger.error('Push toggle error:', error)
      toast({ variant: 'destructive', title: MSG_GENERIC_ERROR })
    }

    setIsLoading(false)
  }, [isSubscribed, toast])

  if (!isSupported) {
    return (
      <div className="flex items-center justify-between py-3">
        <div>
          <p className="text-sm font-medium">プッシュ通知</p>
          <p className="text-xs text-muted-foreground">このブラウザではプッシュ通知に対応していません</p>
        </div>
        <BellOff className="w-5 h-5 text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="flex items-center justify-between py-3">
      <div>
        <p className="text-sm font-medium">プッシュ通知</p>
        <p className="text-xs text-muted-foreground">
          {isSubscribed ? 'いいねやコメントがあると通知されます' : 'ONにすると端末に通知が届きます'}
        </p>
      </div>
      <button
        onClick={handleToggle}
        disabled={isLoading}
        className={`relative inline-flex h-8 w-14 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${
          isSubscribed ? 'bg-primary' : 'bg-muted'
        }`}
        role="switch"
        aria-checked={isSubscribed}
        aria-label="プッシュ通知の切り替え"
      >
        <span
          className={`inline-flex h-6 w-6 items-center justify-center rounded-full bg-background shadow-sm transition-transform ${
            isSubscribed ? 'translate-x-7' : 'translate-x-1'
          }`}
        >
          {isLoading ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />
          ) : isSubscribed ? (
            <Bell className="w-3.5 h-3.5 text-primary" />
          ) : (
            <BellOff className="w-3.5 h-3.5 text-muted-foreground" />
          )}
        </span>
      </button>
    </div>
  )
}
