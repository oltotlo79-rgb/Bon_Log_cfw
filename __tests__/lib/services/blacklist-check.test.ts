// @vitest-environment node
/**
 * lib/services/blacklist-check のテスト。
 *
 * 旧 `lib/actions/blacklist` の isEmailBlacklisted / isDeviceBlacklisted（無認証の公開 RPC）を
 * server-only サービスへ移設したもの。正規化・fail-open（DB 障害時 false）挙動を担保する。
 */
import { vi, describe, it, expect, beforeEach } from 'vitest'

const mockPrisma = {
  emailBlacklist: { findUnique: vi.fn() },
  deviceBlacklist: { findUnique: vi.fn() },
}
vi.mock('@/lib/db', () => ({ prisma: mockPrisma }))

describe('blacklist-check service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('isEmailBlacklisted', () => {
    it('登録済みなら true を返し、email は小文字 + trim で照会する', async () => {
      mockPrisma.emailBlacklist.findUnique.mockResolvedValueOnce({ id: 'bl-1', email: 'spam@example.com' })
      const { isEmailBlacklisted } = await import('@/lib/services/blacklist-check')

      const result = await isEmailBlacklisted('  Spam@Example.com  ')

      expect(result).toBe(true)
      expect(mockPrisma.emailBlacklist.findUnique).toHaveBeenCalledWith({
        where: { email: 'spam@example.com' },
      })
    })

    it('未登録なら false を返す', async () => {
      mockPrisma.emailBlacklist.findUnique.mockResolvedValueOnce(null)
      const { isEmailBlacklisted } = await import('@/lib/services/blacklist-check')

      expect(await isEmailBlacklisted('clean@example.com')).toBe(false)
    })

    it('DB エラー時は false（fail-open）', async () => {
      mockPrisma.emailBlacklist.findUnique.mockRejectedValueOnce(new Error('DB error'))
      const { isEmailBlacklisted } = await import('@/lib/services/blacklist-check')

      expect(await isEmailBlacklisted('test@example.com')).toBe(false)
    })
  })

  describe('isDeviceBlacklisted', () => {
    it('空 fingerprint は照会せず false を返す', async () => {
      const { isDeviceBlacklisted } = await import('@/lib/services/blacklist-check')

      expect(await isDeviceBlacklisted('')).toBe(false)
      expect(mockPrisma.deviceBlacklist.findUnique).not.toHaveBeenCalled()
    })

    it('登録済みなら true を返す', async () => {
      mockPrisma.deviceBlacklist.findUnique.mockResolvedValueOnce({ id: 'd-1', fingerprint: 'fp1' })
      const { isDeviceBlacklisted } = await import('@/lib/services/blacklist-check')

      expect(await isDeviceBlacklisted('fp1')).toBe(true)
      expect(mockPrisma.deviceBlacklist.findUnique).toHaveBeenCalledWith({ where: { fingerprint: 'fp1' } })
    })

    it('未登録なら false を返す', async () => {
      mockPrisma.deviceBlacklist.findUnique.mockResolvedValueOnce(null)
      const { isDeviceBlacklisted } = await import('@/lib/services/blacklist-check')

      expect(await isDeviceBlacklisted('fp2')).toBe(false)
    })

    it('DB エラー時は false（fail-open）', async () => {
      mockPrisma.deviceBlacklist.findUnique.mockRejectedValueOnce(new Error('DB error'))
      const { isDeviceBlacklisted } = await import('@/lib/services/blacklist-check')

      expect(await isDeviceBlacklisted('fp3')).toBe(false)
    })
  })
})
