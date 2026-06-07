/**
 * proxy のセキュリティ防衛層 (Basic 認証 / Origin・Referer 検証 / メンテナンス) の
 * 振る舞いを保証するテスト。
 *
 * Why: これらは proxy.ts の中でも fail-closed な最終防衛線でありながら、
 * 既存テスト (admin-check / csp-nonce / redirect-cache) ではほぼ未検証だった。
 * 認証バイパス・CSRF・メンテナンス漏れは重大インシデントに直結するため、
 * 正常系と異常系の双方を網羅する。
 *
 * @see proxy.ts checkBasicAuth / validateOriginHeader / getMaintenanceStatus
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { getAppUrl } from '@/lib/env'

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

const captureMessage = vi.fn()
vi.mock('@sentry/nextjs', () => ({
  captureMessage: (...args: unknown[]) => captureMessage(...args),
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

// next/server の最小モック。
// proxy は `new NextResponse(body, init)` (basicAuthChallenge / forbiddenJson) と
// 静的メソッド `redirect` / `next` の両方を使うため、両対応の実装を用意する。
class MockNextResponse {
  body: unknown
  status: number
  headers: Map<string, string>
  constructor(body?: unknown, init?: { status?: number; headers?: Record<string, string> }) {
    this.body = body
    this.status = init?.status ?? 200
    this.headers = new Map(Object.entries(init?.headers ?? {}))
  }
  static redirect = vi.fn((url: URL) => ({
    type: 'redirect' as const,
    url: url.toString(),
    headers: new Map<string, string>(),
  }))
  static next = vi.fn(() => ({
    type: 'next' as const,
    headers: new Map<string, string>(),
  }))
}

vi.mock('next/server', () => ({
  NextResponse: MockNextResponse,
}))

const ENV_KEYS = [
  'BASIC_AUTH_ENABLED',
  'BASIC_AUTH_USER',
  'BASIC_AUTH_PASSWORD',
  'ALLOWED_ORIGINS',
  'UPSTASH_REDIS_REST_URL',
  'UPSTASH_REDIS_REST_TOKEN',
] as const

let savedEnv: Record<string, string | undefined> = {}

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
  savedEnv = {}
  for (const k of ENV_KEYS) {
    savedEnv[k] = process.env[k]
    delete process.env[k]
  }
  vi.clearAllMocks()
  MockNextResponse.redirect.mockImplementation((url: URL) => ({
    type: 'redirect' as const,
    url: url.toString(),
    headers: new Map<string, string>(),
  }))
  MockNextResponse.next.mockImplementation(() => ({
    type: 'next' as const,
    headers: new Map<string, string>(),
  }))
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
  for (const k of ENV_KEYS) {
    if (savedEnv[k] === undefined) delete process.env[k]
    else process.env[k] = savedEnv[k]
  }
  vi.restoreAllMocks()
})

type ReqInit = {
  pathname: string
  method?: string
  headers?: Record<string, string>
  auth?: { user?: { id: string; isAdmin?: boolean } } | null
}

function createRequest({ pathname, method = 'GET', headers = {}, auth = null }: ReqInit) {
  return {
    nextUrl: new URL(`http://localhost:3000${pathname}`),
    method,
    headers: new Headers(headers),
    auth,
  }
}

function basicAuthHeader(user: string, pass: string): string {
  return `Basic ${Buffer.from(`${user}:${pass}`).toString('base64')}`
}

async function runProxy(init: ReqInit) {
  await import('../../proxy')
  expect(authCallback).not.toBeNull()
  return authCallback!(createRequest(init))
}

describe('proxy Basic 認証', () => {
  it('BASIC_AUTH_ENABLED 未設定なら Basic 認証をスキップして通過する', async () => {
    const result = (await runProxy({ pathname: '/login' })) as { type: string }
    expect(result.type).toBe('next')
  })

  it('ENABLED=true だが資格情報が未設定なら fail-closed で 503 を返し fatal を報告する', async () => {
    process.env.BASIC_AUTH_ENABLED = 'true'
    const result = (await runProxy({ pathname: '/login' })) as MockNextResponse
    expect(result.status).toBe(503)
    expect(captureMessage).toHaveBeenCalledWith(
      expect.stringContaining('[SECURITY]'),
      expect.objectContaining({ level: 'fatal' }),
    )
  })

  it('Authorization ヘッダーが無ければ 401 チャレンジを返す', async () => {
    process.env.BASIC_AUTH_ENABLED = 'true'
    process.env.BASIC_AUTH_USER = 'admin'
    process.env.BASIC_AUTH_PASSWORD = 'secret'
    const result = (await runProxy({ pathname: '/login' })) as MockNextResponse
    expect(result.status).toBe(401)
    expect(result.headers.get('WWW-Authenticate')).toContain('Basic realm')
  })

  it('スキームが Basic でなければ 401 を返す', async () => {
    process.env.BASIC_AUTH_ENABLED = 'true'
    process.env.BASIC_AUTH_USER = 'admin'
    process.env.BASIC_AUTH_PASSWORD = 'secret'
    const result = (await runProxy({
      pathname: '/login',
      headers: { authorization: 'Bearer token123' },
    })) as MockNextResponse
    expect(result.status).toBe(401)
  })

  it('コロンの無い資格情報は 401 (Invalid credentials) を返す', async () => {
    process.env.BASIC_AUTH_ENABLED = 'true'
    process.env.BASIC_AUTH_USER = 'admin'
    process.env.BASIC_AUTH_PASSWORD = 'secret'
    const malformed = `Basic ${Buffer.from('adminsecret').toString('base64')}`
    const result = (await runProxy({
      pathname: '/login',
      headers: { authorization: malformed },
    })) as MockNextResponse
    expect(result.status).toBe(401)
    expect(result.body).toBe('Invalid credentials')
  })

  it('資格情報が一致しなければ 401 を返す', async () => {
    process.env.BASIC_AUTH_ENABLED = 'true'
    process.env.BASIC_AUTH_USER = 'admin'
    process.env.BASIC_AUTH_PASSWORD = 'secret'
    const result = (await runProxy({
      pathname: '/login',
      headers: { authorization: basicAuthHeader('admin', 'wrong') },
    })) as MockNextResponse
    expect(result.status).toBe(401)
    expect(result.body).toBe('Invalid credentials')
  })

  it('資格情報が一致すれば通過する', async () => {
    process.env.BASIC_AUTH_ENABLED = 'true'
    process.env.BASIC_AUTH_USER = 'admin'
    process.env.BASIC_AUTH_PASSWORD = 'secret'
    const result = (await runProxy({
      pathname: '/login',
      headers: { authorization: basicAuthHeader('admin', 'secret') },
    })) as { type: string }
    expect(result.type).toBe('next')
  })
})

describe('proxy apex → www 正規化', () => {
  afterEach(() => {
    vi.mocked(getAppUrl).mockReturnValue('http://localhost:3000')
  })

  it('apex ホストへのアクセスは canonical な www へ 308 リダイレクトする', async () => {
    vi.mocked(getAppUrl).mockReturnValue('https://www.bon-log.com')
    const result = (await runProxy({
      pathname: '/feed',
      headers: { host: 'bon-log.com' },
    })) as { type: string; url: string }
    expect(result.type).toBe('redirect')
    expect(result.url).toBe('https://www.bon-log.com/feed')
  })

  it('apex への POST も pathname / search を保持して www へリダイレクトする', async () => {
    vi.mocked(getAppUrl).mockReturnValue('https://www.bon-log.com')
    const result = (await runProxy({
      pathname: '/monitoring',
      method: 'POST',
      headers: { host: 'bon-log.com', origin: 'https://bon-log.com' },
    })) as { type: string; url: string }
    expect(result.type).toBe('redirect')
    expect(result.url).toBe('https://www.bon-log.com/monitoring')
  })

  it('x-forwarded-host が apex の場合もリダイレクトする', async () => {
    vi.mocked(getAppUrl).mockReturnValue('https://www.bon-log.com')
    const result = (await runProxy({
      pathname: '/',
      headers: { 'x-forwarded-host': 'bon-log.com', host: 'internal:3000' },
    })) as { type: string; url: string }
    expect(result.type).toBe('redirect')
    expect(result.url).toBe('https://www.bon-log.com/')
  })

  it('canonical な www ホストはリダイレクトせず通過する', async () => {
    vi.mocked(getAppUrl).mockReturnValue('https://www.bon-log.com')
    const result = (await runProxy({
      pathname: '/feed',
      headers: { host: 'www.bon-log.com' },
      auth: { user: { id: 'u1' } },
    })) as { type: string }
    expect(result.type).toBe('next')
  })

  it('canonical が www でない (localhost) 場合はホスト判定をスキップする', async () => {
    const result = (await runProxy({
      pathname: '/',
      headers: { host: 'bon-log.com' },
    })) as { type: string }
    expect(result.type).toBe('next')
  })
})

describe('proxy Origin / Referer 検証 (CSRF)', () => {
  it('GET リクエストは Origin 検証をスキップする', async () => {
    const result = (await runProxy({ pathname: '/', method: 'GET' })) as { type: string }
    expect(result.type).toBe('next')
  })

  it('許可された Origin の POST は通過する', async () => {
    const result = (await runProxy({
      pathname: '/',
      method: 'POST',
      headers: { origin: 'http://localhost:3000' },
    })) as { type: string }
    expect(result.type).toBe('next')
  })

  it('許可されない Origin の POST は 403 を返し報告する', async () => {
    const result = (await runProxy({
      pathname: '/',
      method: 'POST',
      headers: { origin: 'https://evil.example.com' },
    })) as MockNextResponse
    expect(result.status).toBe(403)
    expect(captureMessage).toHaveBeenCalledWith(
      expect.stringContaining('unauthorized origin'),
      expect.objectContaining({ level: 'warning' }),
    )
  })

  it('Server Action (next-action) で Origin が無ければ 403 を返す', async () => {
    const result = (await runProxy({
      pathname: '/',
      method: 'POST',
      headers: { 'next-action': 'abc123' },
    })) as MockNextResponse
    expect(result.status).toBe(403)
    expect(result.body).toContain('Missing Origin header')
  })

  it('Origin 無し + 許可 Referer の POST は通過する', async () => {
    const result = (await runProxy({
      pathname: '/',
      method: 'POST',
      headers: { referer: 'http://localhost:3000/login' },
    })) as { type: string }
    expect(result.type).toBe('next')
  })

  it('Origin 無し + 許可されない Referer の POST は 403 を返す', async () => {
    const result = (await runProxy({
      pathname: '/',
      method: 'POST',
      headers: { referer: 'https://evil.example.com/x' },
    })) as MockNextResponse
    expect(result.status).toBe(403)
  })

  it('Origin 無し + 壊れた Referer の POST は 403 (Invalid Referer) を返す', async () => {
    const result = (await runProxy({
      pathname: '/',
      method: 'POST',
      headers: { referer: 'not-a-valid-url' },
    })) as MockNextResponse
    expect(result.status).toBe(403)
    expect(result.body).toContain('Invalid Referer')
  })

  it('Origin も Referer も無い非 Server-Action POST は通過する', async () => {
    const result = (await runProxy({ pathname: '/', method: 'POST' })) as { type: string }
    expect(result.type).toBe('next')
  })

  it('ALLOWED_ORIGINS に追加した Origin の POST は通過する', async () => {
    process.env.ALLOWED_ORIGINS = 'https://app.example.com'
    const result = (await runProxy({
      pathname: '/',
      method: 'POST',
      headers: { origin: 'https://app.example.com' },
    })) as { type: string }
    expect(result.type).toBe('next')
  })

  it('getAppUrl が不正値を返しても localhost フォールバックで検証を継続する', async () => {
    vi.mocked(getAppUrl).mockReturnValueOnce('not-a-valid-url')
    const result = (await runProxy({
      pathname: '/',
      method: 'POST',
      headers: { origin: 'http://localhost:3000' },
    })) as { type: string }
    expect(result.type).toBe('next')
  })

  it('Webhook パスの POST は Origin 検証を skip する (外部署名検証に委譲)', async () => {
    const result = (await runProxy({
      pathname: '/api/webhooks/stripe',
      method: 'POST',
      headers: { origin: 'https://evil.example.com' },
    })) as { type: string }
    // /api/ プレフィックスのため addSecurityHeaders(next) を返す。403 にはならない。
    expect(result.type).toBe('next')
  })
})

describe('proxy ルーティング分岐', () => {
  it('広告 iframe ルートは素の next を返す (CSP 非適用)', async () => {
    const result = (await runProxy({ pathname: '/api/ad-frame' })) as {
      type: string
      headers: Map<string, string>
    }
    expect(result.type).toBe('next')
    expect(result.headers.has('Content-Security-Policy')).toBe(false)
  })

  it('API ルートは Basic 認証を skip しセキュリティヘッダー付きで通過する', async () => {
    process.env.BASIC_AUTH_ENABLED = 'true'
    process.env.BASIC_AUTH_USER = 'admin'
    process.env.BASIC_AUTH_PASSWORD = 'secret'
    const result = (await runProxy({ pathname: '/api/posts' })) as {
      type: string
      headers: Map<string, string>
    }
    expect(result.type).toBe('next')
    expect(result.headers.get('Content-Security-Policy')).toBeTruthy()
  })

  it('メンテナンス許可パスの Server Action は Basic 認証を skip して通過する', async () => {
    process.env.BASIC_AUTH_ENABLED = 'true'
    process.env.BASIC_AUTH_USER = 'admin'
    process.env.BASIC_AUTH_PASSWORD = 'secret'
    const result = (await runProxy({
      pathname: '/login',
      method: 'POST',
      headers: { 'next-action': 'abc', origin: 'http://localhost:3000' },
    })) as { type: string }
    expect(result.type).toBe('next')
  })
})

describe('proxy メンテナンスモード', () => {
  // メンテ状態は module-level cache (TTL 30s) を持つため、
  // 各テストでモジュールを reset して cache 汚染を避ける。
  beforeEach(() => {
    vi.resetModules()
    authCallback = null
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('メンテナンス有効時は全パスを /maintenance へ no-store でリダイレクトする', async () => {
    process.env.UPSTASH_REDIS_REST_URL = 'https://redis.example.com'
    process.env.UPSTASH_REDIS_REST_TOKEN = 'token'
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, json: async () => ({ result: 'true' }) }),
    )

    const result = (await runProxy({ pathname: '/feed', auth: { user: { id: 'u1' } } })) as {
      url: string
      headers: Map<string, string>
    }
    expect(result.url).toContain('/maintenance')
    expect(result.headers.get('Cache-Control')).toBe('no-store')
  })

  it('メンテナンス無効 (redis が false) ならリダイレクトしない', async () => {
    process.env.UPSTASH_REDIS_REST_URL = 'https://redis.example.com'
    process.env.UPSTASH_REDIS_REST_TOKEN = 'token'
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, json: async () => ({ result: 'false' }) }),
    )

    const result = (await runProxy({ pathname: '/feed', auth: { user: { id: 'u1' } } })) as {
      type?: string
      url?: string
    }
    expect(result.url).toBeUndefined()
    expect(result.type).toBe('next')
  })

  it('redis が ok:false を返したら false 扱いで継続する', async () => {
    process.env.UPSTASH_REDIS_REST_URL = 'https://redis.example.com'
    process.env.UPSTASH_REDIS_REST_TOKEN = 'token'
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }))

    const result = (await runProxy({ pathname: '/feed', auth: { user: { id: 'u1' } } })) as {
      type?: string
    }
    expect(result.type).toBe('next')
  })

  it('fetch が例外を投げても false 扱いで処理を継続する', async () => {
    process.env.UPSTASH_REDIS_REST_URL = 'https://redis.example.com'
    process.env.UPSTASH_REDIS_REST_TOKEN = 'token'
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')))

    const result = (await runProxy({ pathname: '/feed', auth: { user: { id: 'u1' } } })) as {
      type?: string
    }
    expect(result.type).toBe('next')
  })

  it('TTL 内の 2 回目はキャッシュを使い redis を再取得しない', async () => {
    process.env.UPSTASH_REDIS_REST_URL = 'https://redis.example.com'
    process.env.UPSTASH_REDIS_REST_TOKEN = 'token'
    const fetchMock = vi
      .fn()
      .mockResolvedValue({ ok: true, json: async () => ({ result: 'false' }) })
    vi.stubGlobal('fetch', fetchMock)

    await runProxy({ pathname: '/feed', auth: { user: { id: 'u1' } } })
    await runProxy({ pathname: '/posts', auth: { user: { id: 'u1' } } })

    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})
