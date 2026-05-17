// @vitest-environment node

import { vi } from 'vitest'
import { createMockPrismaClient } from '../../utils/test-utils'

const mockPrisma = createMockPrismaClient()
vi.mock('@/lib/db', () => ({
  prisma: mockPrisma,
}))

describe('authorization service', async () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('canUserEditShop', async () => {
    it('管理者ユーザーは許可される', async () => {
      mockPrisma.bonsaiShop.findUnique.mockResolvedValue({ createdBy: 'other-user' })
      mockPrisma.adminUser.findUnique.mockResolvedValue({ userId: 'admin-user', role: 'admin' })

      const { canUserEditShop } = await import('@/lib/services/authorization')
      const result = await canUserEditShop('admin-user', 'shop-1')

      expect(result.allowed).toBe(true)
      expect(result.isAdmin).toBe(true)
    })

    it('盆栽園の作成者は許可される', async () => {
      mockPrisma.bonsaiShop.findUnique.mockResolvedValue({ createdBy: 'creator-user' })
      mockPrisma.adminUser.findUnique.mockResolvedValue(null)

      const { canUserEditShop } = await import('@/lib/services/authorization')
      const result = await canUserEditShop('creator-user', 'shop-1')

      expect(result.allowed).toBe(true)
      expect(result.isAdmin).toBeUndefined()
    })

    it('管理者でも作成者でもない場合は拒否される', async () => {
      mockPrisma.bonsaiShop.findUnique.mockResolvedValue({ createdBy: 'creator-user' })
      mockPrisma.adminUser.findUnique.mockResolvedValue(null)

      const { canUserEditShop } = await import('@/lib/services/authorization')
      const result = await canUserEditShop('other-user', 'shop-1')

      expect(result.allowed).toBe(false)
      expect(result.reason).toBe('Not the shop owner')
    })

    it('盆栽園が見つからない場合は拒否される', async () => {
      mockPrisma.bonsaiShop.findUnique.mockResolvedValue(null)
      mockPrisma.adminUser.findUnique.mockResolvedValue(null)

      const { canUserEditShop } = await import('@/lib/services/authorization')
      const result = await canUserEditShop('any-user', 'nonexistent-shop')

      expect(result.allowed).toBe(false)
      expect(result.reason).toBe('Shop not found')
    })

    it('管理者でありかつ盆栽園が存在する場合は管理者フラグがtrueになる', async () => {
      mockPrisma.bonsaiShop.findUnique.mockResolvedValue({ createdBy: 'creator-user' })
      mockPrisma.adminUser.findUnique.mockResolvedValue({ userId: 'admin-user', role: 'admin' })

      const { canUserEditShop } = await import('@/lib/services/authorization')
      const result = await canUserEditShop('admin-user', 'shop-1')

      expect(result.allowed).toBe(true)
      expect(result.isAdmin).toBe(true)
    })

    it('DBエラー時はエラーがスローされる', async () => {
      mockPrisma.bonsaiShop.findUnique.mockRejectedValue(new Error('DB connection error'))
      mockPrisma.adminUser.findUnique.mockRejectedValue(new Error('DB connection error'))

      const { canUserEditShop } = await import('@/lib/services/authorization')

      await expect(canUserEditShop('user-1', 'shop-1')).rejects.toThrow()
    })
  })
})
