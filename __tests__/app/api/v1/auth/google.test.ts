// @vitest-environment node
/**
 * POST /api/v1/auth/google のユニットテスト
 *
 * GOOGLE_CLIENT_ID 未設定 / ID トークン検証失敗 / email_verified 不正 /
 * ユーザー解決（Account存在 / email存在 / 新規作成） / 停止 の全分岐を検証する。
 */
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'
import { CURRENT_TERMS_VERSION } from '@/lib/constants/terms-version'

const VALID_SECRET = 'a'.repeat(64)

const mockJwtVerify = vi.fn()
const mockCreateRemoteJWKSet = vi.fn()
vi.mock('jose', async (importOriginal) => {
  const actual = await importOriginal<typeof import('jose')>()
  return {
    ...actual,
    jwtVerify: (...args: unknown[]) => mockJwtVerify(...args),
    createRemoteJWKSet: (...args: unknown[]) => mockCreateRemoteJWKSet(...args),
  }
})

const mockAccountFindUnique = vi.fn()
const mockAccountCreate = vi.fn().mockResolvedValue({})
const mockUserFindUnique = vi.fn()
const mockUserCreate = vi.fn()
const mockRefreshTokenCreate = vi.fn().mockResolvedValue({})
vi.mock('@/lib/db', () => ({
  prisma: {
    account: {
      findUnique: (...args: unknown[]) => mockAccountFindUnique(...args),
      create: (...args: unknown[]) => mockAccountCreate(...args),
    },
    user: {
      findUnique: (...args: unknown[]) => mockUserFindUnique(...args),
      create: (...args: unknown[]) => mockUserCreate(...args),
    },
    refreshToken: {
      create: (...args: unknown[]) => mockRefreshTokenCreate(...args),
    },
  },
}))

function makeGoogleRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/v1/auth/google', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  })
}

const validGoogleClaims = {
  sub: 'google-sub-123',
  email: 'test@gmail.com',
  email_verified: true,
  name: 'Test User',
}

