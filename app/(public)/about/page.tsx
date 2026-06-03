import { Metadata } from 'next'
import Link from 'next/link'
import {
  BASE_URL,
  ROUTE_ABOUT,
  ROUTE_CONTACT,
  ROUTE_DICTIONARY,
  ROUTE_FERTILIZERS,
  ROUTE_HELP,
  ROUTE_HORMONES,
  ROUTE_PESTICIDES,
  ROUTE_PESTICIDES_DISEASES_PESTS,
  ROUTE_PRIVACY,
  ROUTE_REGISTER,
  ROUTE_SHOPS,
  ROUTE_TERMS,
  ROUTE_TOKUSHOHO,
} from '@/lib/constants/routes'
import { safeJsonLdStringify } from '@/components/seo/utils'

export const metadata: Metadata = {
  title: 'BON-LOGについて｜盆栽SNS・盆栽辞典・農薬データベース',
  description:
    'BON-LOG（ボンログ）は、盆栽愛好家のためのSNSと、盆栽辞典・農薬データベース・病害虫情報・肥料ガイド・植物ホルモン解説などの独自コンテンツを組み合わせた総合プラットフォームです。農林水産省の公式データに基づく情報整備と、愛好家コミュニティの双方で、盆栽文化を次世代へ繋ぎます。',
  alternates: { canonical: `${BASE_URL}${ROUTE_ABOUT}` },
  openGraph: {
    title: 'BON-LOGについて',
    description:
      '盆栽SNSと盆栽辞典・農薬データベースを組み合わせた総合プラットフォーム。運営者情報と編集方針を公開しています。',
    url: `${BASE_URL}${ROUTE_ABOUT}`,
    type: 'website',
  },
}

type FeatureCardProps = {
  icon: React.ReactNode
  title: string
  description: string
}

function FeatureCard({ icon, title, description }: FeatureCardProps) {
  return (
    <div className="rounded-lg border bg-card p-6 shadow-sm">
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
        {icon}
      </div>
      <h3 className="mb-2 text-lg font-semibold">{title}</h3>
      <p className="text-muted-foreground">{description}</p>
    </div>
  )
}

type ContentCardProps = {
  href: string
  badge: string
  title: string
  description: string
}

function ContentCard({ href, badge, title, description }: ContentCardProps) {
  return (
    <Link
      href={href}
      className="group rounded-lg border bg-card p-6 shadow-sm transition hover:border-primary/50 hover:shadow-md"
    >
      <span className="mb-3 inline-block rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
        {badge}
      </span>
      <h3 className="mb-2 text-lg font-semibold group-hover:text-primary">{title}</h3>
      <p className="text-sm text-muted-foreground leading-relaxed">{description}</p>
    </Link>
  )
}

const FAQS: { q: string; a: string }[] = [
  {
    q: 'BON-LOGは誰が運営していますか？',
    a: '個人事業として野村侑矢が運営しています。運営者情報・連絡先は本ページ下部および「特定商取引法に基づく表記」ページに明記しています。お問い合わせは bon.log2026@gmail.com までお願いします。',
  },
  {
    q: 'BON-LOGは無料で利用できますか？',
    a: 'はい、投稿・コメント・フォロー・辞典閲覧・農薬検索などの基本機能はすべて無料でご利用いただけます。広告の非表示・予約投稿・詳細な投稿分析といった一部の拡張機能は、月額または年額のプレミアム会員で提供しています。',
  },
  {
    q: '農薬情報や病害虫情報はどのように整備されていますか？',
    a: '農林水産省（MAFF）の農薬登録情報を一次ソースとして参照し、製品名・有効成分・登録番号・適用病害虫・希釈倍率・使用回数などを体系化しています。FRAC／IRAC／HRACコードも併記し、薬剤抵抗性管理に活用できるように設計しています。シード投入前に `prisma/validation/` のスクリプトで公式データと突合する運用を行っています。',
  },
  {
    q: '投稿した写真や育成記録は他のユーザーに見られますか？',
    a: 'アカウントを「非公開」に設定することで、フォロワー以外からは投稿・盆栽記録・プロフィール詳細を閲覧できないよう制限できます。公開・非公開はいつでも切り替えが可能です。',
  },
  {
    q: '商業目的（盆栽園・園芸店）での利用は可能ですか？',
    a: 'はい、盆栽園・園芸店の事業者様は、店舗情報の登録、イベント告知、レビューの収集などにご活用いただけます。具体的な連携方法についてはお問い合わせフォームよりご相談ください。',
  },
  {
    q: '盆栽の育成は難しいと聞きますが、初心者でも使えますか？',
    a: '初心者向けに、盆栽辞典での用語解説、病害虫の見分け方ガイド、肥料の選び方、水やりの基本、植物ホルモンによる剪定・芽摘みの理論など、段階的に学べるコンテンツを公開しています。フィードで先輩愛好家の実践例を参考にするのもおすすめです。',
  },
]

