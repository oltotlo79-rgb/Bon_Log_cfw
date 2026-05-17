import { vi } from 'vitest'
import { render } from '../../utils/test-utils'
import { GoogleAdSense } from '@/components/ads/GoogleAdSense'

// next/script モック
vi.mock('next/script', () => ({
  __esModule: true,
  default: ({ id, src, strategy, crossOrigin }: {
    id: string
    src: string
    strategy: string
    crossOrigin: string
  }) => (
    // eslint-disable-next-line @next/next/no-sync-scripts
    <script
      id={id}
      src={src}
      data-strategy={strategy}
      data-crossorigin={crossOrigin}
    />
  ),
}))

describe('GoogleAdSense', () => {
  const originalEnv = process.env

  beforeEach(() => {
    vi.resetModules()
    process.env = { ...originalEnv }
  })

  afterAll(() => {
    process.env = originalEnv
  })

  it('AdSenseスクリプトを表示する', () => {
    const { container } = render(<GoogleAdSense />)

    const script = container.querySelector('script#google-adsense')
    expect(script).toBeInTheDocument()
  })

  it('デフォルトのクライアントIDを使用する', () => {
    const { container } = render(<GoogleAdSense />)

    const script = container.querySelector('script#google-adsense')
    expect(script).toHaveAttribute(
      'src',
      'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-7644314630384219'
    )
  })

  it('afterInteractive戦略を使用する', () => {
    const { container } = render(<GoogleAdSense />)

    const script = container.querySelector('script#google-adsense')
    expect(script).toHaveAttribute('data-strategy', 'afterInteractive')
  })

  it('crossOrigin属性を設定する', () => {
    const { container } = render(<GoogleAdSense />)

    const script = container.querySelector('script#google-adsense')
    expect(script).toHaveAttribute('data-crossorigin', 'anonymous')
  })

  it('IDをgoogle-adsenseに設定する', () => {
    const { container } = render(<GoogleAdSense />)

    const script = container.querySelector('script#google-adsense')
    expect(script).toBeInTheDocument()
  })
})
