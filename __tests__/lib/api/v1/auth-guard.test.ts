// @vitest-environment node
/**
 * lib/api/v1/auth-guard のユニットテスト
 *
 * requireBearerUser の全分岐（Bearer なし / 期限切れ / 不正 / 鍵未設定 /
 * ユーザー不存在 / 停止 / ゲスト拒否 / 正常）を網羅する。
 */
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'
import { createMockPrismaClient } from '../../../utils/test-utils'

const VALID_SECRET = 'a'.repeat(64)
const GUEST_EMAIL = 'guest@example.com'

const mockPrisma = createMockPrismaClient()
vi.mock('@/lib/db', () => ({ prisma: mockPrisma }))

describe('lib/api/v1/auth-guard', () => {
  beforeEach(() => {
    vi.stubEnv('MOBILE_JWT_SECRET', VALID_SECRET)
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  function makeRequest(authHeader?: string): NextRequest {
    return new NextRequest('http://localhost/api/v1/test', {
      headers: authHeader ? { authorization: authHeader } : {},
    })
  }

  async function makeValidToken(userId: string): Promise<string> {
    const { signAccessToken } = await import('@/lib/api/v1/jwt')
    const token = await signAccessToken(userId)
    return token!
  }

  describe('AUTH_REQUIRED — Bearer ヘッダーなし', () => {
    it('Authorization ヘッダーが存在しない場合 401 AUTH_REQUIRED', async () => {
      const { requireBearerUser } = await import('@/lib/api/v1/auth-guard')
      const result = await requireBearerUser(makeRequest())
      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.response.status).toBe(401)
        const body = await result.response.json()
        expect(body.error.code).toBe('AUTH_REQUIRED')
      }
    })

    it('"Bearer " プレフィクスなしの場合 401 AUTH_REQUIRED', async () => {
      const { requireBearerUser } = await import('@/lib/api/v1/auth-guard')
      const result = await requireBearerUser(makeRequest('Token sometokenvalue'))
      expect(result.ok).toBe(false)
      if (!result.ok) expect(result.response.status).toBe(401)
    })

    it('"Bearer " の後が空の場合 401 AUTH_REQUIRED', async () => {
      const { requireBearerUser } = await import('@/lib/api/v1/auth-guard')
      const result = await requireBearerUser(makeRequest('Bearer '))
      expect(result.ok).toBe(false)
      if (!result.ok) {
        const body = await result.response.json()
        expect(body.error.code).toBe('AUTH_REQUIRED')
      }
    })
  })

  describe('AUTH_INVALID_TOKEN — 署名不正', () => {
    it('改ざんトークンで 401 AUTH_INVALID_TOKEN', async () => {
      const { requireBearerUser } = await import('@/lib/api/v1/auth-guard')
      const result = await requireBearerUser(makeRequest('Bearer invalid.token.here'))
      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.response.status).toBe(401)
        const body = await result.response.json()
        expect(body.error.code).toBe('AUTH_INVALID_TOKEN')
      }
    })
  })

  describe('AUTH_TOKEN_EXPIRED — 期限切れ', () => {
    it('期限切れトークンで 401 AUTH_TOKEN_EXPIRED', async () => {
      vi.useFakeTimers()
      const token = await makeValidToken('user-exp')

      vi.advanceTimersByTime(901 * 1000)

      const { requireBearerUser } = await import('@/lib/api/v1/auth-guard')
      const result = await requireBearerUser(makeRequest(`Bearer ${token}`))
      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.response.status).toBe(401)
        const body = await result.response.json()
        expect(body.error.code).toBe('AUTH_TOKEN_EXPIRED')
      }
      vi.useRealTimers()
    })
  })

  describe('SERVER_MISCONFIGURED — 鍵未設定', () => {
    it('MOBILE_JWT_SECRET 未設定で 503 SERVER_MISCONFIGURED', async () => {
      vi.unstubAllEnvs()
      vi.stubEnv('MOBILE_JWT_SECRET', '')
      const { requireBearerUser } = await import('@/lib/api/v1/auth-guard')
      const result = await requireBearerUser(makeRequest('Bearer sometoken'))
      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.response.status).toBe(503)
        const body = await result.response.json()
        expect(body.error.code).toBe('SERVER_MISCONFIGURED')
      }
    })
  })

  describe('ユーザー不存在 — AUTH_INVALID_TOKEN', () => {
    it('DB にユーザーが存在しない場合 401 AUTH_INVALID_TOKEN', async () => {
      const token = await makeValidToken('nonexistent-user')
      mockPrisma.user.findUnique.mockResolvedValueOnce(null)

      const { requireBearerUser } = await import('@/lib/api/v1/auth-guard')
      const result = await requireBearerUser(makeRequest(`Bearer ${token}`))
      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.response.status).toBe(401)
        const body = await result.response.json()
        expect(body.error.code).toBe('AUTH_INVALID_TOKEN')
      }
    })
  })

  describe('ACCOUNT_SUSPENDED — アカウント停止', () => {
    it('停止アカウントで 403 ACCOUNT_SUSPENDED', async () => {
      const token = await makeValidToken('suspended-user')
      mockPrisma.user.findUnique.mockResolvedValueOnce({
        id: 'suspended-user',
        isSuspended: true,
        email: 'suspended@example.com',
      })

      const { requireBearerUser } = await import('@/lib/api/v1/auth-guard')
      const result = await requireBearerUser(makeRequest(`Bearer ${token}`))
      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.response.status).toBe(403)
        const body = await result.response.json()
        expect(body.error.code).toBe('ACCOUNT_SUSPENDED')
      }
    })
  })

  describe('GUEST_NOT_ALLOWED — ゲスト拒否', () => {
    it('rejectGuest=true の場合ゲストアカウントで 403', async () => {
      const token = await makeValidToken('guest-user-id')
      mockPrisma.user.findUnique.mockResolvedValueOnce({
        id: 'guest-user-id',
        isSuspended: false,
        email: GUEST_EMAIL,
      })

      const { requireBearerUser } = await import('@/lib/api/v1/auth-guard')
      const result = await requireBearerUser(makeRequest(`Bearer ${token}`), { rejectGuest: true })
      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.response.status).toBe(403)
        const body = await result.response.json()
        expect(body.error.code).toBe('GUEST_NOT_ALLOWED')
      }
    })

    it('rejectGuest=false（デフォルト）の場合ゲストアカウントも通過', async () => {
      const token = await makeValidToken('guest-user-id')
      mockPrisma.user.findUnique.mockResolvedValueOnce({
        id: 'guest-user-id',
        isSuspended: false,
        email: GUEST_EMAIL,
      })

      const { requireBearerUser } = await import('@/lib/api/v1/auth-guard')
      const result = await requireBearerUser(makeRequest(`Bearer ${token}`))
      expect(result.ok).toBe(true)
      if (result.ok) expect(result.userId).toBe('guest-user-id')
    })
  })

  describe('正常系', () => {
    it('有効なトークンと存在するユーザーで ok:true と userId を返す', async () => {
      const token = await makeValidToken('valid-user')
      mockPrisma.user.findUnique.mockResolvedValueOnce({
        id: 'valid-user',
        isSuspended: false,
        email: 'user@example.com',
      })

      const { requireBearerUser } = await import('@/lib/api/v1/auth-guard')
      const result = await requireBearerUser(makeRequest(`Bearer ${token}`))
      expect(result.ok).toBe(true)
      if (result.ok) expect(result.userId).toBe('valid-user')
    })
  })
})
