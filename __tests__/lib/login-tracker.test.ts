// @vitest-environment node

import { vi } from 'vitest'
// グローバルモックを解除
vi.unmock('@/lib/logger')

// Redisモック
const mockRedis = {
  get: vi.fn(),
  set: vi.fn(),
  del: vi.fn(),
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
  checkLoginAttempt,
  recordFailedLogin,
  resetLoginAttempts,
  getLoginKey,
} from '@/lib/login-tracker'

describe('Login Tracker Module', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('getLoginKey', () => {
    it('IPとメールを組み合わせたキーを生成する', () => {
      const key = getLoginKey('192.168.1.1', 'user@example.com')
      expect(key).toBe('192.168.1.1:user@example.com')
    })

    it('メールアドレスを小文字に正規化する', () => {
      const key = getLoginKey('192.168.1.1', 'User@Example.COM')
      expect(key).toBe('192.168.1.1:user@example.com')
    })
  })

  describe('checkLoginAttempt', () => {
    it('新規ユーザーには最大試行回数を許可する', async () => {
      mockRedis.get.mockResolvedValue(null)

      const result = await checkLoginAttempt('test-identifier')

      expect(result.allowed).toBe(true)
      expect(result.remainingAttempts).toBe(5)
      expect(result.lockedUntil).toBeNull()
    })

    it('試行回数に余裕がある場合は許可する', async () => {
      mockRedis.get.mockResolvedValue(JSON.stringify({ count: 2, lockedUntil: null }))

      const result = await checkLoginAttempt('test-identifier')

      expect(result.allowed).toBe(true)
      expect(result.remainingAttempts).toBe(3)
      expect(result.lockedUntil).toBeNull()
    })

    it('試行回数が上限に達した場合は拒否する', async () => {
      mockRedis.get.mockResolvedValue(JSON.stringify({ count: 5, lockedUntil: null }))

      const result = await checkLoginAttempt('test-identifier')

      expect(result.allowed).toBe(false)
      expect(result.remainingAttempts).toBe(0)
      expect(result.message).toContain('上限に達しました')
    })

    it('ロックアウト中は拒否する', async () => {
      const lockedUntil = Date.now() + 30 * 60 * 1000 // 30分後
      mockRedis.get.mockResolvedValue(JSON.stringify({ count: 5, lockedUntil }))

      const result = await checkLoginAttempt('test-identifier')

      expect(result.allowed).toBe(false)
      expect(result.remainingAttempts).toBe(0)
      expect(result.lockedUntil).toBe(lockedUntil)
      expect(result.message).toContain('ロックされています')
    })

    it('ロックアウト期限切れの場合は拒否する（カウントはまだ残っている）', async () => {
      const lockedUntil = Date.now() - 1000 // 1秒前（期限切れ）
      mockRedis.get.mockResolvedValue(JSON.stringify({ count: 5, lockedUntil }))

      const result = await checkLoginAttempt('test-identifier')

      // カウントが5なので拒否
      expect(result.allowed).toBe(false)
    })

    it('Redisエラー時はフェイルクローズで拒否する', async () => {
      mockRedis.get.mockRejectedValue(new Error('Redis connection failed'))

      const result = await checkLoginAttempt('test-identifier')

      expect(result.allowed).toBe(false)
      expect(result.remainingAttempts).toBe(0)
      expect(result.message).toBeDefined()
    })

    it('不正なJSONデータの場合は新規ユーザーとして扱う', async () => {
      mockRedis.get.mockResolvedValue('invalid json')

      const result = await checkLoginAttempt('test-identifier')

      expect(result.allowed).toBe(true)
      expect(result.remainingAttempts).toBe(5)
    })

    it('スキーマに合わないデータ（型不一致）も新規扱い（Zod 検証）', async () => {
      // count が文字列、lockedUntil 欠落の破損データ
      mockRedis.get.mockResolvedValue(JSON.stringify({ count: 'wrong', extra: 'noise' }))

      const result = await checkLoginAttempt('test-identifier')

      expect(result.allowed).toBe(true)
      expect(result.remainingAttempts).toBe(5)
    })

    it('count が負数のデータ（過去バージョン互換）は新規扱い', async () => {
      mockRedis.get.mockResolvedValue(JSON.stringify({ count: -1, lockedUntil: null }))

      const result = await checkLoginAttempt('test-identifier')

      expect(result.allowed).toBe(true)
      expect(result.remainingAttempts).toBe(5)
    })
  })

  describe('recordFailedLogin', () => {
    it('初回失敗時はカウント1で記録する', async () => {
      mockRedis.get.mockResolvedValue(null)
      mockRedis.set.mockResolvedValue(undefined)

      const result = await recordFailedLogin('test-identifier')

      expect(result.allowed).toBe(true)
      expect(result.remainingAttempts).toBe(4)
      expect(mockRedis.set).toHaveBeenCalledWith(
        'login_attempt:test-identifier',
        JSON.stringify({ count: 1, lockedUntil: null }),
        { ex: 15 * 60 }
      )
    })

    it('失敗時にカウントをインクリメントする', async () => {
      mockRedis.get.mockResolvedValue(JSON.stringify({ count: 2, lockedUntil: null }))
      mockRedis.set.mockResolvedValue(undefined)

      const result = await recordFailedLogin('test-identifier')

      expect(result.allowed).toBe(true)
      expect(result.remainingAttempts).toBe(2) // 5 - 3 = 2
    })

    it('上限に達した場合はロックアウトを設定する', async () => {
      mockRedis.get.mockResolvedValue(JSON.stringify({ count: 4, lockedUntil: null }))
      mockRedis.set.mockResolvedValue(undefined)

      const result = await recordFailedLogin('test-identifier')

      expect(result.allowed).toBe(false)
      expect(result.remainingAttempts).toBe(0)
      expect(result.lockedUntil).toBeDefined()
      expect(result.message).toContain('30分後')
    })

    it('Redisエラー時はフェイルオープンで許可する（ログイン自体をブロックしない）', async () => {
      mockRedis.get.mockRejectedValue(new Error('Redis error'))
      mockRedis.set.mockRejectedValue(new Error('Redis error'))

      const result = await recordFailedLogin('192.168.1.1:user@example.com')

      // fail-open: Redis障害でもログイン試行は許可する
      expect(result.allowed).toBe(true)
    })
  })

  describe('resetLoginAttempts', () => {
    it('ログイン成功時にカウンターを削除する', async () => {
      mockRedis.del.mockResolvedValue(undefined)

      await resetLoginAttempts('test-identifier')

      expect(mockRedis.del).toHaveBeenCalledWith('login_attempt:test-identifier')
    })

    it('Redisエラー時でもエラーをスローしない', async () => {
      mockRedis.del.mockRejectedValue(new Error('Redis error'))

      // エラーがスローされないことを確認
      await expect(resetLoginAttempts('test-identifier')).resolves.toBeUndefined()
    })
  })

  describe('getIpOnlyKey', () => {
    it('IP単位のキーを生成する', async () => {
      const { getIpOnlyKey } = await import('@/lib/login-tracker')
      const key = getIpOnlyKey('10.0.0.1')
      expect(key).toBe('ip_only:10.0.0.1')
    })
  })

  describe('checkLoginAttempt - IP-level checks', () => {
    it('IP単位でロックアウトされている場合は拒否する', async () => {
      const ipLockedUntil = Date.now() + 30 * 60 * 1000
      // First call: IP-level check returns locked data
      mockRedis.get.mockImplementation((key: string) => {
        if (key.includes('ip_only')) {
          return Promise.resolve(JSON.stringify({ count: 20, lockedUntil: ipLockedUntil }))
        }
        return Promise.resolve(null)
      })

      const result = await checkLoginAttempt('192.168.1.1:user@example.com')

      expect(result.allowed).toBe(false)
      expect(result.remainingAttempts).toBe(0)
      expect(result.message).toContain('上限に達しました')
    })

    it('IP単位で試行回数上限に達した場合は拒否する', async () => {
      mockRedis.get.mockImplementation((key: string) => {
        if (key.includes('ip_only')) {
          return Promise.resolve(JSON.stringify({ count: 20, lockedUntil: null }))
        }
        return Promise.resolve(null)
      })

      const result = await checkLoginAttempt('192.168.1.1:user@example.com')

      expect(result.allowed).toBe(false)
      expect(result.remainingAttempts).toBe(0)
      expect(result.message).toContain('上限に達しました')
    })

    it('IP単位でロックアウトされていなければメール単位チェックに進む', async () => {
      mockRedis.get.mockImplementation((key: string) => {
        if (key.includes('ip_only')) {
          return Promise.resolve(JSON.stringify({ count: 3, lockedUntil: null }))
        }
        return Promise.resolve(null)
      })

      const result = await checkLoginAttempt('192.168.1.1:user@example.com')

      expect(result.allowed).toBe(true)
      expect(result.remainingAttempts).toBe(5)
    })
  })

  describe('recordFailedLogin - IP-level counter', () => {
    it('IP単位のカウンターを新規作成する（identifier に : を含む場合）', async () => {
      mockRedis.get.mockResolvedValue(null)
      mockRedis.set.mockResolvedValue(undefined)

      await recordFailedLogin('192.168.1.1:user@example.com')

      // IP-only key should be set
      expect(mockRedis.set).toHaveBeenCalledWith(
        'login_attempt:ip_only:192.168.1.1',
        JSON.stringify({ count: 1, lockedUntil: null }),
        expect.objectContaining({ ex: expect.any(Number) })
      )
    })

    it('IP単位のカウンターをインクリメントする', async () => {
      mockRedis.get.mockImplementation((key: string) => {
        if (key.includes('ip_only')) {
          return Promise.resolve(JSON.stringify({ count: 5, lockedUntil: null }))
        }
        return Promise.resolve(null)
      })
      mockRedis.set.mockResolvedValue(undefined)

      await recordFailedLogin('192.168.1.1:user@example.com')

      // IP counter should be incremented to 6
      expect(mockRedis.set).toHaveBeenCalledWith(
        'login_attempt:ip_only:192.168.1.1',
        JSON.stringify({ count: 6, lockedUntil: null }),
        expect.objectContaining({ ex: expect.any(Number) })
      )
    })

    it('IP単位で上限に達した場合はロックアウトを設定する', async () => {
      mockRedis.get.mockImplementation((key: string) => {
        if (key.includes('ip_only')) {
          return Promise.resolve(JSON.stringify({ count: 19, lockedUntil: null }))
        }
        return Promise.resolve(null)
      })
      mockRedis.set.mockResolvedValue(undefined)

      await recordFailedLogin('192.168.1.1:user@example.com')

      // IP counter should be set with lockedUntil
      const ipSetCall = (mockRedis.set as ReturnType<typeof vi.fn>).mock.calls.find(
        (call: unknown[]) => (call[0] as string).includes('ip_only')
      )
      expect(ipSetCall).toBeDefined()
      const savedData = JSON.parse(ipSetCall![1] as string)
      expect(savedData.count).toBe(20)
      expect(savedData.lockedUntil).toBeDefined()
      expect(savedData.lockedUntil).toBeGreaterThan(Date.now())
    })

    it('identifier に : を含まない場合はIP単位カウンターを更新しない', async () => {
      mockRedis.get.mockResolvedValue(null)
      mockRedis.set.mockResolvedValue(undefined)

      await recordFailedLogin('simple-identifier')

      // Only the main key should be set, not an ip_only key
      const ipSetCalls = (mockRedis.set as ReturnType<typeof vi.fn>).mock.calls.filter(
        (call: unknown[]) => (call[0] as string).includes('ip_only')
      )
      expect(ipSetCalls).toHaveLength(0)
    })
  })

  describe('Integration Scenarios', () => {
    it('連続失敗後にロックアウトされる', async () => {
      // 1回目の失敗
      mockRedis.get.mockResolvedValueOnce(null)
      mockRedis.set.mockResolvedValue(undefined)
      let result = await recordFailedLogin('user-1')
      expect(result.remainingAttempts).toBe(4)

      // 2回目の失敗
      mockRedis.get.mockResolvedValueOnce(JSON.stringify({ count: 1, lockedUntil: null }))
      result = await recordFailedLogin('user-1')
      expect(result.remainingAttempts).toBe(3)

      // 3回目の失敗
      mockRedis.get.mockResolvedValueOnce(JSON.stringify({ count: 2, lockedUntil: null }))
      result = await recordFailedLogin('user-1')
      expect(result.remainingAttempts).toBe(2)

      // 4回目の失敗
      mockRedis.get.mockResolvedValueOnce(JSON.stringify({ count: 3, lockedUntil: null }))
      result = await recordFailedLogin('user-1')
      expect(result.remainingAttempts).toBe(1)

      // 5回目の失敗でロックアウト
      mockRedis.get.mockResolvedValueOnce(JSON.stringify({ count: 4, lockedUntil: null }))
      result = await recordFailedLogin('user-1')
      expect(result.allowed).toBe(false)
      expect(result.remainingAttempts).toBe(0)
    })
  })
})
