'use client'

import Link from 'next/link'
import { ROUTE_LOGIN, ROUTE_PASSWORD_RESET } from '@/lib/constants/routes'

/**
 * トークン検証中のローディング表示
 *
 * パスワードリセットリンクの有効性を確認している間に表示される。
 */
export function VerifyingState() {
  return (
    <div className="text-center py-8">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
      <p className="mt-4 text-muted-foreground">リンクを検証中...</p>
    </div>
  )
}

/**
 * トークン無効時のエラー表示
 *
 * トークンが無効または期限切れの場合に表示される。
 * 再リクエストへのリンクとログインページへのリンクを含む。
 */
export function TokenInvalidState() {
  return (
    <div className="space-y-4">
      <div className="rounded-lg bg-destructive/10 p-4 text-center">
        <p className="text-destructive font-medium">リンクが無効です</p>
        <p className="text-destructive text-sm mt-2">
          リセットリンクが無効または期限切れです。
          もう一度パスワードリセットをお試しください。
        </p>
      </div>

      <p className="text-center">
        <Link href={ROUTE_PASSWORD_RESET} className="text-primary hover:underline">
          パスワードリセットを再度リクエスト
        </Link>
      </p>

      <p className="text-center text-sm text-muted-foreground">
        <Link href={ROUTE_LOGIN} className="text-primary hover:underline">
          ログインページへ戻る
        </Link>
      </p>
    </div>
  )
}

/**
 * パスワードリセット成功時の表示
 *
 * パスワード更新が完了した後に表示される。
 * 自動リダイレクトの案内と即時ログインリンクを含む。
 */
export function ResetSuccessState() {
  return (
    <div className="space-y-4">
      <div className="rounded-lg bg-muted/50 p-4 text-center">
        <p className="text-foreground font-medium">パスワードを更新しました</p>
        <p className="text-foreground text-sm mt-2">
          新しいパスワードでログインできます。
          ログインページへ移動します...
        </p>
      </div>

      <p className="text-center">
        <Link href={ROUTE_LOGIN} className="text-primary hover:underline">
          今すぐログインする
        </Link>
      </p>
    </div>
  )
}
