/**
 * @file メール確認送信完了ページ
 * @description 新規登録後、確認メールを送った旨を表示するページ
 *
 * 機能概要:
 * - 確認メールを送信したことを伝えるメッセージ表示
 * - ログインページへのリンク（メール確認後にログインするため）
 */

import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: '確認メール送信完了',
  description: '登録メールアドレスに確認メールを送信しました。メールを確認してアカウントを有効化してください。',
  // 登録直後の遷移先で、検索流入させる意図がないため noindex
  robots: { index: false, follow: false },
}

import Link from 'next/link'
import Image from 'next/image'
import { ROUTE_LOGIN } from '@/lib/constants/routes'

export default function VerifyEmailSentPage() {
  return (
    <div className="p-6 sm:p-8 space-y-6">
      {/* ウェルカム盆栽イラスト */}
      <Image
        src="/images/generated/auth/welcome-bonsai.webp"
        alt=""
        width={200}
        height={133}
        className="mx-auto opacity-80"
      />

      <h2 className="font-serif text-3xl font-bold text-center text-sumi mb-10 tracking-widest">
        確認メールを送りました
      </h2>

      <p className="text-center text-muted-foreground">
        ご登録のメールアドレスに確認用のリンクを送信しました。<br />
        メール内のリンクをクリックして、メールアドレスを確認してください。
      </p>

      <p className="text-center text-sm text-muted-foreground">
        メールが届かない場合は、迷惑メールフォルダをご確認ください。<br />
        しばらく経っても届かない場合は、ログイン画面から「確認メールを再送する」をお試しください。
      </p>

      <div className="text-center pt-4">
        <Link
          href={ROUTE_LOGIN}
          className="text-primary hover:underline font-medium"
        >
          ログインページへ
        </Link>
      </div>
    </div>
  )
}
