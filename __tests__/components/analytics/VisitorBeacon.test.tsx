/**
 * @file VisitorBeacon の実ロジック検証テスト
 *
 * vitest.setup.tsx が window.localStorage を vi.fn() だけのモックに置き換えているため、
 * このテスト内では各メソッドを「Map ベースの挙動」に差し替えて永続性を再現する
 * (components/common/CookieConsent.test.tsx と同じパターン)。
 */
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import { render, act } from '@testing-library/react'
import { VisitorBeacon } from '@/components/analytics/VisitorBeacon'
import { COOKIE_CONSENT_CHANGE_EVENT } from '@/components/common/CookieConsent'

const STORAGE_KEY = 'cookie-consent'

function installLocalStorageMap(): Map<string, string> {
  const store = new Map<string, string>()
  const ls = window.localStorage
  ;(ls.getItem as ReturnType<typeof vi.fn>).mockImplementation((k: string) =>
    store.has(k) ? (store.get(k) ?? null) : null,
  )
  ;(ls.setItem as ReturnType<typeof vi.fn>).mockImplementation((k: string, v: string) => {
    store.set(k, v)
  })
  ;(ls.removeItem as ReturnType<typeof vi.fn>).mockImplementation((k: string) => {
    store.delete(k)
  })
  ;(ls.clear as ReturnType<typeof vi.fn>).mockImplementation(() => {
    store.clear()
  })
  return store
}

describe('VisitorBeacon', () => {
  let store: Map<string, string>

  beforeEach(() => {
    store = installLocalStorageMap()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('Cookie 未同意の場合、/api/analytics/track を呼び出さない', () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true })
    vi.stubGlobal('fetch', fetchMock)

    render(<VisitorBeacon />)

    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('必要最小限のみ (essential) 同意の場合、beacon を発火しない', () => {
    store.set(STORAGE_KEY, 'essential')
    const fetchMock = vi.fn().mockResolvedValue({ ok: true })
    vi.stubGlobal('fetch', fetchMock)

    render(<VisitorBeacon />)

    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('すべて同意 (all) 済みの場合、マウント時に /api/analytics/track へ POST する', () => {
    store.set(STORAGE_KEY, 'all')
    const fetchMock = vi.fn().mockResolvedValue({ ok: true })
    vi.stubGlobal('fetch', fetchMock)

    render(<VisitorBeacon />)

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('/api/analytics/track')
    expect(init.method).toBe('POST')
    expect(init.credentials).toBe('include')
    expect(init.keepalive).toBe(true)
  })

  it('未同意でマウント後、同タブで「すべて同意」イベントが発火すると beacon を送信する', () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true })
    vi.stubGlobal('fetch', fetchMock)

    render(<VisitorBeacon />)
    expect(fetchMock).not.toHaveBeenCalled()

    act(() => {
      store.set(STORAGE_KEY, 'all')
      window.dispatchEvent(new CustomEvent(COOKIE_CONSENT_CHANGE_EVENT))
    })

    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('他タブからの storage イベント（同意キー変更）でも同期して beacon を送信する', () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true })
    vi.stubGlobal('fetch', fetchMock)

    render(<VisitorBeacon />)
    expect(fetchMock).not.toHaveBeenCalled()

    act(() => {
      store.set(STORAGE_KEY, 'all')
      window.dispatchEvent(new StorageEvent('storage', { key: STORAGE_KEY }))
    })

    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('無関係なキーの storage イベントでは反応しない', () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true })
    vi.stubGlobal('fetch', fetchMock)

    render(<VisitorBeacon />)

    act(() => {
      store.set(STORAGE_KEY, 'all')
      window.dispatchEvent(new StorageEvent('storage', { key: 'unrelated-key' }))
    })

    // 対象外キーの storage イベントでは subscribe 内の callback が発火せず、
    // コンポーネントは再評価されないため fetch は呼ばれない
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('fetch が失敗しても例外を投げない（握りつぶす）', async () => {
    store.set(STORAGE_KEY, 'all')
    const fetchMock = vi.fn().mockRejectedValue(new Error('network error'))
    vi.stubGlobal('fetch', fetchMock)

    expect(() => {
      render(<VisitorBeacon />)
    }).not.toThrow()

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0))
    })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('null を返却しレンダリング内容を持たない', () => {
    const { container } = render(<VisitorBeacon />)
    expect(container).toBeEmptyDOMElement()
  })

  it('アンマウント時に storage / custom event の購読を解除する', () => {
    const addSpy = vi.spyOn(window, 'addEventListener')
    const removeSpy = vi.spyOn(window, 'removeEventListener')

    const { unmount } = render(<VisitorBeacon />)
    expect(addSpy).toHaveBeenCalledWith('storage', expect.any(Function))
    expect(addSpy).toHaveBeenCalledWith(COOKIE_CONSENT_CHANGE_EVENT, expect.any(Function))

    unmount()

    expect(removeSpy).toHaveBeenCalledWith('storage', expect.any(Function))
    expect(removeSpy).toHaveBeenCalledWith(COOKIE_CONSENT_CHANGE_EVENT, expect.any(Function))
  })
})
