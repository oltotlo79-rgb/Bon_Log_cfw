// @vitest-environment node

import { vi, describe, it, expect, beforeEach } from 'vitest'
import { createMockPrismaClient } from '../../utils/test-utils'

const mockPrisma = createMockPrismaClient()
vi.mock('@/lib/db', () => ({ prisma: mockPrisma }))

const mockRequireActiveNonGuestUser = vi.fn()
const mockRequireAdmin = vi.fn()
const mockEnforceRateLimit = vi.fn().mockResolvedValue(null)
vi.mock('@/lib/actions/utils', async () => {
  const actual = await vi.importActual('@/lib/actions/utils')
  return {
    ...actual,
    requireActiveNonGuestUser: (...args: unknown[]) => mockRequireActiveNonGuestUser(...args),
    requireAdmin: (...args: unknown[]) => mockRequireAdmin(...args),
    enforceUserRateLimit: (...args: unknown[]) => mockEnforceRateLimit(...args),
  }
})

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
  unstable_cache: vi.fn((fn: unknown) => fn),
}))

import {
  ERR_SHOP_NOT_FOUND,
  ERR_REGISTRANT_CAN_EDIT,
  ERR_CHANGE_CONTENT_REQUIRED,
  ERR_PENDING_REQUEST_EXISTS,
  ERR_REQUEST_NOT_FOUND,
  ERR_REQUEST_ALREADY_PROCESSED,
} from '@/lib/constants/errors'

