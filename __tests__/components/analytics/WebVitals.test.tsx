import { vi } from 'vitest'
/**
 * WebVitals コンポーネントのテスト
 */

// useReportWebVitalsのモック
let capturedCallback: ((metric: unknown) => void) | null = null

vi.mock('next/web-vitals', () => ({
  useReportWebVitals: (callback: (metric: unknown) => void) => {
    capturedCallback = callback
  },
}))

import { render } from '../../utils/test-utils'
import { WebVitalsReporter } from '@/components/analytics/WebVitals'

describe('WebVitalsReporter', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    capturedCallback = null
  })

  it('nullをレンダリングする（UIなし）', () => {
    const { container } = render(<WebVitalsReporter />)
    expect(container.innerHTML).toBe('')
  })

  it('useReportWebVitalsにコールバックを登録する', () => {
    render(<WebVitalsReporter />)
    expect(capturedCallback).not.toBeNull()
  })

  it('LCPメトリクスを受け取ってもコンソールに出力しない', () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation()

    render(<WebVitalsReporter />)

    capturedCallback?.({
      name: 'LCP',
      value: 2000,
      rating: 'good',
      id: 'lcp-1',
      delta: 100,
      navigationType: 'navigate',
    })

    expect(consoleSpy).not.toHaveBeenCalled()

    consoleSpy.mockRestore()
  })

  it('CLSメトリクスを受け取ってもコンソールに出力しない', () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation()

    render(<WebVitalsReporter />)

    capturedCallback?.({
      name: 'CLS',
      value: 0.123456,
      rating: 'good',
      id: 'cls-1',
      delta: 0.01,
      navigationType: 'navigate',
    })

    expect(consoleSpy).not.toHaveBeenCalled()

    consoleSpy.mockRestore()
  })

  it('needs-improvementレーティングでもコンソールに出力しない', () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation()

    render(<WebVitalsReporter />)

    capturedCallback?.({
      name: 'FID',
      value: 200,
      rating: 'needs-improvement',
      id: 'fid-1',
      delta: 50,
      navigationType: 'navigate',
    })

    expect(consoleSpy).not.toHaveBeenCalled()

    consoleSpy.mockRestore()
  })

  it('poorレーティングでもコンソールに出力しない', () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation()

    render(<WebVitalsReporter />)

    capturedCallback?.({
      name: 'INP',
      value: 600,
      rating: 'poor',
      id: 'inp-1',
      delta: 100,
      navigationType: 'navigate',
    })

    expect(consoleSpy).not.toHaveBeenCalled()

    consoleSpy.mockRestore()
  })

  it('FCPメトリクスを受け取ってもコンソールに出力しない', () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation()

    render(<WebVitalsReporter />)

    capturedCallback?.({
      name: 'FCP',
      value: 1500.7,
      rating: 'good',
      id: 'fcp-1',
      delta: 50,
      navigationType: 'navigate',
    })

    expect(consoleSpy).not.toHaveBeenCalled()

    consoleSpy.mockRestore()
  })

  it('TTFBメトリクスを受け取ってもコンソールに出力しない', () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation()

    render(<WebVitalsReporter />)

    capturedCallback?.({
      name: 'TTFB',
      value: 800,
      rating: 'good',
      id: 'ttfb-1',
      delta: 10,
      navigationType: 'navigate',
    })

    expect(consoleSpy).not.toHaveBeenCalled()

    consoleSpy.mockRestore()
  })

  it('コールバック実行時にコンソールに出力しない（ログ削除確認）', () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation()

    render(<WebVitalsReporter />)

    capturedCallback?.({
      name: 'LCP',
      value: 3000,
      rating: 'needs-improvement',
      id: 'lcp-2',
      delta: 200,
      navigationType: 'reload',
    })

    expect(consoleSpy).not.toHaveBeenCalled()

    consoleSpy.mockRestore()
  })

  it('本番環境ではコンソールに出力しない', () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation()

    render(<WebVitalsReporter />)

    capturedCallback?.({
      name: 'LCP',
      value: 2000,
      rating: 'good',
      id: 'lcp-prod',
      delta: 100,
      navigationType: 'navigate',
    })

    expect(consoleSpy).not.toHaveBeenCalled()

    consoleSpy.mockRestore()
  })

  // ----- GA4 gtag 連携 -----

  it('gtag 未定義時はメトリクスを発火しても例外にならない', () => {
    delete (window as unknown as { gtag?: unknown }).gtag
    render(<WebVitalsReporter />)
    expect(() =>
      capturedCallback?.({ name: 'LCP', value: 1234.5, id: 'lcp-x', delta: 1234.5 }),
    ).not.toThrow()
  })

  it('gtag が定義されていれば event として送信する', () => {
    const gtag = vi.fn()
    ;(window as unknown as { gtag: typeof gtag }).gtag = gtag
    render(<WebVitalsReporter />)

    capturedCallback?.({ name: 'LCP', value: 2500.7, id: 'lcp-1', delta: 2500.7 })

    expect(gtag).toHaveBeenCalledTimes(1)
    expect(gtag).toHaveBeenCalledWith('event', 'LCP', expect.objectContaining({
      event_category: 'Web Vitals',
      // LCP は ms 指標: 四捨五入整数
      value: 2501,
      metric_id: 'lcp-1',
      metric_value: 2500.7,
      metric_delta: 2500.7,
      non_interaction: true,
    }))

    delete (window as unknown as { gtag?: unknown }).gtag
  })

  it('CLS は GA4 の整数慣習に合わせて 1000 倍して送信する', () => {
    const gtag = vi.fn()
    ;(window as unknown as { gtag: typeof gtag }).gtag = gtag
    render(<WebVitalsReporter />)

    capturedCallback?.({ name: 'CLS', value: 0.127, id: 'cls-1', delta: 0.127 })

    expect(gtag).toHaveBeenCalledWith('event', 'CLS', expect.objectContaining({
      value: 127, // 0.127 * 1000
    }))

    delete (window as unknown as { gtag?: unknown }).gtag
  })
})
