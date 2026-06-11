/**
 * @module app/(public)/help/page
 * BON-LOG ヘルプセンター。FAQ をカテゴリ別アコーディオンで表示し、
 * よく使われる関連ページへのクイックリンクを並べる。
 */

import { Metadata } from 'next'
import Link from 'next/link'
import { ROUTE_TERMS, ROUTE_PRIVACY, ROUTE_SETTINGS_NOTIFICATIONS, ROUTE_HELP } from '@/lib/constants/routes'
import { pageCanonical } from '@/lib/utils/seo'
import { FaqPageJsonLd } from '@/components/seo'
import { ContactForm } from '@/components/contact/ContactForm'
import { ChevronRightIcon } from '@/components/help/HelpIcons'
import { HelpFaqSearch, type HelpSection } from '@/components/help/HelpFaqSearch'
import {
  MAX_POST_CONTENT_FREE,
  MAX_POST_CONTENT_PREMIUM,
  MAX_POST_IMAGES_FREE,
  MAX_POST_IMAGES_PREMIUM,
  MAX_POST_VIDEOS_PREMIUM,
  MAX_DAILY_POSTS_FREE,
  DAILY_COMMENT_LIMIT,
  MAX_GENRES_PER_POST,
} from '@/lib/constants/limits'

export const metadata: Metadata = {
  title: 'ヘルプ',
  description: 'BON-LOG（ボンログ）のヘルプページです。',
  alternates: { canonical: pageCanonical(ROUTE_HELP) },
}

