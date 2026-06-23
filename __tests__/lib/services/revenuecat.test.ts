// @vitest-environment node
/**
 * lib/services/revenuecat の processRevenueCatEvent 単体テスト
 *
 * ユーザー不存在・各イベントタイプ別の DB 更新・未知イベントの無視を検証する。
 */
import { vi, describe, it, expect, beforeEach } from 'vitest'

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
// テストデータ
// ──────────────────────────────────────────────────

function makeEvent(overrides: Record<string, unknown> = {}) {
  return {
    id: 'evt-test-001',
    type: 'INITIAL_PURCHASE',
    app_user_id: 'user-premium-1',
    expiration_at_ms: Date.now() + 30 * 24 * 60 * 60 * 1000,
    ...overrides,
  }
}

describe('processRevenueCatEvent', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUserFindUnique.mockResolvedValue({ id: 'user-premium-1' })
    mockUserUpdate.mockResolvedValue({})
  })

  // ──────────────────────────────────────────────────
  // ユーザー不存在
  // ──────────────────────────────────────────────────

  it('ユーザー不存在 → { handled: true } 返却 + DB 不変', async () => {
    mockUserFindUnique.mockResolvedValueOnce(null)
    const { processRevenueCatEvent } = await import('@/lib/services/revenuecat')
    const result = await processRevenueCatEvent(makeEvent())

    expect(result).toEqual({ handled: true })
    expect(mockUserUpdate).not.toHaveBeenCalled()
  })

  // ──────────────────────────────────────────────────
  // INITIAL_PURCHASE
  // ──────────────────────────────────────────────────

  it('INITIAL_PURCHASE: isPremium=true + premiumExpiresAt を更新', async () => {
    const expirationAtMs = Date.now() + 30 * 24 * 60 * 60 * 1000
    const { processRevenueCatEvent } = await import('@/lib/services/revenuecat')
    const result = await processRevenueCatEvent(makeEvent({ type: 'INITIAL_PURCHASE', expiration_at_ms: expirationAtMs }))

    expect(result).toMatchObject({ handled: true, userId: 'user-premium-1' })
    expect(mockUserUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'user-premium-1' },
        data: expect.objectContaining({ isPremium: true }),
      }),
    )
  })

  it('INITIAL_PURCHASE で expiration_at_ms が null → premiumExpiresAt 更新なし', async () => {
    const { processRevenueCatEvent } = await import('@/lib/services/revenuecat')
    await processRevenueCatEvent(makeEvent({ type: 'INITIAL_PURCHASE', expiration_at_ms: null }))

    expect(mockUserUpdate).toHaveBeenCalledWith({
      where: { id: 'user-premium-1' },
      data: { isPremium: true },
    })
  })

  it('INITIAL_PURCHASE で expiration_at_ms が undefined → premiumExpiresAt 更新なし', async () => {
    const { processRevenueCatEvent } = await import('@/lib/services/revenuecat')
    // expiration_at_ms を含まないイベントを直接構築して undefined 相当を再現する
    const event = makeEvent({ type: 'INITIAL_PURCHASE', expiration_at_ms: undefined })
    await processRevenueCatEvent(event)

    expect(mockUserUpdate).toHaveBeenCalledWith({
      where: { id: 'user-premium-1' },
      data: { isPremium: true },
    })
  })

  // ──────────────────────────────────────────────────
  // RENEWAL
  // ──────────────────────────────────────────────────

  it('RENEWAL: isPremium=true + premiumExpiresAt を更新', async () => {
    const expirationAtMs = Date.now() + 30 * 24 * 60 * 60 * 1000
    const { processRevenueCatEvent } = await import('@/lib/services/revenuecat')
    const result = await processRevenueCatEvent(makeEvent({ type: 'RENEWAL', expiration_at_ms: expirationAtMs }))

    expect(result).toMatchObject({ handled: true, userId: 'user-premium-1' })
    expect(mockUserUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ isPremium: true }),
      }),
    )
  })

  // ──────────────────────────────────────────────────
  // CANCELLATION
  // ──────────────────────────────────────────────────

  it('CANCELLATION: DB 更新なし・{ handled: true, userId } を返す', async () => {
    const { processRevenueCatEvent } = await import('@/lib/services/revenuecat')
    const result = await processRevenueCatEvent(makeEvent({ type: 'CANCELLATION' }))

    expect(result).toMatchObject({ handled: true, userId: 'user-premium-1' })
    expect(mockUserUpdate).not.toHaveBeenCalled()
  })

  // ──────────────────────────────────────────────────
  // EXPIRATION
  // ──────────────────────────────────────────────────

  it('EXPIRATION: isPremium=false + premiumExpiresAt=null に更新', async () => {
    const { processRevenueCatEvent } = await import('@/lib/services/revenuecat')
    const result = await processRevenueCatEvent(makeEvent({ type: 'EXPIRATION' }))

    expect(result).toMatchObject({ handled: true, userId: 'user-premium-1' })
    expect(mockUserUpdate).toHaveBeenCalledWith({
      where: { id: 'user-premium-1' },
      data: { isPremium: false, premiumExpiresAt: null },
    })
  })

  // ──────────────────────────────────────────────────
  // 未知イベントタイプ
  // ──────────────────────────────────────────────────

  it('未知 event.type → { handled: false } + DB 不変', async () => {
    const { processRevenueCatEvent } = await import('@/lib/services/revenuecat')
    const result = await processRevenueCatEvent(makeEvent({ type: 'PRODUCT_CHANGE' }))

    expect(result).toEqual({ handled: false })
    expect(mockUserUpdate).not.toHaveBeenCalled()
  })

  it('SUBSCRIBER_ALIAS も無視される', async () => {
    const { processRevenueCatEvent } = await import('@/lib/services/revenuecat')
    const result = await processRevenueCatEvent(makeEvent({ type: 'SUBSCRIBER_ALIAS' }))

    expect(result).toEqual({ handled: false })
  })

  // ──────────────────────────────────────────────────
  // premiumExpiresAt が正しく Date に変換される
  // ──────────────────────────────────────────────────

  it('expiration_at_ms が Date に変換されて premiumExpiresAt に渡される', async () => {
    const expirationAtMs = 1800000000000
    const { processRevenueCatEvent } = await import('@/lib/services/revenuecat')
    await processRevenueCatEvent(makeEvent({ type: 'INITIAL_PURCHASE', expiration_at_ms: expirationAtMs }))

    expect(mockUserUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          premiumExpiresAt: new Date(expirationAtMs),
        }),
      }),
    )
  })
})

