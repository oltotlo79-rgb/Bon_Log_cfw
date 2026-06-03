/**
 * @module components/ads/GoogleAdSense
 * NEXT_PUBLIC_ADSENSE_CLIENT_ID（ca-pub-xxxxx）で AdSense スクリプトを読み込む。
 */

import Script from 'next/script'

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
