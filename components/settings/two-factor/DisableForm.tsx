'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { disable2FA } from '@/lib/actions/two-factor'
import { EyeIcon, EyeOffIcon } from './icons'
import { MSG_ERROR_FALLBACK } from '@/lib/constants/messages'

type DisableFormProps = {
  onSuccess: () => void
  onCancel: () => void
}

/**
 * 2FA 無効化フォーム
 *
 * パスワード入力により2段階認証を無効化する
 */
export function DisableForm({ onSuccess, onCancel }: DisableFormProps) {
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const result = await disable2FA(password)
    if (!result.success) {
      setError(result.error ?? MSG_ERROR_FALLBACK)
      setLoading(false)
      return
    }

    setLoading(false)
    onSuccess()
  }

  const handleCancel = () => {
    setPassword('')
    setError(null)
    onCancel()
  }

  return (
    <div className="border rounded-lg p-6 border-destructive/30">
      <h3 className="font-semibold mb-2 text-destructive">2段階認証を無効化</h3>
      <p className="text-sm text-muted-foreground mb-4">
        パスワードを入力して、2段階認証を無効にします。
      </p>
      {error && (
        <div className="p-4 bg-destructive/10 text-destructive rounded-lg mb-4">
          {error}
        </div>
      )}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <Label htmlFor="disable-password">パスワード</Label>
          <div className="relative mt-1">
            <Input
              id="disable-password"
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
          <Button type="submit" variant="destructive" disabled={!password || loading}>
            {loading ? '無効化中...' : '無効化する'}
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
