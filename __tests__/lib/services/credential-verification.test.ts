// @vitest-environment node
/**
 * lib/services/credential-verification のユニットテスト
 *
 * verifyCredentials の全 reason（throttled / invalid / no_password /
 * unverified / suspended / ok）を検証する。
 */
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { createMockPrismaClient } from '../../utils/test-utils'

const mockPrisma = createMockPrismaClient()
vi.mock('@/lib/db', () => ({ prisma: mockPrisma }))

const mockBcryptCompare = vi.fn()
vi.mock('bcryptjs', () => ({
  __esModule: true,
  default: { compare: (...args: unknown[]) => mockBcryptCompare(...args) },
  compare: (...args: unknown[]) => mockBcryptCompare(...args),
}))

const mockCheckLoginThrottle = vi.fn()
const mockRecordLoginFailure = vi.fn().mockResolvedValue(undefined)
const mockResetLoginThrottle = vi.fn().mockResolvedValue(undefined)
vi.mock('@/lib/services/login-throttle', () => ({
  checkLoginThrottleForRequest: (...args: unknown[]) => mockCheckLoginThrottle(...args),
  recordLoginFailureForRequest: (...args: unknown[]) => mockRecordLoginFailure(...args),
  resetLoginThrottleForRequest: (...args: unknown[]) => mockResetLoginThrottle(...args),
}))

const baseUser = {
  id: 'user-1',
  email: 'test@example.com',
  password: '$2b$12$hashedpassword',
  nickname: 'テストユーザー',
  avatarUrl: null,
  isSuspended: false,
  emailVerified: new Date('2024-01-01'),
  twoFactorEnabled: false,
}

describe('lib/services/credential-verification', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCheckLoginThrottle.mockResolvedValue({ allowed: true, remainingAttempts: 5 })
    mockBcryptCompare.mockResolvedValue(true)
  })

  it('正常照合で ok:true と user を返す', async () => {
    mockPrisma.user.findUnique.mockResolvedValueOnce(baseUser)

    const { verifyCredentials } = await import('@/lib/services/credential-verification')
    const result = await verifyCredentials('test@example.com', 'correctpassword')

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.user.id).toBe('user-1')
      expect(result.user.email).toBe('test@example.com')
      expect(result.user.twoFactorEnabled).toBe(false)
    }
    expect(mockResetLoginThrottle).toHaveBeenCalledWith('test@example.com')
  })

  it('ブルートフォースロックアウト中で throttled を返す', async () => {
    mockCheckLoginThrottle.mockResolvedValueOnce({ allowed: false, remainingAttempts: 0 })

    const { verifyCredentials } = await import('@/lib/services/credential-verification')
    const result = await verifyCredentials('locked@example.com', 'anypassword')

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toBe('throttled')
    expect(mockPrisma.user.findUnique).not.toHaveBeenCalled()
  })

  it('ユーザー不存在で invalid を返し失敗記録する', async () => {
    mockPrisma.user.findUnique.mockResolvedValueOnce(null)

    const { verifyCredentials } = await import('@/lib/services/credential-verification')
    const result = await verifyCredentials('notexist@example.com', 'anypassword')

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toBe('invalid')
    expect(mockRecordLoginFailure).toHaveBeenCalledWith('notexist@example.com')
  })

  it('password が null（OAuth 専用）で no_password を返す', async () => {
    mockPrisma.user.findUnique.mockResolvedValueOnce({ ...baseUser, password: null })

    const { verifyCredentials } = await import('@/lib/services/credential-verification')
    const result = await verifyCredentials('oauth@example.com', 'anypassword')

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toBe('no_password')
    expect(mockRecordLoginFailure).toHaveBeenCalled()
  })

  it('emailVerified が null で unverified を返す', async () => {
    mockPrisma.user.findUnique.mockResolvedValueOnce({ ...baseUser, emailVerified: null })

    const { verifyCredentials } = await import('@/lib/services/credential-verification')
    const result = await verifyCredentials('unverified@example.com', 'anypassword')

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toBe('unverified')
    expect(mockRecordLoginFailure).toHaveBeenCalled()
  })

  it('isSuspended=true で suspended を返す', async () => {
    mockPrisma.user.findUnique.mockResolvedValueOnce({ ...baseUser, isSuspended: true })

    const { verifyCredentials } = await import('@/lib/services/credential-verification')
    const result = await verifyCredentials('suspended@example.com', 'anypassword')

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toBe('suspended')
    expect(mockRecordLoginFailure).toHaveBeenCalled()
  })

  it('パスワード不一致で invalid を返し失敗記録する', async () => {
    mockPrisma.user.findUnique.mockResolvedValueOnce(baseUser)
    mockBcryptCompare.mockResolvedValueOnce(false)

    const { verifyCredentials } = await import('@/lib/services/credential-verification')
    const result = await verifyCredentials('test@example.com', 'wrongpassword')

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toBe('invalid')
    expect(mockRecordLoginFailure).toHaveBeenCalledWith('test@example.com')
    expect(mockResetLoginThrottle).not.toHaveBeenCalled()
  })

  it('2FA 有効ユーザーで ok:true + twoFactorEnabled:true を返す', async () => {
    mockPrisma.user.findUnique.mockResolvedValueOnce({ ...baseUser, twoFactorEnabled: true })

    const { verifyCredentials } = await import('@/lib/services/credential-verification')
    const result = await verifyCredentials('test@example.com', 'correctpassword')

    expect(result.ok).toBe(true)
    if (result.ok) expect(result.user.twoFactorEnabled).toBe(true)
  })
})
