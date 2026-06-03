/**
 * BON-LOG ルートレイアウト。
 * フォント・全体メタデータ・共通プロバイダ・広告スクリプトを束ねる。
 */

import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import "./globals.css";
import { Providers } from "./providers";
import { OrganizationJsonLd, WebSiteJsonLd } from "@/components/seo/JsonLd";
import { SkipLink } from "@/components/common/SkipLink";
import { CookieConsent } from "@/components/common/CookieConsent";
import { WebVitalsReporter } from "@/components/analytics/WebVitals";
import { VisitorBeacon } from "@/components/analytics/VisitorBeacon";
import { BASE_URL } from "@/lib/constants/routes";
import { BRAND_THEME_COLOR } from "@/lib/constants/theme";
import SakuraAnimation from "@/components/SakuraAnimation";
import { InkRippleInit } from "@/components/common/InkRippleInit";

const baseUrl = BASE_URL

export const metadata: Metadata = {
  title: {
    default: 'BON-LOG - 盆栽愛好家のためのコミュニティSNS',
    // 子ページ側でブランド込みの完全タイトルを供給する設計のため template は no-op に保つ。
    // template に '%s | BON-LOG' を入れると既存の admin ('... - BON-LOG 管理') / settings
    // ('... | BON-LOG') 等で二重ブランドになる。
    template: '%s',
  },
  description: '盆栽を愛する全ての人が集まり、知識や経験を共有できるSNSプラットフォーム。盆栽園マップ、イベント情報、コミュニティ機能を提供。',
  keywords: ['盆栽', 'SNS', 'コミュニティ', '盆栽園', 'イベント', '松柏', '雑木', '苔玉', '盆栽愛好家'],
  authors: [{ name: 'BON-LOG' }],
  creator: 'BON-LOG',
  publisher: 'BON-LOG',
  metadataBase: new URL(baseUrl),
  // canonical はページ単位で指定する。
  // ルートレイアウトに canonical を置くと、明示しない子ページも全て同じ
  // canonical を継承してしまい、検索エンジンが重複コンテンツと判定するリスクがある。
  alternates: {
    types: {
      'application/rss+xml': '/feed.xml',
    },
  },
  openGraph: {
    type: 'website',
    locale: 'ja_JP',
    url: baseUrl,
    siteName: 'BON-LOG',
    title: 'BON-LOG - 盆栽愛好家のためのコミュニティSNS',
    description: '盆栽を愛する全ての人が集まり、知識や経験を共有できるSNSプラットフォーム。',
    images: [
      {
        url: '/api/og',
        width: 1200,
        height: 630,
        alt: 'BON-LOG - 盆栽愛好家のためのコミュニティSNS',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'BON-LOG - 盆栽愛好家のためのコミュニティSNS',
    description: '盆栽を愛する全ての人が集まり、知識や経験を共有できるSNSプラットフォーム。',
    images: ['/api/og'],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  icons: {
    icon: [
      { url: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: '/apple-touch-icon.png',
  },
  manifest: '/site.webmanifest',
};

// Next.js 16 では width/initialScale/themeColor は viewport export 側で定義する。
// viewportFit: 'cover' は iOS safe-area（ノッチ端末）対応。
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: BRAND_THEME_COLOR },
    { media: '(prefers-color-scheme: dark)', color: BRAND_THEME_COLOR },
  ],
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // headers() を呼ぶことで全ルートが dynamic rendering に切り替わり、
  // proxy.ts が設定するリクエスト毎の CSP nonce を Next.js が SSR 時に
  // <script> タグへ適用できるようになる。
  //
  // Why this is necessary (Next.js 16):
  //   strict CSP (nonce + strict-dynamic) を使う場合、static prerendered な HTML には
  //   ビルド時固定の nonce しか入らず、リクエスト毎に変わる CSP の nonce と整合しないため
  //   全ての <script> がブラウザ側で blocked になり、ハイドレーションが失敗する
  //   (例: AnimatedInkImage が SSR placeholder の空 div のまま画像が表示されない)。
  //   `await headers()` で dynamic rendering を強制することで、SSR 時に proxy の
  //   リクエスト header から nonce を読み取り、生成する <script> 全てに付与される。
  //
  // Trade-off:
  //   SSG/CDN cache の最適化を失うが、strict CSP のセキュリティと機能維持を優先する。
  //   個別ページの cache が必要なら fetch / unstable_cache で個別に対応する。
  //
  // 公式ドキュメント: https://nextjs.org/docs/app/guides/content-security-policy
  await headers()

  return (
    // suppressHydrationWarning はテーマ切替時の hydration 警告を抑制するために必要。
    <html lang="ja" suppressHydrationWarning>
      <body
        className="font-sans antialiased"
      >
        <SakuraAnimation />
        <InkRippleInit />

        <SkipLink />
        <OrganizationJsonLd
          name="BON-LOG"
          url={baseUrl}
          logo={`${baseUrl}/logo.png`}
          description="盆栽愛好家のためのコミュニティSNS"
        />
        <WebSiteJsonLd
          name="BON-LOG"
          url={baseUrl}
          description="盆栽を愛する全ての人が集まり、知識や経験を共有できるSNSプラットフォーム。"
          searchUrl={`${baseUrl}/search`}
        />
        {/* PremiumProvider / AdProvider は (main)/layout.tsx に移動し、
            (auth)/(legal)/(public) など public route group の React ツリーに
            auth() 依存の Provider を持ち込まない (Next.js docs: Provider は深い位置に置く)。
            注: 静的最適化/CDN cache 自体は得られない。上の `await headers()` (CSP nonce) で
            全ルートが dynamic rendering になるため。個別ページの cache は unstable_cache で行う。 */}
        <Providers>{children}</Providers>
        <CookieConsent />
        <WebVitalsReporter />
        <VisitorBeacon />
      </body>
    </html>
  );
}
