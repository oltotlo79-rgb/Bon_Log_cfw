'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { regenerateBackupCodes } from '@/lib/actions/two-factor'
import { EyeIcon, EyeOffIcon } from './icons'
import { MSG_ERROR_FALLBACK } from '@/lib/constants/messages'

type RegenerateBackupCodesProps = {
  onSuccess: (newCodes: string[]) => void
  onCancel: () => void
}

/**
 * バックアップコード再生成フォーム
 *
 * パスワード入力により新しいバックアップコードを生成する
 */
export function RegenerateBackupCodes({ onSuccess, onCancel }: RegenerateBackupCodesProps) {
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const result = await regenerateBackupCodes(password)
    if (!result.success) {
      setError(result.error ?? MSG_ERROR_FALLBACK)
      setLoading(false)
      return
    }

    setLoading(false)
    onSuccess(result.data?.backupCodes ?? [])
  }

  const handleCancel = () => {
    setPassword('')
    setError(null)
    onCancel()
  }

  return (
    <div className="border rounded-lg p-6">
      <h3 className="font-semibold mb-2">バックアップコードを再生成</h3>
      <p className="text-sm text-muted-foreground mb-4">
        パスワードを入力して、新しいバックアップコードを生成します。
      </p>
      {error && (
        <div className="p-4 bg-destructive/10 text-destructive rounded-lg mb-4">
          {error}
        </div>
      )}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <Label htmlFor="regenerate-password">パスワード</Label>
          <div className="relative mt-1">
            <Input
              id="regenerate-password"
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="pr-10"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              {showPassword ? <EyeOffIcon className="w-4 h-4" /> : <EyeIcon className="w-4 h-4" />}
            </button>
          </div>
        </div>
        <div className="flex gap-2">
          <Button type="submit" disabled={!password || loading}>
            {loading ? '生成中...' : '再生成'}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={handleCancel}
          >
            キャンセル
          </Button>
        </div>
      </form>
    </div>
  )
}
