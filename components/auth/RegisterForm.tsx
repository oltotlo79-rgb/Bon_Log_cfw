'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import Link from 'next/link'
import { signIn } from 'next-auth/react'
import { registerUser } from '@/lib/actions/auth'
import { getFingerprintWithCache } from '@/lib/fingerprint'
import { Eye, EyeOff } from 'lucide-react'
import { PASSWORD_MIN_LENGTH, MAX_NICKNAME_LENGTH } from '@/lib/constants/limits'
import { ROUTE_VERIFY_EMAIL_SENT, ROUTE_LOGIN, ROUTE_FEED, ROUTE_TERMS, ROUTE_PRIVACY } from '@/lib/constants/routes'
import { MSG_ERROR_FALLBACK, MSG_PASSWORD_MISMATCH, MSG_TERMS_AGREEMENT_REQUIRED } from '@/lib/constants/messages'
import { validatePassword } from '@/lib/validations/password'
import { getFormString } from '@/lib/utils/form-data'

export function RegisterForm() {
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [agreedToTerms, setAgreedToTerms] = useState(false)
  const [fingerprint, setFingerprint] = useState<string | null>(null)

  useEffect(() => {
    async function collectFingerprint() {
      const fp = await getFingerprintWithCache()
      if (fp) {
        setFingerprint(fp)
      }
    }
    collectFingerprint()
  }, [])

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const formData = new FormData(e.currentTarget)
    const email = getFormString(formData, 'email') ?? ''
    const password = getFormString(formData, 'password') ?? ''
    const confirmPassword = getFormString(formData, 'confirmPassword') ?? ''
    const nickname = getFormString(formData, 'nickname') ?? ''

    if (!agreedToTerms) {
      setError(MSG_TERMS_AGREEMENT_REQUIRED)
      setLoading(false)
      return
    }

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

    try {
      const result = await registerUser({
        email,
        password,
        nickname,
        fingerprint: fingerprint || undefined,
      })

      if (!result.success) {
        setError(('error' in result ? result.error : null) ?? MSG_ERROR_FALLBACK)
        setLoading(false)
        return
      }

      // サーバーアクション直後の router.push はアクションの再レンダリングや
      // ハイドレーション状態と競合し、遷移が反映されず「登録中…」のまま固まることがある。
      // 確認ページへの一度きりの遷移なので、ハードナビゲーションで確実に遷移させる。
      window.location.assign(ROUTE_VERIFY_EMAIL_SENT)
    } catch {
      setError(MSG_ERROR_FALLBACK)
      setLoading(false)
    }
  }

  const errorId = 'register-error'
  const hasError = !!error

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate aria-describedby={hasError ? errorId : undefined}>
      <div className="space-y-3">
        <Label htmlFor="nickname" className="font-bold tracking-widest text-lg">ニックネーム</Label>
        <Input
          id="nickname"
          name="nickname"
          type="text"
          placeholder="表示名"
          required
          maxLength={MAX_NICKNAME_LENGTH}
          className="text-lg bg-white/50"
          aria-invalid={hasError || undefined}
          aria-describedby={hasError ? errorId : undefined}
        />
      </div>

      <div className="space-y-3">
        <Label htmlFor="email" className="font-bold tracking-widest text-lg">メールアドレス</Label>
        <Input
          id="email"
          name="email"
          type="email"
          placeholder="mail@example.com"
          required
          autoComplete="email"
          className="text-lg bg-white/50"
          aria-invalid={hasError || undefined}
          aria-describedby={hasError ? errorId : undefined}
        />
      </div>

      <div className="space-y-3">
        <Label htmlFor="password" className="font-bold tracking-widest text-lg">パスワード</Label>
        <div className="relative">
          <Input
            id="password"
            name="password"
            type={showPassword ? 'text' : 'password'}
            placeholder="8文字以上（英字・数字を含む）"
            required
            minLength={PASSWORD_MIN_LENGTH}
            autoComplete="new-password"
            className="pr-10 text-lg bg-white/50"
            aria-invalid={hasError || undefined}
            aria-describedby={hasError ? errorId : undefined}
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
            aria-label={showPassword ? 'パスワードを隠す' : 'パスワードを表示'}
          >
            {showPassword ? (
              <EyeOff className="h-4 w-4" />
            ) : (
              <Eye className="h-4 w-4" />
            )}
          </button>
        </div>
      </div>

      <div className="space-y-3">
        <Label htmlFor="confirmPassword" className="font-bold tracking-widest text-lg">パスワード（確認）</Label>
        <div className="relative">
          <Input
            id="confirmPassword"
            name="confirmPassword"
            type={showConfirmPassword ? 'text' : 'password'}
            placeholder="もう一度入力"
            required
            minLength={PASSWORD_MIN_LENGTH}
            autoComplete="new-password"
            className="pr-10 text-lg bg-white/50"
            aria-invalid={hasError || undefined}
            aria-describedby={hasError ? errorId : undefined}
          />
          <button
            type="button"
            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
            aria-label={showConfirmPassword ? 'パスワードを隠す' : 'パスワードを表示'}
          >
            {showConfirmPassword ? (
              <EyeOff className="h-4 w-4" />
            ) : (
              <Eye className="h-4 w-4" />
            )}
          </button>
        </div>
      </div>

      <div className="flex items-start gap-2">
        <input
          type="checkbox"
          id="agreeTerms"
          checked={agreedToTerms}
          onChange={(e) => setAgreedToTerms(e.target.checked)}
          className="mt-1 h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
        />
        <label htmlFor="agreeTerms" className="text-sm text-muted-foreground">
          <Link href={ROUTE_TERMS} target="_blank" className="text-primary hover:underline">
            利用規約
          </Link>
          および
          <Link href={ROUTE_PRIVACY} target="_blank" className="text-primary hover:underline">
            プライバシーポリシー
          </Link>
          に同意します
        </label>
      </div>

      {error && (
        <p id={errorId} className="text-sm text-destructive" role="alert" data-testid="register-error">{error}</p>
      )}

      <Button
        type="submit"
        className="w-full text-lg tracking-widest py-6 mt-8 shadow-washi-lg btn-washi bg-black hover:bg-black/80 font-bold"
        disabled={loading}
      >
        {loading ? '登録中...' : '新規登録'}
      </Button>

      <p className="text-center text-sm text-muted-foreground">
        既にアカウントをお持ちの方は{' '}
        <Link href={ROUTE_LOGIN} className="text-primary hover:underline">
          ログイン
        </Link>
      </p>

      <div className="relative my-6">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t border-border" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-transparent px-2 text-muted-foreground">または</span>
        </div>
      </div>

      <Button
        type="button"
        variant="outline"
        className="w-full text-base py-5 flex items-center justify-center gap-3"
        disabled={loading}
        onClick={() => {
          setLoading(true)
          signIn('google', { callbackUrl: ROUTE_FEED })
        }}
      >
        <svg className="h-5 w-5" viewBox="0 0 24 24" aria-hidden="true">
          <path
            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
            fill="#4285F4"
          />
          <path
            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            fill="#34A853"
          />
          <path
            d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
            fill="#FBBC05"
          />
          <path
            d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
            fill="#EA4335"
          />
        </svg>
        Googleで登録
      </Button>
    </form>
  )
}