describe('POST /api/v1/auth/google', () => {
  beforeEach(() => {
    vi.stubEnv('MOBILE_JWT_SECRET', VALID_SECRET)
    vi.stubEnv('GOOGLE_CLIENT_ID', 'test-client-id.apps.googleusercontent.com')
    // WHY: clearAllMocks は呼び出し履歴のみ消し、mockResolvedValueOnce の未消費キューは
    // 次テストへ持ち越されてしまう（早期 return するテストで特に顕在化）。
    // resetAllMocks でキューごと完全にリセットし、各テストの再現性を担保する。
    vi.resetAllMocks()
    mockRefreshTokenCreate.mockResolvedValue({})
    mockCreateRemoteJWKSet.mockReturnValue('mock-jwks')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('GOOGLE_CLIENT_ID 未設定で 503 SERVER_MISCONFIGURED', async () => {
    vi.unstubAllEnvs()
    vi.stubEnv('MOBILE_JWT_SECRET', VALID_SECRET)

    const { POST } = await import('@/app/api/v1/auth/google/route')
    const res = await POST(makeGoogleRequest({ idToken: 'some-id-token' }))

    expect(res.status).toBe(503)
    const body = await res.json()
    expect(body.error.code).toBe('SERVER_MISCONFIGURED')
  })

  it('ID トークン検証失敗で 401 AUTH_INVALID_TOKEN', async () => {
    mockJwtVerify.mockRejectedValueOnce(new Error('JWT verification failed'))

    const { POST } = await import('@/app/api/v1/auth/google/route')
    const res = await POST(makeGoogleRequest({ idToken: 'invalid-id-token' }))

    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error.code).toBe('AUTH_INVALID_TOKEN')
  })

  it('email_verified=false で 401 AUTH_INVALID_TOKEN', async () => {
    mockJwtVerify.mockResolvedValueOnce({
      payload: {
        sub: 'google-sub-456',
        email: 'unverified@gmail.com',
        email_verified: false,
        name: 'Unverified',
      },
    })

    const { POST } = await import('@/app/api/v1/auth/google/route')
    const res = await POST(makeGoogleRequest({ idToken: 'unverified-id-token' }))

    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error.code).toBe('AUTH_INVALID_TOKEN')
  })

  it('既存 Account(google, sub) でユーザーを解決して 200 を返す', async () => {
    mockJwtVerify.mockResolvedValueOnce({ payload: validGoogleClaims })
    mockAccountFindUnique.mockResolvedValueOnce({ userId: 'user-existing-account' })
    mockUserFindUnique.mockResolvedValueOnce({ isSuspended: false })

    const { POST } = await import('@/app/api/v1/auth/google/route')
    const res = await POST(makeGoogleRequest({ idToken: 'valid-id-token' }))

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(typeof body.accessToken).toBe('string')
  })

  it('Account なし・email でユーザーを解決して Account をリンクし 200 を返す', async () => {
    mockJwtVerify.mockResolvedValueOnce({ payload: validGoogleClaims })
    mockAccountFindUnique.mockResolvedValueOnce(null)
    mockUserFindUnique
      .mockResolvedValueOnce({ id: 'user-email-match' })
      .mockResolvedValueOnce({ isSuspended: false })
    mockAccountCreate.mockResolvedValueOnce({})

    const { POST } = await import('@/app/api/v1/auth/google/route')
    const res = await POST(makeGoogleRequest({ idToken: 'valid-id-token' }))

    expect(res.status).toBe(200)
    expect(mockAccountCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ provider: 'google', providerAccountId: 'google-sub-123' }),
      })
    )
  })

  it('Account も email も存在しない場合は新規ユーザーを作成して 200 を返す', async () => {
    mockJwtVerify.mockResolvedValueOnce({ payload: validGoogleClaims })
    mockAccountFindUnique.mockResolvedValueOnce(null)
    mockUserFindUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ isSuspended: false })
    mockUserCreate.mockResolvedValueOnce({ id: 'newly-created-user' })

    const { POST } = await import('@/app/api/v1/auth/google/route')
    const res = await POST(
      makeGoogleRequest({
        idToken: 'valid-id-token',
        termsAccepted: true,
        termsVersion: CURRENT_TERMS_VERSION,
      })
    )

    expect(res.status).toBe(200)
    expect(mockUserCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          email: 'test@gmail.com',
          emailVerified: expect.any(Date),
        }),
      })
    )
  })

  it('停止アカウントで 403 ACCOUNT_SUSPENDED', async () => {
    mockJwtVerify.mockResolvedValueOnce({ payload: validGoogleClaims })
    mockAccountFindUnique.mockResolvedValueOnce({ userId: 'suspended-user-google' })
    mockUserFindUnique.mockResolvedValueOnce({ isSuspended: true })

    const { POST } = await import('@/app/api/v1/auth/google/route')
    const res = await POST(makeGoogleRequest({ idToken: 'valid-id-token' }))

    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error.code).toBe('ACCOUNT_SUSPENDED')
  })

  it('ユーザー不存在（resolveGoogleUser 後）で 403 ACCOUNT_SUSPENDED', async () => {
    mockJwtVerify.mockResolvedValueOnce({ payload: validGoogleClaims })
    mockAccountFindUnique.mockResolvedValueOnce({ userId: 'ghost-user-google' })
    mockUserFindUnique.mockResolvedValueOnce(null)

    const { POST } = await import('@/app/api/v1/auth/google/route')
    const res = await POST(makeGoogleRequest({ idToken: 'valid-id-token' }))

    expect(res.status).toBe(403)
  })

  it('idToken フィールド欠落で 400 VALIDATION_ERROR', async () => {
    const { POST } = await import('@/app/api/v1/auth/google/route')
    const res = await POST(makeGoogleRequest({}))
    expect(res.status).toBe(400)
  })

  it('不正 JSON で 400 VALIDATION_ERROR', async () => {
    const req = new NextRequest('http://localhost/api/v1/auth/google', {
      method: 'POST',
      body: 'notjson',
      headers: { 'Content-Type': 'application/json' },
    })
    const { POST } = await import('@/app/api/v1/auth/google/route')
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it('name なしの新規ユーザーで email prefix を nickname に使う', async () => {
    const claimsWithoutName = { ...validGoogleClaims, name: undefined }
    mockJwtVerify.mockResolvedValueOnce({ payload: claimsWithoutName })
    mockAccountFindUnique.mockResolvedValueOnce(null)
    mockUserFindUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ isSuspended: false })
    mockUserCreate.mockResolvedValueOnce({ id: 'new-user-noname' })

    const { POST } = await import('@/app/api/v1/auth/google/route')
    const res = await POST(
      makeGoogleRequest({
        idToken: 'valid-id-token',
        termsAccepted: true,
        termsVersion: CURRENT_TERMS_VERSION,
      })
    )

    expect(res.status).toBe(200)
    const createArgs = mockUserCreate.mock.calls[0]
    const data = (createArgs as unknown[])[0] as { data: { nickname: string } }
    expect(data.data.nickname).toBe('test')
  })

  // 規約同意（Track2）
  describe('未知ユーザー新規作成時の規約同意要求', () => {
    it('termsAccepted 未指定で 403 TERMS_ACCEPTANCE_REQUIRED、user.create は呼ばれない', async () => {
      mockJwtVerify.mockResolvedValueOnce({ payload: validGoogleClaims })
      mockAccountFindUnique.mockResolvedValueOnce(null)
      mockUserFindUnique.mockResolvedValueOnce(null)

      const { POST } = await import('@/app/api/v1/auth/google/route')
      const res = await POST(makeGoogleRequest({ idToken: 'valid-id-token' }))

      expect(res.status).toBe(403)
      const body = await res.json()
      expect(body.error.code).toBe('TERMS_ACCEPTANCE_REQUIRED')
      expect(mockUserCreate).not.toHaveBeenCalled()
      expect(mockAccountCreate).not.toHaveBeenCalled()
    })

    it('termsAccepted: false は z.literal(true) を満たさず 400 VALIDATION_ERROR（user.create は呼ばれない）', async () => {
      // WHY: googleRequestSchema.termsAccepted は z.literal(true).optional() のため、
      // false は「未指定」と異なり Zod の時点で弾かれる（TERMS_ACCEPTANCE_REQUIRED には到達しない）。
      const { POST } = await import('@/app/api/v1/auth/google/route')
      const res = await POST(
        makeGoogleRequest({
          idToken: 'valid-id-token',
          termsAccepted: false,
          termsVersion: CURRENT_TERMS_VERSION,
        }),
      )

      expect(res.status).toBe(400)
      const body = await res.json()
      expect(body.error.code).toBe('VALIDATION_ERROR')
      expect(mockUserCreate).not.toHaveBeenCalled()
    })

    it('termsVersion が旧バージョンで 403 TERMS_ACCEPTANCE_REQUIRED、user.create は呼ばれない', async () => {
      mockJwtVerify.mockResolvedValueOnce({ payload: validGoogleClaims })
      mockAccountFindUnique.mockResolvedValueOnce(null)
      mockUserFindUnique.mockResolvedValueOnce(null)

      const { POST } = await import('@/app/api/v1/auth/google/route')
      const res = await POST(
        makeGoogleRequest({
          idToken: 'valid-id-token',
          termsAccepted: true,
          termsVersion: '2000-01-01',
        }),
      )

      expect(res.status).toBe(403)
      const body = await res.json()
      expect(body.error.code).toBe('TERMS_ACCEPTANCE_REQUIRED')
      expect(mockUserCreate).not.toHaveBeenCalled()
    })

    it('termsAccepted: true かつ termsVersion が現行版で新規作成され、termsAcceptedAt(サーバー時刻)/termsVersion が保存される', async () => {
      mockJwtVerify.mockResolvedValueOnce({ payload: validGoogleClaims })
      mockAccountFindUnique.mockResolvedValueOnce(null)
      mockUserFindUnique
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ isSuspended: false })
      mockUserCreate.mockResolvedValueOnce({ id: 'newly-created-user-2' })

      const before = new Date()
      const { POST } = await import('@/app/api/v1/auth/google/route')
      const res = await POST(
        makeGoogleRequest({
          idToken: 'valid-id-token',
          termsAccepted: true,
          termsVersion: CURRENT_TERMS_VERSION,
        }),
      )
      const after = new Date()

      expect(res.status).toBe(200)
      expect(mockUserCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            termsVersion: CURRENT_TERMS_VERSION,
            termsAcceptedAt: expect.any(Date),
          }),
        }),
      )
      const createArgs = mockUserCreate.mock.calls[0]?.[0] as { data: { termsAcceptedAt: Date } }
      expect(createArgs.data.termsAcceptedAt.getTime()).toBeGreaterThanOrEqual(before.getTime())
      expect(createArgs.data.termsAcceptedAt.getTime()).toBeLessThanOrEqual(after.getTime())
    })

    it('既存 Account(google, sub) 一致は同意なしでも従来どおり成功する（既存ユーザーは非対象）', async () => {
      mockJwtVerify.mockResolvedValueOnce({ payload: validGoogleClaims })
      mockAccountFindUnique.mockResolvedValueOnce({ userId: 'user-existing-account' })
      mockUserFindUnique.mockResolvedValueOnce({ isSuspended: false })

      const { POST } = await import('@/app/api/v1/auth/google/route')
      const res = await POST(makeGoogleRequest({ idToken: 'valid-id-token' }))

      expect(res.status).toBe(200)
      expect(mockUserCreate).not.toHaveBeenCalled()
    })

    it('既存 User・email 一致でのリンクは同意なしでも従来どおり成功する（既存ユーザーは非対象）', async () => {
      mockJwtVerify.mockResolvedValueOnce({ payload: validGoogleClaims })
      mockAccountFindUnique.mockResolvedValueOnce(null)
      mockUserFindUnique
        .mockResolvedValueOnce({ id: 'user-email-match-2' })
        .mockResolvedValueOnce({ isSuspended: false })
      mockAccountCreate.mockResolvedValueOnce({})

      const { POST } = await import('@/app/api/v1/auth/google/route')
      const res = await POST(makeGoogleRequest({ idToken: 'valid-id-token' }))

      expect(res.status).toBe(200)
      expect(mockUserCreate).not.toHaveBeenCalled()
      expect(mockAccountCreate).toHaveBeenCalled()
    })
  })
})
