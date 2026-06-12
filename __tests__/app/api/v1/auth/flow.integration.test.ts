// @vitest-environment node
/**
 * モバイル API v1 結合フローテスト（受け入れ基準①②）
 *
 * login → /users/me → refresh（ローテーション） → 旧トークン再利用検知 → logout（冪等）
 * および fail-closed 系（改ざん / 期限切れ / レート超過 / Redis 障害）を 1 ファイルで検証する。
 */
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'
import crypto from 'crypto'

const VALID_SECRET = 'a'.repeat(64)

// ---- インメモリ DB モック ----
const refreshTokenStore = new Map<
  string,
  { id: string; userId: string; expiresAt: Date; revokedAt: Date | null }
>()
let rtIdCounter = 0

const mockUserStore = new Map<string, { id: string; isSuspended: boolean; email: string; nickname: string; avatarUrl: string | null; bio: string | null }>()

function mockPrismaFactory() {
  return {
    user: {
      findUnique: vi.fn().mockImplementation(({ where }: { where: { id?: string; email?: string } }) => {
        if (where.id) return Promise.resolve(mockUserStore.get(where.id) ?? null)
        if (where.email) {
          for (const u of mockUserStore.values()) {
            if (u.email === where.email) return Promise.resolve(u)
          }
        }
        return Promise.resolve(null)
      }),
    },
    refreshToken: {
      create: vi.fn().mockImplementation(({ data }: { data: { userId: string; tokenHash: string; expiresAt: Date } }) => {
        const id = `rt-${++rtIdCounter}`
        refreshTokenStore.set(data.tokenHash, { id, userId: data.userId, expiresAt: data.expiresAt, revokedAt: null })
        return Promise.resolve({ id })
      }),
      findUnique: vi.fn().mockImplementation(({ where }: { where: { tokenHash: string } }) => {
        return Promise.resolve(refreshTokenStore.get(where.tokenHash) ?? null)
      }),
      update: vi.fn().mockImplementation(({ where, data }: { where: { id: string }; data: { revokedAt: Date } }) => {
        for (const [hash, record] of refreshTokenStore.entries()) {
          if (record.id === where.id) {
            refreshTokenStore.set(hash, { ...record, ...data })
            break
          }
        }
        return Promise.resolve({})
      }),
      updateMany: vi.fn().mockImplementation(({ where, data }: { where: { userId: string; revokedAt: null }; data: { revokedAt: Date } }) => {
        let count = 0
        for (const [hash, record] of refreshTokenStore.entries()) {
          if (record.userId === where.userId && record.revokedAt === null) {
            refreshTokenStore.set(hash, { ...record, ...data })
            count++
          }
        }
        return Promise.resolve({ count })
      }),
    },
    $transaction: vi.fn().mockImplementation((cb: (tx: unknown) => unknown) => cb(mockPrisma)),
  }
}
const mockPrisma = mockPrismaFactory()
vi.mock('@/lib/db', () => ({ prisma: mockPrisma }))

const mockVerifyCredentials = vi.fn()
vi.mock('@/lib/services/credential-verification', () => ({
  verifyCredentials: (...args: unknown[]) => mockVerifyCredentials(...args),
}))

const mockCheckRateLimit = vi.fn()
vi.mock('@/lib/rate-limit', () => ({
  checkRateLimit: (...args: unknown[]) => mockCheckRateLimit(...args),
}))

const mockIsPremiumUser = vi.fn().mockResolvedValue(false)
vi.mock('@/lib/premium', () => ({
  isPremiumUser: (...args: unknown[]) => mockIsPremiumUser(...args),
}))

vi.mock('@/lib/logger', () => ({
  __esModule: true,
  default: { warn: vi.fn(), error: vi.fn(), log: vi.fn() },
}))

function makeRequest(url: string, body: unknown): NextRequest {
  return new NextRequest(url, {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  })
}

function makeGetRequest(url: string, token: string): NextRequest {
  return new NextRequest(url, {
    headers: { authorization: `Bearer ${token}` },
  })
}

function hashToken(raw: string): string {
  return crypto.createHash('sha256').update(raw).digest('hex')
}

