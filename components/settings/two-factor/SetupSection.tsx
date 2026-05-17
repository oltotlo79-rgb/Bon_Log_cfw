'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { setup2FA, enable2FA } from '@/lib/actions/two-factor'
import { TWO_FACTOR_CODE_LENGTH, TIMEOUT_COPIED_FEEDBACK } from '@/lib/constants/limits'
import { CopyIcon, CheckIcon } from './icons'
import { MSG_ERROR_FALLBACK } from '@/lib/constants/messages'

type SetupState = 'idle' | 'verify' | 'success'

type SetupSectionProps = {
  /** セットアップ成功後に呼ばれるコールバック（backupCodesの件数を渡す） */
  onSuccess: (backupCodesCount: number) => void
  /** 成功画面の「閉じる」ボタンが押されたときのコールバック */
  onClose?: () => void
}

/**
 * 2FA セットアップセクション
 *
 * 「2段階認証を設定する」ボタン → setup2FA 呼び出し → QRコード/バックアップコード表示
 * → 認証コード入力 → enable2FA 呼び出し → 成功
 */
export function SetupSection({ onSuccess, onClose }: SetupSectionProps) {
  const [setupState, setSetupState] = useState<SetupState>('idle')
  const [qrCode, setQrCode] = useState<string | null>(null)
  const [secret, setSecret] = useState<string | null>(null)
  const [setupId, setSetupId] = useState<string | null>(null)
  const [backupCodes, setBackupCodes] = useState<string[]>([])
  const [verifyCode, setVerifyCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null)

  // セットアップを開始
  const handleStartSetup = async () => {
    setError(null)
    setSetupState('verify') // ロード中も verify 画面に入ることでスピナー等を表示可能

    const result = await setup2FA()
    if (!result.success) {
      setError(result.error ?? MSG_ERROR_FALLBACK)
      setSetupState('idle')
      return
    }
    setQrCode(result.data?.qrCode ?? '')
    setSecret(result.data?.secret ?? '')
    setSetupId(result.data?.setupId ?? null)
    setBackupCodes(result.data?.backupCodes ?? [])
  }

  // 2FAを有効化（setupId のみサーバーに送信。secret は再送しない）
  const handleEnable = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!setupId) return

    setLoading(true)
    setError(null)

    const result = await enable2FA(verifyCode, setupId)
    if (!result.success) {
      setError(result.error ?? MSG_ERROR_FALLBACK)
      setLoading(false)
      return
    }

    setSetupState('success')
    setLoading(false)
    onSuccess(backupCodes.length)
  }

  // セットアップをキャンセル
  const handleCancelSetup = () => {
    setSetupState('idle')
    setQrCode(null)
    setSecret(null)
    setSetupId(null)
    setBackupCodes([])
    setVerifyCode('')
    setError(null)
  }

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

  // --- レンダリング ---

  // 2FA無効状態: セットアップ開始ボタン
  if (setupState === 'idle') {
    return (
      <div className="border rounded-lg p-6">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6 text-muted-foreground">
              <path d="m2 2 20 20" />
              <path d="M5 5a1 1 0 0 0-1 1v7c0 5 3.5 7.5 7.67 8.94a1 1 0 0 0 .67.01c2.35-.82 4.48-1.97 5.9-3.71" />
              <path d="M9.309 3.652A12.252 12.252 0 0 0 11.24 2.28a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1v7a9.784 9.784 0 0 1-.08 1.264" />
            </svg>
          </div>
          <div className="flex-1">
            <h3 className="font-semibold">2段階認証</h3>
            <p className="text-sm text-muted-foreground mt-1">
              2段階認証を有効にすると、ログイン時にパスワードに加えて認証アプリからのコードが必要になります。
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              Google Authenticator、Microsoft Authenticatorなどの認証アプリをご利用ください。
            </p>
            {error && (
              <div className="p-4 bg-destructive/10 text-destructive rounded-lg mt-4">
                {error}
              </div>
            )}
            <Button onClick={handleStartSetup} className="mt-4">
              2段階認証を設定する
            </Button>
          </div>
        </div>
      </div>
    )
  }

  // セットアップ: QRコード表示ステップ
  if (setupState === 'verify' && qrCode) {
    return (
      <div className="border rounded-lg p-6 space-y-6">
        {error && (
          <div className="p-4 bg-destructive/10 text-destructive rounded-lg">
            {error}
          </div>
        )}

        <div>
          <h3 className="font-semibold mb-2">ステップ 1: 認証アプリでスキャン</h3>
          <p className="text-sm text-muted-foreground mb-4">
            認証アプリ（Google Authenticator等）で下のQRコードをスキャンしてください。
          </p>
          <div className="flex justify-center">
            {/* eslint-disable-next-line @next/next/no-img-element -- QRコードはbase64データURLのため最適化不要 */}
            <img src={qrCode} alt="2FA QRコード" width={192} height={192} className="w-48 h-48" />
          </div>
          {secret && (
            <div className="mt-4 text-center">
              <p className="text-xs text-muted-foreground">QRコードを読み取れない場合は、以下のコードを手動で入力してください:</p>
              <code className="text-sm bg-muted px-2 py-1 rounded mt-1 inline-block">{secret}</code>
            </div>
          )}
        </div>

        <div>
          <h3 className="font-semibold mb-2">ステップ 2: バックアップコードを保存</h3>
          <p className="text-sm text-muted-foreground mb-4">
            以下のバックアップコードを安全な場所に保存してください。認証アプリにアクセスできなくなった場合に使用できます。
          </p>
          <div className="bg-muted rounded-lg p-4">
            <div className="grid grid-cols-2 gap-2">
              {backupCodes.map((code, index) => (
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
              onClick={() => handleCopyAllCodes(backupCodes)}
              className="mt-3 w-full"
            >
              {copiedIndex === -1 ? 'コピーしました！' : '全てコピー'}
            </Button>
          </div>
        </div>

        <div>
          <h3 className="font-semibold mb-2">ステップ 3: 認証コードを入力</h3>
          <p className="text-sm text-muted-foreground mb-4">
            認証アプリに表示されている6桁のコードを入力してください。
          </p>
          <form onSubmit={handleEnable} className="space-y-4">
            <div>
              <Label htmlFor="verify-code">認証コード</Label>
              <Input
                id="verify-code"
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={TWO_FACTOR_CODE_LENGTH}
                placeholder="000000"
                value={verifyCode}
                onChange={(e) => setVerifyCode(e.target.value.replace(/\D/g, '').slice(0, TWO_FACTOR_CODE_LENGTH))}
                className="mt-1"
              />
            </div>
            <div className="flex gap-2">
              <Button type="submit" disabled={verifyCode.length !== TWO_FACTOR_CODE_LENGTH || loading}>
                {loading ? '確認中...' : '2段階認証を有効化'}
              </Button>
              <Button type="button" variant="outline" onClick={handleCancelSetup}>
                キャンセル
              </Button>
            </div>
          </form>
        </div>
      </div>
    )
  }

  // セットアップ完了
  return (
    <div className="border rounded-lg p-6 border-border bg-muted/50">
      <div className="flex items-start gap-4">
        <div className="w-12 h-12 rounded-full bg-muted/50 flex items-center justify-center flex-shrink-0">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6 text-foreground">
            <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" />
            <path d="m9 12 2 2 4-4" />
          </svg>
        </div>
        <div className="flex-1">
          <h3 className="font-semibold text-foreground">2段階認証が有効になりました</h3>
          <p className="text-sm text-muted-foreground mt-1">
            次回ログイン時から、認証アプリのコードが必要になります。
          </p>
          <Button
            variant="outline"
            onClick={() => {
              setSetupState('idle')
              onClose?.()
            }}
            className="mt-4"
          >
            閉じる
          </Button>
        </div>
      </div>
    </div>
  )
}
