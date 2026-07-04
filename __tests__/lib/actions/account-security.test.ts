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
const mockRateLimit = vi.fn()
vi.mock('@/lib/rate-limit', async () => {
  const actual = await vi.importActual<typeof import('@/lib/rate-limit')>('@/lib/rate-limit')
  return {
    ...actual,
    checkUserRateLimit: (...args: unknown[]) => mockCheckUserRateLimit(...args),
    rateLimit: (...args: unknown[]) => mockRateLimit(...args),
  }
})

const mockChangeUserPasswordCore = vi.fn()
vi.mock('@/lib/services/password-change-service', () => ({
  changeUserPasswordCore: (...args: unknown[]) => mockChangeUserPasswordCore(...args),
}))

const mockRequestEmailChangeCore = vi.fn()
const mockConfirmEmailChangeCore = vi.fn()
vi.mock('@/lib/services/email-change-service', () => ({
  requestEmailChangeCore: (...args: unknown[]) => mockRequestEmailChangeCore(...args),
  confirmEmailChangeCore: (...args: unknown[]) => mockConfirmEmailChangeCore(...args),
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

/**
 * requestEmailChange（メールアドレス変更リクエスト Server Action）のユニットテスト
 *
 * 認証 → Zod → レート制限 → requestEmailChangeCore 委譲の順序と各段の失敗ケースを検証する。
 * 列挙攻撃対策のため、currentPassword 不一致・OAuth 専用アカウント以外の service 失敗は
 * actionSuccess に丸められる（.claude/rules/server-actions.md 参照）。
 */
describe('requestEmailChange', () => {
  const VALID_REQUEST_INPUT = { newEmail: 'new@example.com', currentPassword: 'currentPass1' }

  beforeEach(() => {
    vi.clearAllMocks()
    mockAuth.mockResolvedValue({ user: { id: mockUser.id, email: mockUser.email } })
    mockPrisma.user.findUnique.mockResolvedValue({ isSuspended: false })
    mockCheckUserRateLimit.mockResolvedValue({ success: true, remaining: 4, resetTime: Date.now() + 60000 })
    mockRequestEmailChangeCore.mockResolvedValue({ ok: true })
  })

  it('未認証の場合はエラーを返す', async () => {
    mockAuth.mockResolvedValueOnce(null)

    const { requestEmailChange } = await import('@/lib/actions/account-security')
    const result = await requestEmailChange(VALID_REQUEST_INPUT)

    expectError(result)
    expect(result.error).toBe('認証が必要です')
    expect(mockRequestEmailChangeCore).not.toHaveBeenCalled()
  })

  it('停止中アカウントの場合はエラーを返す', async () => {
    mockPrisma.user.findUnique.mockResolvedValueOnce({ isSuspended: true })

    const { requestEmailChange } = await import('@/lib/actions/account-security')
    const result = await requestEmailChange(VALID_REQUEST_INPUT)

    expectError(result)
    expect(result.error).toBe('アカウントが停止されています')
    expect(mockRequestEmailChangeCore).not.toHaveBeenCalled()
  })

  it('ゲストアカウントの場合はエラーを返す', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'guest-id', email: 'guest@example.com' } })

    const { requestEmailChange } = await import('@/lib/actions/account-security')
    const result = await requestEmailChange(VALID_REQUEST_INPUT)

    expectError(result)
    expect(mockRequestEmailChangeCore).not.toHaveBeenCalled()
  })

  it('newEmail が不正なメール形式の場合はエラーを返しレート制限を消費しない', async () => {
    const { requestEmailChange } = await import('@/lib/actions/account-security')
    const result = await requestEmailChange({ newEmail: 'not-an-email', currentPassword: 'currentPass1' })

    expectError(result)
    expect(result.error).toBe('入力データが不正です')
    expect(mockCheckUserRateLimit).not.toHaveBeenCalled()
    expect(mockRequestEmailChangeCore).not.toHaveBeenCalled()
  })

  it('currentPassword が空文字の場合はエラーを返す', async () => {
    const { requestEmailChange } = await import('@/lib/actions/account-security')
    const result = await requestEmailChange({ newEmail: 'new@example.com', currentPassword: '' })

    expectError(result)
    expect(mockRequestEmailChangeCore).not.toHaveBeenCalled()
  })

  it('レート制限超過の場合はエラーを返す', async () => {
    mockCheckUserRateLimit.mockResolvedValueOnce({ success: false, remaining: 0, resetTime: Date.now() + 60000 })

    const { requestEmailChange } = await import('@/lib/actions/account-security')
    const result = await requestEmailChange(VALID_REQUEST_INPUT)

    expectError(result)
    expect(result.error).toBe('操作が多すぎます。しばらく待ってから再試行してください')
    expect(mockRequestEmailChangeCore).not.toHaveBeenCalled()
  })

  it('service が成功した場合 actionSuccess を返す（revalidatePath は呼ばない: 未確定のためキャッシュ更新不要）', async () => {
    const { requestEmailChange } = await import('@/lib/actions/account-security')
    const result = await requestEmailChange(VALID_REQUEST_INPUT)

    expectSuccess(result)
    expect(mockRequestEmailChangeCore).toHaveBeenCalledWith(
      mockUser.id,
      VALID_REQUEST_INPUT.currentPassword,
      VALID_REQUEST_INPUT.newEmail,
      '203.0.113.1',
    )
  })

  it('service が現パスワード不一致で失敗した場合 actionError を返す', async () => {
    mockRequestEmailChangeCore.mockResolvedValueOnce({ ok: false, error: 'パスワードが正しくありません' })

    const { requestEmailChange } = await import('@/lib/actions/account-security')
    const result = await requestEmailChange(VALID_REQUEST_INPUT)

    expectError(result)
    expect(result.error).toBe('パスワードが正しくありません')
  })

  it('service が OAuth 専用アカウントエラーで失敗した場合 actionError を返す', async () => {
    mockRequestEmailChangeCore.mockResolvedValueOnce({ ok: false, error: 'パスワードが設定されていません' })

    const { requestEmailChange } = await import('@/lib/actions/account-security')
    const result = await requestEmailChange(VALID_REQUEST_INPUT)

    expectError(result)
    expect(result.error).toBe('パスワードが設定されていません')
  })

  it('列挙攻撃対策: service が newEmail 重複等その他の理由で ok:false でも actionSuccess に丸める', async () => {
    mockRequestEmailChangeCore.mockResolvedValueOnce({ ok: false, error: 'メールの送信に失敗しました。しばらく経ってからお試しください。' })

    const { requestEmailChange } = await import('@/lib/actions/account-security')
    const result = await requestEmailChange(VALID_REQUEST_INPUT)

    expectSuccess(result)
  })
})

