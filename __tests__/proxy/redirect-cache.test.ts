/**
 * proxy の認証依存リダイレクトが HTTP キャッシュされないことを保証する回帰テスト。
 *
 * Why: 「ログアウト → /login → トップへ戻る (`<a href="/">`)」で意図せず /feed に
 * 飛ばされる事象。`<a>` 化で Router Cache は回避済みだが、ブラウザ HTTP キャッシュに
 * ログイン中の `/` → `/feed` (307) が残ると、ログアウト後でも Cookie を再評価せず
 * キャッシュ済みリダイレクトが再生されてしまう。auth 依存リダイレクトには
 * `Cache-Control: no-store` を付けて根治する。
 *
 * @see proxy.ts redirectNoStore
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/auth.config', () => ({
  authConfig: { providers: [], pages: { signIn: '/login' }, callbacks: {} },
}))

vi.mock('@/lib/env', () => ({
  getAppUrl: vi.fn().mockReturnValue('http://localhost:3000'),
}))

vi.mock('@/lib/constants/limits', () => ({
  NONCE_BYTE_LENGTH: 16,
  HSTS_MAX_AGE_SECONDS: 31536000,
  MAINTENANCE_CACHE_TTL_MS: 30000,
  REFERER_LOG_PREVIEW_LENGTH: 100,
}))

vi.mock('@/lib/constants/routes', () => ({
  PROTECTED_PATHS: ['/feed', '/posts', '/settings', '/admin'],
  MAINTENANCE_ALLOWED_PATHS: ['/', '/login', '/register', '/maintenance', '/api/auth'],
  AUTH_ONLY_PATHS: ['/login', '/register', '/password-reset'],
  WEBHOOK_PATHS: ['/api/webhooks/', '/api/cron/'],
  ROUTE_ADMIN: '/admin',
  ROUTE_LOGIN: '/login',
  ROUTE_FEED: '/feed',
  ROUTE_HOME: '/',
  ROUTE_MAINTENANCE: '/maintenance',
  ROUTE_AD_FRAME_API: '/api/ad-frame',
  NEXT_INTERNAL_PREFIX: '/_next',
  API_PREFIX: '/api/',
}))

let authCallback: ((req: unknown) => unknown) | null = null

vi.mock('next-auth', () => ({
  default: () => ({
    auth: (cb: (req: unknown) => unknown) => {
      authCallback = cb
      return cb
    },
    handlers: {},
    signIn: vi.fn(),
    signOut: vi.fn(),
  }),
}))

const mockRedirect = vi.fn().mockImplementation((url: URL) => ({
  type: 'redirect',
  url: url.toString(),
  headers: new Map<string, string>(),
}))

const mockNext = vi.fn().mockImplementation(() => ({
  type: 'next',
  headers: new Map<string, string>(),
}))

vi.mock('next/server', () => ({
  NextResponse: {
    redirect: (...args: unknown[]) => mockRedirect(...args),
    next: (...args: unknown[]) => mockNext(...args),
  },
}))

beforeEach(() => {
  if (!globalThis.crypto) {
    Object.defineProperty(globalThis, 'crypto', {
      value: {
        getRandomValues: (arr: Uint8Array) => {
          for (let i = 0; i < arr.length; i++) arr[i] = i % 256
          return arr
        },
      },
      writable: true,
      configurable: true,
    })
  }
})

function createMockRequest(
  pathname: string,
  auth: { user?: { id: string; isAdmin?: boolean } } | null,
) {
  return {
    nextUrl: new URL(`http://localhost:3000${pathname}`),
    method: 'GET',
    headers: new Headers(),
    auth,
  }
}

describe('proxy redirect cache headers', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockRedirect.mockImplementation((url: URL) => ({
      type: 'redirect',
      url: url.toString(),
      headers: new Map<string, string>(),
    }))
    mockNext.mockImplementation(() => ({
      type: 'next',
      headers: new Map<string, string>(),
    }))
  })

  it('ログイン中に / へアクセスすると /feed へ no-store でリダイレクトされる', async () => {
    await import('../../proxy')
    expect(authCallback).not.toBeNull()

    const req = createMockRequest('/', { user: { id: 'user-1' } })
    const result = (await authCallback!(req)) as { url: string; headers: Map<string, string> }

    expect(result.url).toContain('/feed')
    expect(result.headers.get('Cache-Control')).toBe('no-store')
  })

  it('未認証で protected パスへアクセスすると /login へ no-store でリダイレクトされる', async () => {
    await import('../../proxy')
    expect(authCallback).not.toBeNull()

    const req = createMockRequest('/settings', null)
    const result = (await authCallback!(req)) as { url: string; headers: Map<string, string> }

    expect(result.url).toContain('/login')
    expect(result.headers.get('Cache-Control')).toBe('no-store')
  })

  it('非管理者が /admin へアクセスすると /feed へ no-store でリダイレクトされる', async () => {
    await import('../../proxy')
    expect(authCallback).not.toBeNull()

    const req = createMockRequest('/admin', { user: { id: 'user-1', isAdmin: false } })
    const result = (await authCallback!(req)) as { url: string; headers: Map<string, string> }

    expect(result.url).toContain('/feed')
    expect(result.headers.get('Cache-Control')).toBe('no-store')
  })
})
