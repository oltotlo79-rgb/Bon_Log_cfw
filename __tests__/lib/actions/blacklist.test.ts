import { vi } from 'vitest'
/**
 * ブラックリスト管理Server Actionsのテスト
 */

// モック設定（blacklist固有）
const blMockAuth = vi.fn()
const blMockIsAdmin = vi.fn()
const blMockRevalidatePath = vi.fn()

const blMockPrisma = {
  emailBlacklist: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    delete: vi.fn(),
    count: vi.fn(),
  },
  deviceBlacklist: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    createMany: vi.fn(),
    delete: vi.fn(),
    count: vi.fn(),
  },
  userDevice: {
    findMany: vi.fn(),
    upsert: vi.fn(),
  },
  user: {
    findUnique: vi.fn(),
  },
  adminUser: {
    findUnique: vi.fn(),
  },
  adminLog: {
    create: vi.fn(),
  },
}

vi.mock('@/lib/auth', () => ({
  auth: () => blMockAuth(),
}))

vi.mock('@/lib/db', () => ({
  prisma: blMockPrisma,
}))

vi.mock('@/lib/actions/admin', () => ({
  isAdmin: () => blMockIsAdmin(),
}))

vi.mock('next/cache', () => ({ revalidatePath: blMockRevalidatePath, revalidateTag: vi.fn(), unstable_cache: vi.fn((fn) => fn), cache: vi.fn((fn) => fn) }))

