/**
 * パスワード変更フォーム
 *
 * @module components/settings/PasswordChangeForm
 */

'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { PasswordVisibilityToggle } from '@/components/auth/PasswordVisibilityToggle'
import { useToast } from '@/hooks/use-toast'
import { changePassword } from '@/lib/actions/account-security'
import { validatePassword } from '@/lib/validations/password'
import { PASSWORD_MIN_LENGTH } from '@/lib/constants/limits'
import {
  MSG_ERROR_FALLBACK,
  MSG_PASSWORD_MISMATCH,
  MSG_PASSWORD_FIELDS_REQUIRED,
  MSG_PASSWORD_CHANGE_SUCCESS,
} from '@/lib/constants/messages'

/**
 * パスワード変更フォーム
 *
 * 現パスワードの確認込みでパスワードを変更する。OAuth 専用アカウント
 * （パスワード未設定）の場合はサーバー側のエラーメッセージをそのまま表示する。
 */
export function PasswordChangeForm() {
  const { toast } = useToast()

  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showCurrentPassword, setShowCurrentPassword] = useState(false)
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const resetForm = () => {
    setCurrentPassword('')
    setNewPassword('')
    setConfirmPassword('')
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (loading) return

    setError(null)

    if (!currentPassword || !newPassword || !confirmPassword) {
      setError(MSG_PASSWORD_FIELDS_REQUIRED)
      return
    }

    if (newPassword !== confirmPassword) {
      setError(MSG_PASSWORD_MISMATCH)
      return
    }

    const passwordCheck = validatePassword(newPassword)
    if (!passwordCheck.valid) {
      setError(passwordCheck.error)
      return
    }

    setLoading(true)
    const result = await changePassword({ currentPassword, newPassword })
    setLoading(false)

    if (!result.success) {
      setError(result.error ?? MSG_ERROR_FALLBACK)
      return
    }

    resetForm()
    toast({ title: MSG_PASSWORD_CHANGE_SUCCESS })
  }

  return (
    <div className="border rounded-lg p-6">
      <h3 className="font-semibold mb-2">パスワード変更</h3>
      <p className="text-sm text-muted-foreground mb-4">
        ログインに使用するパスワードを変更します。
      </p>

      {error && (
        <div className="p-4 bg-destructive/10 text-destructive rounded-lg mb-4">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="currentPassword">現在のパスワード</Label>
          <div className="relative">
            <Input
              id="currentPassword"
              name="currentPassword"
              type={showCurrentPassword ? 'text' : 'password'}
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              autoComplete="current-password"
              className="pr-10"
              required
            />
            <PasswordVisibilityToggle
              show={showCurrentPassword}
              onToggle={() => setShowCurrentPassword(!showCurrentPassword)}
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="newPassword">新しいパスワード</Label>
          <div className="relative">
            <Input
              id="newPassword"
              name="newPassword"
              type={showNewPassword ? 'text' : 'password'}
              placeholder="8文字以上（英字・数字を含む）"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              autoComplete="new-password"
              minLength={PASSWORD_MIN_LENGTH}
              className="pr-10"
              required
            />
            <PasswordVisibilityToggle
              show={showNewPassword}
              onToggle={() => setShowNewPassword(!showNewPassword)}
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="confirmNewPassword">新しいパスワード（確認）</Label>
          <div className="relative">
            <Input
              id="confirmNewPassword"
              name="confirmNewPassword"
              type={showConfirmPassword ? 'text' : 'password'}
              placeholder="もう一度入力"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              autoComplete="new-password"
              minLength={PASSWORD_MIN_LENGTH}
              className="pr-10"
              required
            />
            <PasswordVisibilityToggle
              show={showConfirmPassword}
              onToggle={() => setShowConfirmPassword(!showConfirmPassword)}
            />
          </div>
        </div>

        <Button type="submit" disabled={loading}>
          {loading ? '変更中...' : 'パスワードを変更'}
        </Button>
      </form>
    </div>
  )
}
