import { vi } from 'vitest'
import { render, screen } from '../../utils/test-utils'
import { AdBanner, InFeedAd, SidebarAd } from '@/components/ads/AdBanner'

describe('AdBanner', () => {
  const originalEnv = process.env

  beforeEach(() => {
    vi.resetModules()
    process.env = { ...originalEnv }
  })

  afterAll(() => {
    process.env = originalEnv
  })

  describe('プレースホルダー表示', () => {
    it('clientIdがない場合はプレースホルダーを表示する', () => {
      delete process.env.NEXT_PUBLIC_ADSENSE_CLIENT_ID
      render(<AdBanner adSlot="1234567890" />)

      expect(screen.getByText('広告スペース')).toBeInTheDocument()
    })

    it('adSlotがない場合はプレースホルダーを表示する', () => {
      process.env.NEXT_PUBLIC_ADSENSE_CLIENT_ID = 'ca-pub-test'
      render(<AdBanner />)

      expect(screen.getByText('広告スペース')).toBeInTheDocument()
    })

    it('showPlaceholderがtrueの場合はプレースホルダーを表示する', () => {
      process.env.NEXT_PUBLIC_ADSENSE_CLIENT_ID = 'ca-pub-test'
      render(<AdBanner adSlot="1234567890" showPlaceholder />)

      expect(screen.getByText('広告スペース')).toBeInTheDocument()
    })

    it('プレースホルダーにサイズ情報を表示する', () => {
      render(<AdBanner size="rectangle" />)

      expect(screen.getByText('rectangle')).toBeInTheDocument()
    })

    it('プレースホルダーにレスポンシブサイズを表示する', () => {
      render(<AdBanner size="responsive" />)

      expect(screen.getByText('responsive')).toBeInTheDocument()
    })
  })

  describe('AdSense広告表示', () => {
    beforeEach(() => {
      process.env.NEXT_PUBLIC_ADSENSE_CLIENT_ID = 'ca-pub-test'
      window.adsbygoogle = []
    })

    it('clientIdとadSlotがある場合はins要素を表示する', () => {
      const { container } = render(<AdBanner adSlot="1234567890" />)

      const ins = container.querySelector('ins.adsbygoogle')
      expect(ins).toBeInTheDocument()
    })

    it('data-ad-client属性を設定する', () => {
      const { container } = render(<AdBanner adSlot="1234567890" />)

      const ins = container.querySelector('ins.adsbygoogle')
      expect(ins).toHaveAttribute('data-ad-client', 'ca-pub-test')
    })

    it('data-ad-slot属性を設定する', () => {
      const { container } = render(<AdBanner adSlot="1234567890" />)

      const ins = container.querySelector('ins.adsbygoogle')
      expect(ins).toHaveAttribute('data-ad-slot', '1234567890')
    })

    it('data-ad-format属性をデフォルトでautoに設定する', () => {
      const { container } = render(<AdBanner adSlot="1234567890" />)

      const ins = container.querySelector('ins.adsbygoogle')
      expect(ins).toHaveAttribute('data-ad-format', 'auto')
    })

    it('data-ad-format属性をfluidに設定できる', () => {
      const { container } = render(<AdBanner adSlot="1234567890" format="fluid" />)

      const ins = container.querySelector('ins.adsbygoogle')
      expect(ins).toHaveAttribute('data-ad-format', 'fluid')
    })

    it('responsiveサイズでdata-full-width-responsiveをtrueに設定する', () => {
      const { container } = render(<AdBanner adSlot="1234567890" size="responsive" />)

      const ins = container.querySelector('ins.adsbygoogle')
      expect(ins).toHaveAttribute('data-full-width-responsive', 'true')
    })

    it('rectangleサイズでdata-full-width-responsiveをfalseに設定する', () => {
      const { container } = render(<AdBanner adSlot="1234567890" size="rectangle" />)

      const ins = container.querySelector('ins.adsbygoogle')
      expect(ins).toHaveAttribute('data-full-width-responsive', 'false')
    })
  })

  describe('サイズスタイル', () => {
    it('rectangleサイズで300x250pxを設定する', () => {
      const { container } = render(<AdBanner showPlaceholder size="rectangle" />)

      const placeholder = container.firstChild as HTMLElement
      expect(placeholder).toHaveStyle({ width: '300px', minHeight: '250px' })
    })

    it('large-rectangleサイズで336x280pxを設定する', () => {
      const { container } = render(<AdBanner showPlaceholder size="large-rectangle" />)

      const placeholder = container.firstChild as HTMLElement
      expect(placeholder).toHaveStyle({ width: '336px', minHeight: '280px' })
    })

    it('leaderboardサイズで728x90pxを設定する', () => {
      const { container } = render(<AdBanner showPlaceholder size="leaderboard" />)

      const placeholder = container.firstChild as HTMLElement
      expect(placeholder).toHaveStyle({ width: '728px', minHeight: '90px' })
    })

    it('mobile-bannerサイズで320x100pxを設定する', () => {
      const { container } = render(<AdBanner showPlaceholder size="mobile-banner" />)

      const placeholder = container.firstChild as HTMLElement
      expect(placeholder).toHaveStyle({ width: '320px', minHeight: '100px' })
    })

    it('half-pageサイズで300x600pxを設定する', () => {
      const { container } = render(<AdBanner showPlaceholder size="half-page" />)

      const placeholder = container.firstChild as HTMLElement
      expect(placeholder).toHaveStyle({ width: '300px', minHeight: '600px' })
    })

    it('responsiveサイズで幅100%を設定する', () => {
      const { container } = render(<AdBanner showPlaceholder size="responsive" />)

      const placeholder = container.firstChild as HTMLElement
      expect(placeholder).toHaveStyle({ width: '100%', minHeight: '100px' })
    })

    it('in-feedサイズで幅100%を設定する', () => {
      const { container } = render(<AdBanner showPlaceholder size="in-feed" />)

      const placeholder = container.firstChild as HTMLElement
      expect(placeholder).toHaveStyle({ width: '100%', minHeight: '120px' })
    })
  })

  describe('カスタムクラス', () => {
    it('カスタムクラスを追加できる', () => {
      const { container } = render(<AdBanner showPlaceholder className="custom-class" />)

      expect(container.firstChild).toHaveClass('custom-class')
    })
  })
})

