/**
 * @module app/(mobile-legal)/mobile/android/help/page
 * Android アプリ版のヘルプページ。Native アプリのヘルプ導線から WebBrowser/Linking
 * で開かれる想定のため、ログイン不要・クロール可能な public ページとする。
 *
 * Google Play 決済ポリシー対応: プレミアム会員に関する記述は「購入・解約は
 * Google Play の定期購入管理から行う」旨のみに留め、Stripe・クレジットカード・
 * カードブランド・円建ての固定価格・無料トライアルの断定を含めない。
 * 本文はこのページ固有の UI コピーであり、共有ロジックではないため
 * lib/constants には配置していない。
 */

import { Metadata } from 'next'
import { FaqPageJsonLd } from '@/components/seo'
import { ROUTE_MOBILE_ANDROID_HELP } from '@/lib/constants/routes'
import { SUPPORT_EMAIL } from '@/lib/constants/contact'
import { pageCanonical } from '@/lib/utils/seo'
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

const HELP_UPDATED_AT = '2026-07-28'

export const metadata: Metadata = {
  title: 'ヘルプ（Androidアプリ版） | BON-LOG',
  description: 'BON-LOG Androidアプリ版のヘルプページです。基本的な使い方やよくあるご質問をご案内します。',
  alternates: { canonical: pageCanonical(ROUTE_MOBILE_ANDROID_HELP) },
}

type HelpFaqItem = {
  question: string
  answer: string
}

type HelpFaqGroup = {
  title: string
  items: HelpFaqItem[]
}

const helpFaqGroups: HelpFaqGroup[] = [
  {
    title: 'はじめに',
    items: [
      {
        question: 'BON-LOGとは何ですか？',
        answer: 'BON-LOGは、盆栽愛好家のためのSNSアプリです。盆栽の写真や育成記録を投稿・共有したり、他の愛好家と交流したり、盆栽園を探したりすることができます。',
      },
      {
        question: 'アカウントの作成方法は？',
        answer: 'アプリの新規登録画面から、メールアドレスとパスワード（またはGoogleアカウント連携）でアカウントを作成できます。登録後、メールアドレスの確認が必要です。',
      },
      {
        question: 'ログインできない場合は？',
        answer: 'パスワードを忘れた場合は、ログイン画面の「パスワードをお忘れですか？」からパスワードリセットを行ってください。',
      },
    ],
  },
  {
    title: '投稿・盆栽記録について',
    items: [
      {
        question: '投稿の文字数・画像枚数の上限は？',
        answer: `無料会員はテキスト${MAX_POST_CONTENT_FREE}文字まで・画像${MAX_POST_IMAGES_FREE}枚まで、プレミアム会員はテキスト${MAX_POST_CONTENT_PREMIUM}文字まで・画像${MAX_POST_IMAGES_PREMIUM}枚・動画${MAX_POST_VIDEOS_PREMIUM}本まで添付できます。`,
      },
      {
        question: '1日に投稿できる件数は？',
        answer: `投稿は1日${MAX_DAILY_POSTS_FREE}件まで、コメントは1日${DAILY_COMMENT_LIMIT}件までです。スパム防止のための制限です。`,
      },
      {
        question: 'ジャンルとは何ですか？',
        answer: `ジャンルは投稿のカテゴリーです。「松柏類」「雑木類」「用品・道具」など、投稿内容に合ったジャンルを最大${MAX_GENRES_PER_POST}つまで選択できます。`,
      },
      {
        question: '盆栽記録機能とは？',
        answer: 'あなたの盆栽の樹種・入手日・写真などを登録し、水やり・剪定・植え替えといった日々の手入れや成長の変化を記録できる機能です。投稿作成時に盆栽記録を紐付けることもできます。',
      },
    ],
  },
  {
    title: '検索・通知について',
    items: [
      {
        question: '投稿やユーザーを検索するには？',
        answer: '検索画面からキーワードを入力すると、投稿・ユーザー・ハッシュタグ・盆栽園などを横断して検索できます。',
      },
      {
        question: '通知にはどのような種類がありますか？',
        answer: 'いいね・コメント・返信・フォロー・引用投稿・フォローリクエストなど、複数種類の通知があります。設定画面の通知設定から、種類ごとにON/OFFを切り替えられます。',
      },
      {
        question: '通知が届かない場合は？',
        answer: '設定の通知設定で該当の通知がOFFになっていないか、相手をミュートまたはブロックしていないかをご確認ください。',
      },
    ],
  },
  {
    title: 'プレミアム会員',
    items: [
      {
        question: 'プレミアム会員の購入・解約はどこから行いますか？',
        answer: 'プレミアム会員の購入・変更・解約は、すべて Google Play の「お支払いと定期購入」の管理画面から行います。料金・請求サイクル等の詳細は Google Play のアプリ内商品ページの表示をご確認ください。',
      },
    ],
  },
  {
    title: 'お問い合わせ',
    items: [
      {
        question: '不適切なコンテンツを報告するには？',
        answer: '投稿やコメントのメニューから「報告」を選択し、理由を選んで送信してください。',
      },
      {
        question: 'その他のお問い合わせ方法は？',
        answer: `上記で解決しない場合は、${SUPPORT_EMAIL} までメールにてご連絡ください。`,
      },
    ],
  },
]

const faqPairs = helpFaqGroups.flatMap((group) =>
  group.items.map((item) => ({ question: item.question, answer: item.answer }))
)

export default function MobileAndroidHelpPage() {
  return (
    <div className="space-y-8">
      <FaqPageJsonLd faqs={faqPairs} />

      <div>
        <h1 className="text-2xl font-bold mb-2">ヘルプ</h1>
        <p className="text-muted-foreground text-sm">最終更新日: {HELP_UPDATED_AT}</p>
        <p className="text-muted-foreground mt-2">
          BON-LOG Androidアプリ版の使い方や、よくあるご質問についてご案内します。
        </p>
      </div>

      {helpFaqGroups.map((group) => (
        <section key={group.title} className="space-y-3">
          <h2 className="text-lg font-semibold">{group.title}</h2>
          <div className="space-y-2">
            {group.items.map((item) => (
              <details key={item.question} className="rounded-lg border bg-card p-4">
                <summary className="font-medium cursor-pointer">{item.question}</summary>
                <p className="mt-2 text-sm text-muted-foreground whitespace-pre-line">
                  {item.answer}
                </p>
              </details>
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}
