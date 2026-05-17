import { vi } from 'vitest'
import { render, screen } from '@testing-library/react'

// Cookie同意を許可状態にモック（広告表示テストのため）
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

import {
  AdProvider,
  InFeedAdUnit,
  SidebarAdUnit,
  PostDetailAdUnit,
} from '@/components/ads/AdProvider'

describe('AdProvider', () => {
  const originalEnv = process.env.NEXT_PUBLIC_AD_PROVIDER

  afterEach(() => {
    process.env.NEXT_PUBLIC_AD_PROVIDER = originalEnv
  })

  it('returns null when NEXT_PUBLIC_AD_PROVIDER is not "adsense"', () => {
    process.env.NEXT_PUBLIC_AD_PROVIDER = ''
    const { container } = render(<AdProvider />)
    expect(container.innerHTML).toBe('')
  })

  it('renders GoogleAdSense when NEXT_PUBLIC_AD_PROVIDER is "adsense"', () => {
    process.env.NEXT_PUBLIC_AD_PROVIDER = 'adsense'
    render(<AdProvider />)
    expect(screen.getByTestId('google-adsense')).toBeInTheDocument()
  })
})

describe('InFeedAdUnit', () => {
  const originalEnv = process.env.NEXT_PUBLIC_AD_PROVIDER

  afterEach(() => {
    process.env.NEXT_PUBLIC_AD_PROVIDER = originalEnv
  })

  it('renders NinjaInFeedAd by default', () => {
    process.env.NEXT_PUBLIC_AD_PROVIDER = ''
    render(<InFeedAdUnit />)
    expect(screen.getByTestId('ninja-infeed')).toBeInTheDocument()
  })

  it('renders InFeedAd when provider is adsense', () => {
    process.env.NEXT_PUBLIC_AD_PROVIDER = 'adsense'
    render(<InFeedAdUnit />)
    expect(screen.getByTestId('adsense-infeed')).toBeInTheDocument()
  })
})

describe('SidebarAdUnit', () => {
  const originalEnv = process.env.NEXT_PUBLIC_AD_PROVIDER

  afterEach(() => {
    process.env.NEXT_PUBLIC_AD_PROVIDER = originalEnv
  })

  it('renders NinjaSidebarAd by default', () => {
    process.env.NEXT_PUBLIC_AD_PROVIDER = ''
    render(<SidebarAdUnit />)
    expect(screen.getByTestId('ninja-sidebar')).toBeInTheDocument()
  })

  it('renders SidebarAd when provider is adsense', () => {
    process.env.NEXT_PUBLIC_AD_PROVIDER = 'adsense'
    render(<SidebarAdUnit />)
    expect(screen.getByTestId('adsense-sidebar')).toBeInTheDocument()
  })
})

describe('PostDetailAdUnit', () => {
  const originalEnv = process.env.NEXT_PUBLIC_AD_PROVIDER

  afterEach(() => {
    process.env.NEXT_PUBLIC_AD_PROVIDER = originalEnv
  })

  it('renders NinjaAd by default', () => {
    process.env.NEXT_PUBLIC_AD_PROVIDER = ''
    render(<PostDetailAdUnit />)
    expect(screen.getByTestId('ninja-ad')).toBeInTheDocument()
  })

  it('renders AdBanner when provider is adsense', () => {
    process.env.NEXT_PUBLIC_AD_PROVIDER = 'adsense'
    render(<PostDetailAdUnit />)
    expect(screen.getByTestId('adsense-banner')).toBeInTheDocument()
  })
})