describe('InFeedAd', () => {
  it('py-4クラスを適用する', () => {
    const { container } = render(<InFeedAd />)

    expect(container.firstChild).toHaveClass('py-4')
  })

  it('AdBannerをin-feedサイズで表示する', () => {
    render(<InFeedAd />)

    expect(screen.getByText('in-feed')).toBeInTheDocument()
  })

  it('カスタムクラスを追加できる', () => {
    const { container } = render(<InFeedAd className="custom-class" />)

    expect(container.firstChild).toHaveClass('custom-class')
  })

  it('adSlotを渡せる', () => {
    const originalEnv = process.env
    process.env.NEXT_PUBLIC_ADSENSE_CLIENT_ID = 'ca-pub-test'
    window.adsbygoogle = []

    const { container } = render(<InFeedAd adSlot="test-slot" />)

    const ins = container.querySelector('ins.adsbygoogle')
    expect(ins).toHaveAttribute('data-ad-slot', 'test-slot')

    process.env = originalEnv
  })
})

describe('SidebarAd', () => {
  it('AdBannerをrectangleサイズで表示する', () => {
    render(<SidebarAd />)

    expect(screen.getByText('rectangle')).toBeInTheDocument()
  })

  it('カスタムクラスを追加できる', () => {
    const { container } = render(<SidebarAd className="custom-class" />)

    expect(container.firstChild).toHaveClass('custom-class')
  })

  it('adSlotを渡せる', () => {
    const originalEnv = process.env
    process.env.NEXT_PUBLIC_ADSENSE_CLIENT_ID = 'ca-pub-test'
    window.adsbygoogle = []

    const { container } = render(<SidebarAd adSlot="test-slot" />)

    const ins = container.querySelector('ins.adsbygoogle')
    expect(ins).toHaveAttribute('data-ad-slot', 'test-slot')

    process.env = originalEnv
  })
})
