/**
 * 2段階認証設定コンポーネント
 *
 * @module components/settings/TwoFactorSettings
 */

'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { get2FAStatus } from '@/lib/actions/two-factor'
import { TIMEOUT_SUCCESS_MESSAGE } from '@/lib/constants/limits'
import { SetupSection } from './two-factor/SetupSection'
import { DisableForm } from './two-factor/DisableForm'
import { RegenerateBackupCodes } from './two-factor/RegenerateBackupCodes'
import { CopyIcon, CheckIcon } from './two-factor/icons'
import { TIMEOUT_COPIED_FEEDBACK } from '@/lib/constants/limits'
import { MSG_ERROR_FALLBACK } from '@/lib/constants/messages'

function ShieldCheckIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  )
}

/**
 * 2段階認証設定コンポーネント
 */
export function TwoFactorSettings() {
  // 初期ロード用ステート
  const [isEnabled, setIsEnabled] = useState(false)
  const [backupCodesRemaining, setBackupCodesRemaining] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  // セットアップ成功後の表示切替（閉じるまで成功画面を維持するため）
  const [setupSuccessVisible, setSetupSuccessVisible] = useState(false)

  // 表示切替用ステート
  const [showDisableForm, setShowDisableForm] = useState(false)
  const [showRegenerateForm, setShowRegenerateForm] = useState(false)

  // 再生成後の新しいバックアップコード
  const [newBackupCodes, setNewBackupCodes] = useState<string[]>([])
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null)

  // 初期状態の取得
  useEffect(() => {
    async function fetchStatus() {
      const result = await get2FAStatus()
      if (!result.success) {
        setError(result.error ?? MSG_ERROR_FALLBACK)
      } else if (result.data?.enabled) {
        setIsEnabled(true)
        setBackupCodesRemaining(result.data.backupCodesRemaining ?? 0)
      }
      setLoading(false)
    }
    fetchStatus()
  }, [])

  // 成功メッセージの自動消去
  useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => setSuccessMessage(null), TIMEOUT_SUCCESS_MESSAGE)
      return () => clearTimeout(timer)
    }
  }, [successMessage])

  // コードをコピー
  const handleCopyCode = async (code: string, index: number) => {
    await navigator.clipboard.writeText(code)
    setCopiedIndex(index)
    setTimeout(() => setCopiedIndex(null), TIMEOUT_COPIED_FEEDBACK)
  }

  // 全コードをコピー
  const handleCopyAllCodes = async (codes: string[]) => {
    await navigator.clipboard.writeText(codes.join('\n'))
    setCopiedIndex(-1)
    setTimeout(() => setCopiedIndex(null), TIMEOUT_COPIED_FEEDBACK)
  }

  if (loading) {
    return (
      <div className="animate-pulse">
        <div className="h-8 bg-muted rounded w-48 mb-4" />
        <div className="h-20 bg-muted rounded" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="p-4 bg-destructive/10 text-destructive rounded-lg">
          {error}
        </div>
      )}
      {successMessage && (
        <div className="p-4 bg-muted/50 text-foreground rounded-lg">
          {successMessage}
        </div>
      )}

      {(!isEnabled || setupSuccessVisible) && (
        <SetupSection
          onSuccess={(backupCodesCount) => {
            setIsEnabled(true)
            setBackupCodesRemaining(backupCodesCount)
            setSuccessMessage('2段階認証が有効になりました')
            setSetupSuccessVisible(true)
          }}
          onClose={() => setSetupSuccessVisible(false)}
        />
      )}

      {isEnabled && (
        <>
          <div className="border rounded-lg p-6 border-border bg-muted/50">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-full bg-muted/50 flex items-center justify-center flex-shrink-0">
                <ShieldCheckIcon className="w-6 h-6 text-foreground" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-foreground">2段階認証が有効です</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  残りのバックアップコード: {backupCodesRemaining}個
                </p>
                {backupCodesRemaining < 3 && (
                  <p className="text-sm text-muted-foreground mt-1">
                    バックアップコードが少なくなっています。新しいコードを生成することをおすすめします。
                  </p>
                )}
              </div>
            </div>
          </div>

          {newBackupCodes.length > 0 && (
            <div className="border rounded-lg p-6">
              <h3 className="font-semibold mb-2">新しいバックアップコード</h3>
              <p className="text-sm text-muted-foreground mb-4">
                以下のバックアップコードを安全な場所に保存してください。古いコードは無効になりました。
              </p>
              <div className="bg-muted rounded-lg p-4">
                <div className="grid grid-cols-2 gap-2">
                  {newBackupCodes.map((code, index) => (
                    <div key={index} className="flex items-center justify-between bg-background p-2 rounded">
                      <code className="text-sm font-mono">{code}</code>
                      <button
                        onClick={() => handleCopyCode(code, index)}
                        className="text-muted-foreground hover:text-foreground p-1"
                      >
                        {copiedIndex === index ? (
                          <CheckIcon className="w-4 h-4 text-muted-foreground" />
                        ) : (
                          <CopyIcon className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  ))}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleCopyAllCodes(newBackupCodes)}
                  className="mt-3 w-full"
                >
                  {copiedIndex === -1 ? 'コピーしました！' : '全てコピー'}
                </Button>
              </div>
              <Button
                variant="outline"
                onClick={() => setNewBackupCodes([])}
                className="mt-4"
              >
                閉じる
              </Button>
            </div>
          )}

          {!showDisableForm && !showRegenerateForm && newBackupCodes.length === 0 && (
            <div className="border rounded-lg p-6">
              <h3 className="font-semibold mb-2">バックアップコード</h3>
              <p className="text-sm text-muted-foreground mb-4">
                バックアップコードを紛失した場合、新しいコードを生成できます。古いコードは無効になります。
              </p>
              <Button variant="outline" onClick={() => setShowRegenerateForm(true)}>
                バックアップコードを再生成
              </Button>
            </div>
          )}

          {showRegenerateForm && (
            <RegenerateBackupCodes
              onSuccess={(codes) => {
                setNewBackupCodes(codes)
                setBackupCodesRemaining(codes.length)
                setShowRegenerateForm(false)
                setSuccessMessage('バックアップコードが再生成されました')
              }}
              onCancel={() => setShowRegenerateForm(false)}
            />
          )}

          {!showDisableForm && !showRegenerateForm && newBackupCodes.length === 0 && (
            <div className="border rounded-lg p-6 border-destructive/30">
              <h3 className="font-semibold mb-2 text-destructive">2段階認証を無効化</h3>
              <p className="text-sm text-muted-foreground mb-4">
                2段階認証を無効にすると、アカウントのセキュリティが低下します。
              </p>
              <Button
                variant="destructive"
                onClick={() => setShowDisableForm(true)}
              >
                2段階認証を無効化
              </Button>
            </div>
          )}

          {showDisableForm && (
            <DisableForm
              onSuccess={() => {
                setIsEnabled(false)
                setShowDisableForm(false)
                setSuccessMessage('2段階認証が無効になりました')
              }}
              onCancel={() => setShowDisableForm(false)}
            />
          )}
        </>
      )}
    </div>
  )
}
