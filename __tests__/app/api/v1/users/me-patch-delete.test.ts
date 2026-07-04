// @vitest-environment node
/**
 * PATCH /api/v1/users/me および DELETE /api/v1/users/me のユニットテスト
 *
 * v1.9.0 (Batch 2d) で追加されたエンドポイントを検証する。
 * - PATCH: 部分更新・各バリデーション・avatarUrl/headerUrl 外部 URL 拒否・ゲスト 403・429
 * - DELETE: 正常削除・DB エラー 500・ゲスト 403・429・Bearer 必須
 *
 * GET /api/v1/users/me の検証は __tests__/app/api/v1/users/me.test.ts 参照。
 */
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'

const VALID_SECRET = 'a'.repeat(64)
const GUEST_EMAIL = 'guest@example.com'

// ──────────────────────────────────────────────────
// Mock: prisma — requireBearerUser が user.findUnique を呼ぶ
// ──────────────────────────────────────────────────
const mockUserFindUnique = vi.fn()
vi.mock('@/lib/db', () => ({
  prisma: {
    user: {
      findUnique: (...args: unknown[]) => mockUserFindUnique(...args),
    },
  },
}))

// ──────────────────────────────────────────────────
// Mock: rate-limit
// ──────────────────────────────────────────────────
const mockCheckUserRateLimit = vi.fn()
vi.mock('@/lib/rate-limit', () => ({
  checkUserRateLimit: (...args: unknown[]) => mockCheckUserRateLimit(...args),
}))

// ──────────────────────────────────────────────────
// Mock: user-profile-write-service
// ──────────────────────────────────────────────────
const mockUpdateUserProfile = vi.fn()
const mockIsNicknameReserved = vi.fn()
vi.mock('@/lib/services/user-profile-write-service', () => ({
  updateUserProfile: (...args: unknown[]) => mockUpdateUserProfile(...args),
  isNicknameReserved: (...args: unknown[]) => mockIsNicknameReserved(...args),
}))

// ──────────────────────────────────────────────────
// Mock: account-deletion-service
// ──────────────────────────────────────────────────
const mockDeleteUserAccount = vi.fn()
vi.mock('@/lib/services/account-deletion-service', () => ({
  deleteUserAccount: (...args: unknown[]) => mockDeleteUserAccount(...args),
}))

// ──────────────────────────────────────────────────
// Mock: media-url-validator
// ──────────────────────────────────────────────────
const mockAssertMediaUrlsFromOwnStorage = vi.fn()
vi.mock('@/lib/services/media-url-validator', () => ({
  assertMediaUrlsFromOwnStorage: (...args: unknown[]) => mockAssertMediaUrlsFromOwnStorage(...args),
}))

// ──────────────────────────────────────────────────
// Mock: isPremiumUser (GET 用だが import されるため念のためモック)
// ──────────────────────────────────────────────────
vi.mock('@/lib/premium', () => ({
  isPremiumUser: vi.fn().mockResolvedValue(false),
}))

