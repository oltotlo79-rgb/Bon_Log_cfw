/**
 * 機能概要:
 * - token クエリで confirmEmailChange を実行（トークン所持自体が本人性の証明のため未ログイン許容）
 * - 成功時: 完了メッセージ＋設定/ログインページへの導線
 * - 失敗時: 無効/期限切れメッセージ＋ログインページへの案内
 *
 * @remarks
 * メールアドレス変更フローの最終ステップ:
 * 1. /settings/account でメールアドレス変更をリクエスト
 * 2. 新しいメールアドレス宛に送信されたリンク（このページへのリンク）をクリック
 * 3. このページでトークンを検証し、変更を確定
 *
 * verify-email ページと同様、追加入力が不要なため Server Component で直接
 * Server Action を呼び出す（password-reset/confirm のように新パスワード入力を
 * 伴う場合とは異なり、Client Component + useEffect は不要）。
 */

import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'メールアドレス変更の確認',
  description: 'メールアドレス変更の確認を行っています。',
  // メールリンク経由のトークン専用フローのため、検索結果に表示する価値はない
  robots: { index: false, follow: false },
}

import Link from 'next/link'
import { confirmEmailChange } from '@/lib/actions/account-security'
import { ROUTE_LOGIN, ROUTE_SETTINGS_ACCOUNT } from '@/lib/constants/routes'
import { ERR_EMAIL_CHANGE_LINK_INVALID } from '@/lib/constants/errors'

type SearchParams = { token?: string }

export default async function EmailChangeConfirmPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const { token } = await searchParams

  const result = token
    ? await confirmEmailChange(token)
    : { success: false as const, error: ERR_EMAIL_CHANGE_LINK_INVALID }

  if (!result.success) {
    return (
      <div className="p-6 sm:p-8 space-y-6">
        <h1 className="font-serif text-3xl font-bold text-center text-sumi dark:text-washi mb-10 tracking-widest">
          メールアドレスの変更に失敗しました
        </h1>

        <p className="text-center text-destructive">
          {result.error}
        </p>

        <div className="text-center pt-4">
          <Link href={ROUTE_LOGIN} className="text-primary hover:underline font-medium">
            ログインページへ
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 sm:p-8 space-y-6">
      <h1 className="font-serif text-3xl font-bold text-center text-sumi dark:text-washi mb-10 tracking-widest">
        メールアドレスを変更しました
      </h1>

      <p className="text-center text-muted-foreground">
        新しいメールアドレスでログインできます。
      </p>

      <div className="text-center pt-4 space-y-2">
        <p>
          <Link href={ROUTE_SETTINGS_ACCOUNT} className="text-primary hover:underline font-medium">
            アカウント設定へ戻る
          </Link>
        </p>
        <p>
          <Link href={ROUTE_LOGIN} className="text-primary hover:underline font-medium">
            ログインページへ
          </Link>
        </p>
      </div>
    </div>
  )
}
