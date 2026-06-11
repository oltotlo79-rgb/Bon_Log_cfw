/**
 * CSP nonce 伝搬の回帰テスト。
 *
 * 真因 (commit 22370406, 2026-04-23):
 *   proxy.ts で CSP `'unsafe-inline'` を除去し strict-dynamic + nonce 単独に厳格化した際、
 *   nonce を Next.js に伝える経路として `x-nonce` request header のみを設定した。
 *   しかし Next.js (App Router) は **request headers の `Content-Security-Policy`** を
 *   検出して初めて SSR で生成する `<script>` タグへ自動で `nonce` 属性を付与する
 *   (https://nextjs.org/docs/app/guides/content-security-policy)。
 *   `x-nonce` のみでは Next.js は nonce を生成しないため、本番ビルドで `<script>` が
 *   全て nonce 無しになり CSP に弾かれ、ハイドレーション失敗 →
 *   `AnimatedInkImage` などのクライアントコンポーネントが SSR placeholder
 *   (空の `<div>`) のまま停滞し、画像が表示されない事象が発生した。
 *
 * 再発防止:
 *   このテストは proxy が `Content-Security-Policy` を request headers にも
 *   セットしていることを保証する。これが消えると build (vitest) が直ちに fail する。
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// NextAuth は heavy & not needed for nonce flow; minimal mock.
vi.mock('next-auth', () => ({
  default: (_config: unknown) => ({
    auth: (handler: (req: { auth: null; nextUrl: URL; method: string; headers: Headers }) => Promise<Response> | Response) =>
      async (req: Request) => {
        const url = new URL(req.url)
        return handler({
          auth: null,
          nextUrl: url,
          method: req.method,
          headers: req.headers,
        })
      },
  }),
}))

vi.mock('@sentry/nextjs', () => ({
  captureMessage: vi.fn(),
}))

vi.mock('@/lib/auth.config', () => ({
  authConfig: {},
}))

// maintenance check は Redis を呼ぶので no-op に固定
vi.mock('@/lib/env', () => ({
  getAppUrl: () => 'http://localhost:3000',
}))

describe('proxy: CSP nonce propagation (regression test for commit 22370406)', () => {
  beforeEach(() => {
    // 本番に倣う ('unsafe-inline' が外れる経路)
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('UPSTASH_REDIS_REST_URL', '')
    vi.stubEnv('UPSTASH_REDIS_REST_TOKEN', '')
    vi.stubEnv('BASIC_AUTH_ENABLED', '')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.resetModules()
  })

  it('レスポンスの Content-Security-Policy ヘッダーに script-src で nonce + strict-dynamic が含まれる', async () => {
    const { default: proxy } = await import('@/proxy')

    const req = new Request('http://localhost:3000/', { method: 'GET' })
    const res = (await proxy(req as unknown as Parameters<typeof proxy>[0], {} as Parameters<typeof proxy>[1])) as Response

    const csp = res.headers.get('content-security-policy')
    expect(csp).toBeTruthy()
    // script-src だけを取り出して厳格モードを保証する (style-src の unsafe-inline は許容)
    const scriptSrcMatch = csp?.match(/script-src ([^;]+)/)
    const scriptSrc = scriptSrcMatch?.[1]
    expect(scriptSrc).toBeTruthy()
    expect(scriptSrc).toMatch(/'nonce-[A-Za-z0-9+/=]+'/)
    expect(scriptSrc).toContain("'strict-dynamic'")
    // 本番の script-src では unsafe-inline が含まれてはならない (XSS 耐性)
    expect(scriptSrc).not.toContain("'unsafe-inline'")
  })

  it('リクエストヘッダーにも Content-Security-Policy がセットされている (Next.js が nonce を SSR に注入する条件)', async () => {
    const { default: proxy } = await import('@/proxy')

    const req = new Request('http://localhost:3000/', { method: 'GET' })
    const res = (await proxy(req as unknown as Parameters<typeof proxy>[0], {} as Parameters<typeof proxy>[1])) as Response

    // NextResponse は MiddlewareRequest で渡された headers を `x-middleware-request-*` 形式の
    // metadata header としてレスポンスにも露出する。実装内部の `request.headers` 設定を
    // 観測する公開 API はないが、`NextResponse.next({ request: { headers } })` の結果は
    // `x-middleware-override-headers` / `x-middleware-request-*` 系の特殊ヘッダーとして
    // レスポンスに乗ることを使って検証する。
    const overrideHeaders = res.headers.get('x-middleware-override-headers')
    expect(overrideHeaders, 'proxy が request headers を上書きしている形跡が必要').toBeTruthy()
    // 上書きされた header 一覧に content-security-policy が含まれることを保証する。
    // これが欠落すると Next.js が SSR 時に <script> に nonce を付与せず、
    // 本番で全スクリプトが CSP でブロックされ、ハイドレーションが失敗する。
    expect(overrideHeaders?.toLowerCase()).toContain('content-security-policy')
    // x-nonce も併用 (Server Components から nonce を参照する経路)
    expect(overrideHeaders?.toLowerCase()).toContain('x-nonce')
  })

  it('CSP の nonce と x-nonce request header が一致する (同一リクエスト内で同じ nonce が使われる)', async () => {
    const { default: proxy } = await import('@/proxy')

    const req = new Request('http://localhost:3000/', { method: 'GET' })
    const res = (await proxy(req as unknown as Parameters<typeof proxy>[0], {} as Parameters<typeof proxy>[1])) as Response

    const csp = res.headers.get('content-security-policy')
    const cspNonceMatch = csp?.match(/'nonce-([A-Za-z0-9+/=]+)'/)
    const cspNonce = cspNonceMatch?.[1]
    expect(cspNonce, 'CSP に nonce が含まれること').toBeTruthy()

    // proxy が request headers にコピーした CSP を読む
    const reqCspHeader = res.headers.get('x-middleware-request-content-security-policy')
    expect(reqCspHeader, 'request headers にも CSP がセットされていること').toBeTruthy()
    const reqNonceMatch = reqCspHeader?.match(/'nonce-([A-Za-z0-9+/=]+)'/)
    expect(reqNonceMatch?.[1]).toBe(cspNonce)

    const reqXNonce = res.headers.get('x-middleware-request-x-nonce')
    expect(reqXNonce).toBe(cspNonce)
  })
})
