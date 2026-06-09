'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Mail as MailIcon,
  Monitor as MonitorIcon,
  Plus as PlusIcon,
  Search as SearchIcon,
  Trash2 as TrashIcon,
} from 'lucide-react'
import {
  addEmailToBlacklist,
  removeEmailFromBlacklist,
  addDeviceToBlacklist,
  removeDeviceFromBlacklist,
} from '@/lib/actions/blacklist'
import { FINGERPRINT_DISPLAY_LENGTH } from '@/lib/constants/limits'
import { useToast } from '@/hooks/use-toast'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import {
  MSG_ADMIN_BLACKLIST_DEVICE_REMOVE_DESC,
  MSG_ADMIN_BLACKLIST_DEVICE_REMOVE_TITLE,
  MSG_ADMIN_BLACKLIST_EMAIL_REMOVE_DESC,
  MSG_ADMIN_BLACKLIST_EMAIL_REMOVE_TITLE,
  MSG_ERROR_FALLBACK,
} from '@/lib/constants/messages'

interface EmailBlacklistItem {
  /** ブラックリストレコードID */
  id: string
  /** ブロック対象のメールアドレス */
  email: string
  /** ブロック理由（任意） */
  reason: string | null
  /** 登録者の管理者ID */
  createdBy: string
  /** 登録日時 */
  createdAt: Date
}

interface DeviceBlacklistItem {
  /** ブラックリストレコードID */
  id: string
  /** デバイスのフィンガープリント（一意識別子） */
  fingerprint: string
  /** ブロック理由（任意） */
  reason: string | null
  /** 関連する元ユーザーのメールアドレス（任意） */
  originalEmail: string | null
  /** 登録者の管理者ID */
  createdBy: string
  /** 登録日時 */
  createdAt: Date
}

interface BlacklistTabsProps {
  /** 現在選択されているタブ */
  tab: 'email' | 'device'
  /** 検索キーワード */
  search: string
  /** 現在のカーソル（undefined は先頭ページ） */
  cursor?: string
  /** 1ページあたりの表示件数 */
  limit: number
  /** メールブラックリストのアイテム配列 */
  emailItems: EmailBlacklistItem[]
  /** メールブラックリストの総件数 */
  emailTotal: number
  /** メールブラックリストの次ページ用カーソル */
  emailNextCursor?: string
  /** デバイスブラックリストのアイテム配列 */
  deviceItems: DeviceBlacklistItem[]
  /** デバイスブラックリストの総件数 */
  deviceTotal: number
  /** デバイスブラックリストの次ページ用カーソル */
  deviceNextCursor?: string
}

/**
 * スパムアカウントの再登録対策。メールと device fingerprint の両方をブロックすることで、
 * 別メールでの再登録・同一端末からの複数アカウント作成を抑止する。
 */