describe('モバイル API v1 結合フロー', () => {
  beforeEach(() => {
    vi.stubEnv('MOBILE_JWT_SECRET', VALID_SECRET)
    vi.clearAllMocks()
    refreshTokenStore.clear()
    rtIdCounter = 0
    mockUserStore.clear()

    mockUserStore.set('flow-user-1', {
      id: 'flow-user-1',
      isSuspended: false,
      email: 'flow@example.com',
      nickname: 'フローテスト',
      avatarUrl: null,
      bio: null,
    })

    mockCheckRateLimit.mockResolvedValue({ success: true, remaining: 19, resetTime: Date.now() + 60000 })
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('受け入れ基準①: login → accessToken で /users/me → refresh → 新ペアで /users/me', async () => {
    // 1. login
    mockVerifyCredentials.mockResolvedValueOnce({
      ok: true,
      user: { id: 'flow-user-1', email: 'flow@example.com', nickname: 'フローテスト', avatarUrl: null, twoFactorEnabled: false },
    })

    const { POST: loginPOST } = await import('@/app/api/v1/auth/login/route')
    const loginRes = await loginPOST(makeRequest(
      'http://localhost/api/v1/auth/login',
      { email: 'flow@example.com', password: 'password123' }
    ))
    expect(loginRes.status).toBe(200)
    const loginBody = await loginRes.json()
    const accessToken1: string = loginBody.accessToken
    const refreshToken1: string = loginBody.refreshToken
    expect(typeof accessToken1).toBe('string')
    expect(typeof refreshToken1).toBe('string')

    // 2. accessToken1 で /users/me
    const { GET: meGET } = await import('@/app/api/v1/users/me/route')
    const meRes1 = await meGET(makeGetRequest('http://localhost/api/v1/users/me', accessToken1))
    expect(meRes1.status).toBe(200)
    const meBody1 = await meRes1.json()
    expect(meBody1.id).toBe('flow-user-1')

    // 3. refresh → 新ペア取得
    const { POST: refreshPOST } = await import('@/app/api/v1/auth/refresh/route')
    const refreshRes = await refreshPOST(makeRequest(
      'http://localhost/api/v1/auth/refresh',
      { refreshToken: refreshToken1 }
    ))
    expect(refreshRes.status).toBe(200)
    const refreshBody = await refreshRes.json()
    const accessToken2: string = refreshBody.accessToken
    const refreshToken2: string = refreshBody.refreshToken
    expect(typeof accessToken2).toBe('string')
    expect(accessToken2.split('.')).toHaveLength(3)
    expect(typeof refreshToken2).toBe('string')
    // refreshToken2 は必ず refreshToken1 と異なる（crypto.randomBytes で生成）
    expect(refreshToken2).not.toBe(refreshToken1)

    // 旧 refreshToken1 が revoke されていることを確認
    const hash1 = hashToken(refreshToken1)
    const stored1 = refreshTokenStore.get(hash1)
    expect(stored1?.revokedAt).not.toBeNull()

    // 4. 新 accessToken2 で /users/me
    const meRes2 = await meGET(makeGetRequest('http://localhost/api/v1/users/me', accessToken2))
    expect(meRes2.status).toBe(200)
    const meBody2 = await meRes2.json()
    expect(meBody2.id).toBe('flow-user-1')
  })

  it('受け入れ基準②: 旧 refreshToken 再提示 → REUSE_DETECTED + 全トークン失効', async () => {
    // 1. login してリフレッシュトークンを取得
    mockVerifyCredentials.mockResolvedValueOnce({
      ok: true,
      user: { id: 'flow-user-1', email: 'flow@example.com', nickname: 'T', avatarUrl: null, twoFactorEnabled: false },
    })

    const { POST: loginPOST } = await import('@/app/api/v1/auth/login/route')
    const loginRes = await loginPOST(makeRequest(
      'http://localhost/api/v1/auth/login',
      { email: 'flow@example.com', password: 'password123' }
    ))
    const loginBody = await loginRes.json()
    const refreshToken1: string = loginBody.refreshToken

    // 2. refresh → 旧トークンが revoke される
    const { POST: refreshPOST } = await import('@/app/api/v1/auth/refresh/route')
    const refreshRes = await refreshPOST(makeRequest(
      'http://localhost/api/v1/auth/refresh',
      { refreshToken: refreshToken1 }
    ))
    expect(refreshRes.status).toBe(200)
    const refreshBody = await refreshRes.json()
    const refreshToken2: string = refreshBody.refreshToken

    // 3. 旧 refreshToken1 を再提示 → REUSE_DETECTED
    const reuseRes = await refreshPOST(makeRequest(
      'http://localhost/api/v1/auth/refresh',
      { refreshToken: refreshToken1 }
    ))
    expect(reuseRes.status).toBe(401)
    const reuseBody = await reuseRes.json()
    expect(reuseBody.error.code).toBe('AUTH_REFRESH_TOKEN_REUSE_DETECTED')

    // 4. 当該ユーザーの全アクティブトークンが失効していることを確認
    const hash2 = hashToken(refreshToken2)
    const stored2 = refreshTokenStore.get(hash2)
    expect(stored2?.revokedAt).not.toBeNull()
  })

  it('受け入れ基準②: logout → 同じトークンで再 logout も 200（冪等）', async () => {
    // login
    mockVerifyCredentials.mockResolvedValueOnce({
      ok: true,
      user: { id: 'flow-user-1', email: 'flow@example.com', nickname: 'T', avatarUrl: null, twoFactorEnabled: false },
    })

    const { POST: loginPOST } = await import('@/app/api/v1/auth/login/route')
    const loginRes = await loginPOST(makeRequest(
      'http://localhost/api/v1/auth/login',
      { email: 'flow@example.com', password: 'password123' }
    ))
    const loginBody = await loginRes.json()
    const refreshToken: string = loginBody.refreshToken

    const { POST: logoutPOST } = await import('@/app/api/v1/auth/logout/route')

    // 1 回目 logout
    const logout1 = await logoutPOST(makeRequest(
      'http://localhost/api/v1/auth/logout',
      { refreshToken }
    ))
    expect(logout1.status).toBe(200)
    const logoutBody1 = await logout1.json()
    expect(logoutBody1.success).toBe(true)

    // 2 回目 logout（冪等）
    const logout2 = await logoutPOST(makeRequest(
      'http://localhost/api/v1/auth/logout',
      { refreshToken }
    ))
    expect(logout2.status).toBe(200)
    const logoutBody2 = await logout2.json()
    expect(logoutBody2.success).toBe(true)
  })

  it('fail-closed: 改ざんトークンで /users/me が 401 AUTH_INVALID_TOKEN', async () => {
    const { GET: meGET } = await import('@/app/api/v1/users/me/route')
    const res = await meGET(makeGetRequest('http://localhost/api/v1/users/me', 'tampered.token.here'))
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error.code).toBe('AUTH_INVALID_TOKEN')
  })

  it('fail-closed: 期限切れ accessToken で /users/me が 401 AUTH_TOKEN_EXPIRED', async () => {
    vi.useFakeTimers()

    mockVerifyCredentials.mockResolvedValueOnce({
      ok: true,
      user: { id: 'flow-user-1', email: 'flow@example.com', nickname: 'T', avatarUrl: null, twoFactorEnabled: false },
    })

    const { POST: loginPOST } = await import('@/app/api/v1/auth/login/route')
    const loginRes = await loginPOST(makeRequest(
      'http://localhost/api/v1/auth/login',
      { email: 'flow@example.com', password: 'password123' }
    ))
    const loginBody = await loginRes.json()
    const accessToken: string = loginBody.accessToken

    vi.advanceTimersByTime(901 * 1000)

    const { GET: meGET } = await import('@/app/api/v1/users/me/route')
    const res = await meGET(makeGetRequest('http://localhost/api/v1/users/me', accessToken))
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error.code).toBe('AUTH_TOKEN_EXPIRED')

    vi.useRealTimers()
  })

  it('fail-closed: レート制限超過で login が 429 RATE_LIMITED', async () => {
    mockCheckRateLimit.mockResolvedValueOnce({
      success: false,
      remaining: 0,
      resetTime: Date.now() + 900_000,
    })

    const { POST: loginPOST } = await import('@/app/api/v1/auth/login/route')
    const res = await loginPOST(makeRequest(
      'http://localhost/api/v1/auth/login',
      { email: 'flow@example.com', password: 'password123' }
    ))
    expect(res.status).toBe(429)
    const body = await res.json()
    expect(body.error.code).toBe('RATE_LIMITED')
  })

  it('fail-closed: レート制限超過時（429）はログイン試行を拒否し RATE_LIMITED を返す', async () => {
    mockCheckRateLimit.mockResolvedValueOnce({
      success: false,
      remaining: 0,
      resetTime: Date.now() + 900_000,
    })

    const { POST: loginPOST } = await import('@/app/api/v1/auth/login/route')
    const res = await loginPOST(makeRequest(
      'http://localhost/api/v1/auth/login',
      { email: 'flow@example.com', password: 'password123' }
    ))
    expect(res.status).toBe(429)
    const body = await res.json()
    expect(body.error.code).toBe('RATE_LIMITED')
  })
})

