import { vi } from 'vitest'
/**
 * Cron認証ユーティリティのテスト
 */

import crypto from 'crypto'

describe('cron-auth', async () => {
  const TEST_SECRET = 'test-cron-secret-12345'
  const originalEnv = process.env

  beforeEach(() => {
    vi.resetModules()
    process.env = { ...originalEnv }
    process.env.CRON_SECRET = TEST_SECRET
    ;(process.env as Record<string, string | undefined>).NODE_ENV = 'test'
  })

  afterAll(() => {
    process.env = originalEnv
  })

  // ============================================================
  // generateCronSignature
  // ============================================================

  describe('generateCronSignature', async () => {
    it('HMAC-SHA256署名を生成する', async () => {
      const { generateCronSignature } = await import('@/lib/cron-auth')
      const timestamp = '1234567890000'
      const signature = generateCronSignature(timestamp, TEST_SECRET)

      // 手動で計算した署名と一致することを確認
      const expected = crypto
        .createHmac('sha256', TEST_SECRET)
        .update(timestamp)
        .digest('hex')

      expect(signature).toBe(expected)
    })

    it('同じ入力に対して同じ署名を返す', async () => {
      const { generateCronSignature } = await import('@/lib/cron-auth')
      const timestamp = '1234567890000'

      const sig1 = generateCronSignature(timestamp, TEST_SECRET)
      const sig2 = generateCronSignature(timestamp, TEST_SECRET)

      expect(sig1).toBe(sig2)
    })

    it('異なるタイムスタンプに対して異なる署名を返す', async () => {
      const { generateCronSignature } = await import('@/lib/cron-auth')

      const sig1 = generateCronSignature('1234567890000', TEST_SECRET)
      const sig2 = generateCronSignature('1234567890001', TEST_SECRET)

      expect(sig1).not.toBe(sig2)
    })

    it('異なるシークレットに対して異なる署名を返す', async () => {
      const { generateCronSignature } = await import('@/lib/cron-auth')
      const timestamp = '1234567890000'

      const sig1 = generateCronSignature(timestamp, TEST_SECRET)
      const sig2 = generateCronSignature(timestamp, 'different-secret')

      expect(sig1).not.toBe(sig2)
    })
  })

  // ============================================================
  // verifyCronAuth
  // ============================================================

  describe('verifyCronAuth', async () => {
    describe('CRON_SECRET未設定の場合', async () => {
      it('開発環境では認証をパスする', async () => {
        delete process.env.CRON_SECRET
        ;(process.env as Record<string, string | undefined>).NODE_ENV = 'development'

        const { verifyCronAuth } = await import('@/lib/cron-auth')
        const result = verifyCronAuth(null, null)

        expect(result.valid).toBe(true)
      })

      it('本番環境ではエラーを返す', async () => {
        delete process.env.CRON_SECRET
        ;(process.env as Record<string, string | undefined>).NODE_ENV = 'production'

        const { verifyCronAuth } = await import('@/lib/cron-auth')
        const result = verifyCronAuth(null, null)

        expect(result.valid).toBe(false)
        expect(result.error).toBe('CRON_SECRET is not configured')
      })
    })

    describe('レガシーBearer認証', async () => {
      it('正しいBearerトークンで認証成功', async () => {
        const { verifyCronAuth } = await import('@/lib/cron-auth')
        const result = verifyCronAuth(`Bearer ${TEST_SECRET}`, null)

        expect(result.valid).toBe(true)
      })

      it('間違ったBearerトークンではHMAC認証を試みる', async () => {
        const { verifyCronAuth } = await import('@/lib/cron-auth')
        const result = verifyCronAuth('Bearer wrong-token', null)

        expect(result.valid).toBe(false)
        expect(result.error).toBe('Invalid authorization scheme')
      })
    })

    describe('HMAC認証', async () => {
      it('正しい署名とタイムスタンプで認証成功', async () => {
        const { verifyCronAuth, generateCronSignature } = await import('@/lib/cron-auth')
        const timestamp = Date.now().toString()
        const signature = generateCronSignature(timestamp, TEST_SECRET)

        const result = verifyCronAuth(`HMAC ${signature}`, timestamp)

        expect(result.valid).toBe(true)
      })

      it('無効な認証スキームでエラー', async () => {
        const { verifyCronAuth } = await import('@/lib/cron-auth')
        const result = verifyCronAuth('Basic token', Date.now().toString())

        expect(result.valid).toBe(false)
        expect(result.error).toBe('Invalid authorization scheme')
      })

      it('タイムスタンプヘッダーがない場合エラー', async () => {
        const { verifyCronAuth } = await import('@/lib/cron-auth')
        const result = verifyCronAuth('HMAC signature', null)

        expect(result.valid).toBe(false)
        expect(result.error).toBe('Missing timestamp header')
      })

      it('無効なタイムスタンプ形式でエラー', async () => {
        const { verifyCronAuth } = await import('@/lib/cron-auth')
        const result = verifyCronAuth('HMAC signature', 'not-a-number')

        expect(result.valid).toBe(false)
        expect(result.error).toBe('Invalid timestamp format')
      })

      it('古すぎるタイムスタンプでエラー', async () => {
        const { verifyCronAuth, generateCronSignature } = await import('@/lib/cron-auth')
        const oldTimestamp = (Date.now() - 10 * 60 * 1000).toString() // 10分前
        const signature = generateCronSignature(oldTimestamp, TEST_SECRET)

        const result = verifyCronAuth(`HMAC ${signature}`, oldTimestamp)

        expect(result.valid).toBe(false)
        expect(result.error).toBe('Request timestamp is too old or too far in the future')
      })

      it('未来すぎるタイムスタンプでエラー', async () => {
        const { verifyCronAuth, generateCronSignature } = await import('@/lib/cron-auth')
        const futureTimestamp = (Date.now() + 10 * 60 * 1000).toString() // 10分後
        const signature = generateCronSignature(futureTimestamp, TEST_SECRET)

        const result = verifyCronAuth(`HMAC ${signature}`, futureTimestamp)

        expect(result.valid).toBe(false)
        expect(result.error).toBe('Request timestamp is too old or too far in the future')
      })

      it('無効な署名でエラー', async () => {
        const { verifyCronAuth } = await import('@/lib/cron-auth')
        const timestamp = Date.now().toString()
        // SHA256は64文字のhex文字列を生成するので、同じ長さの無効な署名を使用
        const invalidSignature = '0'.repeat(64)

        const result = verifyCronAuth(`HMAC ${invalidSignature}`, timestamp)

        expect(result.valid).toBe(false)
        expect(result.error).toBe('Invalid signature')
      })

      it('5分以内のタイムスタンプは許容される', async () => {
        const { verifyCronAuth, generateCronSignature } = await import('@/lib/cron-auth')
        const nearTimestamp = (Date.now() - 4 * 60 * 1000).toString() // 4分前
        const signature = generateCronSignature(nearTimestamp, TEST_SECRET)

        const result = verifyCronAuth(`HMAC ${signature}`, nearTimestamp)

        expect(result.valid).toBe(true)
      })
    })
  })

  // ============================================================
  // generateCronHeaders
  // ============================================================

  describe('generateCronHeaders', async () => {
    it('認証ヘッダーを生成する', async () => {
      const { generateCronHeaders } = await import('@/lib/cron-auth')
      const headers = generateCronHeaders()

      expect(headers).toHaveProperty('authorization')
      expect(headers).toHaveProperty('x-cron-timestamp')
      expect(headers.authorization).toMatch(/^HMAC [a-f0-9]+$/)
      expect(headers['x-cron-timestamp']).toMatch(/^\d+$/)
    })

    it('生成したヘッダーで認証が通る', async () => {
      const { generateCronHeaders, verifyCronAuth } = await import('@/lib/cron-auth')
      const headers = generateCronHeaders()

      const result = verifyCronAuth(
        headers.authorization,
        headers['x-cron-timestamp']
      )

      expect(result.valid).toBe(true)
    })

    it('CRON_SECRETが未設定の場合エラーをスロー', async () => {
      delete process.env.CRON_SECRET

      const { generateCronHeaders } = await import('@/lib/cron-auth')

      expect(() => generateCronHeaders()).toThrow('CRON_SECRET is not set')
    })
  })
})
