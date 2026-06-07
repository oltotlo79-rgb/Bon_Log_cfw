'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  updateMaintenanceSettings,
  type MaintenanceSettings,
} from '@/lib/actions/maintenance'
import { Button } from '@/components/ui/button'
import { TIMEOUT_TOAST } from '@/lib/constants/limits'

interface MaintenanceFormProps {
  /** 現在のメンテナンス設定 */
  settings: MaintenanceSettings
}

/**
 * ISO形式の日時文字列をdatetime-local用の形式に変換
 * ブラウザのdatetime-local入力フィールドで表示するため、
 * ISO形式（UTC）からローカルタイムゾーンの形式に変換する
 *
 * @param isoString - ISO形式の日時文字列（例: "2024-01-01T12:00:00.000Z"）
 * @returns datetime-local形式の文字列（例: "2024-01-01T21:00"）、空文字の場合は空文字を返す
 */
function toLocalDateTimeString(isoString: string | null): string {
  if (!isoString) return ''
  const date = new Date(isoString)
  // タイムゾーンオフセットを考慮してローカル時刻に変換
  // getTimezoneOffset()は分単位で返されるため、ミリ秒に変換
  const offset = date.getTimezoneOffset()
  const localDate = new Date(date.getTime() - offset * 60 * 1000)
  // ISO文字列の最初の16文字（yyyy-MM-ddTHH:mm）を取得
  return localDate.toISOString().slice(0, 16)
}

/**
 * datetime-local形式をISO形式に変換
 * フォーム入力からサーバーに送信するため、
 * ローカル形式からISO形式（UTC）に変換する
 *
 * @param localDateTime - datetime-local形式の文字列（例: "2024-01-01T21:00"）
 * @returns ISO形式の日時文字列、空文字の場合はnullを返す
 */
function toISOString(localDateTime: string): string | null {
  if (!localDateTime) return null
  return new Date(localDateTime).toISOString()
}

export function MaintenanceForm({ settings }: MaintenanceFormProps) {
  const router = useRouter()
  // useTransition: 非同期処理中の状態を管理（isPendingがtrueの間、ボタンを無効化できる）
  const [isPending, startTransition] = useTransition()
  // エラーメッセージ
  const [error, setError] = useState<string | null>(null)
  // 成功メッセージの表示フラグ
  const [success, setSuccess] = useState(false)

  // フォーム入力状態（propsからの初期値）
  const [enabled, setEnabled] = useState(settings.enabled)
  const [startTime, setStartTime] = useState(
    toLocalDateTimeString(settings.startTime)
  )
  const [endTime, setEndTime] = useState(
    toLocalDateTimeString(settings.endTime)
  )
  const [message, setMessage] = useState(settings.message)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccess(false)

    // startTransition: 画面のちらつきを防ぎながら非同期処理を実行
    startTransition(async () => {
      const result = await updateMaintenanceSettings({
        enabled,
        startTime: toISOString(startTime),
        endTime: toISOString(endTime),
        message,
      })

      if (result.success) {
        setSuccess(true)
        // ページを再読み込みして最新の設定を反映
        router.refresh()
        // 3秒後に成功メッセージを自動で非表示
        setTimeout(() => setSuccess(false), TIMEOUT_TOAST)
      } else {
        setError(result.error || '更新に失敗しました')
      }
    })
  }

  /**
   * クイックアクション: メンテナンスモードを即座に開始
   * 期間指定をクリアし、有効フラグをtrueに設定
   */
  const handleQuickEnable = () => {
    setEnabled(true)
    setStartTime('')
    setEndTime('')
  }

  /**
   * クイックアクション: メンテナンスモードを即座に終了
   * 有効フラグをfalseに設定
   */
  const handleQuickDisable = () => {
    setEnabled(false)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="flex gap-4">
        <Button
          type="button"
          variant={enabled ? 'default' : 'outline'}
          onClick={handleQuickEnable}
          className={enabled ? 'bg-destructive hover:bg-destructive/90 text-destructive-foreground' : ''}
        >
          メンテナンス開始
        </Button>
        <Button
          type="button"
          variant={!enabled ? 'default' : 'outline'}
          onClick={handleQuickDisable}
          className={!enabled ? 'bg-foreground hover:bg-foreground/90 text-background' : ''}
        >
          通常運用に戻す
        </Button>
      </div>

      <div className="border-t pt-6">
        <h3 className="font-medium mb-4">メンテナンス期間（任意）</h3>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="block text-sm font-medium mb-1">
              開始日時
            </label>
            <input
              type="datetime-local"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
            />
            <p className="text-xs text-muted-foreground mt-1">
              空の場合は即座に開始
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">
              終了予定日時
            </label>
            <input
              type="datetime-local"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
            />
            <p className="text-xs text-muted-foreground mt-1">
              設定すると自動で終了
            </p>
          </div>
        </div>
      </div>

      <div className="border-t pt-6">
        <h3 className="font-medium mb-4">表示メッセージ</h3>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={4}
          className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary resize-none"
          placeholder="メンテナンス中に表示するメッセージを入力..."
        />
      </div>

      {error && (
        <div className="bg-muted/50 border border-border text-destructive px-4 py-3 rounded-lg">
          {error}
        </div>
      )}
      {success && (
        <div className="bg-muted/50 border border-border text-muted-foreground px-4 py-3 rounded-lg">
          設定を保存しました
        </div>
      )}

      <div className="border-t pt-6">
        <Button
          type="submit"
          disabled={isPending}
          className="w-full md:w-auto"
        >
          {isPending ? '保存中...' : '設定を保存'}
        </Button>
      </div>
    </form>
  )
}