describe('shop-change-request actions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ============================================================
  // createShopChangeRequest
  // ============================================================
  describe('createShopChangeRequest', () => {
    async function importAction() {
      vi.resetModules()
      const mod = await import('@/lib/actions/shop-change-request')
      return mod.createShopChangeRequest
    }

    it('未認証の場合エラーを返す', async () => {
      mockRequireActiveNonGuestUser.mockResolvedValue({ error: '認証が必要です' })
      const action = await importAction()

      const result = await action('shop-1', { name: '新名称' })
      expect(result).toMatchObject({ success: false })
    })

    it('盆栽園が見つからない場合エラーを返す', async () => {
      mockRequireActiveNonGuestUser.mockResolvedValue({ userId: 'user-1' })
      mockPrisma.bonsaiShop.findUnique.mockResolvedValue(null)
      const action = await importAction()

      const result = await action('nonexistent', { name: '新名称' })
      expect(result).toMatchObject({ success: false, error: ERR_SHOP_NOT_FOUND })
    })

    it('登録者自身の場合エラーを返す', async () => {
      mockRequireActiveNonGuestUser.mockResolvedValue({ userId: 'user-1' })
      mockPrisma.bonsaiShop.findUnique.mockResolvedValue({ id: 'shop-1', createdBy: 'user-1' })
      const action = await importAction()

      const result = await action('shop-1', { name: '新名称' })
      expect(result).toMatchObject({ success: false, error: ERR_REGISTRANT_CAN_EDIT })
    })

    it('変更内容が空の場合エラーを返す', async () => {
      mockRequireActiveNonGuestUser.mockResolvedValue({ userId: 'user-1' })
      mockPrisma.bonsaiShop.findUnique.mockResolvedValue({ id: 'shop-1', createdBy: 'other' })
      const action = await importAction()

      const result = await action('shop-1', {})
      expect(result).toMatchObject({ success: false, error: ERR_CHANGE_CONTENT_REQUIRED })
    })

    it('既に保留中リクエストがある場合エラーを返す', async () => {
      mockRequireActiveNonGuestUser.mockResolvedValue({ userId: 'user-1' })
      mockPrisma.bonsaiShop.findUnique.mockResolvedValue({ id: 'shop-1', createdBy: 'other' })
      mockPrisma.shopChangeRequest.findFirst.mockResolvedValue({ id: 'req-existing' })
      const action = await importAction()

      const result = await action('shop-1', { name: '新名称' })
      expect(result).toMatchObject({ success: false, error: ERR_PENDING_REQUEST_EXISTS })
    })

    it('正常にリクエストを作成できる', async () => {
      mockRequireActiveNonGuestUser.mockResolvedValue({ userId: 'user-1' })
      mockPrisma.bonsaiShop.findUnique.mockResolvedValue({ id: 'shop-1', createdBy: 'other' })
      mockPrisma.shopChangeRequest.findFirst.mockResolvedValue(null)
      mockPrisma.shopChangeRequest.create.mockResolvedValue({ id: 'req-new' })
      const action = await importAction()

      const result = await action('shop-1', { name: '新名称', address: '東京都' }, '住所が変わりました')
      expect(result).toMatchObject({ success: true, data: { requestId: 'req-new' } })
      expect(mockPrisma.shopChangeRequest.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          shopId: 'shop-1',
          userId: 'user-1',
          requestedChanges: { name: '新名称', address: '東京都' },
          reason: '住所が変わりました',
        }),
      })
    })

    it('reason が空白の場合 null になる', async () => {
      mockRequireActiveNonGuestUser.mockResolvedValue({ userId: 'user-1' })
      mockPrisma.bonsaiShop.findUnique.mockResolvedValue({ id: 'shop-1', createdBy: 'other' })
      mockPrisma.shopChangeRequest.findFirst.mockResolvedValue(null)
      mockPrisma.shopChangeRequest.create.mockResolvedValue({ id: 'req-new' })
      const action = await importAction()

      await action('shop-1', { name: '新名称' }, '  ')
      expect(mockPrisma.shopChangeRequest.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ reason: null }),
      })
    })
  })

  // ============================================================
  // getShopChangeRequests
  // ============================================================
  describe('getShopChangeRequests', () => {
    async function importAction() {
      vi.resetModules()
      const mod = await import('@/lib/actions/shop-change-request')
      return mod.getShopChangeRequests
    }

    it('管理者でない場合エラーを返す', async () => {
      mockRequireAdmin.mockResolvedValue({ error: '管理者権限が必要です' })
      const action = await importAction()

      const result = await action()
      expect(result).toMatchObject({ success: false })
    })

    it('リクエスト一覧を取得できる', async () => {
      mockRequireAdmin.mockResolvedValue({ userId: 'admin-1' })
      const requests = [
        { id: 'req-1', shop: { name: 'Shop A' }, user: { nickname: 'User' } },
      ]
      mockPrisma.shopChangeRequest.findMany.mockResolvedValue(requests)
      const action = await importAction()

      const result = await action({ status: 'pending' })
      expect(result).toMatchObject({ requests })
    })

    it('status=all の場合フィルタなしで取得', async () => {
      mockRequireAdmin.mockResolvedValue({ userId: 'admin-1' })
      mockPrisma.shopChangeRequest.findMany.mockResolvedValue([])
      const action = await importAction()

      await action({ status: 'all' })
      expect(mockPrisma.shopChangeRequest.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {},
        })
      )
    })
  })

  // ============================================================
  // approveShopChangeRequest
  // ============================================================
  describe('approveShopChangeRequest', () => {
    async function importAction() {
      vi.resetModules()
      const mod = await import('@/lib/actions/shop-change-request')
      return mod.approveShopChangeRequest
    }

    it('管理者でない場合エラーを返す', async () => {
      mockRequireAdmin.mockResolvedValue({ error: '管理者権限が必要です' })
      const action = await importAction()

      const result = await action('req-1')
      expect(result).toMatchObject({ success: false })
    })

    it('リクエストが見つからない場合エラーを返す', async () => {
      mockRequireAdmin.mockResolvedValue({ userId: 'admin-1' })
      mockPrisma.shopChangeRequest.findUnique.mockResolvedValue(null)
      const action = await importAction()

      const result = await action('nonexistent')
      expect(result).toMatchObject({ success: false, error: ERR_REQUEST_NOT_FOUND })
    })

    it('既に処理済みの場合エラーを返す', async () => {
      mockRequireAdmin.mockResolvedValue({ userId: 'admin-1' })
      mockPrisma.shopChangeRequest.findUnique.mockResolvedValue({
        id: 'req-1',
        status: 'approved',
        shop: {},
      })
      const action = await importAction()

      const result = await action('req-1')
      expect(result).toMatchObject({ success: false, error: ERR_REQUEST_ALREADY_PROCESSED })
    })

    it('正常に承認できる', async () => {
      mockRequireAdmin.mockResolvedValue({ userId: 'admin-1' })
      mockPrisma.shopChangeRequest.findUnique.mockResolvedValue({
        id: 'req-1',
        status: 'pending',
        shopId: 'shop-1',
        requestedChanges: { name: '新名称' },
        shop: { id: 'shop-1' },
      })
      mockPrisma.$transaction.mockResolvedValue([])
      const action = await importAction()

      const result = await action('req-1', 'LGTM')
      expect(result).toMatchObject({ success: true })
    })
  })

  // ============================================================
  // rejectShopChangeRequest
  // ============================================================
  describe('rejectShopChangeRequest', () => {
    async function importAction() {
      vi.resetModules()
      const mod = await import('@/lib/actions/shop-change-request')
      return mod.rejectShopChangeRequest
    }

    it('管理者でない場合エラーを返す', async () => {
      mockRequireAdmin.mockResolvedValue({ error: '管理者権限が必要です' })
      const action = await importAction()

      const result = await action('req-1')
      expect(result).toMatchObject({ success: false })
    })

    it('リクエストが見つからない場合エラーを返す', async () => {
      mockRequireAdmin.mockResolvedValue({ userId: 'admin-1' })
      mockPrisma.shopChangeRequest.findUnique.mockResolvedValue(null)
      const action = await importAction()

      const result = await action('nonexistent')
      expect(result).toMatchObject({ success: false, error: ERR_REQUEST_NOT_FOUND })
    })

    it('既に処理済みの場合エラーを返す', async () => {
      mockRequireAdmin.mockResolvedValue({ userId: 'admin-1' })
      mockPrisma.shopChangeRequest.findUnique.mockResolvedValue({
        id: 'req-1',
        status: 'approved',
      })
      const action = await importAction()

      const result = await action('req-1')
      expect(result).toMatchObject({ success: false, error: ERR_REQUEST_ALREADY_PROCESSED })
    })

    it('正常に却下できる', async () => {
      mockRequireAdmin.mockResolvedValue({ userId: 'admin-1' })
      mockPrisma.shopChangeRequest.findUnique.mockResolvedValue({
        id: 'req-1',
        status: 'pending',
        shopId: 'shop-1',
      })
      mockPrisma.$transaction.mockResolvedValue([])
      const action = await importAction()

      const result = await action('req-1', '理由が不十分')
      expect(result).toMatchObject({ success: true })
    })
  })

  // ============================================================
  // getPendingShopChangeRequestCount / getPendingShopChangeRequestsCount
  // ============================================================
  describe('getPendingShopChangeRequestCount', () => {
    async function importAction() {
      vi.resetModules()
      const mod = await import('@/lib/actions/shop-change-request')
      return mod.getPendingShopChangeRequestCount
    }

    it('管理者でない場合 count:0 を返す', async () => {
      mockRequireAdmin.mockResolvedValue({ error: '管理者権限が必要です' })
      const action = await importAction()

      const result = await action()
      expect(result).toEqual({ count: 0 })
    })

    it('保留中リクエスト数を返す', async () => {
      mockRequireAdmin.mockResolvedValue({ userId: 'admin-1' })
      mockPrisma.shopChangeRequest.count.mockResolvedValue(5)
      const action = await importAction()

      const result = await action()
      expect(result).toEqual({ count: 5 })
    })
  })

  describe('getShopChangeRequest (detail)', () => {
    async function importAction() {
      vi.resetModules()
      const mod = await import('@/lib/actions/shop-change-request')
      return mod.getShopChangeRequest
    }

    it('管理者でない場合エラーを返す', async () => {
      mockRequireAdmin.mockResolvedValue({ error: '管理者権限が必要です' })
      const action = await importAction()

      const result = await action('req-1')
      expect(result).toMatchObject({ success: false })
    })

    it('リクエストが見つからない場合エラーを返す', async () => {
      mockRequireAdmin.mockResolvedValue({ userId: 'admin-1' })
      mockPrisma.shopChangeRequest.findUnique.mockResolvedValue(null)
      const action = await importAction()

      const result = await action('nonexistent')
      expect(result).toMatchObject({ success: false, error: ERR_REQUEST_NOT_FOUND })
    })

    it('リクエスト詳細を取得できる', async () => {
      mockRequireAdmin.mockResolvedValue({ userId: 'admin-1' })
      const mockRequest = {
        id: 'req-1',
        shop: { name: 'Shop A' },
        user: { nickname: 'User' },
      }
      mockPrisma.shopChangeRequest.findUnique.mockResolvedValue(mockRequest)
      const action = await importAction()

      const result = await action('req-1')
      expect(result).toMatchObject({ request: mockRequest })
    })
  })
})
