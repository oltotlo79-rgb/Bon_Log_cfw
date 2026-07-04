// @vitest-environment node
/**
 * lib/services/password-change-service のユニットテスト
 *
 * changeUserPasswordCore の正常系・エラー分岐（ユーザー不在・OAuth専用アカウント・
 * 現パスワード不一致）と、成功時の security event ログ呼び出しを検証する。
 * Web の lib/actions/account-security.ts と app/api/v1/auth/password/change は
 * このサービスに委譲するため、呼び出し元（Web action / v1 route）の薄いラッパは
 * それぞれ別テストで検証する。
 */
import { vi, describe, it, expect, beforeEach } from 'vitest'

vi.mock('server-only', () => ({}))

const mockUserFindUnique = vi.fn()
const mockUserUpdate = vi.fn()
vi.mock('@/lib/db', () => ({
  prisma: {
    user: {
      findUnique: (...args: unknown[]) => mockUserFindUnique(...args),
      update: (...args: unknown[]) => mockUserUpdate(...args),
    },
  },
}))

vi.mock('bcryptjs', () => ({
  default: { compare: vi.fn(), hash: vi.fn() },
  compare: vi.fn(),
  hash: vi.fn(),
}))

const mockLogPasswordChangeSuccess = vi.fn()
vi.mock('@/lib/security-logger', () => ({
  logPasswordChangeSuccess: (...args: unknown[]) => mockLogPasswordChangeSuccess(...args),
}))

import bcrypt from 'bcryptjs'

describe('changeUserPasswordCore', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('ユーザーが見つからない場合 ok:false + ERR_USER_NOT_FOUND を返す', async () => {
    mockUserFindUnique.mockResolvedValueOnce(null)

    const { changeUserPasswordCore } = await import('@/lib/services/password-change-service')
    const result = await changeUserPasswordCore('user-123', 'currentPass1', 'newPassword1')

    expect(result).toEqual({ ok: false, error: 'ユーザーが見つかりません' })
    expect(mockUserUpdate).not.toHaveBeenCalled()
  })

  it('OAuth専用アカウント（password が null）の場合 ok:false + ERR_NO_PASSWORD_SET を返す', async () => {
    mockUserFindUnique.mockResolvedValueOnce({ password: null })

    const { changeUserPasswordCore } = await import('@/lib/services/password-change-service')
    const result = await changeUserPasswordCore('user-123', 'currentPass1', 'newPassword1')

    expect(result).toEqual({ ok: false, error: 'パスワードが設定されていません' })
    expect(mockUserUpdate).not.toHaveBeenCalled()
  })

  it('現パスワードが間違っている場合 ok:false + ERR_INCORRECT_PASSWORD を返す', async () => {
    mockUserFindUnique.mockResolvedValueOnce({ password: 'hashedCurrentPassword' })
    ;(bcrypt.compare as ReturnType<typeof vi.fn>).mockResolvedValueOnce(false)

    const { changeUserPasswordCore } = await import('@/lib/services/password-change-service')
    const result = await changeUserPasswordCore('user-123', 'wrongCurrentPass1', 'newPassword1')

    expect(result).toEqual({ ok: false, error: 'パスワードが正しくありません' })
    expect(bcrypt.compare).toHaveBeenCalledWith('wrongCurrentPass1', 'hashedCurrentPassword')
    expect(mockUserUpdate).not.toHaveBeenCalled()
    expect(mockLogPasswordChangeSuccess).not.toHaveBeenCalled()
  })

  it('正常系: 現パスワード一致時に新パスワードをハッシュ化して更新する', async () => {
    mockUserFindUnique.mockResolvedValueOnce({ password: 'hashedCurrentPassword' })
    ;(bcrypt.compare as ReturnType<typeof vi.fn>).mockResolvedValueOnce(true)
    ;(bcrypt.hash as ReturnType<typeof vi.fn>).mockResolvedValueOnce('hashedNewPassword')
    mockUserUpdate.mockResolvedValueOnce({})

    const { changeUserPasswordCore } = await import('@/lib/services/password-change-service')
    const result = await changeUserPasswordCore('user-123', 'currentPass1', 'newPassword1')

    expect(result).toEqual({ ok: true })
    expect(bcrypt.hash).toHaveBeenCalledWith('newPassword1', 12)
    expect(mockUserUpdate).toHaveBeenCalledWith({
      where: { id: 'user-123' },
      data: { password: 'hashedNewPassword' },
    })
  })

  it('正常系: 成功時に logPasswordChangeSuccess が呼ばれる', async () => {
    mockUserFindUnique.mockResolvedValueOnce({ password: 'hashedCurrentPassword' })
    ;(bcrypt.compare as ReturnType<typeof vi.fn>).mockResolvedValueOnce(true)
    ;(bcrypt.hash as ReturnType<typeof vi.fn>).mockResolvedValueOnce('hashedNewPassword')
    mockUserUpdate.mockResolvedValueOnce({})

    const { changeUserPasswordCore } = await import('@/lib/services/password-change-service')
    await changeUserPasswordCore('user-123', 'currentPass1', 'newPassword1', '203.0.113.1')

    expect(mockLogPasswordChangeSuccess).toHaveBeenCalledWith('user-123', '203.0.113.1')
  })

  it('user.findUnique は password のみを select する（不要なフィールドを取得しない）', async () => {
    mockUserFindUnique.mockResolvedValueOnce({ password: 'hashedCurrentPassword' })
    ;(bcrypt.compare as ReturnType<typeof vi.fn>).mockResolvedValueOnce(true)
    ;(bcrypt.hash as ReturnType<typeof vi.fn>).mockResolvedValueOnce('hashedNewPassword')
    mockUserUpdate.mockResolvedValueOnce({})

    const { changeUserPasswordCore } = await import('@/lib/services/password-change-service')
    await changeUserPasswordCore('user-123', 'currentPass1', 'newPassword1')

    expect(mockUserFindUnique).toHaveBeenCalledWith({
      where: { id: 'user-123' },
      select: { password: true },
    })
  })
})
