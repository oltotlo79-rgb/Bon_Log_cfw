/**
 * @file メール確認ページ
 * @description 確認メールのリンク（?token=xxx）を開いたときにトークンを検証し、完了またはエラーを表示する
 *
 * 機能概要:
 * - token クエリで verifyEmailToken を実行
 * - 成功時: メッセージ表示＋ログインページへリダイレクト
 * - 失敗時: 無効/期限切れメッセージ＋再送 or 再登録の案内
 */

import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'メール確認',
  description: 'メールアドレスの確認を行っています。',
  // トークン専用ページのため、検索エンジンには公開しない
  robots: { index: false, follow: false },
}

import { redirect } from 'next/navigation'
import { verifyEmailToken } from '@/lib/actions/auth'
import { ROUTE_LOGIN, ROUTE_REGISTER } from '@/lib/constants/routes'
import Link from 'next/link'

type SearchParams = { token?: string }

export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const { token } = await searchParams

  if (!token) {
    redirect(ROUTE_LOGIN)
  }

  const result = await verifyEmailToken(token)

  if (result.success) {
    redirect(`${ROUTE_LOGIN}?verified=1`)
  }

  return (
    <div className="p-6 sm:p-8 space-y-6">
      <h1 className="font-serif text-3xl font-bold text-center text-sumi mb-10 tracking-widest">
        メールの確認に失敗しました
      </h1>

      <p className="text-center text-destructive">
        {result.error}
      </p>

      <p className="text-center text-sm text-muted-foreground">
        ログイン画面から「確認メールを再送する」で再度メールを送信できます。<br />
        同じメールアドレスで再度登録することもできます。
      </p>

      <div className="text-center pt-4 space-x-4">
        <Link href={ROUTE_LOGIN} className="text-primary hover:underline font-medium">
          ログインページへ
        </Link>
        <Link href={ROUTE_REGISTER} className="text-primary hover:underline font-medium">
          新規登録
        </Link>
      </div>
    </div>
  )
}