const organizationLd = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: 'BON-LOG',
  alternateName: 'ボンログ',
  url: BASE_URL,
  logo: `${BASE_URL}/icon.png`,
  description:
    '盆栽愛好家のためのSNSと、盆栽辞典・農薬データベース・病害虫情報・肥料ガイド・植物ホルモン解説を提供する総合プラットフォーム。',
  founder: { '@type': 'Person', name: '野村侑矢' },
  foundingDate: '2026',
  email: 'bon.log2026@gmail.com',
  contactPoint: {
    '@type': 'ContactPoint',
    email: 'bon.log2026@gmail.com',
    contactType: 'customer support',
    areaServed: 'JP',
    availableLanguage: ['Japanese'],
  },
  sameAs: [] as string[],
}

const faqLd = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: FAQS.map(({ q, a }) => ({
    '@type': 'Question',
    name: q,
    acceptedAnswer: { '@type': 'Answer', text: a },
  })),
}

export default function AboutPage() {
  return (
    <div className="space-y-16">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: safeJsonLdStringify(organizationLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: safeJsonLdStringify(faqLd) }}
      />

      <section className="text-center">
        <h1 className="mb-4 text-4xl font-bold tracking-tight">BON-LOGについて</h1>
        <p className="mx-auto max-w-3xl text-lg text-muted-foreground leading-relaxed">
          盆栽愛好家のためのSNSと、盆栽辞典・農薬データベース・病害虫情報・肥料ガイド・植物ホルモン解説を組み合わせた、
          日本語圏で最も包括的な盆栽総合プラットフォームを目指しています。
        </p>
      </section>

      <section className="rounded-lg border bg-card p-8 space-y-4">
        <h2 className="text-2xl font-bold">サービス概要</h2>
        <p className="text-muted-foreground leading-loose">
          BON-LOG（ボンログ）は、盆栽を愛するすべての人々のために2026年に開始された、
          日本発の盆栽総合プラットフォームです。
          松柏類・雑木類・草もの・用品道具・施設イベントなどのジャンル別に整理された愛好家の投稿と、
          運営側で体系的に整備した辞典・農薬・病害虫・肥料・植物ホルモン情報を、
          ひとつのサービス内で横断的に参照できることが最大の特長です。
        </p>
        <p className="text-muted-foreground leading-loose">
          単なる交流型のSNSではなく、実際の盆栽育成の現場で生じる
          「この症状は何の病害虫か」「適用のある農薬はどれか」「この時期に与えるべき肥料は」
          「芽摘み・葉刈りは植物ホルモンのどのような働きを利用しているか」
          といった実務的な疑問に、一次ソースに基づいた情報で答えられることを目標に設計しています。
          趣味としての盆栽を長く続けるための知識基盤と、
          同じ興味を共有する仲間と出会える場所の両方を提供します。
        </p>
        <p className="text-muted-foreground leading-loose">
          日本の伝統文化である盆栽を、デジタル技術を用いて次世代へ繋ぎ、
          将来的には海外の愛好家も含めた国際的なコミュニティの基盤となることを視野に入れています。
        </p>
      </section>

      <section>
        <h2 className="mb-6 text-2xl font-bold text-center">私たちのミッション</h2>
        <div className="rounded-lg bg-primary/5 p-8 text-center space-y-4">
          <p className="text-2xl font-medium leading-relaxed">
            「盆栽の魅力を、正確な情報とともに、もっと多くの人へ」
          </p>
          <p className="text-muted-foreground leading-relaxed max-w-2xl mx-auto">
            盆栽の魅力は、写真や体験談だけでなく、背後にある園芸学・植物生理学・
            病害虫管理・土壌科学といった実践知によって支えられています。
            BON-LOGは感性と科学の両面から盆栽を支え、
            初心者が安心して始められ、熟練者が専門性を深められる場所であり続けます。
          </p>
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-2xl font-bold text-center">BON-LOGが提供する独自コンテンツ</h2>
        <p className="mb-8 text-center text-muted-foreground max-w-3xl mx-auto leading-relaxed">
          単なるSNSではなく、盆栽の育成・管理に役立つ独自に編集された専門コンテンツを公開しています。
          いずれも公式資料・専門書・一次ソースを参照し、継続的に更新・修正を行っています。
        </p>
        <div className="grid gap-6 md:grid-cols-2">
          <ContentCard
            href={ROUTE_DICTIONARY}
            badge="盆栽辞典"
            title="盆栽用語・樹種の体系的解説"
            description="「懸崖」「文人木」「取り木」といった盆栽特有の用語から、黒松・真柏・楓・皐月といった主要樹種の特徴・管理ポイントまで、体系的にまとめた辞典です。初心者が用語につまずかずに学べるよう、各項目にわかりやすい解説を付与しています。"
          />
          <ContentCard
            href={ROUTE_PESTICIDES}
            badge="農薬データベース"
            title="MAFF登録情報に基づく農薬検索"
            description="農林水産省（MAFF）の農薬登録情報を一次ソースとして、製品名・有効成分・登録番号・適用病害虫・希釈倍率・使用回数などを検索できます。FRAC／IRAC／HRACコード併記による薬剤抵抗性管理、希釈計算機、混用可否チェッカー、散布ガイドなど実用ツールも提供します。"
          />
          <ContentCard
            href={ROUTE_PESTICIDES_DISEASES_PESTS}
            badge="病害虫データベース"
            title="症状から病害虫を特定する"
            description="うどんこ病・黒星病・ハダニ・カイガラムシ・アブラムシ・葉枯病など、盆栽で遭遇しやすい病害虫を網羅。症状写真・発生時期・被害部位・対応農薬を整理し、発見から対処までを迅速に行えます。"
          />
          <ContentCard
            href={ROUTE_FERTILIZERS}
            badge="肥料ガイド"
            title="栄養素・欠乏症状・施肥スケジュール"
            description="N・P・Kを中心とした必須栄養素の役割、欠乏症状の見分け方、盆栽に適した肥料製品、季節ごとの施肥スケジュール、水やりとの関係、土壌の基本まで、盆栽の根本である「培養」の知識を一括で学べます。"
          />
          <ContentCard
            href={ROUTE_HORMONES}
            badge="植物ホルモン"
            title="剪定・芽摘みを理論で理解する"
            description="オーキシン・サイトカイニン・ジベレリン・エチレン・アブシジン酸の5大植物ホルモンの役割と、芽摘み・葉刈り・針金かけ・取り木などの盆栽技法がホルモン作用のどこに介入しているかを解説。シミュレーター・カレンダー・図解付き。"
          />
          <ContentCard
            href={ROUTE_SHOPS}
            badge="全国マップ"
            title="盆栽園・園芸店を地図から探す"
            description="全国の盆栽園・園芸店の位置情報・営業時間・取扱樹種・口コミを地図ベースで検索できます。訪れた際のレビュー投稿、イベント情報との連携により、盆栽を「出かけて楽しむ」体験を支援します。"
          />
        </div>
      </section>

      <section className="rounded-lg border bg-card p-8 space-y-4">
        <h2 className="text-2xl font-bold">編集方針と情報の信頼性</h2>
        <p className="text-muted-foreground leading-loose">
          BON-LOGが提供する辞典・農薬・病害虫・肥料・植物ホルモンの各コンテンツは、
          次のポリシーに従って整備しています。
        </p>
        <ul className="space-y-3 text-muted-foreground">
          <li className="leading-relaxed">
            <strong className="text-foreground">一次ソース主義：</strong>
            農薬情報は農林水産省（MAFF）の農薬登録情報検索システムを一次ソースとし、
            製品名・有効成分・登録番号・適用作物・使用時期・希釈倍率などを参照しています。
            生成AIの出力をそのまま掲載することはせず、公式データとの突合を必ず行います。
          </li>
          <li className="leading-relaxed">
            <strong className="text-foreground">検証プロセスの自動化：</strong>
            シードデータの投入前に、公式データベースとの差分を検出する検証スクリプト
            （<code className="text-xs rounded bg-muted px-1 py-0.5">prisma/validation/</code>）
            を実行し、登録番号・FRAC／IRACコード・含有量等の齟齬を機械的にチェックしています。
          </li>
          <li className="leading-relaxed">
            <strong className="text-foreground">誤りの訂正受付：</strong>
            農薬の適用や病害虫の記述に誤りを発見された場合、
            <Link href={ROUTE_CONTACT} className="text-primary hover:underline mx-1">お問い合わせフォーム</Link>
            よりご連絡ください。根拠となる一次ソースをご提示いただければ、可能な限り迅速に修正対応します。
          </li>
          <li className="leading-relaxed">
            <strong className="text-foreground">医療・安全情報の取り扱い：</strong>
            農薬の使用は製品ラベルに記載された用法・用量を遵守してください。
            BON-LOG掲載の情報は参考であり、最終的な使用可否の判断はラベル表示と関連法規に基づいて行ってください。
          </li>
          <li className="leading-relaxed">
            <strong className="text-foreground">ユーザー投稿との区別：</strong>
            運営が編集した辞典・データベース系ページと、
            ユーザーが自由に投稿できるSNS機能（フィード・投稿・コメント）は明確に区別しています。
            ユーザー投稿は投稿者の体験と見解であり、BON-LOGが内容の正確性を保証するものではありません。
          </li>
        </ul>
      </section>

      <section>
        <h2 className="mb-6 text-2xl font-bold text-center">主な機能</h2>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          <FeatureCard
            icon={
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
              </svg>
            }
            title="投稿・共有"
            description="盆栽の写真や動画を投稿し、育成記録や日々の様子を共有できます。ジャンル別に整理することで、見たい投稿を簡単に見つけられます。"
          />
          <FeatureCard
            icon={
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6">
                <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/>
                <circle cx="9" cy="7" r="4"/>
                <path d="M22 21v-2a4 4 0 0 0-3-3.87"/>
                <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
              </svg>
            }
            title="コミュニティ"
            description="フォロー機能やコメント機能で、他の愛好家と繋がりましょう。いいねやブックマークで気になる投稿を保存できます。"
          />
          <FeatureCard
            icon={
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6">
                <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/>
                <circle cx="12" cy="10" r="3"/>
              </svg>
            }
            title="盆栽園マップ"
            description="全国の盆栽園を地図から探せます。口コミやレビューを参考に、訪問先を計画しましょう。"
          />
          <FeatureCard
            icon={
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6">
                <rect width="18" height="18" x="3" y="4" rx="2" ry="2"/>
                <line x1="16" x2="16" y1="2" y2="6"/>
                <line x1="8" x2="8" y1="2" y2="6"/>
                <line x1="3" x2="21" y1="10" y2="10"/>
              </svg>
            }
            title="イベント情報"
            description="盆栽展示会や即売会などのイベント情報を掲載。地域や日程で絞り込んで、参加したいイベントを見つけられます。"
          />
          <FeatureCard
            icon={
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6">
                <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
              </svg>
            }
            title="プレミアム会員"
            description="広告非表示、予約投稿、投稿分析など、より便利な機能をご利用いただけます。"
          />
          <FeatureCard
            icon={
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6">
                <circle cx="11" cy="11" r="8"/>
                <path d="m21 21-4.3-4.3"/>
              </svg>
            }
            title="検索機能"
            description="キーワードやハッシュタグで投稿を検索。ユーザーや盆栽園も簡単に見つけられます。"
          />
        </div>
      </section>

      <section>
        <h2 className="mb-6 text-2xl font-bold text-center">よくあるご質問</h2>
        <div className="space-y-4 max-w-3xl mx-auto">
          {FAQS.map((faq) => (
            <details
              key={faq.q}
              className="group rounded-lg border bg-card p-5 shadow-sm open:shadow-md transition"
            >
              <summary className="cursor-pointer font-semibold text-base list-none flex items-start justify-between gap-4">
                <span>{faq.q}</span>
                <span className="text-primary transition-transform group-open:rotate-45 text-xl leading-none shrink-0">
                  +
                </span>
              </summary>
              <p className="mt-4 text-muted-foreground leading-relaxed">{faq.a}</p>
            </details>
          ))}
        </div>
      </section>

      <section className="rounded-lg border bg-card p-8">
        <h2 className="mb-6 text-2xl font-bold">運営情報</h2>
        <dl className="grid gap-6 sm:grid-cols-[max-content_1fr] sm:gap-x-8 sm:gap-y-4">
          <dt className="font-medium">サービス名</dt>
          <dd className="text-muted-foreground">BON-LOG（ボンログ）</dd>

          <dt className="font-medium">URL</dt>
          <dd className="text-muted-foreground break-all">{BASE_URL}</dd>

          <dt className="font-medium">運営者</dt>
          <dd className="text-muted-foreground">野村侑矢（個人事業）</dd>

          <dt className="font-medium">所在地</dt>
          <dd className="text-muted-foreground">
            日本国内。詳細住所は請求があった場合に遅滞なく開示いたします。
          </dd>

          <dt className="font-medium">サービス開始</dt>
          <dd className="text-muted-foreground">2026年</dd>

          <dt className="font-medium">事業内容</dt>
          <dd className="text-muted-foreground">
            盆栽SNSおよび盆栽関連情報データベース（辞典・農薬・病害虫・肥料・植物ホルモン）の運営、
            およびプレミアム会員サービスの提供
          </dd>

          <dt className="font-medium">お問い合わせ</dt>
          <dd className="text-muted-foreground">
            <a
              href="mailto:bon.log2026@gmail.com"
              className="text-primary hover:underline"
            >
              bon.log2026@gmail.com
            </a>
            <span className="mx-2">/</span>
            <Link href={ROUTE_CONTACT} className="text-primary hover:underline">
              お問い合わせフォーム
            </Link>
          </dd>

          <dt className="font-medium">関連ページ</dt>
          <dd className="text-muted-foreground space-x-3">
            <Link href={ROUTE_TOKUSHOHO} className="text-primary hover:underline">
              特定商取引法に基づく表記
            </Link>
            <Link href={ROUTE_PRIVACY} className="text-primary hover:underline">
              プライバシーポリシー
            </Link>
            <Link href={ROUTE_TERMS} className="text-primary hover:underline">
              利用規約
            </Link>
          </dd>
        </dl>
      </section>

      <section className="text-center">
        <h2 className="mb-4 text-2xl font-bold">BON-LOGを始めましょう</h2>
        <p className="mb-6 text-muted-foreground">
          あなたの盆栽ライフをより豊かにするために、今すぐ無料で登録
        </p>
        <div className="flex flex-wrap justify-center gap-4">
          <Link
            href={ROUTE_REGISTER}
            className="inline-flex items-center justify-center rounded-md bg-primary px-6 py-3 text-sm font-medium text-primary-foreground shadow hover:bg-primary/90"
          >
            無料で始める
          </Link>
          <Link
            href={ROUTE_DICTIONARY}
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-6 py-3 text-sm font-medium shadow-sm hover:bg-accent hover:text-accent-foreground"
          >
            盆栽辞典を見る
          </Link>
          <Link
            href={ROUTE_HELP}
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-6 py-3 text-sm font-medium shadow-sm hover:bg-accent hover:text-accent-foreground"
          >
            ヘルプを見る
          </Link>
        </div>
      </section>
    </div>
  )
}
