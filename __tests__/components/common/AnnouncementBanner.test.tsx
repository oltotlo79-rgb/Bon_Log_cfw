/**
 * AnnouncementBanner（Server Component）のテスト。
 *
 * - 公開中お知らせが取得できない場合は null
 * - type が 'banner' または 'both' のものだけが Client に渡される
 * - type が 'notification' のものはバナーには出さない
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from '@testing-library/react'

const mockGetActive = vi.fn()
vi.mock('@/lib/actions/announcement', () => ({
  getActiveAnnouncements: mockGetActive,
}))

const mockClientReceivedItems = vi.fn()
vi.mock('@/components/common/AnnouncementBannerClient', () => ({
  AnnouncementBannerClient: (props: { items: unknown[] }) => {
    mockClientReceivedItems(props.items)
    return <div data-testid="banner-client">{props.items.length}</div>
  },
}))

describe('AnnouncementBanner (server)', () => {
  beforeEach(() => {
    mockGetActive.mockReset()
    mockClientReceivedItems.mockReset()
  })

  it('お知らせが 0 件なら null を返す', async () => {
    mockGetActive.mockResolvedValue([])
    const { AnnouncementBanner } = await import('@/components/common/AnnouncementBanner')
    const ui = await AnnouncementBanner()
    expect(ui).toBeNull()
  })

  it("type が 'notification' のものだけなら null", async () => {
    mockGetActive.mockResolvedValue([
      { id: 'n1', title: 't', content: 'c', type: 'notification' },
    ])
    const { AnnouncementBanner } = await import('@/components/common/AnnouncementBanner')
    const ui = await AnnouncementBanner()
    expect(ui).toBeNull()
  })

  it("type が 'banner' / 'both' のものだけが Client に渡される", async () => {
    mockGetActive.mockResolvedValue([
      { id: 'a', title: 't1', content: 'c1', type: 'banner' },
      { id: 'b', title: 't2', content: 'c2', type: 'notification' },
      { id: 'c', title: 't3', content: 'c3', type: 'both' },
    ])
    const { AnnouncementBanner } = await import('@/components/common/AnnouncementBanner')
    const ui = await AnnouncementBanner()
    render(ui as React.ReactElement)
    expect(mockClientReceivedItems).toHaveBeenCalledTimes(1)
    const received = mockClientReceivedItems.mock.calls[0]?.[0] as { id: string }[]
    expect(received.map((x) => x.id)).toEqual(['a', 'c'])
  })
})
