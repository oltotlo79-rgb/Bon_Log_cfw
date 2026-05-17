import { render } from '@testing-library/react'

vi.mock('@/components/ads/AdProvider', () => ({
  InFeedAdUnit: ({ className }: { className?: string }) => (
    <div data-testid="in-feed-ad-unit" className={className} />
  ),
}))

import { InFeedAdSlot } from '@/components/ads/InFeedAdSlot'
import { MAX_IN_FEED_ADS_PER_PAGE } from '@/lib/constants/limits/ads'

const getAds = (container: HTMLElement) =>
  container.querySelectorAll('[data-testid="in-feed-ad-unit"]')

describe('InFeedAdSlot', () => {
  it('renders nothing when position is not a multiple of interval', () => {
    const { container } = render(
      <InFeedAdSlot index={0} total={10} interval={5} />,
    )
    expect(getAds(container)).toHaveLength(0)
  })

  it('renders an ad at the Nth position when not the last item', () => {
    const { container } = render(
      <InFeedAdSlot index={4} total={10} interval={5} />,
    )
    expect(getAds(container)).toHaveLength(1)
  })

  it('does not render at the list tail to avoid trailing ads', () => {
    const { container } = render(
      <InFeedAdSlot index={4} total={5} interval={5} />,
    )
    expect(getAds(container)).toHaveLength(0)
  })

  it('does not render beyond the tail (defensive)', () => {
    const { container } = render(
      <InFeedAdSlot index={9} total={5} interval={5} />,
    )
    expect(getAds(container)).toHaveLength(0)
  })

  it('caps the number of ads at maxAds', () => {
    const renderAt = (index: number) =>
      render(
        <InFeedAdSlot index={index} total={100} interval={5} maxAds={2} />,
      )
    expect(getAds(renderAt(4).container)).toHaveLength(1)
    expect(getAds(renderAt(9).container)).toHaveLength(1)
    expect(getAds(renderAt(14).container)).toHaveLength(0)
    expect(getAds(renderAt(19).container)).toHaveLength(0)
  })

  it('applies MAX_IN_FEED_ADS_PER_PAGE as the default cap', () => {
    const lastAllowed = MAX_IN_FEED_ADS_PER_PAGE * 5 - 1
    const firstBlocked = MAX_IN_FEED_ADS_PER_PAGE * 5 + 4
    expect(
      getAds(
        render(
          <InFeedAdSlot index={lastAllowed} total={100} interval={5} />,
        ).container,
      ),
    ).toHaveLength(1)
    expect(
      getAds(
        render(
          <InFeedAdSlot index={firstBlocked} total={100} interval={5} />,
        ).container,
      ),
    ).toHaveLength(0)
  })

  it('returns null for invalid interval (< 1)', () => {
    const { container } = render(
      <InFeedAdSlot index={4} total={10} interval={0} />,
    )
    expect(getAds(container)).toHaveLength(0)
  })

  it('wraps the ad in an aside with an accessible label', () => {
    const { container } = render(
      <InFeedAdSlot index={4} total={10} interval={5} />,
    )
    const aside = container.querySelector('aside')
    expect(aside).not.toBeNull()
    expect(aside?.getAttribute('aria-label')).toBe('広告')
  })

  it('applies className to the aside container (useful for grid col-span)', () => {
    const { container } = render(
      <InFeedAdSlot
        index={4}
        total={10}
        interval={5}
        className="col-span-full"
      />,
    )
    expect(container.querySelector('aside')).toHaveClass('col-span-full')
  })
})
