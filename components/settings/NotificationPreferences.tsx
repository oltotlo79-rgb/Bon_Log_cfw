'use client'

import { useState, useTransition } from 'react'
import { updateNotificationPreferences, type NotificationPreferences as NotificationPrefsType } from '@/lib/actions/notification-preferences'
import { TIMEOUT_COPIED_FEEDBACK } from '@/lib/constants/limits'
import { MSG_ERROR_FALLBACK } from '@/lib/constants/messages'

// key を NotificationPrefsType のキーに narrow するため tuple として宣言する。
// 型ガードでアクセスすることで `as keyof` キャストを排除できる。
type NotificationPrefKey = keyof NotificationPrefsType

const NOTIFICATION_TYPES: ReadonlyArray<{
  key: NotificationPrefKey
  label: string
  description: string
}> = [
  { key: 'like', label: 'いいね', description: '投稿にいいねされた時' },
  { key: 'comment', label: 'コメント', description: '投稿にコメントされた時' },
  { key: 'reply', label: '返信', description: 'コメントに返信された時' },
  { key: 'comment_like', label: 'コメントいいね', description: 'コメントにいいねされた時' },
  { key: 'follow', label: 'フォロー', description: 'フォローされた時' },
  { key: 'quote', label: '引用投稿', description: '投稿が引用された時' },
  { key: 'follow_request', label: 'フォローリクエスト', description: 'フォローリクエストを受けた時' },
  { key: 'follow_request_approved', label: 'フォロー承認', description: 'フォローリクエストが承認された時' },
]

interface Props {
  initialPreferences: NotificationPrefsType
}

export function NotificationPreferences({ initialPreferences }: Props) {
  const [preferences, setPreferences] = useState<NotificationPrefsType>(initialPreferences)
  const [isPending, startTransition] = useTransition()
  const [message, setMessage] = useState<string | null>(null)

  const handleToggle = (key: NotificationPrefKey) => {
    const currentValue = preferences[key] !== false
    const newPrefs = { ...preferences, [key]: !currentValue }
    setPreferences(newPrefs)

    startTransition(async () => {
      const result = await updateNotificationPreferences(newPrefs)
      if (!result.success) {
        setMessage(result.error ?? MSG_ERROR_FALLBACK)
        // revert
        setPreferences(preferences)
      } else {
        setMessage('設定を保存しました')
      }
      setTimeout(() => setMessage(null), TIMEOUT_COPIED_FEEDBACK)
    })
  }

  return (
    <div className="space-y-1">
      {message && (
        <p className="text-sm text-muted-foreground mb-4">{message}</p>
      )}
      {NOTIFICATION_TYPES.map(({ key, label, description }) => {
        const enabled = preferences[key] !== false
        return (
          <div key={key} className="flex items-center justify-between p-3 hover:bg-muted/50 rounded-lg">
            <div>
              <p className="font-medium text-sm">{label}</p>
              <p className="text-xs text-muted-foreground">{description}</p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={enabled}
              disabled={isPending}
              onClick={() => handleToggle(key)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                enabled ? 'bg-primary' : 'bg-muted-foreground/30'
              } ${isPending ? 'opacity-50' : ''}`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  enabled ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
        )
      })}
    </div>
  )
}