describe('Blacklist Actions', async () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // デフォルトで管理者として認証
    blMockAuth.mockResolvedValue({ user: { id: 'admin-123' } })
    blMockIsAdmin.mockResolvedValue(true)
    blMockPrisma.adminUser.findUnique.mockResolvedValue({ role: 'admin' })
  })

  // ============================================================
  // addEmailToBlacklist
  // ============================================================

  describe('addEmailToBlacklist', async () => {
    it('認証されていない場合はエラーを返す', async () => {
      blMockAuth.mockResolvedValueOnce(null)

      const { addEmailToBlacklist } = await import('@/lib/actions/blacklist')
      const result = await addEmailToBlacklist('test@example.com')

      expect(result).toMatchObject({ error: '認証が必要です' })
    })

    it('管理者でない場合はエラーを返す', async () => {
      blMockPrisma.adminUser.findUnique.mockResolvedValueOnce(null)

      const { addEmailToBlacklist } = await import('@/lib/actions/blacklist')
      const result = await addEmailToBlacklist('test@example.com')

      expect(result).toMatchObject({ error: '管理者権限が必要です' })
    })

    it('無効なメールアドレスの場合はエラーを返す', async () => {
      const { addEmailToBlacklist } = await import('@/lib/actions/blacklist')
      const result = await addEmailToBlacklist('invalid-email')

      expect(result).toMatchObject({ error: '有効なメールアドレスを入力してください' })
    })

    it('空のメールアドレスの場合はエラーを返す', async () => {
      const { addEmailToBlacklist } = await import('@/lib/actions/blacklist')
      const result = await addEmailToBlacklist('')

      expect(result).toMatchObject({ error: '有効なメールアドレスを入力してください' })
    })

    it('既に登録されている場合はエラーを返す', async () => {
      blMockPrisma.emailBlacklist.findUnique.mockResolvedValueOnce({
        id: 'bl-1',
        email: 'test@example.com',
      })

      const { addEmailToBlacklist } = await import('@/lib/actions/blacklist')
      const result = await addEmailToBlacklist('test@example.com')

      expect(result).toMatchObject({ error: 'このメールアドレスは既にブラックリストに登録されています' })
    })

    it('正常に追加する', async () => {
      blMockPrisma.emailBlacklist.findUnique.mockResolvedValueOnce(null)
      blMockPrisma.emailBlacklist.create.mockResolvedValueOnce({
        id: 'bl-1',
        email: 'test@example.com',
      })

      const { addEmailToBlacklist } = await import('@/lib/actions/blacklist')
      const result = await addEmailToBlacklist('Test@Example.com', 'スパム行為')

      expect(result).toEqual({ success: true })
      expect(blMockPrisma.emailBlacklist.create).toHaveBeenCalledWith({
        data: {
          email: 'test@example.com', // 小文字に正規化
          reason: 'スパム行為',
          createdBy: 'admin-123',
        },
      })
      expect(blMockRevalidatePath).toHaveBeenCalledWith('/admin/blacklist')
    })

    it('DBエラーの場合はエラーを返す', async () => {
      blMockPrisma.emailBlacklist.findUnique.mockResolvedValueOnce(null)
      blMockPrisma.emailBlacklist.create.mockRejectedValueOnce(new Error('DB error'))

      const { addEmailToBlacklist } = await import('@/lib/actions/blacklist')
      const result = await addEmailToBlacklist('test@example.com')

      expect(result).toMatchObject({ error: 'ブラックリストへの追加に失敗しました' })
    })
  })

  // ============================================================
  // removeEmailFromBlacklist
  // ============================================================

  describe('removeEmailFromBlacklist', async () => {
    it('認証されていない場合はエラーを返す', async () => {
      blMockAuth.mockResolvedValueOnce(null)

      const { removeEmailFromBlacklist } = await import('@/lib/actions/blacklist')
      const result = await removeEmailFromBlacklist('bl-1')

      expect(result).toMatchObject({ error: '認証が必要です' })
    })

    it('管理者でない場合はエラーを返す', async () => {
      blMockPrisma.adminUser.findUnique.mockResolvedValueOnce(null)

      const { removeEmailFromBlacklist } = await import('@/lib/actions/blacklist')
      const result = await removeEmailFromBlacklist('bl-1')

      expect(result).toMatchObject({ error: '管理者権限が必要です' })
    })

    it('正常に削除する', async () => {
      blMockPrisma.emailBlacklist.delete.mockResolvedValueOnce({})

      const { removeEmailFromBlacklist } = await import('@/lib/actions/blacklist')
      const result = await removeEmailFromBlacklist('bl-1')

      expect(result).toEqual({ success: true })
      expect(blMockPrisma.emailBlacklist.delete).toHaveBeenCalledWith({
        where: { id: 'bl-1' },
      })
      expect(blMockRevalidatePath).toHaveBeenCalledWith('/admin/blacklist')
    })

    it('DBエラーの場合はエラーを返す', async () => {
      blMockPrisma.emailBlacklist.delete.mockRejectedValueOnce(new Error('DB error'))

      const { removeEmailFromBlacklist } = await import('@/lib/actions/blacklist')
      const result = await removeEmailFromBlacklist('bl-1')

      expect(result).toMatchObject({ error: 'ブラックリストからの削除に失敗しました' })
    })
  })

  // ============================================================
  // getEmailBlacklist
  // ============================================================

  describe('getEmailBlacklist', async () => {
    it('管理者でない場合はエラーを返す', async () => {
      blMockPrisma.adminUser.findUnique.mockResolvedValueOnce(null)

      const { getEmailBlacklist } = await import('@/lib/actions/blacklist')
      const result = await getEmailBlacklist()

      expect(result).toMatchObject({ error: '管理者権限が必要です' })
    })

    it('正常にリストを取得する', async () => {
      const mockItems = [
        { id: 'bl-1', email: 'spam1@example.com', reason: 'スパム', createdBy: 'admin-1', createdAt: new Date() },
        { id: 'bl-2', email: 'spam2@example.com', reason: null, createdBy: 'admin-1', createdAt: new Date() },
      ]
      blMockPrisma.emailBlacklist.findMany.mockResolvedValueOnce(mockItems)
      blMockPrisma.emailBlacklist.count.mockResolvedValueOnce(2)

      const { getEmailBlacklist } = await import('@/lib/actions/blacklist')
      const result = await getEmailBlacklist()

      expect(result).toMatchObject({
        success: true,
        data: { items: mockItems, total: 2 },
      })
    })

    it('検索・cursor付きで取得する', async () => {
      blMockPrisma.emailBlacklist.findMany.mockResolvedValueOnce([])
      blMockPrisma.emailBlacklist.count.mockResolvedValueOnce(0)

      const { getEmailBlacklist } = await import('@/lib/actions/blacklist')
      const result = await getEmailBlacklist({ search: 'spam', limit: 10, cursor: 'item-5' })

      expect(result).toMatchObject({ success: true, data: { items: [], total: 0, nextCursor: undefined } })
      expect(blMockPrisma.emailBlacklist.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 10,
          cursor: { id: 'item-5' },
          skip: 1,
        })
      )
    })

    it('DBエラーの場合はエラーを返す', async () => {
      blMockPrisma.emailBlacklist.findMany.mockRejectedValueOnce(new Error('DB error'))

      const { getEmailBlacklist } = await import('@/lib/actions/blacklist')
      const result = await getEmailBlacklist()

      expect(result).toMatchObject({ error: 'ブラックリストの取得に失敗しました' })
    })
  })

  // isEmailBlacklisted は server-only サービス `lib/services/blacklist-check` へ移設したため
  // `__tests__/lib/services/blacklist-check.test.ts` で検証する。

  // ============================================================
  // addDeviceToBlacklist
  // ============================================================

  describe('addDeviceToBlacklist', async () => {
    it('認証されていない場合はエラーを返す', async () => {
      blMockAuth.mockResolvedValueOnce(null)

      const { addDeviceToBlacklist } = await import('@/lib/actions/blacklist')
      const result = await addDeviceToBlacklist('fingerprint123')

      expect(result).toMatchObject({ error: '認証が必要です' })
    })

    it('管理者でない場合はエラーを返す', async () => {
      blMockPrisma.adminUser.findUnique.mockResolvedValueOnce(null)

      const { addDeviceToBlacklist } = await import('@/lib/actions/blacklist')
      const result = await addDeviceToBlacklist('fingerprint123')

      expect(result).toMatchObject({ error: '管理者権限が必要です' })
    })

    it('短すぎるフィンガープリントはエラーを返す', async () => {
      const { addDeviceToBlacklist } = await import('@/lib/actions/blacklist')
      const result = await addDeviceToBlacklist('short')

      expect(result).toMatchObject({ error: '有効なデバイスフィンガープリントを入力してください' })
    })

    it('既に登録されている場合はエラーを返す', async () => {
      blMockPrisma.deviceBlacklist.findUnique.mockResolvedValueOnce({
        id: 'dbl-1',
        fingerprint: 'fingerprint123',
      })

      const { addDeviceToBlacklist } = await import('@/lib/actions/blacklist')
      const result = await addDeviceToBlacklist('fingerprint123')

      expect(result).toMatchObject({ error: 'このデバイスは既にブラックリストに登録されています' })
    })

    it('正常に追加する', async () => {
      blMockPrisma.deviceBlacklist.findUnique.mockResolvedValueOnce(null)
      blMockPrisma.deviceBlacklist.create.mockResolvedValueOnce({})

      const { addDeviceToBlacklist } = await import('@/lib/actions/blacklist')
      const result = await addDeviceToBlacklist('fingerprint123', '不正行為', 'user@example.com')

      expect(result).toEqual({ success: true })
      expect(blMockPrisma.deviceBlacklist.create).toHaveBeenCalledWith({
        data: {
          fingerprint: 'fingerprint123',
          reason: '不正行為',
          originalEmail: 'user@example.com',
          createdBy: 'admin-123',
        },
      })
    })
  })

  // ============================================================
  // removeDeviceFromBlacklist
  // ============================================================

  describe('removeDeviceFromBlacklist', async () => {
    it('認証されていない場合はエラーを返す', async () => {
      blMockAuth.mockResolvedValueOnce(null)

      const { removeDeviceFromBlacklist } = await import('@/lib/actions/blacklist')
      const result = await removeDeviceFromBlacklist('dbl-1')

      expect(result).toMatchObject({ error: '認証が必要です' })
    })

    it('管理者でない場合はエラーを返す', async () => {
      blMockPrisma.adminUser.findUnique.mockResolvedValueOnce(null)

      const { removeDeviceFromBlacklist } = await import('@/lib/actions/blacklist')
      const result = await removeDeviceFromBlacklist('dbl-1')

      expect(result).toMatchObject({ error: '管理者権限が必要です' })
    })

    it('正常に削除する', async () => {
      blMockPrisma.deviceBlacklist.delete.mockResolvedValueOnce({})

      const { removeDeviceFromBlacklist } = await import('@/lib/actions/blacklist')
      const result = await removeDeviceFromBlacklist('dbl-1')

      expect(result).toEqual({ success: true })
    })
  })

  // ============================================================
  // getDeviceBlacklist
  // ============================================================

  describe('getDeviceBlacklist', async () => {
    it('管理者でない場合はエラーを返す', async () => {
      blMockPrisma.adminUser.findUnique.mockResolvedValueOnce(null)

      const { getDeviceBlacklist } = await import('@/lib/actions/blacklist')
      const result = await getDeviceBlacklist()

      expect(result).toMatchObject({ error: '管理者権限が必要です' })
    })

    it('正常にリストを取得する', async () => {
      const mockItems = [
        { id: 'dbl-1', fingerprint: 'fp1', reason: '不正', originalEmail: 'user1@example.com', createdBy: 'admin-1', createdAt: new Date() },
      ]
      blMockPrisma.deviceBlacklist.findMany.mockResolvedValueOnce(mockItems)
      blMockPrisma.deviceBlacklist.count.mockResolvedValueOnce(1)

      const { getDeviceBlacklist } = await import('@/lib/actions/blacklist')
      const result = await getDeviceBlacklist()

      expect(result).toMatchObject({
        success: true,
        data: { items: mockItems, total: 1 },
      })
    })
  })

  // isDeviceBlacklisted は server-only サービス `lib/services/blacklist-check` へ移設したため
  // `__tests__/lib/services/blacklist-check.test.ts` で検証する。

  // ============================================================
  // recordUserDevice
  // ============================================================

  describe('recordUserDevice', async () => {
    it('userIdがない場合は何もしない', async () => {
      const { recordUserDevice } = await import('@/lib/services/device-tracking')
      await recordUserDevice('', 'fingerprint')

      expect(blMockPrisma.userDevice.upsert).not.toHaveBeenCalled()
    })

    it('fingerprintがない場合は何もしない', async () => {
      const { recordUserDevice } = await import('@/lib/services/device-tracking')
      await recordUserDevice('user-123', '')

      expect(blMockPrisma.userDevice.upsert).not.toHaveBeenCalled()
    })

    it('正常にデバイスを記録する', async () => {
      blMockPrisma.userDevice.upsert.mockResolvedValueOnce({})

      const { recordUserDevice } = await import('@/lib/services/device-tracking')
      await recordUserDevice('user-123', 'fingerprint123', 'Mozilla/5.0', '192.168.1.1')

      expect(blMockPrisma.userDevice.upsert).toHaveBeenCalledWith({
        where: {
          userId_fingerprint: { userId: 'user-123', fingerprint: 'fingerprint123' },
        },
        create: {
          userId: 'user-123',
          fingerprint: 'fingerprint123',
          userAgent: 'Mozilla/5.0',
          ipAddress: '192.168.1.1',
        },
        update: expect.objectContaining({
          userAgent: 'Mozilla/5.0',
          ipAddress: '192.168.1.1',
        }),
      })
    })

    it('DBエラーが発生しても例外をスローしない', async () => {
      blMockPrisma.userDevice.upsert.mockRejectedValueOnce(new Error('DB error'))

      const { recordUserDevice } = await import('@/lib/services/device-tracking')
      await expect(recordUserDevice('user-123', 'fingerprint123')).resolves.not.toThrow()
    })
  })

  // ============================================================
  // getUserDevices
  // ============================================================

  describe('getUserDevices', async () => {
    it('管理者でない場合はエラーを返す', async () => {
      blMockPrisma.adminUser.findUnique.mockResolvedValueOnce(null)

      const { getUserDevices } = await import('@/lib/actions/blacklist')
      const result = await getUserDevices('user-123')

      expect(result).toMatchObject({ error: '管理者権限が必要です' })
    })

    it('正常にデバイス一覧を取得する', async () => {
      const mockDevices = [
        { id: 'd1', userId: 'user-123', fingerprint: 'fp1', lastSeenAt: new Date() },
        { id: 'd2', userId: 'user-123', fingerprint: 'fp2', lastSeenAt: new Date() },
      ]
      blMockPrisma.userDevice.findMany.mockResolvedValueOnce(mockDevices)

      const { getUserDevices } = await import('@/lib/actions/blacklist')
      const result = await getUserDevices('user-123')

      expect(result).toEqual({ success: true, data: mockDevices })
    })
  })

  // ============================================================
  // blacklistUserDevices
  // ============================================================

  describe('blacklistUserDevices', async () => {
    it('認証されていない場合はエラーを返す', async () => {
      blMockAuth.mockResolvedValueOnce(null)

      const { blacklistUserDevices } = await import('@/lib/actions/blacklist')
      const result = await blacklistUserDevices('user-123')

      expect(result).toMatchObject({ error: '認証が必要です' })
    })

    it('管理者でない場合はエラーを返す', async () => {
      blMockPrisma.adminUser.findUnique.mockResolvedValueOnce(null)

      const { blacklistUserDevices } = await import('@/lib/actions/blacklist')
      const result = await blacklistUserDevices('user-123')

      expect(result).toMatchObject({ error: '管理者権限が必要です' })
    })

    it('デバイスがない場合はエラーを返す', async () => {
      blMockPrisma.user.findUnique.mockResolvedValueOnce({ email: 'user@example.com' })
      blMockPrisma.userDevice.findMany.mockResolvedValueOnce([])

      const { blacklistUserDevices } = await import('@/lib/actions/blacklist')
      const result = await blacklistUserDevices('user-123')

      expect(result).toMatchObject({ error: 'このユーザーに関連付けられたデバイスがありません' })
    })

    it('全て既にブラックリスト登録済みの場合はエラーを返す', async () => {
      blMockPrisma.user.findUnique.mockResolvedValueOnce({ email: 'user@example.com' })
      blMockPrisma.userDevice.findMany.mockResolvedValueOnce([
        { fingerprint: 'fp1' },
        { fingerprint: 'fp2' },
      ])
      blMockPrisma.deviceBlacklist.findMany.mockResolvedValueOnce([
        { fingerprint: 'fp1' },
        { fingerprint: 'fp2' },
      ])

      const { blacklistUserDevices } = await import('@/lib/actions/blacklist')
      const result = await blacklistUserDevices('user-123')

      expect(result).toMatchObject({ error: '全てのデバイスは既にブラックリストに登録されています' })
    })

    it('正常にデバイスをブラックリストに追加する', async () => {
      blMockPrisma.user.findUnique.mockResolvedValueOnce({ email: 'user@example.com' })
      blMockPrisma.userDevice.findMany.mockResolvedValueOnce([
        { fingerprint: 'fp1' },
        { fingerprint: 'fp2' },
        { fingerprint: 'fp3' },
      ])
      blMockPrisma.deviceBlacklist.findMany.mockResolvedValueOnce([
        { fingerprint: 'fp1' }, // 既に登録済み
      ])
      blMockPrisma.deviceBlacklist.createMany.mockResolvedValueOnce({ count: 2 })

      const { blacklistUserDevices } = await import('@/lib/actions/blacklist')
      const result = await blacklistUserDevices('user-123', '不正利用')

      expect(result).toEqual({ success: true, data: { count: 2 } })
      expect(blMockPrisma.deviceBlacklist.createMany).toHaveBeenCalledWith({
        data: expect.arrayContaining([
          expect.objectContaining({ fingerprint: 'fp2' }),
          expect.objectContaining({ fingerprint: 'fp3' }),
        ]),
      })
    })
  })
})
