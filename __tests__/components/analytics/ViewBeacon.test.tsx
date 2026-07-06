import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import { render } from '@testing-library/react'
import { ViewBeacon } from '@/components/analytics/ViewBeacon'
import { ROUTE_API_ANALYTICS_VIEW } from '@/lib/constants/routes'

describe('ViewBeacon', () => {
  const originalSendBeacon = navigator.sendBeacon

  beforeEach(() => {
    vi.restoreAllMocks()
  })

  afterEach(() => {
    // navigator.sendBeacon をテストごとに元の状態へ戻す
    Object.defineProperty(navigator, 'sendBeacon', {
      value: originalSendBeacon,
      writable: true,
      configurable: true,
    })
  })

  it('sendBeacon が利用可能な場合、post 用の view イベントを1回だけ送信する', () => {
    const sendBeaconMock = vi.fn().mockReturnValue(true)
    Object.defineProperty(navigator, 'sendBeacon', {
      value: sendBeaconMock,
      writable: true,
      configurable: true,
    })

    render(<ViewBeacon type="post" postId="post-1" targetUserId="user-1" />)

    expect(sendBeaconMock).toHaveBeenCalledTimes(1)
    const [url, blob] = sendBeaconMock.mock.calls[0] as [string, Blob]
    expect(url).toBe(ROUTE_API_ANALYTICS_VIEW)
    expect(blob).toBeInstanceOf(Blob)
    expect(blob.type).toBe('application/json')
  })

  it('sendBeacon が利用可能な場合、profile 用の view イベントを送信する', () => {
    const sendBeaconMock = vi.fn().mockReturnValue(true)
    Object.defineProperty(navigator, 'sendBeacon', {
      value: sendBeaconMock,
      writable: true,
      configurable: true,
    })

    render(<ViewBeacon type="profile" targetUserId="user-2" />)

    expect(sendBeaconMock).toHaveBeenCalledTimes(1)
  })

  it('再レンダリングされても同一マウント中は1回しか送信しない（sentRef ガード）', () => {
    const sendBeaconMock = vi.fn().mockReturnValue(true)
    Object.defineProperty(navigator, 'sendBeacon', {
      value: sendBeaconMock,
      writable: true,
      configurable: true,
    })

    const { rerender } = render(<ViewBeacon type="post" postId="post-1" targetUserId="user-1" />)
    // props が変わっても sentRef.current は true のままなので再送信されない
    rerender(<ViewBeacon type="post" postId="post-1" targetUserId="user-1" />)

    expect(sendBeaconMock).toHaveBeenCalledTimes(1)
  })

  it('sendBeacon が未対応環境では fetch にフォールバックする', async () => {
    Object.defineProperty(navigator, 'sendBeacon', {
      value: undefined,
      writable: true,
      configurable: true,
    })
    const fetchMock = vi.fn().mockResolvedValue({ ok: true })
    vi.stubGlobal('fetch', fetchMock)

    render(<ViewBeacon type="post" postId="post-1" targetUserId="user-1" />)

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe(ROUTE_API_ANALYTICS_VIEW)
    expect(init.method).toBe('POST')
    expect(init.keepalive).toBe(true)
    expect(JSON.parse(init.body as string)).toEqual({
      type: 'post',
      postId: 'post-1',
      targetUserId: 'user-1',
    })

    vi.unstubAllGlobals()
  })

  it('fetch フォールバックが失敗しても例外を投げない（握りつぶす）', async () => {
    Object.defineProperty(navigator, 'sendBeacon', {
      value: undefined,
      writable: true,
      configurable: true,
    })
    const fetchMock = vi.fn().mockRejectedValue(new Error('network error'))
    vi.stubGlobal('fetch', fetchMock)

    expect(() => {
      render(<ViewBeacon type="profile" targetUserId="user-3" />)
    }).not.toThrow()

    // マイクロタスクの reject が処理されるのを待つ
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(fetchMock).toHaveBeenCalledTimes(1)

    vi.unstubAllGlobals()
  })

  it('null を返却しレンダリング内容を持たない', () => {
    Object.defineProperty(navigator, 'sendBeacon', {
      value: vi.fn().mockReturnValue(true),
      writable: true,
      configurable: true,
    })
    const { container } = render(<ViewBeacon type="profile" targetUserId="user-4" />)
    expect(container).toBeEmptyDOMElement()
  })
})
