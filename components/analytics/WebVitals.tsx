/**
 * Web Vitals 監視コンポーネント。
 *
 * Core Web Vitals（LCP, CLS, INP, FCP, TTFB）を計測し、
 * `NEXT_PUBLIC_GA_ID` が有効化された環境では GA4 の `web-vitals` イベントとして送信する。
 * GA4 未初期化 or 未同意時は無言で no-op。
 *
 * @see https://web.dev/vitals/
 * @see https://nextjs.org/docs/app/api-reference/functions/use-report-web-vitals
 *
 * @module components/analytics/WebVitals
 */

'use client'

import { useReportWebVitals } from 'next/web-vitals'

/**
 * `next/web-vitals` が公開している `Metric` 型は内部パス参照のため、
 * `useReportWebVitals` のコールバック引数から推論して再利用する。
 */
type WebVitalsMetric = Parameters<Parameters<typeof useReportWebVitals>[0]>[0]

/** GA4 の `gtag` 関数。Window 拡張せず module-level に declare して安全に narrowing する。 */
type Gtag = (
  command: 'event',
  name: string,
  params: Record<string, unknown>,
) => void

declare global {
  interface Window {
    gtag?: Gtag
  }
}

/**
 * 単一メトリクスを GA4 に送信する。
 * CLS は 0〜1 の浮動小数なので GA4 の数値指標に合わせて 1000 倍した整数にする慣習に従う。
 * それ以外（ms 指標）は四捨五入して整数化する。
 */
function sendToGA(metric: WebVitalsMetric): void {
  if (typeof window === 'undefined') return
  const gtag = window.gtag
  if (typeof gtag !== 'function') return

  const value = metric.name === 'CLS' ? Math.round(metric.value * 1000) : Math.round(metric.value)

  gtag('event', metric.name, {
    event_category: 'Web Vitals',
    value,
    metric_id: metric.id,
    metric_value: metric.value,
    metric_delta: metric.delta,
    non_interaction: true,
  })
}

export function WebVitalsReporter() {
  useReportWebVitals((metric) => {
    sendToGA(metric)
  })

  return null
}
