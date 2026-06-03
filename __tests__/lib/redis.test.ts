// @vitest-environment node

import { vi } from 'vitest'
// Upstash Redisのモック
const mockRedisGet = vi.fn()
const mockRedisSet = vi.fn()
const mockRedisDel = vi.fn()
const mockRedisGetdel = vi.fn()
const mockRedisIncr = vi.fn()
const mockRedisExpire = vi.fn()
const mockRedisTtl = vi.fn()

vi.mock('@upstash/redis', () => ({
  Redis: vi.fn().mockImplementation(function() { return {
    get: mockRedisGet,
    set: mockRedisSet,
    del: mockRedisDel,
    getdel: mockRedisGetdel,
    incr: mockRedisIncr,
    expire: mockRedisExpire,
    ttl: mockRedisTtl,
  } }),
}))

// loggerのモック
vi.mock('@/lib/logger', () => ({
  __esModule: true,
  default: {
    log: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}))

describe('redis', async () => {
  const originalEnv = process.env

  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    process.env = { ...originalEnv }
    delete process.env.UPSTASH_REDIS_REST_URL
    delete process.env.UPSTASH_REDIS_REST_TOKEN
  })

  afterAll(() => {
    process.env = originalEnv
  })

  // ============================================================
  // InMemoryStore Tests
  // ============================================================

  describe('InMemoryStore (Redis未設定時)', async () => {
    it('getRedisClient()がインメモリストアを返す', async () => {
      const { getRedisClient } = await import('@/lib/redis')
      const client = getRedisClient()

      expect(client).toBeDefined()
      expect(client.get).toBeDefined()
      expect(client.set).toBeDefined()
    })

    it('同じインスタンスを返す（シングルトン）', async () => {
      const { getRedisClient } = await import('@/lib/redis')
      const client1 = getRedisClient()
      const client2 = getRedisClient()

      expect(client1).toBe(client2)
    })

    describe('set/get', async () => {
      it('値を保存して取得できる', async () => {
        const { getRedisClient } = await import('@/lib/redis')
        const client = getRedisClient()

        await client.set('test-key', 'test-value')
        const result = await client.get('test-key')

        expect(result).toBe('test-value')
      })

      it('存在しないキーはnullを返す', async () => {
        const { getRedisClient } = await import('@/lib/redis')
        const client = getRedisClient()

        const result = await client.get('non-existent-key')

        expect(result).toBeNull()
      })

      it('有効期限付きで保存できる', async () => {
        const { getRedisClient } = await import('@/lib/redis')
        const client = getRedisClient()

        await client.set('expiring-key', 'value', { ex: 10 })
        const result = await client.get('expiring-key')

        expect(result).toBe('value')
      })

      it('期限切れのキーはnullを返す', async () => {
        vi.useFakeTimers({ shouldAdvanceTime: true })
        const { getRedisClient } = await import('@/lib/redis')
        const client = getRedisClient()

        await client.set('expiring-key-2', 'value', { ex: 1 })

        // 2秒後にアクセス
        vi.advanceTimersByTime(2000)

        const result = await client.get('expiring-key-2')
        expect(result).toBeNull()

        vi.useRealTimers()
      })
    })

    describe('del', async () => {
      it('キーを削除できる', async () => {
        const { getRedisClient } = await import('@/lib/redis')
        const client = getRedisClient()

        await client.set('delete-key', 'value')
        await client.del('delete-key')
        const result = await client.get('delete-key')

        expect(result).toBeNull()
      })
    })

    describe('getdel', async () => {
      it('値を返すと同時にキーを削除する（単回使用）', async () => {
        const { getRedisClient } = await import('@/lib/redis')
        const client = getRedisClient()

        await client.set('getdel-key', 'once')
        const first = await client.getdel('getdel-key')
        const second = await client.getdel('getdel-key')

        expect(first).toBe('once')
        expect(second).toBeNull()
        // get でも消えていることを確認
        expect(await client.get('getdel-key')).toBeNull()
      })

      it('存在しないキーは null を返す', async () => {
        const { getRedisClient } = await import('@/lib/redis')
        const client = getRedisClient()

        expect(await client.getdel('getdel-missing')).toBeNull()
      })

      it('期限切れキーは null を返し副作用なし', async () => {
        vi.useFakeTimers({ shouldAdvanceTime: true })
        const { getRedisClient } = await import('@/lib/redis')
        const client = getRedisClient()

        await client.set('getdel-expiring', 'value', { ex: 1 })
        vi.advanceTimersByTime(2000)

        expect(await client.getdel('getdel-expiring')).toBeNull()

        vi.useRealTimers()
      })
    })

    describe('incr', async () => {
      it('存在しないキーは0から開始して1を返す', async () => {
        const { getRedisClient } = await import('@/lib/redis')
        const client = getRedisClient()

        const result = await client.incr('counter-new')

        expect(result).toBe(1)
      })

      it('既存の値をインクリメントする', async () => {
        const { getRedisClient } = await import('@/lib/redis')
        const client = getRedisClient()

        await client.set('counter-existing', '5')
        const result = await client.incr('counter-existing')

        expect(result).toBe(6)
      })

      it('連続でインクリメントできる', async () => {
        const { getRedisClient } = await import('@/lib/redis')
        const client = getRedisClient()

        const r1 = await client.incr('counter-multi')
        const r2 = await client.incr('counter-multi')
        const r3 = await client.incr('counter-multi')

        expect(r1).toBe(1)
        expect(r2).toBe(2)
        expect(r3).toBe(3)
      })
    })

    describe('expire', async () => {
      it('既存キーに有効期限を設定できる', async () => {
        vi.useFakeTimers({ shouldAdvanceTime: true })
        const { getRedisClient } = await import('@/lib/redis')
        const client = getRedisClient()

        await client.set('expire-key', 'value')
        await client.expire('expire-key', 1)

        // 有効期限前は取得できる
        const before = await client.get('expire-key')
        expect(before).toBe('value')

        // 2秒後は取得できない
        vi.advanceTimersByTime(2000)
        const after = await client.get('expire-key')
        expect(after).toBeNull()

        vi.useRealTimers()
      })

      it('存在しないキーには何もしない', async () => {
        const { getRedisClient } = await import('@/lib/redis')
        const client = getRedisClient()

        // エラーが発生しないことを確認
        await expect(client.expire('non-existent', 10)).resolves.toBeUndefined()
      })
    })

    describe('ttl', async () => {
      it('有効期限が設定されていないキーは-1を返す', async () => {
        const { getRedisClient } = await import('@/lib/redis')
        const client = getRedisClient()

        await client.set('no-ttl-key', 'value')
        const ttl = await client.ttl('no-ttl-key')

        expect(ttl).toBe(-1)
      })

      it('存在しないキーは-1を返す', async () => {
        const { getRedisClient } = await import('@/lib/redis')
        const client = getRedisClient()

        const ttl = await client.ttl('non-existent-ttl')

        expect(ttl).toBe(-1)
      })

      it('残りの有効期限を返す', async () => {
        vi.useFakeTimers({ shouldAdvanceTime: true })
        const { getRedisClient } = await import('@/lib/redis')
        const client = getRedisClient()

        await client.set('ttl-key', 'value', { ex: 60 })
        const ttl = await client.ttl('ttl-key')

        expect(ttl).toBeGreaterThan(50)
        expect(ttl).toBeLessThanOrEqual(60)

        vi.useRealTimers()
      })

      it('期限切れのキーは-2を返す', async () => {
        vi.useFakeTimers({ shouldAdvanceTime: true })
        const { getRedisClient } = await import('@/lib/redis')
        const client = getRedisClient()

        await client.set('expired-ttl-key', 'value', { ex: 1 })

        // 2秒後
        vi.advanceTimersByTime(2000)
        const ttl = await client.ttl('expired-ttl-key')

        expect(ttl).toBe(-2)

        vi.useRealTimers()
      })
    })
  })

  // ============================================================
  // UpstashRedisStore Tests
  // ============================================================

  describe('UpstashRedisStore (Redis設定時)', async () => {
    beforeEach(() => {
      process.env.UPSTASH_REDIS_REST_URL = 'https://test.upstash.io'
      process.env.UPSTASH_REDIS_REST_TOKEN = 'test-token'
    })

    it('Upstash Redisクライアントを使用する', async () => {
      const { Redis } = await import('@upstash/redis')
      const { getRedisClient } = await import('@/lib/redis')

      getRedisClient()

      expect(Redis).toHaveBeenCalledWith({
        url: 'https://test.upstash.io',
        token: 'test-token',
      })
    })

    describe('get', async () => {
      it('Redis.getを呼び出す', async () => {
        mockRedisGet.mockResolvedValueOnce('redis-value')

        const { getRedisClient } = await import('@/lib/redis')
        const client = getRedisClient()

        const result = await client.get('redis-key')

        expect(mockRedisGet).toHaveBeenCalledWith('redis-key')
        expect(result).toBe('redis-value')
      })
    })

    describe('set', async () => {
      it('有効期限なしでRedis.setを呼び出す', async () => {
        mockRedisSet.mockResolvedValueOnce('OK')

        const { getRedisClient } = await import('@/lib/redis')
        const client = getRedisClient()

        await client.set('redis-key', 'redis-value')

        expect(mockRedisSet).toHaveBeenCalledWith('redis-key', 'redis-value')
      })

      it('有効期限付きでRedis.setを呼び出す', async () => {
        mockRedisSet.mockResolvedValueOnce('OK')

        const { getRedisClient } = await import('@/lib/redis')
        const client = getRedisClient()

        await client.set('redis-key', 'redis-value', { ex: 60 })

        expect(mockRedisSet).toHaveBeenCalledWith('redis-key', 'redis-value', { ex: 60 })
      })
    })

    describe('del', async () => {
      it('Redis.delを呼び出す', async () => {
        mockRedisDel.mockResolvedValueOnce(1)

        const { getRedisClient } = await import('@/lib/redis')
        const client = getRedisClient()

        await client.del('redis-key')

        expect(mockRedisDel).toHaveBeenCalledWith('redis-key')
      })
    })

    describe('getdel', async () => {
      it('Redis.getdelを呼び出して値を返す', async () => {
        mockRedisGetdel.mockResolvedValueOnce('redis-once')

        const { getRedisClient } = await import('@/lib/redis')
        const client = getRedisClient()

        const result = await client.getdel('redis-key')

        expect(mockRedisGetdel).toHaveBeenCalledWith('redis-key')
        expect(result).toBe('redis-once')
      })
    })

    describe('incr', async () => {
      it('Redis.incrを呼び出す', async () => {
        mockRedisIncr.mockResolvedValueOnce(5)

        const { getRedisClient } = await import('@/lib/redis')
        const client = getRedisClient()

        const result = await client.incr('counter')

        expect(mockRedisIncr).toHaveBeenCalledWith('counter')
        expect(result).toBe(5)
      })
    })

    describe('expire', async () => {
      it('Redis.expireを呼び出す', async () => {
        mockRedisExpire.mockResolvedValueOnce(1)

        const { getRedisClient } = await import('@/lib/redis')
        const client = getRedisClient()

        await client.expire('redis-key', 120)

        expect(mockRedisExpire).toHaveBeenCalledWith('redis-key', 120)
      })
    })

    describe('ttl', async () => {
      it('Redis.ttlを呼び出す', async () => {
        mockRedisTtl.mockResolvedValueOnce(45)

        const { getRedisClient } = await import('@/lib/redis')
        const client = getRedisClient()

        const result = await client.ttl('redis-key')

        expect(mockRedisTtl).toHaveBeenCalledWith('redis-key')
        expect(result).toBe(45)
      })
    })
  })

  // ============================================================
  // redis Export Tests
  // ============================================================

  describe('redis エクスポート', async () => {
    it('redis.clientでクライアントにアクセスできる', async () => {
      const { redis } = await import('@/lib/redis')

      expect(redis.client).toBeDefined()
      expect(redis.client.get).toBeDefined()
    })

    it('redis.clientは毎回同じインスタンスを返す', async () => {
      const { redis } = await import('@/lib/redis')

      const client1 = redis.client
      const client2 = redis.client

      expect(client1).toBe(client2)
    })
  })
})
