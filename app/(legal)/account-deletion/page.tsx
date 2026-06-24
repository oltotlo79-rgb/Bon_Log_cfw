/**
 * @module app/(legal)/account-deletion
 * Google Play デベロッパーポリシーが要求するアカウント削除手順の公開ページ。
 * ログイン不要・クロール可能。PROTECTED_PATHS に含まない。
 */

import { Metadata } from 'next'
import Link from 'next/link'
import {
  ROUTE_ACCOUNT_DELETION,
  ROUTE_CONTACT,
  ROUTE_SETTINGS_ACCOUNT,
} from '@/lib/constants/routes'
import { SUPPORT_EMAIL, OPERATOR_NAME } from '@/lib/constants/contact'
import { pageCanonical } from '@/lib/utils/seo'

export const metadata: Metadata = {
  title: 'アカウント削除のご案内',
  description:
    'BON-LOG（ボンログ）のアカウントを削除する方法と、削除時のデータの取り扱いについてご説明します。ログイン不要でアカウント削除を依頼することも可能です。',
  alternates: { canonical: pageCanonical(ROUTE_ACCOUNT_DELETION) },
}

export default function AccountDeletionPage() {
  return (
    <article className="prose prose-neutral dark:prose-invert max-w-none">
      <h1>アカウント削除のご案内</h1>
      <p className="text-sm text-muted-foreground">最終更新日: 2026年6月25日</p>

      <p>
        BON-LOG（ボンログ）では、ユーザーの皆様がいつでもアカウントを削除できる手段をご用意しています。このページでは、アカウントを削除する方法と、削除時のデータの取り扱いについてご説明します。
      </p>

      <h2>アプリ・Web からのアカウント削除（ログイン中の方）</h2>
      <p>BON-LOG にログインしている方は、アプリまたはウェブサイトから直接アカウントを削除できます。</p>
      <ol>
        <li>BON-LOG を開きます</li>
        <li>
          <strong>設定</strong> →{' '}
          <Link href={ROUTE_SETTINGS_ACCOUNT} className="underline hover:text-foreground">
            アカウント
          </Link>{' '}
          の順に進みます
        </li>
        <li>「<strong>アカウントを削除</strong>」を選択します</li>
        <li>画面の案内に従って、削除操作を確定します</li>
      </ol>
      <p>
        削除は確定後ただちに実行されます。<strong>一度削除したアカウントを復元することはできません</strong>のでご注意ください。
      </p>

      <h2>ログインせずに削除を依頼する（アプリをアンインストール済みの方など）</h2>
      <p>
        ログインできない場合や、アプリをアンインストール済みの場合は、以下のメールアドレスまでご連絡ください。
      </p>
      <p>
        <strong>送信先:</strong>{' '}
        <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>
      </p>
      <p>
        <strong>メール本文に以下をご記載ください:</strong>
      </p>
      <ul>
        <li>件名: 「アカウント削除希望」</li>
        <li>BON-LOG に登録したメールアドレス</li>
      </ul>
      <p>ご連絡をいただいた後、本人確認のうえ、アカウントを削除いたします。</p>

      <h2>削除されるデータ</h2>
      <p>アカウントを削除すると、以下のデータが削除されます。</p>
      <ul>
        <li>アカウント情報（メールアドレス、ニックネーム、プロフィール、生年月日など）</li>
        <li>認証情報（セッション情報、外部サービスとの連携情報）</li>
        <li>投稿・コメントおよびアップロードしたコンテンツ（画像・動画を含む）</li>
        <li>いいね、フォロー・フォロワー、ブックマーク、ブロック、ミュートの情報</li>
        <li>通知、ダイレクトメッセージ・会話への参加情報</li>
        <li>盆栽記録・手入れログ・カレンダー記録</li>
        <li>下書き・予約投稿</li>
        <li>アンケートへの投票記録</li>
        <li>盆栽園のレビュー</li>
        <li>プッシュ通知デバイス情報（モバイル・Webブラウザ）</li>
        <li>アクセス解析データ</li>
      </ul>
      <p>
        アップロードしたコンテンツはサービス上で削除され、アクセスできなくなります。バックアップやキャッシュなどの技術的仕組みにより、コンテンツが一時的にサーバー上に残存する場合がありますが、いずれ削除されます。
      </p>
      <p>
        また、他のユーザーがあなたの投稿を引用・リポストしていた場合、引用・リポストされたコンテンツの取り扱いは当該ユーザーの判断に委ねられます（利用規約 第11条）。
      </p>

      <h2>保持されるデータ</h2>
      <p>
        以下のデータは、法令に基づく保存義務および会計・不正防止の目的により、アカウント削除後も一定期間保持されます。
      </p>
      <ul>
        <li>
          <strong>決済・課金記録:</strong>{' '}
          有料会員として利用された際の決済記録は、あなたのアカウントとの紐付けを削除（匿名化）したうえで保持します。保持期間は、会計・税務上の法令に定められた保存期間に従います。
        </li>
      </ul>
      <p>
        上記以外の個人情報は、プライバシーポリシー 第5条に定めるとおり、アカウント削除後も「法令で定められた期間、または紛争解決に必要な期間」は一部の情報を保持する場合があります。
      </p>

      <h2>注意事項</h2>
      <p>アカウントの削除に関して、以下の点をご確認ください。</p>
      <ul>
        <li>
          削除は<strong>即時に確定</strong>されます。猶予期間はなく、削除操作のキャンセルや復元はできません。
        </li>
        <li>
          有料プレミアム会員の方は、削除前に解約手続きをお済ませいただくことを推奨します。解約については利用規約 第7条をご確認ください。
        </li>
      </ul>

      <h2>お問い合わせ</h2>
      <p>アカウント削除に関するご不明な点は、以下の窓口までお気軽にご連絡ください。</p>
      <ul>
        <li>
          <strong>メール:</strong>{' '}
          <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>
        </li>
        <li>
          <strong>Webサービス内のお問い合わせフォーム:</strong>{' '}
          <Link href={ROUTE_CONTACT} className="underline hover:text-foreground">
            お問い合わせ
          </Link>
        </li>
      </ul>
      <p>
        <strong>サービス提供者:</strong> {OPERATOR_NAME}
      </p>

      <div className="bg-muted rounded-lg p-4 not-prose mt-8">
        <p className="text-sm text-muted-foreground">
          アカウントを削除すると、すべてのデータが失われ、復元することはできません。削除を実行する前に、保存しておきたいデータをダウンロードまたはメモしてください。
        </p>
      </div>
    </article>
  )
}
