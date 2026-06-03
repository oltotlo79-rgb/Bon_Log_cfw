// @vitest-environment node

import { vi, describe, it, expect, beforeEach } from 'vitest'

const mockRedisGet = vi.fn()
const mockRedisSet = vi.fn()
const mockRedisDel = vi.fn()
const mockRedisGetdel = vi.fn()

vi.mock('@/lib/redis', () => ({
  getRedisClient: () => ({
    get: mockRedisGet,
    set: mockRedisSet,
    del: mockRedisDel,
    getdel: mockRedisGetdel,
  }),
}))

vi.stubGlobal('crypto', {
  ...globalThis.crypto,
  randomUUID: () => 'fixed-ticket-uuid',
})

beforeEach(() => {
  vi.clearAllMocks()
})

describe('issueTwoFactorLoginTicket', () => {
  it('TTL 付きでチケットを Redis に保存し、生成したチケットを返す', async () => {
    const { issueTwoFactorLoginTicket } = await import('@/lib/two-factor-login-ticket')
    const { TWO_FACTOR_LOGIN_TICKET_TTL_SECONDS } = await import('@/lib/constants/limits')

    const ticket = await issueTwoFactorLoginTicket('user@example.com')

    expect(ticket).toBe('fixed-ticket-uuid')
    expect(mockRedisSet).toHaveBeenCalledWith(
      '2fa_login_ticket:user@example.com:fixed-ticket-uuid',
      '1',
      { ex: TWO_FACTOR_LOGIN_TICKET_TTL_SECONDS }
    )
  })
})

describe('consumeTwoFactorLoginTicket', () => {
  it('空文字チケットは Redis を参照せず false', async () => {
    const { consumeTwoFactorLoginTicket } = await import('@/lib/two-factor-login-ticket')

    const ok = await consumeTwoFactorLoginTicket('user@example.com', '')

    expect(ok).toBe(false)
    expect(mockRedisGetdel).not.toHaveBeenCalled()
  })

  it('存在しない/期限切れチケットは false（GETDEL が null）', async () => {
    mockRedisGetdel.mockResolvedValueOnce(null)
    const { consumeTwoFactorLoginTicket } = await import('@/lib/two-factor-login-ticket')

    const ok = await consumeTwoFactorLoginTicket('user@example.com', 'missing')

    expect(ok).toBe(false)
    expect(mockRedisGetdel).toHaveBeenCalledWith('2fa_login_ticket:user@example.com:missing')
  })

  it('有効なチケットはアトミックに取得+削除（GETDEL）して true', async () => {
    mockRedisGetdel.mockResolvedValueOnce('1')
    const { consumeTwoFactorLoginTicket } = await import('@/lib/two-factor-login-ticket')

    const ok = await consumeTwoFactorLoginTicket('user@example.com', 'valid')

    expect(ok).toBe(true)
    expect(mockRedisGetdel).toHaveBeenCalledWith('2fa_login_ticket:user@example.com:valid')
    // GETDEL 単一コマンドで消費するため、別途 del は呼ばない
    expect(mockRedisDel).not.toHaveBeenCalled()
  })
})
