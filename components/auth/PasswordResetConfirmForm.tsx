/**
 * @module components/auth/PasswordResetConfirmForm
 */

'use client'

import { useState, useEffect } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import Link from 'next/link'
import { resetPassword, verifyPasswordResetToken } from '@/lib/actions/auth'
import { PASSWORD_MIN_LENGTH, TIMEOUT_AUTO_REDIRECT } from '@/lib/constants/limits'
import { getFormString } from '@/lib/utils/form-data'
import { ROUTE_LOGIN } from '@/lib/constants/routes'
import { PasswordVisibilityToggle } from './PasswordVisibilityToggle'
import { VerifyingState, TokenInvalidState, ResetSuccessState } from './PasswordResetStates'
import { MSG_ERROR_FALLBACK, MSG_PASSWORD_MISMATCH } from '@/lib/constants/messages'
import { ERR_RESET_LINK_INVALID } from '@/lib/constants/errors'
import { validatePassword } from '@/lib/validations/password'

export function PasswordResetConfirmForm() {

  const searchParams = useSearchParams()
  const router = useRouter()

  const token = searchParams.get('token')
  const email = searchParams.get('email')

  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [tokenValid, setTokenValid] = useState<boolean | null>(null)
  const [verifying, setVerifying] = useState(true)

  useEffect(() => {
    async function verify() {
      if (!token || !email) {
        setTokenValid(false)
        setVerifying(false)
        return
      }

      const result = await verifyPasswordResetToken(email, token)
      setTokenValid(result.valid)
      setVerifying(false)
    }

    verify()
  }, [token, email])

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const formData = new FormData(e.currentTarget)
    const password = getFormString(formData, 'password') ?? ''
    const confirmPassword = getFormString(formData, 'confirmPassword') ?? ''

    if (password !== confirmPassword) {
      setError(MSG_PASSWORD_MISMATCH)
      setLoading(false)
      return
    }

    const passwordCheck = validatePassword(password)
    if (!passwordCheck.valid) {
      setError(passwordCheck.error)
      setLoading(false)
      return
    }

    if (!token || !email) {
      setError(ERR_RESET_LINK_INVALID)
      setLoading(false)
      return
    }

    const result = await resetPassword({
      email,
      token,
      newPassword: password,
    })

    if (!result.success) {
      setError(('error' in result ? result.error : null) ?? MSG_ERROR_FALLBACK)
      setLoading(false)
      return
    }

    setSuccess(true)
    setLoading(false)

    setTimeout(() => {
      router.push(ROUTE_LOGIN)
    }, TIMEOUT_AUTO_REDIRECT)
  }

  if (verifying) {
    return <VerifyingState />
  }

  if (!tokenValid) {
    return <TokenInvalidState />
  }

  if (success) {
    return <ResetSuccessState />
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <p className="text-sm text-muted-foreground">
        新しいパスワードを入力してください。
      </p>

      <div className="space-y-2">
        <Label htmlFor="password">新しいパスワード</Label>
        <div className="relative">
          <Input
            id="password"
            name="password"
            type={showPassword ? 'text' : 'password'}
            placeholder="8文字以上（英字・数字を含む）"
            required
            minLength={PASSWORD_MIN_LENGTH}
            autoComplete="new-password"
            className="pr-10"
          />
          <PasswordVisibilityToggle
            show={showPassword}
            onToggle={() => setShowPassword(!showPassword)}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="confirmPassword">新しいパスワード（確認）</Label>
        <div className="relative">
          <Input
            id="confirmPassword"
            name="confirmPassword"
            type={showConfirmPassword ? 'text' : 'password'}
            placeholder="もう一度入力"
            required
            minLength={PASSWORD_MIN_LENGTH}
            autoComplete="new-password"
            className="pr-10"
          />
          <PasswordVisibilityToggle
            show={showConfirmPassword}
            onToggle={() => setShowConfirmPassword(!showConfirmPassword)}
          />
        </div>
      </div>

      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}

      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? '更新中...' : 'パスワードを更新'}
      </Button>

      <p className="text-center text-sm text-muted-foreground">
        <Link href={ROUTE_LOGIN} className="text-primary hover:underline">
          ログインページへ戻る
        </Link>
      </p>
    </form>
  )
}