export function BlacklistTabs({
  tab,
  search,
  cursor,
  limit: _limit,
  emailItems,
  emailTotal,
  emailNextCursor,
  deviceItems,
  deviceTotal,
  deviceNextCursor,
}: BlacklistTabsProps) {
  const router = useRouter()
  const { toast } = useToast()
  // モーダルの表示状態
  const [showAddModal, setShowAddModal] = useState(false)
  // 処理中フラグ（ボタンの二重クリック防止）
  const [loading, setLoading] = useState(false)
  // エラーメッセージ
  const [error, setError] = useState<string | null>(null)
  // 削除確認ダイアログ用（メール: id+email、デバイス: idのみ）
  const [emailRemoveTarget, setEmailRemoveTarget] = useState<{ id: string; email: string } | null>(null)
  const [deviceRemoveTargetId, setDeviceRemoveTargetId] = useState<string | null>(null)

  // 追加フォームの入力値の状態管理
  const [newEmail, setNewEmail] = useState('')
  const [newFingerprint, setNewFingerprint] = useState('')
  const [newReason, setNewReason] = useState('')
  const [newOriginalEmail, setNewOriginalEmail] = useState('')

  // 現在のタブに応じた件数・次カーソル
  const currentTotal = tab === 'email' ? emailTotal : deviceTotal
  const currentNextCursor = tab === 'email' ? emailNextCursor : deviceNextCursor
  const isFirstPage = !cursor

  const handleTabChange = (newTab: 'email' | 'device') => {
    router.push(`/admin/blacklist?tab=${newTab}`)
  }

  /**
   * メールアドレスをブラックリストに追加する関数
   * Server Actionを呼び出してデータベースに登録
   */
  const handleAddEmail = async () => {
    // 空のメールアドレスは拒否
    if (!newEmail.trim()) return

    setLoading(true)
    setError(null)

    // Server Actionを呼び出してブラックリストに追加
    const result = await addEmailToBlacklist(newEmail, newReason || undefined)

    // エラー時は処理を中断してエラーメッセージを表示
    if ('error' in result) {
      setError(('error' in result ? result.error : null) ?? MSG_ERROR_FALLBACK)
      setLoading(false)
      return
    }

    // 成功時はフォームをリセットしてモーダルを閉じる
    setNewEmail('')
    setNewReason('')
    setShowAddModal(false)
    setLoading(false)
    // ページを再読み込みして最新のデータを表示
    router.refresh()
  }

  /**
   * デバイスをブラックリストに追加する関数
   * Server Actionを呼び出してデータベースに登録
   */
  const handleAddDevice = async () => {
    // 空のフィンガープリントは拒否
    if (!newFingerprint.trim()) return

    setLoading(true)
    setError(null)

    // Server Actionを呼び出してブラックリストに追加
    // 関連メールアドレスは任意（悪質ユーザーの特定に役立つ）
    const result = await addDeviceToBlacklist(
      newFingerprint,
      newReason || undefined,
      newOriginalEmail || undefined
    )

    // エラー時は処理を中断してエラーメッセージを表示
    if ('error' in result) {
      setError(('error' in result ? result.error : null) ?? MSG_ERROR_FALLBACK)
      setLoading(false)
      return
    }

    // 成功時はフォームをリセットしてモーダルを閉じる
    setNewFingerprint('')
    setNewReason('')
    setNewOriginalEmail('')
    setShowAddModal(false)
    setLoading(false)
    // ページを再読み込みして最新のデータを表示
    router.refresh()
  }

  const handleRemoveEmailConfirm = async () => {
    if (!emailRemoveTarget) return
    const result = await removeEmailFromBlacklist(emailRemoveTarget.id)
    if ('error' in result) {
      toast({ title: result.error, variant: 'destructive' })
      throw new Error(result.error)
    }
    router.refresh()
  }

  const handleRemoveDeviceConfirm = async () => {
    if (!deviceRemoveTargetId) return
    const result = await removeDeviceFromBlacklist(deviceRemoveTargetId)
    if ('error' in result) {
      toast({ title: result.error, variant: 'destructive' })
      throw new Error(result.error)
    }
    router.refresh()
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2 border-b">
        <button
          onClick={() => handleTabChange('email')}
          className={`flex items-center gap-2 px-4 py-2 border-b-2 transition-colors ${
            tab === 'email'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <MailIcon className="w-4 h-4" />
          メールアドレス
          <span className="text-xs bg-muted px-2 py-0.5 rounded-full">{emailTotal}</span>
        </button>
        <button
          onClick={() => handleTabChange('device')}
          className={`flex items-center gap-2 px-4 py-2 border-b-2 transition-colors ${
            tab === 'device'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <MonitorIcon className="w-4 h-4" />
          デバイス
          <span className="text-xs bg-muted px-2 py-0.5 rounded-full">{deviceTotal}</span>
        </button>
      </div>

      <div className="bg-card rounded-lg border p-4">
        <div className="flex flex-wrap gap-4">
          <form className="flex-1 min-w-[200px]">
            <input type="hidden" name="tab" value={tab} />
            <div className="relative">
              <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                name="search"
                placeholder={tab === 'email' ? 'メールアドレスで検索' : 'フィンガープリント・メールで検索'}
                defaultValue={search}
                className="w-full pl-10 pr-4 py-2 border rounded-lg bg-background"
              />
            </div>
          </form>

          <Button onClick={() => setShowAddModal(true)}>
            <PlusIcon className="w-4 h-4 mr-2" />
            追加
          </Button>
        </div>
      </div>

      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-card rounded-lg p-6 w-full max-w-md mx-4">
            <h2 className="text-lg font-bold mb-4">
              {tab === 'email' ? 'メールアドレスを追加' : 'デバイスを追加'}
            </h2>

            {error && (
              <div className="mb-4 p-3 bg-destructive/10 text-destructive rounded-lg text-sm">
                {error}
              </div>
            )}

            <div className="space-y-4">
              {tab === 'email' ? (
                <div>
                  <label className="block text-sm font-medium mb-1">
                    メールアドレス <span className="text-destructive">*</span>
                  </label>
                  <Input
                    type="email"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    placeholder="example@example.com"
                  />
                </div>
              ) : (
                <>
                  <div>
                    <label className="block text-sm font-medium mb-1">
                      デバイスフィンガープリント <span className="text-destructive">*</span>
                    </label>
                    <Input
                      type="text"
                      value={newFingerprint}
                      onChange={(e) => setNewFingerprint(e.target.value)}
                      placeholder="フィンガープリント"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      ユーザー詳細画面からコピーできます
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">
                      関連メールアドレス（任意）
                    </label>
                    <Input
                      type="email"
                      value={newOriginalEmail}
                      onChange={(e) => setNewOriginalEmail(e.target.value)}
                      placeholder="元ユーザーのメールアドレス"
                    />
                  </div>
                </>
              )}

              <div>
                <label className="block text-sm font-medium mb-1">理由（任意）</label>
                <Input
                  type="text"
                  value={newReason}
                  onChange={(e) => setNewReason(e.target.value)}
                  placeholder="ブロックの理由"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-6">
              <Button
                variant="outline"
                onClick={() => {
                  setShowAddModal(false)
                  setError(null)
                }}
              >
                キャンセル
              </Button>
              <Button
                onClick={tab === 'email' ? handleAddEmail : handleAddDevice}
                disabled={loading || (tab === 'email' ? !newEmail.trim() : !newFingerprint.trim())}
              >
                {loading ? '追加中...' : '追加'}
              </Button>
            </div>
          </div>
        </div>
      )}

      <div className="bg-card rounded-lg border">
        <table className="w-full">
          <thead className="bg-muted/50">
            <tr>
              {tab === 'email' ? (
                <>
                  <th className="text-left px-4 py-3 text-sm font-medium">メールアドレス</th>
                  <th className="text-left px-4 py-3 text-sm font-medium">理由</th>
                  <th className="text-left px-4 py-3 text-sm font-medium">登録日</th>
                  <th className="text-left px-4 py-3 text-sm font-medium">操作</th>
                </>
              ) : (
                <>
                  <th className="text-left px-4 py-3 text-sm font-medium">フィンガープリント</th>
                  <th className="text-left px-4 py-3 text-sm font-medium">関連メール</th>
                  <th className="text-left px-4 py-3 text-sm font-medium">理由</th>
                  <th className="text-left px-4 py-3 text-sm font-medium">登録日</th>
                  <th className="text-left px-4 py-3 text-sm font-medium">操作</th>
                </>
              )}
            </tr>
          </thead>
          <tbody className="divide-y">
            {tab === 'email' ? (
              emailItems.length > 0 ? (
                emailItems.map((item) => (
                  <tr key={item.id} className="hover:bg-muted/30">
                    <td className="px-4 py-3 font-mono text-sm">{item.email}</td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">
                      {item.reason || '-'}
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">
                      {new Date(item.createdAt).toLocaleDateString('ja-JP')}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => setEmailRemoveTarget({ id: item.id, email: item.email })}
                        className="p-2 text-destructive hover:bg-destructive/10 rounded-lg transition-colors"
                        title="削除"
                      >
                        <TrashIcon className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">
                    メールアドレスのブラックリストは空です
                  </td>
                </tr>
              )
            ) : deviceItems.length > 0 ? (
              deviceItems.map((item) => (
                <tr key={item.id} className="hover:bg-muted/30">
                  <td className="px-4 py-3 font-mono text-xs">
                    <span title={item.fingerprint}>
                      {item.fingerprint.slice(0, FINGERPRINT_DISPLAY_LENGTH)}...
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">
                    {item.originalEmail || '-'}
                  </td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">
                    {item.reason || '-'}
                  </td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">
                    {new Date(item.createdAt).toLocaleDateString('ja-JP')}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => setDeviceRemoveTargetId(item.id)}
                      className="p-2 text-destructive hover:bg-destructive/10 rounded-lg transition-colors"
                      title="削除"
                    >
                      <TrashIcon className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                  デバイスのブラックリストは空です
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {(currentNextCursor || !isFirstPage) && (
        <div className="flex items-center justify-center gap-2">
          {!isFirstPage && (
            <button
              type="button"
              onClick={() => router.back()}
              className="px-3 py-1 border rounded hover:bg-muted"
              aria-label="前のページに戻る"
            >
              前へ
            </button>
          )}

          <span className="px-3 py-1 text-sm text-muted-foreground" aria-live="polite">
            全 {currentTotal} 件
          </span>

          {currentNextCursor && (
            <Link
              href={`/admin/blacklist?tab=${tab}&search=${encodeURIComponent(search)}&cursor=${encodeURIComponent(currentNextCursor)}`}
              className="px-3 py-1 border rounded hover:bg-muted"
              aria-label="次のページへ進む"
            >
              次へ
            </Link>
          )}
        </div>
      )}

      <ConfirmDialog
        open={emailRemoveTarget !== null}
        onOpenChange={(v) => { if (!v) setEmailRemoveTarget(null) }}
        variant="warning"
        title={MSG_ADMIN_BLACKLIST_EMAIL_REMOVE_TITLE}
        description={emailRemoveTarget ? MSG_ADMIN_BLACKLIST_EMAIL_REMOVE_DESC(emailRemoveTarget.email) : ''}
        confirmLabel="削除する"
        onConfirm={handleRemoveEmailConfirm}
      />

      <ConfirmDialog
        open={deviceRemoveTargetId !== null}
        onOpenChange={(v) => { if (!v) setDeviceRemoveTargetId(null) }}
        variant="warning"
        title={MSG_ADMIN_BLACKLIST_DEVICE_REMOVE_TITLE}
        description={MSG_ADMIN_BLACKLIST_DEVICE_REMOVE_DESC}
        confirmLabel="削除する"
        onConfirm={handleRemoveDeviceConfirm}
      />
    </div>
  )
}