// ──────────────────────────────────────────────────
// Mock: logger
// ──────────────────────────────────────────────────
vi.mock('@/lib/logger', () => ({
  __esModule: true,
  default: { log: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}))

// ──────────────────────────────────────────────────
// ヘルパー関数
// ──────────────────────────────────────────────────
const OWNER_ID = 'user-me-owner-01'

async function makeAuthenticatedPatchRequest(
  userId: string,
  body: unknown,
): Promise<NextRequest> {
  const { signAccessToken } = await import('@/lib/api/v1/jwt')
  const token = await signAccessToken(userId)
  return new NextRequest('http://localhost/api/v1/users/me', {
    method: 'PATCH',
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
  })
}

async function makeAuthenticatedDeleteRequest(userId: string): Promise<NextRequest> {
  const { signAccessToken } = await import('@/lib/api/v1/jwt')
  const token = await signAccessToken(userId)
  return new NextRequest('http://localhost/api/v1/users/me', {
    method: 'DELETE',
    headers: {
      authorization: `Bearer ${token}`,
    },
  })
}

// updateUserProfile のモック戻り値（正常系）
const mockProfileResult = {
  id: OWNER_ID,
  email: 'owner@example.com',
  nickname: '更新済みニック',
  avatarUrl: '/uploads/avatar.jpg',
  headerUrl: null,
  bio: '更新済み自己紹介',
  location: '東京',
  isPublic: true,
  bonsaiStartYear: 2020,
  bonsaiStartMonth: 4,
  birthDate: null,
  isPremium: false,
  twoFactorEnabled: false,
}

// ──────────────────────────────────────────────────
// PATCH テスト
// ──────────────────────────────────────────────────
describe('PATCH /api/v1/users/me', () => {
  beforeEach(() => {
    vi.stubEnv('MOBILE_JWT_SECRET', VALID_SECRET)
    vi.clearAllMocks()
    // auth-guard: 通常ユーザー
    mockUserFindUnique.mockResolvedValue({
      id: OWNER_ID,
      isSuspended: false,
      email: 'owner@example.com',
    })
    mockCheckUserRateLimit.mockResolvedValue({
      success: true,
      remaining: 29,
      resetTime: Date.now() + 60000,
    })
    mockIsNicknameReserved.mockReturnValue(false)
    mockAssertMediaUrlsFromOwnStorage.mockReturnValue(true)
    mockUpdateUserProfile.mockResolvedValue(mockProfileResult)
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('正常系: nickname のみ更新で 200 と更新済みプロフィールを返す', async () => {
    const req = await makeAuthenticatedPatchRequest(OWNER_ID, {
      nickname: '新しいニック',
    })
    const { PATCH } = await import('@/app/api/v1/users/me/route')
    const res = await PATCH(req)

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.id).toBe(OWNER_ID)
    expect(body.email).toBe('owner@example.com')
    expect(body.nickname).toBe('更新済みニック')
  })

  it('正常系: レスポンスに twoFactorEnabled (service の戻り値) が含まれること', async () => {
    mockUpdateUserProfile.mockResolvedValue({ ...mockProfileResult, twoFactorEnabled: true })
    const req = await makeAuthenticatedPatchRequest(OWNER_ID, { nickname: '新しいニック' })
    const { PATCH } = await import('@/app/api/v1/users/me/route')
    const res = await PATCH(req)

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.twoFactorEnabled).toBe(true)
  })

  it('正常系: bio・location を同時に更新して 200 を返す', async () => {
    const req = await makeAuthenticatedPatchRequest(OWNER_ID, {
      bio: '新しい自己紹介',
      location: '大阪',
    })
    const { PATCH } = await import('@/app/api/v1/users/me/route')
    const res = await PATCH(req)

    expect(res.status).toBe(200)
    expect(mockUpdateUserProfile).toHaveBeenCalledWith(
      OWNER_ID,
      expect.objectContaining({ bio: '新しい自己紹介', location: '大阪' }),
    )
  })

  it('正常系: isPublic=false で 200 を返す', async () => {
    const req = await makeAuthenticatedPatchRequest(OWNER_ID, {
      isPublic: false,
    })
    const { PATCH } = await import('@/app/api/v1/users/me/route')
    const res = await PATCH(req)

    expect(res.status).toBe(200)
  })

  it('正常系: avatarUrl が自社ストレージ URL の場合 200 を返す', async () => {
    mockAssertMediaUrlsFromOwnStorage.mockReturnValue(true)
    const req = await makeAuthenticatedPatchRequest(OWNER_ID, {
      avatarUrl: 'https://cdn.example.com/uploads/avatars/img.jpg',
    })
    const { PATCH } = await import('@/app/api/v1/users/me/route')
    const res = await PATCH(req)

    expect(res.status).toBe(200)
  })

  it('正常系: 空ボディ（全フィールド省略）で 200 を返す', async () => {
    const req = await makeAuthenticatedPatchRequest(OWNER_ID, {})
    const { PATCH } = await import('@/app/api/v1/users/me/route')
    const res = await PATCH(req)

    expect(res.status).toBe(200)
  })

  it('Bearer なしで 401 AUTH_REQUIRED', async () => {
    const req = new NextRequest('http://localhost/api/v1/users/me', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ nickname: 'test' }),
    })
    const { PATCH } = await import('@/app/api/v1/users/me/route')
    const res = await PATCH(req)

    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error.code).toBe('AUTH_REQUIRED')
  })

  it('ゲストユーザーで 403 GUEST_NOT_ALLOWED', async () => {
    mockUserFindUnique.mockResolvedValue({
      id: 'guest-user',
      isSuspended: false,
      email: GUEST_EMAIL,
    })

    const { signAccessToken } = await import('@/lib/api/v1/jwt')
    const token = await signAccessToken('guest-user')
    const req = new NextRequest('http://localhost/api/v1/users/me', {
      method: 'PATCH',
      headers: {
        authorization: `Bearer ${token}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ nickname: 'test' }),
    })
    const { PATCH } = await import('@/app/api/v1/users/me/route')
    const res = await PATCH(req)

    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error.code).toBe('GUEST_NOT_ALLOWED')
  })

  it('停止アカウントで 403 ACCOUNT_SUSPENDED', async () => {
    mockUserFindUnique.mockResolvedValue({
      id: OWNER_ID,
      isSuspended: true,
      email: 'owner@example.com',
    })

    const req = await makeAuthenticatedPatchRequest(OWNER_ID, { nickname: 'test' })
    const { PATCH } = await import('@/app/api/v1/users/me/route')
    const res = await PATCH(req)

    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error.code).toBe('ACCOUNT_SUSPENDED')
  })

  it('不正な JSON ボディで 400 VALIDATION_ERROR', async () => {
    const { signAccessToken } = await import('@/lib/api/v1/jwt')
    const token = await signAccessToken(OWNER_ID)
    const req = new NextRequest('http://localhost/api/v1/users/me', {
      method: 'PATCH',
      headers: {
        authorization: `Bearer ${token}`,
        'content-type': 'application/json',
      },
      body: 'invalid json{{{',
    })
    const { PATCH } = await import('@/app/api/v1/users/me/route')
    const res = await PATCH(req)

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error.code).toBe('VALIDATION_ERROR')
  })

  it('nickname が空文字（min(1) 違反）で 400 VALIDATION_ERROR', async () => {
    const req = await makeAuthenticatedPatchRequest(OWNER_ID, {
      nickname: '',
    })
    const { PATCH } = await import('@/app/api/v1/users/me/route')
    const res = await PATCH(req)

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error.code).toBe('VALIDATION_ERROR')
  })

  it('nickname に改行文字が含まれる場合 400 VALIDATION_ERROR', async () => {
    const req = await makeAuthenticatedPatchRequest(OWNER_ID, {
      nickname: '不正\nニック',
    })
    const { PATCH } = await import('@/app/api/v1/users/me/route')
    const res = await PATCH(req)

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error.code).toBe('VALIDATION_ERROR')
  })

  it('nickname に < が含まれる場合 400 VALIDATION_ERROR', async () => {
    const req = await makeAuthenticatedPatchRequest(OWNER_ID, {
      nickname: 'xss<script',
    })
    const { PATCH } = await import('@/app/api/v1/users/me/route')
    const res = await PATCH(req)

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error.code).toBe('VALIDATION_ERROR')
  })

  it('nickname が 51 文字（max(50) 超過）で 400 VALIDATION_ERROR', async () => {
    const req = await makeAuthenticatedPatchRequest(OWNER_ID, {
      nickname: 'a'.repeat(51),
    })
    const { PATCH } = await import('@/app/api/v1/users/me/route')
    const res = await PATCH(req)

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error.code).toBe('VALIDATION_ERROR')
  })

  it('bio が 201 文字（max(200) 超過）で 400 VALIDATION_ERROR', async () => {
    const req = await makeAuthenticatedPatchRequest(OWNER_ID, {
      bio: 'a'.repeat(201),
    })
    const { PATCH } = await import('@/app/api/v1/users/me/route')
    const res = await PATCH(req)

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error.code).toBe('VALIDATION_ERROR')
  })

  it('location が 101 文字（max(100) 超過）で 400 VALIDATION_ERROR', async () => {
    const req = await makeAuthenticatedPatchRequest(OWNER_ID, {
      location: 'a'.repeat(101),
    })
    const { PATCH } = await import('@/app/api/v1/users/me/route')
    const res = await PATCH(req)

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error.code).toBe('VALIDATION_ERROR')
  })

  it('bonsaiStartYear が 1899（min(1900) 未満）で 400 VALIDATION_ERROR', async () => {
    const req = await makeAuthenticatedPatchRequest(OWNER_ID, {
      bonsaiStartYear: 1899,
    })
    const { PATCH } = await import('@/app/api/v1/users/me/route')
    const res = await PATCH(req)

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error.code).toBe('VALIDATION_ERROR')
  })

  it('bonsaiStartMonth が 0（min(1) 未満）で 400 VALIDATION_ERROR', async () => {
    const req = await makeAuthenticatedPatchRequest(OWNER_ID, {
      bonsaiStartMonth: 0,
    })
    const { PATCH } = await import('@/app/api/v1/users/me/route')
    const res = await PATCH(req)

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error.code).toBe('VALIDATION_ERROR')
  })

  it('bonsaiStartMonth が 13（max(12) 超過）で 400 VALIDATION_ERROR', async () => {
    const req = await makeAuthenticatedPatchRequest(OWNER_ID, {
      bonsaiStartMonth: 13,
    })
    const { PATCH } = await import('@/app/api/v1/users/me/route')
    const res = await PATCH(req)

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error.code).toBe('VALIDATION_ERROR')
  })

  it('avatarUrl が外部 URL の場合 400 VALIDATION_ERROR', async () => {
    mockAssertMediaUrlsFromOwnStorage.mockReturnValue(false)
    const req = await makeAuthenticatedPatchRequest(OWNER_ID, {
      avatarUrl: 'https://evil.example.com/tracker.gif',
    })
    const { PATCH } = await import('@/app/api/v1/users/me/route')
    const res = await PATCH(req)

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error.code).toBe('VALIDATION_ERROR')
  })

  it('headerUrl が外部 URL の場合 400 VALIDATION_ERROR', async () => {
    mockAssertMediaUrlsFromOwnStorage.mockReturnValue(false)
    const req = await makeAuthenticatedPatchRequest(OWNER_ID, {
      headerUrl: 'https://evil.example.com/tracker.gif',
    })
    const { PATCH } = await import('@/app/api/v1/users/me/route')
    const res = await PATCH(req)

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error.code).toBe('VALIDATION_ERROR')
  })

  it('nickname が予約語の場合 400 VALIDATION_ERROR', async () => {
    mockIsNicknameReserved.mockReturnValue(true)
    const req = await makeAuthenticatedPatchRequest(OWNER_ID, {
      nickname: 'E2Eテストユーザー',
    })
    const { PATCH } = await import('@/app/api/v1/users/me/route')
    const res = await PATCH(req)

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error.code).toBe('VALIDATION_ERROR')
  })

  it('nickname が予約語の場合 isNicknameReserved が呼ばれること', async () => {
    mockIsNicknameReserved.mockReturnValue(true)
    const req = await makeAuthenticatedPatchRequest(OWNER_ID, {
      nickname: 'E2Eテストユーザー',
    })
    const { PATCH } = await import('@/app/api/v1/users/me/route')
    await PATCH(req)

    expect(mockIsNicknameReserved).toHaveBeenCalledWith('E2Eテストユーザー')
  })

  it('nickname 未指定の場合は isNicknameReserved が呼ばれないこと', async () => {
    const req = await makeAuthenticatedPatchRequest(OWNER_ID, {
      bio: '自己紹介のみ更新',
    })
    const { PATCH } = await import('@/app/api/v1/users/me/route')
    await PATCH(req)

    expect(mockIsNicknameReserved).not.toHaveBeenCalled()
  })

  it('レート制限超過で 429 RATE_LIMITED', async () => {
    mockCheckUserRateLimit.mockResolvedValue({
      success: false,
      remaining: 0,
      resetTime: Date.now() + 60000,
    })
    const req = await makeAuthenticatedPatchRequest(OWNER_ID, {
      nickname: '新しい名前',
    })
    const { PATCH } = await import('@/app/api/v1/users/me/route')
    const res = await PATCH(req)

    expect(res.status).toBe(429)
    const body = await res.json()
    expect(body.error.code).toBe('RATE_LIMITED')
  })

  it('Zod 検証通過後にレート制限が呼ばれること（Zod バリデーションエラー時は rate-limit を消費しない）', async () => {
    // nickname に禁止文字 → Zod 失敗 → rate-limit は呼ばれない
    const req = await makeAuthenticatedPatchRequest(OWNER_ID, {
      nickname: 'bad\nname',
    })
    const { PATCH } = await import('@/app/api/v1/users/me/route')
    await PATCH(req)

    expect(mockCheckUserRateLimit).not.toHaveBeenCalled()
  })

  it('レスポンス形式に error フィールドが { code, message, status } 形式であること（エラー時）', async () => {
    const req = new NextRequest('http://localhost/api/v1/users/me', {
      method: 'PATCH',
    })
    const { PATCH } = await import('@/app/api/v1/users/me/route')
    const res = await PATCH(req)

    const body = await res.json()
    expect(body).toHaveProperty('error')
    expect(body.error).toHaveProperty('code')
    expect(body.error).toHaveProperty('message')
    expect(body.error).toHaveProperty('status')
  })
})

// ──────────────────────────────────────────────────
// DELETE テスト
// ──────────────────────────────────────────────────
describe('DELETE /api/v1/users/me', () => {
  beforeEach(() => {
    vi.stubEnv('MOBILE_JWT_SECRET', VALID_SECRET)
    vi.clearAllMocks()
    // auth-guard: 通常ユーザー
    mockUserFindUnique.mockResolvedValue({
      id: OWNER_ID,
      isSuspended: false,
      email: 'owner@example.com',
    })
    mockCheckUserRateLimit.mockResolvedValue({
      success: true,
      remaining: 29,
      resetTime: Date.now() + 60000,
    })
    mockDeleteUserAccount.mockResolvedValue(undefined)
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('正常系: 200 と { success: true } を返す', async () => {
    const req = await makeAuthenticatedDeleteRequest(OWNER_ID)
    const { DELETE } = await import('@/app/api/v1/users/me/route')
    const res = await DELETE(req)

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toEqual({ success: true })
  })

  it('正常系: deleteUserAccount が userId で呼ばれること', async () => {
    const req = await makeAuthenticatedDeleteRequest(OWNER_ID)
    const { DELETE } = await import('@/app/api/v1/users/me/route')
    await DELETE(req)

    expect(mockDeleteUserAccount).toHaveBeenCalledWith(OWNER_ID)
    expect(mockDeleteUserAccount).toHaveBeenCalledTimes(1)
  })

  it('Bearer なしで 401 AUTH_REQUIRED', async () => {
    const req = new NextRequest('http://localhost/api/v1/users/me', {
      method: 'DELETE',
    })
    const { DELETE } = await import('@/app/api/v1/users/me/route')
    const res = await DELETE(req)

    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error.code).toBe('AUTH_REQUIRED')
  })

  it('ゲストユーザーで 403 GUEST_NOT_ALLOWED', async () => {
    mockUserFindUnique.mockResolvedValue({
      id: 'guest-user',
      isSuspended: false,
      email: GUEST_EMAIL,
    })

    const { signAccessToken } = await import('@/lib/api/v1/jwt')
    const token = await signAccessToken('guest-user')
    const req = new NextRequest('http://localhost/api/v1/users/me', {
      method: 'DELETE',
      headers: { authorization: `Bearer ${token}` },
    })
    const { DELETE } = await import('@/app/api/v1/users/me/route')
    const res = await DELETE(req)

    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error.code).toBe('GUEST_NOT_ALLOWED')
  })

  it('停止アカウントで 403 ACCOUNT_SUSPENDED', async () => {
    mockUserFindUnique.mockResolvedValue({
      id: OWNER_ID,
      isSuspended: true,
      email: 'owner@example.com',
    })

    const req = await makeAuthenticatedDeleteRequest(OWNER_ID)
    const { DELETE } = await import('@/app/api/v1/users/me/route')
    const res = await DELETE(req)

    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error.code).toBe('ACCOUNT_SUSPENDED')
  })

  it('レート制限超過で 429 RATE_LIMITED', async () => {
    mockCheckUserRateLimit.mockResolvedValue({
      success: false,
      remaining: 0,
      resetTime: Date.now() + 60000,
    })

    const req = await makeAuthenticatedDeleteRequest(OWNER_ID)
    const { DELETE } = await import('@/app/api/v1/users/me/route')
    const res = await DELETE(req)

    expect(res.status).toBe(429)
    const body = await res.json()
    expect(body.error.code).toBe('RATE_LIMITED')
  })

  it('deleteUserAccount がエラーをスローした場合 500 INTERNAL_ERROR を返す', async () => {
    mockDeleteUserAccount.mockRejectedValue(new Error('Transaction failed'))

    const req = await makeAuthenticatedDeleteRequest(OWNER_ID)
    const { DELETE } = await import('@/app/api/v1/users/me/route')
    const res = await DELETE(req)

    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error.code).toBe('INTERNAL_ERROR')
  })

  it('500 エラー時のレスポンス形式が { error: { code, message, status } } であること', async () => {
    mockDeleteUserAccount.mockRejectedValue(new Error('DB error'))

    const req = await makeAuthenticatedDeleteRequest(OWNER_ID)
    const { DELETE } = await import('@/app/api/v1/users/me/route')
    const res = await DELETE(req)

    const body = await res.json()
    expect(body.error.code).toBe('INTERNAL_ERROR')
    expect(body.error.status).toBe(500)
    expect(body.error.message).toBeTruthy()
  })

  it('改ざんトークンで 401 AUTH_INVALID_TOKEN', async () => {
    const req = new NextRequest('http://localhost/api/v1/users/me', {
      method: 'DELETE',
      headers: { authorization: 'Bearer invalid.token.value' },
    })
    const { DELETE } = await import('@/app/api/v1/users/me/route')
    const res = await DELETE(req)

    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error.code).toBe('AUTH_INVALID_TOKEN')
  })

  it('ゲスト拒否時は deleteUserAccount が呼ばれないこと（セキュリティ検証）', async () => {
    mockUserFindUnique.mockResolvedValue({
      id: 'guest-user',
      isSuspended: false,
      email: GUEST_EMAIL,
    })

    const { signAccessToken } = await import('@/lib/api/v1/jwt')
    const token = await signAccessToken('guest-user')
    const req = new NextRequest('http://localhost/api/v1/users/me', {
      method: 'DELETE',
      headers: { authorization: `Bearer ${token}` },
    })
    const { DELETE } = await import('@/app/api/v1/users/me/route')
    await DELETE(req)

    expect(mockDeleteUserAccount).not.toHaveBeenCalled()
  })

  it('レート制限超過時は deleteUserAccount が呼ばれないこと', async () => {
    mockCheckUserRateLimit.mockResolvedValue({
      success: false,
      remaining: 0,
      resetTime: Date.now() + 60000,
    })

    const req = await makeAuthenticatedDeleteRequest(OWNER_ID)
    const { DELETE } = await import('@/app/api/v1/users/me/route')
    await DELETE(req)

    expect(mockDeleteUserAccount).not.toHaveBeenCalled()
  })
})