/**
 * confirmEmailChange（メールアドレス変更確認 Server Action）のユニットテスト
 *
 * 認証不要（トークン所持が本人性の証明）。Zod → レート制限（IP ベース）→
 * confirmEmailChangeCore 委譲の順序と各段の失敗ケースを検証する。
 */
describe('confirmEmailChange', () => {
  const VALID_TOKEN = 'a'.repeat(64)

  beforeEach(() => {
    vi.clearAllMocks()
    mockRateLimit.mockResolvedValue({ success: true, remaining: 9, resetTime: Date.now() + 60000 })
    mockConfirmEmailChangeCore.mockResolvedValue({ ok: true })
  })

  it('トークンが短すぎる場合はエラーを返しレート制限を消費しない', async () => {
    const { confirmEmailChange } = await import('@/lib/actions/account-security')
    const result = await confirmEmailChange('short')

    expectError(result)
    expect(result.error).toBe('メールアドレス変更の確認リンクが無効または期限切れです。もう一度お試しください。')
    expect(mockRateLimit).not.toHaveBeenCalled()
    expect(mockConfirmEmailChangeCore).not.toHaveBeenCalled()
  })

  it('レート制限超過の場合はエラーを返す', async () => {
    mockRateLimit.mockResolvedValueOnce({ success: false, remaining: 0, resetTime: Date.now() + 60000 })

    const { confirmEmailChange } = await import('@/lib/actions/account-security')
    const result = await confirmEmailChange(VALID_TOKEN)

    expectError(result)
    expect(result.error).toBe('メールアドレス変更の要求が多すぎます。しばらく経ってからお試しください。')
    expect(mockConfirmEmailChangeCore).not.toHaveBeenCalled()
  })

  it('service が成功した場合 actionSuccess を返し account/security 双方の revalidatePath を呼ぶ', async () => {
    const { confirmEmailChange } = await import('@/lib/actions/account-security')
    const result = await confirmEmailChange(VALID_TOKEN)

    expectSuccess(result)
    expect(mockConfirmEmailChangeCore).toHaveBeenCalledWith(VALID_TOKEN)
    expect(mockRevalidatePath).toHaveBeenCalledWith('/settings/account')
    expect(mockRevalidatePath).toHaveBeenCalledWith('/settings/security')
  })

  it('service が invalid_token を返した場合 actionError を返す', async () => {
    mockConfirmEmailChangeCore.mockResolvedValueOnce({ ok: false, reason: 'invalid_token' })

    const { confirmEmailChange } = await import('@/lib/actions/account-security')
    const result = await confirmEmailChange(VALID_TOKEN)

    expectError(result)
    expect(result.error).toBe('メールアドレス変更の確認リンクが無効または期限切れです。もう一度お試しください。')
    expect(mockRevalidatePath).not.toHaveBeenCalled()
  })

  it('service が email_taken を返した場合 ERR_EMAIL_ALREADY_IN_USE を返す（TOCTOU）', async () => {
    mockConfirmEmailChangeCore.mockResolvedValueOnce({ ok: false, reason: 'email_taken' })

    const { confirmEmailChange } = await import('@/lib/actions/account-security')
    const result = await confirmEmailChange(VALID_TOKEN)

    expectError(result)
    expect(result.error).toBe('このメールアドレスは既に使用されています')
    expect(mockRevalidatePath).not.toHaveBeenCalled()
  })
})
