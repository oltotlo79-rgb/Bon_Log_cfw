/**
 * パスワードリセット確認フォームコンポーネント
 *
 * @module components/auth/PasswordResetConfirmForm
 */

'use client'

/**
 * React Hooks
 *
 * useState: フォームの各種状態を管理
 * useEffect: コンポーネントマウント時にトークン検証を実行
 */
import { useState, useEffect } from 'react'

/**
 * Next.js Hooks
 *
 * useSearchParams: URLクエリパラメータ（token, email）を取得
 * useRouter: プログラムによるページ遷移（成功後のリダイレクト）
 */
import { useSearchParams, useRouter } from 'next/navigation'

/**
 * UIコンポーネント
 */
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

/**
 * Next.js Linkコンポーネント
 * ログインページへのリンクに使用
 */
import Link from 'next/link'

/**
 * 認証関連のServer Actions
 *
 * resetPassword: パスワードリセットを実行
 * verifyPasswordResetToken: トークンの有効性を検証
 */
import { resetPassword, verifyPasswordResetToken } from '@/lib/actions/auth'
import { PASSWORD_MIN_LENGTH, TIMEOUT_AUTO_REDIRECT } from '@/lib/constants/limits'
import { getFormString } from '@/lib/utils/form-data'
import { ROUTE_LOGIN } from '@/lib/constants/routes'

/**
 * 抽出済みサブコンポーネント
 */
import { PasswordVisibilityToggle } from './PasswordVisibilityToggle'
import { VerifyingState, TokenInvalidState, ResetSuccessState } from './PasswordResetStates'
import { MSG_ERROR_FALLBACK } from '@/lib/constants/messages'

/**
 * パスワードリセット確認フォームコンポーネント
 *
 * ## 処理フロー
 * 1. URLからトークンとメールアドレスを取得
 * 2. マウント時にトークンの有効性を検証
 * 3. 有効な場合はフォームを表示
 * 4. パスワード入力後、バリデーション
 * 5. Server Actionでパスワードを更新
 * 6. 成功後、3秒後にログインページへリダイレクト
 *
 * @example
 * // URL例: /password-reset/confirm?token=xxx&email=user@example.com
 * <PasswordResetConfirmForm />
 */