const helpSections: HelpSection[] = [
  {
    title: 'はじめに',
    items: [
      {
        question: 'BON-LOGとは何ですか？',
        answer: 'BON-LOGは、盆栽愛好家のためのSNSプラットフォームです。盆栽の写真や情報を投稿・共有したり、他の愛好家と交流したり、盆栽園を探したりすることができます。',
      },
      {
        question: 'アカウントの作成方法は？',
        answer: 'トップページの「新規登録」ボタンから、メールアドレスとパスワードを入力してアカウントを作成できます。登録後、メールアドレスの確認が必要です。',
      },
      {
        question: 'ログインできない場合は？',
        answer: 'パスワードを忘れた場合は、ログイン画面の「パスワードをお忘れですか？」からパスワードリセットを行ってください。メールアドレスが間違っている場合は、登録時のメールアドレスをご確認ください。',
      },
    ],
  },
  {
    title: '投稿について',
    items: [
      {
        question: '投稿の文字数制限は？',
        answer: `無料会員は${MAX_POST_CONTENT_FREE}文字まで、有料会員（プレミアム）は${MAX_POST_CONTENT_PREMIUM}文字まで投稿できます。`,
      },
      {
        question: '画像や動画は何枚まで添付できますか？',
        answer: `無料会員は画像${MAX_POST_IMAGES_FREE}枚まで添付できます（動画の添付はプレミアム会員限定）。有料会員は画像${MAX_POST_IMAGES_PREMIUM}枚、動画${MAX_POST_VIDEOS_PREMIUM}本まで添付できます。`,
      },
      {
        question: '1日に何件まで投稿できますか？',
        answer: `投稿は1日${MAX_DAILY_POSTS_FREE}件まで、コメントは1日${DAILY_COMMENT_LIMIT}件までです。これはスパム防止のための制限です。`,
      },
      {
        question: '投稿を削除するには？',
        answer: '自分の投稿の右上にあるメニュー（...）から「削除」を選択してください。削除した投稿は復元できません。',
      },
      {
        question: 'ジャンルとは何ですか？',
        answer: `ジャンルは投稿のカテゴリーです。「松柏類」「雑木類」「道具」など、投稿内容に合ったジャンルを最大${MAX_GENRES_PER_POST}つまで選択できます。ジャンルを設定すると、興味のあるユーザーに発見されやすくなります。`,
      },
    ],
  },
  {
    title: 'プレミアム会員',
    items: [
      {
        question: 'プレミアム会員の特典は？',
        answer: `プレミアム会員になると、以下の特典があります：\n・投稿文字数が${MAX_POST_CONTENT_PREMIUM}文字に拡大\n・画像${MAX_POST_IMAGES_PREMIUM}枚、動画${MAX_POST_VIDEOS_PREMIUM}本まで添付可能（無料会員は動画添付不可）\n・予約投稿機能\n・投稿分析機能（いいね数、引用数、キーワード分析）\n・プレミアムバッジの表示`,
      },
      {
        question: '料金はいくらですか？',
        answer: '料金プランについては、設定画面の「プレミアム会員」からご確認ください。月額プランと年額プラン（お得）をご用意しています。',
      },
      {
        question: '支払い方法は？',
        answer: 'クレジットカード（Visa、Mastercard、American Express、JCB）でお支払いいただけます。決済は安全な決済代行会社（Stripe）を通じて処理されます。',
      },
      {
        question: '解約方法は？',
        answer: '設定画面の「サブスクリプション管理」からいつでも解約できます。解約しても、契約期間の終了日まではプレミアム機能をご利用いただけます。',
      },
      {
        question: '返金はありますか？',
        answer: '契約期間の途中で解約した場合、日割り計算による返金は行っておりません。ただし、当方の責に帰すべき事由によりサービスが提供できなかった場合は、返金対応いたします。',
      },
      {
        question: '無料トライアルはありますか？',
        answer: '新規のお客様には、無料トライアル期間を設けている場合があります。詳細は料金ページをご確認ください。トライアル期間中に解約した場合、料金は発生しません。',
      },
    ],
  },
  {
    title: 'プライバシーとセキュリティ',
    items: [
      {
        question: 'アカウントを非公開にするには？',
        answer: '設定画面の「プライバシー」から、アカウントを非公開に設定できます。非公開アカウントの投稿は、承認したフォロワーのみが閲覧できます。',
      },
      {
        question: '特定のユーザーをブロックするには？',
        answer: 'ブロックしたいユーザーのプロフィールページで、メニューから「ブロック」を選択してください。ブロックしたユーザーは、あなたの投稿を閲覧できなくなります。',
      },
      {
        question: 'ミュート機能とは？',
        answer: 'ミュートすると、そのユーザーの投稿がタイムラインに表示されなくなります。ブロックとは異なり、相手はあなたの投稿を引き続き閲覧できます。',
      },
      {
        question: 'パスワードを変更するには？',
        answer: '設定画面の「アカウント」から、現在のパスワードと新しいパスワードを入力して変更できます。',
      },
      {
        question: 'アカウントを削除するには？',
        answer: '設定画面の「アカウント」から、アカウントの削除を申請できます。削除すると、すべての投稿、コメント、いいねなどのデータが完全に削除され、復元できません。有料会員の場合は、事前に解約手続きを行ってください。',
      },
    ],
  },
  {
    title: '通知について',
    items: [
      {
        question: '通知にはどのような種類がありますか？',
        answer: 'BON-LOGでは以下の8種類の通知があります：\n・いいね：投稿にいいねされた時\n・コメント：投稿にコメントされた時\n・返信：コメントに返信された時\n・コメントいいね：コメントにいいねされた時\n・フォロー：フォローされた時\n・引用投稿：投稿が引用された時\n・フォローリクエスト：フォローリクエストを受けた時\n・フォロー承認：フォローリクエストが承認された時',
      },
      {
        question: '通知を停止するには？',
        answer: '設定ページの「通知設定」から、通知の種類ごとにON/OFFを切り替えることができます。OFFにした種類の通知は届かなくなります。',
      },
      {
        question: '特定の種類の通知だけを受け取りたい',
        answer: '設定 > 通知設定で、受け取りたい通知のみをONにし、不要な通知をOFFにしてください。例えば、フォロー通知だけをONにして、いいね通知はOFFにするといった設定が可能です。',
      },
      {
        question: '通知が届かない場合は？',
        answer: '以下をご確認ください：\n・設定 > 通知設定で該当の通知がOFFになっていないか\n・相手をミュートしていないか\n・ブロック関係になっていないか\nそれでも解決しない場合は、お問い合わせフォームからご連絡ください。',
      },
    ],
  },
  {
    title: 'イベント',
    items: [
      {
        question: 'イベントの探し方は？',
        answer: 'イベントページでは、カレンダー表示でイベントを確認できます。また、地域フィルター（都道府県・地方ブロック）を使って、お近くのイベントを絞り込むことができます。',
      },
      {
        question: 'イベントを登録するには？',
        answer: 'イベントページの「イベントを作成」ボタンから、イベント名、日時、場所、詳細などを入力して登録できます。',
      },
      {
        question: '過去のイベントは表示されますか？',
        answer: '終了したイベントは、デフォルトでは一覧に表示されません。過去のイベントを確認したい場合は、フィルターで「終了済み」を選択してください。',
      },
    ],
  },
  {
    title: 'ダイレクトメッセージ',
    items: [
      {
        question: 'メッセージの送り方は？',
        answer: '送りたいユーザーのプロフィールページにあるメッセージボタンをクリックするか、メッセージ一覧から新しい会話を作成してください。',
      },
      {
        question: 'メッセージを送れない場合は？',
        answer: '以下の場合、メッセージを送ることができません：\n・相手にブロックされている場合\n・相手をブロックしている場合\nブロックを解除すれば、再びメッセージのやり取りが可能になります。',
      },
    ],
  },
  {
    title: '盆栽育成記録',
    items: [
      {
        question: '盆栽記録とは？',
        answer: '盆栽育成記録は、あなたの盆栽の成長を記録・管理できる機能です。盆栽ごとに樹種、入手日、写真などを登録し、日々の手入れや成長の変化を記録できます。',
      },
      {
        question: '記録の付け方は？',
        answer: 'マイページの「盆栽記録」から盆栽を登録した後、各盆栽の詳細ページで記録を追加できます。水やり、剪定、植え替えなどの作業を記録しましょう。',
      },
      {
        question: '盆栽記録と投稿を連携できますか？',
        answer: '投稿作成時に、登録した盆栽を紐付けて投稿することができます。盆栽の成長過程を他のユーザーと共有する際に便利です。',
      },
    ],
  },
  {
    title: '盆栽園マップ',
    items: [
      {
        question: '盆栽園を登録するには？',
        answer: '盆栽園マップページの「盆栽園を登録」ボタンから、盆栽園の情報を入力して登録できます。住所を入力すると、自動的に地図上の位置が設定されます。',
      },
      {
        question: '登録した盆栽園の情報を編集するには？',
        answer: '自分が登録した盆栽園の詳細ページで、「編集」ボタンをクリックして情報を更新できます。他のユーザーが登録した盆栽園は編集できません。',
      },
      {
        question: 'レビューを投稿するには？',
        answer: '盆栽園の詳細ページで、星評価（1〜5）とコメントを入力してレビューを投稿できます。同じ盆栽園に複数のレビューを投稿することはできません。',
      },
      {
        question: '現在地から近い盆栽園を探すには？',
        answer: '盆栽園マップで、現在地ボタンをクリックすると、あなたの現在地に地図が移動します。位置情報の利用を許可する必要があります。',
      },
    ],
  },
  {
    title: 'その他',
    items: [
      {
        question: '不適切なコンテンツを報告するには？',
        answer: '投稿やコメントの右上にあるメニュー（...）から「報告」を選択し、報告理由を選んで送信してください。報告は匿名で処理されます。',
      },
      {
        question: 'お問い合わせ方法は？',
        answer: '本ページ下部のお問い合わせフォームからご連絡ください。通常、3営業日以内に回答いたします。',
      },
      {
        question: 'アプリはありますか？',
        answer: '現在、BON-LOGはWebブラウザからのみご利用いただけます。スマートフォンでもブラウザから快適にご利用いただけるよう最適化されています。',
      },
      {
        question: '2段階認証について',
        answer: '設定 > セキュリティ設定から、2段階認証（TOTP）を有効にできます。Google AuthenticatorやMicrosoft Authenticatorなどの認証アプリをご利用ください。バックアップコードも発行されますので、安全な場所に保管してください。',
      },
      {
        question: '下書き・予約投稿について',
        answer: '投稿作成画面で「下書き保存」を選ぶと、投稿を下書きとして保存できます。予約投稿はプレミアム会員限定の機能で、指定した日時に自動的に投稿が公開されます。',
      },
    ],
  },
]

