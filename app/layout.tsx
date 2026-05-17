/**
 * BON-LOG ルートレイアウト。
 * フォント・全体メタデータ・共通プロバイダ・広告スクリプトを束ねる。
 */

import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Providers } from "./providers";
import { OrganizationJsonLd, WebSiteJsonLd } from "@/components/seo/JsonLd";
import { SkipLink } from "@/components/common/SkipLink";
import { CookieConsent } from "@/components/common/CookieConsent";
import { WebVitalsReporter } from "@/components/analytics/WebVitals";
import { VisitorBeacon } from "@/components/analytics/VisitorBeacon";
import { BASE_URL } from "@/lib/constants/routes";
import SakuraAnimation from "@/components/SakuraAnimation";
import { InkRippleInit } from "@/components/common/InkRippleInit";

const baseUrl = BASE_URL

export const metadata: Metadata = {
  title: {
    default: 'BON-LOG - 盆栽愛好家のためのコミュニティSNS',
    template: '%s - BON-LOG',
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
    { media: '(prefers-color-scheme: light)', color: '#0a0a0a' },
    { media: '(prefers-color-scheme: dark)', color: '#0a0a0a' },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
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
          searchUrl={`${baseUrl}/search?q=`}
        />
        {/* PremiumProvider / AdProvider は (main)/layout.tsx に移動。
            (auth)/(legal)/(public) など public route group では auth() 起因の動的化を避け、
            ビルド時静的最適化と CDN cache を維持する (Next.js docs: Provider は深い位置に置く)。 */}
        <Providers>{children}</Providers>
        <CookieConsent />
        <WebVitalsReporter />
        <VisitorBeacon />
      </body>
    </html>
  );
}