// ──────────────────────────────────────────────────
// revenueCatPayloadSchema / revenueCatEventSchema の Zod バリデーション
// ──────────────────────────────────────────────────

describe('revenueCatPayloadSchema', () => {
  it('正常なペイロードをパース可能', async () => {
    const { revenueCatPayloadSchema } = await import('@/lib/services/revenuecat')
    const result = revenueCatPayloadSchema.safeParse({
      event: {
        id: 'evt-001',
        type: 'INITIAL_PURCHASE',
        app_user_id: 'user-1',
        expiration_at_ms: 1800000000000,
      },
      api_version: '1.0',
    })
    expect(result.success).toBe(true)
  })

  it('event がないとパース失敗', async () => {
    const { revenueCatPayloadSchema } = await import('@/lib/services/revenuecat')
    const result = revenueCatPayloadSchema.safeParse({ api_version: '1.0' })
    expect(result.success).toBe(false)
  })

  it('event.id がないとパース失敗', async () => {
    const { revenueCatPayloadSchema } = await import('@/lib/services/revenuecat')
    const result = revenueCatPayloadSchema.safeParse({
      event: { type: 'INITIAL_PURCHASE', app_user_id: 'user-1' },
    })
    expect(result.success).toBe(false)
  })

  it('event.type がないとパース失敗', async () => {
    const { revenueCatPayloadSchema } = await import('@/lib/services/revenuecat')
    const result = revenueCatPayloadSchema.safeParse({
      event: { id: 'evt-001', app_user_id: 'user-1' },
    })
    expect(result.success).toBe(false)
  })

  it('event.app_user_id がないとパース失敗', async () => {
    const { revenueCatPayloadSchema } = await import('@/lib/services/revenuecat')
    const result = revenueCatPayloadSchema.safeParse({
      event: { id: 'evt-001', type: 'INITIAL_PURCHASE' },
    })
    expect(result.success).toBe(false)
  })

  it('expiration_at_ms が null でもパース可能（CANCELLATION など）', async () => {
    const { revenueCatPayloadSchema } = await import('@/lib/services/revenuecat')
    const result = revenueCatPayloadSchema.safeParse({
      event: {
        id: 'evt-002',
        type: 'CANCELLATION',
        app_user_id: 'user-1',
        expiration_at_ms: null,
      },
    })
    expect(result.success).toBe(true)
  })

  it('未知フィールドが passthrough されても型に影響しない', async () => {
    const { revenueCatPayloadSchema } = await import('@/lib/services/revenuecat')
    const result = revenueCatPayloadSchema.safeParse({
      event: {
        id: 'evt-003',
        type: 'RENEWAL',
        app_user_id: 'user-1',
        unknown_future_field: 'some_value',
      },
      api_version: '1.0',
      another_unknown: 123,
    })
    // passthrough ではなく strict/strip のどちらかに依存するが、スキーマが passthrough なら success
    // スキーマを確認: revenueCatEventSchema は passthrough() を使っていない（デフォルト strip）
    // ただし revenueCatPayloadSchema も passthrough() 不使用なので成功するかチェック
    expect(result.success).toBe(true)
  })
})
