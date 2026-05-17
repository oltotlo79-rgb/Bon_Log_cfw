// @vitest-environment node

import { vi } from 'vitest'
// グローバルモックを解除
vi.unmock('@/lib/logger')

// Redisモック
const mockRedis = {
  get: vi.fn(),
  set: vi.fn(),
  del: vi.fn(),
  incr: vi.fn(),
  ttl: vi.fn(),
  expire: vi.fn(),
}

vi.mock('@/lib/redis', () => ({
  getRedisClient: () => mockRedis,
}))

// Loggerモック
vi.mock('@/lib/logger', () => ({
  __esModule: true,
  default: {
    log: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}))

import {
  rateLimit,
  getClientIp,
  checkRateLimit,
  checkDailyLimit,
  checkUserRateLimit,
  RATE_LIMITS,
  DAILY_LIMITS,
} from '@/lib/rate-limit'

describe('Rate Limit Module', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('rateLimit', () => {
    const options = { windowMs: 60000, maxRequests: 10 }

    it('新しいウィンドウでは許可する', async () => {
      // incr-firstパターン: INCRが1を返す（新規キー）
      mockRedis.incr.mockResolvedValue(1)
      mockRedis.expire.mockResolvedValue(undefined)

      const result = await rateLimit('test-key', options)

      expect(result.success).toBe(true)
      expect(result.remaining).toBe(9) // 10 - 1 = 9
      expect(mockRedis.incr).toHaveBeenCalledWith('ratelimit:test-key')
      expect(mockRedis.expire).toHaveBeenCalledWith('ratelimit:test-key', 60)
    })

    it('制限内であれば許可する', async () => {
      mockRedis.incr.mockResolvedValue(6)
      mockRedis.ttl.mockResolvedValue(30)

      const result = await rateLimit('test-key', options)

      expect(result.success).toBe(true)
      expect(result.remaining).toBe(4) // 10 - 6 = 4
    })

    it('制限に達した場合は拒否する', async () => {
      // maxRequests=10, INCRが11を返す（超過）
      mockRedis.incr.mockResolvedValue(11)
      mockRedis.ttl.mockResolvedValue(30)

      const result = await rateLimit('test-key', options)

      expect(result.success).toBe(false)
      expect(result.remaining).toBe(0)
    })

    it('制限を超えた場合も拒否する', async () => {
      mockRedis.incr.mockResolvedValue(15)
      mockRedis.ttl.mockResolvedValue(30)

      const result = await rateLimit('test-key', options)

      expect(result.success).toBe(false)
      expect(result.remaining).toBe(0)
    })

    it('TTLが負の場合はexpireを再設定する', async () => {
      mockRedis.incr.mockResolvedValue(5)
      mockRedis.ttl.mockResolvedValue(-1)
      mockRedis.expire.mockResolvedValue(undefined)

      const result = await rateLimit('test-key', options)

      expect(result.success).toBe(true)
      expect(mockRedis.expire).toHaveBeenCalledWith('ratelimit:test-key', 60)
    })

    it('Redisエラー時はフェイルオープンで許可する', async () => {
      mockRedis.incr.mockRejectedValue(new Error('Redis connection failed'))

      const result = await rateLimit('test-key', options)

      expect(result.success).toBe(true)
      expect(result.remaining).toBe(10)
    })

    it('resetTimeを正しく計算する', async () => {
      const now = Date.now()
      mockRedis.incr.mockResolvedValue(6)
      mockRedis.ttl.mockResolvedValue(30)

      const result = await rateLimit('test-key', options)

      expect(result.resetTime).toBeGreaterThanOrEqual(now + 29000)
      expect(result.resetTime).toBeLessThanOrEqual(now + 31000)
    })
  })

  describe('getClientIp', () => {
    function createMockRequest(headers: Record<string, string>): Request {
      return {
        headers: {
          get: (name: string) => headers[name.toLowerCase()] || null,
        },
      } as unknown as Request
    }

    it('cf-connecting-ipヘッダーを優先する', () => {
      const request = createMockRequest({
        'cf-connecting-ip': '1.2.3.4',
        'x-forwarded-for': '5.6.7.8',
        'x-real-ip': '9.10.11.12',
      })

      expect(getClientIp(request)).toBe('1.2.3.4')
    })

    it('x-forwarded-forの末尾から2番目のIPを取得する（3つ以上の場合）', () => {
      const request = createMockRequest({
        'x-forwarded-for': '1.2.3.4, 5.6.7.8, 9.10.11.12',
      })

      expect(getClientIp(request)).toBe('5.6.7.8')
    })

    it('x-real-ipヘッダーを取得する', () => {
      const request = createMockRequest({
        'x-real-ip': '1.2.3.4',
      })

      expect(getClientIp(request)).toBe('1.2.3.4')
    })

    it('ヘッダーがない場合はunknownを返す', () => {
      const request = createMockRequest({})

      expect(getClientIp(request)).toBe('unknown')
    })

    it('x-forwarded-forの空白をトリムする', () => {
      const request = createMockRequest({
        'x-forwarded-for': '  1.2.3.4  , 5.6.7.8  ',
      })

      expect(getClientIp(request)).toBe('1.2.3.4')
    })

    it('x-forwarded-forが単一IPの場合はそのIPを返す', () => {
      const request = createMockRequest({
        'x-forwarded-for': '1.2.3.4',
      })

      expect(getClientIp(request)).toBe('1.2.3.4')
    })

    it('x-vercel-forwarded-forを優先する（Vercel経由）', () => {
      const request = createMockRequest({
        'x-vercel-forwarded-for': '10.0.0.1',
        'x-forwarded-for': '1.2.3.4',
      })

      expect(getClientIp(request)).toBe('10.0.0.1')
    })
  })

  describe('checkRateLimit', () => {
    function createMockRequest(ip: string): Request {
      return {
        headers: {
          get: (name: string) => (name === 'x-real-ip' ? ip : null),
        },
      } as unknown as Request
    }

    it('プリセット設定でレート制限をチェックする', async () => {
      mockRedis.incr.mockResolvedValue(1)
      mockRedis.expire.mockResolvedValue(undefined)

      const request = createMockRequest('192.168.1.1')
      const result = await checkRateLimit(request, 'api')

      expect(result.success).toBe(true)
      expect(mockRedis.incr).toHaveBeenCalledWith('ratelimit:api:192.168.1.1')
      expect(mockRedis.expire).toHaveBeenCalledWith('ratelimit:api:192.168.1.1', 60)
    })

    it('additionalKeyを含めてキーを生成する', async () => {
      mockRedis.incr.mockResolvedValue(1)
      mockRedis.expire.mockResolvedValue(undefined)

      const request = createMockRequest('192.168.1.1')
      await checkRateLimit(request, 'upload', 'user123')

      expect(mockRedis.incr).toHaveBeenCalledWith('ratelimit:upload:192.168.1.1:user123')
      expect(mockRedis.expire).toHaveBeenCalledWith('ratelimit:upload:192.168.1.1:user123', 60)
    })
  })

  describe('checkDailyLimit', () => {
    it('制限内であれば許可する', async () => {
      mockRedis.get.mockResolvedValue('10')
      mockRedis.incr.mockResolvedValue(11)
      mockRedis.ttl.mockResolvedValue(1000)

      const result = await checkDailyLimit('user123', 'upload')

      expect(result.allowed).toBe(true)
      expect(result.count).toBe(11)
      expect(result.limit).toBe(50)
    })

    it('制限に達した場合は拒否する', async () => {
      mockRedis.incr.mockResolvedValue(51)
      mockRedis.ttl.mockResolvedValue(1000)

      const result = await checkDailyLimit('user123', 'upload')

      expect(result.allowed).toBe(false)
      expect(result.count).toBe(51)
      expect(result.limit).toBe(50)
    })

    it('初回使用時はカウント1から開始する', async () => {
      mockRedis.get.mockResolvedValue(null)
      mockRedis.incr.mockResolvedValue(1)
      mockRedis.ttl.mockResolvedValue(-1)
      mockRedis.expire.mockResolvedValue(undefined)

      const result = await checkDailyLimit('user123', 'upload')

      expect(result.allowed).toBe(true)
      expect(result.count).toBe(1)
    })

    it('TTLが未設定の場合は24時間を設定する', async () => {
      mockRedis.get.mockResolvedValue(null)
      mockRedis.incr.mockResolvedValue(1)
      mockRedis.ttl.mockResolvedValue(-1)
      mockRedis.expire.mockResolvedValue(undefined)

      await checkDailyLimit('user123', 'upload')

      expect(mockRedis.expire).toHaveBeenCalledWith(
        expect.stringContaining('daily:upload:user123:'),
        24 * 60 * 60
      )
    })

    it('Redisエラー時はフェイルオープンで許可する', async () => {
      mockRedis.incr.mockRejectedValue(new Error('Redis error'))

      const result = await checkDailyLimit('user123', 'upload')

      expect(result.allowed).toBe(true)
      expect(result.count).toBe(0)
    })
  })

  describe('Redis 障害時の Sentry 報告', () => {
    /**
     * 本番では Sentry へ送信される。テスト環境（NODE_ENV=test）ではスキップされる。
     * captureException が呼ばれるかは process.env.NODE_ENV を一時的に切替えて検証。
     */
    const origNodeEnv = process.env.NODE_ENV

    beforeEach(() => {
      vi.resetModules()
    })

    afterEach(() => {
      process.env.NODE_ENV = origNodeEnv
    })

    it('NODE_ENV=test では Sentry を呼び出さない（dynamic import がスキップされる）', async () => {
      const captureException = vi.fn()
      vi.doMock('@sentry/nextjs', () => ({ captureException }))

      const { rateLimit } = await import('@/lib/rate-limit')
      mockRedis.incr.mockRejectedValue(new Error('Redis down'))

      const result = await rateLimit('test-key', { windowMs: 60000, maxRequests: 10 })

      expect(result.success).toBe(true) // フェイルオープン
      // テスト環境では送信されない
      expect(captureException).not.toHaveBeenCalled()
    })

    it('Redisエラーでも fail-closed の場合はリクエスト拒否', async () => {
      mockRedis.incr.mockRejectedValue(new Error('Redis down'))

      const { rateLimit } = await import('@/lib/rate-limit')
      const result = await rateLimit('test-key', {
        windowMs: 60000,
        maxRequests: 10,
        failOpen: false,
      })

      expect(result.success).toBe(false)
      expect(result.remaining).toBe(0)
    })
  })

  describe('checkUserRateLimit', () => {
    it('ユーザーIDベースでレート制限をチェックする', async () => {
      mockRedis.incr.mockResolvedValue(1)
      mockRedis.expire.mockResolvedValue(undefined)

      const result = await checkUserRateLimit('user123', 'post')

      expect(result.success).toBe(true)
      expect(mockRedis.incr).toHaveBeenCalledWith('ratelimit:post:user:user123')
      expect(mockRedis.expire).toHaveBeenCalledWith('ratelimit:post:user:user123', 60)
    })

    it('プリセット設定の制限値を適用する', async () => {
      // post制限は1分3回、INCRが4を返す（超過）
      mockRedis.incr.mockResolvedValue(4)
      mockRedis.ttl.mockResolvedValue(30)

      const result = await checkUserRateLimit('user123', 'post')

      // post制限は1分3回
      expect(result.success).toBe(false)
      expect(result.remaining).toBe(0)
    })
  })

  describe('RATE_LIMITS', () => {
    it('各プリセットが定義されている', () => {
      expect(RATE_LIMITS.api).toEqual({ windowMs: 60000, maxRequests: 60 })
      expect(RATE_LIMITS.login).toEqual({ windowMs: 15 * 60 * 1000, maxRequests: 5, failOpen: false })
      expect(RATE_LIMITS.register).toEqual({ windowMs: 60 * 60 * 1000, maxRequests: 3, failOpen: false })
      expect(RATE_LIMITS.passwordReset).toEqual({ windowMs: 60 * 60 * 1000, maxRequests: 3, failOpen: false })
      expect(RATE_LIMITS.upload).toEqual({ windowMs: 60000, maxRequests: 5, failOpen: false })
      expect(RATE_LIMITS.search).toEqual({ windowMs: 60000, maxRequests: 20 })
      expect(RATE_LIMITS.comment).toEqual({ windowMs: 60000, maxRequests: 5 })
      expect(RATE_LIMITS.post).toEqual({ windowMs: 60000, maxRequests: 3 })
      expect(RATE_LIMITS.engagement).toEqual({ windowMs: 60000, maxRequests: 30 })
      expect(RATE_LIMITS.timeline).toEqual({ windowMs: 60000, maxRequests: 30 })
    })
  })

  describe('DAILY_LIMITS', () => {
    it('日次制限が定義されている', () => {
      expect(DAILY_LIMITS.upload).toBe(50)
    })
  })
})
