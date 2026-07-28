// @vitest-environment node
/**
 * lib/api/v1/response のユニットテスト
 *
 * apiError / apiZodError / apiRateLimited のレスポンス形状・ヘッダーを検証する。
 */
import { describe, it, expect } from 'vitest'
import { ZodError, z } from 'zod'
import { apiError, apiErrorWithDetails, apiZodError, apiRateLimited } from '@/lib/api/v1/response'
import { MOBILE_API_ERROR_CODES } from '@/lib/constants/errors/mobile-api'
import type { RateLimitResult } from '@/lib/api/v1/types'

describe('lib/api/v1/response', () => {
  describe('apiError', () => {
    it('指定したステータスコードとコードで JSON を返す', async () => {
      const res = apiError(MOBILE_API_ERROR_CODES.AUTH_REQUIRED, 401)
      expect(res.status).toBe(401)
      const body = await res.json()
      expect(body.error.code).toBe('AUTH_REQUIRED')
      expect(body.error.status).toBe(401)
      expect(typeof body.error.message).toBe('string')
      expect(body.error.message.length).toBeGreaterThan(0)
    })

    it('message を明示すると自動解決より優先される', async () => {
      const res = apiError(MOBILE_API_ERROR_CODES.VALIDATION_ERROR, 400, 'カスタムエラー')
      const body = await res.json()
      expect(body.error.message).toBe('カスタムエラー')
    })

    it('503 SERVER_MISCONFIGURED を正しく返す', async () => {
      const res = apiError(MOBILE_API_ERROR_CODES.SERVER_MISCONFIGURED, 503)
      expect(res.status).toBe(503)
      const body = await res.json()
      expect(body.error.code).toBe('SERVER_MISCONFIGURED')
    })

    it('Content-Type が application/json', async () => {
      const res = apiError(MOBILE_API_ERROR_CODES.NOT_FOUND, 404)
      expect(res.headers.get('content-type')).toContain('application/json')
    })

    it('429 RATE_LIMITED を正しく返す', async () => {
      const res = apiError(MOBILE_API_ERROR_CODES.RATE_LIMITED, 429)
      expect(res.status).toBe(429)
      const body = await res.json()
      expect(body.error.code).toBe('RATE_LIMITED')
    })

    it('403 ACCOUNT_SUSPENDED を正しく返す', async () => {
      const res = apiError(MOBILE_API_ERROR_CODES.ACCOUNT_SUSPENDED, 403)
      expect(res.status).toBe(403)
      const body = await res.json()
      expect(body.error.code).toBe('ACCOUNT_SUSPENDED')
    })

    it('JSON に details キー自体が出現しない（バイト互換）', async () => {
      const res = apiError(MOBILE_API_ERROR_CODES.ACCOUNT_SUSPENDED, 403)
      const raw = await res.text()
      expect(raw.includes('details')).toBe(false)
      const body = await apiError(MOBILE_API_ERROR_CODES.ACCOUNT_SUSPENDED, 403).json()
      expect(Object.keys(body.error)).toEqual(['code', 'status', 'message'])
    })
  })

  describe('apiErrorWithDetails', () => {
    it('details 付きの JSON を返す', async () => {
      const res = apiErrorWithDetails(
        MOBILE_API_ERROR_CODES.TERMS_ACCEPTANCE_REQUIRED,
        403,
        { currentTermsVersion: '2026-01-01' },
      )
      expect(res.status).toBe(403)
      const body = await res.json()
      expect(body.error.code).toBe('TERMS_ACCEPTANCE_REQUIRED')
      expect(body.error.status).toBe(403)
      expect(body.error.details).toEqual({ currentTermsVersion: '2026-01-01' })
      expect(typeof body.error.message).toBe('string')
      expect(body.error.message.length).toBeGreaterThan(0)
    })

    it('message を明示すると自動解決より優先される', async () => {
      const res = apiErrorWithDetails(
        MOBILE_API_ERROR_CODES.TERMS_ACCEPTANCE_REQUIRED,
        403,
        { currentTermsVersion: '2026-01-01' },
        'カスタムエラー',
      )
      const body = await res.json()
      expect(body.error.message).toBe('カスタムエラー')
    })

    it('details オブジェクトの複数キーをそのまま透過する', async () => {
      const res = apiErrorWithDetails(
        MOBILE_API_ERROR_CODES.VALIDATION_ERROR,
        400,
        { fieldA: 'valueA', fieldB: 'valueB' },
      )
      const body = await res.json()
      expect(body.error.details).toEqual({ fieldA: 'valueA', fieldB: 'valueB' })
    })

    it('Content-Type が application/json', async () => {
      const res = apiErrorWithDetails(
        MOBILE_API_ERROR_CODES.TERMS_ACCEPTANCE_REQUIRED,
        403,
        { currentTermsVersion: '2026-01-01' },
      )
      expect(res.headers.get('content-type')).toContain('application/json')
    })
  })

  describe('apiZodError', () => {
    it('ZodError の最初のメッセージを返す', async () => {
      const schema = z.object({ email: z.string().email('メール形式が不正'), name: z.string() })
      const result = schema.safeParse({ email: 'bad', name: 'ok' })
      expect(result.success).toBe(false)
      if (!result.success) {
        const res = apiZodError(result.error)
        expect(res.status).toBe(400)
        const body = await res.json()
        expect(body.error.code).toBe('VALIDATION_ERROR')
        expect(body.error.message).toBe('メール形式が不正')
      }
    })

    it('issues が空でも 400 を返す', async () => {
      const emptyZodError = new ZodError([])
      const res = apiZodError(emptyZodError)
      expect(res.status).toBe(400)
      const body = await res.json()
      expect(body.error.code).toBe('VALIDATION_ERROR')
    })
  })

  describe('apiRateLimited', () => {
    it('429 ステータスと Retry-After ヘッダーを返す', async () => {
      const rl: RateLimitResult = {
        success: false,
        remaining: 0,
        resetTime: Date.now() + 60_000,
      }
      const res = apiRateLimited(rl)
      expect(res.status).toBe(429)
      const retryAfter = res.headers.get('Retry-After')
      expect(retryAfter).not.toBeNull()
      expect(Number(retryAfter)).toBeGreaterThanOrEqual(1)
      const body = await res.json()
      expect(body.error.code).toBe('RATE_LIMITED')
    })

    it('Retry-After は最低 1 秒', async () => {
      const rl: RateLimitResult = {
        success: false,
        remaining: 0,
        resetTime: Date.now() - 1000,
      }
      const res = apiRateLimited(rl)
      expect(Number(res.headers.get('Retry-After'))).toBeGreaterThanOrEqual(1)
    })
  })
})
