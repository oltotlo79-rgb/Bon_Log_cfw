// @vitest-environment node
/**
 * lib/api/v1/mobile-2fa-ticket のユニットテスト
 *
 * issueMobile2FATicket / consumeMobile2FATicket の発行・消費・空文字の検証。
 */
import { vi, describe, it, expect, beforeEach } from 'vitest'

const mockRedis = {
  get: vi.fn(),
  set: vi.fn().mockResolvedValue(undefined),
  del: vi.fn(),
  getdel: vi.fn(),
  incr: vi.fn(),
  expire: vi.fn(),
  ttl: vi.fn(),
}

vi.mock('@/lib/redis', () => ({
  getRedisClient: () => mockRedis,
}))

describe('lib/api/v1/mobile-2fa-ticket', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('issueMobile2FATicket', () => {
    it('UUID 形式のチケットを返し Redis に保存する', async () => {
      const { issueMobile2FATicket } = await import('@/lib/api/v1/mobile-2fa-ticket')
      const ticket = await issueMobile2FATicket('user-123')

      expect(typeof ticket).toBe('string')
      expect(ticket).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
      )

      expect(mockRedis.set).toHaveBeenCalledWith(
        `mobile_2fa_ticket:${ticket}`,
        'user-123',
        { ex: 300 }
      )
    })

    it('毎回異なるチケットを生成する', async () => {
      const { issueMobile2FATicket } = await import('@/lib/api/v1/mobile-2fa-ticket')
      const t1 = await issueMobile2FATicket('user-a')
      const t2 = await issueMobile2FATicket('user-b')
      expect(t1).not.toBe(t2)
    })
  })

  describe('consumeMobile2FATicket', () => {
    it('有効なチケットで userId を返しチケットを消費する', async () => {
      mockRedis.getdel.mockResolvedValueOnce('user-123')
      const { consumeMobile2FATicket } = await import('@/lib/api/v1/mobile-2fa-ticket')
      const userId = await consumeMobile2FATicket('valid-ticket-uuid')
      expect(userId).toBe('user-123')
      expect(mockRedis.getdel).toHaveBeenCalledWith('mobile_2fa_ticket:valid-ticket-uuid')
    })

    it('存在しないチケットで null を返す', async () => {
      mockRedis.getdel.mockResolvedValueOnce(null)
      const { consumeMobile2FATicket } = await import('@/lib/api/v1/mobile-2fa-ticket')
      const result = await consumeMobile2FATicket('expired-ticket')
      expect(result).toBeNull()
    })

    it('空文字チケットで null を返す（fail-closed）', async () => {
      const { consumeMobile2FATicket } = await import('@/lib/api/v1/mobile-2fa-ticket')
      const result = await consumeMobile2FATicket('')
      expect(result).toBeNull()
      expect(mockRedis.getdel).not.toHaveBeenCalled()
    })

    it('同じチケットの 2 回目の消費は null（GETDEL の単回消費）', async () => {
      mockRedis.getdel
        .mockResolvedValueOnce('user-abc')
        .mockResolvedValueOnce(null)

      const { consumeMobile2FATicket } = await import('@/lib/api/v1/mobile-2fa-ticket')
      const first = await consumeMobile2FATicket('ticket-x')
      const second = await consumeMobile2FATicket('ticket-x')
      expect(first).toBe('user-abc')
      expect(second).toBeNull()
    })
  })
})
