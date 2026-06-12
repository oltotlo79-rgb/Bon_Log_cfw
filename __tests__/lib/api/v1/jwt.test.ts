// @vitest-environment node
/**
 * lib/api/v1/jwt のユニットテスト
 *
 * signAccessToken / verifyAccessToken の正常系・異常系・TTL 境界値・鍵未設定を網羅する。
 */
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'

const VALID_SECRET = 'a'.repeat(64) // 64 hex chars = 32 bytes

describe('lib/api/v1/jwt', () => {
  beforeEach(() => {
    vi.stubEnv('MOBILE_JWT_SECRET', VALID_SECRET)
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.useRealTimers()
  })

  describe('signAccessToken', () => {
    it('有効な鍵でトークンを発行できる', async () => {
      const { signAccessToken } = await import('@/lib/api/v1/jwt')
      const token = await signAccessToken('user-123')
      expect(typeof token).toBe('string')
      expect(token).not.toBeNull()
      expect((token ?? '').split('.')).toHaveLength(3)
    })

    it('MOBILE_JWT_SECRET 未設定で null を返す', async () => {
      vi.unstubAllEnvs()
      vi.stubEnv('MOBILE_JWT_SECRET', '')
      const { signAccessToken } = await import('@/lib/api/v1/jwt')
      const token = await signAccessToken('user-123')
      expect(token).toBeNull()
    })

    it('MOBILE_JWT_SECRET が 64 文字未満で null を返す', async () => {
      vi.unstubAllEnvs()
      vi.stubEnv('MOBILE_JWT_SECRET', 'a'.repeat(63))
      const { signAccessToken } = await import('@/lib/api/v1/jwt')
      const token = await signAccessToken('user-123')
      expect(token).toBeNull()
    })

    it('MOBILE_JWT_SECRET が hex 以外の文字を含む場合 null を返す', async () => {
      vi.unstubAllEnvs()
      vi.stubEnv('MOBILE_JWT_SECRET', 'z'.repeat(64))
      const { signAccessToken } = await import('@/lib/api/v1/jwt')
      const token = await signAccessToken('user-123')
      expect(token).toBeNull()
    })
  })

  describe('verifyAccessToken', () => {
    it('自身が発行したトークンを検証できる', async () => {
      const { signAccessToken, verifyAccessToken } = await import('@/lib/api/v1/jwt')
      const token = await signAccessToken('user-abc')
      expect(token).not.toBeNull()
      const result = await verifyAccessToken(token!)
      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.claims.sub).toBe('user-abc')
        expect(result.claims.typ).toBe('access')
      }
    })

    it('鍵未設定で misconfigured を返す', async () => {
      vi.unstubAllEnvs()
      vi.stubEnv('MOBILE_JWT_SECRET', '')
      const { verifyAccessToken } = await import('@/lib/api/v1/jwt')
      const result = await verifyAccessToken('some.token.here')
      expect(result.ok).toBe(false)
      if (!result.ok) expect(result.reason).toBe('misconfigured')
    })

    it('改ざんトークンで invalid を返す', async () => {
      const { verifyAccessToken } = await import('@/lib/api/v1/jwt')
      const result = await verifyAccessToken('invalid.token.here')
      expect(result.ok).toBe(false)
      if (!result.ok) expect(result.reason).toBe('invalid')
    })

    it('完全にでたらめな文字列で invalid を返す', async () => {
      const { verifyAccessToken } = await import('@/lib/api/v1/jwt')
      const result = await verifyAccessToken('notajwtatall')
      expect(result.ok).toBe(false)
      if (!result.ok) expect(result.reason).toBe('invalid')
    })

    it('expired トークンで expired を返す', async () => {
      vi.useFakeTimers()
      const { signAccessToken, verifyAccessToken } = await import('@/lib/api/v1/jwt')

      const token = await signAccessToken('user-exp')
      expect(token).not.toBeNull()

      // TTL (900s) を超過させる
      vi.advanceTimersByTime(901 * 1000)

      const result = await verifyAccessToken(token!)
      expect(result.ok).toBe(false)
      if (!result.ok) expect(result.reason).toBe('expired')
    })

    it('typ クレームが access でないトークンで invalid を返す', async () => {
      // typ='refresh' のトークンを jose で直接作成してテスト
      const { SignJWT } = await import('jose')
      const {
        MOBILE_JWT_ISSUER,
        MOBILE_JWT_AUDIENCE,
        MOBILE_JWT_ALGORITHM,
      } = await import('@/lib/constants/limits/mobile-auth')

      const key = new TextEncoder().encode(VALID_SECRET)
      const token = await new SignJWT({ typ: 'refresh' })
        .setProtectedHeader({ alg: MOBILE_JWT_ALGORITHM })
        .setSubject('user-xyz')
        .setIssuer(MOBILE_JWT_ISSUER)
        .setAudience(MOBILE_JWT_AUDIENCE)
        .setIssuedAt()
        .setExpirationTime('15m')
        .sign(key)

      const { verifyAccessToken } = await import('@/lib/api/v1/jwt')
      const result = await verifyAccessToken(token)
      expect(result.ok).toBe(false)
      if (!result.ok) expect(result.reason).toBe('invalid')
    })

    it('sub が空文字のトークンで invalid を返す', async () => {
      const { SignJWT } = await import('jose')
      const {
        MOBILE_JWT_ISSUER,
        MOBILE_JWT_AUDIENCE,
        MOBILE_JWT_ALGORITHM,
        MOBILE_TOKEN_TYPE_ACCESS,
      } = await import('@/lib/constants/limits/mobile-auth')

      const key = new TextEncoder().encode(VALID_SECRET)
      const token = await new SignJWT({ typ: MOBILE_TOKEN_TYPE_ACCESS })
        .setProtectedHeader({ alg: MOBILE_JWT_ALGORITHM })
        .setSubject('')
        .setIssuer(MOBILE_JWT_ISSUER)
        .setAudience(MOBILE_JWT_AUDIENCE)
        .setIssuedAt()
        .setExpirationTime('15m')
        .sign(key)

      const { verifyAccessToken } = await import('@/lib/api/v1/jwt')
      const result = await verifyAccessToken(token)
      expect(result.ok).toBe(false)
      if (!result.ok) expect(result.reason).toBe('invalid')
    })

    it('別の鍵で署名したトークンで invalid を返す', async () => {
      const { SignJWT } = await import('jose')
      const {
        MOBILE_JWT_ISSUER,
        MOBILE_JWT_AUDIENCE,
        MOBILE_JWT_ALGORITHM,
        MOBILE_TOKEN_TYPE_ACCESS,
      } = await import('@/lib/constants/limits/mobile-auth')

      const wrongKey = new TextEncoder().encode('b'.repeat(64))
      const token = await new SignJWT({ typ: MOBILE_TOKEN_TYPE_ACCESS })
        .setProtectedHeader({ alg: MOBILE_JWT_ALGORITHM })
        .setSubject('user-123')
        .setIssuer(MOBILE_JWT_ISSUER)
        .setAudience(MOBILE_JWT_AUDIENCE)
        .setIssuedAt()
        .setExpirationTime('15m')
        .sign(wrongKey)

      const { verifyAccessToken } = await import('@/lib/api/v1/jwt')
      const result = await verifyAccessToken(token)
      expect(result.ok).toBe(false)
      if (!result.ok) expect(result.reason).toBe('invalid')
    })

    it('issuer 不一致で invalid を返す', async () => {
      const { SignJWT } = await import('jose')
      const {
        MOBILE_JWT_AUDIENCE,
        MOBILE_JWT_ALGORITHM,
        MOBILE_TOKEN_TYPE_ACCESS,
      } = await import('@/lib/constants/limits/mobile-auth')

      const key = new TextEncoder().encode(VALID_SECRET)
      const token = await new SignJWT({ typ: MOBILE_TOKEN_TYPE_ACCESS })
        .setProtectedHeader({ alg: MOBILE_JWT_ALGORITHM })
        .setSubject('user-123')
        .setIssuer('wrong-issuer')
        .setAudience(MOBILE_JWT_AUDIENCE)
        .setIssuedAt()
        .setExpirationTime('15m')
        .sign(key)

      const { verifyAccessToken } = await import('@/lib/api/v1/jwt')
      const result = await verifyAccessToken(token)
      expect(result.ok).toBe(false)
      if (!result.ok) expect(result.reason).toBe('invalid')
    })

    it('audience 不一致で invalid を返す', async () => {
      const { SignJWT } = await import('jose')
      const {
        MOBILE_JWT_ISSUER,
        MOBILE_JWT_ALGORITHM,
        MOBILE_TOKEN_TYPE_ACCESS,
      } = await import('@/lib/constants/limits/mobile-auth')

      const key = new TextEncoder().encode(VALID_SECRET)
      const token = await new SignJWT({ typ: MOBILE_TOKEN_TYPE_ACCESS })
        .setProtectedHeader({ alg: MOBILE_JWT_ALGORITHM })
        .setSubject('user-123')
        .setIssuer(MOBILE_JWT_ISSUER)
        .setAudience('wrong-audience')
        .setIssuedAt()
        .setExpirationTime('15m')
        .sign(key)

      const { verifyAccessToken } = await import('@/lib/api/v1/jwt')
      const result = await verifyAccessToken(token)
      expect(result.ok).toBe(false)
      if (!result.ok) expect(result.reason).toBe('invalid')
    })
  })
})
