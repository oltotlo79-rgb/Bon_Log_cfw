/**
 * @file app/(public)/contact/page.tsx
 * @description BON-LOGお問い合わせページ
 *
 * このページはユーザーからのお問い合わせを受け付けるフォームを提供します。
 * Google AdSense審査において必須となるページです。
 *
 * 主な内容:
 * - お問い合わせフォーム
 * - お問い合わせ前の確認事項
 * - よくある質問へのリンク
 */

import { Metadata } from 'next'
import Link from 'next/link'
import { ContactForm } from '@/components/contact/ContactForm'
import { ROUTE_HELP, ROUTE_TERMS, ROUTE_PRIVACY, ROUTE_ABOUT, ROUTE_CONTACT } from '@/lib/constants/routes'
import { pageCanonical } from '@/lib/utils/seo'

/**
 * ページメタデータの定義
 */
export const metadata: Metadata = {
  title: 'お問い合わせ - BON-LOG',
  description: 'BON-LOG（ボンログ）へのお問い合わせはこちらから。サービスに関するご質問、ご意見、不具合報告などを受け付けています。',
  alternates: { canonical: pageCanonical(ROUTE_CONTACT) },
}

/**
 * お問い合わせページコンポーネント
 */
export default function ContactPage() {
  return (
    <div className="space-y-8">
      {/* ヘッダー */}
      <section className="text-center">
        <h1 className="mb-4 text-3xl font-bold tracking-tight">お問い合わせ</h1>
        <p className="mx-auto max-w-2xl text-muted-foreground">
          BON-LOGに関するご質問、ご意見、不具合報告などを受け付けています。
        </p>
      </section>

      {/* お問い合わせ前の確認 */}
      <section className="rounded-lg border bg-muted/50 p-6">
        <h2 className="mb-4 text-lg font-semibold">お問い合わせの前に</h2>
        <p className="mb-4 text-sm text-muted-foreground">
          よくあるご質問は
          <Link href={ROUTE_HELP} className="mx-1 text-primary hover:underline">
            ヘルプページ
          </Link>
          で回答しています。お問い合わせの前にご確認ください。
        </p>
        <ul className="space-y-2 text-sm text-muted-foreground">
          <li className="flex items-start gap-2">
            <span className="mt-1 block h-1.5 w-1.5 rounded-full bg-primary" />
            <span>アカウントの作成・ログインについて</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="mt-1 block h-1.5 w-1.5 rounded-full bg-primary" />
            <span>投稿の方法や制限について</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="mt-1 block h-1.5 w-1.5 rounded-full bg-primary" />
            <span>プレミアム会員について</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="mt-1 block h-1.5 w-1.5 rounded-full bg-primary" />
            <span>プライバシー設定について</span>
          </li>
        </ul>
      </section>

      {/* お問い合わせフォーム */}
      <section className="rounded-lg border bg-card p-6 md:p-8">
        <h2 className="mb-6 text-xl font-semibold">お問い合わせフォーム</h2>
        <ContactForm />
      </section>

      {/* 注意事項 */}
      <section className="text-center text-sm text-muted-foreground">
        <p className="mb-2">
          お問い合わせへの回答には、通常2〜3営業日程度お時間をいただいております。
        </p>
        <p>
          なお、すべてのお問い合わせに個別に回答できない場合がございますので、あらかじめご了承ください。
        </p>
      </section>

      {/* 関連リンク */}
      <section className="flex flex-wrap justify-center gap-4 text-sm">
        <Link href={ROUTE_HELP} className="text-primary hover:underline">
          ヘルプ
        </Link>
        <span className="text-muted-foreground">|</span>
        <Link href={ROUTE_TERMS} className="text-primary hover:underline">
          利用規約
        </Link>
        <span className="text-muted-foreground">|</span>
        <Link href={ROUTE_PRIVACY} className="text-primary hover:underline">
          プライバシーポリシー
        </Link>
        <span className="text-muted-foreground">|</span>
        <Link href={ROUTE_ABOUT} className="text-primary hover:underline">
          BON-LOGについて
        </Link>
      </section>
    </div>
  )
}
