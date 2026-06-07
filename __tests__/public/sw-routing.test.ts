// @vitest-environment node
/**
 * Service Worker (public/sw.js) の fetch ルーティング検証。
 *
 * 回帰防止の主眼: ドキュメントナビゲーション以外 (RSC / プリフェッチ等) を SW が
 * respondWith で横取りすると、fetch 失敗時に FetchEvent が network error 化し、
 * router.refresh() を待つ useTransition が固まる (コメント送信が「送信中…」のまま)。
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

type Handler = (event: unknown) => void

let fetchHandler: Handler

async function loadServiceWorker() {
  const handlers: Record<string, Handler[]> = {}
  vi.stubGlobal('self', {
    addEventListener: (type: string, cb: Handler) => {
      ;(handlers[type] ??= []).push(cb)
    },
    location: { origin: 'https://www.bon-log.com' },
    skipWaiting: vi.fn(),
    clients: { claim: vi.fn(), matchAll: vi.fn().mockResolvedValue([]), openWindow: vi.fn() },
    registration: { showNotification: vi.fn() },
  })
  vi.stubGlobal('caches', {
    open: vi.fn().mockResolvedValue({ put: vi.fn(), match: vi.fn().mockResolvedValue(undefined) }),
    match: vi.fn().mockResolvedValue(undefined),
    keys: vi.fn().mockResolvedValue([]),
    delete: vi.fn().mockResolvedValue(true),
  })
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok: true,
      headers: new Headers({ 'Cache-Control': 'public' }),
      clone() {
        return this
      },
    }),
  )
  vi.resetModules()
  await import('../../public/sw.js')
  fetchHandler = handlers.fetch![0]!
}

function dispatchFetch(
  url: string,
  opts: { method?: string; mode?: string; headers?: Record<string, string> } = {},
) {
  const respondWith = vi.fn()
  fetchHandler({
    request: {
      url,
      method: opts.method ?? 'GET',
      mode: opts.mode ?? 'navigate',
      headers: new Headers(opts.headers ?? {}),
    },
    respondWith,
  })
  return respondWith
}

const ORIGIN = 'https://www.bon-log.com'

beforeEach(async () => {
  vi.clearAllMocks()
  await loadServiceWorker()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('Service Worker fetch ルーティング', () => {
  it('ドキュメントナビゲーション (mode=navigate) の public ページは介入する', () => {
    const respondWith = dispatchFetch(`${ORIGIN}/posts/abc`, { mode: 'navigate' })
    expect(respondWith).toHaveBeenCalledTimes(1)
  })

  it('ナビゲーションでない GET (RSC / クライアント fetch) は介入しない', () => {
    const respondWith = dispatchFetch(`${ORIGIN}/posts/abc`, { mode: 'cors' })
    expect(respondWith).not.toHaveBeenCalled()
  })

  it('RSC ヘッダ付きリクエストは介入しない', () => {
    const respondWith = dispatchFetch(`${ORIGIN}/posts/abc`, {
      mode: 'cors',
      headers: { RSC: '1' },
    })
    expect(respondWith).not.toHaveBeenCalled()
  })

  it('network-only パス (/feed) はナビゲーションでも介入しない', () => {
    const respondWith = dispatchFetch(`${ORIGIN}/feed`, { mode: 'navigate' })
    expect(respondWith).not.toHaveBeenCalled()
  })

  it('静的アセット (_next/static の .js) はモードに関わらず介入する', () => {
    const respondWith = dispatchFetch(`${ORIGIN}/_next/static/chunks/main.js`, { mode: 'cors' })
    expect(respondWith).toHaveBeenCalledTimes(1)
  })

  it('GET 以外 (POST) は介入しない', () => {
    const respondWith = dispatchFetch(`${ORIGIN}/posts/abc`, { method: 'POST', mode: 'navigate' })
    expect(respondWith).not.toHaveBeenCalled()
  })
})
