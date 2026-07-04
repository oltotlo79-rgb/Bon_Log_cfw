// @vitest-environment node
/**
 * lib/actions/account-security（changePassword Server Action）のユニットテスト
 *
 * 認証 → Zod → レート制限 → service 委譲の順序と各段の失敗ケースを検証する。
 * コア処理（bcrypt 比較・Prisma 更新）は lib/services/password-change-service.ts の
 * テストで検証済みのため、ここでは changeUserPasswordCore をモックしてラッパの
 * 振る舞いのみを検証する。
 */
import { vi, describe, it, beforeEach, expect } from 'vitest'
import { createMockPrismaClient, mockUser } from '../../utils/test-utils'
import { expectSuccess, expectError } from '../../helpers/action-result'

const mockPrisma = createMockPrismaClient()
vi.mock('@/lib/db', () => ({
  prisma: mockPrisma,
}))

const mockAuth = vi.fn()
vi.mock('@/lib/auth', () => ({
  auth: () => mockAuth(),
}))

const mockCheckUserRateLimit = vi.fn()
vi.mock('@/lib/rate-limit', async () => {
  const actual = await vi.importActual<typeof import('@/lib/rate-limit')>('@/lib/rate-limit')
  return {
    ...actual,
    checkUserRateLimit: (...args: unknown[]) => mockCheckUserRateLimit(...args),
  }
})

const mockChangeUserPasswordCore = vi.fn()
vi.mock('@/lib/services/password-change-service', () => ({
  changeUserPasswordCore: (...args: unknown[]) => mockChangeUserPasswordCore(...args),
}))

const mockRevalidatePath = vi.fn()
vi.mock('next/cache', () => ({
  revalidatePath: (...args: unknown[]) => mockRevalidatePath(...args),
  unstable_cache: (fn: unknown) => fn,
}))

// getClientIp() (lib/utils/request-ip.ts) が呼ぶ next/headers をリクエストスコープ外でも動くようにモック
vi.mock('next/headers', () => ({
  headers: vi.fn().mockResolvedValue(new Map([['x-forwarded-for', '203.0.113.1']])),
}))

const VALID_INPUT = { currentPassword: 'currentPass1', newPassword: 'newPassword1' }

describe('changePassword', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuth.mockResolvedValue({ user: { id: mockUser.id, email: mockUser.email } })
    mockPrisma.user.findUnique.mockResolvedValue({ isSuspended: false })
    mockCheckUserRateLimit.mockResolvedValue({ success: true, remaining: 4, resetTime: Date.now() + 60000 })
    mockChangeUserPasswordCore.mockResolvedValue({ ok: true })
  })

  it('未認証の場合はエラーを返す', async () => {
    mockAuth.mockResolvedValueOnce(null)

    const { changePassword } = await import('@/lib/actions/account-security')
    const result = await changePassword(VALID_INPUT)

    expectError(result)
    expect(result.error).toBe('認証が必要です')
    expect(mockChangeUserPasswordCore).not.toHaveBeenCalled()
  })

  it('停止中アカウントの場合はエラーを返す', async () => {
    mockPrisma.user.findUnique.mockResolvedValueOnce({ isSuspended: true })

    const { changePassword } = await import('@/lib/actions/account-security')
    const result = await changePassword(VALID_INPUT)

    expectError(result)
    expect(result.error).toBe('アカウントが停止されています')
    expect(mockChangeUserPasswordCore).not.toHaveBeenCalled()
  })

  it('ゲストアカウントの場合はエラーを返す', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'guest-id', email: 'guest@example.com' } })

    const { changePassword } = await import('@/lib/actions/account-security')
    const result = await changePassword(VALID_INPUT)

    expectError(result)
    expect(mockChangeUserPasswordCore).not.toHaveBeenCalled()
  })

  it('新パスワードが強度不足（数字なし）の場合はエラーを返しレート制限を消費しない', async () => {
    const { changePassword } = await import('@/lib/actions/account-security')
    const result = await changePassword({ currentPassword: 'currentPass1', newPassword: 'nonumberpass' })

    expectError(result)
    expect(mockCheckUserRateLimit).not.toHaveBeenCalled()
    expect(mockChangeUserPasswordCore).not.toHaveBeenCalled()
  })

  it('新パスワードが8文字未満の場合はエラーを返す', async () => {
    const { changePassword } = await import('@/lib/actions/account-security')
    const result = await changePassword({ currentPassword: 'currentPass1', newPassword: 'a1' })

    expectError(result)
    expect(mockChangeUserPasswordCore).not.toHaveBeenCalled()
  })

  it('現パスワードが空文字の場合はエラーを返す', async () => {
    const { changePassword } = await import('@/lib/actions/account-security')
    const result = await changePassword({ currentPassword: '', newPassword: 'newPassword1' })

    expectError(result)
    expect(mockChangeUserPasswordCore).not.toHaveBeenCalled()
  })

  it('入力が object 型ですらない場合は ERR_INVALID_INPUT にフォールバックする', async () => {
    const { changePassword } = await import('@/lib/actions/account-security')
    // Zod の field レベルエラーが一切発生しない形状不正（フィールドエラーが空）を再現する
    const result = await changePassword(null as unknown as { currentPassword: string; newPassword: string })

    expectError(result)
    expect(result.error).toBe('入力データが不正です')
    expect(mockChangeUserPasswordCore).not.toHaveBeenCalled()
  })

  it('レート制限超過の場合はエラーを返す', async () => {
    mockCheckUserRateLimit.mockResolvedValueOnce({ success: false, remaining: 0, resetTime: Date.now() + 60000 })

    const { changePassword } = await import('@/lib/actions/account-security')
    const result = await changePassword(VALID_INPUT)

    expectError(result)
    expect(result.error).toBe('操作が多すぎます。しばらく待ってから再試行してください')
    expect(mockChangeUserPasswordCore).not.toHaveBeenCalled()
  })

  it('service が成功した場合 actionSuccess を返し revalidatePath を呼ぶ', async () => {
    const { changePassword } = await import('@/lib/actions/account-security')
    const result = await changePassword(VALID_INPUT)

    expectSuccess(result)
    expect(mockChangeUserPasswordCore).toHaveBeenCalledWith(
      mockUser.id,
      VALID_INPUT.currentPassword,
      VALID_INPUT.newPassword,
      '203.0.113.1',
    )
    expect(mockRevalidatePath).toHaveBeenCalledWith('/settings/security')
  })

  it('service が現パスワード不一致で失敗した場合 actionError を返す', async () => {
    mockChangeUserPasswordCore.mockResolvedValueOnce({ ok: false, error: 'パスワードが正しくありません' })

    const { changePassword } = await import('@/lib/actions/account-security')
    const result = await changePassword(VALID_INPUT)

    expectError(result)
    expect(result.error).toBe('パスワードが正しくありません')
    expect(mockRevalidatePath).not.toHaveBeenCalled()
  })

  it('service が OAuth 専用アカウントエラーで失敗した場合 actionError を返す', async () => {
    mockChangeUserPasswordCore.mockResolvedValueOnce({ ok: false, error: 'パスワードが設定されていません' })

    const { changePassword } = await import('@/lib/actions/account-security')
    const result = await changePassword(VALID_INPUT)

    expectError(result)
    expect(result.error).toBe('パスワードが設定されていません')
  })
})
