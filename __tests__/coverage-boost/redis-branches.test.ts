// @vitest-environment node
/**
 * redis.ts 追加ブランチカバレッジテスト
 *
 * InMemoryStoreのクリーンアップ閾値超過パスをテスト
 */
import { vi } from 'vitest'

vi.mock('@upstash/redis', () => ({
  Redis: vi.fn().mockImplementation(function() { return {
    get: vi.fn(),
    set: vi.fn(),
    del: vi.fn(),
    incr: vi.fn(),
    expire: vi.fn(),
    ttl: vi.fn(),
  } }),
}))

vi.mock('@/lib/logger', () => ({
  __esModule: true,
  default: {
    log: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}))

describe('redis.ts 追加ブランチテスト', () => {
  const originalEnv = { ...process.env }

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

  describe('InMemoryStore - CLEANUP_THRESHOLD超過パス', () => {
    it('ストアサイズが閾値を超えた場合にクリーンアップが実行される', async () => {
      const { getRedisClient } = await import('@/lib/redis')
      const client = getRedisClient()

      // 閾値（1000）を超えるエントリを追加
      // 期限付きのエントリを多数追加
      for (let i = 0; i < 1002; i++) {
        await client.set(`key-${i}`, `value-${i}`, { ex: 1 })
      }

      // 時間を進めて期限切れにする
      vi.useFakeTimers({ shouldAdvanceTime: true })
      vi.advanceTimersByTime(2000)

      // 新しいエントリを追加 - これがクリーンアップをトリガーする
      await client.set('new-key', 'new-value')

      // クリーンアップ後、期限切れエントリが削除されている
      const result = await client.get('key-0')
      expect(result).toBeNull()

      // 新しいエントリは取得できる
      const newResult = await client.get('new-key')
      expect(newResult).toBe('new-value')

      vi.useRealTimers()
    })
  })

  describe('InMemoryStore - incr with non-numeric value', () => {
    it('数値でない値のキーをインクリメントすると0として扱う', async () => {
      const { getRedisClient } = await import('@/lib/redis')
      const client = getRedisClient()

      await client.set('non-numeric', 'abc')
      const result = await client.incr('non-numeric')

      // parseInt('abc', 10) = NaN || 0 = 0, then +1 = 1
      expect(result).toBe(1)
    })
  })

  describe('InMemoryStore - ttl with no expiresAt', () => {
    it('expiresAtがnullのエントリは-1を返す', async () => {
      const { getRedisClient } = await import('@/lib/redis')
      const client = getRedisClient()

      await client.set('no-expiry', 'value')
      const ttl = await client.ttl('no-expiry')

      expect(ttl).toBe(-1)
    })
  })

  describe('getRedisClient - Upstash設定時', () => {
    it('環境変数が設定されている場合UpstashRedisStoreを使用する', async () => {
      process.env.UPSTASH_REDIS_REST_URL = 'https://test.upstash.io'
      process.env.UPSTASH_REDIS_REST_TOKEN = 'test-token'

      const { Redis } = await import('@upstash/redis')
      const { getRedisClient } = await import('@/lib/redis')

      getRedisClient()

      expect(Redis).toHaveBeenCalledWith({
        url: 'https://test.upstash.io',
        token: 'test-token',
      })
    })

    it('URLのみ設定でトークンなしの場合インメモリを使用する', async () => {
      process.env.UPSTASH_REDIS_REST_URL = 'https://test.upstash.io'
      delete process.env.UPSTASH_REDIS_REST_TOKEN

      const { Redis } = await import('@upstash/redis')
      const { getRedisClient } = await import('@/lib/redis')

      getRedisClient()

      // Redisは呼ばれない（トークンがないため）
      expect(Redis).not.toHaveBeenCalled()
    })
  })
})
