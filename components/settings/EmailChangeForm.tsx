/**
 * メールアドレス変更フォーム（確認メール経由の二段階の第一段階）
 *
 * @module components/settings/EmailChangeForm
 */

'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { PasswordVisibilityToggle } from '@/components/auth/PasswordVisibilityToggle'
import { useToast } from '@/hooks/use-toast'
import { requestEmailChange } from '@/lib/actions/account-security'
import {
  MSG_ERROR_FALLBACK,
  MSG_EMAIL_REQUIRED,
  MSG_CONTACT_EMAIL_INVALID,
  MSG_EMAIL_CHANGE_REQUEST_SENT,
} from '@/lib/constants/messages'

const EMAIL_FORMAT_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

type EmailChangeFormProps = {
  currentEmail: string
}

/**
 * メールアドレス変更フォーム
 *
 * 現パスワード確認込みで変更確認メールの送信をリクエストする。
 * newEmail の重複有無に関わらずサーバー側で成功に丸められるため、
 * 成功時は常に同じ汎用メッセージのみを表示する（列挙攻撃対策）。
 */
export function EmailChangeForm({ currentEmail }: EmailChangeFormProps) {
  const { toast } = useToast()

  const [newEmail, setNewEmail] = useState('')
  const [currentPassword, setCurrentPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [requested, setRequested] = useState(false)

  const resetForm = () => {
    setNewEmail('')
    setCurrentPassword('')
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (loading) return

    setError(null)

    if (!newEmail || !currentPassword) {
      setError(MSG_EMAIL_REQUIRED)
      return
    }

    if (!EMAIL_FORMAT_REGEX.test(newEmail)) {
      setError(MSG_CONTACT_EMAIL_INVALID)
      return
    }

    setLoading(true)
    const result = await requestEmailChange({ newEmail, currentPassword })
    setLoading(false)

    if (!result.success) {
      setError(result.error ?? MSG_ERROR_FALLBACK)
      return
    }

    resetForm()
    setRequested(true)
    toast({ title: MSG_EMAIL_CHANGE_REQUEST_SENT })
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        現在のメールアドレス: <span className="font-medium text-foreground">{currentEmail}</span>
      </p>

      {requested && (
        <div className="p-4 bg-muted/50 rounded-lg text-sm text-foreground">
          {MSG_EMAIL_CHANGE_REQUEST_SENT}
        </div>
      )}

      {error && (
        <div className="p-4 bg-destructive/10 text-destructive rounded-lg text-sm">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="newEmail">新しいメールアドレス</Label>
          <Input
            id="newEmail"
            name="newEmail"
            type="email"
            placeholder="mail@example.com"
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            autoComplete="email"
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="emailChangeCurrentPassword">現在のパスワード</Label>
          <div className="relative">
            <Input
              id="emailChangeCurrentPassword"
              name="currentPassword"
              type={showPassword ? 'text' : 'password'}
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              autoComplete="current-password"
              className="pr-10"
              required
            />
            <PasswordVisibilityToggle
              show={showPassword}
              onToggle={() => setShowPassword(!showPassword)}
            />
          </div>
        </div>

        <Button type="submit" disabled={loading}>
          {loading ? '送信中...' : '確認メールを送信'}
        </Button>
      </form>
    </div>
  )
}
