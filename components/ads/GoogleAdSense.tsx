/**
 * @file GoogleAdSense.tsx
 * @description Google AdSenseスクリプトローダーコンポーネント
 *
 * このコンポーネントは、Google AdSenseの広告配信に必要なスクリプトを
 * ページに読み込むためのコンポーネントです。ルートレイアウトのhead内に配置して使用します。
 *
 * @features
 * - AdSenseスクリプトのSSR対応（HTMLソースに直接出力）
 * - 環境変数による有効/無効の切り替え
 * - クロスオリジン対応
 *
 * @usage
 * ```tsx
 * // app/layout.tsx に配置
 * import { GoogleAdSense } from '@/components/ads/GoogleAdSense'
 *
 * export default function RootLayout({ children }) {
 *   return (
 *     <html>
 *       <head>
 *         <GoogleAdSense />
 *       </head>
 *       <body>
 *         {children}
 *       </body>
 *     </html>
 *   )
 * }
 * ```
 *
 * @env
 * - NEXT_PUBLIC_ADSENSE_CLIENT_ID: AdSenseのクライアントID（ca-pub-xxxxx形式）
 */

import Script from 'next/script'

/**
 * Google AdSenseスクリプトローダーコンポーネント
 *
 * AdSenseの広告配信スクリプトをページに読み込む。
 * Next.jsのScriptコンポーネントを使用してSSR対応。
 *
 * @returns AdSenseスクリプトタグ
 */
export function GoogleAdSense() {
  const clientId = process.env.NEXT_PUBLIC_ADSENSE_CLIENT_ID || 'ca-pub-7644314630384219'

  return (
    <Script
      id="google-adsense"
      src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${clientId}`}
      strategy="afterInteractive"
      crossOrigin="anonymous"
    />
  )
}