describe('fail-closed: Redis 障害でログインが拒否される（checkRateLimit が failure を返す境界テスト）', () => {
  const VALID_SECRET_FC = 'a'.repeat(64)

  beforeEach(() => {
    vi.stubEnv('MOBILE_JWT_SECRET', VALID_SECRET_FC)
    vi.clearAllMocks()
    mockCheckRateLimit.mockResolvedValue({ success: true, remaining: 19, resetTime: Date.now() + 60000 })
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('RATE_LIMITS.login は failOpen:false — checkRateLimit が failure を返したとき login が 429 で拒否される', async () => {
    // Redis.incr が throw → rateLimit(failOpen:false) → {success:false} を模擬する。
    // rateLimit 単体の fail-closed 動作は __tests__/lib/rate-limit.test.ts:395 で検証済み。
    // ここでは「login route が checkRateLimit failure を受け取ったとき 429 を返す」を検証する。
    mockCheckRateLimit.mockResolvedValueOnce({
      success: false,
      remaining: 0,
      resetTime: Date.now() + 900_000,
    })

    const { POST: loginPOST } = await import('@/app/api/v1/auth/login/route')
    const res = await loginPOST(makeRequest(
      'http://localhost/api/v1/auth/login',
      { email: 'flow@example.com', password: 'password123' }
    ))

    expect(res.status).toBe(429)
    const body = await res.json()
    expect(body.error.code).toBe('RATE_LIMITED')
    // レート制限チェック後に verifyCredentials や issueTokenPair は呼ばれない
    expect(mockVerifyCredentials).not.toHaveBeenCalled()
  })
})
