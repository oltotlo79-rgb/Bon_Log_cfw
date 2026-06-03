/**
 * @module components/auth/PasswordResetForm
 */

'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import Link from 'next/link'
import { requestPasswordReset } from '@/lib/actions/auth'
import { ROUTE_LOGIN } from '@/lib/constants/routes'
import { getFormString } from '@/lib/utils/form-data'
import { MSG_ERROR_FALLBACK } from '@/lib/constants/messages'

export function PasswordResetForm() {

  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const formData = new FormData(e.currentTarget)
    const email = getFormString(formData, 'email') ?? ''

    if (!email) {
      setError('メールアドレスを入力してください')
      setLoading(false)
      return
    }

    const result = await requestPasswordReset(email)

    if (!result.success) {
      setError(('error' in result ? result.error : null) ?? MSG_ERROR_FALLBACK)
      setLoading(false)
      return
    }

    setSuccess(true)
    setLoading(false)
  }

  if (success) {
    return (
      <div className="space-y-4">
        <div className="rounded-lg bg-muted/50 p-4 text-center">
          <p className="text-foreground font-medium">メールを送信しました</p>
          <p className="text-foreground text-sm mt-2">
            入力されたメールアドレスにパスワードリセット用のリンクを送信しました。
            メールをご確認ください。
          </p>
        </div>

        <p className="text-center text-sm text-muted-foreground">
          メールが届かない場合は、迷惑メールフォルダもご確認ください。
        </p>

        <p className="text-center text-sm text-muted-foreground">
          <Link href={ROUTE_LOGIN} className="text-primary hover:underline">
            ログインページへ戻る
          </Link>
        </p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <p className="text-sm text-muted-foreground">
        登録したメールアドレスを入力してください。
        パスワードリセット用のリンクをお送りします。
      </p>

      <div className="space-y-2">
        <Label htmlFor="email">メールアドレス</Label>
        <Input
          id="email"
          name="email"
          type="email"
          placeholder="mail@example.com"
          required
          autoComplete="email"
        />
      </div>

      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}

      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? '送信中...' : 'リセットメールを送信'}
      </Button>

      <p className="text-center text-sm text-muted-foreground">
        <Link href={ROUTE_LOGIN} className="text-primary hover:underline">
          ログインページへ戻る
        </Link>
      </p>
    </form>
  )
}
