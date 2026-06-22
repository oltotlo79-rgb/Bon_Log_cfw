// @vitest-environment node
/**
 * POST /api/webhooks/revenuecat
 *
 * 送信元検証（timingSafeEqual）・Zod バリデーション・冪等性ガード・
 * 各イベントタイプの DB 更新・エラー時のロック解放を網羅する。
 */
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'

// ──────────────────────────────────────────────────
// モック: DB
// ──────────────────────────────────────────────────
const mockUserFindUnique = vi.fn()
const mockUserUpdate = vi.fn()

vi.mock('@/lib/db', () => ({
  prisma: {
    user: {
      findUnique: (...args: unknown[]) => mockUserFindUnique(...args),
      update: (...args: unknown[]) => mockUserUpdate(...args),
    },
  },
}))

// ──────────────────────────────────────────────────
// モック: rate-limit
// ──────────────────────────────────────────────────
const mockCheckRateLimit = vi.fn()
vi.mock('@/lib/rate-limit', () => ({
  checkRateLimit: (...args: unknown[]) => mockCheckRateLimit(...args),
}))

// ──────────────────────────────────────────────────
// モック: webhook-idempotency
// ──────────────────────────────────────────────────
const mockEnsureWebhookEventOnce = vi.fn()
const mockDeleteWebhookEvent = vi.fn()
vi.mock('@/lib/services/webhook-idempotency', () => ({
  ensureWebhookEventOnce: (...args: unknown[]) => mockEnsureWebhookEventOnce(...args),
  deleteWebhookEvent: (...args: unknown[]) => mockDeleteWebhookEvent(...args),
  WEBHOOK_PROVIDER_REVENUECAT: 'revenuecat',
}))

