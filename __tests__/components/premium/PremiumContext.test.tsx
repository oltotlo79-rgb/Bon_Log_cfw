import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { PremiumContextProvider, usePremium } from '@/components/premium/PremiumContext'

vi.mock('@/components/common/CookieConsent', () => ({
  isTrackingAllowed: () => true,
  getCookieConsent: () => 'all',
}))

vi.mock('@/components/ads/AdBanner', () => ({
  AdBanner: () => <div data-testid="adsense-banner" />,
  InFeedAd: () => <div data-testid="adsense-infeed" />,
  SidebarAd: () => <div data-testid="adsense-sidebar" />,
}))

vi.mock('@/components/ads/NinjaAdMax', () => ({
  NinjaAd: () => <div data-testid="ninja-ad" />,
  NinjaInFeedAd: () => <div data-testid="ninja-infeed" />,
  NinjaSidebarAd: () => <div data-testid="ninja-sidebar" />,
}))

vi.mock('@/components/ads/GoogleAdSense', () => ({
  GoogleAdSense: () => <div data-testid="google-adsense" />,
}))

function Probe() {
  const isPremium = usePremium()
  return <div data-testid="probe">{String(isPremium)}</div>
}

describe('PremiumContext', () => {
  it('usePremium は Provider なしの場合 false を返す', () => {
    render(<Probe />)
    expect(screen.getByTestId('probe').textContent).toBe('false')
  })

  it('PremiumContextProvider isPremium=true を Context 経由で共有する', () => {
    render(
      <PremiumContextProvider isPremium={true}>
        <Probe />
      </PremiumContextProvider>,
    )
    expect(screen.getByTestId('probe').textContent).toBe('true')
  })

  it('PremiumContextProvider isPremium=false を明示的に渡せる', () => {
    render(
      <PremiumContextProvider isPremium={false}>
        <Probe />
      </PremiumContextProvider>,
    )
    expect(screen.getByTestId('probe').textContent).toBe('false')
  })
})

describe('Premium 会員は広告非表示', () => {
  const originalEnv = process.env.NEXT_PUBLIC_AD_PROVIDER

  afterEach(() => {
    process.env.NEXT_PUBLIC_AD_PROVIDER = originalEnv
  })

  it('InFeedAdUnit: Premium なら null を返す', async () => {
    process.env.NEXT_PUBLIC_AD_PROVIDER = ''
    const { InFeedAdUnit } = await import('@/components/ads/AdProvider')
    const { container } = render(
      <PremiumContextProvider isPremium={true}>
        <InFeedAdUnit />
      </PremiumContextProvider>,
    )
    expect(container.innerHTML).toBe('')
  })

  it('SidebarAdUnit: Premium なら null を返す', async () => {
    process.env.NEXT_PUBLIC_AD_PROVIDER = ''
    const { SidebarAdUnit } = await import('@/components/ads/AdProvider')
    const { container } = render(
      <PremiumContextProvider isPremium={true}>
        <SidebarAdUnit />
      </PremiumContextProvider>,
    )
    expect(container.innerHTML).toBe('')
  })

  it('PostDetailAdUnit: Premium なら null を返す', async () => {
    process.env.NEXT_PUBLIC_AD_PROVIDER = ''
    const { PostDetailAdUnit } = await import('@/components/ads/AdProvider')
    const { container } = render(
      <PremiumContextProvider isPremium={true}>
        <PostDetailAdUnit />
      </PremiumContextProvider>,
    )
    expect(container.innerHTML).toBe('')
  })

  it('AdProvider (script loader): Premium なら null を返す', async () => {
    process.env.NEXT_PUBLIC_AD_PROVIDER = 'adsense'
    const { AdProvider } = await import('@/components/ads/AdProvider')
    const { container } = render(
      <PremiumContextProvider isPremium={true}>
        <AdProvider />
      </PremiumContextProvider>,
    )
    expect(container.innerHTML).toBe('')
  })

  it('InFeedAdSlot: Premium なら null（aside も描画されない）', async () => {
    const { InFeedAdSlot } = await import('@/components/ads/InFeedAdSlot')
    const { container } = render(
      <PremiumContextProvider isPremium={true}>
        <InFeedAdSlot index={2} total={10} interval={3} />
      </PremiumContextProvider>,
    )
    expect(container.innerHTML).toBe('')
  })

  it('無料会員 (Provider なし) は広告が描画される', async () => {
    process.env.NEXT_PUBLIC_AD_PROVIDER = ''
    const { InFeedAdUnit } = await import('@/components/ads/AdProvider')
    render(<InFeedAdUnit />)
    expect(screen.getByTestId('ninja-infeed')).toBeInTheDocument()
  })
})
