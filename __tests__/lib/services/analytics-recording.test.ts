// @vitest-environment node

import { vi, describe, it, expect, beforeEach } from 'vitest'
import { createMockPrismaClient } from '../../utils/test-utils'

const mockPrisma = createMockPrismaClient()
vi.mock('@/lib/db', () => ({
  prisma: mockPrisma,
}))

describe('lib/services/analytics-recording', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockPrisma.userAnalytics.upsert.mockResolvedValue({})
  })

  describe('recordProfileViewService', () => {
    it('当日 UserAnalytics の profileViews を +1 する upsert を発行する', async () => {
      const { recordProfileViewService } = await import('@/lib/services/analytics-recording')
      await recordProfileViewService('target-user-id')

      expect(mockPrisma.userAnalytics.upsert).toHaveBeenCalledTimes(1)
      const call = mockPrisma.userAnalytics.upsert.mock.calls[0][0]
      expect(call.where.userId_date.userId).toBe('target-user-id')
      expect(call.update.profileViews).toEqual({ increment: 1 })
      expect(call.create.profileViews).toBe(1)
    })

    it('DB エラーは呼び出し元へ伝播する', async () => {
      const error = new Error('DB down')
      mockPrisma.userAnalytics.upsert.mockRejectedValueOnce(error)
      const { recordProfileViewService } = await import('@/lib/services/analytics-recording')
      await expect(recordProfileViewService('u1')).rejects.toThrow('DB down')
    })
  })

  describe('recordPostViewService', () => {
    it('postViews を +1 する upsert を発行する', async () => {
      const { recordPostViewService } = await import('@/lib/services/analytics-recording')
      await recordPostViewService('target-user-id')

      const call = mockPrisma.userAnalytics.upsert.mock.calls[0][0]
      expect(call.update.postViews).toEqual({ increment: 1 })
      expect(call.create.postViews).toBe(1)
    })
  })

  describe('recordLikeReceivedService', () => {
    it('likesReceived を +1 する upsert を発行する', async () => {
      const { recordLikeReceivedService } = await import('@/lib/services/analytics-recording')
      await recordLikeReceivedService('target-user-id')

      const call = mockPrisma.userAnalytics.upsert.mock.calls[0][0]
      expect(call.update.likesReceived).toEqual({ increment: 1 })
      expect(call.create.likesReceived).toBe(1)
    })
  })

  describe('recordNewFollowerService', () => {
    it('newFollowers を +1 する upsert を発行する', async () => {
      const { recordNewFollowerService } = await import('@/lib/services/analytics-recording')
      await recordNewFollowerService('target-user-id')

      const call = mockPrisma.userAnalytics.upsert.mock.calls[0][0]
      expect(call.update.newFollowers).toEqual({ increment: 1 })
      expect(call.create.newFollowers).toBe(1)
    })
  })
})