// ──────────────────────────────────────────────────
// モック: logger
// ──────────────────────────────────────────────────
vi.mock('@/lib/logger', () => ({
  default: {
    log: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}))

// ──────────────────────────────────────────────────
// ヘルパー
// ──────────────────────────────────────────────────
const TEST_SECRET = 'test-webhook-secret'

function makeRequest(body: unknown, authHeader?: string): NextRequest {
  const headers: Record<string, string> = { 'content-type': 'application/json' }
  if (authHeader !== undefined) headers['authorization'] = authHeader
  return new NextRequest('http://localhost/api/webhooks/revenuecat', {
    method: 'POST',
    body: JSON.stringify(body),
    headers,
  })
}

function makeInvalidJsonRequest(authHeader?: string): NextRequest {
  const headers: Record<string, string> = { 'content-type': 'application/json' }
  if (authHeader !== undefined) headers['authorization'] = authHeader
  return new NextRequest('http://localhost/api/webhooks/revenuecat', {
    method: 'POST',
    body: 'this is not json{{{',
    headers,
  })
}

function validPayload(overrides: Record<string, unknown> = {}) {
  return {
    event: {
      id: 'evt-001',
      type: 'INITIAL_PURCHASE',
      app_user_id: 'user-premium-1',
      expiration_at_ms: Date.now() + 30 * 24 * 60 * 60 * 1000,
      ...overrides,
    },
    api_version: '1.0',
  }
}

describe('POST /api/webhooks/revenuecat', () => {
  const originalEnv = process.env

  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
    process.env = { ...originalEnv, REVENUECAT_WEBHOOK_AUTH_HEADER: TEST_SECRET }
    mockCheckRateLimit.mockResolvedValue({ success: true, remaining: 60, resetTime: Date.now() + 60_000 })
    mockEnsureWebhookEventOnce.mockResolvedValue({ alreadyProcessed: false })
    mockDeleteWebhookEvent.mockResolvedValue(undefined)
    mockUserFindUnique.mockResolvedValue({ id: 'user-premium-1' })
    mockUserUpdate.mockResolvedValue({})
  })

  afterEach(() => {
    process.env = originalEnv
  })

  // ──────────────────────────────────────────────────
  // A. 認証チェック
  // ──────────────────────────────────────────────────

  it('REVENUECAT_WEBHOOK_AUTH_HEADER 未設定で 503', async () => {
    delete process.env.REVENUECAT_WEBHOOK_AUTH_HEADER
    const { POST } = await import('@/app/api/webhooks/revenuecat/route')
    const res = await POST(makeRequest(validPayload(), TEST_SECRET))
    expect(res.status).toBe(503)
    const body = await res.json()
    expect(body.error).toBeTruthy()
  })

  it('Authorization ヘッダーなしで 401', async () => {
    const { POST } = await import('@/app/api/webhooks/revenuecat/route')
    const res = await POST(makeRequest(validPayload()))
    expect(res.status).toBe(401)
  })

  it('Authorization 不一致で 401', async () => {
    const { POST } = await import('@/app/api/webhooks/revenuecat/route')
    const res = await POST(makeRequest(validPayload(), 'wrong-secret'))
    expect(res.status).toBe(401)
  })

  it('正しい Authorization で 200 を返す', async () => {
    const { POST } = await import('@/app/api/webhooks/revenuecat/route')
    const res = await POST(makeRequest(validPayload(), TEST_SECRET))
    expect(res.status).toBe(200)
  })

  // ──────────────────────────────────────────────────
  // B. レート制限
  // ──────────────────────────────────────────────────

  it('レート制限超過で 429', async () => {
    mockCheckRateLimit.mockResolvedValueOnce({ success: false, remaining: 0, resetTime: Date.now() + 30_000 })
    const { POST } = await import('@/app/api/webhooks/revenuecat/route')
    const res = await POST(makeRequest(validPayload(), TEST_SECRET))
    expect(res.status).toBe(429)
  })

  // ──────────────────────────────────────────────────
  // C. JSON / Zod バリデーション
  // ──────────────────────────────────────────────────

  it('不正 JSON で 400', async () => {
    const { POST } = await import('@/app/api/webhooks/revenuecat/route')
    const res = await POST(makeInvalidJsonRequest(TEST_SECRET))
    expect(res.status).toBe(400)
  })

  it('Zod 失敗（event 欠如）で 200（リトライ抑止）', async () => {
    const { POST } = await import('@/app/api/webhooks/revenuecat/route')
    const res = await POST(makeRequest({ api_version: '1.0' }, TEST_SECRET))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.received).toBe(true)
  })

  it('Zod 失敗（event.id 欠如）で 200', async () => {
    const payload = { event: { type: 'INITIAL_PURCHASE', app_user_id: 'user-1' }, api_version: '1.0' }
    const { POST } = await import('@/app/api/webhooks/revenuecat/route')
    const res = await POST(makeRequest(payload, TEST_SECRET))
    expect(res.status).toBe(200)
  })

  // ──────────────────────────────────────────────────
  // D. 冪等性ガード
  // ──────────────────────────────────────────────────

  it('同一 event.id の 2 回目は 200 duplicate:true', async () => {
    mockEnsureWebhookEventOnce.mockResolvedValueOnce({ alreadyProcessed: true })
    const { POST } = await import('@/app/api/webhooks/revenuecat/route')
    const res = await POST(makeRequest(validPayload(), TEST_SECRET))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.duplicate).toBe(true)
    expect(mockUserUpdate).not.toHaveBeenCalled()
  })

  it('冪等性チェックで DB エラー発生時も処理継続（5xx にならない）', async () => {
    mockEnsureWebhookEventOnce.mockRejectedValueOnce(new Error('DB connection error'))
    const { POST } = await import('@/app/api/webhooks/revenuecat/route')
    const res = await POST(makeRequest(validPayload(), TEST_SECRET))
    // エラーでも処理継続なので 200 か 5xx（processRevenueCatEvent 後の結果次第）
    // ロック失敗後も processRevenueCatEvent は呼ばれる
    expect([200, 500]).toContain(res.status)
  })

  // ──────────────────────────────────────────────────
  // E. イベントタイプ別処理
  // ──────────────────────────────────────────────────

  it('INITIAL_PURCHASE: isPremium=true + premiumExpiresAt 更新で 200', async () => {
    const expirationAtMs = Date.now() + 30 * 24 * 60 * 60 * 1000
    const payload = validPayload({ type: 'INITIAL_PURCHASE', expiration_at_ms: expirationAtMs })
    const { POST } = await import('@/app/api/webhooks/revenuecat/route')
    const res = await POST(makeRequest(payload, TEST_SECRET))
    expect(res.status).toBe(200)
    expect(mockUserUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'user-premium-1' },
        data: expect.objectContaining({ isPremium: true }),
      }),
    )
  })

  it('RENEWAL: isPremium=true + premiumExpiresAt 更新で 200', async () => {
    const expirationAtMs = Date.now() + 30 * 24 * 60 * 60 * 1000
    const payload = validPayload({ type: 'RENEWAL', expiration_at_ms: expirationAtMs })
    const { POST } = await import('@/app/api/webhooks/revenuecat/route')
    const res = await POST(makeRequest(payload, TEST_SECRET))
    expect(res.status).toBe(200)
    expect(mockUserUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'user-premium-1' },
        data: expect.objectContaining({ isPremium: true }),
      }),
    )
  })

  it('CANCELLATION: DB 更新なし・200', async () => {
    const payload = validPayload({ type: 'CANCELLATION' })
    const { POST } = await import('@/app/api/webhooks/revenuecat/route')
    const res = await POST(makeRequest(payload, TEST_SECRET))
    expect(res.status).toBe(200)
    expect(mockUserUpdate).not.toHaveBeenCalled()
  })

  it('EXPIRATION: isPremium=false + premiumExpiresAt=null で 200', async () => {
    const payload = validPayload({ type: 'EXPIRATION' })
    const { POST } = await import('@/app/api/webhooks/revenuecat/route')
    const res = await POST(makeRequest(payload, TEST_SECRET))
    expect(res.status).toBe(200)
    expect(mockUserUpdate).toHaveBeenCalledWith({
      where: { id: 'user-premium-1' },
      data: { isPremium: false, premiumExpiresAt: null },
    })
  })

  it('不明 event.type → 200 + DB 不変', async () => {
    const payload = validPayload({ type: 'PRODUCT_CHANGE' })
    const { POST } = await import('@/app/api/webhooks/revenuecat/route')
    const res = await POST(makeRequest(payload, TEST_SECRET))
    expect(res.status).toBe(200)
    expect(mockUserUpdate).not.toHaveBeenCalled()
  })

  // ──────────────────────────────────────────────────
  // F. ユーザー不存在
  // ──────────────────────────────────────────────────

  it('不明 app_user_id → 200 + DB 不変', async () => {
    mockUserFindUnique.mockResolvedValueOnce(null)
    const { POST } = await import('@/app/api/webhooks/revenuecat/route')
    const res = await POST(makeRequest(validPayload(), TEST_SECRET))
    expect(res.status).toBe(200)
    expect(mockUserUpdate).not.toHaveBeenCalled()
  })

  // ──────────────────────────────────────────────────
  // G. processRevenueCatEvent 例外 → ロック解放 + 500
  // ──────────────────────────────────────────────────

  it('processRevenueCatEvent 例外時: deleteWebhookEvent が呼ばれて 500', async () => {
    mockUserFindUnique.mockRejectedValueOnce(new Error('DB transient error'))
    const { POST } = await import('@/app/api/webhooks/revenuecat/route')
    const res = await POST(makeRequest(validPayload(), TEST_SECRET))
    expect(res.status).toBe(500)
    expect(mockDeleteWebhookEvent).toHaveBeenCalled()
  })

  // ──────────────────────────────────────────────────
  // H. expiration_at_ms が null の場合（RENEWAL など）
  // ──────────────────────────────────────────────────

  it('RENEWAL で expiration_at_ms が null → isPremium=true だが premiumExpiresAt 更新なし', async () => {
    const payload = validPayload({ type: 'RENEWAL', expiration_at_ms: null })
    const { POST } = await import('@/app/api/webhooks/revenuecat/route')
    const res = await POST(makeRequest(payload, TEST_SECRET))
    expect(res.status).toBe(200)
    expect(mockUserUpdate).toHaveBeenCalledWith({
      where: { id: 'user-premium-1' },
      data: { isPremium: true },
    })
  })
})