export function PasswordResetConfirmForm() {

  /**
   * URLのクエリパラメータを取得
   * ?token=xxx&email=yyy の形式で渡される
   */
  const searchParams = useSearchParams()

  /**
   * Next.jsルーター
   * 成功後のログインページへのリダイレクトに使用
   */
  const router = useRouter()

  /**
   * トークンとメールアドレスをURLから取得
   */
  const token = searchParams.get('token')
  const email = searchParams.get('email')

  /**
   * エラーメッセージ
   * バリデーションエラーやサーバーエラーを表示
   */
  const [error, setError] = useState<string | null>(null)

  /**
   * パスワード更新成功フラグ
   * trueの場合は成功メッセージを表示
   */
  const [success, setSuccess] = useState(false)

  /**
   * フォーム送信中のローディング状態
   */
  const [loading, setLoading] = useState(false)

  /**
   * 新しいパスワードの表示/非表示状態
   */
  const [showPassword, setShowPassword] = useState(false)

  /**
   * 確認用パスワードの表示/非表示状態
   */
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)

  /**
   * トークンの有効性
   * null: 未検証、true: 有効、false: 無効
   */
  const [tokenValid, setTokenValid] = useState<boolean | null>(null)

  /**
   * トークン検証中のローディング状態
   */
  const [verifying, setVerifying] = useState(true)

  /**
   * コンポーネントマウント時にトークンを検証
   *
   * ## 検証フロー
   * 1. トークンまたはメールがない場合は無効
   * 2. Server Actionでトークンを検証
   * 3. 結果をtokenValid状態に設定
   */
  useEffect(() => {
    async function verify() {
      /**
       * トークンまたはメールがない場合は無効とする
       */
      if (!token || !email) {
        setTokenValid(false)
        setVerifying(false)
        return
      }

      /**
       * Server Actionでトークンの有効性を検証
       * 期限切れや不正なトークンをチェック
       */
      const result = await verifyPasswordResetToken(email, token)
      setTokenValid(result.valid)
      setVerifying(false)
    }

    verify()
  }, [token, email])

  /**
   * フォーム送信ハンドラ
   *
   * ## 処理フロー
   * 1. フォームのデフォルト送信を防止
   * 2. パスワード一致チェック
   * 3. パスワード長さチェック（8文字以上）
   * 4. パスワード強度チェック（英数字必須）
   * 5. トークンとメールの存在チェック
   * 6. Server Actionでパスワードを更新
   * 7. 成功時: 3秒後にログインページへリダイレクト
   *
   * @param e - フォームのsubmitイベント
   */
  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const formData = new FormData(e.currentTarget)
    const password = getFormString(formData, 'password') ?? ''
    const confirmPassword = getFormString(formData, 'confirmPassword') ?? ''

    /**
     * パスワード一致チェック
     * 確認用パスワードと一致しない場合はエラー
     */
    if (password !== confirmPassword) {
      setError('パスワードが一致しません')
      setLoading(false)
      return
    }

    /**
     * パスワード長さチェック
     * 8文字未満の場合はエラー
     */
    if (password.length < PASSWORD_MIN_LENGTH) {
      setError('パスワードは8文字以上で入力してください')
      setLoading(false)
      return
    }

    /**
     * パスワード強度チェック
     * 英字と数字の両方を含む必要がある
     */
    const hasLetter = /[a-zA-Z]/.test(password)
    const hasNumber = /[0-9]/.test(password)
    if (!hasLetter || !hasNumber) {
      setError('パスワードはアルファベットと数字を両方含めてください')
      setLoading(false)
      return
    }

    /**
     * トークンとメールの存在チェック
     * URLから正しく取得できていない場合はエラー
     */
    if (!token || !email) {
      setError('無効なリセットリンクです')
      setLoading(false)
      return
    }

    /**
     * Server Actionでパスワードをリセット
     */
    const result = await resetPassword({
      email,
      token,
      newPassword: password,
    })

    /**
     * エラーがあれば表示
     */
    if (!result.success) {
      setError(('error' in result ? result.error : null) ?? MSG_ERROR_FALLBACK)
      setLoading(false)
      return
    }

    /**
     * 成功時の処理
     */
    setSuccess(true)
    setLoading(false)

    /**
     * 3秒後にログインページへ自動リダイレクト
     * ユーザーに成功メッセージを読む時間を与える
     */
    setTimeout(() => {
      router.push(ROUTE_LOGIN)
    }, TIMEOUT_AUTO_REDIRECT)
  }

  /**
   * トークン検証中はローディングスピナーを表示
   */
  if (verifying) {
    return <VerifyingState />
  }

  /**
   * トークンが無効または期限切れの場合はエラーメッセージを表示
   */
  if (!tokenValid) {
    return <TokenInvalidState />
  }

  /**
   * パスワード更新成功時は成功メッセージを表示
   */
  if (success) {
    return <ResetSuccessState />
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* 説明文 */}
      <p className="text-sm text-muted-foreground">
        新しいパスワードを入力してください。
      </p>

      {/* 新しいパスワード入力フィールド */}
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
          {/* パスワード表示トグルボタン */}
          <PasswordVisibilityToggle
            show={showPassword}
            onToggle={() => setShowPassword(!showPassword)}
          />
        </div>
      </div>

      {/* 確認用パスワード入力フィールド */}
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
          {/* パスワード表示トグルボタン */}
          <PasswordVisibilityToggle
            show={showConfirmPassword}
            onToggle={() => setShowConfirmPassword(!showConfirmPassword)}
          />
        </div>
      </div>

      {/* エラーメッセージ表示 */}
      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}

      {/* 送信ボタン */}
      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? '更新中...' : 'パスワードを更新'}
      </Button>

      {/* ログインページへ戻るリンク */}
      <p className="text-center text-sm text-muted-foreground">
        <Link href={ROUTE_LOGIN} className="text-primary hover:underline">
          ログインページへ戻る
        </Link>
      </p>
    </form>
  )
}
