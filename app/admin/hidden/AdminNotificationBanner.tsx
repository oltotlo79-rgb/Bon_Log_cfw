/**
 * @file 管理者通知バナーコンポーネント
 * @description 未読の管理者通知を表示し、一括既読機能を提供する
 *              クライアントコンポーネント。
 */

'use client'

// ReactのuseStateフック（状態管理用）
import { useState } from 'react'
// UIコンポーネント（ボタン）
import { Button } from '@/components/ui/button'
// 全通知既読用のServer Action
import { markAllAdminNotificationsAsRead } from '@/lib/actions/admin/hidden'
import { ADMIN_NOTIFICATION_COLLAPSE_THRESHOLD } from '@/lib/constants/limits'

/**
 * 管理者通知の型定義
 */
interface AdminNotification {
  id: string
  type: string
  targetType: string
  targetId: string
  message: string
  reportCount: number
  isRead: boolean
  createdAt: Date
}

/**
 * 管理者通知バナーコンポーネント
 * 未読通知の表示と一括既読機能を提供するバナー
 *
 * @param notifications - 通知のリスト
 * @param unreadCount - 未読通知の数
 * @returns 通知バナーのJSX要素
 *
 * 機能:
 * - 未読通知数の表示
 * - 通知リストの展開/折りたたみ
 * - 全通知の一括既読
 */
export function AdminNotificationBanner({
  notifications,
  unreadCount,
}: {
  notifications: AdminNotification[]
  unreadCount: number
}) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)

  async function handleMarkAllAsRead() {
    setIsProcessing(true)
    try {
      await markAllAdminNotificationsAsRead()
    } finally {
      setIsProcessing(false)
    }
  }

  return (
    <div className="bg-muted/50 border border-border rounded-lg p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 bg-foreground rounded-full animate-pulse" />
          <span className="font-medium text-muted-foreground">
            {unreadCount}件の新しい通知があります
          </span>
        </div>
        <div className="flex gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsExpanded(!isExpanded)}
          >
            {isExpanded ? '閉じる' : '表示'}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleMarkAllAsRead}
            disabled={isProcessing}
          >
            {isProcessing ? '処理中...' : 'すべて既読'}
          </Button>
        </div>
      </div>

      {isExpanded && (
        <div className="mt-4 space-y-2">
          {notifications.slice(0, ADMIN_NOTIFICATION_COLLAPSE_THRESHOLD).map((notification: AdminNotification) => (
            <div
              key={notification.id}
              className="bg-background p-3 rounded border border-border"
            >
              <p className="text-sm">{notification.message}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {new Date(notification.createdAt).toLocaleString('ja-JP')}
              </p>
            </div>
          ))}
          {notifications.length > ADMIN_NOTIFICATION_COLLAPSE_THRESHOLD && (
            <p className="text-sm text-muted-foreground text-center">
              他 {notifications.length - ADMIN_NOTIFICATION_COLLAPSE_THRESHOLD}件の通知
            </p>
          )}
        </div>
      )}
    </div>
  )
}