// FAQPage 構造化データ用に helpSections をフラット化する。
// 表示と構造化データの単一の真実として使うことで Q&A 文言のズレを防ぐ。
const faqPairs = helpSections.flatMap((section) =>
  section.items.map((item) => ({ question: item.question, answer: item.answer })),
)

export default function HelpPage() {
  return (
    <div className="space-y-8">
      <FaqPageJsonLd faqs={faqPairs} />
      <div>
        <h1 className="text-3xl font-bold mb-2">ヘルプセンター</h1>
        <p className="text-muted-foreground">
          BON-LOGの使い方や、よくあるご質問についてご案内します。
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Link
          href="#premium"
          className="flex items-center justify-between p-4 bg-card border rounded-lg hover:bg-muted transition-colors"
        >
          <span className="font-medium">プレミアム会員について</span>
          <ChevronRightIcon className="w-5 h-5 text-muted-foreground" />
        </Link>
        <Link
          href={ROUTE_TERMS}
          className="flex items-center justify-between p-4 bg-card border rounded-lg hover:bg-muted transition-colors"
        >
          <span className="font-medium">利用規約</span>
          <ChevronRightIcon className="w-5 h-5 text-muted-foreground" />
        </Link>
        <Link
          href={ROUTE_PRIVACY}
          className="flex items-center justify-between p-4 bg-card border rounded-lg hover:bg-muted transition-colors"
        >
          <span className="font-medium">プライバシーポリシー</span>
          <ChevronRightIcon className="w-5 h-5 text-muted-foreground" />
        </Link>
        <Link
          href={ROUTE_SETTINGS_NOTIFICATIONS}
          className="flex items-center justify-between p-4 bg-card border rounded-lg hover:bg-muted transition-colors"
        >
          <span className="font-medium">通知設定</span>
          <ChevronRightIcon className="w-5 h-5 text-muted-foreground" />
        </Link>
      </div>
      <HelpFaqSearch sections={helpSections} />
      <section className="bg-muted/50 rounded-lg p-6">
        <h2 className="text-xl font-bold mb-2">お探しの答えが見つかりませんか？</h2>
        <p className="text-muted-foreground mb-4">
          ヘルプセンターで解決しない場合は、お問い合わせフォームからご連絡ください。
        </p>
        <div className="bg-card border rounded-lg p-6">
          <h3 className="font-semibold mb-4">お問い合わせフォーム</h3>
          <ContactForm />
        </div>
      </section>
    </div>
  )
}
